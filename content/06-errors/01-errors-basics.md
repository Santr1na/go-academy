---
id: errors-basics
title: Ошибки как значения
summary: интерфейс error, errors.New, fmt.Errorf, sentinel-ошибки, оборачивание через %w
xp: 30
---
## Ошибка — это просто значение

В Go нет исключений. Функция, которая может завершиться неудачей, возвращает ошибку **последним результатом**:

```go
type error interface {
	Error() string
}

f, err := os.Open("config.yaml")
if err != nil {
	return fmt.Errorf("загрузка конфига: %w", err)
}
defer f.Close()
```

Проверка `if err != nil` сразу после вызова — главная идиома языка. Явность делает поток ошибок видимым при чтении кода.

## Создание ошибок

```go
err := errors.New("файл пуст")
err := fmt.Errorf("пользователь %d не найден", id)
```

Тексты ошибок принято писать **с маленькой буквы и без точки в конце** — они часто склеиваются в цепочки: `загрузка конфига: открытие файла: permission denied`.

## Sentinel-ошибки

Заранее объявленные значения ошибок, с которыми можно сравнивать:

```go
var ErrNotFound = errors.New("not found")

func Find(id int) (*User, error) {
	if ... {
		return nil, ErrNotFound
	}
}

if errors.Is(err, ErrNotFound) { ... }
```

Примеры из стандартной библиотеки: `io.EOF`, `sql.ErrNoRows`, `os.ErrNotExist`, `context.Canceled`.

## Оборачивание: %w

`fmt.Errorf` с глаголом `%w` **оборачивает** ошибку: добавляет контекст, сохраняя исходную ошибку внутри цепочки.

```go
func loadUser(id int) error {
	if _, err := Find(id); err != nil {
		return fmt.Errorf("loadUser %d: %w", id, err)
	}
	return nil
}

err := loadUser(42)
fmt.Println(err)                         // loadUser 42: not found
fmt.Println(err == ErrNotFound)          // false — это другая ошибка
fmt.Println(errors.Is(err, ErrNotFound)) // true — Is разворачивает цепочку
```

- `%w` — оборачивает (доступно через `errors.Unwrap`, `errors.Is`, `errors.As`);
- `%v` — только вставляет текст, связь с исходной ошибкой теряется.

С Go 1.20 можно оборачивать несколько ошибок: `fmt.Errorf("%w; %w", e1, e2)` или `errors.Join(e1, e2)`.

## Правила хорошего тона

1. Обрабатывайте ошибку **один раз**: либо залогируйте, либо верните выше — не то и другое сразу.
2. Добавляйте контекст при возврате: что вы пытались сделать.
3. Не игнорируйте ошибки молча. Если это осознанно — `_ = f.Close()` с комментарием.
4. Не используйте `panic` для обычных ошибок.

> **Совет:** оборачивание делает ошибку частью вашего API. Если вы не хотите, чтобы вызывающие зависели от внутренней ошибки (например, от драйвера БД), используйте `%v`.

@@ quiz
@@ q
Что выведет код?
```go
var ErrX = errors.New("x")
err := fmt.Errorf("ctx: %w", ErrX)
fmt.Println(err == ErrX, errors.Is(err, ErrX))
```
- [ ] `true true`
- [x] `false true`
- [ ] `false false`
@@ explain
`fmt.Errorf` создаёт новую ошибку, поэтому `==` даёт false. `errors.Is` проходит по цепочке оборачивания и находит `ErrX`.

@@ q
Чем `%w` отличается от `%v` в `fmt.Errorf`?
- [ ] Ничем, это синонимы
- [x] `%w` сохраняет исходную ошибку в цепочке, `%v` — только её текст
- [ ] `%w` печатает стек вызовов
@@ explain
С `%w` исходную ошибку можно извлечь через `errors.Unwrap/Is/As`. С `%v` остаётся лишь строка.

@@ q
Как принято писать текст ошибки?
- [ ] `"Не удалось открыть файл."`
- [x] `"open config: file not found"`
- [ ] `"ERROR!!! FILE"`
@@ explain
С маленькой буквы, без точки в конце — так ошибки красиво склеиваются в цепочки контекстов через двоеточия.

@@ task parse-age | Разбор возраста с sentinel-ошибками | xp=50
Объявите sentinel-ошибки:

```go
var ErrEmpty = errors.New("empty input")
var ErrNotNumber = errors.New("not a number")
var ErrOutOfRange = errors.New("out of range")
```

Реализуйте `ParseAge(s string) (int, error)`:

- пробелы по краям игнорируются (`strings.TrimSpace`);
- пустая строка → `ErrEmpty`;
- не число → ошибка, **оборачивающая** `ErrNotNumber`, с текстом вида `parse "abc": not a number`;
- число вне 0…150 → ошибка, оборачивающая `ErrOutOfRange`, с текстом `age 200: out of range`.
@@ hint
`n, err := strconv.Atoi(s); if err != nil { return 0, fmt.Errorf("parse %q: %w", s, ErrNotNumber) }`.
@@ hint
Проверяйте ошибки через `errors.Is(err, ErrNotNumber)` в своих экспериментах.
@@ starter
package main

