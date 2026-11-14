---
id: switch
title: switch
summary: switch по значению, без выражения, с инициализацией, несколько значений в case, fallthrough
xp: 20
---
## switch по значению

```go
switch day {
case "сб", "вс":           // несколько значений через запятую
	fmt.Println("выходной")
case "пн":
	fmt.Println("тяжёлый день")
default:
	fmt.Println("будни")
}
```

В отличие от C/Java, **`break` писать не нужно**: после выполнения ветки `switch` завершается автоматически.

## switch без выражения

Заменяет длинные цепочки `if-else`. Выполняется первая ветка, условие которой истинно:

```go
switch {
case score >= 90:
	grade = "A"
case score >= 75:
	grade = "B"
default:
	grade = "C"
}
```

## С инициализацией

```go
switch os := runtime.GOOS; os {
case "linux":
	fmt.Println("Linux")
case "darwin":
	fmt.Println("macOS")
}
```

## fallthrough

Ключевое слово `fallthrough` передаёт управление в **следующую** ветку **без проверки** её условия. Используется редко:

```go
switch n := 1; n {
case 1:
	fmt.Println("один")
	fallthrough
case 2:
	fmt.Println("два") // выполнится, хотя n != 2
case 3:
	fmt.Println("три") // не выполнится
}
```

## break внутри switch

`break` внутри `switch` выходит из `switch`, а **не** из окружающего `for`. Чтобы выйти из цикла, используйте метку:

```go
loop:
	for _, c := range cmds {
		switch c {
		case "quit":
			break loop
		}
	}
```

Порядок вычисления — сверху вниз, слева направо; выражения case могут быть не константами, а любыми выражениями, включая вызовы функций.

> **Совет:** существует ещё `type switch` — `switch v := x.(type)` для интерфейсов. Его разберём в модуле «Интерфейсы».

@@ quiz
@@ q
Что выведет код?
```go
switch x := 2; x {
case 1:
	fmt.Print("a")
case 2:
	fmt.Print("b")
	fallthrough
case 3:
	fmt.Print("c")
case 4:
	fmt.Print("d")
}
```
- [ ] `b`
- [x] `bc`
- [ ] `bcd`
- [ ] `abcd`
@@ explain
Выполняется ветка `case 2`, `fallthrough` безусловно переходит в `case 3`. Там нет `fallthrough`, поэтому `switch` завершается.

@@ q
Что делает `break` внутри `switch`, который находится в цикле `for`?
- [ ] Выходит из цикла `for`
- [x] Выходит только из `switch`
- [ ] Ошибка компиляции
@@ explain
`break` прерывает ближайшую конструкцию `for`, `switch` или `select`. Для выхода из цикла используют метку: `break loop`.

@@ q
Нужно ли писать `break` в конце каждого `case`?
- [x] Нет, переход в следующую ветку не происходит автоматически
- [ ] Да, иначе выполнится следующая ветка
- [ ] Только в `default`
@@ explain
В Go ветки не «проваливаются» по умолчанию. Для явного перехода есть `fallthrough`.

@@ task grade | Оценка по баллам | xp=40
Реализуйте `Grade(score int) string`:

| Баллы | Результат |
|---|---|
| меньше 0 или больше 100 | `"invalid"` |
| 90–100 | `"A"` |
| 75–89 | `"B"` |
| 60–74 | `"C"` |
| 0–59 | `"F"` |

Используйте `switch` без выражения.
@@ hint
Первая ветка: `case score < 0 || score > 100:`.
@@ hint
Остальные ветки проверяйте от большего порога к меньшему.
@@ starter
package main

import "fmt"

func Grade(score int) string {
	return ""
}

func main() {
	fmt.Println(Grade(95), Grade(80), Grade(10))
}
@@ solution
package main

import "fmt"

func Grade(score int) string {
	switch {
	case score < 0 || score > 100:
		return "invalid"
	case score >= 90:
		return "A"
	case score >= 75:
		return "B"
	case score >= 60:
		return "C"
	default:
		return "F"
	}
}

func main() {
	fmt.Println(Grade(95), Grade(80), Grade(10))
}
@@ test
package main

import "testing"

func TestGrade(t *testing.T) {
	cases := map[int]string{-1: "invalid", 101: "invalid", 100: "A", 90: "A", 89: "B", 75: "B", 74: "C", 60: "C", 59: "F", 0: "F"}
	for in, want := range cases {
		if got := Grade(in); got != want {
			t.Errorf("Grade(%d) = %q, ожидалось %q", in, got, want)
		}
	}
}

@@ task http-status | Класс HTTP-статуса | xp=40
Реализуйте `StatusClass(code int) string`, которая возвращает:

- `"informational"` для 100–199
- `"success"` для 200–299
- `"redirect"` для 300–399
- `"client error"` для 400–499
- `"server error"` для 500–599
- `"unknown"` для остального

Попробуйте элегантное решение: `switch code / 100 { case 1: ... }`.
@@ hint
`code / 100` для 404 даёт 4 — целочисленное деление.
@@ hint
Не забудьте, что `-50 / 100` = 0, а `99 / 100` тоже 0 — обе попадут в `default`.
@@ starter
package main

import "fmt"

func StatusClass(code int) string {
	return "unknown"
}

func main() {
	fmt.Println(StatusClass(404))
}
@@ solution
package main

import "fmt"

func StatusClass(code int) string {
	switch code / 100 {
	case 1:
		return "informational"
	case 2:
		return "success"
	case 3:
		return "redirect"
	case 4:
		return "client error"
	case 5:
		return "server error"
	default:
		return "unknown"
	}
}

func main() {
	fmt.Println(StatusClass(404))
}
@@ test
package main

import "testing"

func TestStatusClass(t *testing.T) {
	cases := map[int]string{100: "informational", 199: "informational", 200: "success", 204: "success", 301: "redirect",
		404: "client error", 499: "client error", 500: "server error", 503: "server error", 600: "unknown", 99: "unknown", -200: "unknown", 0: "unknown"}
	for in, want := range cases {
		if got := StatusClass(in); got != want {
			t.Errorf("StatusClass(%d) = %q, ожидалось %q", in, got, want)
		}
	}
}
