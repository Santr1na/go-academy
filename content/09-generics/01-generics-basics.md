---
id: generics-basics
title: Параметры типов и ограничения
summary: обобщённые функции, constraints, any, comparable, cmp.Ordered, ~ и множества типов, вывод типов
xp: 40
---
## Зачем generics

До Go 1.18 функцию «максимум» приходилось писать для каждого типа (`MaxInt`, `MaxFloat64`) или использовать `any` и терять типобезопасность. **Параметры типов** решают это:

```go
func Max[T cmp.Ordered](a, b T) T {
	if a > b {
		return a
	}
	return b
}

Max(3, 7)          // T выведен как int
Max("go", "rust")  // T = string
Max[float64](2, 3.5) // явное указание
```

## Ограничения (constraints)

Ограничение — это **интерфейс**, описывающий допустимые типы. Оно определяет, какие операции разрешены над `T`:

```go
func Sum[T int | int64 | float64](xs []T) T { // объединение типов
	var s T
	for _, x := range xs {
		s += x // + разрешён: все типы из набора его поддерживают
	}
	return s
}
```

Встроенные и стандартные ограничения:

| Ограничение | Смысл |
|---|---|
| `any` | любой тип; доступны только присваивание, передача, `==` недоступен |
| `comparable` | типы с `==` и `!=` (ключи map) |
| `cmp.Ordered` | типы с `< <= > >=`: целые, float, string |

## Тильда: базовый тип

`~int` означает «любой тип, **базовый** тип которого — int», включая пользовательские:

```go
type Number interface {
	~int | ~int32 | ~int64 | ~float32 | ~float64
}

type Celsius float64

func Avg[T Number](xs []T) T { ... }
Avg([]Celsius{20, 25}) // работает благодаря ~float64
```

Без тильды `Celsius` не подошёл бы под `float64`.

## Ограничения с методами

```go
type Stringer interface{ String() string }

func Join[T Stringer](xs []T, sep string) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = x.String()
	}
	return strings.Join(parts, sep)
}
```

## Несколько параметров

```go
func Map[T, U any](xs []T, f func(T) U) []U {
	res := make([]U, 0, len(xs))
	for _, x := range xs {
		res = append(res, f(x))
	}
	return res
}

lens := Map([]string{"a", "bcd"}, func(s string) int { return len(s) }) // []int{1, 3}
```

## Ограничения generics в Go

- у **методов** не может быть собственных параметров типов (только у типа-получателя);
- нет специализации и перегрузки;
- нельзя использовать type switch по `T` напрямую (можно через `any(x).(type)`);
- generics не всегда быстрее интерфейсов — компилятор использует «GC shape stenciling».

> **Совет:** не обобщайте преждевременно. Пишите generic-код, когда видите одинаковую логику для разных типов: контейнеры, утилиты над срезами и map, алгоритмы.

Многие задачи уже решены в стандартной библиотеке: пакеты `slices`, `maps`, `cmp`.

## Разбираем подробнее: что такое параметр типа

Посмотрите на две функции:

```go
func MaxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func MaxFloat(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
```

Тела одинаковые до буквы, отличается только тип. Generics позволяют написать функцию один раз, а тип сделать **параметром** — таким же, как обычный параметр, только подставляется он на этапе компиляции:

```go
func Max[T int | float64](a, b T) T {
	if a > b {
		return a
	}
	return b
}
```

В квадратных скобках объявлен параметр типа `T` и его **ограничение**: `T` может быть `int` или `float64`. Ограничение отвечает на вопрос «что функции разрешено делать со значениями типа `T`». Здесь оба допустимых типа умеют `>`, поэтому сравнение разрешено.

### Как компилятор подбирает T

```go
Max(3, 7)         // T = int — выведен из аргументов
Max(1.5, 2.5)     // T = float64
Max[float64](1, 2) // T задан явно
Max(1, 2.5)       // T = float64: это константы, они подстраиваются
```

А вот с переменными разных типов так не получится:

```go
var i int = 1
var f float64 = 2.5
Max(i, f) // ошибка: type float64 of f does not match inferred type int for T
```

Оба аргумента должны быть **одного** типа `T`. Go ничего не приводит автоматически — ни в обычном коде, ни в обобщённом.

Если `T` не встречается в параметрах, вывести его не из чего — придётся указать явно:

```go
func Zero[T any]() T {
	var z T
	return z
}

x := Zero()      // ошибка: cannot infer T
y := Zero[int]() // 0
```

