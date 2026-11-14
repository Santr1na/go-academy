package main

import (
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"os"
)

const maxBody = 512 * 1024

type Server struct {
	mu       sync.RWMutex
	catalog  *Catalog
	content  fs.FS
	tracks   fs.FS
	dev      bool
	runner   *Runner
	progress *ProgressStore
}

func (s *Server) Routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/course", s.handleCourse)
	mux.HandleFunc("GET /api/lessons/{id}", s.handleLesson)
	mux.HandleFunc("GET /api/tasks/{id}/solution", s.handleSolution)
	mux.HandleFunc("GET /api/tracks/{id}/cards", s.handleCards)
	mux.HandleFunc("POST /api/run", s.handleRun)
	mux.HandleFunc("POST /api/check", s.handleCheck)
	mux.HandleFunc("GET /api/progress", s.handleGetProgress)
	mux.HandleFunc("POST /api/progress", s.handleSaveProgress)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "go": s.runner.GoVersion, "java": s.runner.Tools.JavaVersion,
			"tools":        map[string]bool{"java": s.runner.Tools.Javac != "" && s.runner.Tools.Java != "", "sql": s.runner.Tools.Python != "", "git": s.runner.Tools.Git != "" && s.runner.Tools.Bash != ""},
			"progressFile": s.progress.Path()})
	})
}

// guard защищает API от запросов с чужих сайтов (CSRF) и от DNS-rebinding:
// сервер исполняет произвольный код, поэтому принимаем только локальные Host/Origin.
func (s *Server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			if !isAllowedHost(r.Host) {
				http.Error(w, "forbidden host", http.StatusForbidden)
				return
			}
			if o := r.Header.Get("Origin"); o != "" {
				u, err := url.Parse(o)
				if err != nil || u.Host != r.Host {
					http.Error(w, "forbidden origin", http.StatusForbidden)
					return
				}
			}
			if r.Method == http.MethodPost && !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				http.Error(w, "Content-Type должен быть application/json", http.StatusUnsupportedMediaType)
				return
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

func isLocalHost(hostport string) bool {
	host, _, err := net.SplitHostPort(hostport)
	if err != nil {
		host = hostport
	}
	host = strings.Trim(host, "[]")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func isAllowedHost(hostport string) bool {
    if isLocalHost(hostport) {
        return true
    }

    host, _, err := net.SplitHostPort(hostport)
    if err != nil {
        host = hostport
    }

    host = strings.ToLower(strings.Trim(host, "[]"))

    allowedHosts := os.Getenv("ALLOWED_HOSTS")

    for _, allowed := range strings.Split(allowedHosts, ",") {
        allowed = strings.ToLower(strings.TrimSpace(allowed))

        if allowed != "" && host == allowed {
            return true
        }
    }

    return false
}

func (s *Server) getCourse() (*Catalog, error) {
	if s.dev {
		c, err := LoadCatalog(s.content, s.tracks)
		if err != nil {
			return nil, err
		}
		s.mu.Lock()
		s.catalog = c
		s.mu.Unlock()
		return c, nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.catalog, nil
}

type lessonSummary struct {
	ID        string        `json:"id"`
	Title     string        `json:"title"`
	Summary   string        `json:"summary,omitempty"`
	XP        int           `json:"xp"`
	Minutes   int           `json:"minutes"`
	QuizCount int           `json:"quizCount"`
	CardCount int           `json:"cardCount"`
	Tasks     []taskSummary `json:"tasks"`
}

type taskSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	XP        int    `json:"xp"`
	Interview bool   `json:"interview"`
}

type moduleSummary struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	Description string          `json:"description"`
	Icon        string          `json:"icon,omitempty"`
	Optional    bool            `json:"optional,omitempty"`
	Lessons     []lessonSummary `json:"lessons"`
}

func (s *Server) handleCourse(w http.ResponseWriter, r *http.Request) {
	c, err := s.getCourse()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	type trackSummary struct {
		*Track
		Modules []moduleSummary `json:"modules"`
		Stats   CourseStats     `json:"stats"`
	}
	tracks := make([]trackSummary, 0, len(c.Tracks))
	for _, t := range c.Tracks {
		ts := trackSummary{Track: t, Stats: t.Course.Stats(), Modules: []moduleSummary{}}
		for _, m := range t.Course.Modules {
			ms := moduleSummary{ID: m.ID, Title: m.Title, Description: m.Description, Icon: m.Icon, Optional: m.Optional}
			for _, l := range m.Lessons {
				ls := lessonSummary{ID: l.ID, Title: l.Title, Summary: l.Summary, XP: l.XP, Minutes: l.EstimateMinutes(), QuizCount: len(l.Quiz), CardCount: len(l.Cards), Tasks: []taskSummary{}}
				for _, t := range l.Tasks {
					ls.Tasks = append(ls.Tasks, taskSummary{ID: t.ID, Title: t.Title, XP: t.XP, Interview: t.Interview})
				}
				ms.Lessons = append(ms.Lessons, ls)
			}
			ts.Modules = append(ts.Modules, ms)
		}
		tracks = append(tracks, ts)
	}
	writeJSON(w, http.StatusOK, map[string]any{"tracks": tracks})
}

// handleCards отдаёт все карточки курса — для режима тренировки.
func (s *Server) handleCards(w http.ResponseWriter, r *http.Request) {
	c, err := s.getCourse()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	t := c.Track(r.PathValue("id"))
	if t == nil {
		writeError(w, http.StatusNotFound, "курс не найден")
		return
	}
	type item struct {
		*Card
		LessonID string `json:"lessonId"`
		Topic    string `json:"topic"`
	}
	out := []item{}
	for _, m := range t.Course.Modules {
		for _, l := range m.Lessons {
			for _, cd := range l.Cards {
				out = append(out, item{Card: cd, LessonID: l.ID, Topic: l.Title})
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"cards": out})
}

func (s *Server) handleLesson(w http.ResponseWriter, r *http.Request) {
	c, err := s.getCourse()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	l := c.Lesson(r.PathValue("id"))
	if l == nil {
		writeError(w, http.StatusNotFound, "урок не найден")
		return
	}
	writeJSON(w, http.StatusOK, l)
}

func (s *Server) handleSolution(w http.ResponseWriter, r *http.Request) {
	c, err := s.getCourse()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	t := c.Task(r.PathValue("id"))
	if t == nil {
		writeError(w, http.StatusNotFound, "задача не найдена")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"id": t.ID, "solution": t.Solution})
}

type runRequest struct {
	TaskID string `json:"taskId"`
	Code   string `json:"code"`
}

func (s *Server) readRun(w http.ResponseWriter, r *http.Request) (*runRequest, bool) {
	var req runRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "некорректный JSON: "+err.Error())
		return nil, false
	}
	if strings.TrimSpace(req.Code) == "" {
		writeError(w, http.StatusBadRequest, "пустой код")
		return nil, false
	}
	return &req, true
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	req, ok := s.readRun(w, r)
	if !ok {
		return
	}
	var t *Task
	if c, err := s.getCourse(); err == nil {
		t = c.Task(req.TaskID) // может отсутствовать: тогда это просто запуск Go-программы
	}
	writeJSON(w, http.StatusOK, s.runner.RunTask(r.Context(), t, req.Code, false))
}

