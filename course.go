package main

import (
	"bufio"
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Course — весь курс: модули → уроки → тест + задачи.
type Course struct {
	Modules []*Module `json:"modules"`

	lessons map[string]*Lesson
	tasks   map[string]*Task
}

type Module struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Icon        string    `json:"icon,omitempty"`
	Optional    bool      `json:"optional,omitempty"` // модуль можно пропустить: следующий открыт сразу
	Lessons     []*Lesson `json:"lessons"`
}

type Lesson struct {
	ID       string          `json:"id"`
	ModuleID string          `json:"moduleId"`
	Title    string          `json:"title"`
	Summary  string          `json:"summary,omitempty"`
	XP       int             `json:"xp"`
	Theory   string          `json:"theory"`
	Quiz     []*QuizQuestion `json:"quiz"`
	Tasks    []*Task         `json:"tasks"`
	Cards    []*Card         `json:"cards"`
	Lang     string          `json:"lang"` // язык задач урока: go | java | sql | git
	Setup    string          `json:"-"`    // имя общего набора данных (для SQL): _setup/<имя>.sql
	File     string          `json:"-"`
}

// Card — вопрос с собеседования: ученик отвечает своими словами, затем
// сравнивает ответ с эталонным и сам оценивает, насколько знал.
type Card struct {
	ID       string `json:"id"` // глобальный: lessonID:cardID
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type QuizQuestion struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Answer   int      `json:"answer"`
	Explain  string   `json:"explain"`
}

