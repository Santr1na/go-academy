---
id: atomic-race
title: Гонки данных и sync/atomic
summary: что такое data race, детектор гонок, модель памяти, атомарные операции, CAS
xp: 35
---
## Гонка данных (data race)

Гонка данных возникает, когда **две горутины одновременно обращаются к одной переменной, и хотя бы одна пишет**, без синхронизации.

```go
count := 0
var wg sync.WaitGroup
for range 1000 {
	wg.Add(1)
	go func() {
		defer wg.Done()
		count++ // ГОНКА: чтение, +1, запись — не атомарно
	}()
}
wg.Wait()
fmt.Println(count) // часто меньше 1000
```

`count++` — это три операции: прочитать, увеличить, записать. Две горутины могут прочитать одно значение и обе записать `n+1` — одно увеличение потеряется.

> **Важно:** гонка данных в Go — это **неопределённое поведение**. Помимо неверных чисел возможны «разорванные» значения (например, интерфейс или строка с несогласованными полями) и падения. Не бывает «безобидных» гонок.

## Детектор гонок

```bash
go test -race ./...
go run -race main.go
```

Детектор находит гонки, которые **реально произошли** во время запуска, поэтому важно хорошее покрытие тестами. Замедляет программу в 2–20 раз — используйте в тестах и CI, а не в продакшене. Требует cgo.

```text
WARNING: DATA RACE
Write at 0x00c0000b4010 by goroutine 8:
  main.main.func1()
      main.go:12 +0x44
Previous write at 0x00c0000b4010 by goroutine 7:
  ...
```

## Модель памяти: happens-before

Без синхронизации нет гарантии, что одна горутина **увидит** запись другой — компилятор и процессор могут переупорядочивать операции. Гарантии видимости дают только синхронизирующие события:

- отправка в канал happens-before соответствующего получения;
- `Unlock` happens-before следующего `Lock`;
- `wg.Done()` happens-before возврата из `wg.Wait()`;
- `once.Do(f)`: завершение `f` happens-before возврата любого `Do`;
- атомарные операции синхронизируют друг с другом.

```go
var ready bool
var data int

go func() { data = 42; ready = true }()
for !ready {} // гонка! может зациклиться навсегда или увидеть ready, но не data
```

## sync/atomic

Атомарные операции выполняются неделимо, без блокировок. С Go 1.19 удобнее использовать типы:

```go
var hits atomic.Int64
hits.Add(1)
fmt.Println(hits.Load())
hits.Store(0)

var ready atomic.Bool
ready.Store(true)

var cfg atomic.Pointer[Config]
cfg.Store(&Config{...})  // атомарная замена конфигурации
c := cfg.Load()
```

### Compare-And-Swap

`CompareAndSwap(old, new)` записывает `new`, только если текущее значение равно `old`. Основа lock-free алгоритмов:

```go
func (m *Max) Update(v int64) {
	for {
		cur := m.v.Load()
		if v <= cur || m.v.CompareAndSwap(cur, v) {
			return
		}
		// кто-то успел изменить значение — пробуем снова
	}
}
```

## Когда атомики, когда мьютекс

- атомики — для одиночных счётчиков, флагов, указателей;
- мьютекс — когда нужно согласованно изменить **несколько** полей или сложную структуру. Две атомарные операции подряд вместе не атомарны!

@@ quiz
@@ q
Почему `count++` из нескольких горутин даёт неверный результат?
- [ ] Горутины выполняются по очереди
- [x] Операция состоит из чтения, изменения и записи, которые могут перемешаться между горутинами
- [ ] `int` слишком мал
@@ explain
Это классическое «потерянное обновление»: две горутины читают одно и то же значение и обе записывают `n+1`.

@@ q
Что гарантирует `go test -race`, если гонок не найдено?
- [ ] Что в программе нет гонок
- [x] Что в выполненных путях кода гонки не произошли
- [ ] Ничего, он только ускоряет тесты
@@ explain
Детектор динамический: он ловит только гонки, которые случились во время запуска. Непокрытый тестами код он не проверит.

@@ q
Корректен ли код?
```go
var a, b atomic.Int64
func transfer(n int64) {
	a.Add(-n)
	b.Add(n)
}
// другая горутина проверяет: a.Load() + b.Load() == const
```
- [ ] Да, все операции атомарны
- [x] Нет: между двумя операциями другая горутина может увидеть промежуточное состояние
@@ explain
Каждая операция атомарна, но их последовательность — нет. Для согласованного изменения нескольких значений нужен мьютекс.

@@ task atomic-stats | Статистика запросов на атомиках | xp=50
Реализуйте `Stats` — сборщик метрик сервера **без мьютексов**, только на `sync/atomic`:

- `Record(latencyMs int64, failed bool)` — учесть запрос: увеличить число запросов, при `failed` — число ошибок, добавить задержку к сумме и обновить **максимальную** задержку (через цикл CompareAndSwap);
- `Snapshot() (requests, errors, avgMs, maxMs int64)` — среднее = сумма / число запросов (0, если запросов нет).

Тест вызовет `Record` из сотен горутин одновременно.
@@ hint
Поля: `requests, errors, totalMs, maxMs atomic.Int64`.
@@ hint
Обновление максимума: `for { cur := s.maxMs.Load(); if v <= cur || s.maxMs.CompareAndSwap(cur, v) { break } }`.
@@ starter
package main

