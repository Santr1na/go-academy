package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
	"os"
	"strings"
)

// childEnv убирает из окружения запускаемых программ секреты сервера.
func childEnv(env []string) []string {
	out := env[:0:0]
	for _, e := range env {
		if strings.HasPrefix(e, "ACADEMY_") || strings.HasPrefix(e, "RENDER_API") {
			continue
		}
		out = append(out, e)
	}
	return out
}

// requirePassword закрывает весь сайт паролем (HTTP Basic Auth). Имя
// пользователя может быть любым — проверяется только пароль. /healthz
// остаётся открытым для проверки состояния хостингом.
func requirePassword(password string, next http.Handler) http.Handler {
	want := sha256.Sum256([]byte(password))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Write([]byte("ok"))
			return
		}
		_, pass, ok := r.BasicAuth()
		got := sha256.Sum256([]byte(pass))
		if !ok || subtle.ConstantTimeCompare(got[:], want[:]) != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="Academy", charset="UTF-8"`)
			http.Error(w, "Нужен пароль", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