func (s *Server) handleCheck(w http.ResponseWriter, r *http.Request) {
	req, ok := s.readRun(w, r)
	if !ok {
		return
	}
	c, err := s.getCourse()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	t := c.Task(req.TaskID)
	if t == nil {
		writeError(w, http.StatusNotFound, "задача не найдена")
		return
	}
	writeJSON(w, http.StatusOK, s.runner.RunTask(r.Context(), t, req.Code, true))
}

// progressEnvelope — ответ GET /api/progress и тело ответа 409.
type progressEnvelope struct {
	Error    string          `json:"error,omitempty"`
	Rev      string          `json:"rev"`
	Progress json.RawMessage `json:"progress"`
}

func (s *Server) handleGetProgress(w http.ResponseWriter, r *http.Request) {
	data, rev, err := s.progress.Load()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, progressEnvelope{Rev: rev, Progress: data})
}

// handleSaveProgress: POST /api/progress?base=<ревизия>[&snapshot=1].
// Запись принимается, только если base совпадает с текущей ревизией файла;
// иначе 409 с актуальными данными — клиент объединяет их со своими и повторяет.
func (s *Server) handleSaveProgress(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 8<<20))
	if err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, err.Error())
		return
	}
	if !isJSONObject(body) {
		writeError(w, http.StatusBadRequest, "прогресс должен быть JSON-объектом")
		return
	}
	q := r.URL.Query()
	base := q.Get("base")
	if base == "" {
		base = "0"
	}
	rev, cur, err := s.progress.Save(body, base, q.Get("snapshot") == "1")
	switch {
	case errors.Is(err, ErrConflict):
		writeJSON(w, http.StatusConflict, progressEnvelope{Error: "conflict", Rev: rev, Progress: cur})
	case err != nil:
		log.Printf("сохранение прогресса: %v", err)
		writeError(w, http.StatusInternalServerError, err.Error())
	default:
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "rev": rev, "savedAt": time.Now().UnixMilli()})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
