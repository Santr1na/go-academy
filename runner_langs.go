package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed runtime
var runtimeFS embed.FS

func runtimeFile(name string) string {
	b, err := runtimeFS.ReadFile("runtime/" + name)
	if err != nil {
		panic(err)
	}
	return string(b)
}

// Tools — внешние программы для курсов не на Go. Пустая строка — не найдена.
type Tools struct {
	Javac, Java, Python, Git, Bash string
	JavaVersion                    string
}

func findTools() Tools {
	look := func(names ...string) string {
		for _, n := range names {
			if p, err := exec.LookPath(n); err == nil {
				return p
			}
		}
		return ""
	}
	t := Tools{Javac: look("javac"), Java: look("java"), Python: look("python3", "python"), Git: look("git"), Bash: look("bash")}
	if jh := os.Getenv("JAVA_HOME"); jh != "" {
		if p := filepath.Join(jh, "bin", "javac"); fileExists(p) {
			t.Javac, t.Java = p, filepath.Join(jh, "bin", "java")
		}
	}
	if t.Java != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if out, err := exec.CommandContext(ctx, t.Java, "-version").CombinedOutput(); err == nil {
			if i := strings.Index(string(out), "\""); i >= 0 {
				rest := string(out)[i+1:]
				if j := strings.Index(rest, "\""); j >= 0 {
					t.JavaVersion = rest[:j]
				}
			}
		}
	}
	return t
}

func fileExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && !st.IsDir()
}

// RunTask запускает (check=false) или проверяет (check=true) код задачи на её языке.
func (r *Runner) RunTask(ctx context.Context, t *Task, code string, check bool) *RunResult {
	lang := "go"
	if t != nil && t.Lang != "" {
		lang = t.Lang
	}
	test := ""
	if check && t != nil {
		test = t.Test
	}
	switch lang {
	case "java":
		if r.Tools.Javac == "" || r.Tools.Java == "" {
			return missingTool("Для задач по Java нужен JDK 17 или новее (команды javac и java). Установите его, например: sudo apt install openjdk-21-jdk — и перезапустите сервер.")
		}
		return r.execJava(ctx, code, test)
	case "sql":
		if r.Tools.Python == "" {
			return missingTool("Для задач по SQL нужен python3 (в нём встроена база SQLite). Установите его и перезапустите сервер.")
		}
		return r.execSQL(ctx, code, t, check)
	case "git":
		if r.Tools.Git == "" || r.Tools.Bash == "" {
			return missingTool("Для задач по Git нужны программы git и bash. Установите их и перезапустите сервер.")
		}
		return r.execGit(ctx, code, t, check)
	}
	return r.exec(ctx, code, test)
}

func missingTool(msg string) *RunResult {
	return &RunResult{Phase: "build", ExitCode: -1, Stderr: msg}
}

// session берёт слот в очереди, создаёт временный каталог и ограничивает время.
func (r *Runner) session(ctx context.Context, fn func(ctx context.Context, cancel context.CancelFunc, dir string, res *RunResult)) *RunResult {
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
	ctx, cancel := context.WithTimeout(ctx, r.Timeout)
	defer cancel()
	fn(ctx, cancel, dir, res)
	return res
}

type cmdResult struct {
	stdout, stderr string
	truncated      bool
	memKilled      bool
	exit           int
	err            error
}

type cmdSpec struct {
	dir    string
	env    []string
	stdin  string
	merge  bool // stderr в тот же поток, что и stdout
	mem    bool // следить за памятью
	cancel context.CancelFunc
}

