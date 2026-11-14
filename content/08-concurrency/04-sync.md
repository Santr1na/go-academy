---
id: sync
title: "sync: Mutex, RWMutex, Once"
summary: критические секции, защита map, читатели-писатели, ленивая инициализация, sync.Map и Pool
xp: 35
---
## Мьютекс

`sync.Mutex` гарантирует, что код между `Lock` и `Unlock` выполняет **только одна** горутина:

```go
type Counter struct {
	mu sync.Mutex
	m  map[string]int
}

func (c *Counter) Inc(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[key]++
}
```

Правила:

- нулевое значение `Mutex` готово к работе;
- **не копируйте** мьютекс (и структуры с ним) после первого использования — методы с pointer receiver; `go vet` проверяет это (copylocks);
- `defer mu.Unlock()` сразу после `Lock` защищает от забытого Unlock при панике или раннем return;
- мьютекс в Go **не реентерабельный**: повторный `Lock` в той же горутине — deadlock;
- держите блокировку как можно меньше времени, не делайте под ней I/O.

## RWMutex

Если чтений намного больше, чем записей, используйте `sync.RWMutex`: много читателей могут держать `RLock` одновременно, а писатель с `Lock` получает эксклюзивный доступ:

```go
type Cache struct {
	mu   sync.RWMutex
	data map[string]string
}

func (c *Cache) Get(k string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.data[k]
	return v, ok
}

func (c *Cache) Set(k, v string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.data[k] = v
}
```

При малом числе читателей `RWMutex` может быть медленнее обычного `Mutex` — измеряйте.

## sync.Once

Выполняет функцию **ровно один раз**, даже при одновременных вызовах из многих горутин. Остальные вызывающие ждут завершения первой:

```go
var (
	cfg  *Config
	once sync.Once
)

func GetConfig() *Config {
	once.Do(func() {
		cfg = loadConfig()
	})
	return cfg
}
```

С Go 1.21 есть хелперы `sync.OnceFunc`, `sync.OnceValue`, `sync.OnceValues`:

```go
var getConfig = sync.OnceValue(loadConfig) // func() *Config
```

## sync.Map

Потокобезопасная map без дженериков (`any`). Оптимизирована для двух сценариев: ключ записывается один раз и много читается; разные горутины работают с непересекающимися ключами. В остальных случаях `map + Mutex` обычно проще и быстрее.

## sync.Pool

Пул переиспользуемых объектов для снижения нагрузки на GC (например, буферов):

```go
var bufPool = sync.Pool{New: func() any { return new(bytes.Buffer) }}

buf := bufPool.Get().(*bytes.Buffer)
buf.Reset()
defer bufPool.Put(buf)
```

Объекты из пула могут быть удалены при любой сборке мусора — это кэш, а не хранилище.

## sync.Cond

Условная переменная для ожидания события (`Wait`, `Signal`, `Broadcast`). Используется редко — каналы обычно выразительнее.

## Мьютекс или канал?

- **Мьютекс** — защита состояния (кэш, счётчики, структура данных).
- **Канал** — передача владения данными, координация, конвейеры, сигналы.

## Разбираем подробнее: критическая секция

Мьютекс — это замок на двери комнаты, в которой лежат общие данные. `Lock` — зайти и запереться, `Unlock` — выйти. Пока одна горутина внутри, остальные ждут у двери. Участок кода между `Lock` и `Unlock` называют **критической секцией**.

```go
type Counter struct {
	mu sync.Mutex
	n  map[string]int
}

func (c *Counter) Inc(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.n[key]++
}

func (c *Counter) Get(key string) int {
	c.mu.Lock()         // читать тоже нужно под замком
	defer c.mu.Unlock()
	return c.n[key]
}
```

Три правила, без которых мьютекс не работает:

1. **Замок защищает данные, а не код.** Каждое обращение к защищаемым данным — и запись, и чтение — должно быть под одним и тем же мьютексом. Достаточно одного «незапертого» чтения, чтобы гонка вернулась.
2. **Мьютекс нельзя копировать.** Копия — это другой замок от той же комнаты. Поэтому у типа с мьютексом все методы — на указателе, и передают его тоже по указателю.
3. **Держите замок как можно меньше.** Никакой сети, диска и вызовов чужого кода внутри критической секции.

