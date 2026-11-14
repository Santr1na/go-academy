---
id: iterators
title: Итераторы и range по функциям
summary: iter.Seq и iter.Seq2, range-over-func (Go 1.23), ленивые последовательности, slices.Collect, maps.Keys
xp: 40
---
## Range по функциям

С Go 1.23 `for range` умеет обходить **функции-итераторы** особого вида:

```go
func(yield func() bool)
func(yield func(V) bool)
func(yield func(K, V) bool)
```

Итератор вызывает `yield` для каждого элемента. Если `yield` вернула `false` (в цикле сработал `break`/`return`), итератор должен **немедленно прекратить** работу.

```go
func Countdown(n int) iter.Seq[int] {
	return func(yield func(int) bool) {
		for i := n; i > 0; i-- {
			if !yield(i) {
				return // потребитель вышел из цикла
			}
		}
	}
}

for v := range Countdown(3) {
	fmt.Println(v) // 3 2 1
}
```

## Пакет iter

```go
type Seq[V any] func(yield func(V) bool)
type Seq2[K, V any] func(yield func(K, V) bool)
```

Стандартная библиотека возвращает итераторы во многих местах:

```go
for k := range maps.Keys(m) { ... }
for i, v := range slices.All(s) { ... }
for v := range slices.Values(s) { ... }

keys := slices.Sorted(maps.Keys(m))   // собрать и отсортировать
vals := slices.Collect(maps.Values(m)) // собрать в срез

for line := range strings.Lines(text) { ... }   // Go 1.24
for part := range strings.SplitSeq(s, ",") { ... }
```

## Ленивость и композиция

Итераторы ленивы: элементы вычисляются по требованию. Можно описывать даже бесконечные последовательности и комбинировать их:

```go
func Naturals() iter.Seq[int] {
	return func(yield func(int) bool) {
		for i := 0; ; i++ {
			if !yield(i) {
				return
			}
		}
	}
}

func Filter[V any](seq iter.Seq[V], keep func(V) bool) iter.Seq[V] {
	return func(yield func(V) bool) {
		for v := range seq {
			if keep(v) && !yield(v) {
				return
			}
		}
	}
}

func Take[V any](seq iter.Seq[V], n int) iter.Seq[V] {
	return func(yield func(V) bool) {
		if n <= 0 {
			return
		}
		i := 0
		for v := range seq {
			if !yield(v) {
				return
			}
			i++
			if i == n {
				return
			}
		}
	}
}

evens := slices.Collect(Take(Filter(Naturals(), isEven), 5)) // [0 2 4 6 8]
```

## Pull-итераторы

`iter.Pull(seq)` превращает «push»-итератор в пару функций `next()` / `stop()` — удобно, когда нужно идти по двум последовательностям одновременно.

> **Ловушка:** вызов `yield` после того, как она вернула `false`, приводит к панике во время выполнения. Всегда проверяйте результат `yield`.

@@ quiz
@@ q
Что должен сделать итератор, если `yield` вернула `false`?
- [ ] Продолжить, пропустив элемент
- [x] Немедленно завершиться
- [ ] Вызвать `yield` ещё раз
@@ explain
`false` означает, что потребитель вышел из цикла (`break`, `return`). Дальнейшие вызовы `yield` вызовут панику.

@@ q
Что вернёт `slices.Sorted(maps.Keys(map[string]int{"b": 1, "a": 2}))`?
- [x] `[a b]`
- [ ] `[1 2]`
- [ ] `[b a]` или `[a b]` случайно
@@ explain
`maps.Keys` возвращает итератор по ключам, `slices.Sorted` собирает их в срез и сортирует.

@@ q
Какой тип имеет итератор по парам «индекс, значение»?
- [ ] `iter.Seq[int]`
- [x] `iter.Seq2[int, V]`
- [ ] `func() (int, V)`
@@ explain
`iter.Seq2[K, V]` — это `func(yield func(K, V) bool)`, используется в `for k, v := range`.

