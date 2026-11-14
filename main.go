// Command goacademy — локальный сервер интерактивного курса по Go.
//
// Запуск:  go run .   (затем откройте http://127.0.0.1:8080)
package main

import (
	"embed"
	"flag"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

//go:embed static
var staticFS embed.FS

//go:embed content
var contentFS embed.FS

//go:embed all:tracks
var tracksEmbed embed.FS

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "адрес для прослушивания (по умолчанию только localhost)")
	dataDir := flag.String("data", "data", "каталог для хранения прогресса (progress.json)")
	dev := flag.Bool("dev", false, "режим разработки: читать content/ и static/ с диска и перечитывать уроки при каждом запросе")
	timeout := flag.Duration("timeout", 15*time.Second, "лимит времени на сборку и запуск одной программы")
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

	runner, err := NewRunner(*timeout, 0)
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
	log.Printf("Откройте http://%s в браузере", *addr)

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv.guard(mux),
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

func orNone(s string) string {
	if s == "" {
		return "не найден"
	}
	return s
}
