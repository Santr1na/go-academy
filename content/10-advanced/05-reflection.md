---
id: reflection
title: Рефлексия и unsafe (кратко)
summary: reflect.Type и reflect.Value, Kind, обход полей и тегов, изменение через указатель, цена рефлексии, unsafe
xp: 35
---
## Зачем рефлексия

Рефлексия позволяет программе исследовать типы и значения **во время выполнения**. На ней построены `encoding/json`, `fmt`, ORM, валидаторы, DI-контейнеры. В прикладном коде она нужна редко.

## Type и Value

```go
x := 3.4
t := reflect.TypeOf(x)   // float64
v := reflect.ValueOf(x)  // значение
fmt.Println(t.Name(), t.Kind(), v.Float()) // float64 float64 3.4
```

**Kind** — категория типа (`Struct`, `Slice`, `Map`, `Pointer`, `Int`…). **Type** — конкретный тип: у `type Celsius float64` тип `Celsius`, а Kind — `Float64`.

## Обход полей структуры и теги

```go
type User struct {
	Name  string `validate:"required" json:"name"`
	Age   int    `validate:"min=18"`
	email string
}

t := reflect.TypeOf(User{})
for i := 0; i < t.NumField(); i++ {
	f := t.Field(i)
	fmt.Println(f.Name, f.Type, f.Tag.Get("validate"), f.IsExported())
}
// Name string required true
// Age int min=18 true
// email string  false
```

С Go 1.26 можно обходить поля итератором: `for f := range t.Fields()`.

## Изменение значений

Изменять можно только **адресуемые** значения — получите `Value` через указатель и `Elem()`:

```go
u := User{Name: "a"}
v := reflect.ValueOf(&u).Elem()
v.FieldByName("Name").SetString("b")   // ок
// reflect.ValueOf(u).Field(0).SetString("x") // panic: unaddressable value
fmt.Println(v.FieldByName("email").CanSet()) // false — неэкспортируемое
```

## Вызов методов и функций

```go
m := reflect.ValueOf(obj).MethodByName("Hello")
out := m.Call([]reflect.Value{reflect.ValueOf("мир")})
```

## Цена рефлексии

- медленно (в десятки раз медленнее прямого кода), много аллокаций;
- ошибки типов превращаются в **паники во время выполнения**;
- код сложнее читать.

> «Clear is better than clever. Reflection is never clear.» — Go Proverbs. Сначала рассмотрите интерфейсы, generics или кодогенерацию (`go generate`).

## unsafe — обход системы типов

`unsafe.Pointer` позволяет преобразовывать указатели произвольных типов, а `unsafe.Sizeof/Alignof/Offsetof` — узнавать раскладку памяти:

```go
fmt.Println(unsafe.Sizeof(struct {
	a bool
	b int64
}{})) // 16 — из-за выравнивания

// Строка ↔ байты без копирования (Go 1.20+):
b := []byte("hello")
s := unsafe.String(unsafe.SliceData(b), len(b)) // нельзя менять b после этого!
```

Применяется в высокопроизводительных библиотеках и при взаимодействии с C. Код с `unsafe` не переносим, не защищён гарантиями совместимости Go 1 и легко ломает GC. В прикладном коде — **избегайте**.

@@ quiz
@@ q
Чему равен `reflect.TypeOf(Celsius(1)).Kind()` для `type Celsius float64`?
- [ ] `Celsius`
- [x] `reflect.Float64`
- [ ] `reflect.Struct`
@@ explain
Kind — базовая категория типа. Имя типа (`Name()`) — `Celsius`, а Kind — `Float64`.

@@ q
Почему `reflect.ValueOf(u).Field(0).SetString("x")` паникует?
- [ ] Поле неэкспортируемое
- [x] Значение неадресуемое: `ValueOf(u)` получил копию; нужно `ValueOf(&u).Elem()`
- [ ] SetString не существует
@@ explain
Чтобы изменять значение через рефлексию, нужно работать с ним через указатель — иначе изменение копии бессмысленно, и reflect запрещает его.