import "fmt"

type Stats struct {
}

func (s *Stats) Record(latencyMs int64, failed bool) {
}

func (s *Stats) Snapshot() (requests, errors, avgMs, maxMs int64) {
	return 0, 0, 0, 0
}

func main() {
	var s Stats
	s.Record(10, false)
	s.Record(30, true)
	fmt.Println(s.Snapshot())
}
@@ solution
package main

import (
	"fmt"
	"sync/atomic"
)

type Stats struct {
	requests atomic.Int64
	errors   atomic.Int64
	totalMs  atomic.Int64
	maxMs    atomic.Int64
}

func (s *Stats) Record(latencyMs int64, failed bool) {
	s.requests.Add(1)
	if failed {
		s.errors.Add(1)
	}
	s.totalMs.Add(latencyMs)
	for {
		cur := s.maxMs.Load()
		if latencyMs <= cur || s.maxMs.CompareAndSwap(cur, latencyMs) {
			break
		}
	}
}

func (s *Stats) Snapshot() (requests, errors, avgMs, maxMs int64) {
	requests = s.requests.Load()
	errors = s.errors.Load()
	if requests > 0 {
		avgMs = s.totalMs.Load() / requests
	}
	return requests, errors, avgMs, s.maxMs.Load()
}

func main() {
	var s Stats
	s.Record(10, false)
	s.Record(30, true)
	fmt.Println(s.Snapshot())
}
@@ test
package main

import (
	"sync"
	"testing"
)

func TestStatsSimple(t *testing.T) {
	var s Stats
	if r, e, a, m := s.Snapshot(); r+e+a+m != 0 {
		t.Errorf("пустая статистика: %d %d %d %d", r, e, a, m)
	}
	s.Record(10, false)
	s.Record(30, true)
	s.Record(20, false)
	r, e, a, m := s.Snapshot()
	if r != 3 || e != 1 || a != 20 || m != 30 {
		t.Errorf("Snapshot = %d %d %d %d; ожидалось 3 1 20 30", r, e, a, m)
	}
}

func TestStatsConcurrent(t *testing.T) {
	var s Stats
	var wg sync.WaitGroup
	for g := 0; g < 100; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 1; i <= 1000; i++ {
				s.Record(int64(i), i%10 == 0)
			}
		}()
	}
	wg.Wait()
	r, e, a, m := s.Snapshot()
	if r != 100000 || e != 10000 || a != 500 || m != 1000 {
		t.Errorf("Snapshot = %d %d %d %d; ожидалось 100000 10000 500 1000", r, e, a, m)
	}
}

@@ task fix-race | Исправьте гонку | xp=50 interview
Функция `CountWords(texts []string) map[string]int` подсчитывает слова, обрабатывая каждый текст в своей горутине, но в ней **гонка данных**: все горутины пишут в общую map без синхронизации. Под нагрузкой программа падает с `fatal error: concurrent map writes`.

Исправьте функцию, сохранив параллельную обработку текстов. Можно защитить map мьютексом или (лучше) считать слова в локальной map каждой горутины и затем объединить результаты.
@@ hint
Вариант 1: `var mu sync.Mutex` и `mu.Lock(); counts[w]++; mu.Unlock()`.
@@ hint
Вариант 2 (меньше конкуренции): каждая горутина заполняет свою `local := map[string]int{}`, а потом под мьютексом (или через канал) сливает её в общую.
@@ starter
package main

import (
	"fmt"
	"strings"
	"sync"
)

func CountWords(texts []string) map[string]int {
	counts := map[string]int{}
	var wg sync.WaitGroup
	for _, text := range texts {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for _, w := range strings.Fields(text) {
				counts[strings.ToLower(w)]++
			}
		}()
	}
	wg.Wait()
	return counts
}

func main() {
	fmt.Println(CountWords([]string{"go is fun", "Go go"}))
}
@@ solution
package main

import (
	"fmt"
	"strings"
	"sync"
)

func CountWords(texts []string) map[string]int {
	counts := map[string]int{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, text := range texts {
		wg.Add(1)
		go func() {
			defer wg.Done()
			local := map[string]int{}
			for _, w := range strings.Fields(text) {
				local[strings.ToLower(w)]++
			}
			mu.Lock()
			defer mu.Unlock()
			for w, n := range local {
				counts[w] += n
			}
		}()
	}
	wg.Wait()
	return counts
}

func main() {
	fmt.Println(CountWords([]string{"go is fun", "Go go"}))
}
@@ test
package main

import (
	"strings"
	"testing"
)

func TestCountWordsSmall(t *testing.T) {
	got := CountWords([]string{"go is fun", "Go go"})
	if got["go"] != 3 || got["is"] != 1 || got["fun"] != 1 || len(got) != 3 {
		t.Errorf("получено %v", got)
	}
}

func TestCountWordsConcurrent(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta ", 2000)
	texts := make([]string, 64)
	for i := range texts {
		texts[i] = text
	}
	for round := 0; round < 3; round++ {
		got := CountWords(texts)
		for _, w := range []string{"alpha", "beta", "gamma", "delta"} {
			if got[w] != 64*2000 {
				t.Fatalf("%s = %d, ожидалось %d", w, got[w], 64*2000)
			}
		}
	}
}