@@ task iter-take | Ленивые последовательности | xp=60
Реализуйте итераторы:

```go
func Fib() iter.Seq[int]                                  // 0, 1, 1, 2, 3, 5, … (бесконечно)
func Take[V any](seq iter.Seq[V], n int) iter.Seq[V]       // первые n элементов
func MapSeq[V, U any](seq iter.Seq[V], f func(V) U) iter.Seq[U]
```

Все итераторы должны корректно останавливаться при `break` в цикле потребителя (проверяйте результат `yield`). `Take` с `n <= 0` не должен запрашивать у источника ни одного элемента.
@@ hint
`Fib`: `return func(yield func(int) bool) { a, b := 0, 1; for { if !yield(a) { return }; a, b = b, a+b } }`.
@@ hint
`Take`: считайте выданные элементы; после n-го — `return`. Не забудьте проверить `!yield(v)`.
@@ starter
package main

import (
	"fmt"
	"iter"
)

func Fib() iter.Seq[int] {
	return func(yield func(int) bool) {}
}

func Take[V any](seq iter.Seq[V], n int) iter.Seq[V] {
	return func(yield func(V) bool) {}
}

func MapSeq[V, U any](seq iter.Seq[V], f func(V) U) iter.Seq[U] {
	return func(yield func(U) bool) {}
}

func main() {
	for v := range Take(Fib(), 10) {
		fmt.Print(v, " ")
	}
	fmt.Println()
}
@@ solution
package main

import (
	"fmt"
	"iter"
)

func Fib() iter.Seq[int] {
	return func(yield func(int) bool) {
		a, b := 0, 1
		for {
			if !yield(a) {
				return
			}
			a, b = b, a+b
		}
	}
}

func Take[V any](seq iter.Seq[V], n int) iter.Seq[V] {
	return func(yield func(V) bool) {
		if n <= 0 {
			return
		}
		i := 0
		for v := range seq {
			if !yield(v) {
				return
			}
			i++
			if i == n {
				return
			}
		}
	}
}

func MapSeq[V, U any](seq iter.Seq[V], f func(V) U) iter.Seq[U] {
	return func(yield func(U) bool) {
		for v := range seq {
			if !yield(f(v)) {
				return
			}
		}
	}
}

func main() {
	for v := range Take(Fib(), 10) {
		fmt.Print(v, " ")
	}
	fmt.Println()
}
@@ test
package main

import (
	"fmt"
	"slices"
	"testing"
)

func TestFibTake(t *testing.T) {
	got := slices.Collect(Take(Fib(), 10))
	if fmt.Sprint(got) != "[0 1 1 2 3 5 8 13 21 34]" {
		t.Errorf("Take(Fib(), 10) = %v", got)
	}
	if got := slices.Collect(Take(Fib(), 0)); len(got) != 0 {
		t.Errorf("Take(..., 0) = %v", got)
	}
}

func TestTakeLazy(t *testing.T) {
	pulled := 0
	src := func(yield func(int) bool) {
		for i := 0; ; i++ {
			pulled++
			if !yield(i) {
				return
			}
		}
	}
	slices.Collect(Take(src, 3))
	if pulled != 3 {
		t.Errorf("Take(3) запросил у источника %d элементов, ожидалось 3", pulled)
	}
	pulled = 0
	slices.Collect(Take(src, 0))
	if pulled != 0 {
		t.Errorf("Take(0) не должен запрашивать элементы, запрошено %d", pulled)
	}
}

func TestMapSeqBreak(t *testing.T) {
	strs := MapSeq(Fib(), func(x int) string { return fmt.Sprint("#", x) })
	var got []string
	for s := range strs {
		if len(got) == 4 {
			break
		}
		got = append(got, s)
	}
	if fmt.Sprint(got) != "[#0 #1 #1 #2]" {
		t.Errorf("MapSeq = %v", got)
	}
}
