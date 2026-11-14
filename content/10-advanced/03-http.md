---
id: http
title: net/http — сервер и клиент
summary: Handler и ServeMux, маршруты Go 1.22, JSON API, middleware, httptest, клиент с таймаутами, graceful shutdown
xp: 45
---
## Минимальный сервер

```go
func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /hello", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "Привет!")
	})
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

Всё в `net/http` строится вокруг интерфейса:

```go
type Handler interface {
	ServeHTTP(ResponseWriter, *Request)
}
```

`http.HandlerFunc` — адаптер, превращающий обычную функцию в `Handler`.

## Маршрутизация (Go 1.22+)

Стандартный `ServeMux` поддерживает методы и параметры пути:

```go
mux.HandleFunc("GET /users/{id}", getUser)
mux.HandleFunc("POST /users", createUser)
mux.HandleFunc("GET /files/{path...}", serveFile) // «хвост» пути
mux.HandleFunc("GET /{$}", index)                // только корень

func getUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	...
}
```

При несовпадении метода mux сам вернёт `405 Method Not Allowed`.

## JSON API

```go
func createUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // лимит 1 МБ
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)            // ДО записи тела
	json.NewEncoder(w).Encode(map[string]string{"name": req.Name})
}
```

> **Ловушка:** заголовки и статус нужно установить **до** первой записи тела. После `Write` вызов `WriteHeader` игнорируется (с предупреждением в логе), а изменения заголовков не применяются.

## Middleware

Функция, оборачивающая `Handler`:

```go
func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}

handler := logging(auth(mux))
```

## Тестирование: httptest

```go
func TestHello(t *testing.T) {
	req := httptest.NewRequest("GET", "/hello", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != 200 { ... }
	body := rec.Body.String()
}

srv := httptest.NewServer(handler) // настоящий сервер на случайном порту
defer srv.Close()
resp, _ := http.Get(srv.URL + "/hello")
```

## Клиент

```go
client := &http.Client{Timeout: 10 * time.Second} // у http.DefaultClient таймаута НЕТ

req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
req.Header.Set("Accept", "application/json")
resp, err := client.Do(req)
if err != nil {
	return err
}
defer resp.Body.Close()                 // ОБЯЗАТЕЛЬНО, иначе утечка соединений
if resp.StatusCode != http.StatusOK {
	return fmt.Errorf("unexpected status %s", resp.Status)
}
```

Ошибка от `client.Do` бывает только при сетевых проблемах — статус 404 или 500 это **не** ошибка, его надо проверять самостоятельно.

## Production-настройки сервера

```go
srv := &http.Server{
	Addr:              ":8080",
	Handler:           handler,
	ReadHeaderTimeout: 5 * time.Second,  // защита от Slowloris
	ReadTimeout:       15 * time.Second,
	WriteTimeout:      15 * time.Second,
	IdleTimeout:       60 * time.Second,
}

go srv.ListenAndServe()
<-ctx.Done()                                    // сигнал SIGINT/SIGTERM
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
srv.Shutdown(shutdownCtx)                       // graceful: дождаться активных запросов
```

Сигналы удобно ловить через `signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)`.

@@ quiz
@@ q
Вернёт ли `client.Do` ошибку, если сервер ответил `500 Internal Server Error`?
- [ ] Да
- [x] Нет — нужно проверять `resp.StatusCode` самому
@@ explain
Ошибка возвращается только при проблемах транспорта (DNS, соединение, таймаут). Любой полученный HTTP-ответ — это успешный обмен.

@@ q
Что будет, если не закрыть `resp.Body`?
- [ ] Ничего, GC закроет
- [x] Соединение не вернётся в пул — утечка соединений и горутин
- [ ] Паника при следующем запросе
@@ explain
Тело нужно дочитать и закрыть, чтобы транспорт мог переиспользовать keep-alive соединение.

@@ q
Какой таймаут у `http.DefaultClient`?
- [ ] 30 секунд
- [ ] 60 секунд
- [x] Никакого — запрос может висеть вечно
@@ explain
Поэтому в продакшене создают свой `http.Client{Timeout: ...}` и/или используют контекст с таймаутом.

@@ task http-handler | JSON API на ServeMux | xp=70
Реализуйте `NewMux() *http.ServeMux` со следующими маршрутами (используйте шаблоны Go 1.22):

1. `GET /hello/{name}` → `200`, JSON `{"message":"Привет, <name>!"}`, заголовок `Content-Type: application/json`.
2. `POST /sum` — тело `{"numbers":[1,2,3]}` → `200`, JSON `{"sum":6}`. Если JSON некорректен или поле `numbers` отсутствует/пустое — `400` с любым текстом.
3. Для `GET /sum` mux должен сам вернуть `405`.

Тесты используют `httptest`.
@@ hint
`mux.HandleFunc("GET /hello/{name}", ...)` и `r.PathValue("name")`.
@@ hint
Для ответа: `w.Header().Set("Content-Type", "application/json"); json.NewEncoder(w).Encode(map[string]any{"sum": s})`. Для проверки «поле отсутствует» объявите `Numbers []int` и проверьте `len(req.Numbers) == 0`.
@@ starter
package main

import (
	"fmt"
	"net/http"
)

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "TODO")
	})
	return mux
}

func main() {
	fmt.Println("в песочнице сервер не запускаем — проверьте задачу кнопкой «Проверить»")
	_ = NewMux()
}
@@ solution
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func NewMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /hello/{name}", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"message": "Привет, " + r.PathValue("name") + "!"})
	})
	mux.HandleFunc("POST /sum", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Numbers []int `json:"numbers"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&req); err != nil || len(req.Numbers) == 0 {
			http.Error(w, "ожидается {\"numbers\": [...]}", http.StatusBadRequest)
			return
		}
		sum := 0
		for _, n := range req.Numbers {
			sum += n
		}
		writeJSON(w, http.StatusOK, map[string]int{"sum": sum})
	})
	return mux
}