func (r *Runner) command(ctx context.Context, s cmdSpec, name string, args ...string) cmdResult {
	stdout := &limitedBuffer{max: maxOutput, onFull: s.cancel}
	stderr := &limitedBuffer{max: maxOutput, onFull: s.cancel}
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = s.dir
	cmd.Env = s.env
	if s.stdin != "" {
		cmd.Stdin = strings.NewReader(s.stdin)
	}
	cmd.Stdout = stdout
	if s.merge {
		cmd.Stderr = stdout
	} else {
		cmd.Stderr = stderr
	}
	setupProcess(cmd)
	var memKilled atomic.Bool
	err := cmd.Start()
	if err == nil {
		stop := make(chan struct{})
		if s.mem && r.MemLimit > 0 && s.cancel != nil {
			go watchMemory(cmd.Process.Pid, r.MemLimit, stop, func() {
				memKilled.Store(true)
				s.cancel()
			})
		}
		err = cmd.Wait()
		close(stop)
	}
	out := cmdResult{stdout: stdout.String(), stderr: stderr.String(), truncated: stdout.truncated || stderr.truncated, memKilled: memKilled.Load(), exit: -1, err: err}
	if cmd.ProcessState != nil {
		out.exit = cmd.ProcessState.ExitCode()
	}
	return out
}

func writeFiles(dir string, files map[string]string) error {
	for name, body := range files {
		p := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
			return err
		}
		if err := os.WriteFile(p, []byte(body), 0o600); err != nil {
			return err
		}
	}
	return nil
}

// finish заполняет общие поля результата после запуска программы или тестов.
func (r *Runner) finish(ctx context.Context, res *RunResult, c cmdResult, check bool, what string) {
	res.Truncated = c.truncated
	res.ExitCode = c.exit
	switch {
	case c.memKilled:
		res.MemExceeded = true
		res.Stderr += fmt.Sprintf("\n💾 Программа заняла больше %d МБ памяти и была остановлена. Обычно это бесконечный цикл, в котором растёт список или строка, либо рекурсия без условия выхода.", r.MemLimit>>20)
	case ctx.Err() != nil && !res.Truncated:
		res.TimedOut = true
		res.Stderr += "\n⏱ Превышено время выполнения (" + r.Timeout.String() + "). " + what
	}
	res.OK = c.err == nil
	if check {
		res.TestsPass = strings.Count(res.Stdout, "--- PASS")
		res.TestsFail = strings.Count(res.Stdout, "--- FAIL")
		res.Passed = res.OK && res.TestsFail == 0 && res.TestsPass > 0
	}
}

// ------------------------------------------------------------------ Java

var javacFlags = []string{"-J-XX:TieredStopAtLevel=1", "-J-XX:+UseSerialGC", "-J-Xshare:auto", "-J-Duser.language=en", "-encoding", "UTF-8", "-nowarn", "-Xlint:none", "-d", "out"}

func (r *Runner) execJava(ctx context.Context, code, test string) *RunResult {
	return r.session(ctx, func(ctx context.Context, cancel context.CancelFunc, dir string, res *RunResult) {
		files := map[string]string{"Main.java": code}
		srcs := []string{"Main.java"}
		if test != "" {
			files["Checker.java"] = test
			files["T.java"] = runtimeFile("T.java")
			srcs = append(srcs, "Checker.java", "T.java")
		}
		if err := writeFiles(dir, files); err != nil {
			res.Stderr = err.Error()
			return
		}
		var env []string
		for _, e := range os.Environ() { // иначе JVM печатает «Picked up JAVA_TOOL_OPTIONS»
			if !strings.HasPrefix(e, "JAVA_TOOL_OPTIONS=") && !strings.HasPrefix(e, "_JAVA_OPTIONS=") && !strings.HasPrefix(e, "JDK_JAVA_OPTIONS=") {
				env = append(env, e)
			}
		}
		spec := cmdSpec{dir: dir, env: env, merge: true}
		c := r.command(ctx, spec, r.Tools.Javac, append(append([]string{}, javacFlags...), srcs...)...)
		if c.err != nil {
			res.Stderr = cleanOutput(c.stdout, dir)
			if ctx.Err() != nil {
				res.TimedOut = true
				res.Stderr += "\n⏱ Превышено время компиляции (" + r.Timeout.String() + ")"
				return
			}
			if test != "" {
				// не компилируется сам код ученика или он не стыкуется с тестами?
				own := r.command(ctx, spec, r.Tools.Javac, append(append([]string{}, javacFlags...), "Main.java")...)
				if own.err != nil {
					res.Stderr = cleanOutput(own.stdout, dir)
				} else {
					res.Stderr += "\nВаш код компилируется сам по себе, но не подходит к скрытым тестам.\n" +
						"Проверьте, что имена классов, методов и полей, их параметры и модификаторы точно совпадают с условием задачи."
				}
			}
			if res.Stderr == "" {
				res.Stderr = c.err.Error()
			}
			return
		}
		mainClass := "Main"
		res.Phase = "run"
		if test != "" {
			mainClass = "Checker"
			res.Phase = "test"
		}
		args := []string{"-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC", "-Xshare:auto", "-Xmx256m", "-Dfile.encoding=UTF-8", "-Dstdout.encoding=UTF-8", "-Dstderr.encoding=UTF-8", "-Duser.language=en", "-cp", "out", mainClass}
		c = r.command(ctx, cmdSpec{dir: dir, env: env, merge: test != "", mem: true, cancel: cancel}, r.Tools.Java, args...)
		res.Stdout = cleanOutput(c.stdout, dir)
		res.Stderr = compactJavaTrace(cleanOutput(c.stderr, dir))
		r.finish(ctx, res, c, test != "", "Возможно, бесконечный цикл или потоки, которые ждут друг друга.")
	})
}

