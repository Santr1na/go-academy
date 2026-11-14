package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	keepDailyBackups = 14 // сколько ежедневных копий хранить
	keepResetBackups = 5  // сколько копий «перед сбросом» хранить
)

// ErrConflict — файл прогресса изменился с тех пор, как клиент его читал.
var ErrConflict = errors.New("прогресс на сервере изменился")

// ProgressStore хранит прогресс одного (локального) пользователя в JSON-файле.
//
// Защита от потери данных:
//   - запись принимается, только если клиент видел актуальную версию файла
//     (оптимистичная блокировка по ревизии) — устаревшая вкладка или браузер
//     с очищенным хранилищем не могут затереть прогресс;
//   - запись атомарна (временный файл + rename);
//   - раз в день и перед каждым сбросом сохраняется резервная копия;
//   - если основной файл повреждён или пропал, читается последняя копия.
type ProgressStore struct {
	mu   sync.Mutex
	dir  string
	path string
	now  func() time.Time
}

func NewProgressStore(dir string) *ProgressStore {
	return &ProgressStore{dir: dir, path: filepath.Join(dir, "progress.json"), now: time.Now}
}

// Path возвращает путь к файлу прогресса.
func (p *ProgressStore) Path() string { return p.path }

func (p *ProgressStore) backupDir() string { return filepath.Join(p.dir, "backups") }

// revOf — ревизия содержимого файла. "0" означает «файла нет или он пуст».
func revOf(data []byte) string {
	if len(bytes.TrimSpace(data)) == 0 {
		return "0"
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:8])
}

func isJSONObject(data []byte) bool {
	var obj map[string]json.RawMessage
	return json.Unmarshal(data, &obj) == nil && obj != nil
}

// Load возвращает прогресс (всегда валидный JSON-объект) и ревизию файла.
func (p *ProgressStore) Load() (data []byte, rev string, err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.current()
}

// current читает основной файл; если он отсутствует, пуст или повреждён —
// берёт самую свежую резервную копию. Ревизия всегда относится к основному файлу.
func (p *ProgressStore) current() ([]byte, string, error) {
	raw, err := os.ReadFile(p.path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, "", err
	}
	rev := revOf(raw)
	if isJSONObject(raw) {
		return raw, rev, nil
	}
	if len(bytes.TrimSpace(raw)) > 0 {
		log.Printf("ВНИМАНИЕ: %s повреждён, ищу резервную копию", p.path)
	}
	if b, name := p.latestBackup(); b != nil {
		log.Printf("прогресс восстановлен из резервной копии %s", name)
		return b, rev, nil
	}
	return []byte("{}"), rev, nil
}

// Save записывает прогресс, если base совпадает с текущей ревизией файла.
// При несовпадении возвращает ErrConflict вместе с актуальными ревизией и данными,
// чтобы клиент объединил их со своими и повторил запись.
// snapshot=true дополнительно сохраняет прежнее состояние отдельной копией
// (используется перед сбросом и импортом).
func (p *ProgressStore) Save(data []byte, base string, snapshot bool) (rev string, cur []byte, err error) {
	if !isJSONObject(data) {
		return "", nil, errors.New("прогресс должен быть JSON-объектом")
	}
	p.mu.Lock()
	defer p.mu.Unlock()

	raw, err := os.ReadFile(p.path)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return "", nil, err
	}
	if curRev := revOf(raw); base != curRev {
		cur, _, err := p.current()
		if err != nil {
			return "", nil, err
		}
		return curRev, cur, ErrConflict
	}

	var pretty bytes.Buffer
	if err := json.Indent(&pretty, data, "", "  "); err != nil {
		return "", nil, err
	}
	if err := os.MkdirAll(p.dir, 0o755); err != nil {
		return "", nil, err
	}
	if isJSONObject(raw) {
		if err := p.backup(raw, snapshot); err != nil {
			log.Printf("резервная копия прогресса: %v", err) // не мешаем сохранению
		}
	}
	if err := writeFileAtomic(p.path, pretty.Bytes()); err != nil {
		return "", nil, err
	}
	return revOf(pretty.Bytes()), nil, nil
}

// writeFileAtomic пишет во временный файл, сбрасывает его на диск и
// переименовывает поверх целевого — файл никогда не остаётся «наполовину записанным».
func writeFileAtomic(path string, data []byte) error {
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, path)
}

// backup сохраняет прежнее содержимое файла: один раз в день (состояние на
// начало дня) и, если snapshot, — отдельной копией с отметкой времени.
func (p *ProgressStore) backup(prev []byte, snapshot bool) error {
	dir := p.backupDir()
	now := p.now()
	var names []string
	daily := "progress-" + now.Format("2006-01-02") + ".json"
	if _, err := os.Stat(filepath.Join(dir, daily)); errors.Is(err, fs.ErrNotExist) {
		names = append(names, daily)
	}
	if snapshot {
		names = append(names, "before-reset-"+now.Format("2006-01-02_15-04-05")+".json")
	}
	if len(names) == 0 {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for _, name := range names {
		if err := writeFileAtomic(filepath.Join(dir, name), prev); err != nil {
			return err
		}
	}
	p.prune("progress-", keepDailyBackups)
	p.prune("before-reset-", keepResetBackups)
	return nil
}

// backups возвращает имена резервных копий с данным префиксом, от старых к новым
// (имена содержат дату, поэтому лексикографический порядок = хронологический).
func (p *ProgressStore) backups(prefix string) []string {
	entries, err := os.ReadDir(p.backupDir())
	if err != nil {
		return nil
	}
	var names []string
	for _, e := range entries {
		if n := e.Name(); !e.IsDir() && strings.HasPrefix(n, prefix) && strings.HasSuffix(n, ".json") {
			names = append(names, n)
		}
	}
	sort.Strings(names)
	return names
}

func (p *ProgressStore) prune(prefix string, keep int) {
	names := p.backups(prefix)
	for i := 0; i < len(names)-keep; i++ {
		os.Remove(filepath.Join(p.backupDir(), names[i]))
	}
}

// latestBackup возвращает самую свежую (по времени изменения) читаемую копию.
func (p *ProgressStore) latestBackup() ([]byte, string) {
	type item struct {
		name string
		mod  time.Time
	}
	var items []item
	for _, prefix := range []string{"progress-", "before-reset-"} {
		for _, n := range p.backups(prefix) {
			if st, err := os.Stat(filepath.Join(p.backupDir(), n)); err == nil {
				items = append(items, item{n, st.ModTime()})
			}
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].mod.After(items[j].mod) })
	for _, it := range items {
		if b, err := os.ReadFile(filepath.Join(p.backupDir(), it.name)); err == nil && isJSONObject(b) {
			return b, it.name
		}
	}
	return nil, ""
}
