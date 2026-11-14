package main

import (
	"fmt"
	"io/fs"
	"path"
	"sort"
	"strings"
)

// Track — отдельный курс (Go, Java, SQL, Git, Spring Boot, вопросы собеседований).
type Track struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Short       string `json:"short"` // короткая подпись для логотипа: Go, Java, SQL…
	Lang        string `json:"lang"`  // язык задач по умолчанию
	Icon        string `json:"icon"`
	Description string `json:"description"`
	Hero        string `json:"hero"` // заголовок на главной курса
	Lead        string `json:"lead"`
	Free        bool   `json:"free"` // все уроки открыты сразу

	Course *Course `json:"-"`
}

// Catalog — все курсы сайта. Идентификаторы уроков и задач уникальны во всём
// каталоге: прогресс хранится по ним.
type Catalog struct {
	Tracks  []*Track
	lessons map[string]*Lesson
	tasks   map[string]*Task
	cards   map[string]*Card
}

func (c *Catalog) Lesson(id string) *Lesson { return c.lessons[id] }
func (c *Catalog) Task(id string) *Task     { return c.tasks[id] }

func (c *Catalog) Track(id string) *Track {
	for _, t := range c.Tracks {
		if t.ID == id {
			return t
		}
	}
	return nil
}

// AllTasks возвращает задачи всех курсов по порядку.
func (c *Catalog) AllTasks() []*Task {
	var out []*Task
	for _, t := range c.Tracks {
		out = append(out, t.Course.AllTasks()...)
	}
	return out
}

func goTrack() *Track {
	return &Track{
		ID: "go", Title: "Go", Short: "Go", Lang: "go", Icon: "🐹",
		Description: "Язык Go с нуля до уровня Senior: синтаксис, срезы и map, интерфейсы, ошибки, конкурентность, generics и задачи с собеседований.",
		Hero:        "Go с нуля до Senior",
		Lead:        "Короткая теория, тест на закрепление и задачи, которые проверяются настоящими Go-тестами прямо на вашем компьютере.",
	}
}

// LoadCatalog читает курс Go (каталог content) и остальные курсы (tracks/<папка>/track.md + модули).
func LoadCatalog(goFS, tracksFS fs.FS) (*Catalog, error) {
	cat := &Catalog{lessons: map[string]*Lesson{}, tasks: map[string]*Task{}, cards: map[string]*Card{}}
	g := goTrack()
	course, err := LoadCourse(goFS)
	if err != nil {
		return nil, fmt.Errorf("курс Go: %w", err)
	}
	g.Course = course
	if err := cat.add(g, nil); err != nil {
		return nil, err
	}
	if tracksFS == nil {
		return cat, nil
	}
	entries, err := fs.ReadDir(tracksFS, ".")
	if err != nil {
		return cat, nil // каталога tracks нет — остаётся только Go
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		sub, err := fs.Sub(tracksFS, e.Name())
		if err != nil {
			return nil, err
		}
		raw, err := fs.ReadFile(sub, "track.md")
		if err != nil {
			return nil, fmt.Errorf("курс %s: нет файла track.md", e.Name())
		}
		meta, body := splitFrontMatter(string(raw))
		t := &Track{ID: meta["id"], Title: meta["title"], Short: meta["short"], Lang: meta["lang"], Icon: meta["icon"],
			Description: meta["description"], Hero: meta["hero"], Lead: meta["lead"], Free: meta["free"] == "true"}
		if t.ID == "" || t.Title == "" {
			return nil, fmt.Errorf("курс %s: в track.md нужны поля id и title", e.Name())
		}
		if t.Description == "" {
			t.Description = strings.TrimSpace(body)
		}
		if t.Short == "" {
			t.Short = t.Title
		}
		if t.Hero == "" {
			t.Hero = t.Title
		}
		if t.Course, err = LoadCourse(sub); err != nil {
			return nil, fmt.Errorf("курс %s: %w", e.Name(), err)
		}
		if err := cat.add(t, sub); err != nil {
			return nil, fmt.Errorf("курс %s: %w", e.Name(), err)
		}
	}
	return cat, nil
}

func (cat *Catalog) add(t *Track, fsys fs.FS) error {
	if cat.Track(t.ID) != nil {
		return fmt.Errorf("повторяющийся id курса %q", t.ID)
	}
	if t.Lang == "" {
		t.Lang = "go"
	}
	setups := map[string]string{}
	for _, m := range t.Course.Modules {
		for _, l := range m.Lessons {
			if cat.lessons[l.ID] != nil {
				return fmt.Errorf("%s: id урока %q уже используется в другом курсе", l.File, l.ID)
			}
			cat.lessons[l.ID] = l
			if l.Lang == "" {
				l.Lang = t.Lang
			}
			switch l.Lang {
			case "go", "java", "sql", "git":
			default:
				return fmt.Errorf("%s: неизвестный язык %q", l.File, l.Lang)
			}
			setup := ""
			if l.Setup != "" {
				s, ok := setups[l.Setup]
				if !ok {
					b, err := fs.ReadFile(fsys, path.Join("_setup", l.Setup+".sql"))
					if err != nil {
						return fmt.Errorf("%s: набор данных %q не найден: %w", l.File, l.Setup, err)
					}
					s = string(b)
					setups[l.Setup] = s
				}
				setup = s
			}
			for _, tk := range l.Tasks {
				if cat.tasks[tk.ID] != nil {
					return fmt.Errorf("%s: id задачи %q уже используется", l.File, tk.ID)
				}
				cat.tasks[tk.ID] = tk
				tk.Lang = l.Lang
				if setup != "" {
					tk.Test = setup + "\n" + tk.Test
				}
			}
			for _, c := range l.Cards {
				if cat.cards[c.ID] != nil {
					return fmt.Errorf("%s: id карточки %q уже используется", l.File, c.ID)
				}
				cat.cards[c.ID] = c
			}
		}
	}
	cat.Tracks = append(cat.Tracks, t)
	return nil
}