### Мьютекс не знает, кто его держит

```go
var mu sync.Mutex
mu.Lock()
mu.Lock() // эта же горутина ждёт саму себя — навсегда
```

В Go мьютекс **не реентерабельный**: повторный `Lock` из той же горутины блокируется. На практике так получается, когда метод под замком вызывает другой метод того же объекта, который тоже берёт замок. Решение — внутренний метод без блокировки (`getLocked`), вызываемый только под уже взятым замком.

### defer Unlock и циклы

```go
for i := 0; i < 2; i++ {
	mu.Lock()
	defer mu.Unlock() // выполнится при выходе из ФУНКЦИИ, а не из итерации
	n++
}
// на втором круге Lock ждёт Unlock, который ещё не выполнился — deadlock
```

Внутри цикла освобождайте замок явно либо вынесите тело цикла в отдельную функцию.

### RWMutex: много читателей или один писатель

```go
var mu sync.RWMutex

mu.RLock() // читать могут одновременно сколько угодно горутин
v := data[k]
mu.RUnlock()

mu.Lock() // писатель ждёт ухода всех читателей и заходит один
data[k] = v
mu.Unlock()
```

`RWMutex` выигрывает, когда чтений намного больше, чем записей. Ловушка: нельзя «повысить» блокировку — взять `Lock`, не отпустив `RLock`. Писатель ждёт ухода читателей, а читатель — это вы сами:

```go
mu.RLock()
mu.Lock() // deadlock: ждём, пока уйдёт читатель, которым сами и являемся
```

### Ошибки, которые видны только при запуске

| Что сделали | Что получили |
|---|---|
| `Unlock` без `Lock` | `fatal error: sync: unlock of unlocked mutex` |
| `wg.Done()` больше раз, чем `Add` | `panic: sync: negative WaitGroup counter` |
| повторный `Lock` в той же горутине | deadlock |
| чтение map без замка при параллельной записи | `fatal error: concurrent map read and map write` |

Обратите внимание на `fatal error` — в отличие от `panic`, его нельзя перехватить через `recover`.

### Мьютекс или канал

- Нужно **защитить состояние** (счётчик, кэш, map) — мьютекс: проще и быстрее.
- Нужно **передать данные или сигнал** между горутинами (очередь задач, отмена, результат) — канал.

@@ quiz
@@ q
Что произойдёт?
```go
var mu sync.Mutex
mu.Lock()
mu.Lock()
fmt.Println("ok")
```
- [ ] Выведет `ok`
- [x] Deadlock: мьютекс в Go не реентерабельный
- [ ] Паника: double lock
@@ explain
Второй `Lock` в той же горутине ждёт, пока мьютекс освободят, а освободить некому. В `main` это приведёт к fatal error: all goroutines are asleep.

@@ q
Что не так с кодом?
```go
type SafeMap struct {
	sync.Mutex
	m map[string]int
}
func (s SafeMap) Set(k string, v int) {
	s.Lock(); defer s.Unlock()
	s.m[k] = v
}
```
- [ ] Ничего
- [x] Value receiver копирует мьютекс — каждый вызов блокирует свою копию, защиты нет
- [ ] Нельзя встраивать Mutex
@@ explain
С value receiver метод получает копию структуры вместе с копией мьютекса. `go vet` предупредит: «passes lock by value». Нужен `(s *SafeMap)`.

@@ q
Сколько раз вызовется `load`, если 100 горутин одновременно вызовут `once.Do(load)`?
- [ ] 100
- [x] 1
- [ ] Неопределённо
@@ explain
`Once` гарантирует однократное выполнение, а остальные вызовы блокируются, пока первая функция не завершится.

@@ q
Что произойдёт при запуске?
```go
var mu sync.Mutex
n := 0
for i := 0; i < 2; i++ {
	mu.Lock()
	defer mu.Unlock()
	n++
}
fmt.Println(n)
```
- [ ] Выведет `2`
- [ ] Выведет `1`
- [x] `fatal error: all goroutines are asleep - deadlock!`
- [ ] Паника: unlock of unlocked mutex
@@ explain
`defer` срабатывает при выходе из функции, а не в конце итерации. На втором круге `Lock` пытается взять замок, который всё ещё занят с первого круга, — горутина ждёт саму себя.

