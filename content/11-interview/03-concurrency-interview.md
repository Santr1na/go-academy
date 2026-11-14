---
id: concurrency-interview
title: Конкурентность на собеседовании (Senior)
summary: вопросы о планировщике, каналах и памяти; задачи ping-pong, singleflight и кэш с TTL
xp: 70
---
## Вопросы, которые задают почти всегда

**Чем горутина отличается от потока ОС?** Горутина управляется runtime Go, а не ядром: маленький растущий стек (от 2 КБ), дешёвое создание и переключение (в user space), M:N-планирование на потоки ОС (модель GMP).

**Что происходит при блокирующем системном вызове?** Поток M с горутиной блокируется в syscall, а его P передаётся другому потоку, чтобы остальные горутины продолжали работать. Сетевой I/O не блокирует поток вовсе — используется netpoller (epoll/kqueue).

**Как устроен канал?** Структура `hchan`: кольцевой буфер, индексы, мьютекс, очереди ждущих отправителей и получателей (`sendq`, `recvq`). При передаче между ждущими горутинами значение копируется напрямую со стека на стек.

**Буферизованный или небуферизованный канал?** Небуферизованный — синхронизация (гарантия, что получатель взял значение). Буферизованный — развязка по скорости, семафор, предотвращение утечек (буфер на 1 для результата с таймаутом). Большой буфер не лечит медленного потребителя — только откладывает проблему.

**Как найти и предотвратить утечку горутин?** Каждая горутина должна иметь понятный путь завершения: закрытие входного канала, отмена контекста, буферизованный канал результата. Диагностика — `runtime.NumGoroutine`, pprof goroutine, `goleak` в тестах.

**Mutex или канал?** Мьютекс — для защиты состояния; канал — для передачи владения и координации. «Share memory by communicating», но без фанатизма.

**Что такое happens-before?** Гарантия видимости записей между горутинами. Её дают только операции синхронизации: каналы, мьютексы, `sync.WaitGroup`, `sync.Once`, атомики. Без них — гонка и неопределённое поведение.

**Как устроен `sync.Mutex`?** Сначала быстрый путь через CAS, затем активное ожидание (spinning), затем парковка горутины в очереди семафора. Есть «режим голодания»: если горутина ждёт дольше 1 мс, мьютекс передаётся строго по очереди.

**Как ограничить число одновременных операций?** Worker pool, семафор на буферизованном канале, `errgroup.SetLimit`, `semaphore.Weighted`.

**singleflight** — подавление дублирующихся запросов: если 100 горутин одновременно просят один и тот же ключ, реальный запрос выполняется один раз, остальные ждут и получают тот же результат. Защищает базу при «промахе кэша» под нагрузкой (cache stampede). Реализация — `golang.org/x/sync/singleflight`.

## Дизайн: кэш с TTL

Типичное задание: потокобезопасный кэш с временем жизни записей. Обсудите: `RWMutex` vs шардирование (несколько map с отдельными мьютексами — меньше конкуренции), ленивое удаление при чтении vs фоновая очистка по тикеру (и её корректная остановка), внедряемые часы для тестов, ограничение размера (LRU).

@@ quiz
@@ q
Что происходит с P (процессором планировщика), когда горутина уходит в блокирующий системный вызов?
- [ ] Все горутины на этом P ждут окончания вызова
- [x] P передаётся другому потоку M, чтобы выполнять остальные горутины
- [ ] Программа создаёт новый P
@@ explain
Runtime отцепляет P от заблокированного M (hand off) и отдаёт его свободному или новому потоку, поэтому остальные горутины продолжают работать.

@@ q
Чем поможет singleflight?
- [ ] Ограничит число горутин в программе
- [x] Объединит одновременные одинаковые запросы в один реальный вызов
- [ ] Сделает канал потокобезопасным
@@ explain
Пока выполняется вызов для ключа, остальные вызывающие с тем же ключом ждут его результата, вместо того чтобы выполнять запрос повторно.

