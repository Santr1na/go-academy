---
id: errors-is-as
title: Собственные ошибки, errors.Is и errors.As
summary: типы ошибок с полями, Unwrap, errors.As для извлечения, кастомный Is, выбор подхода
xp: 35
---
## Собственный тип ошибки

Когда вызывающему нужны **детали** (код, поле, HTTP-статус), создайте тип, реализующий `error`:

```go
type NotFoundError struct {
	Resource string
	ID       int
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("%s %d not found", e.Resource, e.ID)
}

func GetUser(id int) (*User, error) {
	return nil, &NotFoundError{Resource: "user", ID: id}
}
```

## errors.As — извлечь ошибку нужного типа

`errors.As(err, &target)` ищет в цепочке первую ошибку, которую можно присвоить `target`, и записывает её туда:

```go
err := fmt.Errorf("handler: %w", &NotFoundError{"user", 7})

var nf *NotFoundError
if errors.As(err, &nf) {
	fmt.Println("не найден ресурс", nf.Resource, nf.ID) // user 7
}
```

> **Важно:** второй аргумент — **указатель** на переменную типа ошибки. Если ошибка имеет указательный тип `*NotFoundError`, передаётся `**NotFoundError` (то есть `&nf`). `go vet` ловит ошибки здесь.

Go 1.26 добавил generic-версию `errors.AsType[*NotFoundError](err)`, возвращающую `(значение, ok)`.

## errors.Is — сравнить с конкретным значением

`errors.Is(err, target)` проходит по цепочке и сравнивает через `==` (или метод `Is`, если он есть):

```go
if errors.Is(err, os.ErrNotExist) { ... }
```

| | `errors.Is` | `errors.As` |
|---|---|---|
| Ищет | конкретное **значение** (sentinel) | ошибку определённого **типа** |
| Результат | bool | bool + заполненная переменная |
| Пример | `io.EOF`, `ErrNotFound` | `*os.PathError`, `*json.SyntaxError` |

## Метод Unwrap

Чтобы ваш тип участвовал в цепочке, реализуйте `Unwrap() error`:

```go
type QueryError struct {
	Query string
	Err   error
}

func (e *QueryError) Error() string { return e.Query + ": " + e.Err.Error() }
func (e *QueryError) Unwrap() error { return e.Err }

err := &QueryError{"SELECT ...", sql.ErrNoRows}
errors.Is(err, sql.ErrNoRows) // true — благодаря Unwrap
```

Для нескольких вложенных ошибок — `Unwrap() []error`.

## Собственный метод Is

Можно определить, какие ошибки считать «равными»:

```go
type HTTPError struct{ Code int }

func (e *HTTPError) Error() string { return http.StatusText(e.Code) }
func (e *HTTPError) Is(target error) bool {
	t, ok := target.(*HTTPError)
	return ok && (t.Code == 0 || t.Code == e.Code)
}

errors.Is(err, &HTTPError{Code: 404}) // совпадёт по коду
```

## Какой подход выбрать

1. Вызывающему не нужно различать ошибки → `fmt.Errorf` / `errors.New`.
2. Нужно различать вид ошибки → sentinel-значение + `errors.Is`.
3. Нужны данные из ошибки → свой тип + `errors.As`.
4. Можно проверять **поведение** через интерфейс: `interface{ Temporary() bool }` + `errors.As`.

## Разбираем подробнее: цепочка ошибок

Когда ошибка поднимается по стеку вызовов, каждый уровень добавляет к ней контекст:

```go
var ErrNotFound = errors.New("not found")

func findUser(id int) error {
	return ErrNotFound
}

func loadProfile(id int) error {
	if err := findUser(id); err != nil {
		return fmt.Errorf("load profile %d: %w", id, err)
	}
	return nil
}

func handle(id int) error {
	if err := loadProfile(id); err != nil {
		return fmt.Errorf("handle request: %w", err)
	}
	return nil
}
```

Наверху получается ошибка с текстом `handle request: load profile 7: not found`. Внутри она устроена как матрёшка:

```text
"handle request: …"  →  "load profile 7: …"  →  ErrNotFound
```

Каждая обёртка хранит ссылку на предыдущую ошибку. `errors.Is` и `errors.As` умеют **раскрывать матрёшку** слой за слоем.

### Почему нельзя сравнивать через ==

```go
err := fmt.Errorf("load user: %w", ErrNotFound)

fmt.Println(err == ErrNotFound)          // false — это обёртка, другое значение
fmt.Println(errors.Is(err, ErrNotFound)) // true  — Is заглянул внутрь
```