import (
	"errors"
	"fmt"
	"strconv"
)

var ErrEmpty = errors.New("empty input")
var ErrNotNumber = errors.New("not a number")
var ErrOutOfRange = errors.New("out of range")

func ParseAge(s string) (int, error) {
	n, _ := strconv.Atoi(s)
	return n, nil
}

func main() {
	fmt.Println(ParseAge(" 42 "))
	fmt.Println(ParseAge("abc"))
}
@@ solution
package main

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var ErrEmpty = errors.New("empty input")
var ErrNotNumber = errors.New("not a number")
var ErrOutOfRange = errors.New("out of range")

func ParseAge(s string) (int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, ErrEmpty
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("parse %q: %w", s, ErrNotNumber)
	}
	if n < 0 || n > 150 {
		return 0, fmt.Errorf("age %d: %w", n, ErrOutOfRange)
	}
	return n, nil
}

func main() {
	fmt.Println(ParseAge(" 42 "))
	fmt.Println(ParseAge("abc"))
}
@@ test
package main

import (
	"errors"
	"testing"
)

func TestParseAge(t *testing.T) {
	if n, err := ParseAge(" 42 "); n != 42 || err != nil {
		t.Errorf("ParseAge(\" 42 \") = %d, %v", n, err)
	}
	if n, err := ParseAge("0"); n != 0 || err != nil {
		t.Errorf("ParseAge(\"0\") = %d, %v", n, err)
	}
	cases := []struct {
		in   string
		want error
		text string
	}{
		{"", ErrEmpty, "empty input"},
		{"   ", ErrEmpty, "empty input"},
		{"abc", ErrNotNumber, `parse "abc": not a number`},
		{"12x", ErrNotNumber, `parse "12x": not a number`},
		{"200", ErrOutOfRange, "age 200: out of range"},
		{"-1", ErrOutOfRange, "age -1: out of range"},
	}
	for _, c := range cases {
		_, err := ParseAge(c.in)
		if !errors.Is(err, c.want) {
			t.Errorf("ParseAge(%q): ошибка %v не оборачивает %v", c.in, err, c.want)
			continue
		}
		if err.Error() != c.text {
			t.Errorf("ParseAge(%q): текст %q, ожидалось %q", c.in, err.Error(), c.text)
		}
	}
}

@@ task join-errors | Сбор всех ошибок валидации | xp=40
Реализуйте `ValidateUser(name, email string, age int) error`, которая проверяет **все** поля и возвращает объединённую ошибку через `errors.Join` (или `nil`, если всё верно):

- пустое `name` → `ErrNoName`
- `email` без символа `@` → `ErrBadEmail`
- `age < 18` → `ErrTooYoung`

Ошибки объявлены в заготовке. Порядок в Join: name, email, age.
@@ hint
Соберите `var errs []error`, добавляйте при каждой проблеме, в конце `return errors.Join(errs...)`.
@@ hint
`errors.Join` без аргументов (или только с nil) возвращает `nil` — отдельная проверка не нужна.
@@ starter
package main

import (
	"errors"
	"fmt"
)

var (
	ErrNoName   = errors.New("name is required")
	ErrBadEmail = errors.New("email is invalid")
	ErrTooYoung = errors.New("age must be at least 18")
)

func ValidateUser(name, email string, age int) error {
	if name == "" {
		return ErrNoName
	}
	return nil
}

func main() {
	fmt.Println(ValidateUser("", "bad", 10))
}
@@ solution
package main

import (
	"errors"
	"fmt"
	"strings"
)

var (
	ErrNoName   = errors.New("name is required")
	ErrBadEmail = errors.New("email is invalid")
	ErrTooYoung = errors.New("age must be at least 18")
)

func ValidateUser(name, email string, age int) error {
	var errs []error
	if name == "" {
		errs = append(errs, ErrNoName)
	}
	if !strings.Contains(email, "@") {
		errs = append(errs, ErrBadEmail)
	}
	if age < 18 {
		errs = append(errs, ErrTooYoung)
	}
	return errors.Join(errs...)
}

func main() {
	fmt.Println(ValidateUser("", "bad", 10))
}
@@ test
package main

import (
	"errors"
	"testing"
)

func TestValidateUser(t *testing.T) {
	if err := ValidateUser("Аня", "a@b.c", 20); err != nil {
		t.Errorf("корректные данные: ошибка %v", err)
	}
	err := ValidateUser("", "bad", 10)
	for _, e := range []error{ErrNoName, ErrBadEmail, ErrTooYoung} {
		if !errors.Is(err, e) {
			t.Errorf("ошибка должна содержать %q, получено %v", e, err)
		}
	}
	want := "name is required\nemail is invalid\nage must be at least 18"
	if err != nil && err.Error() != want {
		t.Errorf("текст ошибки %q, ожидалось %q", err.Error(), want)
	}
	err = ValidateUser("Боб", "nope", 30)
	if !errors.Is(err, ErrBadEmail) || errors.Is(err, ErrNoName) || errors.Is(err, ErrTooYoung) {
		t.Errorf("ожидалась только ErrBadEmail, получено %v", err)
	}
}