// compactJavaTrace убирает из стека исключения кадры стандартной библиотеки:
// ученику важны только строки его Main.java.
func compactJavaTrace(s string) string {
	var out []string
	for _, l := range strings.Split(s, "\n") {
		t := strings.TrimSpace(l)
		if strings.HasPrefix(t, "at ") && !strings.Contains(t, "Main.java") {
			continue
		}
		if strings.HasPrefix(t, "... ") && strings.HasSuffix(t, " more") {
			continue
		}
		out = append(out, l)
	}
	return strings.Join(out, "\n")
}

// ------------------------------------------------------------------ SQL

func (r *Runner) execSQL(ctx context.Context, code string, t *Task, check bool) *RunResult {
	return r.session(ctx, func(ctx context.Context, cancel context.CancelFunc, dir string, res *RunResult) {
		req := map[string]string{"mode": "run", "code": code}
		if t != nil {
			req["setup"] = t.Test
			req["solution"] = t.Solution
		}
		res.Phase = "run"
		if check {
			req["mode"] = "check"
			res.Phase = "test"
		}
		in, _ := json.Marshal(req)
		if err := writeFiles(dir, map[string]string{"sqlrun.py": runtimeFile("sqlrun.py")}); err != nil {
			res.Stderr = err.Error()
			return
		}
		env := append(os.Environ(), "PYTHONIOENCODING=utf-8", "PYTHONDONTWRITEBYTECODE=1")
		c := r.command(ctx, cmdSpec{dir: dir, env: env, stdin: string(in), mem: true, cancel: cancel}, r.Tools.Python, "-I", "sqlrun.py")
		res.Stdout = c.stdout
		res.Stderr = cleanOutput(c.stderr, dir)
		r.finish(ctx, res, c, check, "Возможно, запрос перебирает слишком много строк (соединение таблиц без условия).")
	})
}

// ------------------------------------------------------------------ Git

const gitCheckSep = "#--- check"

func splitGitTest(test string) (setup, check string) {
	if i := strings.Index(test, gitCheckSep); i >= 0 {
		return test[:i], test[i+len(gitCheckSep):]
	}
	return "", test
}

