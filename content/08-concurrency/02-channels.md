---
id: channels
title: Каналы
summary: небуферизованные и буферизованные каналы, close, range, направленные каналы, deadlock, аксиомы каналов
xp: 35
---
## Каналы

«Не общайтесь через разделяемую память; разделяйте память через общение». Канал — типизированная труба для передачи значений между горутинами:

```go
ch := make(chan int)  // небуферизованный канал

go func() {
	ch <- 42          // отправка
}()
v := <-ch             // получение
fmt.Println(v)        // 42
```

## Небуферизованный канал — синхронизация

Отправка в небуферизованный канал **блокируется**, пока другая горутина не начнёт получение (и наоборот). Это «рукопожатие»: в момент передачи обе горутины встречаются.

## Буферизованный канал — очередь

```go
ch := make(chan string, 2) // ёмкость 2
ch <- "a"                  // не блокируется
ch <- "b"                  // не блокируется
// ch <- "c"               // заблокируется: буфер полон
fmt.Println(<-ch, len(ch), cap(ch)) // a 1 2
```

Отправка блокируется, когда буфер полон; получение — когда пуст.

## Закрытие и range

Отправитель закрывает канал, чтобы сообщить «данных больше не будет»:

```go
func gen(n int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for i := range n {
			out <- i
		}
	}()
	return out
}

for v := range gen(3) { // цикл завершится после close
	fmt.Println(v)
}

v, ok := <-ch // ok == false, если канал закрыт и пуст
```

## Аксиомы каналов (важно для собеседований)

| Операция | nil-канал | закрытый канал | открытый канал |
|---|---|---|---|
| Отправка `ch <- v` | блокировка навсегда | **panic** | блокировка или успех |
| Получение `<-ch` | блокировка навсегда | нулевое значение сразу, `ok=false` | блокировка или значение |
| `close(ch)` | **panic** | **panic** | успех |

Правила:

- закрывает канал **отправитель**, а не получатель;
- закрывать не обязательно — только чтобы сообщить получателям о конце данных;
- из закрытого буферизованного канала сначала дочитываются оставшиеся значения.

## Направленные каналы

Тип может ограничивать направление — компилятор проверит корректность использования:

```go
func producer(out chan<- int) { out <- 1 }       // только отправка
func consumer(in <-chan int)  { fmt.Println(<-in) } // только получение
```

Двунаправленный `chan int` неявно преобразуется в любой направленный.

## Deadlock

Если все горутины заблокированы, runtime завершает программу:

```go
func main() {
	ch := make(chan int)
	ch <- 1 // fatal error: all goroutines are asleep - deadlock!
}
```

Частичные дедлоки (зависли не все горутины) runtime не обнаружит — это **утечка горутин**.

## Сигнальный канал

Для сигналов без данных используют `chan struct{}`, а `close` работает как широковещательное оповещение всех получателей:

```go
done := make(chan struct{})
go func() {
	work()
	close(done)
}()
<-done
```

## Разбираем подробнее: канал как труба

Удобная модель: канал — это **труба**, в один конец которой кладут значения, а из другого достают. Всё поведение каналов следует из ответа на вопрос «что делает операция, когда она не может выполниться сразу?» — она **ждёт**.

### Небуферизованный канал: передача из рук в руки

`make(chan int)` — труба нулевой длины. Положить значение некуда: отправитель стоит с ним в руках, пока не подойдёт получатель.

```go
ch := make(chan int)

go func() {
	ch <- 42 // ждёт здесь, пока main не начнёт читать
}()

v := <-ch // ждёт здесь, пока горутина не начнёт писать
fmt.Println(v)
```

Обе стороны встречаются в одной точке — поэтому небуферизованный канал заодно **синхронизирует** горутины.

Если встречаться не с кем, программа виснет:

```go
ch := make(chan int)
ch <- 1            // main ждёт получателя… а других горутин нет
fmt.Println(<-ch)  // сюда выполнение не дойдёт никогда
// fatal error: all goroutines are asleep - deadlock!
```

Чтение стоит строкой ниже, но до него дело не дойдёт: `main` уже заблокирована на отправке. Отправка и получение по небуферизованному каналу должны происходить **в разных горутинах**.

