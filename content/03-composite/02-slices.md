---
id: slices
title: Срезы (slices)
summary: создание срезов, len и cap, append, make, copy, срезы срезов, пакет slices
xp: 25
---
## Срез — окно в массив

Срез `[]T` — это динамическая последовательность. В отличие от массива, длина не входит в тип.

```go
var s []int              // nil-срез: len 0, cap 0, s == nil
s = []int{1, 2, 3}       // литерал
s = make([]int, 3)       // [0 0 0], len 3, cap 3
s = make([]int, 0, 10)   // пустой, но с запасом ёмкости 10
```

- `len(s)` — количество элементов;
- `cap(s)` — сколько элементов поместится без перевыделения памяти.

## append

`append` добавляет элементы и **возвращает** (возможно, новый) срез. Результат обязательно присваивают:

```go
s := []int{1, 2}
s = append(s, 3)        // [1 2 3]
s = append(s, 4, 5, 6)  // несколько
other := []int{7, 8}
s = append(s, other...) // другой срез
```

Если ёмкости не хватает, `append` выделяет новый массив большего размера (примерно ×2 для маленьких срезов, ×1.25 для больших) и копирует туда данные.

## Взятие среза `s[low:high]`

```go
a := []int{0, 1, 2, 3, 4, 5}
a[1:4] // [1 2 3] — high не включается
a[:3]  // [0 1 2]
a[3:]  // [3 4 5]
a[:]   // весь срез
```

Подсрез **разделяет память** с исходным срезом — изменение элемента видно в обоих (подробно — в следующем уроке).

## copy

`copy(dst, src)` копирует `min(len(dst), len(src))` элементов и возвращает их количество:

```go
src := []int{1, 2, 3}
dst := make([]int, len(src))
n := copy(dst, src) // n == 3, dst — независимая копия
```

Клонировать срез короче: `clone := slices.Clone(src)` или `append([]int(nil), src...)`.

## Типичные операции

```go
// удалить элемент i (порядок сохраняется)
s = append(s[:i], s[i+1:]...)
// удалить без сохранения порядка — O(1)
s[i] = s[len(s)-1]
s = s[:len(s)-1]
// вставить x на позицию i
s = slices.Insert(s, i, x)
// стек
s = append(s, x)           // push
top := s[len(s)-1]         // peek
s = s[:len(s)-1]           // pop
```

## Пакет slices (Go 1.21+)

```go
import "slices"

slices.Contains(s, 3)       // true/false
slices.Index(s, 3)          // индекс или -1
slices.Sort(s)              // сортировка по возрастанию
slices.Reverse(s)
slices.Max(s); slices.Min(s)
slices.Equal(a, b)
```

## nil-срез и пустой срез

```go
var a []int     // nil
b := []int{}    // не nil, но пустой
fmt.Println(a == nil, b == nil, len(a), len(b)) // true false 0 0
```

Оба можно передавать в `len`, `range`, `append`. Различие заметно при сериализации JSON: `nil` → `null`, пустой → `[]`.

> **Совет:** если заранее известен итоговый размер, создавайте срез с ёмкостью: `make([]T, 0, n)`. Это избавляет от лишних перевыделений.

@@ quiz
@@ q
Что выведет код?
```go
s := make([]int, 3, 10)
s = append(s, 1)
fmt.Println(len(s), cap(s), s)
```
- [ ] `1 10 [1]`
- [x] `4 10 [0 0 0 1]`
- [ ] `4 4 [0 0 0 1]`
- [ ] `3 10 [1 0 0]`
@@ explain
`make([]int, 3, 10)` создаёт три нулевых элемента. `append` дописывает после них. Ёмкости хватает — cap остаётся 10.

@@ q
Что выведет код?
```go
var s []int
fmt.Println(s == nil, len(s))
s = append(s, 1)
fmt.Println(s)
```
- [ ] Паника при append к nil-срезу
- [x] `true 0`, затем `[1]`
- [ ] `false 0`, затем `[1]`
@@ explain
nil-срез — валидный пустой срез. `append` к нему выделит новый массив.

@@ q
Сколько элементов скопирует `copy(dst, src)`, если `len(dst) == 2`, `len(src) == 5`?
- [x] 2
- [ ] 5
- [ ] 0 — нужен одинаковый размер
- [ ] Паника
@@ explain
`copy` копирует минимум из двух длин и никогда не расширяет `dst`.

@@ task remove | Удаление и разворот | xp=40
Реализуйте:

- `RemoveAt(s []int, i int) []int` — возвращает срез без элемента с индексом `i`, **сохраняя порядок**. Если `i` вне диапазона — вернуть `s` без изменений.
- `Reverse(s []int)` — разворачивает срез **на месте** (без выделения нового).
@@ hint
`append(s[:i], s[i+1:]...)` сдвигает хвост влево.
@@ hint
Для разворота используйте два индекса: `for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 { s[i], s[j] = s[j], s[i] }`.
@@ starter
package main