Оператор `==` смотрит только на внешний слой. Как только кто-то по дороге обернул ошибку, сравнение перестаёт работать — а код при этом компилируется и молча ведёт себя неправильно.

### %w и %v — одна буква, разное поведение

```go
e1 := fmt.Errorf("load user: %w", ErrNotFound)
e2 := fmt.Errorf("load user: %v", ErrNotFound)

fmt.Println(e1, "|", e2)                 // тексты одинаковые
fmt.Println(errors.Is(e1, ErrNotFound))  // true
fmt.Println(errors.Is(e2, ErrNotFound))  // false
```

`%v` вставляет только **текст** ошибки — связь с исходной ошибкой теряется. `%w` сохраняет саму ошибку внутри. На глаз результаты неотличимы, поэтому эту опечатку находят долго.

### Две ошибки с одинаковым текстом — разные ошибки

```go
fmt.Println(errors.New("a") == errors.New("a")) // false
```

`errors.New` каждый раз создаёт новое значение. Поэтому «сигнальные» ошибки объявляют **один раз** на уровне пакета (`var ErrNotFound = errors.New(...)`) и сравнивают с этой переменной, а не создают заново в месте проверки.

### errors.As: тип должен совпадать точно

```go
type NotFound struct{ ID int }

func (e NotFound) Error() string { return "not found" } // получатель — значение

err := fmt.Errorf("wrap: %w", NotFound{7}) // в цепочке лежит ЗНАЧЕНИЕ NotFound

var nf NotFound
fmt.Println(errors.As(err, &nf), nf.ID) // true 7

var pnf *NotFound
fmt.Println(errors.As(err, &pnf)) // false — в цепочке нет *NotFound
```

`As` ищет в цепочке ошибку **именно того типа**, на который указывает второй аргумент. Положили значение — ищите значение; положили указатель (`&NotFound{7}`) — ищите указатель. Перепутать легко, а ошибки компиляции не будет: `As` просто вернёт `false`.

### Несколько ошибок сразу

```go
e1, e2 := errors.New("e1"), errors.New("e2")
err := errors.Join(e1, e2)
fmt.Println(errors.Is(err, e2)) // true — Is проверяет все объединённые ошибки
```

### Что выбрать

| Вопрос к ошибке | Инструмент |
|---|---|
| «это та самая известная ошибка?» (`io.EOF`, `ErrNotFound`) | `errors.Is(err, target)` |
| «это ошибка такого типа? дай мне её поля» | `errors.As(err, &target)` |
| «добавить контекст и сохранить причину» | `fmt.Errorf("…: %w", err)` |
| «скрыть причину от вызывающего» | `fmt.Errorf("…: %v", err)` |

@@ quiz
@@ q
Что нужно передать вторым аргументом в `errors.As`, если ошибка имеет тип `*MyErr`?
- [ ] `MyErr{}`
- [ ] `*MyErr`
- [x] `&target`, где `var target *MyErr`
- [ ] `target`, где `var target *MyErr`
@@ explain
`errors.As` записывает найденную ошибку в переменную, поэтому ей нужен указатель на эту переменную — для `*MyErr` это `**MyErr`.

@@ q
Что выведет код?
```go
type E struct{ Err error }
func (e *E) Error() string { return "E" }

base := errors.New("base")
err := &E{Err: base}
fmt.Println(errors.Is(err, base))
```
- [ ] `true`
- [x] `false`
- [ ] Ошибка компиляции
@@ explain
У типа `E` нет метода `Unwrap`, поэтому `errors.Is` не может заглянуть внутрь и найти `base`.

@@ q
Для чего лучше подходит `errors.Is`?
- [x] Проверить, что в цепочке есть `io.EOF`
- [ ] Получить путь файла из `*os.PathError`
- [ ] Узнать HTTP-код из своей ошибки
@@ explain
`Is` сравнивает со значением. Для извлечения данных из ошибки определённого типа нужен `errors.As`.

@@ q
Что выведет код?
```go
var ErrNotFound = errors.New("not found")

func main() {
	err := fmt.Errorf("load user: %w", ErrNotFound)
	fmt.Println(err == ErrNotFound, errors.Is(err, ErrNotFound))
}
```
- [ ] `true true`
- [x] `false true`
- [ ] `false false`
- [ ] `true false`
@@ explain
`fmt.Errorf` с `%w` создаёт новую ошибку-обёртку, поэтому прямое сравнение `==` даёт `false`. `errors.Is` раскрывает цепочку и находит внутри `ErrNotFound`.

