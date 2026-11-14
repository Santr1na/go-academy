---
id: nil-interface
title: Ловушка nil-интерфейса
summary: почему интерфейс с nil-указателем внутри не равен nil, и как этого избежать
xp: 30
---
## Устройство интерфейсного значения

Значение интерфейса — это пара:

```text
┌──────────────┬───────────────┐
│ тип (itab)   │ значение (ptr) │
└──────────────┴───────────────┘
```

Интерфейс равен `nil` **только если обе части nil** — нет ни типа, ни значения.

## Ловушка

```go
type MyErr struct{}
func (*MyErr) Error() string { return "my error" }

func check(fail bool) error {
	var p *MyErr = nil
	if fail {
		p = &MyErr{}
	}
	return p // ← ловушка!
}

func main() {
	err := check(false)
	fmt.Println(err == nil) // false !!!
}
```

`check(false)` возвращает интерфейс `error` с типом `*MyErr` и значением `nil`. Тип заполнен — значит, интерфейс **не nil**. Код вызывающего решит, что произошла ошибка.

```text
error{type: *MyErr, value: nil}  !=  error{type: nil, value: nil}
```

## Как правильно

Возвращайте **литерал `nil`** для интерфейсного результата, а не типизированную переменную:

```go
func check(fail bool) error {
	if fail {
		return &MyErr{}
	}
	return nil
}
```

Общее правило: **не храните конкретный тип ошибки в переменной, если потом вернёте её как `error`**. Объявляйте `var err error`, а не `var err *MyErr`.

## Где ещё встречается

```go
var buf *bytes.Buffer         // nil
var w io.Writer = buf         // w != nil, но w.Write(...) паникует
if w != nil {
	w.Write([]byte("x"))     // panic: nil pointer dereference
}
```

## Как проверить «настоящую» пустоту

Через рефлексию (используйте осторожно, обычно это признак плохого дизайна):

```go
func isNil(v any) bool {
	if v == nil {
		return true
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Pointer, reflect.Map, reflect.Slice, reflect.Func, reflect.Chan, reflect.Interface:
		return rv.IsNil()
	}
	return false
}
```

## Сравнение интерфейсов

```go
var a any = 1
var b any = 1
fmt.Println(a == b) // true — одинаковые тип и значение

var c any = []int{1}
var d any = []int{1}
fmt.Println(c == d) // panic: comparing uncomparable type []int
```

> **На собеседовании** этот вопрос задают почти всегда. Объясните устройство интерфейса как пары (тип, значение) и покажите, как исправить функцию.

## Разбираем подробнее: две ячейки

Представьте интерфейсное значение как коробку с **двумя ячейками**: в первой записан **тип**, во второй — **значение** (обычно указатель на данные).

| Что написано в коде | Ячейка «тип» | Ячейка «значение» | `== nil` |
|---|---|---|---|
| `var err error` | пусто | пусто | **true** |
| `var p *MyErr; var err error = p` | `*MyErr` | nil | **false** |
| `var err error = &MyErr{}` | `*MyErr` | адрес | false |

Интерфейс равен `nil`, только когда пусты **обе** ячейки. Вторая строка таблицы — та самая ловушка: указатель пустой, но в ячейке типа уже записано `*MyErr`, и коробка считается непустой.

Это легко увидеть, напечатав тип через `%T`:

```go
var err error
fmt.Printf("%T %v\n", err, err) // <nil> <nil> — обе ячейки пусты

var p *MyErr
err = p
fmt.Printf("%T %v\n", err, err) // *main.MyErr <nil> — тип есть, значение пустое
fmt.Println(err == nil)         // false
```

### Как ловушка выглядит в настоящем коде

```go
func validate(s string) error {
	var e *ValidationError // объявили переменную КОНКРЕТНОГО типа
	if s == "" {
		e = &ValidationError{"пусто"}
	}
	return e // даже когда e == nil, наружу уходит «тип есть, значение nil»
}

if err := validate("ok"); err != nil {
	fmt.Println("ошибка!") // сработает всегда
}
```

Проверка `err != nil` — основа обработки ошибок в Go, поэтому такой баг ломает всю цепочку вызовов выше.

Исправление — никогда не заводить переменную конкретного типа «для ошибки», а возвращать `nil` явно:

```go
func validate(s string) error {
	if s == "" {
		return &ValidationError{"пусто"}
	}
	return nil // чистый nil: обе ячейки пусты
}
```

