---
id: type-assertions
title: any, type assertion и type switch
summary: пустой интерфейс, извлечение конкретного типа, comma ok, type switch, проверка на интерфейс
xp: 30
---
## Пустой интерфейс `any`

`interface{}` (с Go 1.18 — псевдоним `any`) не требует ни одного метода, поэтому ему удовлетворяет **любой** тип:

```go
var v any
v = 42
v = "строка"
v = []int{1, 2}
fmt.Println(v) // fmt.Println принимает ...any
```

`any` теряет информацию о типе — с ним мало что можно сделать без проверки типа. Используйте его осознанно: для JSON произвольной структуры, контейнеров до появления generics, логирования.

## Type assertion

`x.(T)` извлекает конкретный тип из интерфейсного значения:

```go
var v any = "hello"

s := v.(string)       // ок: s == "hello"
n := v.(int)          // panic: interface conversion: interface {} is string, not int

n, ok := v.(int)      // безопасная форма: n == 0, ok == false
if s, ok := v.(string); ok {
	fmt.Println(len(s))
}
```

Утверждать можно и **другой интерфейс** — проверка, умеет ли значение что-то ещё:

```go
func describe(v any) string {
	if s, ok := v.(fmt.Stringer); ok {
		return s.String()
	}
	return fmt.Sprint(v)
}
```

Так работает стандартная библиотека: `io.Copy` проверяет, не реализует ли источник `io.WriterTo`, чтобы скопировать эффективнее.

## Type switch

Для выбора среди нескольких типов:

```go
func classify(v any) string {
	switch x := v.(type) {
	case nil:
		return "nil"
	case int, int64:
		return fmt.Sprintf("целое %v", x) // здесь x имеет тип any (несколько типов в case)
	case string:
		return "строка длиной " + strconv.Itoa(len(x)) // x — string
	case error:
		return "ошибка: " + x.Error()
	case fmt.Stringer:
		return "Stringer: " + x.String()
	default:
		return fmt.Sprintf("неизвестный тип %T", x)
	}
}
```

- В ветке с одним типом `x` имеет этот тип.
- В ветке с несколькими типами или в `default` — исходный интерфейсный тип.
- Ветки проверяются по порядку: конкретные типы ставьте раньше интерфейсов.

## Числа в any

```go
var v any = 42
f, ok := v.(float64) // ok == false! Внутри int, а не float64
```

Type assertion проверяет **точный** динамический тип, преобразований не делает. Это особенно важно с JSON: `encoding/json` декодирует числа в `any` как `float64`.

@@ quiz
@@ q
Что произойдёт?
```go
var v any = 3.0
n := v.(int)
fmt.Println(n)
```
- [ ] Выведет 3
- [ ] Выведет 0
- [x] Паника: interface conversion
@@ explain
Динамический тип — `float64`. Однозначная форма type assertion паникует при несовпадении. Безопасный вариант — `n, ok := v.(int)`.

@@ q
Какой тип имеет `x` в ветке `case int, string:` конструкции `switch x := v.(type)`?
- [ ] `int`
- [ ] `string`
- [x] Тип `v` (например, `any`)
@@ explain
Если в case перечислено несколько типов, переменная сохраняет исходный интерфейсный тип.

@@ q
Что выведет код?
```go
var v any = nil
_, ok := v.(any)
fmt.Println(ok)
```
- [ ] `true`
- [x] `false`
- [ ] Паника
@@ explain
Type assertion для nil-интерфейса всегда неуспешна (ok == false), даже к `any`. Однозначная форма `v.(any)` здесь бы запаниковала.

@@ task describe | Описание значений | xp=50
Реализуйте `Describe(v any) string` с помощью type switch:

| Значение | Результат |
|---|---|
| `nil` | `"nil"` |
| `int` | `"int: 42"` |
| `string` | `"string: \"go\" (len 2)"` — используйте `%q` |
| `bool` | `"bool: true"` |
| `[]int` | `"[]int of 3"` (длина) |
| `error` | `"error: <текст ошибки>"` |
| `fmt.Stringer` | `"stringer: <результат String()>"` |
| любой другой | `"unknown: <тип через %T>"` |
@@ hint
`switch x := v.(type) { case nil: ...; case int: return fmt.Sprintf("int: %d", x) ... }`
@@ hint
`error` и `fmt.Stringer` — интерфейсы, их тоже можно указать в case. Тип для unknown: `fmt.Sprintf("unknown: %T", v)`.
@@ starter
package main

