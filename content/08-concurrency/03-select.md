---
id: select
title: select, таймауты и утечки горутин
summary: мультиплексирование каналов, default, time.After, nil-каналы в select, утечка горутин
xp: 35
---
## select

`select` ждёт сразу несколько операций с каналами и выполняет ту, что готова первой:

```go
select {
case msg := <-ch1:
	fmt.Println("из ch1:", msg)
case ch2 <- 42:
	fmt.Println("отправили в ch2")
case <-time.After(time.Second):
	fmt.Println("таймаут")
}
```

- Если готовы **несколько** веток — выбирается **случайная** (для справедливости).
- Если не готова ни одна и нет `default` — `select` блокируется.
- `select {}` без веток блокируется навсегда.

## Неблокирующие операции: default

```go
select {
case v := <-ch:
	fmt.Println("получили", v)
default:
	fmt.Println("данных нет, идём дальше")
}

// попытаться отправить, но не ждать:
select {
case jobs <- job:
default:
	return errors.New("очередь переполнена")
}
```

## Таймауты

```go
select {
case res := <-resultCh:
	return res, nil
case <-time.After(2 * time.Second):
	return nil, errors.New("timeout")
}
```

`time.After` создаёт таймер. С Go 1.23 неиспользуемые таймеры собираются GC сразу, но в горячих циклах всё равно лучше один `time.NewTimer` с `Reset`.

## Цикл с select

Типичная горутина-обработчик:

```go
for {
	select {
	case job := <-jobs:
		process(job)
	case <-ticker.C:
		flush()
	case <-done:
		return
	}
}
```

## nil-канал выключает ветку

Операции с nil-каналом блокируются навсегда, поэтому ветка с nil-каналом в `select` никогда не выбирается. Это удобно для слияния каналов, которые закрываются в разное время:

```go
for a != nil || b != nil {
	select {
	case v, ok := <-a:
		if !ok {
			a = nil // канал закрыт — больше его не слушаем
			continue
		}
		out <- v
	case v, ok := <-b:
		if !ok {
			b = nil
			continue
		}
		out <- v
	}
}
```

## Утечка горутин

Горутина, навсегда заблокированная на канале, никогда не будет собрана GC. Классический пример:

```go
func fetchWithTimeout() (string, error) {
	ch := make(chan string)        // небуферизованный!
	go func() {
		ch <- slowFetch()          // после таймаута никто не прочитает → горутина висит вечно
	}()
	select {
	case r := <-ch:
		return r, nil
	case <-time.After(time.Second):
		return "", errors.New("timeout")
	}
}
```

Исправление — **буфер на 1 элемент**: `make(chan string, 1)`. Тогда горутина сможет отправить результат и завершиться, даже если его никто не ждёт. Другой вариант — передавать `context` и выходить по отмене.

> **На собеседовании:** «Как найти утечку горутин?» — `runtime.NumGoroutine()`, профиль `pprof` goroutine (`/debug/pprof/goroutine?debug=2`), библиотека `go.uber.org/goleak` в тестах. С Go 1.26 появился экспериментальный профиль goroutineleak, находящий горутины, заблокированные на недостижимых каналах.

## Разбираем подробнее: как select выбирает ветку

`select` — это `switch` для операций с каналами. Алгоритм его работы стоит выучить наизусть:

1. Проверяются **все** ветки: какие операции можно выполнить прямо сейчас?
2. Готова одна — выполняется она.
3. Готовы несколько — выбирается **случайная** из готовых (не первая по порядку!).
4. Не готова ни одна, но есть `default` — выполняется `default`.
5. Не готова ни одна и `default` нет — `select` **ждёт**, пока какая-нибудь не станет готовой.

Случайность в пункте 3 сделана намеренно: иначе ветка, стоящая первой, могла бы «заморить голодом» остальные.

### Закрытый канал готов всегда

Получение из закрытого канала выполняется мгновенно — значит, такая ветка в `select` готова каждый раз:

```go
ch := make(chan int)
close(ch)

n := 0
for i := 0; i < 3; i++ {
	select {
	case <-ch:
		n++ // сработает на каждом шаге
	default:
	}
}
fmt.Println(n) // 3
```

На этом построен самый распространённый приём — **сигнал отмены**: канал `done` закрывают один раз, и все горутины, которые ждут его в `select`, узнают об этом одновременно.

```go
func worker(done <-chan struct{}, jobs <-chan int) {
	for {
		select {
		case <-done:
			return // сигнал получен — выходим
		case j := <-jobs:
			process(j)
		}
	}
}
```

### nil-канал не готов никогда

Операция с nil-каналом блокируется навсегда, поэтому такая ветка просто «выключена»:

```go
var ch chan int // nil
select {
case v := <-ch:
	fmt.Println(v)
default:
	fmt.Println("default") // выполнится: ветка с nil-каналом не готова
}
```

Этим пользуются, чтобы временно отключать ветки: присвоили переменной `nil` — ветка перестала срабатывать, вернули канал — заработала снова.

### break выходит из select, а не из цикла