@@ q
Какое утверждение о `unsafe` верно?
- [ ] Код с unsafe быстрее и поэтому рекомендуется
- [x] Он обходит систему типов и гарантии совместимости, использовать только при крайней необходимости
- [ ] Он нужен для работы с каналами
@@ explain
`unsafe` — «аварийный люк». Он нужен узкому кругу низкоуровневого кода, ошибки в нём приводят к повреждению памяти.

@@ task struct-tags | Валидатор на тегах | xp=60
Реализуйте `Validate(v any) []string` — простой валидатор структур на основе тега `validate`:

- `validate:"required"` — строка не должна быть пустой (для других типов — не нулевое значение, `reflect.Value.IsZero`);
- `validate:"min=N"` — для целых: значение `>= N`.

`v` может быть структурой или указателем на структуру. Неэкспортируемые поля пропускайте. Верните список ошибок в порядке полей, формат: `"<Field>: required"` и `"<Field>: must be >= N"`. Если `v` не структура — верните `[]string{"not a struct"}`.
@@ hint
`rv := reflect.ValueOf(v); if rv.Kind() == reflect.Pointer { rv = rv.Elem() }`, затем `rt := rv.Type()` и цикл по `rt.NumField()`.
@@ hint
Разбор тега: `tag := f.Tag.Get("validate")`; `if strings.HasPrefix(tag, "min=") { n, _ := strconv.Atoi(tag[4:]); if rv.Field(i).Int() < int64(n) {...} }`.
@@ starter
package main

import "fmt"

func Validate(v any) []string {
	return nil
}

type User struct {
	Name string `validate:"required"`
	Age  int    `validate:"min=18"`
}

func main() {
	fmt.Println(Validate(User{Age: 10}))
}
@@ solution
package main

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
)

func Validate(v any) []string {
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return []string{"not a struct"}
	}
	rt := rv.Type()
	var errs []string
	for i := 0; i < rt.NumField(); i++ {
		f := rt.Field(i)
		if !f.IsExported() {
			continue
		}
		tag := f.Tag.Get("validate")
		fv := rv.Field(i)
		switch {
		case tag == "required":
			if fv.IsZero() {
				errs = append(errs, f.Name+": required")
			}
		case strings.HasPrefix(tag, "min="):
			n, err := strconv.Atoi(strings.TrimPrefix(tag, "min="))
			if err != nil {
				continue
			}
			if fv.CanInt() && fv.Int() < int64(n) {
				errs = append(errs, fmt.Sprintf("%s: must be >= %d", f.Name, n))
			}
		}
	}
	return errs
}

type User struct {
	Name string `validate:"required"`
	Age  int    `validate:"min=18"`
}

func main() {
	fmt.Println(Validate(User{Age: 10}))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

type Signup struct {
	Email    string `validate:"required"`
	Password string `validate:"required"`
	Age      int    `validate:"min=18"`
	Score    int64  `validate:"min=-5"`
	Tags     []string `validate:"required"`
	note     string `validate:"required"`
	Bio      string
}

func TestValidate(t *testing.T) {
	got := Validate(Signup{Password: "x", Age: 16, Score: -10})
	want := "[Email: required Age: must be >= 18 Score: must be >= -5 Tags: required]"
	if fmt.Sprint(got) != want {
		t.Errorf("Validate = %v\nожидалось %s", got, want)
	}
	ok := &Signup{Email: "a@b", Password: "p", Age: 18, Score: -5, Tags: []string{"go"}}
	if got := Validate(ok); len(got) != 0 {
		t.Errorf("корректная структура (указатель): %v", got)
	}
	if got := Validate(42); fmt.Sprint(got) != "[not a struct]" {
		t.Errorf("Validate(42) = %v", got)
	}
}