### Метод на nil-указателе внутри интерфейса вызывается

```go
type T struct{}

func (t *T) Hi() string { return "hi" } // метод не обращается к полям t

type Greeter interface{ Hi() string }

var t *T
var g Greeter = t
fmt.Println(g != nil, g.Hi()) // true hi
```

Вызов проходит: тип известен, метод найден, а то, что получатель равен `nil`, — проблема метода, а не вызова. Паника случится, только если метод полезет в поля.

А вот у полностью пустого интерфейса вызывать нечего:

```go
var g Greeter
g.Hi() // паника: nil pointer dereference — тип неизвестен, метод найти нельзя
```

### Памятка

- Функция возвращает `error` → в «успешной» ветке пишите буквально `return nil`.
- Не объявляйте `var err *MyError` в функции, которая возвращает интерфейс `error`.
- Увидели «ошибка не nil, а печатается `<nil>`» — это оно. Проверьте `%T`.

@@ quiz
@@ q
Что выведет код?
```go
type E struct{}
func (*E) Error() string { return "e" }

func f() error {
	var e *E
	return e
}

func main() {
	fmt.Println(f() == nil)
}
```
- [ ] `true`
- [x] `false`
- [ ] Паника
@@ explain
Возвращаемый интерфейс содержит тип `*E` и nil-значение. Интерфейс равен nil, только если и тип, и значение nil.

@@ q
Что выведет код?
```go
var p *int
var i any = p
fmt.Println(p == nil, i == nil)
```
- [ ] `true true`
- [x] `true false`
- [ ] `false false`
@@ explain
Сам указатель — nil. Интерфейс `i` хранит тип `*int`, поэтому он не nil.

@@ q
Что выведет код?
```go
var a, b any = 1, 1.0
fmt.Println(a == b)
```
- [ ] `true`
- [x] `false`
- [ ] Ошибка компиляции
@@ explain
Интерфейсы равны, если совпадают и динамические типы, и значения. Здесь типы разные: `int` и `float64`.

@@ q
Что произойдёт?
```go
var x, y any = []int{1}, []int{1}
fmt.Println(x == y)
```
- [ ] `true`
- [ ] `false`
- [x] Паника во время выполнения
@@ explain
Сравнение интерфейсов компилируется, но если динамический тип несравним (срез, map, функция), во время выполнения будет паника.

@@ q
Что выведет код?
```go
type T struct{}

func (t *T) Hi() string { return "hi" }

type Greeter interface{ Hi() string }

func main() {
	var t *T
	var g Greeter = t
	fmt.Println(g != nil, g.Hi())
}
```
- [ ] `false`, затем паника
- [ ] `true`, затем паника: получатель равен nil
- [x] `true hi`
- [ ] `false hi`
@@ explain
В интерфейс положен nil-указатель типа `*T`: ячейка типа заполнена, поэтому `g != nil` истинно. Метод вызывается нормально — он не обращается к полям получателя, так что nil ему не мешает.

@@ q
Что произойдёт при запуске?
```go
type Greeter interface{ Hi() string }

func main() {
	var g Greeter
	fmt.Println(g.Hi())
}
```
- [ ] Выведет пустую строку
- [ ] Ошибка компиляции: интерфейс не инициализирован
- [x] Паника: nil pointer dereference
- [ ] Выведет `<nil>`
@@ explain
У пустого интерфейса не заполнена даже ячейка типа — неизвестно, чей метод вызывать. Код компилируется, но при запуске падает. Сравните с предыдущим вопросом: там тип был известен, и вызов прошёл.

@@ q
Что выведет код?
```go
var e error
fmt.Printf("%T %v\n", e, e)
```
- [ ] `error <nil>`
- [x] `<nil> <nil>`
- [ ] `*errors.errorString <nil>`
- [ ] Паника
@@ explain
`%T` печатает **динамический** тип — то, что лежит в ячейке типа. У неинициализированного интерфейса она пуста, поэтому печатается `<nil>`. Это удобный способ отладки: если `%T` показывает конкретный тип, а `%v` — `<nil>`, перед вами «не-nil интерфейс с nil внутри».

@@ task fix-nil | Исправьте возврат ошибки | xp=50 interview
В функции `Validate` классическая ошибка: она возвращает типизированный nil-указатель, из-за чего вызывающий код всегда видит ошибку.