### any не умеет почти ничего

```go
func Eq[T any](a, b T) bool {
	return a == b // ошибка: incomparable types in type set
}
```

`any` означает «любой тип вообще» — а среди любых есть срезы и map, которые сравнивать нельзя. Компилятор разрешает только те операции, которые поддерживают **все** типы из ограничения. Чтобы использовать `==`, нужно ограничение `comparable`:

```go
func Eq[T comparable](a, b T) bool { return a == b }
```

| Ограничение | Что можно делать с `T` |
|---|---|
| `any` | присваивать, передавать, хранить |
| `comparable` | плюс `==` и `!=`, использовать как ключ map |
| `cmp.Ordered` | плюс `<`, `>`, `<=`, `>=` |
| `int \| float64` | всё, что умеют оба типа: арифметика, сравнение |
| интерфейс с методами | вызывать эти методы |

### Нулевое значение неизвестного типа

Внутри обобщённой функции нельзя написать `return 0` или `return ""` — неизвестно, что такое `T`. Нулевое значение получают через объявление переменной:

```go
func First[T any](xs []T) (T, bool) {
	var zero T // 0 для чисел, "" для строк, nil для указателей…
	if len(xs) == 0 {
		return zero, false
	}
	return xs[0], true
}

v, ok := First([]string{})
fmt.Printf("%q %v\n", v, ok) // "" false
```

### Когда generics нужны, а когда нет

**Нужны:** контейнеры и структуры данных (стек, очередь, множество, кэш), функции над срезами и map (`Map`, `Filter`, `Keys`), алгоритмы, одинаковые для разных типов (`Max`, `Sum`, сортировка).

**Не нужны:** когда достаточно обычного интерфейса. Если функция только вызывает методы (`w.Write(...)`), параметр типа ничего не даёт — берите `io.Writer`. Правило из практики: начинайте с конкретных типов и вводите generics, когда увидели, что пишете один и тот же код в третий раз.

@@ quiz
@@ q
Какое ограничение нужно, чтобы использовать `T` как ключ map?
- [ ] `any`
- [x] `comparable`
- [ ] `cmp.Ordered`
@@ explain
Ключ map должен поддерживать `==`. Ограничение `comparable` гарантирует это.

@@ q
`type MyInt int`. Подходит ли `MyInt` под ограничение `interface{ int | int64 }`?
- [ ] Да
- [x] Нет, нужно `~int`
@@ explain
Без тильды набор содержит только сам тип `int`. `~int` включает все типы с базовым типом int.

@@ q
Скомпилируется ли код?
```go
type Box struct{ v any }
func (b Box) Get[T any]() T { return b.v.(T) }
```
- [ ] Да
- [x] Нет: методы не могут иметь собственных параметров типов
@@ explain
В Go параметры типов могут быть у функций и у типов. Метод может использовать параметры своего типа-получателя, но не объявлять новые.

@@ q
Что выведет код?
```go
func Max[T int | float64](a, b T) T {
	if a > b {
		return a
	}
	return b
}

func main() {
	fmt.Println(Max(1, 2.5))
}
```
- [ ] Ошибка компиляции: аргументы разных типов
- [ ] `2`
- [x] `2.5`
- [ ] `3`
@@ explain
`1` и `2.5` — нетипизированные константы. Компилятор подбирает тип, подходящий обеим: `float64`. А вот с **переменными** `int` и `float64` тот же вызов не скомпилировался бы — автоматического приведения нет.

@@ q
Скомпилируется ли код?
```go
func Eq[T any](a, b T) bool { return a == b }
```
- [ ] Да
- [x] Нет: для `==` нужно ограничение `comparable`
- [ ] Да, но будет паника для срезов
- [ ] Нет: обобщённая функция не может возвращать `bool`
@@ explain
Под `any` подходят и несравнимые типы — срезы, map, функции. Компилятор разрешает только операции, доступные всем типам из ограничения, поэтому `==` с `any` запрещён.

@@ q
Скомпилируется ли вызов?
```go
func Zero[T any]() T {
	var z T
	return z
}

func main() {
	x := Zero()
	fmt.Println(x)
}
```
- [ ] Да, выведет `0`
- [ ] Да, выведет `<nil>`
- [x] Нет: компилятору не из чего вывести `T`
- [ ] Скомпилируется, но будет паника
@@ explain
Тип выводится из аргументов функции. У `Zero` аргументов нет, поэтому `T` нужно указать явно: `Zero[int]()`.

