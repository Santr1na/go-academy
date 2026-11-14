package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// maxOutput — максимальный объём вывода, который мы сохраняем (на поток).
const maxOutput = 64 * 1024

// Runner собирает и запускает пользовательский код во временном каталоге.
//
// ВНИМАНИЕ: код выполняется без песочницы с правами текущего пользователя.
// Предназначено только для локального личного использования.
type Runner struct {
	GoBin     string
	GoVersion string // например "1.27"
	Timeout   time.Duration
	// MemLimit — предел резидентной памяти запущенной программы в байтах
	// (0 — без ограничения). Спасает от «бесконечного append», который иначе
	// за секунды съедает всю память компьютера. Работает на Linux.
	MemLimit int64
	// Tools — внешние программы для курсов Java, SQL и Git.
	Tools Tools

	env []string
	sem chan struct{}
}

// RunResult — результат запуска или проверки.
type RunResult struct {
	Phase       string `json:"phase"` // build | run | test
	OK          bool   `json:"ok"`    // сборка и запуск/тесты прошли успешно
	Passed      bool   `json:"passed"`
	Stdout      string `json:"stdout"`
	Stderr      string `json:"stderr"`
	ExitCode    int    `json:"exitCode"`
	TimedOut    bool   `json:"timedOut"`
	MemExceeded bool   `json:"memExceeded"`
	Truncated   bool   `json:"truncated"`
	DurationMs  int64  `json:"durationMs"`
	TestsPass   int    `json:"testsPass"`
	TestsFail   int    `json:"testsFail"`
}

// findGo ищет бинарник go: $GO_BIN, затем PATH, затем известные пути.
func findGo() (string, error) {
	if p := os.Getenv("GO_BIN"); p != "" {
		return p, nil
	}
	if p, err := exec.LookPath("go"); err == nil {
		return p, nil
	}
	candidates := []string{filepath.Join(runtime.GOROOT(), "bin", "go")}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, filepath.Join(home, ".local", "go", "bin", "go"), filepath.Join(home, "go", "bin", "go"))
	}
	candidates = append(candidates, "/home/santrina/.local/go/bin/go", "/usr/local/go/bin/go", "/usr/lib/go/bin/go")
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c, nil
		}
	}
	return "", errors.New("go не найден: установите Go, добавьте его в PATH или задайте GO_BIN")
}

// NewRunner создаёт Runner. parallel<=0 — автоматический выбор.
func NewRunner(timeout time.Duration, parallel int) (*Runner, error) {
	goBin, err := findGo()
	if err != nil {
		return nil, err
	}
	if parallel <= 0 {
		parallel = max(1, min(4, runtime.NumCPU()/2))
	}
	r := &Runner{GoBin: goBin, Timeout: timeout, MemLimit: 512 << 20, sem: make(chan struct{}, parallel)}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, goBin, "env", "GOVERSION", "GOCACHE").Output()
	if err != nil {
		return nil, fmt.Errorf("%s env: %w", goBin, err)
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	r.GoVersion = "1.22"
	if m := regexp.MustCompile(`^go(\d+\.\d+)`).FindStringSubmatch(lines[0]); m != nil {
		r.GoVersion = m[1]
	}

	env := childEnv(os.Environ())
	env = append(env,
		"GOTOOLCHAIN=local", // не скачивать другие версии тулчейна
		"GOPROXY=off",       // никаких сетевых запросов за модулями
		"GOFLAGS=",
		"GOWORK=off",
		"GO111MODULE=on",
		"CGO_ENABLED=0",
	)
	// Переиспользуем обычный кэш сборки пользователя — так сборки быстрые.
	if len(lines) > 1 && lines[1] != "" && lines[1] != "off" {
		env = append(env, "GOCACHE="+lines[1])
	}
	r.env = env
	r.Tools = findTools()
	return r, nil
}

// limitedBuffer хранит не больше max байт, остальное отбрасывает.
type limitedBuffer struct {
	mu        sync.Mutex
	buf       bytes.Buffer
	max       int
	truncated bool
	onFull    func()
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	room := b.max - b.buf.Len()
	if room <= 0 {
		if !b.truncated && b.onFull != nil {
			b.onFull()
		}
		b.truncated = true
		return len(p), nil
	}
	if len(p) > room {
		b.buf.Write(p[:room])
		b.truncated = true
		if b.onFull != nil {
			b.onFull()
		}
		return len(p), nil
	}
	b.buf.Write(p)
	return len(p), nil
}

