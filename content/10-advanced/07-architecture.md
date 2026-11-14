---
id: architecture
title: Архитектура Go-сервисов
summary: структура проекта, слои, зависимости через интерфейсы, конфигурация, middleware, логирование slog, graceful shutdown
xp: 45
---
## Структура проекта

Официального шаблона нет, но распространена такая раскладка:

```text
myservice/
├── cmd/myservice/main.go   # точка входа: конфиг, сборка зависимостей, запуск
├── internal/
│   ├── domain/             # сущности и бизнес-правила (без зависимостей от инфраструктуры)
│   ├── service/            # сценарии использования (use cases)
│   ├── storage/postgres/   # реализация репозиториев
│   └── transport/http/     # HTTP-обработчики, middleware
├── migrations/
├── go.mod
└── Makefile
```

Начинайте **просто**: маленькому сервису хватит одного пакета `main`. Дробите на пакеты, когда появляется реальная необходимость. Не копируйте слепо «чистую архитектуру» из Java.

## Слои и зависимости через интерфейсы

Бизнес-логика не должна знать, где хранятся данные. Сервис объявляет **нужный ему** интерфейс (интерфейс — у потребителя!):

```go
// internal/service/users.go
type UserRepo interface {
	Get(ctx context.Context, id int64) (*domain.User, error)
	Save(ctx context.Context, u *domain.User) error
}

type UserService struct {
	repo  UserRepo
	clock func() time.Time
	log   *slog.Logger
}

func NewUserService(repo UserRepo, log *slog.Logger) *UserService {
	return &UserService{repo: repo, clock: time.Now, log: log}
}
```

В `main` собирается граф зависимостей — вручную, без DI-фреймворков («composition root»):

```go
db := mustOpenDB(cfg.DSN)
repo := postgres.NewUserRepo(db)
svc := service.NewUserService(repo, logger)
handler := httptransport.NewHandler(svc)
```

В тестах вместо Postgres подставляется фейковая in-memory реализация.

## Ошибки между слоями

Слой хранения переводит свои ошибки (`sql.ErrNoRows`) в доменные (`domain.ErrNotFound`), а транспортный слой — доменные в HTTP-коды (404). Так детали инфраструктуры не протекают наружу.

## Конфигурация

12-factor: конфигурация из переменных окружения (плюс флаги для локального запуска). Валидируйте её при старте и падайте сразу, если чего-то не хватает.

## Логирование: log/slog

```go
logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
logger.Info("user created", "id", u.ID, "email", u.Email)
logger.With("request_id", rid).Error("db failed", "err", err)
```

Структурированные логи (ключ-значение) легко искать и агрегировать.

## Middleware-цепочки

Сквозная функциональность — логирование, request ID, восстановление после паники, аутентификация, метрики — реализуется middleware:

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}
// Chain(h, A, B) == A(B(h)): запрос проходит A → B → h
```

## Graceful shutdown

```go
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()

go func() { _ = srv.ListenAndServe() }()
<-ctx.Done()                       // получили сигнал

shCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()
_ = srv.Shutdown(shCtx)            // перестать принимать новые, дождаться текущих
workerPool.Stop()                  // остановить фоновые задачи
db.Close()
```

## Наблюдаемость

Метрики (Prometheus), трейсинг (OpenTelemetry), health-check эндпоинты (`/healthz`, `/readyz`), профилирование pprof на отдельном внутреннем порту.

@@ quiz
@@ q
Где по идиомам Go объявляется интерфейс репозитория?
- [ ] В пакете с реализацией (storage)
- [x] В пакете, который его использует (service)
- [ ] В отдельном пакете `interfaces`
@@ explain
«Интерфейсы принадлежат потребителю»: сервис описывает минимально нужный ему набор методов, а реализация удовлетворяет ему неявно.

@@ q
В каком порядке выполнятся middleware при `Chain(h, A, B)` из примера?
- [x] A → B → h
- [ ] B → A → h
- [ ] h → B → A
@@ explain
Chain оборачивает с конца: сначала `B(h)`, затем `A(B(h))`. Запрос сначала попадает во внешний A.

@@ q
Что делает `srv.Shutdown(ctx)`?
- [ ] Мгновенно закрывает все соединения
- [x] Прекращает приём новых соединений и ждёт завершения активных запросов (до отмены ctx)
- [ ] Перезапускает сервер
@@ explain
Это graceful shutdown. Для немедленного закрытия есть `srv.Close()`.

@@ task layered-service | Сервис с внедрением зависимостей | xp=70
Реализуйте слой бизнес-логики, не зависящий от хранилища:

```go
type User struct { ID int; Email string; Name string }

var ErrNotFound = errors.New("not found")
var ErrInvalid  = errors.New("invalid input")
var ErrDuplicate = errors.New("duplicate email")