@@ q
Что выведет код?
```go
var ErrNotFound = errors.New("not found")

func main() {
	err := fmt.Errorf("load user: %v", ErrNotFound)
	fmt.Println(errors.Is(err, ErrNotFound))
}
```
- [ ] `true`
- [x] `false`
- [ ] Ошибка компиляции: для ошибок нужен `%w`
- [ ] Паника
@@ explain
`%v` подставляет только текст ошибки. Получается новая ошибка с тем же сообщением, но без ссылки на исходную — раскрывать нечего. Чтобы сохранить причину, нужен `%w`.

@@ q
Что выведет код?
```go
fmt.Println(errors.New("a") == errors.New("a"))
```
- [ ] `true` — тексты совпадают
- [x] `false`
- [ ] Ошибка компиляции: ошибки нельзя сравнивать
- [ ] Зависит от версии Go
@@ explain
Каждый вызов `errors.New` создаёт отдельное значение (внутри — указатель на новую структуру). Сравниваются указатели, а не тексты. Поэтому сигнальные ошибки объявляют один раз как переменную пакета.

@@ q
Что выведет код?
```go
type NotFound struct{ ID int }

func (e NotFound) Error() string { return "nf" }

func main() {
	err := fmt.Errorf("wrap: %w", NotFound{7})
	var nf NotFound
	var pnf *NotFound
	fmt.Println(errors.As(err, &nf), errors.As(err, &pnf))
}
```
- [ ] `true true`
- [x] `true false`
- [ ] `false true`
- [ ] `false false`
@@ explain
В цепочке лежит **значение** типа `NotFound`. `errors.As` ищет точное совпадение типа: значение `NotFound` находится, а указателя `*NotFound` в цепочке нет. Ошибки компиляции при этом не будет — просто `false`.

@@ task custom-error | HTTP-ошибки | xp=60 interview
Создайте тип `StatusError` с полями `Code int` и `Err error` и методами:

- `Error() string` — `"status 404: <текст Err>"`;
- `Unwrap() error` — возвращает `Err`.

Реализуйте:

- `Fetch(path string) error` — для `"/missing"` возвращает `&StatusError{404, ErrNotFound}`, обёрнутую ещё раз: `fmt.Errorf("fetch %s: %w", path, ...)`; для `"/secret"` — аналогично с кодом 403 и `ErrForbidden`; иначе `nil`.
- `HTTPCode(err error) int` — достаёт код через `errors.As`; если ошибки нет — 200; если ошибка не `StatusError` — 500.
@@ hint
`var se *StatusError; if errors.As(err, &se) { return se.Code }`.
@@ hint
Порядок в `HTTPCode`: сначала `err == nil` → 200, затем `errors.As`, иначе 500.
@@ starter
package main

import (
	"errors"
	"fmt"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
)

type StatusError struct {
	Code int
	Err  error
}

func Fetch(path string) error {
	return nil
}

func HTTPCode(err error) int {
	return 200
}

func main() {
	err := Fetch("/missing")
	fmt.Println(err, HTTPCode(err))
}
@@ solution
package main

import (
	"errors"
	"fmt"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
)

type StatusError struct {
	Code int
	Err  error
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("status %d: %v", e.Code, e.Err)
}

func (e *StatusError) Unwrap() error { return e.Err }

func Fetch(path string) error {
	var se *StatusError
	switch path {
	case "/missing":
		se = &StatusError{Code: 404, Err: ErrNotFound}
	case "/secret":
		se = &StatusError{Code: 403, Err: ErrForbidden}
	default:
		return nil
	}
	return fmt.Errorf("fetch %s: %w", path, se)
}

func HTTPCode(err error) int {
	if err == nil {
		return 200
	}
	var se *StatusError
	if errors.As(err, &se) {
		return se.Code
	}
	return 500
}

func main() {
	err := Fetch("/missing")
	fmt.Println(err, HTTPCode(err))
}
@@ test
package main

import (
	"errors"
	"fmt"
	"testing"
)

func TestStatusError(t *testing.T) {
	var e error = &StatusError{Code: 404, Err: ErrNotFound}
	if e.Error() != "status 404: not found" {
		t.Errorf("Error() = %q", e.Error())
	}
	if !errors.Is(e, ErrNotFound) {
		t.Error("StatusError должна разворачиваться (Unwrap) до ErrNotFound")
	}
}

