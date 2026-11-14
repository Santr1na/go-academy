package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNormalizeUserCode(t *testing.T) {
	code := newUserCode()
	if normalizeUserCode(code) != code {
		t.Fatalf("новый код %q не проходит проверку", code)
	}
	if got := normalizeUserCode(" " + strings.ToUpper(formatUserCode(code)) + " "); got != code {
		t.Fatalf("код с дефисами и в верхнем регистре: %q, ожидалось %q", got, code)
	}
	for _, bad := range []string{"", "abc", "../../etc/passwdxx", "abcd-efgh-ijkl-mno1", "abcdefghijklmnopq"} {
		if normalizeUserCode(bad) != "" {
			t.Errorf("некорректный код %q принят", bad)
		}
	}
}

// У каждого посетителя свой прогресс, привязанный к cookie.
func TestPublicModeSeparatesUsers(t *testing.T) {
	s := &Server{users: NewUserStores(t.TempDir())}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/progress", s.handleGetProgress)
	mux.HandleFunc("POST /api/progress", s.handleSaveProgress)
	mux.HandleFunc("POST /api/user", s.handleSetUser)

	do := func(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	cookieOf := func(w *httptest.ResponseRecorder) *http.Cookie {
		for _, c := range w.Result().Cookies() {
			if c.Name == userCookie {
				return c
			}
		}
		t.Fatal("сервер не выдал cookie")
		return nil
	}

	a := cookieOf(do("GET", "/api/progress", "", nil))
	b := cookieOf(do("GET", "/api/progress", "", nil))
	if a.Value == b.Value {
		t.Fatal("двум посетителям выдан один код")
	}
	if w := do("POST", "/api/progress?base=0", `{"xp":5}`, a); w.Code != 200 {
		t.Fatalf("сохранение: %d %s", w.Code, w.Body)
	}
	if body := do("GET", "/api/progress", "", b).Body.String(); strings.Contains(body, `"xp"`) {
		t.Fatalf("второй посетитель видит чужой прогресс: %s", body)
	}
	if body := do("GET", "/api/progress", "", a).Body.String(); !strings.Contains(strings.ReplaceAll(body, " ", ""), `"xp":5`) {
		t.Fatalf("прогресс не сохранился: %s", body)
	}

	// Вход по коду первого посетителя с другого устройства.
	w := do("POST", "/api/user", `{"code":"`+strings.ToUpper(formatUserCode(a.Value))+`"}`, b)
	if w.Code != 200 || cookieOf(w).Value != a.Value {
		t.Fatalf("вход по коду: %d %s", w.Code, w.Body)
	}
	if w := do("POST", "/api/user", `{"code":"../../x"}`, b); w.Code != 400 {
		t.Fatalf("некорректный код принят: %d", w.Code)
	}
	// Подделанная cookie не может указывать за пределы каталога.
	if w := do("GET", "/api/progress", "", &http.Cookie{Name: userCookie, Value: "../../etc"}); cookieOf(w).Value == "../../etc" {
		t.Fatal("принята некорректная cookie")
	}
}