func (b *limitedBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	s := b.buf.String()
	if b.truncated {
		s += "\n…[вывод обрезан: превышен лимит " + fmt.Sprint(b.max/1024) + " КБ]"
	}
	return s
}

// Run собирает и запускает программу (package main с func main).
func (r *Runner) Run(ctx context.Context, code string) *RunResult {
	return r.exec(ctx, code, "")
}

// Check собирает код вместе со скрытыми тестами и запускает их.
func (r *Runner) Check(ctx context.Context, code, test string) *RunResult {
	return r.exec(ctx, code, test)
}

func (r *Runner) exec(ctx context.Context, code, test string) *RunResult {
	select {
	case r.sem <- struct{}{}:
		defer func() { <-r.sem }()
	case <-ctx.Done():
		return &RunResult{Phase: "build", Stderr: "запрос отменён"}
	}

	start := time.Now()
	res := &RunResult{Phase: "build", ExitCode: -1}
	defer func() { res.DurationMs = time.Since(start).Milliseconds() }()

	dir, err := os.MkdirTemp("", "goacademy-*")
	if err != nil {
		res.Stderr = "не удалось создать временный каталог: " + err.Error()
		return res
	}
	defer os.RemoveAll(dir)

	files := map[string]string{
		"go.mod":  "module sandbox\n\ngo " + r.GoVersion + "\n",
		"main.go": code,
	}
	if test != "" {
		files["checker_test.go"] = test
	}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o600); err != nil {
			res.Stderr = err.Error()
			return res
		}
	}

	ctx, cancel := context.WithTimeout(ctx, r.Timeout)
	defer cancel()

	// 1. Сборка.
	bin := filepath.Join(dir, "prog")
	var buildArgs []string
	if test == "" {
		buildArgs = []string{"build", "-o", bin, "."}
	} else {
		buildArgs = []string{"test", "-c", "-o", bin, "."}
	}
	out := &limitedBuffer{max: maxOutput}
	cmd := exec.CommandContext(ctx, r.GoBin, buildArgs...)
	cmd.Dir = dir
	cmd.Env = r.env
	cmd.Stdout, cmd.Stderr = out, out
	setupProcess(cmd)
	if err := cmd.Run(); err != nil {
		res.TimedOut = ctx.Err() != nil
		res.Stderr = cleanOutput(out.String(), dir)
		if res.TimedOut {
			res.Stderr += "\n⏱ Превышено время сборки (" + r.Timeout.String() + ")"
		}
		if res.Stderr == "" {
			res.Stderr = err.Error()
		}
		if test != "" && !res.TimedOut {
			res.Stderr = r.explainTestBuildFailure(ctx, dir, res.Stderr)
		}
		return res
	}

	// 2. Запуск.
	if test == "" {
		res.Phase = "run"
	} else {
		res.Phase = "test"
	}
	stdout := &limitedBuffer{max: maxOutput, onFull: cancel}
	stderr := &limitedBuffer{max: maxOutput, onFull: cancel}
	var args []string
	if test != "" {
		t := r.Timeout - time.Since(start) - 500*time.Millisecond
		if t < time.Second {
			t = time.Second
		}
		args = []string{"-test.v", "-test.count=1", "-test.timeout=" + t.Round(time.Millisecond).String()}
	}
	cmd = exec.CommandContext(ctx, bin, args...)
	cmd.Dir = dir
	cmd.Env = r.env
	cmd.Stdout = stdout
	if test != "" {
		cmd.Stderr = stdout // вывод тестов удобнее видеть одним потоком
	} else {
		cmd.Stderr = stderr
	}
	setupProcess(cmd)
	var memKilled atomic.Bool
	if err = cmd.Start(); err == nil {
		stop := make(chan struct{})
		if r.MemLimit > 0 {
			go watchMemory(cmd.Process.Pid, r.MemLimit, stop, func() {
				memKilled.Store(true)
				cancel() // убивает всю группу процессов
			})
		}
		err = cmd.Wait()
		close(stop)
	}
	res.Stdout = compactTrace(cleanOutput(stdout.String(), dir))
	res.Stderr = compactTrace(cleanOutput(stderr.String(), dir))
	res.Truncated = stdout.truncated || stderr.truncated
	if cmd.ProcessState != nil {
		res.ExitCode = cmd.ProcessState.ExitCode()
	}
	switch {
	case memKilled.Load():
		res.MemExceeded = true
		res.Stderr += fmt.Sprintf("\n💾 Программа заняла больше %d МБ памяти и была остановлена. "+
			"Обычно это бесконечный цикл, в котором растёт срез или строка, либо рекурсия без условия выхода.", r.MemLimit>>20)
	case ctx.Err() != nil && !res.Truncated:
		res.TimedOut = true
		res.Stderr += "\n⏱ Превышено время выполнения (" + r.Timeout.String() + "). Возможно, бесконечный цикл или deadlock."
	case strings.Contains(res.Stdout, "panic: test timed out after"):
		// тестовый бинарник сам прервался по -test.timeout
		res.TimedOut = true
	}
	res.OK = err == nil
	if test != "" {
		res.TestsPass = strings.Count(res.Stdout, "--- PASS")
		res.TestsFail = strings.Count(res.Stdout, "--- FAIL")
		res.Passed = res.OK && res.TestsFail == 0
	}
	return res
}

