package main

import (
	"context"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestCompactTrace(t *testing.T) {
	in := strings.Join([]string{
		"=== RUN   TestSwap",
		"--- FAIL: TestSwap (0.00s)",
		"panic: runtime error: index out of range [2] with length 2 [recovered, repanicked]",
		"",
		"goroutine 7 [running]:",
		"testing.tRunner.func1.2({0x6ca080, 0x1804cad68198})",
		"\t/home/u/go/src/testing/testing.go:2123 +0x232",
		"panic({0x6ca080?, 0x1804cad68198?})",
		"\t/home/u/go/src/runtime/panic.go:859 +0x125",
		"sandbox.Swap(...)",
		"\tmain.go:7",
		"sandbox.TestSwap(0x1804cae8c248?)",
		"\tchecker_test.go:8 +0x65",
		"testing.tRunner(0x1804cae8c248, 0x6d57c0)",
		"\t/home/u/go/src/testing/testing.go:2193 +0xea",
		"created by testing.(*T).Run in goroutine 1",
		"\t/home/u/go/src/testing/testing.go:2258 +0x4d4",
		"",
		"goroutine 1 [chan receive]:",
		"testing.(*T).Run(0x91285dc008, {0x554bca?, 0x9128552aa0?}, 0x6d57a0)",
		"\t/home/u/go/src/testing/testing.go:2266 +0x4f2",
		"main.main()",
		"\t_testmain.go:46 +0x9b",
		"",
	}, "\n")
	want := strings.Join([]string{
		"=== RUN   TestSwap",
		"--- FAIL: TestSwap (0.00s)",
		"panic: runtime error: index out of range [2] with length 2 [recovered, repanicked]",
		"",
		"goroutine 7 [running]:",
		"sandbox.Swap(...)",
		"\tmain.go:7",
		"sandbox.TestSwap(...)",
		"\tchecker_test.go:8",
		"",
	}, "\n")
	if got := compactTrace(in); got != want {
		t.Errorf("compactTrace:\n%s\n--- ожидалось:\n%s", got, want)
	}
	for _, plain := range []string{"", "Привет\n", "panic: без дампа\n"} {
		if got := compactTrace(plain); got != plain {
			t.Errorf("текст без дампа горутин не должен меняться: %q → %q", plain, got)
		}
	}
}

func newTestRunner(t *testing.T) *Runner {
	t.Helper()
	r, err := NewRunner(20*time.Second, 2)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

const swapTest = "package main\n\nimport \"testing\"\n\nfunc TestSwap(t *testing.T) {\n\tif a, b := Swap(1, 2); a != 2 || b != 1 {\n\t\tt.Errorf(\"Swap(1, 2) = %d, %d\", a, b)\n\t}\n}\n"

// Паника в коде пользователя: в выводе остаются сообщение и строка main.go,
// без кадров стандартной библиотеки.
func TestRunnerPanicOutput(t *testing.T) {
	if testing.Short() {
		t.Skip("пропущено в -short режиме")
	}
	r := newTestRunner(t)
	code := "package main\n\nfunc Swap(a, b int) (int, int) {\n\ts := []int{a, b}\n\ti := 2\n\treturn s[i], s[0]\n}\n\nfunc main() {}\n"
	res := r.Check(context.Background(), code, swapTest)
	if res.Passed || res.TestsFail != 1 {
		t.Fatalf("ожидался провал теста: %+v", res)
	}
	if !strings.Contains(res.Stdout, "index out of range [2] with length 2") || !strings.Contains(res.Stdout, "main.go:6") {
		t.Errorf("в выводе нет сообщения паники или строки пользователя:\n%s", res.Stdout)
	}
	if strings.Contains(res.Stdout, "testing.go") || strings.Contains(res.Stdout, "+0x") {
		t.Errorf("в выводе остались служебные кадры:\n%s", res.Stdout)
	}
}

// Бесконечный цикл в тестах: понятный таймаут с указанием места, а не «тесты не пройдены».
func TestRunnerTestTimeout(t *testing.T) {
	if testing.Short() {
		t.Skip("пропущено в -short режиме")
	}
	r := newTestRunner(t)
	r.Timeout = 4 * time.Second
	code := "package main\n\nfunc Swap(a, b int) (int, int) {\n\tfor {\n\t}\n}\n\nfunc main() {}\n"
	res := r.Check(context.Background(), code, swapTest)
	if res.Passed || !res.TimedOut {
		t.Fatalf("ожидался таймаут: %+v", res)
	}
	if !strings.Contains(res.Stdout, "test timed out") || !strings.Contains(res.Stdout, "main.go:") {
		t.Errorf("в выводе нет причины и места зависания:\n%s", res.Stdout)
	}
	if strings.Contains(res.Stdout, "startAlarm") {
		t.Errorf("в выводе остались служебные горутины:\n%s", res.Stdout)
	}
}

// Программа, бесконтрольно занимающая память, останавливается задолго до таймаута.
func TestRunnerMemoryLimit(t *testing.T) {
	if testing.Short() || runtime.GOOS != "linux" {
		t.Skip("только Linux, не в -short режиме")
	}
	r := newTestRunner(t)
	r.MemLimit = 64 << 20
	code := "package main\n\nfunc main() {\n\tvar s [][]byte\n\tfor {\n\t\tb := make([]byte, 1<<20)\n\t\tfor i := range b {\n\t\t\tb[i] = 1\n\t\t}\n\t\ts = append(s, b)\n\t}\n}\n"
	start := time.Now()
	res := r.Run(context.Background(), code)
	if !res.MemExceeded || res.OK || res.TimedOut {
		t.Fatalf("ожидалась остановка по памяти: %+v", res)
	}
	if !strings.Contains(res.Stderr, "МБ памяти") {
		t.Errorf("нет пояснения в выводе: %q", res.Stderr)
	}
	if d := time.Since(start); d > 10*time.Second {
		t.Errorf("остановка заняла слишком долго: %v", d)
	}

	// обычная программа под лимит не попадает
	ok := r.Run(context.Background(), "package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Println(\"ok\") }\n")
	if !ok.OK || ok.MemExceeded || ok.Stdout != "ok\n" {
		t.Errorf("обычная программа: %+v", ok)
	}
}