func TestFetch(t *testing.T) {
	if err := Fetch("/ok"); err != nil || HTTPCode(err) != 200 {
		t.Errorf("Fetch(/ok) = %v", err)
	}
	err := Fetch("/missing")
	if err == nil || err.Error() != "fetch /missing: status 404: not found" {
		t.Errorf("Fetch(/missing) = %v", err)
	}
	if !errors.Is(err, ErrNotFound) || HTTPCode(err) != 404 {
		t.Errorf("Fetch(/missing): Is=%v code=%d", errors.Is(err, ErrNotFound), HTTPCode(err))
	}
	err = Fetch("/secret")
	if !errors.Is(err, ErrForbidden) || HTTPCode(err) != 403 {
		t.Errorf("Fetch(/secret): %v code=%d", err, HTTPCode(err))
	}
	if HTTPCode(errors.New("boom")) != 500 {
		t.Error("обычная ошибка должна давать 500")
	}
	if HTTPCode(fmt.Errorf("a: %w", fmt.Errorf("b: %w", &StatusError{418, errors.New("teapot")}))) != 418 {
		t.Error("errors.As должен находить StatusError в глубине цепочки")
	}
}

@@ task retryable | Повтор временных ошибок | xp=50
Реализуйте `Retry(attempts int, op func() error) error`:

- вызывает `op` до `attempts` раз;
- если `op` вернула `nil` — сразу `nil`;
- если ошибка **временная** — пробует снова; временной считается ошибка, у которой в цепочке есть значение с методом `Temporary() bool`, возвращающим `true` (используйте `errors.As` с интерфейсом `interface{ Temporary() bool }`);
- при постоянной ошибке — возвращает её **сразу**, без повторов;
- если попытки кончились — возвращает последнюю ошибку, обёрнутую как `fmt.Errorf("after %d attempts: %w", attempts, err)`.
@@ hint
`var tmp interface{ Temporary() bool }; if errors.As(err, &tmp) && tmp.Temporary() { continue }`.
@@ hint
`errors.As` работает и с интерфейсами: ищет в цепочке ошибку, реализующую интерфейс.
@@ starter
package main

import (
	"errors"
	"fmt"
)

func Retry(attempts int, op func() error) error {
	return op()
}

func main() {
	fmt.Println(Retry(3, func() error { return errors.New("x") }))
}
@@ solution
package main

import (
	"errors"
	"fmt"
)

func Retry(attempts int, op func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		err = op()
		if err == nil {
			return nil
		}
		var tmp interface{ Temporary() bool }
		if !(errors.As(err, &tmp) && tmp.Temporary()) {
			return err
		}
	}
	return fmt.Errorf("after %d attempts: %w", attempts, err)
}

func main() {
	fmt.Println(Retry(3, func() error { return errors.New("x") }))
}
@@ test
package main

import (
	"errors"
	"fmt"
	"testing"
)

type tempErr struct{ temp bool }

func (e tempErr) Error() string   { return fmt.Sprintf("temp=%v", e.temp) }
func (e tempErr) Temporary() bool { return e.temp }

func TestRetry(t *testing.T) {
	calls := 0
	err := Retry(5, func() error {
		calls++
		if calls < 3 {
			return fmt.Errorf("wrapped: %w", tempErr{true})
		}
		return nil
	})
	if err != nil || calls != 3 {
		t.Errorf("временные ошибки: err=%v calls=%d, ожидалось nil и 3", err, calls)
	}

	calls = 0
	perm := errors.New("permanent")
	err = Retry(5, func() error { calls++; return perm })
	if err != perm || calls != 1 {
		t.Errorf("постоянная ошибка: err=%v calls=%d, ожидалось её саму и 1 вызов", err, calls)
	}

	calls = 0
	err = Retry(3, func() error { calls++; return tempErr{true} })
	if calls != 3 || err == nil || err.Error() != "after 3 attempts: temp=true" {
		t.Errorf("исчерпание попыток: err=%v calls=%d", err, calls)
	}
	var te tempErr
	if !errors.As(err, &te) {
		t.Error("итоговая ошибка должна оборачивать последнюю")
	}

	calls = 0
	err = Retry(4, func() error { calls++; return tempErr{false} })
	if calls != 1 {
		t.Errorf("Temporary()==false — это постоянная ошибка, вызовов %d", calls)
	}
}
