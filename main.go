// Command goacademy — сервер интерактивных курсов по Go, Java, SQL, Git и Spring Boot.
//
// Локально:  go run .   (затем откройте http://127.0.0.1:8080)
// В интернете (Docker, Render): см. README, раздел «Размещение в интернете».
package main

import (
	"embed"
	"flag"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

//go:embed static
var staticFS embed.FS

//go:embed content
var contentFS embed.FS

//go:embed all:tracks
var tracksEmbed embed.FS

func main() {
	port := os.Getenv("PORT")
	defaultAddr := "127.0.0.1:8080"

	if port != "" {
		defaultAddr = "0.0.0.0:" + port
	}

	addr := flag.String("addr", defaultAddr, "адрес для прослушивания")
	dataDir := flag.String("data", envOr("ACADEMY_DATA", "data"), "каталог для хранения прогресса (progress.json)")
	dev := flag.Bool("dev", false, "режим разработки: читать content/ и static/ с диска и перечитывать уроки при каждом запросе")
	timeout := flag.Duration("timeout", 15*time.Second, "лимит времени на сборку и запуск одной программы")
	sandboxUID := flag.Int("sandbox-uid", atoiOr(os.Getenv("ACADEMY_SANDBOX_UID"), -1), "запускать код учеников от имени этого uid (Linux, сервер должен работать от root)")
	parallel := flag.Int("parallel", atoiOr(os.Getenv("ACADEMY_PARALLEL"), 0), "сколько программ можно собирать и запускать одновременно (0 — автоматически)")
	memLimit := flag.Int("memlimit", 512, "лимит памяти запускаемой программы в МБ (0 — без ограничения; работает на Linux)")
	flag.Parse()

	// Абсолютный путь: файл прогресса не должен «переезжать» при смене рабочего каталога.
	if abs, err := filepath.Abs(*dataDir); err == nil {
		*dataDir = abs
	}

	var content, static, tracks fs.FS
	if *dev {
		content = os.DirFS("content")
		tracks = os.DirFS("tracks")
		static = os.DirFS("static")
	} else {
		content, _ = fs.Sub(contentFS, "content")
		tracks, _ = fs.Sub(tracksEmbed, "tracks")
		static, _ = fs.Sub(staticFS, "static")
	}

	catalog, err := LoadCatalog(content, tracks)
	if err != nil {
		log.Fatalf("ошибка загрузки курса: %v", err)
	}

	// Сервер исполняет присланный код. Если он доступен не только с этого
	// компьютера, вход обязательно закрывается паролем.
	password := os.Getenv("ACADEMY_PASSWORD")
	if !isLoopbackAddr(*addr) && len(password) < 8 {
		log.Fatalf("сервер будет доступен из сети (%s) и исполняет присланный код: задайте пароль для входа "+
			"в переменной окружения ACADEMY_PASSWORD (не короче 8 символов)", *addr)
	}
	if *sandboxUID >= 0 {
		if err := enableSandbox(*sandboxUID); err != nil {
			// Сайт всё равно закрыт паролем, поэтому продолжаем, но предупреждаем.
			log.Printf("ВНИМАНИЕ: песочница не включена (%v); код учеников выполняется с правами сервера", err)
		} else {
			log.Printf("Код учеников запускается от имени uid %d", *sandboxUID)
		}
	}

	runner, err := NewRunner(*timeout, *parallel)
	if err != nil {
		log.Fatalf("не удалось найти Go: %v", err)
	}
	runner.MemLimit = int64(*memLimit) << 20

	srv := &Server{
		catalog:  catalog,
		content:  content,
		tracks:   tracks,
		dev:      *dev,
		runner:   runner,
		progress: NewProgressStore(*dataDir),
	}

	mux := http.NewServeMux()
	srv.Routes(mux)
	mux.Handle("GET /", noCache(http.FileServerFS(static)))

	for _, t := range catalog.Tracks {
		st := t.Course.Stats()
		log.Printf("Курс %-10s модулей %2d, уроков %2d, задач %3d, вопросов %3d, карточек %3d", t.Title+":", st.Modules, st.Lessons, st.Tasks, st.Questions, st.Cards)
	}
	log.Printf("go = %s (%s); java = %s; python = %s; git = %s", runner.GoBin, runner.GoVersion, orNone(runner.Tools.JavaVersion), orNone(runner.Tools.Python), orNone(runner.Tools.Git))
	log.Printf("Прогресс хранится в %s (резервные копии — в подкаталоге backups)", srv.progress.Path())
	log.Printf("Сервер слушает %s", *addr)

	var handler http.Handler = srv.guard(mux)
	if password != "" {
		handler = requirePassword(password, handler)
		log.Printf("Вход на сайт закрыт паролем из ACADEMY_PASSWORD")
	}
	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Fatal(httpSrv.ListenAndServe())
}

// noCache заставляет браузер каждый раз сверяться с сервером: после обновления
// сайта не останется старых скриптов и стилей в кэше.
func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

func atoiOr(s string, def int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
		return n
	}
	return def
}

// isLoopbackAddr — адрес слушает только этот компьютер (127.0.0.1, ::1, localhost).
func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && ip.IsLoopback()
}

func orNone(s string) string {
	if s == "" {
		return "не найден"
	}
	return s
}