@@ q
Что выведет код?
```go
func First[T any](xs []T) (T, bool) {
	var zero T
	if len(xs) == 0 {
		return zero, false
	}
	return xs[0], true
}

func main() {
	v, ok := First([]string{})
	fmt.Printf("%q %v\n", v, ok)
}
```
- [ ] `<nil> false`
- [x] `"" false`
- [ ] Паника: срез пуст
- [ ] Ошибка компиляции: `T` нельзя объявить без значения
@@ explain
`var zero T` даёт нулевое значение того типа, которым стал `T`. Здесь `T` — `string`, его нулевое значение — пустая строка. Это стандартный способ вернуть «ничего» из обобщённой функции.

@@ task map-filter-reduce | Map, Filter, Reduce | xp=60 interview
Реализуйте обобщённые функции:

```go
func Map[T, U any](xs []T, f func(T) U) []U
func Filter[T any](xs []T, keep func(T) bool) []T
func Reduce[T, A any](xs []T, init A, f func(A, T) A) A
```

Пример: сумма квадратов чётных чисел:
`Reduce(Map(Filter(nums, isEven), square), 0, add)`.

`Map` и `Filter` должны возвращать **новый** срез, не изменяя исходный; для пустого входа — пустой (не nil) срез.
@@ hint
`res := make([]U, 0, len(xs))` и `append` в цикле.
@@ hint
`Reduce`: `acc := init; for _, x := range xs { acc = f(acc, x) }; return acc`.
@@ starter
package main

import "fmt"

func Map[T, U any](xs []T, f func(T) U) []U {
	return nil
}

func Filter[T any](xs []T, keep func(T) bool) []T {
	return xs
}

func Reduce[T, A any](xs []T, init A, f func(A, T) A) A {
	return init
}

func main() {
	fmt.Println(Map([]int{1, 2, 3}, func(x int) string { return fmt.Sprint(x * x) }))
}
@@ solution
package main

import "fmt"

func Map[T, U any](xs []T, f func(T) U) []U {
	res := make([]U, 0, len(xs))
	for _, x := range xs {
		res = append(res, f(x))
	}
	return res
}

func Filter[T any](xs []T, keep func(T) bool) []T {
	res := make([]T, 0, len(xs))
	for _, x := range xs {
		if keep(x) {
			res = append(res, x)
		}
	}
	return res
}

func Reduce[T, A any](xs []T, init A, f func(A, T) A) A {
	acc := init
	for _, x := range xs {
		acc = f(acc, x)
	}
	return acc
}

func main() {
	fmt.Println(Map([]int{1, 2, 3}, func(x int) string { return fmt.Sprint(x * x) }))
}
@@ test
package main

import (
	"fmt"
	"strings"
	"testing"
)

func TestMapFilterReduce(t *testing.T) {
	nums := []int{1, 2, 3, 4, 5, 6}
	even := Filter(nums, func(x int) bool { return x%2 == 0 })
	sq := Map(even, func(x int) int { return x * x })
	sum := Reduce(sq, 0, func(a, x int) int { return a + x })
	if sum != 56 {
		t.Errorf("сумма квадратов чётных = %d, ожидалось 56", sum)
	}
	if fmt.Sprint(nums) != "[1 2 3 4 5 6]" {
		t.Error("исходный срез изменён")
	}
	strs := Map(nums, func(x int) string { return strings.Repeat("*", x) })
	if strs[2] != "***" {
		t.Errorf("Map в другой тип: %v", strs)
	}
	joined := Reduce([]string{"a", "b", "c"}, "", func(acc string, s string) string { return acc + s })
	if joined != "abc" {
		t.Errorf("Reduce строк = %q", joined)
	}
	lenSum := Reduce([]string{"go", "rust"}, 0, func(acc int, s string) int { return acc + len(s) })
	if lenSum != 6 {
		t.Errorf("Reduce с другим типом аккумулятора = %d", lenSum)
	}
	if r := Filter([]int{1, 3}, func(x int) bool { return x > 5 }); r == nil || len(r) != 0 {
		t.Errorf("Filter без совпадений должен вернуть пустой не-nil срез, получено %#v", r)
	}
	if r := Map([]int{}, func(x int) int { return x }); r == nil {
		t.Error("Map пустого среза должен вернуть пустой не-nil срез")
	}
}