### Буферизованный канал: труба с местом внутри

`make(chan int, 2)` — в трубе помещаются два значения. Отправитель ждёт, только когда труба **полна**; получатель — только когда она **пуста**.

```go
ch := make(chan int, 2)
ch <- 1 // не ждёт
ch <- 2 // не ждёт
ch <- 3 // труба полна — ждёт получателя
```

### Закрытие: «больше ничего не будет»

`close(ch)` — сообщение от отправителя получателям. После закрытия из канала можно дочитать то, что в нём осталось, а дальше чтение сразу возвращает нулевое значение:

```go
ch := make(chan int, 1)
ch <- 5
close(ch)

a, ok1 := <-ch // 5 true  — значение из буфера
b, ok2 := <-ch // 0 false — канал закрыт и пуст
```

Второе значение `ok` отвечает на вопрос «это настоящее значение или канал закрыт?». Без него ноль из закрытого канала неотличим от настоящего нуля.

`range` по каналу читает, пока канал не закроют. Забыли закрыть — цикл дочитает буфер и повиснет:

```go
ch := make(chan int, 2)
ch <- 1
ch <- 2
for v := range ch { // прочитает 1 и 2 и будет ждать третьего вечно
	fmt.Print(v)
}
// 12, затем fatal error: all goroutines are asleep - deadlock!
```

### Таблица, которую спрашивают на каждом собеседовании

| Операция | nil-канал | открытый канал | закрытый канал |
|---|---|---|---|
| отправка `ch <- v` | блокируется навсегда | ждёт места или получателя | **паника** |
| получение `<-ch` | блокируется навсегда | ждёт значения | сразу нулевое значение, `ok == false` |
| `close(ch)` | **паника** | закрывает | **паника** |

Из таблицы следуют правила хорошего тона:

- **закрывает канал отправитель**, и только он — получатель не знает, будут ли ещё отправки;
- если отправителей несколько, закрывает тот, кто дождался их всех (обычно через `WaitGroup`);
- закрывать канал не обязательно: это нужно, только если получатель должен узнать об окончании данных.

### Deadlock ловится не всегда

Среда выполнения сообщает о deadlock, только когда заблокированы **все** горутины. Если `main` продолжает работать, зависшая горутина останется незамеченной:

```go
ch := make(chan string)
go func() {
	ch <- "a"
	ch <- "b" // получателя не будет: горутина зависла навсегда
}()
fmt.Println(<-ch) // a — и программа спокойно завершается
```

Ошибки нет, но в настоящем сервисе такая горутина осталась бы висеть до перезапуска. Это и есть утечка горутин.

@@ quiz
@@ q
Что выведет код?
```go
ch := make(chan int, 3)
ch <- 1
ch <- 2
close(ch)
for v := range ch {
	fmt.Print(v)
}
v, ok := <-ch
fmt.Print(" ", v, ok)
```
- [ ] Паника: чтение из закрытого канала
- [x] `12 0 false`
- [ ] `12 2 true`
- [ ] Deadlock
@@ explain
Из закрытого канала сначала дочитываются оставшиеся значения (1, 2), затем `range` завершается. Дальнейшее чтение сразу возвращает нулевое значение и `ok == false`.

@@ q
Что произойдёт при отправке в закрытый канал?
- [ ] Значение будет отброшено
- [ ] Горутина заблокируется навсегда
- [x] Паника
@@ explain
`send on closed channel` — паника. Поэтому закрывать канал должен единственный отправитель (или координатор отправителей).

@@ q
Что произойдёт?
```go
var ch chan int
<-ch
```
- [ ] Вернётся 0
- [ ] Паника: nil channel
- [x] Блокировка навсегда (в main — fatal error: deadlock)
@@ explain
Операции с nil-каналом блокируются навсегда. Это полезно в `select`, чтобы «выключить» ветку.

@@ q
Что выведет код?
```go
ch := make(chan int)
go func() { ch <- 1 }()
time.Sleep(10 * time.Millisecond)
fmt.Println(len(ch), cap(ch))
```
- [x] `0 0`
- [ ] `1 0`
- [ ] `1 1`
@@ explain
У небуферизованного канала нет буфера: `len` и `cap` всегда 0. Отправитель просто ждёт получателя.