@@ q
Что произойдёт?
```go
func main() {
	ch := make(chan int)
	go func() {
		for v := range ch {
			fmt.Println(v)
		}
	}()
	ch <- 1
	ch <- 2
}
```
- [ ] Deadlock
- [x] Напечатает 1, а 2 — может не успеть: main завершится
- [ ] Горутина утечёт и программа зависнет
@@ explain
Обе отправки пройдут (горутина читает), но после второй отправки `main` может завершиться раньше, чем горутина напечатает 2. Канал не закрыт — в долгоживущей программе такая горутина утекла бы.

@@ q
Почему шардирование кэша (N map со своими мьютексами) ускоряет его под нагрузкой?
- [ ] Меньше памяти
- [x] Меньше конкуренции за одну блокировку: горутины, работающие с разными шардами, не мешают друг другу
- [ ] Map становится потокобезопасной
@@ explain
Один мьютекс на весь кэш становится узким местом. Ключи распределяются по шардам хешем, и блокировки берутся независимо.

@@ task ping-pong | Ping-pong горутин | xp=60 interview
Две горутины по очереди пишут в общий срез: первая — `"ping"`, вторая — `"pong"`. Реализуйте `PingPong(n int) []string`, которая возвращает срез из `2n` элементов: `ping pong ping pong …`.

Требования:

- ровно **две** рабочие горутины, каждая пишет только своё слово;
- очерёдность обеспечивается **каналами** (передача «эстафеты»), без `time.Sleep`;
- функция возвращается, когда обе горутины завершились.
@@ hint
Два небуферизованных канала `pingTurn` и `pongTurn`. Ping: `for range n { <-pingTurn; append "ping"; pongTurn <- struct{}{} }`. Pong — симметрично. Запустите эстафету `pingTurn <- struct{}{}` из главной горутины.
@@ hint
Последний «pong» не должен блокироваться на отправке эстафеты, которую никто не примет: сделайте каналы буферизованными на 1 или не отправляйте после последней итерации. Дождитесь горутин через WaitGroup.
@@ starter
package main

import "fmt"

func PingPong(n int) []string {
	var res []string
	for i := 0; i < n; i++ {
		res = append(res, "ping")
	}
	return res
}

func main() {
	fmt.Println(PingPong(3))
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

func PingPong(n int) []string {
	res := make([]string, 0, 2*n)
	pingTurn := make(chan struct{}, 1)
	pongTurn := make(chan struct{}, 1)
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for range n {
			<-pingTurn
			res = append(res, "ping")
			pongTurn <- struct{}{}
		}
	}()
	go func() {
		defer wg.Done()
		for range n {
			<-pongTurn
			res = append(res, "pong")
			pingTurn <- struct{}{}
		}
	}()
	if n > 0 {
		pingTurn <- struct{}{}
	}
	wg.Wait()
	return res
}

func main() {
	fmt.Println(PingPong(3))
}
@@ test
package main