func main() {
	fmt.Println("в песочнице сервер не запускаем — проверьте задачу кнопкой «Проверить»")
	_ = NewMux()
}
@@ test
package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func do(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	NewMux().ServeHTTP(rec, req)
	return rec
}

func TestHello(t *testing.T) {
	rec := do(t, "GET", "/hello/Gopher", "")
	if rec.Code != 200 {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type = %q", ct)
	}
	var resp map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp["message"] != "Привет, Gopher!" {
		t.Errorf("тело = %s (%v)", rec.Body.String(), err)
	}
	if rec := do(t, "POST", "/hello/x", ""); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("POST /hello/x: status %d, ожидался 405", rec.Code)
	}
}

func TestSum(t *testing.T) {
	rec := do(t, "POST", "/sum", `{"numbers":[1,2,3,-10]}`)
	var resp map[string]int
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &resp) != nil || resp["sum"] != -4 {
		t.Errorf("POST /sum: %d %s", rec.Code, rec.Body.String())
	}
	for _, bad := range []string{`{"numbers":`, `{}`, `{"numbers":[]}`, `[1,2]`} {
		if rec := do(t, "POST", "/sum", bad); rec.Code != 400 {
			t.Errorf("тело %s: status %d, ожидался 400", bad, rec.Code)
		}
	}
	if rec := do(t, "GET", "/sum", ""); rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET /sum: status %d, ожидался 405", rec.Code)
	}
}

@@ task http-client | Надёжный HTTP-клиент | xp=60 interview
Реализуйте `FetchJSON(ctx context.Context, client *http.Client, url string, out any) error`:

- создаёт запрос с контекстом (`http.NewRequestWithContext`) и заголовком `Accept: application/json`;
- при сетевой ошибке возвращает её (обёрнутой);
- **всегда закрывает** `resp.Body`;
- если статус не 2xx — возвращает ошибку `*StatusError{Code: resp.StatusCode}` (тип объявлен в заготовке; оборачивать можно);
- иначе декодирует JSON в `out`; ошибки декодирования возвращает.

Тест поднимет `httptest.Server` и проверит все ветки, включая отмену контекста.
@@ hint
`req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)`, затем `req.Header.Set("Accept", "application/json")` и `resp, err := client.Do(req)`.
@@ hint
`defer resp.Body.Close()` сразу после проверки ошибки `Do`. Статус: `if resp.StatusCode < 200 || resp.StatusCode > 299 { return &StatusError{Code: resp.StatusCode} }`.
@@ starter
package main

import (
	"context"
	"fmt"
	"net/http"
)

type StatusError struct{ Code int }

func (e *StatusError) Error() string { return fmt.Sprintf("unexpected status %d", e.Code) }

func FetchJSON(ctx context.Context, client *http.Client, url string, out any) error {
	return nil
}

func main() {
	fmt.Println("FetchJSON проверяется тестами с httptest.Server")
}
@@ solution
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type StatusError struct{ Code int }

func (e *StatusError) Error() string { return fmt.Sprintf("unexpected status %d", e.Code) }

func FetchJSON(ctx context.Context, client *http.Client, url string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("get %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return &StatusError{Code: resp.StatusCode}
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	return nil
}

func main() {
	fmt.Println("FetchJSON проверяется тестами с httptest.Server")
}
@@ test
package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/ok", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Accept") != "application/json" {
			http.Error(w, "need Accept", 406)
			return
		}
		w.Write([]byte(`{"name":"gopher","age":15}`))
	})
	mux.HandleFunc("/missing", func(w http.ResponseWriter, r *http.Request) { http.NotFound(w, r) })
	mux.HandleFunc("/bad", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"name":`)) })
	mux.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(3 * time.Second):
		case <-r.Context().Done():
		}
	})
	return httptest.NewServer(mux)
}

func TestFetchJSON(t *testing.T) {
	srv := newServer()
	defer srv.Close()
	client := srv.Client()
	ctx := context.Background()

	var v struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}
	if err := FetchJSON(ctx, client, srv.URL+"/ok", &v); err != nil || v.Name != "gopher" || v.Age != 15 {
		t.Errorf("/ok: %+v, %v", v, err)
	}
	err := FetchJSON(ctx, client, srv.URL+"/missing", &v)
	var se *StatusError
	if !errors.As(err, &se) || se.Code != 404 {
		t.Errorf("/missing: ожидалась *StatusError 404, получено %v", err)
	}
	if err := FetchJSON(ctx, client, srv.URL+"/bad", &v); err == nil {
		t.Error("/bad: ожидалась ошибка декодирования")
	}
	cctx, cancel := context.WithTimeout(ctx, 50*time.Millisecond)
	defer cancel()
	start := time.Now()
	err = FetchJSON(cctx, client, srv.URL+"/slow", &v)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("/slow: ожидалась DeadlineExceeded, получено %v", err)
	}
	if time.Since(start) > time.Second {
		t.Error("контекст не прервал запрос")
	}
	if err := FetchJSON(ctx, client, "http://127.0.0.1:1/nope", &v); err == nil {
		t.Error("сетевая ошибка должна возвращаться")
	}
}