@@ task generic-max | MaxBy, GroupBy, Uniq | xp=60
Реализуйте обобщённые утилиты:

```go
// Максимальный элемент по ключу; ok=false для пустого среза.
func MaxBy[T any, K cmp.Ordered](xs []T, key func(T) K) (T, bool)

// Группировка по ключу (порядок внутри группы сохраняется).
func GroupBy[T any, K comparable](xs []T, key func(T) K) map[K][]T

// Уникальные элементы в порядке первого появления.
func Uniq[T comparable](xs []T) []T
```

Подумайте, почему у `MaxBy` ключ — `cmp.Ordered`, а у `GroupBy` достаточно `comparable`.
@@ hint
`MaxBy`: `var zero T; if len(xs) == 0 { return zero, false }`, затем сравнивайте `key(x) > bestKey`.
@@ hint
`Uniq`: используйте `seen := make(map[T]struct{})`.
@@ starter
package main

import (
	"cmp"
	"fmt"
)

func MaxBy[T any, K cmp.Ordered](xs []T, key func(T) K) (T, bool) {
	var zero T
	return zero, false
}

func GroupBy[T any, K comparable](xs []T, key func(T) K) map[K][]T {
	return nil
}

func Uniq[T comparable](xs []T) []T {
	return xs
}

func main() {
	fmt.Println(Uniq([]int{1, 2, 1, 3, 2}))
}
@@ solution
package main

import (
	"cmp"
	"fmt"
)

func MaxBy[T any, K cmp.Ordered](xs []T, key func(T) K) (T, bool) {
	var zero T
	if len(xs) == 0 {
		return zero, false
	}
	best, bestKey := xs[0], key(xs[0])
	for _, x := range xs[1:] {
		if k := key(x); k > bestKey {
			best, bestKey = x, k
		}
	}
	return best, true
}

func GroupBy[T any, K comparable](xs []T, key func(T) K) map[K][]T {
	res := make(map[K][]T)
	for _, x := range xs {
		k := key(x)
		res[k] = append(res[k], x)
	}
	return res
}

func Uniq[T comparable](xs []T) []T {
	seen := make(map[T]struct{}, len(xs))
	res := make([]T, 0, len(xs))
	for _, x := range xs {
		if _, ok := seen[x]; !ok {
			seen[x] = struct{}{}
			res = append(res, x)
		}
	}
	return res
}

func main() {
	fmt.Println(Uniq([]int{1, 2, 1, 3, 2}))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

type user struct {
	Name string
	Age  int
	City string
}

func TestMaxBy(t *testing.T) {
	us := []user{{"a", 30, "M"}, {"b", 45, "S"}, {"c", 45, "M"}, {"d", 20, "K"}}
	u, ok := MaxBy(us, func(u user) int { return u.Age })
	if !ok || u.Name != "b" {
		t.Errorf("MaxBy по возрасту = %v, %v (ожидался первый из максимальных: b)", u, ok)
	}
	s, ok := MaxBy([]string{"go", "javascript", "c"}, func(s string) int { return len(s) })
	if !ok || s != "javascript" {
		t.Errorf("MaxBy строк = %q", s)
	}
	if _, ok := MaxBy([]user{}, func(u user) string { return u.Name }); ok {
		t.Error("для пустого среза ok должен быть false")
	}
}

func TestGroupBy(t *testing.T) {
	us := []user{{"a", 30, "M"}, {"b", 45, "S"}, {"c", 45, "M"}}
	g := GroupBy(us, func(u user) string { return u.City })
	if len(g) != 2 || len(g["M"]) != 2 || g["M"][1].Name != "c" || g["S"][0].Name != "b" {
		t.Errorf("GroupBy = %v", g)
	}
	byLen := GroupBy([]string{"a", "bb", "c"}, func(s string) int { return len(s) })
	if fmt.Sprint(byLen[1]) != "[a c]" {
		t.Errorf("GroupBy по длине = %v", byLen)
	}
}

func TestUniq(t *testing.T) {
	if got := fmt.Sprint(Uniq([]int{3, 1, 3, 2, 1, 3})); got != "[3 1 2]" {
		t.Errorf("Uniq = %s", got)
	}
	if got := fmt.Sprint(Uniq([]string{"x", "x"})); got != "[x]" {
		t.Errorf("Uniq строк = %s", got)
	}
}
