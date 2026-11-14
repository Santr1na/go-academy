---
id: functions
title: Функции
summary: параметры, множественный возврат, именованные результаты, variadic-функции, передача по значению
xp: 25
---
## Объявление

```go
func add(a int, b int) int {
	return a + b
}

func mul(a, b int) int { // одинаковые типы можно объединить
	return a * b
}
```

## Множественный возврат

Функция может вернуть несколько значений. Это основа обработки ошибок в Go:

```go
func divmod(a, b int) (int, int) {
	return a / b, a % b
}

q, r := divmod(17, 5) // 3 2
_, r = divmod(9, 4)   // игнорируем частное
```

Идиома **«значение + ошибка»** / **«значение + ok»**:

```go
func safeDiv(a, b int) (int, error) {
	if b == 0 {
		return 0, errors.New("деление на ноль")
	}
	return a / b, nil
}
```

## Именованные результаты

Результатам можно дать имена — они становятся переменными, инициализированными нулевыми значениями. «Голый» `return` возвращает их текущие значения:

```go
func split(sum int) (x, y int) {
	x = sum * 4 / 9
	y = sum - x
	return // вернёт x, y
}
```

> **Совет:** голый `return` удобен в коротких функциях и вместе с `defer`, но в длинных функциях ухудшает читаемость.

## Variadic-функции

Последний параметр может принимать любое число аргументов. Внутри функции это срез:

```go
func sum(nums ...int) int {
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

sum()           // 0
sum(1, 2, 3)    // 6
xs := []int{4, 5}
sum(xs...)      // распаковка среза: 9
```

`fmt.Println(a ...any)` — тоже variadic-функция.

> **Ловушка:** при вызове `f(xs...)` срез передаётся **без копирования** — функция может изменить элементы исходного среза.

## Передача по значению

В Go **всё передаётся по значению** — функция получает копию аргумента. Для `int`, `string`, структур и массивов это настоящая копия. Срезы, map, каналы и указатели — небольшие «заголовки», которые ссылаются на общие данные, поэтому через них функция может менять данные вызывающего.

```go
func inc(x int)      { x++ }   // меняет копию
func incP(x *int)    { *x++ }  // меняет оригинал через указатель

n := 1
inc(n)   // n == 1
incP(&n) // n == 2
```

## Функции — значения первого класса

```go
var op func(int, int) int = add
fmt.Println(op(2, 3)) // 5

func apply(xs []int, f func(int) int) []int { ... }
```

В Go нет перегрузки функций и параметров по умолчанию.

@@ quiz
@@ q
Что выведет код?
```go
func f() (x int) {
	x = 5
	return
}
fmt.Println(f())
```
- [ ] 0
- [x] 5
- [ ] Ошибка компиляции: return без значения
@@ explain
Именованный результат `x` — обычная переменная. Голый `return` возвращает её текущее значение 5.

@@ q
Как передать срез `xs` в функцию `func sum(nums ...int) int`?
- [ ] `sum(xs)`
- [x] `sum(xs...)`
- [ ] `sum(...xs)`
- [ ] `sum(*xs)`
@@ explain
Распаковка среза в variadic-параметр записывается через `...` после аргумента.

@@ q
Что выведет код?
```go
func change(xs []int) { xs[0] = 100 }
func main() {
	a := []int{1, 2, 3}
	change(a)
	fmt.Println(a[0])
}
```
- [ ] 1
- [x] 100
- [ ] Ошибка компиляции
@@ explain
Срез передаётся по значению, но копируется только его заголовок (указатель, длина, ёмкость). Указатель ведёт к тому же массиву, поэтому изменение элемента видно снаружи.

@@ task minmax | MinMax с variadic | xp=40
Реализуйте `MinMax(nums ...int) (min, max int, ok bool)`, которая возвращает минимум и максимум среди аргументов. Если аргументов нет, верните `0, 0, false`.

Используйте именованные результаты.
@@ hint
Если `len(nums) == 0` — сразу `return` (все результаты нулевые).
@@ hint
Инициализируйте `min, max = nums[0], nums[0]` и пройдите по остальным элементам. Внутри функции имена `min` и `max` затеняют встроенные функции — это допустимо.
@@ starter
package main