import (
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestPingPong(t *testing.T) {
	for _, n := range []int{1, 3, 100} {
		done := make(chan []string, 1)
		go func() { done <- PingPong(n) }()
		select {
		case got := <-done:
			want := strings.TrimSuffix(strings.Repeat("ping pong ", n), " ")
			if strings.Join(got, " ") != want {
				t.Errorf("PingPong(%d) = %v", n, got)
			}
		case <-time.After(3 * time.Second):
			t.Fatalf("PingPong(%d) завис — deadlock?", n)
		}
	}
	if len(PingPong(0)) != 0 {
		t.Error("PingPong(0) должен быть пустым")
	}
	before := runtime.NumGoroutine()
	PingPong(5)
	time.Sleep(50 * time.Millisecond)
	if runtime.NumGoroutine() > before {
		t.Error("после возврата PingPong горутины должны завершиться")
	}
}

@@ task singleflight | Singleflight: подавление дублей | xp=80 interview
Реализуйте упрощённый `singleflight`:

```go
type Group struct { /* ... */ }
func (g *Group) Do(key string, fn func() (string, error)) (v string, err error, shared bool)
```

- если для `key` вызов **уже выполняется**, новый вызывающий не запускает `fn`, а **ждёт** результата текущего вызова и получает его (`shared = true`);
- иначе запускает `fn` сам; `shared = true`, если кто-то ещё дождался этого результата, иначе `false`;
- после завершения вызова ключ освобождается — следующий `Do` снова вызовет `fn`;
- нулевое значение `Group` готово к работе.
@@ hint
Структура вызова: `type call struct { wg sync.WaitGroup; val string; err error; dups int }`. В Group: `mu sync.Mutex; m map[string]*call`.
@@ hint
`Do`: под мьютексом проверьте `g.m[key]`; если есть — `c.dups++`, отпустите мьютекс, `c.wg.Wait()` и верните `c.val, c.err, true`. Иначе создайте `c`, `c.wg.Add(1)`, сохраните в map, отпустите мьютекс, выполните `fn`, `c.wg.Done()`, удалите ключ под мьютексом и верните `shared = c.dups > 0`.
@@ starter
package main

import "fmt"

type Group struct{}

func (g *Group) Do(key string, fn func() (string, error)) (v string, err error, shared bool) {
	v, err = fn()
	return v, err, false
}

func main() {
	var g Group
	fmt.Println(g.Do("k", func() (string, error) { return "value", nil }))
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

type call struct {
	wg   sync.WaitGroup
	val  string
	err  error
	dups int
}

type Group struct {
	mu sync.Mutex
	m  map[string]*call
}

func (g *Group) Do(key string, fn func() (string, error)) (v string, err error, shared bool) {
	g.mu.Lock()
	if g.m == nil {
		g.m = make(map[string]*call)
	}
	if c, ok := g.m[key]; ok {
		c.dups++
		g.mu.Unlock()
		c.wg.Wait()
		return c.val, c.err, true
	}
	c := &call{}
	c.wg.Add(1)
	g.m[key] = c
	g.mu.Unlock()

	c.val, c.err = fn()
	c.wg.Done()

	g.mu.Lock()
	delete(g.m, key)
	shared = c.dups > 0
	g.mu.Unlock()
	return c.val, c.err, shared
}

func main() {
	var g Group
	fmt.Println(g.Do("k", func() (string, error) { return "value", nil }))
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

func TestSingleflightDedup(t *testing.T) {
	var g Group
	var calls atomic.Int32
	release := make(chan struct{})
	fn := func() (string, error) {
		calls.Add(1)
		<-release
		return "result", nil
	}
	var wg sync.WaitGroup
	var sharedCount atomic.Int32
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, err, shared := g.Do("key", fn)
			if v != "result" || err != nil {
				t.Errorf("Do = %q, %v", v, err)
			}
			if shared {
				sharedCount.Add(1)
			}
		}()
	}
	time.Sleep(100 * time.Millisecond) // все 20 горутин успевают встать в ожидание
	close(release)
	wg.Wait()
	if n := calls.Load(); n != 1 {
		t.Errorf("fn вызвана %d раз, ожидался 1", n)
	}
	if sharedCount.Load() != 20 {
		t.Errorf("shared=true у %d вызовов, ожидалось у всех 20", sharedCount.Load())
	}
}

func TestSingleflightSequentialAndKeys(t *testing.T) {
	var g Group
	calls := 0
	for i := 0; i < 3; i++ {
		v, _, shared := g.Do("k", func() (string, error) { calls++; return "x", nil })
		if v != "x" || shared {
			t.Errorf("последовательный вызов: %q shared=%v", v, shared)
		}
	}
	if calls != 3 {
		t.Errorf("после завершения ключ должен освобождаться: вызовов %d, ожидалось 3", calls)
	}
	boom := errors.New("boom")
	if _, err, _ := g.Do("e", func() (string, error) { return "", boom }); err != boom {
		t.Errorf("ошибка должна возвращаться: %v", err)
	}
	var wg sync.WaitGroup
	var total atomic.Int32
	for _, k := range []string{"a", "b", "c"} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			g.Do(k, func() (string, error) { total.Add(1); time.Sleep(20 * time.Millisecond); return k, nil })
		}()
	}
	wg.Wait()
	if total.Load() != 3 {
		t.Errorf("разные ключи не должны объединяться: вызовов %d", total.Load())
	}
}