@@ q
Что произойдёт при запуске?
```go
var mu sync.RWMutex
mu.RLock()
mu.Lock()
fmt.Println("ok")
```
- [ ] Выведет `ok`: блокировка на чтение «повышается» до записи
- [x] Deadlock: писатель ждёт ухода читателя, а читатель — эта же горутина
- [ ] Паника
- [ ] Ошибка компиляции
@@ explain
`Lock` ждёт, пока все читатели вызовут `RUnlock`. Единственный читатель — та же горутина, которая теперь заблокирована на `Lock`. В `RWMutex` нельзя повысить блокировку: нужно сначала `RUnlock`, потом `Lock`.

@@ q
Что произойдёт при запуске?
```go
var wg sync.WaitGroup
wg.Done()
fmt.Println("ok")
```
- [ ] Выведет `ok`
- [ ] Deadlock
- [x] Паника: `sync: negative WaitGroup counter`
- [ ] Ошибка компиляции
@@ explain
`Done` уменьшает счётчик на единицу. Он был нулём, а отрицательным быть не может — паника. Так проявляется лишний `Done` или пропущенный `Add`.

@@ q
Горутины-писатели меняют map под мьютексом, а горутина-читатель читает ту же map без блокировки — «ведь чтение ничего не портит». Что может случиться?
- [ ] Ничего: читать без блокировки безопасно
- [ ] Читатель иногда получит устаревшее значение, и всё
- [x] Программа может завершиться с `fatal error: concurrent map read and map write`
- [ ] Ошибка компиляции
@@ explain
Мьютекс защищает данные только тогда, когда его берут **все**, кто к ним обращается, включая читателей. Одновременные чтение и запись map — гонка, которую среда выполнения обнаруживает и останавливает программу; `recover` такую ошибку не перехватывает.

@@ task safe-counter | Потокобезопасный счётчик | xp=60 interview
Реализуйте `SafeCounter` — счётчик по ключам, безопасный для использования из многих горутин:

- `NewSafeCounter() *SafeCounter`
- `Inc(key string)`
- `Add(key string, n int)`
- `Value(key string) int`
- `Snapshot() map[string]int` — **копия** текущего состояния (изменение копии не влияет на счётчик).

Используйте `sync.RWMutex`: чтения — под `RLock`. Тест запустит сотни горутин одновременно; без синхронизации программа упадёт с `concurrent map writes`.
@@ hint
Структура: `mu sync.RWMutex` и `m map[string]int`. Все методы — с pointer receiver.
@@ hint
`Snapshot`: под `RLock` создайте новую map и скопируйте все пары (или `maps.Clone`).
@@ starter
package main

import "fmt"

type SafeCounter struct {
	m map[string]int
}

func NewSafeCounter() *SafeCounter {
	return &SafeCounter{m: map[string]int{}}
}

func (c *SafeCounter) Inc(key string)        { c.m[key]++ }
func (c *SafeCounter) Add(key string, n int) { c.m[key] += n }
func (c *SafeCounter) Value(key string) int  { return c.m[key] }
func (c *SafeCounter) Snapshot() map[string]int {
	return c.m
}

func main() {
	c := NewSafeCounter()
	c.Inc("a")
	fmt.Println(c.Value("a"))
}
@@ solution
package main

import (
	"fmt"
	"maps"
	"sync"
)

type SafeCounter struct {
	mu sync.RWMutex
	m  map[string]int
}

func NewSafeCounter() *SafeCounter {
	return &SafeCounter{m: map[string]int{}}
}

func (c *SafeCounter) Inc(key string) { c.Add(key, 1) }

func (c *SafeCounter) Add(key string, n int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.m[key] += n
}

func (c *SafeCounter) Value(key string) int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.m[key]
}

func (c *SafeCounter) Snapshot() map[string]int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return maps.Clone(c.m)
}

