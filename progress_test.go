package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func mustSave(t *testing.T, p *ProgressStore, data, base string) string {
	t.Helper()
	rev, _, err := p.Save([]byte(data), base, false)
	if err != nil {
		t.Fatalf("Save(%s, base=%s): %v", data, base, err)
	}
	return rev
}

func TestProgressStoreRoundTrip(t *testing.T) {
	p := NewProgressStore(t.TempDir())

	data, rev, err := p.Load()
	if err != nil || string(data) != "{}" || rev != "0" {
		t.Fatalf("пустое хранилище: data=%s rev=%s err=%v", data, rev, err)
	}

	rev1 := mustSave(t, p, `{"xp":10}`, "0")
	data, rev, err = p.Load()
	if err != nil || rev != rev1 {
		t.Fatalf("Load после Save: rev=%s want %s err=%v", rev, rev1, err)
	}
	var got map[string]int
	if json.Unmarshal(data, &got) != nil || got["xp"] != 10 {
		t.Fatalf("прочитано %s", data)
	}
	if _, err := os.Stat(p.Path() + ".tmp"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("временный файл не убран: %v", err)
	}
}

// Клиент с устаревшей (или отсутствующей) ревизией не может затереть прогресс.
func TestProgressStoreConflict(t *testing.T) {
	p := NewProgressStore(t.TempDir())
	rev1 := mustSave(t, p, `{"xp":10}`, "0")
	rev2 := mustSave(t, p, `{"xp":20}`, rev1)

	for _, stale := range []string{"0", rev1, "мусор"} {
		rev, cur, err := p.Save([]byte(`{"xp":0}`), stale, false)
		if !errors.Is(err, ErrConflict) {
			t.Fatalf("base=%q: ожидался ErrConflict, получено %v", stale, err)
		}
		if rev != rev2 || !strings.Contains(string(cur), `"xp": 20`) {
			t.Errorf("base=%q: при конфликте должны вернуться актуальные данные, получено rev=%s cur=%s", stale, rev, cur)
		}
	}
	if data, _, _ := p.Load(); !strings.Contains(string(data), `"xp": 20`) {
		t.Errorf("прогресс затёрт: %s", data)
	}
	if _, _, err := p.Save([]byte(`[1,2]`), rev2, false); err == nil {
		t.Error("не-объект должен отклоняться")
	}
}

func TestProgressStoreBackups(t *testing.T) {
	dir := t.TempDir()
	p := NewProgressStore(dir)
	day := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	p.now = func() time.Time { return day }

	rev := mustSave(t, p, `{"xp":1}`, "0") // первое сохранение: копировать нечего
	if n := len(p.backups("progress-")); n != 0 {
		t.Fatalf("копий после первого сохранения: %d", n)
	}
	rev = mustSave(t, p, `{"xp":2}`, rev) // копия состояния {"xp":1} за 1 марта
	rev = mustSave(t, p, `{"xp":3}`, rev) // в тот же день вторая копия не создаётся
	if got := p.backups("progress-"); len(got) != 1 || got[0] != "progress-2026-03-01.json" {
		t.Fatalf("ежедневные копии: %v", got)
	}
	b, _ := os.ReadFile(filepath.Join(p.backupDir(), "progress-2026-03-01.json"))
	if !strings.Contains(string(b), `"xp": 1`) {
		t.Errorf("в копии должно быть состояние на начало дня, а там %s", b)
	}

	// сброс: отдельная копия с отметкой времени
	rev, _, err := p.Save([]byte(`{"xp":0}`), rev, true)
	if err != nil {
		t.Fatal(err)
	}
	reset := p.backups("before-reset-")
	if len(reset) != 1 {
		t.Fatalf("копии перед сбросом: %v", reset)
	}
	b, _ = os.ReadFile(filepath.Join(p.backupDir(), reset[0]))
	if !strings.Contains(string(b), `"xp": 3`) {
		t.Errorf("копия перед сбросом должна содержать прежний прогресс, а там %s", b)
	}

	// старые ежедневные копии удаляются
	for i := 1; i <= keepDailyBackups+5; i++ {
		day = day.AddDate(0, 0, 1)
		rev = mustSave(t, p, `{"xp":`+strings.Repeat("9", i)+`}`, rev)
	}
	if n := len(p.backups("progress-")); n != keepDailyBackups {
		t.Errorf("ежедневных копий %d, должно остаться %d", n, keepDailyBackups)
	}
}

// Повреждённый или пропавший файл: читаем последнюю копию и даём её перезаписать.
func TestProgressStoreCorruptFallback(t *testing.T) {
	dir := t.TempDir()
	p := NewProgressStore(dir)
	rev := mustSave(t, p, `{"xp":5}`, "0")
	mustSave(t, p, `{"xp":6}`, rev) // появилась копия с xp=5

	for name, corrupt := range map[string]func(){
		"мусор":          func() { os.WriteFile(p.Path(), []byte(`{"xp": 6, "tasks": {`), 0o644) },
		"пустой файл":    func() { os.WriteFile(p.Path(), nil, 0o644) },
		"файл удалён":    func() { os.Remove(p.Path()) },
		"не объект":      func() { os.WriteFile(p.Path(), []byte(`null`), 0o644) },
		"двоичный шум":   func() { os.WriteFile(p.Path(), []byte{0, 1, 2, 3}, 0o644) },
		"обрезан в ноль": func() { os.Truncate(p.Path(), 0) },
	} {
		corrupt()
		data, rev, err := p.Load()
		if err != nil {
			t.Fatalf("%s: Load: %v", name, err)
		}
		if !strings.Contains(string(data), `"xp": 5`) {
			t.Errorf("%s: ожидалось восстановление из копии, получено %s", name, data)
		}
		// клиент, получивший эти данные, должен суметь записать их обратно
		if _, _, err := p.Save(data, rev, false); err != nil {
			t.Errorf("%s: запись после восстановления: %v", name, err)
		}
		if got, _, _ := p.Load(); !strings.Contains(string(got), `"xp": 5`) {
			t.Errorf("%s: после перезаписи прочитано %s", name, got)
		}
	}
}
