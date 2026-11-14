---
id: variables
title: Пакеты, импорт и переменные
summary: var и :=, нулевые значения, области видимости, множественное присваивание
xp: 20
---
## Пакеты и импорт

Код в Go организован в **пакеты**. Несколько импортов группируют в скобках:

```go
import (
	"fmt"
	"math"
	"strings"
)
```

Из пакета доступны только **экспортированные** имена — те, что начинаются с заглавной буквы: `math.Pi`, `strings.ToUpper`. Имя `math.pi` недоступно извне.

## Объявление переменных

```go
var name string = "Gopher" // полная форма
var age = 13               // тип выводится из значения (int)
var score int              // без значения → нулевое значение (0)

city := "Казань"           // короткое объявление — только внутри функций
x, y := 1, 2               // несколько сразу

var (                      // блок объявлений
	host = "localhost"
	port = 8080
)
```

`:=` — самый частый способ внутри функций. На уровне пакета (вне функций) можно использовать только `var`.

## Нулевые значения (zero values)

В Go **нет неинициализированных переменных**. Каждая переменная без явного значения получает нулевое значение своего типа:

| Тип | Нулевое значение |
|---|---|
| `int`, `float64` и др. числа | `0` |
| `bool` | `false` |
| `string` | `""` (пустая строка) |
| указатели, срезы, map, каналы, функции, интерфейсы | `nil` |
| структуры | все поля — нулевые значения |

## Множественное присваивание и обмен

```go
a, b := 1, 2
a, b = b, a        // обмен без временной переменной
fmt.Println(a, b)  // 2 1
```

Правая часть вычисляется полностью до присваивания, поэтому обмен работает корректно.

## Пустой идентификатор `_`

```go
_, err := fmt.Println("hi") // первое значение нам не нужно
```

## `:=` и затенение (shadowing)

`:=` объявляет **новую** переменную. Во вложенном блоке это может «затенить» внешнюю:

```go
x := 1
if true {
	x := 2      // новая переменная x внутри блока if
	fmt.Println(x) // 2
}
fmt.Println(x)  // 1 — внешняя не изменилась
```

> **Ловушка:** `:=` требует, чтобы слева была хотя бы одна новая переменная. `a, err := f()` допустимо, даже если `err` уже есть, — тогда `err` переиспользуется (в той же области видимости).

@@ quiz
@@ q
Что выведет код?
```go
var s string
var n int
var ok bool
fmt.Printf("%q %d %v", s, n, ok)
```
- [ ] `nil 0 false`
- [x] `"" 0 false`
- [ ] Ошибка компиляции: переменные не инициализированы
- [ ] `"" nil nil`
@@ explain
Переменные получают нулевые значения: пустую строку, `0` и `false`. `%q` печатает строку в кавычках.

@@ q
Где нельзя использовать `:=`?
- [ ] Внутри `for`
- [x] На уровне пакета, вне функций
- [ ] Внутри `if`
- [ ] В функции `main`
@@ explain
На уровне пакета каждое объявление должно начинаться с ключевого слова (`var`, `const`, `func`, `type`), поэтому `:=` там запрещено.

@@ q
Что выведет код?
```go
x := 1
{
	x := 2
	x++
}
fmt.Println(x)
```
- [x] `1`
- [ ] `2`
- [ ] `3`
- [ ] Ошибка компиляции
@@ explain
Внутри блока `x := 2` создаёт новую переменную, затеняющую внешнюю. Изменения внутренней не влияют на внешнюю `x`.

@@ task swap | Обмен значений | xp=30
Реализуйте функцию `Swap(a, b int) (int, int)`, которая возвращает аргументы в обратном порядке.

Например, `Swap(1, 2)` → `2, 1`.
@@ hint
Функция может вернуть два значения: `return x, y`.
@@ hint
Достаточно `return b, a`.
@@ starter
package main

import "fmt"

func Swap(a, b int) (int, int) {
	// ваш код
	return a, b
}

func main() {
	x, y := Swap(1, 2)
	fmt.Println(x, y)
}
@@ solution
package main

import "fmt"

func Swap(a, b int) (int, int) {
	return b, a
}

func main() {
	x, y := Swap(1, 2)
	fmt.Println(x, y)
}
@@ test
package main

import "testing"

func TestSwap(t *testing.T) {
	cases := [][2]int{{1, 2}, {0, 5}, {-3, 3}, {7, 7}}
	for _, c := range cases {
		x, y := Swap(c[0], c[1])
		if x != c[1] || y != c[0] {
			t.Errorf("Swap(%d, %d) = %d, %d; ожидалось %d, %d", c[0], c[1], x, y, c[1], c[0])
		}
	}
}

@@ task zero | Нулевые значения | xp=30
Объявите на уровне пакета **без явной инициализации** четыре переменные:

- `Count` типа `int`
- `Name` типа `string`
- `Ready` типа `bool`
- `Ratio` типа `float64`

а также функцию `Describe() string`, которая возвращает строку вида `Count=0 Name="" Ready=false Ratio=0` (используйте `fmt.Sprintf` с глаголами `%d %q %v %v`).
@@ hint
`var Count int` — объявление без значения. Можно сгруппировать в блок `var ( ... )`.
@@ hint
`fmt.Sprintf("Count=%d Name=%q Ready=%v Ratio=%v", Count, Name, Ready, Ratio)`
@@ starter
package main

import "fmt"

// объявите переменные здесь

func Describe() string {
	return ""
}

func main() {
	fmt.Println(Describe())
}
@@ solution
package main

import "fmt"

var (
	Count int
	Name  string
	Ready bool
	Ratio float64
)

func Describe() string {
	return fmt.Sprintf("Count=%d Name=%q Ready=%v Ratio=%v", Count, Name, Ready, Ratio)
}

func main() {
	fmt.Println(Describe())
}
@@ test
package main

import "testing"

func TestZero(t *testing.T) {
	var _ int = Count
	var _ string = Name
	var _ bool = Ready
	var _ float64 = Ratio
	want := `Count=0 Name="" Ready=false Ratio=0`
	if got := Describe(); got != want {
		t.Errorf("Describe() = %s; ожидалось %s", got, want)
	}
	Count, Name, Ready, Ratio = 3, "go", true, 0.5
	want = `Count=3 Name="go" Ready=true Ratio=0.5`
	if got := Describe(); got != want {
		t.Errorf("после изменения переменных Describe() = %s; ожидалось %s", got, want)
	}
}
