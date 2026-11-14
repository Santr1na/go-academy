---
id: pipeline
title: "Паттерны: pipeline, fan-out и fan-in"
summary: конвейеры из стадий, распараллеливание стадии, слияние каналов, отмена через done-канал
xp: 40
---
## Pipeline (конвейер)

Конвейер — цепочка **стадий**, соединённых каналами. Каждая стадия — горутина (или группа), которая читает из входного канала, обрабатывает и пишет в выходной:

```go
func gen(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

func sq(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			out <- n * n
		}
	}()
	return out
}

for v := range sq(sq(gen(1, 2, 3))) {
	fmt.Println(v) // 1 16 81
}
```

Правила стадии:

1. стадия **владеет** своим выходным каналом: создаёт и закрывает его;
2. закрывает выход, когда вход исчерпан (`defer close(out)`);
3. возвращает канал «только для чтения» `<-chan T`.

## Fan-out

Медленную стадию можно распараллелить: несколько горутин читают **один и тот же** входной канал. Каждое значение получит ровно одна из них.

```go
in := gen(1, 2, 3, 4, 5, 6)
c1 := sq(in)
c2 := sq(in) // обе стадии конкурируют за значения из in
```

## Fan-in

Слияние нескольких каналов в один. Канонический вариант с WaitGroup — работает для любого числа входов:

```go
func merge(cs ...<-chan int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup
	for _, c := range cs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for v := range c {
				out <- v
			}
		}()
	}
	go func() {
		wg.Wait()   // все входы исчерпаны
		close(out)
	}()
	return out
}
```

## Отмена: done-канал

Если потребитель прекратил чтение раньше времени, стадии зависнут на отправке — утечка. Решение: передавать сигнал отмены и использовать `select` при каждой отправке:

```go
func sq(done <-chan struct{}, in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			select {
			case out <- n * n:
			case <-done:
				return
			}
		}
	}()
	return out
}

done := make(chan struct{})
defer close(done) // при выходе все стадии завершатся
```

В современном коде вместо `done` используют `context.Context` — `<-ctx.Done()` (следующий урок).

## Порядок

Fan-out/fan-in **не сохраняет** порядок. Если он важен — нумеруйте элементы и сортируйте/собирайте по индексу на выходе.

@@ quiz
@@ q
Кто должен закрывать выходной канал стадии конвейера?
- [x] Сама стадия, когда входные данные закончились
- [ ] Следующая стадия
- [ ] Функция main
@@ explain
Стадия — единственный отправитель в свой выходной канал, поэтому именно она закрывает его (обычно через `defer close(out)`).

@@ q
Почему в `merge` закрытие `out` вынесено в отдельную горутину с `wg.Wait()`?
- [ ] Чтобы ускорить слияние
- [x] `merge` должна сразу вернуть канал, а закрыть его можно только после завершения всех копирующих горутин
- [ ] Так требует компилятор
@@ explain
Если ждать в самой функции, она не вернёт канал до окончания работы, а горутины заблокируются на отправке в `out`, который никто не читает, — deadlock.

@@ q
Две горутины-воркера читают один канал (fan-out). Сколько раз будет получено каждое значение?
- [ ] Дважды — каждой горутиной
- [x] Ровно один раз — одной из горутин
- [ ] Зависит от размера буфера
@@ explain
Получение из канала конкурентное: значение достаётся ровно одному получателю. Канал — не широковещательная рассылка (кроме сигнала `close`).

@@ task merge | Fan-in: слияние N каналов | xp=60 interview
Реализуйте `Merge(chans ...<-chan int) <-chan int` — сливает любое количество каналов в один. Выходной канал закрывается, когда закрыты **все** входные. При вызове без аргументов возвращается сразу закрытый канал.
@@ hint
На каждый входной канал — горутина, копирующая значения в `out`; учёт через `sync.WaitGroup`.
@@ hint
Отдельная горутина: `wg.Wait(); close(out)`. Без аргументов WaitGroup пуст, и канал закроется сразу.
@@ starter
package main

import "fmt"

func Merge(chans ...<-chan int) <-chan int {
	out := make(chan int)
	return out
}

