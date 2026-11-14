package main

import (
	"context"
	"io/fs"
	"runtime"
	"strings"
	"testing"
	"time"
)

func loadTestCourse(t *testing.T) *Catalog {
	t.Helper()
	sub, _ := fs.Sub(contentFS, "content")
	tracks, _ := fs.Sub(tracksEmbed, "tracks")
	c, err := LoadCatalog(sub, tracks)
	if err != nil {
		t.Fatalf("LoadCatalog: %v", err)
	}
	return c
}

// TestCourseStructure проверяет целостность контента всех курсов.
func TestCourseStructure(t *testing.T) {
	c := loadTestCourse(t)
	for _, tr := range c.Tracks {
		st := tr.Course.Stats()
		t.Logf("%s: модулей %d, уроков %d, задач %d (собеседование: %d), вопросов %d, карточек %d",
			tr.ID, st.Modules, st.Lessons, st.Tasks, st.InterviewTasks, st.Questions, st.Cards)
		for _, m := range tr.Course.Modules {
			if len(m.Lessons) == 0 {
				t.Errorf("модуль %s пуст", m.ID)
			}
			for _, l := range m.Lessons {
				if len(l.Cards) > 0 {
					if len(l.Cards) < 5 {
						t.Errorf("%s: меньше 5 вопросов собеседования", l.File)
					}
					continue
				}
				if len(l.Quiz) < 2 {
					t.Errorf("%s: в тесте меньше 2 вопросов", l.File)
				}
				if len(l.Tasks) < 1 && tr.ID == "go" {
					t.Errorf("%s: нет практических задач", l.File)
				}
				if strings.TrimSpace(l.Theory) == "" {
					t.Errorf("%s: нет теории", l.File)
				}
				for _, q := range l.Quiz {
					if q.Explain == "" {
						t.Errorf("%s: у вопроса %q нет объяснения", l.File, short(q.Question))
					}
				}
				for _, tk := range l.Tasks {
					if len(tk.Hints) < 2 {
						t.Errorf("%s: у задачи %s меньше двух подсказок", l.File, tk.ID)
					}
					switch tk.Lang {
					case "go":
						if !strings.Contains(tk.Starter, "package main") || !strings.Contains(tk.Solution, "func main()") {
							t.Errorf("%s: задача %s: код должен быть package main с func main", l.File, tk.ID)
						}
					case "java":
						if !strings.Contains(tk.Starter, "class Main") || !strings.Contains(tk.Solution, "public static void main(") {
							t.Errorf("%s: задача %s: нужен класс Main с методом main", l.File, tk.ID)
						}
					}
				}
			}
		}
	}
}

// TestReferenceSolutions запускает каждое эталонное решение против скрытых тестов
// и убеждается, что заготовка (starter) компилируется сама по себе, но тесты НЕ проходит.
// Фильтр по курсу: go test -run 'TestReferenceSolutions/j-' .
func TestReferenceSolutions(t *testing.T) {
	if testing.Short() {
		t.Skip("пропущено в -short режиме")
	}
	c := loadTestCourse(t)
	r, err := NewRunner(120*time.Second, runtime.NumCPU())
	if err != nil {
		t.Fatal(err)
	}
	for _, task := range c.AllTasks() {
		task := task
		t.Run(task.ID, func(t *testing.T) {
			t.Parallel()
			ctx := context.Background()
			res := r.RunTask(ctx, task, task.Solution, true)
			if !res.Passed {
				t.Errorf("эталонное решение не прошло тесты (phase=%s timedOut=%v):\n%s\n%s", res.Phase, res.TimedOut, res.Stdout, res.Stderr)
			}
			if res := r.RunTask(ctx, task, task.Starter, true); res.Passed {
				t.Errorf("заготовка проходит тесты — тесты слишком слабые")
			}
			if task.Lang == "go" || task.Lang == "java" {
				switch res := r.RunTask(ctx, task, task.Starter, false); {
				case task.Broken && res.Phase != "build":
					t.Errorf("задача помечена broken, но заготовка компилируется")
				case !task.Broken && res.Phase == "build":
					t.Errorf("заготовка не компилируется:\n%s", res.Stderr)
				}
			}
			run := r.RunTask(ctx, task, task.Solution, false)
			if !run.OK {
				t.Errorf("эталонное решение не запускается:\n%s\n%s", run.Stdout, run.Stderr)
			}
		})
	}
}

func TestParseLesson(t *testing.T) {
	src := "---\nid: x\ntitle: X\n---\nТеория\n```go\n- [x] не вариант\n```\n@@ quiz\n@@ q\nВопрос?\n```go\nfmt.Println(1)\n```\n- [ ] 0\n- [x] 1\n@@ explain\nПотому что.\n@@ task t1 | Задача | xp=30 interview\nОписание\n@@ hint\nh1\n@@ hint\nh2\n@@ starter\npackage main\n@@ solution\npackage main\n@@ test\npackage main\n"
	l, err := ParseLesson(src)
	if err != nil {
		t.Fatal(err)
	}
	if len(l.Quiz) != 1 || l.Quiz[0].Answer != 1 || len(l.Quiz[0].Options) != 2 || l.Quiz[0].Explain != "Потому что." {
		t.Errorf("quiz parsed wrong: %+v", l.Quiz[0])
	}
	if !strings.Contains(l.Quiz[0].Question, "fmt.Println(1)") {
		t.Errorf("question text lost code: %q", l.Quiz[0].Question)
	}
	if len(l.Tasks) != 1 || l.Tasks[0].ID != "x:t1" || !l.Tasks[0].Interview || l.Tasks[0].XP != 30 || len(l.Tasks[0].Hints) != 2 {
		t.Errorf("task parsed wrong: %+v", l.Tasks[0])
	}
	if !strings.Contains(l.Theory, "- [x] не вариант") {
		t.Errorf("theory lost: %q", l.Theory)
	}
}

func short(s string) string {
	r := []rune(s)
	if len(r) > 40 {
		return string(r[:40]) + "…"
	}
	return s
}