import "fmt"

func MinMax(nums ...int) (min, max int, ok bool) {
	return
}

func main() {
	fmt.Println(MinMax(3, -1, 7, 2))
}
@@ solution
package main

import "fmt"

func MinMax(nums ...int) (min, max int, ok bool) {
	if len(nums) == 0 {
		return
	}
	min, max = nums[0], nums[0]
	for _, n := range nums[1:] {
		if n < min {
			min = n
		}
		if n > max {
			max = n
		}
	}
	return min, max, true
}

func main() {
	fmt.Println(MinMax(3, -1, 7, 2))
}
@@ test
package main

import "testing"

func TestMinMax(t *testing.T) {
	if a, b, ok := MinMax(); ok || a != 0 || b != 0 {
		t.Errorf("MinMax() = %d, %d, %v; ожидалось 0, 0, false", a, b, ok)
	}
	if a, b, ok := MinMax(5); !ok || a != 5 || b != 5 {
		t.Errorf("MinMax(5) = %d, %d, %v; ожидалось 5, 5, true", a, b, ok)
	}
	xs := []int{3, -1, 7, 2, -10, 7}
	if a, b, ok := MinMax(xs...); !ok || a != -10 || b != 7 {
		t.Errorf("MinMax(%v) = %d, %d, %v; ожидалось -10, 7, true", xs, a, b, ok)
	}
	if a, b, _ := MinMax(-5, -3, -9); a != -9 || b != -3 {
		t.Errorf("MinMax(-5, -3, -9) = %d, %d; ожидалось -9, -3", a, b)
	}
}

@@ task divide | Безопасное деление | xp=40
Реализуйте `Divide(a, b int) (int, error)`:

- если `b == 0`, верните `0` и ошибку с текстом `"division by zero"` (используйте `errors.New`);
- иначе — частное и `nil`.

И `ApplyAll(x int, fns ...func(int) int) int` — последовательно применяет функции к `x`: `ApplyAll(2, inc, double)` = `double(inc(2))` = 6.
@@ hint
`import "errors"` и `return 0, errors.New("division by zero")`.
@@ hint
В `ApplyAll`: `for _, f := range fns { x = f(x) }`.
@@ starter
package main

import "fmt"

func Divide(a, b int) (int, error) {
	return a / b, nil
}

func ApplyAll(x int, fns ...func(int) int) int {
	return x
}

func main() {
	fmt.Println(Divide(10, 2))
}
@@ solution
package main

import (
	"errors"
	"fmt"
)

func Divide(a, b int) (int, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	return a / b, nil
}

func ApplyAll(x int, fns ...func(int) int) int {
	for _, f := range fns {
		x = f(x)
	}
	return x
}

func main() {
	fmt.Println(Divide(10, 2))
	fmt.Println(Divide(1, 0))
}
@@ test
package main

import "testing"

func TestDivide(t *testing.T) {
	if q, err := Divide(10, 3); q != 3 || err != nil {
		t.Errorf("Divide(10, 3) = %d, %v; ожидалось 3, nil", q, err)
	}
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Errorf("Divide(1, 0) вызвала панику: %v", r)
			}
		}()
		q, err := Divide(1, 0)
		if err == nil || err.Error() != "division by zero" || q != 0 {
			t.Errorf("Divide(1, 0) = %d, %v; ожидалось 0, division by zero", q, err)
		}
	}()
}

func TestApplyAll(t *testing.T) {
	inc := func(x int) int { return x + 1 }
	double := func(x int) int { return x * 2 }
	if got := ApplyAll(2, inc, double); got != 6 {
		t.Errorf("ApplyAll(2, inc, double) = %d, ожидалось 6", got)
	}
	if got := ApplyAll(2, double, inc, inc); got != 6 {
		t.Errorf("ApplyAll(2, double, inc, inc) = %d, ожидалось 6", got)
	}
	if got := ApplyAll(7); got != 7 {
		t.Errorf("ApplyAll(7) = %d, ожидалось 7", got)
	}
}