type UserRepo interface {
	ByEmail(email string) (User, error) // ErrNotFound, если нет
	Create(u User) (User, error)        // присваивает ID
}
```

1. `UserService` с конструктором `NewUserService(repo UserRepo) *UserService` и методом `Register(email, name string) (User, error)`:
   - email приводится к нижнему регистру и обрезаются пробелы; email без `@` или пустое имя → ошибка, оборачивающая `ErrInvalid`;
   - если пользователь с таким email уже есть → ошибка, оборачивающая `ErrDuplicate`;
   - любая другая ошибка репозитория возвращается обёрнутой (`fmt.Errorf("...: %w", err)`).
2. `MemoryRepo` — in-memory реализация `UserRepo` (потокобезопасная, ID начинаются с 1), конструктор `NewMemoryRepo() *MemoryRepo`.
@@ hint
`Register`: нормализуйте email, провалидируйте, вызовите `repo.ByEmail`. `errors.Is(err, ErrNotFound)` — можно создавать; `err == nil` — дубликат; иначе — вернуть обёрнутую ошибку.
@@ hint
`MemoryRepo`: `mu sync.Mutex`, `byEmail map[string]User`, `nextID int`.
@@ starter
package main

import (
	"errors"
	"fmt"
)

type User struct {
	ID    int
	Email string
	Name  string
}

var (
	ErrNotFound  = errors.New("not found")
	ErrInvalid   = errors.New("invalid input")
	ErrDuplicate = errors.New("duplicate email")
)

type UserRepo interface {
	ByEmail(email string) (User, error)
	Create(u User) (User, error)
}

type UserService struct {
	repo UserRepo
}

func NewUserService(repo UserRepo) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) Register(email, name string) (User, error) {
	return s.repo.Create(User{Email: email, Name: name})
}

func main() {
	fmt.Println("реализуйте MemoryRepo и Register")
}
@@ solution
package main

import (
	"errors"
	"fmt"
	"strings"
	"sync"
)

type User struct {
	ID    int
	Email string
	Name  string
}

var (
	ErrNotFound  = errors.New("not found")
	ErrInvalid   = errors.New("invalid input")
	ErrDuplicate = errors.New("duplicate email")
)

type UserRepo interface {
	ByEmail(email string) (User, error)
	Create(u User) (User, error)
}

type UserService struct {
	repo UserRepo
}

func NewUserService(repo UserRepo) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) Register(email, name string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if !strings.Contains(email, "@") || name == "" {
		return User{}, fmt.Errorf("register %q: %w", email, ErrInvalid)
	}
	_, err := s.repo.ByEmail(email)
	switch {
	case err == nil:
		return User{}, fmt.Errorf("register %q: %w", email, ErrDuplicate)
	case !errors.Is(err, ErrNotFound):
		return User{}, fmt.Errorf("register: lookup: %w", err)
	}
	u, err := s.repo.Create(User{Email: email, Name: name})
	if err != nil {
		return User{}, fmt.Errorf("register: create: %w", err)
	}
	return u, nil
}

type MemoryRepo struct {
	mu      sync.Mutex
	byEmail map[string]User
	nextID  int
}

func NewMemoryRepo() *MemoryRepo {
	return &MemoryRepo{byEmail: make(map[string]User), nextID: 1}
}

func (r *MemoryRepo) ByEmail(email string) (User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u, ok := r.byEmail[email]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

func (r *MemoryRepo) Create(u User) (User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.byEmail[u.Email]; ok {
		return User{}, ErrDuplicate
	}
	u.ID = r.nextID
	r.nextID++
	r.byEmail[u.Email] = u
	return u, nil
}

func main() {
	svc := NewUserService(NewMemoryRepo())
	fmt.Println(svc.Register(" Anya@Example.com ", "Аня"))
	fmt.Println(svc.Register("anya@example.com", "Аня 2"))
}
@@ test
package main

import (
	"errors"
	"testing"
)

type brokenRepo struct{}

var errDB = errors.New("db down")

func (brokenRepo) ByEmail(string) (User, error) { return User{}, errDB }
func (brokenRepo) Create(User) (User, error)     { return User{}, errDB }

func TestRegister(t *testing.T) {
	var repo UserRepo = NewMemoryRepo()
	svc := NewUserService(repo)
	u, err := svc.Register("  Anya@Example.COM ", "Аня")
	if err != nil || u.ID != 1 || u.Email != "anya@example.com" || u.Name != "Аня" {
		t.Fatalf("Register = %+v, %v", u, err)
	}
	u2, err := svc.Register("bob@x.ru", "Боб")
	if err != nil || u2.ID != 2 {
		t.Errorf("второй пользователь: %+v, %v", u2, err)
	}
	if _, err := svc.Register("ANYA@example.com", "Другая"); !errors.Is(err, ErrDuplicate) {
		t.Errorf("дубликат: ожидалась ErrDuplicate, получено %v", err)
	}
	for _, c := range [][2]string{{"no-at-sign", "X"}, {"a@b", "  "}, {"", "X"}} {
		if _, err := svc.Register(c[0], c[1]); !errors.Is(err, ErrInvalid) {
			t.Errorf("Register(%q, %q): ожидалась ErrInvalid, получено %v", c[0], c[1], err)
		}
	}
}

func TestRegisterRepoError(t *testing.T) {
	_, err := NewUserService(brokenRepo{}).Register("a@b.c", "A")
	if !errors.Is(err, errDB) || err == errDB {
		t.Errorf("ошибка репозитория должна возвращаться обёрнутой, получено %v", err)
	}
}

@@ task middleware | Цепочка middleware | xp=60 interview
Реализуйте:

```go
type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler // Chain(h, A, B) == A(B(h))
func Recover(next http.Handler) http.Handler              // паника в обработчике → 500 и текст "internal error"
func RequestID(next http.Handler) http.Handler            // см. ниже
```

`RequestID`: если в запросе есть заголовок `X-Request-ID` — использует его, иначе генерирует `"req-1"`, `"req-2"`, … (атомарный счётчик). Значение кладёт в **заголовок ответа** `X-Request-ID` и в контекст запроса, откуда его можно получить функцией `GetRequestID(ctx context.Context) string` (используйте собственный неэкспортируемый тип ключа).
@@ hint
`Chain`: оборачивайте с конца — `for i := len(mws) - 1; i >= 0; i-- { h = mws[i](h) }`.
@@ hint
`Recover`: `defer func() { if rec := recover(); rec != nil { http.Error(w, "internal error", 500) } }()`. Для RequestID: `type ctxKey struct{}`, `ctx := context.WithValue(r.Context(), ctxKey{}, id)`, `next.ServeHTTP(w, r.WithContext(ctx))`.
@@ starter
package main

import (
	"context"
	"fmt"
	"net/http"
)

type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	return h
}

func Recover(next http.Handler) http.Handler {
	return next
}

func RequestID(next http.Handler) http.Handler {
	return next
}

func GetRequestID(ctx context.Context) string {
	return ""
}

func main() {
	fmt.Println("middleware проверяются тестами")
}
@@ solution
package main

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
)

type Middleware func(http.Handler) http.Handler

func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type ctxKey struct{}

var reqCounter atomic.Int64

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = fmt.Sprintf("req-%d", reqCounter.Add(1))
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), ctxKey{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func GetRequestID(ctx context.Context) string {
	id, _ := ctx.Value(ctxKey{}).(string)
	return id
}

func main() {
	fmt.Println("middleware проверяются тестами")
}
@@ test
package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestChainOrder(t *testing.T) {
	var order []string
	mk := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	h := Chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { order = append(order, "h") }), mk("A"), mk("B"), mk("C"))
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if strings.Join(order, ">") != "A>B>C>h" {
		t.Errorf("порядок %v, ожидалось A>B>C>h", order)
	}
}

func TestRecover(t *testing.T) {
	h := Recover(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic("boom") }))
	rec := httptest.NewRecorder()
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("паника вышла за пределы Recover: %v", r)
			}
		}()
		h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	}()
	if rec.Code != 500 || !strings.Contains(rec.Body.String(), "internal error") {
		t.Errorf("ответ %d %q", rec.Code, rec.Body.String())
	}
}

func TestRequestID(t *testing.T) {
	var seen []string
	h := Chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, GetRequestID(r.Context()))
	}), Recover, RequestID)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("X-Request-ID", "abc")
	h.ServeHTTP(rec, req)
	if rec.Header().Get("X-Request-ID") != "abc" || seen[0] != "abc" {
		t.Errorf("переданный ID не использован: header=%q ctx=%q", rec.Header().Get("X-Request-ID"), seen[0])
	}
	rec1, rec2 := httptest.NewRecorder(), httptest.NewRecorder()
	h.ServeHTTP(rec1, httptest.NewRequest("GET", "/", nil))
	h.ServeHTTP(rec2, httptest.NewRequest("GET", "/", nil))
	id1, id2 := rec1.Header().Get("X-Request-ID"), rec2.Header().Get("X-Request-ID")
	if !strings.HasPrefix(id1, "req-") || id1 == id2 || seen[1] != id1 || seen[2] != id2 {
		t.Errorf("сгенерированные ID: %q, %q; в контексте %v", id1, id2, seen)
	}
	if GetRequestID(req.Context()) != "" {
		t.Error("GetRequestID без значения в контексте должен вернуть пустую строку")
	}
}