@@ q
Что произойдёт при запуске?
```go
ch := make(chan int)
ch <- 1
fmt.Println(<-ch)
```
- [ ] Выведет `1`
- [x] `fatal error: all goroutines are asleep - deadlock!`
- [ ] Выведет `0`
- [ ] Ошибка компиляции
@@ explain
Канал небуферизованный: отправка ждёт получателя. Но получение стоит строкой ниже в той же горутине, и до него выполнение не дойдёт. Заблокированы все горутины — среда выполнения сообщает о deadlock.

@@ q
Что произойдёт при запуске?
```go
ch := make(chan int, 2)
ch <- 1
ch <- 2
for v := range ch {
	fmt.Print(v)
}
fmt.Println("end")
```
- [ ] Выведет `12end`
- [x] Выведет `12`, затем `fatal error: all goroutines are asleep - deadlock!`
- [ ] Сразу deadlock, ничего не выведет
- [ ] Выведет `12` и завершится без `end`
@@ explain
`range` по каналу завершается только после `close`. Канал не закрыт: цикл прочитает оба значения из буфера и будет ждать третьего, которое никто не отправит.

@@ q
Что произойдёт при запуске?
```go
ch := make(chan string)
go func() {
	ch <- "a"
	ch <- "b"
}()
fmt.Println(<-ch)
```
- [ ] Выведет `a`, затем `b`
- [ ] Выведет `a`, затем deadlock
- [x] Выведет `a` и завершится без ошибок
- [ ] Сразу deadlock
@@ explain
`main` читает одно значение и завершается — вместе с ней завершается вся программа. Горутина осталась заблокированной на второй отправке, но о deadlock сообщают, только когда заблокированы **все** горутины. В долгоживущем сервисе это была бы утечка горутины.

@@ q
Что произойдёт при запуске?
```go
ch := make(chan int, 1)
close(ch)
close(ch)
fmt.Println("ok")
```
- [ ] Выведет `ok`: повторное закрытие безопасно
- [x] Паника: `close of closed channel`
- [ ] Deadlock
- [ ] Ошибка компиляции
@@ explain
Закрыть канал можно только один раз; повторный `close` — паника. Также паникуют `close(nil)` и отправка в закрытый канал. Поэтому закрывать канал должен ровно один «владелец» — отправитель.

@@ task gen-sum | Генератор и потребитель | xp=50
Реализуйте:

- `Generate(nums ...int) <-chan int` — возвращает канал, в который **отдельная горутина** отправляет все числа по порядку и затем **закрывает** канал;
- `SumChan(in <-chan int) int` — читает канал до закрытия и возвращает сумму;
- `Square(in <-chan int) <-chan int` — стадия конвейера: читает числа, отправляет их квадраты в новый канал, закрывает его по завершении входа.

`SumChan(Square(Generate(1, 2, 3)))` → 14.
@@ hint
Шаблон: `out := make(chan int); go func() { defer close(out); for ... { out <- v } }(); return out`.
@@ hint
`for v := range in { sum += v }` — цикл завершится после закрытия канала.
@@ starter
package main

import "fmt"

func Generate(nums ...int) <-chan int {
	out := make(chan int)
	return out
}

func SumChan(in <-chan int) int {
	return 0
}

func Square(in <-chan int) <-chan int {
	return in
}

func main() {
	fmt.Println("старт")
}
@@ solution
package main

import "fmt"

func Generate(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

func SumChan(in <-chan int) int {
	sum := 0
	for v := range in {
		sum += v
	}
	return sum
}

func Square(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for v := range in {
			out <- v * v
		}
	}()
	return out
}

func main() {
	fmt.Println(SumChan(Square(Generate(1, 2, 3))))
}
@@ test
package main

import (
	"testing"
	"time"
)

func within(t *testing.T, d time.Duration, f func()) {
	t.Helper()
	done := make(chan struct{})
	go func() { f(); close(done) }()
	select {
	case <-done:
	case <-time.After(d):
		t.Fatalf("не завершилось за %v — канал не закрыт или горутина зависла", d)
	}
}