import "fmt"

func Describe(v any) string {
	return fmt.Sprint(v)
}

func main() {
	fmt.Println(Describe(42), Describe("go"), Describe(nil))
}
@@ solution
package main

import "fmt"

func Describe(v any) string {
	switch x := v.(type) {
	case nil:
		return "nil"
	case int:
		return fmt.Sprintf("int: %d", x)
	case string:
		return fmt.Sprintf("string: %q (len %d)", x, len(x))
	case bool:
		return fmt.Sprintf("bool: %v", x)
	case []int:
		return fmt.Sprintf("[]int of %d", len(x))
	case error:
		return "error: " + x.Error()
	case fmt.Stringer:
		return "stringer: " + x.String()
	default:
		return fmt.Sprintf("unknown: %T", x)
	}
}

func main() {
	fmt.Println(Describe(42), Describe("go"), Describe(nil))
}
@@ test
package main

import (
	"errors"
	"testing"
	"time"
)

func TestDescribe(t *testing.T) {
	cases := []struct {
		in   any
		want string
	}{
		{nil, "nil"},
		{42, "int: 42"},
		{"go", `string: "go" (len 2)`},
		{true, "bool: true"},
		{[]int{1, 2, 3}, "[]int of 3"},
		{errors.New("boom"), "error: boom"},
		{2 * time.Second, "stringer: 2s"},
		{3.5, "unknown: float64"},
		{map[string]int{}, "unknown: map[string]int"},
	}
	for _, c := range cases {
		if got := Describe(c.in); got != c.want {
			t.Errorf("Describe(%#v) = %q, ожидалось %q", c.in, got, c.want)
		}
	}
}

@@ task sum-any | Сумма чисел разных типов | xp=40
Реализуйте `SumNumbers(vals ...any) (float64, int)`, которая складывает все числа типов `int`, `int64`, `float64` и строки, которые успешно парсятся `strconv.ParseFloat(s, 64)`. Всё остальное пропускается. Вторым результатом верните количество **пропущенных** значений.

`SumNumbers(1, int64(2), 2.5, "4", "x", true)` → `9.5, 2`.
@@ hint
Type switch с ветками `case int:`, `case int64:`, `case float64:`, `case string:`, `default:`.
@@ hint
В ветке string: `if f, err := strconv.ParseFloat(x, 64); err == nil { sum += f } else { skipped++ }`.
@@ starter
package main

import "fmt"

func SumNumbers(vals ...any) (float64, int) {
	return 0, len(vals)
}

func main() {
	fmt.Println(SumNumbers(1, int64(2), 2.5, "4", "x", true))
}
@@ solution
package main

import (
	"fmt"
	"strconv"
)

func SumNumbers(vals ...any) (float64, int) {
	sum, skipped := 0.0, 0
	for _, v := range vals {
		switch x := v.(type) {
		case int:
			sum += float64(x)
		case int64:
			sum += float64(x)
		case float64:
			sum += x
		case string:
			if f, err := strconv.ParseFloat(x, 64); err == nil {
				sum += f
			} else {
				skipped++
			}
		default:
			skipped++
		}
	}
	return sum, skipped
}

func main() {
	fmt.Println(SumNumbers(1, int64(2), 2.5, "4", "x", true))
}
@@ test
package main

import "testing"

func TestSumNumbers(t *testing.T) {
	sum, skipped := SumNumbers(1, int64(2), 2.5, "4", "x", true)
	if sum != 9.5 || skipped != 2 {
		t.Errorf("получено %v, %d; ожидалось 9.5, 2", sum, skipped)
	}
	sum, skipped = SumNumbers()
	if sum != 0 || skipped != 0 {
		t.Errorf("пустой вызов: %v, %d", sum, skipped)
	}
	sum, skipped = SumNumbers(nil, int32(5), "-1.5", float32(1))
	if sum != -1.5 || skipped != 3 {
		t.Errorf("получено %v, %d; ожидалось -1.5, 3 (int32 и float32 не поддерживаются)", sum, skipped)
	}
}