type Task struct {
	ID          string   `json:"id"` // глобальный: lessonID:taskID
	LessonID    string   `json:"lessonId"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	XP          int      `json:"xp"`
	Interview   bool     `json:"interview"`
	Lang        string   `json:"lang"`
	Hints       []string `json:"hints"`
	Starter     string   `json:"starter"`
	Solution    string   `json:"-"`
	Test        string   `json:"-"`
	// Broken — заготовка намеренно не компилируется: задача «найди и исправь ошибки».
	Broken bool `json:"-"`
}

type CourseStats struct {
	Modules, Lessons, Tasks, Questions, InterviewTasks, Cards int
}

func (c *Course) Stats() CourseStats {
	var s CourseStats
	s.Modules = len(c.Modules)
	for _, m := range c.Modules {
		s.Lessons += len(m.Lessons)
		for _, l := range m.Lessons {
			s.Tasks += len(l.Tasks)
			s.Questions += len(l.Quiz)
			s.Cards += len(l.Cards)
			for _, t := range l.Tasks {
				if t.Interview {
					s.InterviewTasks++
				}
			}
		}
	}
	return s
}

// EstimateMinutes — примерное время на урок для человека, который видит тему
// впервые: чтение теории с разбором примеров, тест и задачи (чем больше XP у
// задачи, тем она сложнее). Опытному разработчику хватит примерно половины,
// новичку в программировании может понадобиться в полтора-два раза больше.
func (l *Lesson) EstimateMinutes() int {
	m := (len(strings.Fields(l.Theory))+89)/90 + 2*len(l.Quiz) + 3*len(l.Cards)
	for _, t := range l.Tasks {
		switch {
		case t.XP <= 30:
			m += 15
		case t.XP <= 40:
			m += 25
		case t.XP <= 50:
			m += 40
		case t.XP <= 60:
			m += 60
		default:
			m += 90
		}
	}
	return (m + 4) / 5 * 5 // округляем вверх до 5 минут
}

func (c *Course) Lesson(id string) *Lesson { return c.lessons[id] }
func (c *Course) Task(id string) *Task     { return c.tasks[id] }

// AllTasks возвращает задачи в порядке курса.
func (c *Course) AllTasks() []*Task {
	var out []*Task
	for _, m := range c.Modules {
		for _, l := range m.Lessons {
			out = append(out, l.Tasks...)
		}
	}
	return out
}

// LoadCourse читает каталог с контентом:
//
//	NN-module/module.md      — front-matter модуля (id, title, description, icon)
//	NN-module/NN-lesson.md   — урок (см. README: формат урока)
func LoadCourse(fsys fs.FS) (*Course, error) {
	c := &Course{lessons: map[string]*Lesson{}, tasks: map[string]*Task{}}
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), "_") {
			continue
		}
		m, err := loadModule(fsys, e.Name())
		if err != nil {
			return nil, err
		}
		for _, l := range m.Lessons {
			if _, dup := c.lessons[l.ID]; dup {
				return nil, fmt.Errorf("%s: повторяющийся id урока %q", l.File, l.ID)
			}
			c.lessons[l.ID] = l
			for _, t := range l.Tasks {
				if _, dup := c.tasks[t.ID]; dup {
					return nil, fmt.Errorf("%s: повторяющийся id задачи %q", l.File, t.ID)
				}
				c.tasks[t.ID] = t
			}
		}
		c.Modules = append(c.Modules, m)
	}
	if len(c.Modules) == 0 {
		return nil, fmt.Errorf("в каталоге контента нет модулей")
	}
	return c, nil
}

func loadModule(fsys fs.FS, dir string) (*Module, error) {
	raw, err := fs.ReadFile(fsys, path.Join(dir, "module.md"))
	if err != nil {
		return nil, fmt.Errorf("модуль %s: %w", dir, err)
	}
	meta, body := splitFrontMatter(string(raw))
	m := &Module{ID: meta["id"], Title: meta["title"], Icon: meta["icon"], Description: strings.TrimSpace(meta["description"]),
		Optional: meta["optional"] == "true"}
	if m.Description == "" {
		m.Description = strings.TrimSpace(body)
	}
	if m.ID == "" || m.Title == "" {
		return nil, fmt.Errorf("модуль %s: нужны поля id и title", dir)
	}
	files, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Name() < files[j].Name() })
	for _, f := range files {
		name := f.Name()
		if f.IsDir() || name == "module.md" || !strings.HasSuffix(name, ".md") {
			continue
		}
		p := path.Join(dir, name)
		data, err := fs.ReadFile(fsys, p)
		if err != nil {
			return nil, err
		}
		l, err := ParseLesson(string(data))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", p, err)
		}
		l.File = p
		l.ModuleID = m.ID
		m.Lessons = append(m.Lessons, l)
	}
	return m, nil
}

func splitFrontMatter(s string) (map[string]string, string) {
	meta := map[string]string{}
	s = strings.TrimPrefix(s, "\uFEFF")
	if !strings.HasPrefix(s, "---\n") {
		return meta, s
	}
	rest := s[4:]
	end := strings.Index(rest, "\n---\n")
	if end < 0 {
		return meta, s
	}
	for _, line := range strings.Split(rest[:end], "\n") {
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		v = strings.TrimSpace(v)
		if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' {
			v = v[1 : len(v)-1]
		}
		meta[strings.TrimSpace(k)] = v
	}
	return meta, rest[end+5:]
}

var (
	optionRe = regexp.MustCompile(`^- \[( |x|X)\] (.*)$`)
)

// ParseLesson разбирает файл урока. Формат:
//
//	---
//	id: lesson-id
//	title: Заголовок
//	xp: 20
//	---
//	Теория в Markdown...
//	@@ quiz
//	@@ q
//	Вопрос (Markdown, можно с кодом)
//	- [ ] неверный вариант
//	- [x] верный вариант
//	@@ explain
//	Объяснение
//	@@ task task-id | Название задачи | xp=40 interview
//	Описание задачи (Markdown). Флаг broken — заготовка намеренно не компилируется.
//	@@ hint
//	Подсказка 1
//	@@ starter
//	код-заготовка
//	@@ solution
//	эталонное решение
//	@@ test
//	скрытые тесты (package main)
func ParseLesson(src string) (*Lesson, error) {
	src = strings.ReplaceAll(src, "\r\n", "\n")
	meta, body := splitFrontMatter(src)
	l := &Lesson{ID: meta["id"], Title: meta["title"], Summary: meta["summary"], XP: 20, Lang: meta["lang"], Setup: meta["setup"]}
	if l.ID == "" || l.Title == "" {
		return nil, fmt.Errorf("нужны поля id и title во front-matter")
	}
	if v := meta["xp"]; v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return nil, fmt.Errorf("xp: %w", err)
		}
		l.XP = n
	}

	var (
		section = "theory" // theory | quiz | q | explain | task | hint | starter | solution | test
		buf     []string
		curQ    *QuizQuestion
		curT    *Task
		curC    *Card
		lineNo  int
	)
	flush := func() error {
		text := strings.Join(buf, "\n")
		buf = buf[:0]
		switch section {
		case "theory":
			l.Theory = strings.TrimSpace(text)
		case "q":
			q, err := parseQuestion(text)
			if err != nil {
				return err
			}
			*curQ = *q
		case "explain":
			curQ.Explain = strings.TrimSpace(text)
		case "card":
			curC.Question = strings.TrimSpace(text)
		case "answer":
			curC.Answer = strings.TrimSpace(text)
		case "task":
			curT.Description = strings.TrimSpace(text)
		case "hint":
			curT.Hints = append(curT.Hints, strings.TrimSpace(text))
		case "starter":
			curT.Starter = strings.TrimSpace(text) + "\n"
		case "solution":
			curT.Solution = strings.TrimSpace(text) + "\n"
		case "test":
			curT.Test = strings.TrimSpace(text) + "\n"
		}
		return nil
	}

	sc := bufio.NewScanner(strings.NewReader(body))
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	for sc.Scan() {
		lineNo++
		line := sc.Text()
		if !strings.HasPrefix(line, "@@ ") && line != "@@" {
			buf = append(buf, line)
			continue
		}
		if err := flush(); err != nil {
			return nil, fmt.Errorf("строка ~%d: %w", lineNo, err)
		}
		directive := strings.TrimSpace(strings.TrimPrefix(line, "@@"))
		word, rest, _ := strings.Cut(directive, " ")
		switch word {
		case "quiz":
			section = "quiz"
		case "q":
			curQ = &QuizQuestion{}
			l.Quiz = append(l.Quiz, curQ)
			section = "q"
		case "explain":
			if curQ == nil {
				return nil, fmt.Errorf("строка %d: @@ explain без вопроса", lineNo)
			}
			section = "explain"
		case "task":
			t, err := parseTaskHeader(rest)
			if err != nil {
				return nil, fmt.Errorf("строка %d: %w", lineNo, err)
			}
			t.LessonID = l.ID
			t.ID = l.ID + ":" + t.ID
			curT = t
			l.Tasks = append(l.Tasks, t)
			section = "task"
		case "card":
			id := strings.TrimSpace(rest)
			if id == "" || strings.ContainsAny(id, " :/") {
				return nil, fmt.Errorf("строка %d: @@ card требует id без пробелов", lineNo)
			}
			curC = &Card{ID: l.ID + ":" + id}
			l.Cards = append(l.Cards, curC)
			section = "card"
		case "answer":
			if curC == nil {
				return nil, fmt.Errorf("строка %d: @@ answer без карточки", lineNo)
			}
			section = "answer"
		case "hint", "starter", "solution", "test":
			if curT == nil {
				return nil, fmt.Errorf("строка %d: @@ %s без задачи", lineNo, word)
			}
			section = word
		default:
			return nil, fmt.Errorf("строка %d: неизвестная директива %q", lineNo, word)
		}
	}
	if err := sc.Err(); err != nil {
		return nil, err
	}
	if err := flush(); err != nil {
		return nil, err
	}
	for i, q := range l.Quiz {
		if len(q.Options) < 2 {
			return nil, fmt.Errorf("вопрос %d: меньше двух вариантов", i+1)
		}
	}
	for _, t := range l.Tasks {
		if t.Starter == "" || t.Solution == "" || t.Test == "" {
			return nil, fmt.Errorf("задача %s: нужны starter, solution и test", t.ID)
		}
	}
	seen := map[string]bool{}
	for _, c := range l.Cards {
		if c.Question == "" || c.Answer == "" {
			return nil, fmt.Errorf("карточка %s: нужны вопрос и @@ answer", c.ID)
		}
		if seen[c.ID] {
			return nil, fmt.Errorf("повторяющийся id карточки %s", c.ID)
		}
		seen[c.ID] = true
	}
	if l.Cards == nil {
		l.Cards = []*Card{}
	}
	if l.Tasks == nil {
		l.Tasks = []*Task{}
	}
	if l.Quiz == nil {
		l.Quiz = []*QuizQuestion{}
	}
	return l, nil
}

func parseTaskHeader(s string) (*Task, error) {
	parts := strings.Split(s, "|")
	if len(parts) < 2 {
		return nil, fmt.Errorf("формат: @@ task id | Название | xp=40 interview broken")
	}
	t := &Task{ID: strings.TrimSpace(parts[0]), Title: strings.TrimSpace(parts[1]), XP: 40, Hints: []string{}}
	if t.ID == "" || strings.ContainsAny(t.ID, " :/") {
		return nil, fmt.Errorf("некорректный id задачи %q", t.ID)
	}
	if len(parts) > 2 {
		for _, f := range strings.Fields(parts[2]) {
			switch {
			case f == "interview":
				t.Interview = true
			case f == "broken":
				t.Broken = true
			case strings.HasPrefix(f, "xp="):
				n, err := strconv.Atoi(strings.TrimPrefix(f, "xp="))
				if err != nil {
					return nil, fmt.Errorf("xp: %w", err)
				}
				t.XP = n
			default:
				return nil, fmt.Errorf("неизвестный флаг задачи %q", f)
			}
		}
	}
	return t, nil
}

// parseQuestion отделяет варианты ответа ("- [ ]" / "- [x]") от текста вопроса.
// Строки внутри блоков кода ``` не считаются вариантами.
func parseQuestion(text string) (*QuizQuestion, error) {
	q := &QuizQuestion{Answer: -1}
	var qtext []string
	inCode := false
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			inCode = !inCode
		}
		if !inCode {
			if m := optionRe.FindStringSubmatch(line); m != nil {
				if m[1] != " " {
					if q.Answer >= 0 {
						return nil, fmt.Errorf("в вопросе больше одного верного ответа")
					}
					q.Answer = len(q.Options)
				}
				q.Options = append(q.Options, m[2])
				continue
			}
		}
		qtext = append(qtext, line)
	}
	if q.Answer < 0 {
		return nil, fmt.Errorf("в вопросе нет верного ответа ([x])")
	}
	q.Question = strings.TrimSpace(strings.Join(qtext, "\n"))
	return q, nil
}