func TestGenerate(t *testing.T) {
	within(t, 2*time.Second, func() {
		var got []int
		for v := range Generate(3, 1, 2) {
			got = append(got, v)
		}
		if len(got) != 3 || got[0] != 3 || got[1] != 1 || got[2] != 2 {
			t.Errorf("Generate(3,1,2) отдал %v", got)
		}
	})
}

func TestPipeline(t *testing.T) {
	within(t, 2*time.Second, func() {
		if s := SumChan(Square(Generate(1, 2, 3))); s != 14 {
			t.Errorf("сумма квадратов = %d, ожидалось 14", s)
		}
		if s := SumChan(Generate()); s != 0 {
			t.Errorf("пустой генератор: %d", s)
		}
	})
}

@@ task batch | Пакетная обработка | xp=60 interview
Реализуйте `Batch(in <-chan int, size int) <-chan []int` — читает значения из `in` и отправляет их **пачками** по `size` элементов. Последняя пачка может быть меньше. Когда `in` закрыт и все данные отправлены — выходной канал закрывается. Пустые пачки не отправляются.

Каждая отправленная пачка должна быть **независимым** срезом (не переиспользуйте один и тот же буфер — получатель может ещё держать предыдущую пачку).
@@ hint
Накапливайте `buf = append(buf, v)`; когда `len(buf) == size` — `out <- buf; buf = nil` (новый срез на следующей итерации).
@@ hint
После выхода из `for v := range in` отправьте остаток, если `len(buf) > 0`, и закройте `out` (удобно через `defer close(out)`).
@@ starter
package main

import "fmt"

func Batch(in <-chan int, size int) <-chan []int {
	out := make(chan []int)
	close(out)
	return out
}

func main() {
	in := make(chan int)
	go func() {
		for i := 1; i <= 7; i++ {
			in <- i
		}
		close(in)
	}()
	for b := range Batch(in, 3) {
		fmt.Println(b)
	}
}
@@ solution
package main

import "fmt"

func Batch(in <-chan int, size int) <-chan []int {
	out := make(chan []int)
	go func() {
		defer close(out)
		var buf []int
		for v := range in {
			buf = append(buf, v)
			if len(buf) == size {
				out <- buf
				buf = nil
			}
		}
		if len(buf) > 0 {
			out <- buf
		}
	}()
	return out
}

func main() {
	in := make(chan int)
	go func() {
		for i := 1; i <= 7; i++ {
			in <- i
		}
		close(in)
	}()
	for b := range Batch(in, 3) {
		fmt.Println(b)
	}
}
@@ test
package main

import (
	"fmt"
	"testing"
	"time"
)

func feed(n int) <-chan int {
	ch := make(chan int)
	go func() {
		for i := 1; i <= n; i++ {
			ch <- i
		}
		close(ch)
	}()
	return ch
}

func collect(t *testing.T, ch <-chan []int) [][]int {
	t.Helper()
	var res [][]int
	timeout := time.After(2 * time.Second)
	for {
		select {
		case b, ok := <-ch:
			if !ok {
				return res
			}
			res = append(res, b)
		case <-timeout:
			t.Fatal("выходной канал не закрылся")
		}
	}
}

func TestBatch(t *testing.T) {
	cases := []struct {
		n, size int
		want    string
	}{
		{7, 3, "[[1 2 3] [4 5 6] [7]]"},
		{6, 3, "[[1 2 3] [4 5 6]]"},
		{2, 5, "[[1 2]]"},
		{0, 3, "[]"},
	}
	for _, c := range cases {
		got := collect(t, Batch(feed(c.n), c.size))
		if fmt.Sprint(got) != c.want {
			t.Errorf("Batch(%d элементов, %d) = %v, ожидалось %s", c.n, c.size, got, c.want)
		}
	}
}

func TestBatchIndependent(t *testing.T) {
	got := collect(t, Batch(feed(4), 2))
	if len(got) != 2 {
		t.Fatalf("ожидалось 2 пачки: %v", got)
	}
	got[0] = append(got[0], 99)
	got[0][0] = 100
	if got[1][0] != 3 {
		t.Errorf("пачки разделяют память: %v", got)
	}
}