```go
for {
	select {
	case <-done:
		break // выходит из select… и цикл идёт на следующий круг
	case v := <-ch:
		fmt.Println(v)
	}
}
```

Это одна из самых частых ошибок: кажется, что `break` завершит цикл, а он завершает только `select`. Цикл получается бесконечным. Правильные варианты — `return` или метка:

```go
loop:
	for {
		select {
		case <-done:
			break loop // выходит из цикла с меткой loop
		case v := <-ch:
			fmt.Println(v)
		}
	}
```

### Пустой select

`select {}` без веток ждёт вечно. Его ставят в конце `main`, когда вся работа идёт в фоновых горутинах. Если других горутин нет — получится deadlock.

### time.After в цикле

```go
for {
	select {
	case v := <-ch:
		handle(v)
	case <-time.After(time.Second): // новый таймер на КАЖДОМ круге
		return
	}
}
```

Таймаут здесь отсчитывается заново при каждом полученном значении — это «таймаут тишины», а не общий лимит времени. Для общего лимита таймер создают один раз **до** цикла: `timeout := time.After(5 * time.Second)`.

@@ quiz
@@ q
Что выведет код?
```go
ch := make(chan int, 1)
select {
case v := <-ch:
	fmt.Println("got", v)
default:
	fmt.Println("empty")
}
```
- [ ] `got 0`
- [x] `empty`
- [ ] Deadlock
@@ explain
Канал пуст, получение не готово, поэтому выполняется `default`.

@@ q
Если в `select` готовы сразу две ветки, какая выполнится?
- [ ] Первая по тексту
- [ ] Последняя по тексту
- [x] Случайная
@@ explain
Go выбирает одну из готовых веток псевдослучайно, чтобы ни один канал не «голодал».

@@ q
Почему горутина в `fetchWithTimeout` из теории утекает?
- [ ] `time.After` не освобождается
- [x] После таймаута никто не читает из небуферизованного канала, и отправка блокируется навсегда
- [ ] `select` не завершается
@@ explain
Отправка в небуферизованный канал ждёт получателя. Буфер на 1 элемент позволяет горутине завершиться.

@@ q
Что выведет код?
```go
ch := make(chan int)
close(ch)
n := 0
for i := 0; i < 3; i++ {
	select {
	case <-ch:
		n++
	default:
	}
}
fmt.Println(n)
```
- [ ] `0`
- [ ] `1`
- [x] `3`
- [ ] Паника: чтение из закрытого канала
@@ explain
Чтение из закрытого канала не блокируется и не паникует — сразу возвращает нулевое значение. Поэтому ветка `case <-ch` готова на каждой итерации, и до `default` дело не доходит.

@@ q
Что выведет код?
```go
ch := make(chan int, 3)
ch <- 1
ch <- 2
ch <- 3
count := 0
for i := 0; i < 3; i++ {
	select {
	case v := <-ch:
		if v == 2 {
			break
		}
		count++
	}
}
fmt.Println(count)
```
- [ ] `1` — `break` остановил цикл на значении 2
- [x] `2`
- [ ] `3`
- [ ] Deadlock
@@ explain
`break` внутри `select` выходит только из `select`, а не из цикла `for`. На значении 2 пропускается `count++`, но цикл продолжается и обрабатывает 3. Итого `count` увеличился дважды.

@@ q
Что выведет код?
```go
var ch chan int
select {
case v := <-ch:
	fmt.Println(v)
default:
	fmt.Println("default")
}
```
- [ ] `0`
- [x] `default`
- [ ] Паника: nil-канал
- [ ] Deadlock
@@ explain
Чтение из nil-канала блокируется навсегда, то есть эта ветка никогда не готова. Раз готовых веток нет, а `default` есть — выполняется он. Без `default` программа зависла бы.

@@ q
Что произойдёт при запуске?
```go
func main() {
	fmt.Println("start")
	select {}
}
```
- [ ] Выведет `start` и завершится
- [ ] Ошибка компиляции: `select` без веток
- [x] Выведет `start`, затем `fatal error: all goroutines are asleep - deadlock!`
- [ ] Выведет `start` и будет работать вечно без ошибок
@@ explain
`select {}` блокирует горутину навсегда. Других горутин в программе нет, так что заблокированы все — среда выполнения сообщает о deadlock. Если бы работали фоновые горутины, программа просто продолжала бы жить.

@@ task with-timeout | Вызов с таймаутом без утечек | xp=60 interview
Реализуйте `WithTimeout(f func() int, d time.Duration) (int, bool)`:

- запускает `f` в отдельной горутине;
- если `f` успела за время `d` — возвращает её результат и `true`;
- иначе — `0, false` **сразу по истечении `d`**, не дожидаясь `f`.

Главное требование: **никаких утечек горутин**. Когда медленная `f` всё-таки завершится, её горутина должна тоже завершиться. Тест проверит это через `runtime.NumGoroutine()`.
@@ hint
`ch := make(chan int, 1)` — буфер позволит горутине отправить результат, даже если его уже никто не ждёт.
@@ hint
`select { case v := <-ch: return v, true; case <-time.After(d): return 0, false }`.
@@ starter
package main

import (
	"fmt"
	"time"
)