var (
	goroutineHdrRe = regexp.MustCompile(`^goroutine \d+ .*:$`)
	frameArgsRe    = regexp.MustCompile(`\([^()]*\)$`)
	frameOffsetRe  = regexp.MustCompile(` \+0x[0-9a-f]+$`)
)

// compactTrace убирает из дампа горутин (паника, deadlock, таймаут тестов) всё,
// что не относится к коду пользователя: кадры стандартной библиотеки и
// служебные горутины пакета testing. Остаются сообщение об ошибке и строки
// main.go / checker_test.go — то, что действительно помогает найти проблему.
func compactTrace(out string) string {
	lines := strings.Split(out, "\n")
	first := -1
	for i, l := range lines {
		if goroutineHdrRe.MatchString(l) {
			first = i
			break
		}
	}
	if first < 0 {
		return out
	}
	kept := append([]string{}, lines[:first]...)
	i := first
	for i < len(lines) && goroutineHdrRe.MatchString(lines[i]) {
		block := []string{lines[i]}
		i++
		for i < len(lines) && lines[i] != "" {
			fn := lines[i]
			// кадр — пара строк: «функция(аргументы)» и «\tфайл:строка +смещение»
			if i+1 < len(lines) && strings.HasPrefix(lines[i+1], "\t") {
				loc := lines[i+1]
				i += 2
				// абсолютный путь или сгенерированный _testmain.go — не код пользователя
				if strings.ContainsAny(loc, `/\`) || strings.HasPrefix(loc, "\t_testmain.go") {
					continue
				}
				if !strings.HasPrefix(fn, "created by ") {
					fn = frameArgsRe.ReplaceAllString(fn, "(...)")
				}
				block = append(block, fn, frameOffsetRe.ReplaceAllString(loc, ""))
				continue
			}
			i++
		}
		if len(block) > 1 {
			kept = append(kept, block...)
			kept = append(kept, "")
		}
		for i < len(lines) && lines[i] == "" {
			i++
		}
	}
	kept = append(kept, lines[i:]...)
	return strings.TrimRight(strings.Join(kept, "\n"), "\n") + "\n"
}

// explainTestBuildFailure делает сообщение об ошибке сборки понятнее: если не
// компилируется сам код пользователя, показываем только его ошибки (без шума
// из скрытых тестов); если код собирается, но не стыкуется с тестами — значит,
// не совпадают имена или сигнатуры функций/типов из условия задачи.
func (r *Runner) explainTestBuildFailure(ctx context.Context, dir, testOutput string) string {
	if err := os.Remove(filepath.Join(dir, "checker_test.go")); err != nil {
		return testOutput
	}
	out := &limitedBuffer{max: maxOutput}
	cmd := exec.CommandContext(ctx, r.GoBin, "build", "-o", filepath.Join(dir, "prog"), ".")
	cmd.Dir = dir
	cmd.Env = r.env
	cmd.Stdout, cmd.Stderr = out, out
	setupProcess(cmd)
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return testOutput
		}
		return cleanOutput(out.String(), dir)
	}
	return testOutput + "\nВаш код компилируется сам по себе, но не подходит к скрытым тестам.\n" +
		"Проверьте, что имена и сигнатуры функций, типов и полей точно совпадают с условием задачи."
}

var pkgHeaderRe = regexp.MustCompile(`(?m)^# sandbox( \[sandbox\.test\])?\n`)

func cleanOutput(s, dir string) string {
	s = strings.ReplaceAll(s, dir+string(filepath.Separator), "")
	s = strings.ReplaceAll(s, dir, "sandbox")
	return pkgHeaderRe.ReplaceAllString(s, "") // заголовок пакета от go build ничего не говорит ученику
}