Исправьте `Validate(age int) error` так, чтобы:

- при `age < 0` возвращалась `*ValidationError` с `Field: "age"` и `Msg: "negative"`;
- при `age > 150` — `Field: "age"`, `Msg: "too large"`;
- иначе — **настоящий** `nil` (`err == nil` должно быть `true`).

Тип `ValidationError` и его метод `Error()` менять не нужно.
@@ hint
Проблема в строке `var err *ValidationError` — после неё `return err` всегда даёт не-nil интерфейс.
@@ hint
Возвращайте `&ValidationError{...}` прямо из веток, а в конце — `return nil`.
@@ starter
package main

import "fmt"

type ValidationError struct {
	Field, Msg string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Msg
}

func Validate(age int) error {
	var err *ValidationError
	if age < 0 {
		err = &ValidationError{Field: "age", Msg: "negative"}
	} else if age > 150 {
		err = &ValidationError{Field: "age", Msg: "too large"}
	}
	return err
}

func main() {
	if err := Validate(30); err != nil {
		fmt.Println("ошибка?!", err == nil)
		return
	}
	fmt.Println("ok")
}
@@ solution
package main

import "fmt"

type ValidationError struct {
	Field, Msg string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Msg
}

func Validate(age int) error {
	if age < 0 {
		return &ValidationError{Field: "age", Msg: "negative"}
	}
	if age > 150 {
		return &ValidationError{Field: "age", Msg: "too large"}
	}
	return nil
}

func main() {
	if err := Validate(30); err != nil {
		fmt.Println("ошибка?!", err)
		return
	}
	fmt.Println("ok")
}
@@ test
package main

import "testing"

func TestValidate(t *testing.T) {
	for _, age := range []int{0, 30, 150} {
		if err := Validate(age); err != nil {
			t.Errorf("Validate(%d) вернула не-nil интерфейс (%T) — это ловушка nil-интерфейса", age, err)
		}
	}
	cases := map[int]string{-1: "age: negative", 151: "age: too large"}
	for age, want := range cases {
		err := Validate(age)
		if err == nil {
			t.Fatalf("Validate(%d) должна вернуть ошибку", age)
		}
		ve, ok := err.(*ValidationError)
		if !ok || ve.Error() != want {
			t.Errorf("Validate(%d) = %v (%T), ожидалось *ValidationError %q", age, err, err, want)
		}
	}
}

@@ task safe-writer | Безопасная проверка на nil | xp=40
Реализуйте `IsNil(v any) bool`, которая возвращает `true`, если `v` — это nil-интерфейс **или** интерфейс, содержащий nil-указатель, nil-срез, nil-map, nil-канал или nil-функцию. Для остальных значений (числа, строки, структуры, не-nil указатели) — `false`.

Используйте пакет `reflect`: `reflect.ValueOf(v).Kind()` и `.IsNil()`.
@@ hint
Сначала `if v == nil { return true }`.
@@ hint
`IsNil` можно вызывать только для видов `reflect.Pointer, Map, Slice, Func, Chan, Interface` — иначе паника. Проверьте `Kind()` в switch.
@@ starter
package main

import "fmt"

func IsNil(v any) bool {
	return v == nil
}

func main() {
	var p *int
	fmt.Println(IsNil(nil), IsNil(p), IsNil(5))
}
@@ solution
package main

import (
	"fmt"
	"reflect"
)

func IsNil(v any) bool {
	if v == nil {
		return true
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Pointer, reflect.Map, reflect.Slice, reflect.Func, reflect.Chan, reflect.Interface:
		return rv.IsNil()
	}
	return false
}

func main() {
	var p *int
	fmt.Println(IsNil(nil), IsNil(p), IsNil(5))
}
@@ test
package main

import "testing"

func TestIsNil(t *testing.T) {
	var p *int
	var s []int
	var m map[string]int
	var ch chan int
	var f func()
	x := 1
	yes := []any{nil, p, s, m, ch, f}
	no := []any{0, "", struct{}{}, &x, []int{}, map[string]int{}, make(chan int), func() {}}
	for i, v := range yes {
		if !IsNil(v) {
			t.Errorf("случай %d (%T): IsNil = false, ожидалось true", i, v)
		}
	}
	for i, v := range no {
		if IsNil(v) {
			t.Errorf("случай %d (%T): IsNil = true, ожидалось false", i, v)
		}
	}
}
