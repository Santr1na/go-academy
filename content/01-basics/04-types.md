---
id: types
title: Базовые типы и преобразования
summary: целые и вещественные числа, переполнение, bool, string, byte и rune, явные преобразования
xp: 20
---
## Обзор базовых типов

| Категория | Типы |
|---|---|
| Целые со знаком | `int8`, `int16`, `int32`, `int64`, `int` |
| Целые без знака | `uint8` (= `byte`), `uint16`, `uint32`, `uint64`, `uint`, `uintptr` |
| Вещественные | `float32`, `float64` |
| Комплексные | `complex64`, `complex128` |
| Логический | `bool` |
| Строки | `string` |
| Символ Unicode | `rune` (= `int32`) |

`int` и `uint` имеют размер машинного слова: 64 бита на современных платформах. В большинстве случаев используйте просто `int` и `float64`.

## Явные преобразования

В Go **нет неявных преобразований** между числовыми типами — даже `int` и `int64` нельзя складывать напрямую:

```go
var a int = 10
var b int64 = 20
// c := a + b        // ошибка: mismatched types int and int64
c := int64(a) + b    // ок
f := float64(a) / 3  // 3.3333333333333335
i := int(3.99)       // нельзя для константы, но для переменной — отбрасывает дробную часть
```

Преобразование `float64 → int` **отбрасывает** дробную часть (округление к нулю): `int(-2.7)` → `-2`. Для округления используйте `math.Round`.

## Переполнение

Целые числа переполняются «по кругу» и без паники:

```go
var x uint8 = 255
x++
fmt.Println(x) // 0

var y int8 = 127
y++
fmt.Println(y) // -128
```

## Целочисленное деление

```go
fmt.Println(7 / 2)    // 3 — оба операнда int, дробная часть отбрасывается
fmt.Println(7.0 / 2)  // 3.5
fmt.Println(-7 / 2)   // -3 (округление к нулю)
fmt.Println(-7 % 2)   // -1 (знак остатка = знак делимого)
```

Деление целого на **ноль** во время выполнения вызывает панику. У `float64` деление на ноль даёт `+Inf`, `-Inf` или `NaN`.

## Вещественные числа неточны

```go
fmt.Println(0.1 + 0.2)          // 0.30000000000000004
fmt.Println(0.1+0.2 == 0.3)     // false!
```

Сравнивайте float с допуском (`math.Abs(a-b) < 1e-9`), а деньги храните в целых копейках.

## Строки, byte и rune — кратко

`string` — неизменяемая последовательность байт (обычно UTF-8). `byte` — один байт, `rune` — один символ Unicode. Подробно разберём в модуле «Составные типы».

```go
s := "Go"
fmt.Println(len("Привет")) // 12 — байт, а не символов!
r := 'Ж'                    // rune
fmt.Println(r, string(r))   // 1046 Ж
```

## Свой тип на основе базового

```go
type Celsius float64
type Fahrenheit float64

var t Celsius = 36.6
// var f Fahrenheit = t   // ошибка: разные типы
f := Fahrenheit(t*9/5 + 32)
```

Это помогает компилятору ловить логические ошибки — нельзя случайно сложить градусы с метрами.

@@ quiz
@@ q
Что выведет код?
```go
var x uint8 = 250
x += 10
fmt.Println(x)
```
- [ ] 260
- [x] 4
- [ ] Паника: overflow
- [ ] Ошибка компиляции
@@ explain
`uint8` хранит значения 0–255. 250 + 10 = 260, по модулю 256 получаем 4. Переполнение целых в Go не вызывает панику.

@@ q
Что выведет `fmt.Println(7 / 2, 7 % 3, -7 / 2)`?
- [ ] `3.5 1 -3.5`
- [x] `3 1 -3`
- [ ] `3 1 -4`
- [ ] `4 1 -4`
@@ explain
Деление целых отбрасывает дробную часть с округлением к нулю, поэтому `-7/2 = -3`.

@@ q
Как правильно сложить `a int` и `b int64`?
- [ ] `a + b` — Go сам приведёт типы
- [x] `int64(a) + b`
- [ ] `(int64)a + b`
- [ ] `a.(int64) + b`
@@ explain
Преобразование типов в Go записывается как вызов функции: `T(x)`. Неявных преобразований нет. `a.(int64)` — это type assertion, она применима только к интерфейсам.

@@ task temperature | Конвертер температур | xp=40
Даны типы `Celsius` и `Fahrenheit`. Реализуйте:

- `CToF(c Celsius) Fahrenheit` — по формуле F = C × 9/5 + 32
- `FToC(f Fahrenheit) Celsius` — обратная формула
- `Average(a, b, c int) float64` — среднее арифметическое трёх целых **с дробной частью** (например, `Average(1, 2, 2)` = 1.6666…)
@@ hint
Для `Average` преобразуйте сумму к `float64` до деления: `float64(a+b+c) / 3`.
@@ hint
Обратная формула: C = (F − 32) × 5/9. Не забудьте преобразовать результат к нужному типу: `Celsius(...)`.
@@ starter
package main

import "fmt"

type Celsius float64
type Fahrenheit float64

func CToF(c Celsius) Fahrenheit {
	return 0
}

func FToC(f Fahrenheit) Celsius {
	return 0
}

func Average(a, b, c int) float64 {
	return float64((a + b + c) / 3)
}

func main() {
	fmt.Println(CToF(100), FToC(212), Average(1, 2, 2))
}
@@ solution
package main

import "fmt"

type Celsius float64
type Fahrenheit float64

func CToF(c Celsius) Fahrenheit {
	return Fahrenheit(c*9/5 + 32)
}

func FToC(f Fahrenheit) Celsius {
	return Celsius((f - 32) * 5 / 9)
}

func Average(a, b, c int) float64 {
	return float64(a+b+c) / 3
}

func main() {
	fmt.Println(CToF(100), FToC(212), Average(1, 2, 2))
}
@@ test
package main

import (
	"math"
	"testing"
)

func near(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func TestTemperature(t *testing.T) {
	for _, c := range []struct{ c, f float64 }{{0, 32}, {100, 212}, {-40, -40}, {36.6, 97.88}} {
		if got := CToF(Celsius(c.c)); !near(float64(got), c.f) {
			t.Errorf("CToF(%v) = %v, ожидалось %v", c.c, got, c.f)
		}
		if got := FToC(Fahrenheit(c.f)); !near(float64(got), c.c) {
			t.Errorf("FToC(%v) = %v, ожидалось %v", c.f, got, c.c)
		}
	}
}

func TestAverage(t *testing.T) {
	if got := Average(1, 2, 2); !near(got, 5.0/3) {
		t.Errorf("Average(1, 2, 2) = %v, ожидалось %v", got, 5.0/3)
	}
	if got := Average(-1, 0, 0); !near(got, -1.0/3) {
		t.Errorf("Average(-1, 0, 0) = %v, ожидалось %v", got, -1.0/3)
	}
	if got := Average(3, 3, 3); got != 3 {
		t.Errorf("Average(3, 3, 3) = %v, ожидалось 3", got)
	}
}