func main() {
	fmt.Println("Merge")
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

func Merge(chans ...<-chan int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup
	for _, c := range chans {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for v := range c {
				out <- v
			}
		}()
	}
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

func gen(vals ...int) <-chan int {
	ch := make(chan int)
	go func() {
		defer close(ch)
		for _, v := range vals {
			ch <- v
		}
	}()
	return ch
}

func main() {
	for v := range Merge(gen(1, 2), gen(3), gen(4, 5, 6)) {
		fmt.Print(v, " ")
	}
	fmt.Println()
}
@@ test
package main

import (
	"slices"
	"testing"
	"time"
)

func source(vals ...int) <-chan int {
	ch := make(chan int)
	go func() {
		defer close(ch)
		for _, v := range vals {
			ch <- v
		}
	}()
	return ch
}

func readAll(t *testing.T, ch <-chan int) []int {
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
			t.Fatalf("канал не закрылся, получено %v", res)
		}
	}
}

func TestMerge(t *testing.T) {
	got := readAll(t, Merge(source(1, 2), source(3), source(), source(4, 5, 6)))
	if !slices.Equal(got, []int{1, 2, 3, 4, 5, 6}) {
		t.Errorf("получено %v", got)
	}
	if got := readAll(t, Merge()); len(got) != 0 {
		t.Errorf("Merge() должен вернуть закрытый пустой канал")
	}
	var many []<-chan int
	want := 0
	for i := 0; i < 50; i++ {
		many = append(many, source(i, i+1000))
		want += 2
	}
	if got := readAll(t, Merge(many...)); len(got) != want {
		t.Errorf("50 каналов: получено %d значений, ожидалось %d", len(got), want)
	}
}

@@ task fan-out | Fan-out + fan-in конвейер | xp=70 interview
Соберите конвейер:

1. `Gen(nums ...int) <-chan int` — источник;
2. `FanOut(in <-chan int, workers int, f func(int) int) <-chan int` — запускает `workers` горутин, каждая читает из **общего** `in` и пишет `f(v)` в общий выходной канал; выход закрывается, когда все воркеры закончили.

Порядок результатов не важен, но каждое значение должно быть обработано ровно один раз. Тест проверит, что работа действительно идёт параллельно.
@@ hint
`FanOut` похож на worker pool: `for range workers { wg.Add(1); go func() { defer wg.Done(); for v := range in { out <- f(v) } }() }`.
@@ hint
Закройте `out` в отдельной горутине после `wg.Wait()`.
@@ starter
package main

import "fmt"

func Gen(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

func FanOut(in <-chan int, workers int, f func(int) int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for v := range in {
			out <- f(v)
		}
	}()
	return out
}

func main() {
	for v := range FanOut(Gen(1, 2, 3), 2, func(x int) int { return x * 10 }) {
		fmt.Println(v)
	}
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

func Gen(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

func FanOut(in <-chan int, workers int, f func(int) int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup
	for range max(workers, 1) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for v := range in {
				out <- f(v)
			}
		}()
	}
	go func() {
		wg.Wait()
		close(out)
	}()
	return out
}

func main() {
	for v := range FanOut(Gen(1, 2, 3), 2, func(x int) int { return x * 10 }) {
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

func TestFanOut(t *testing.T) {
	nums := make([]int, 40)
	for i := range nums {
		nums[i] = i
	}
	start := time.Now()
	out := FanOut(Gen(nums...), 8, func(x int) int {
		time.Sleep(25 * time.Millisecond)
		return x * x
	})
	var got []int
	timeout := time.After(5 * time.Second)
loop:
	for {
		select {
		case v, ok := <-out:
			if !ok {
				break loop
			}
			got = append(got, v)
		case <-timeout:
			t.Fatal("канал не закрылся")
		}
	}
	elapsed := time.Since(start)
	slices.Sort(got)
	if len(got) != 40 {
		t.Fatalf("получено %d значений, ожидалось 40", len(got))
	}
	for i, v := range got {
		if v != i*i {
			t.Fatalf("неверное значение %d на позиции %d", v, i)
		}
	}
	if elapsed > 600*time.Millisecond {
		t.Errorf("заняло %v — похоже, воркер только один (последовательно ~1с, с 8 воркерами ~125мс)", elapsed)
	}
}