func WithTimeout(f func() int, d time.Duration) (int, bool) {
	ch := make(chan int)
	go func() { ch <- f() }()
	select {
	case v := <-ch:
		return v, true
	case <-time.After(d):
		return 0, false
	}
}

func main() {
	fmt.Println(WithTimeout(func() int { return 42 }, time.Second))
}
@@ solution
package main

import (
	"fmt"
	"time"
)

func WithTimeout(f func() int, d time.Duration) (int, bool) {
	ch := make(chan int, 1)
	go func() { ch <- f() }()
	select {
	case v := <-ch:
		return v, true
	case <-time.After(d):
		return 0, false
	}
}

func main() {
	fmt.Println(WithTimeout(func() int { return 42 }, time.Second))
}
@@ test
package main

import (
	"runtime"
	"testing"
	"time"
)

func TestWithTimeoutFast(t *testing.T) {
	v, ok := WithTimeout(func() int { return 7 }, time.Second)
	if v != 7 || !ok {
		t.Errorf("быстрая функция: %d, %v", v, ok)
	}
}

func TestWithTimeoutSlow(t *testing.T) {
	start := time.Now()
	v, ok := WithTimeout(func() int { time.Sleep(300 * time.Millisecond); return 1 }, 30*time.Millisecond)
	if ok || v != 0 {
		t.Errorf("медленная функция: %d, %v; ожидалось 0, false", v, ok)
	}
	if el := time.Since(start); el > 200*time.Millisecond {
		t.Errorf("WithTimeout ждал %v — должен вернуться сразу после таймаута", el)
	}
}

func TestNoGoroutineLeak(t *testing.T) {
	before := runtime.NumGoroutine()
	for i := 0; i < 20; i++ {
		WithTimeout(func() int { time.Sleep(50 * time.Millisecond); return i }, time.Millisecond)
	}
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if runtime.NumGoroutine() <= before {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Errorf("утечка горутин: было %d, стало %d — горутины висят на отправке в канал", before, runtime.NumGoroutine())
}

@@ task merge2 | Слияние двух каналов | xp=60 interview
Реализуйте `Merge2(a, b <-chan int) <-chan int` — возвращает канал, в который попадают все значения из `a` и `b` (в любом порядке по мере поступления). Выходной канал закрывается, когда **оба** входных закрыты.

Используйте **одну** горутину с `select` и приём «nil-канал выключает ветку».
@@ hint
Цикл `for a != nil || b != nil { select { ... } }`.
@@ hint
В ветке: `case v, ok := <-a: if !ok { a = nil; continue }; out <- v`. Не забудьте `defer close(out)`.
@@ starter
package main

import "fmt"

func Merge2(a, b <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for v := range a {
			out <- v
		}
	}()
	return out
}

func main() {
	a, b := make(chan int), make(chan int)
	go func() { a <- 1; close(a) }()
	go func() { b <- 2; close(b) }()
	for v := range Merge2(a, b) {
		fmt.Println(v)
	}
}
@@ solution
package main

import "fmt"

func Merge2(a, b <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for a != nil || b != nil {
			select {
			case v, ok := <-a:
				if !ok {
					a = nil
					continue
				}
				out <- v
			case v, ok := <-b:
				if !ok {
					b = nil
					continue
				}
				out <- v
			}
		}
	}()
	return out
}

func main() {
	a, b := make(chan int), make(chan int)
	go func() { a <- 1; close(a) }()
	go func() { b <- 2; close(b) }()
	for v := range Merge2(a, b) {
		fmt.Println(v)
	}
}
@@ test
package main

import (
	"slices"
	"testing"
	"time"
)

func src(vals ...int) <-chan int {
	ch := make(chan int)
	go func() {
		for _, v := range vals {
			ch <- v
		}
		close(ch)
	}()
	return ch
}

func drain(t *testing.T, ch <-chan int) []int {
	t.Helper()
	var res []int
	timeout := time.After(2 * time.Second)
	for {
		select {
		case v, ok := <-ch:
			if !ok {
				slices.Sort(res)
				return res
			}
			res = append(res, v)
		case <-timeout:
			t.Fatalf("выходной канал не закрылся; получено %v", res)
			return nil
		}
	}
}

func TestMerge2(t *testing.T) {
	got := drain(t, Merge2(src(1, 3, 5), src(2, 4, 6, 8, 10)))
	if !slices.Equal(got, []int{1, 2, 3, 4, 5, 6, 8, 10}) {
		t.Errorf("получено %v", got)
	}
	got = drain(t, Merge2(src(), src(7)))
	if !slices.Equal(got, []int{7}) {
		t.Errorf("один пустой канал: %v", got)
	}
}

func TestMerge2Interleaved(t *testing.T) {
	a := make(chan int)
	b := make(chan int)
	out := Merge2(a, b)
	go func() {
		b <- 1 // b должен читаться, даже пока a открыт и молчит
		a <- 2
		close(b)
		a <- 3
		close(a)
	}()
	got := drain(t, out)
	if !slices.Equal(got, []int{1, 2, 3}) {
		t.Errorf("получено %v", got)
	}
}