import "fmt"

func RemoveAt(s []int, i int) []int {
	return s
}

func Reverse(s []int) {
}

func main() {
	s := []int{1, 2, 3, 4}
	s = RemoveAt(s, 1)
	Reverse(s)
	fmt.Println(s)
}
@@ solution
package main

import "fmt"

func RemoveAt(s []int, i int) []int {
	if i < 0 || i >= len(s) {
		return s
	}
	return append(s[:i], s[i+1:]...)
}

func Reverse(s []int) {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
}

func main() {
	s := []int{1, 2, 3, 4}
	s = RemoveAt(s, 1)
	Reverse(s)
	fmt.Println(s)
}
@@ test
package main

import (
	"slices"
	"testing"
)

func TestRemoveAt(t *testing.T) {
	cases := []struct {
		in   []int
		i    int
		want []int
	}{
		{[]int{1, 2, 3, 4}, 1, []int{1, 3, 4}},
		{[]int{1, 2, 3, 4}, 0, []int{2, 3, 4}},
		{[]int{1, 2, 3, 4}, 3, []int{1, 2, 3}},
		{[]int{1}, 0, []int{}},
		{[]int{1, 2}, 5, []int{1, 2}},
		{[]int{1, 2}, -1, []int{1, 2}},
	}
	for _, c := range cases {
		in := slices.Clone(c.in)
		if got := RemoveAt(in, c.i); !slices.Equal(got, c.want) {
			t.Errorf("RemoveAt(%v, %d) = %v, ожидалось %v", c.in, c.i, got, c.want)
		}
	}
}

func TestReverse(t *testing.T) {
	for _, c := range [][2][]int{
		{{1, 2, 3, 4}, {4, 3, 2, 1}},
		{{1, 2, 3}, {3, 2, 1}},
		{{7}, {7}},
		{{}, {}},
	} {
		s := slices.Clone(c[0])
		Reverse(s)
		if !slices.Equal(s, c[1]) {
			t.Errorf("Reverse(%v) → %v, ожидалось %v", c[0], s, c[1])
		}
	}
}

@@ task filter-evens | Фильтр без лишних аллокаций | xp=50 interview
Реализуйте `FilterInPlace(s []int, keep func(int) bool) []int` — оставляет только элементы, для которых `keep` вернула `true`, **переиспользуя память исходного среза** (без `make` и без нового массива). Порядок сохраняется.

Это популярный приём: `out := s[:0]` — срез нулевой длины, который указывает на тот же массив.
@@ hint
`out := s[:0]`, затем в цикле `if keep(v) { out = append(out, v) }`. `append` будет писать в тот же массив, ведь ёмкости хватает.
@@ hint
Записываемый индекс никогда не обгоняет читаемый, поэтому перезапись безопасна.
@@ starter
package main

import "fmt"

func FilterInPlace(s []int, keep func(int) bool) []int {
	var out []int
	for _, v := range s {
		if keep(v) {
			out = append(out, v)
		}
	}
	return out
}

func main() {
	s := []int{1, 2, 3, 4, 5, 6}
	fmt.Println(FilterInPlace(s, func(x int) bool { return x%2 == 0 }))
}
@@ solution
package main

import "fmt"

func FilterInPlace(s []int, keep func(int) bool) []int {
	out := s[:0]
	for _, v := range s {
		if keep(v) {
			out = append(out, v)
		}
	}
	return out
}

func main() {
	s := []int{1, 2, 3, 4, 5, 6}
	fmt.Println(FilterInPlace(s, func(x int) bool { return x%2 == 0 }))
}
@@ test
package main

import (
	"slices"
	"testing"
)

func TestFilterInPlace(t *testing.T) {
	s := []int{1, 2, 3, 4, 5, 6, 8}
	got := FilterInPlace(s, func(x int) bool { return x%2 == 0 })
	if !slices.Equal(got, []int{2, 4, 6, 8}) {
		t.Fatalf("результат %v, ожидалось [2 4 6 8]", got)
	}
	if &got[0] != &s[0] {
		t.Errorf("результат должен использовать память исходного среза (out := s[:0])")
	}
	if got := FilterInPlace([]int{1, 3}, func(x int) bool { return x%2 == 0 }); len(got) != 0 {
		t.Errorf("ожидался пустой срез, получено %v", got)
	}
	allocs := testing.AllocsPerRun(100, func() {
		buf := []int{1, 2, 3, 4, 5, 6, 7, 8}
		FilterInPlace(buf[:], func(x int) bool { return x > 2 })
	})
	if allocs > 1 {
		t.Errorf("слишком много аллокаций: %.0f", allocs)
	}
}