func (r *Runner) execGit(ctx context.Context, code string, t *Task, check bool) *RunResult {
	return r.session(ctx, func(ctx context.Context, cancel context.CancelFunc, dir string, res *RunResult) {
		setup, checkScript := "", ""
		if t != nil {
			setup, checkScript = splitGitTest(t.Test)
		}
		gitconfig := "[user]\n\tname = Student\n\temail = student@example.com\n[init]\n\tdefaultBranch = main\n" +
			"[advice]\n\tdetachedHead = false\n\tskippedCherryPicks = false\n[commit]\n\tgpgsign = false\n[core]\n\teditor = true\n\tautocrlf = false\n" +
			"[protocol \"file\"]\n\tallow = always\n[merge]\n\tff = true\n[pull]\n\trebase = false\n"
		err := writeFiles(dir, map[string]string{
			"gitconfig":   gitconfig,
			"setup.sh":    "set -e\n" + setup + "\n",
			"user.sh":     gitUserScript(code),
			"check.sh":    "source \"$ACADEMY_DIR/gitcheck.sh\"\n" + checkScript + "\n__finish\n",
			"gitcheck.sh": runtimeFile("gitcheck.sh"),
			"state.sh":    "set +e\nif git rev-parse --git-dir >/dev/null 2>&1; then\n  echo; echo '── git status ──'; git status -sb\n  if git rev-parse HEAD >/dev/null 2>&1; then echo '── git log --oneline --graph --all ──'; git log --oneline --graph --all --decorate -n 20; fi\nfi\n",
		})
		if err == nil {
			err = os.MkdirAll(filepath.Join(dir, "repo"), 0o700)
		}
		if err == nil {
			err = os.MkdirAll(filepath.Join(dir, "home"), 0o700)
		}
		if err != nil {
			res.Stderr = err.Error()
			return
		}
		var env []string
		for _, e := range os.Environ() {
			if !strings.HasPrefix(e, "GIT_") && !strings.HasPrefix(e, "LC_") && !strings.HasPrefix(e, "LANG") {
				env = append(env, e)
			}
		}
		env = append(env,
			"HOME="+filepath.Join(dir, "home"), "XDG_CONFIG_HOME="+filepath.Join(dir, "home"),
			"GIT_CONFIG_GLOBAL="+filepath.Join(dir, "gitconfig"), "GIT_CONFIG_NOSYSTEM=1",
			"GIT_TERMINAL_PROMPT=0", "GIT_PAGER=cat", "PAGER=cat", "GIT_EDITOR=true", "EDITOR=true",
			"LC_ALL=C.UTF-8", "LANG=C.UTF-8", "LANGUAGE=en", "TZ=UTC", "ACADEMY_DIR="+dir,
		)
		repo := filepath.Join(dir, "repo")
		bash := func(script string, merge bool) cmdResult {
			return r.command(ctx, cmdSpec{dir: repo, env: env, merge: merge, cancel: cancel}, r.Tools.Bash, "--noprofile", "--norc", filepath.Join(dir, script))
		}
		if c := bash("setup.sh", true); c.err != nil {
			res.Stderr = "Не удалось подготовить репозиторий для задачи (это ошибка курса, а не ваша):\n" + cleanOutput(c.stdout, dir)
			return
		}
		res.Phase = "run"
		if check {
			res.Phase = "test"
		}
		c := bash("user.sh", true)
		out := cleanOutput(c.stdout, dir)
		if ctx.Err() == nil {
			if !check {
				st := r.command(ctx, cmdSpec{dir: repo, env: env, merge: true}, r.Tools.Bash, "--noprofile", "--norc", filepath.Join(dir, "state.sh"))
				out += cleanOutput(st.stdout, dir)
				c.err = nil // в терминале команда с ошибкой не «роняет» сеанс
			} else {
				c = bash("check.sh", true)
				out += "\n" + cleanOutput(c.stdout, dir)
			}
		}
		res.Stdout = out
		r.finish(ctx, res, c, check, "Возможно, команда ждёт ввода с клавиатуры.")
	})
}

// gitUserScript превращает команды ученика в скрипт, который перед каждой
// командой печатает её саму — как в терминале. Для многострочных конструкций
// (heredoc, перенос через \) используется трассировка bash.
func gitUserScript(code string) string {
	code = strings.ReplaceAll(code, "\r\n", "\n")
	lines := strings.Split(code, "\n")
	simple := !strings.Contains(code, "<<")
	for _, l := range lines {
		t := strings.TrimSpace(l)
		if strings.HasSuffix(t, "\\") || strings.HasSuffix(t, "{") || strings.HasSuffix(t, "do") || strings.HasSuffix(t, "then") || t == "}" || t == "done" || t == "fi" || t == "else" {
			simple = false
		}
	}
	if !simple {
		return "PS4='$ '; set -x\n" + code + "\n"
	}
	var b strings.Builder
	for _, l := range lines {
		t := strings.TrimSpace(l)
		if t == "" || strings.HasPrefix(t, "#") {
			continue
		}
		b.WriteString("printf '%s\\n' " + shellQuote("$ "+t) + "\n" + l + "\n")
	}
	return b.String()
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}