func main() {
	c := NewSafeCounter()
	c.Inc("a")
	fmt.Println(c.Value("a"))
}
@@ test
package main

import (
	"fmt"
	"sync"
	"testing"
)

func TestSafeCounterSnapshot(t *testing.T) {
	c := NewSafeCounter()
	c.Inc("x")
	s := c.Snapshot()
	s["x"] = 100
	if c.Value("x") != 1 {
		t.Error("Snapshot должен возвращать копию")
	}
}

func TestSafeCounterConcurrent(t *testing.T) {
	c := NewSafeCounter()
	var wg sync.WaitGroup
	for g := 0; g < 50; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			key := fmt.Sprint("k", g%5)
			for i := 0; i < 2000; i++ {
				c.Inc(key)
				c.Add("total", 2)
				if i%100 == 0 {
					c.Value(key)
					c.Snapshot()
				}
			}
		}()
	}
	wg.Wait()
	for i := 0; i < 5; i++ {
		if v := c.Value(fmt.Sprint("k", i)); v != 20000 {
			t.Errorf("k%d = %d, ожидалось 20000", i, v)
		}
	}
	if v := c.Value("total"); v != 200000 {
		t.Errorf("total = %d, ожидалось 200000", v)
	}
}

@@ task once-loader | Ленивая загрузка | xp=50
Реализуйте `Lazy` — значение, которое вычисляется функцией `load` **при первом обращении** и **ровно один раз**, даже если `Get` вызывают одновременно из многих горутин:

```go
func NewLazy(load func() (string, error)) *Lazy
func (l *Lazy) Get() (string, error)
```

Если `load` вернула ошибку — она запоминается и возвращается при всех последующих вызовах (повторно `load` не вызывается).
@@ hint
Поля: `once sync.Once`, `load func() (string, error)`, `val string`, `err error`.
@@ hint
`func (l *Lazy) Get() (string, error) { l.once.Do(func() { l.val, l.err = l.load() }); return l.val, l.err }`. Можно также использовать `sync.OnceValues`.
@@ starter
package main

import "fmt"

type Lazy struct {
	load func() (string, error)
}

func NewLazy(load func() (string, error)) *Lazy {
	return &Lazy{load: load}
}

func (l *Lazy) Get() (string, error) {
	return l.load()
}

func main() {
	l := NewLazy(func() (string, error) { fmt.Println("загрузка..."); return "data", nil })
	fmt.Println(l.Get())
	fmt.Println(l.Get())
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

type Lazy struct {
	once sync.Once
	load func() (string, error)
	val  string
	err  error
}

func NewLazy(load func() (string, error)) *Lazy {
	return &Lazy{load: load}
}

func (l *Lazy) Get() (string, error) {
	l.once.Do(func() {
		l.val, l.err = l.load()
	})
	return l.val, l.err
}

func main() {
	l := NewLazy(func() (string, error) { fmt.Println("загрузка..."); return "data", nil })
	fmt.Println(l.Get())
	fmt.Println(l.Get())
}
@@ test
package main

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestLazyOnce(t *testing.T) {
	var calls atomic.Int32
	l := NewLazy(func() (string, error) {
		calls.Add(1)
		time.Sleep(20 * time.Millisecond)
		return "value", nil
	})
	if calls.Load() != 0 {
		t.Fatal("load не должна вызываться в конструкторе")
	}
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if v, err := l.Get(); v != "value" || err != nil {
				t.Errorf("Get() = %q, %v", v, err)
			}
		}()
	}
	wg.Wait()
	if n := calls.Load(); n != 1 {
		t.Errorf("load вызвана %d раз, ожидался 1", n)
	}
}

func TestLazyError(t *testing.T) {
	calls := 0
	boom := errors.New("boom")
	l := NewLazy(func() (string, error) { calls++; return "", boom })
	for i := 0; i < 3; i++ {
		if _, err := l.Get(); err != boom {
			t.Errorf("ожидалась ошибка boom, получено %v", err)
		}
	}
	if calls != 1 {
		t.Errorf("при ошибке load вызвана %d раз, ожидался 1", calls)
	}
}
