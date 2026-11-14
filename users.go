package main

import (
	"crypto/rand"
	"encoding/base32"
	"errors"
	"hash/fnv"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Открытый режим (ACADEMY_PUBLIC=1): сайтом пользуются без пароля, и у каждого
// посетителя свой прогресс. Посетителя узнаём по коду в cookie; тот же код
// можно ввести на другом устройстве, чтобы продолжить с того же места.

const (
	userCookie  = "academy_uid"
	userCodeLen = 16    // символов base32 = 80 бит случайности
	maxUsers    = 20000 // защита диска от заполнения ботами
)

var userCodeEnc = base32.StdEncoding.WithPadding(base32.NoPadding)

var ErrTooManyUsers = errors.New("на сервере слишком много пользователей")

// UserStores хранит прогресс посетителей в <dir>/users/<код>/progress.json.
type UserStores struct {
	dir   string
	locks [64]sync.Mutex // блокировки по хешу кода: одна запись в файл за раз
	newMu sync.Mutex
}

func NewUserStores(dir string) *UserStores {
	return &UserStores{dir: filepath.Join(dir, "users")}
}

// normalizeUserCode приводит введённый код к виду из 16 символов a–z, 2–7.
// Возвращает "", если код некорректен.
func normalizeUserCode(s string) string {
	s = strings.ToLower(strings.NewReplacer("-", "", " ", "").Replace(strings.TrimSpace(s)))
	if len(s) != userCodeLen {
		return ""
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= '2' && c <= '7') {
			return ""
		}
	}
	return s
}

// formatUserCode делит код на группы по 4 символа: abcd-efgh-ijkl-mnop.
func formatUserCode(code string) string {
	var b strings.Builder
	for i := 0; i < len(code); i += 4 {
		if i > 0 {
			b.WriteByte('-')
		}
		b.WriteString(code[i:min(i+4, len(code))])
	}
	return b.String()
}

func newUserCode() string {
	buf := make([]byte, 10)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return strings.ToLower(userCodeEnc.EncodeToString(buf))
}

func (u *UserStores) lock(code string) *sync.Mutex {
	h := fnv.New32a()
	h.Write([]byte(code))
	return &u.locks[h.Sum32()%uint32(len(u.locks))]
}

func (u *UserStores) store(code string) *ProgressStore {
	return NewProgressStore(filepath.Join(u.dir, code))
}

func (u *UserStores) Load(code string) ([]byte, string, error) {
	m := u.lock(code)
	m.Lock()
	defer m.Unlock()
	return u.store(code).Load()
}

func (u *UserStores) Save(code string, data []byte, base string, snapshot bool) (string, []byte, error) {
	m := u.lock(code)
	m.Lock()
	defer m.Unlock()
	dir := filepath.Join(u.dir, code)
	if _, err := os.Stat(dir); errors.Is(err, os.ErrNotExist) {
		// Новый пользователь: проверяем, что их не слишком много.
		u.newMu.Lock()
		defer u.newMu.Unlock()
		if entries, err := os.ReadDir(u.dir); err == nil && len(entries) >= maxUsers {
			return "", nil, ErrTooManyUsers
		}
	}
	return u.store(code).Save(data, base, snapshot)
}

// userCode возвращает код посетителя из cookie, при необходимости выдавая новый.
// Cookie продлевается при каждом обращении. Вызывается только из обработчиков
// /api/progress и /api/health и /api/user: путь cookie по умолчанию —
// каталог запроса (…/api), поэтому он одинаков и для /api/…, и за прокси с префиксом.
func userCode(w http.ResponseWriter, r *http.Request) string {
	code := ""
	if c, err := r.Cookie(userCookie); err == nil {
		code = normalizeUserCode(c.Value)
	}
	if code == "" {
		code = newUserCode()
	}
	setUserCookie(w, r, code)
	return code
}

func setUserCookie(w http.ResponseWriter, r *http.Request, code string) {
	http.SetCookie(w, &http.Cookie{
		Name:     userCookie,
		Value:    code,
		MaxAge:   400 * 24 * 3600, // максимум, который разрешают браузеры
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	})
}
