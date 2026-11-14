---
id: testing
title: Тестирование, бенчмарки и go vet
summary: пакет testing, table-driven тесты, подтесты, хелперы, бенчмарки, покрытие, race detector, vet
xp: 35
---
## Первый тест

Тесты лежат в файлах `*_test.go` рядом с кодом. Тестовая функция начинается с `Test` и принимает `*testing.T`:

```go
// mathx.go
package mathx

func Abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
```

```go
// mathx_test.go
package mathx

import "testing"

func TestAbs(t *testing.T) {
	if got := Abs(-3); got != 3 {
		t.Errorf("Abs(-3) = %d, want 3", got)
	}
}
```

```bash
go test ./...            # все пакеты
go test -v -run TestAbs  # подробно, только совпадающие по regexp
go test -cover           # процент покрытия
go test -race ./...      # с детектором гонок
```

- `t.Errorf` — отметить провал и **продолжить**;
- `t.Fatalf` — отметить провал и **остановить** текущий тест;
- `t.Helper()` — в функции-хелпере, чтобы строка ошибки указывала на вызывающий тест;
- `t.Cleanup(func(){...})`, `t.TempDir()`, `t.Setenv(...)` — удобные утилиты.

## Table-driven тесты

Идиоматичный стиль Go: таблица случаев + цикл + подтесты.

```go
func TestAbs(t *testing.T) {
	tests := []struct {
		name string
		in   int
		want int
	}{
		{"positive", 5, 5},
		{"negative", -5, 5},
		{"zero", 0, 0},
		{"min+1", math.MinInt + 1, math.MaxInt},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := Abs(tt.in); got != tt.want {
				t.Errorf("Abs(%d) = %d, want %d", tt.in, got, tt.want)
			}
		})
	}
}
```

Подтесты можно запускать по отдельности: `go test -run 'TestAbs/negative'`, и параллелить через `t.Parallel()`.

> **Совет:** формат сообщения «got X, want Y» — общепринятый. Сообщение должно позволять понять проблему без чтения кода теста.

## Бенчмарки

```go
func BenchmarkAbs(b *testing.B) {
	for b.Loop() {     // Go 1.24+; раньше: for i := 0; i < b.N; i++
		Abs(-42)
	}
}
```

```bash
go test -bench=. -benchmem
# BenchmarkAbs-8   1000000000   0.25 ns/op   0 B/op   0 allocs/op
```

`-benchmem` показывает аллокации — главный ориентир при оптимизации. Для сравнения результатов используют `benchstat`.

## Примеры и фаззинг

```go
func ExampleAbs() {
	fmt.Println(Abs(-2))
	// Output: 2
}

func FuzzAbs(f *testing.F) {
	f.Add(5)
	f.Fuzz(func(t *testing.T, x int) {
		if Abs(x) < 0 && x != math.MinInt {
			t.Errorf("Abs(%d) < 0", x)
		}
	})
}
```

Пример одновременно является документацией и тестом. Фаззинг (`go test -fuzz=FuzzAbs`) генерирует входные данные, ищя падения.

## go vet и линтеры

`go vet` находит подозрительные конструкции: неправильные глаголы `Printf`, копирование мьютексов, недостижимый код, неверные теги структур. Он автоматически выполняет часть проверок при `go test`. В реальных проектах дополнительно используют `staticcheck` и `golangci-lint`.

## Тестовые двойники

В Go моки обычно не генерируют, а пишут вручную, опираясь на маленькие интерфейсы:

```go
type Clock interface{ Now() time.Time }

type fakeClock struct{ t time.Time }
func (f fakeClock) Now() time.Time { return f.t }
```

Для HTTP — пакет `net/http/httptest`, для файлов — `testing/fstest`.

@@ quiz
@@ q
Чем `t.Errorf` отличается от `t.Fatalf`?
- [ ] Ничем
- [x] `Errorf` продолжает выполнение теста, `Fatalf` останавливает текущий тест
- [ ] `Fatalf` останавливает все тесты пакета
@@ explain
`Fatalf` = `Errorf` + `FailNow()`: текущая тестовая функция прекращается, но остальные тесты выполняются.

@@ q
Какой флаг включает детектор гонок данных?
- [ ] `-v`
- [ ] `-cover`
- [x] `-race`
- [ ] `-bench`
@@ explain
`go test -race` инструментирует код и сообщает о гонках данных, обнаруженных во время выполнения тестов.

@@ q
Как запустить только подтест `negative` теста `TestAbs`?
- [ ] `go test -sub negative`
- [x] `go test -run 'TestAbs/negative'`
- [ ] `go test TestAbs.negative`
@@ explain
`-run` принимает регулярные выражения, разделённые `/` для уровней вложенности подтестов.

@@ task leap | Високосный год | xp=40
Реализуйте `IsLeap(year int) bool` по правилам григорианского календаря:

- год, кратный 4, — високосный,
- **кроме** кратных 100,
- **но** кратные 400 — снова високосные.

Скрытые тесты — табличные: 1900 (нет), 2000 (да), 2024 (да), 2023 (нет), 2100 (нет), 2400 (да) и другие.
@@ hint
`return year%4 == 0 && (year%100 != 0 || year%400 == 0)`
@@ hint
Проверьте граничные случаи 1900 и 2000 — на них чаще всего ошибаются.
@@ starter
package main

import "fmt"

func IsLeap(year int) bool {
	return year%4 == 0
}

func main() {
	fmt.Println(IsLeap(1900), IsLeap(2000), IsLeap(2024))
}
@@ solution
package main

import "fmt"

func IsLeap(year int) bool {
	return year%4 == 0 && (year%100 != 0 || year%400 == 0)
}

func main() {
	fmt.Println(IsLeap(1900), IsLeap(2000), IsLeap(2024))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func TestIsLeap(t *testing.T) {
	tests := []struct {
		year int
		want bool
	}{
		{1900, false}, {2000, true}, {2024, true}, {2023, false},
		{2100, false}, {2400, true}, {4, true}, {1, false}, {1600, true}, {1700, false},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprint(tt.year), func(t *testing.T) {
			if got := IsLeap(tt.year); got != tt.want {
				t.Errorf("IsLeap(%d) = %v, want %v", tt.year, got, tt.want)
			}
		})
	}
}

@@ task write-cases | Напишите тестовые случаи | xp=50
Теперь вы — автор тестов. Функция `Clamp(v, lo, hi int) int` уже реализована: она ограничивает `v` диапазоном `[lo, hi]`.

Заполните таблицу `ClampCases` так, чтобы она **хорошо покрывала** поведение функции. Скрытый тест проверит, что:

- случаев не меньше 6, и у каждого есть непустое уникальное имя `Name`;
- ожидаемое значение `Want` в каждом случае **правильное**;
- есть случаи: значение ниже `lo`, выше `hi`, внутри диапазона, ровно на `lo`, ровно на `hi`, и случай с отрицательными границами;
- есть вырожденный диапазон, где `lo == hi`.
@@ hint
Пример строки: `{Name: "below", V: -5, Lo: 0, Hi: 10, Want: 0}`.
@@ hint
Отрицательные границы: `{Name: "negative range", V: -20, Lo: -10, Hi: -1, Want: -10}`. Вырожденный: `Lo: 3, Hi: 3`.
@@ starter
package main

import "fmt"

func Clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

type ClampCase struct {
	Name         string
	V, Lo, Hi    int
	Want         int
}

var ClampCases = []ClampCase{
	{Name: "inside", V: 5, Lo: 0, Hi: 10, Want: 5},
}

func main() {
	for _, c := range ClampCases {
		fmt.Println(c.Name, Clamp(c.V, c.Lo, c.Hi) == c.Want)
	}
}
@@ solution
package main

import "fmt"

func Clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

type ClampCase struct {
	Name      string
	V, Lo, Hi int
	Want      int
}

var ClampCases = []ClampCase{
	{Name: "inside", V: 5, Lo: 0, Hi: 10, Want: 5},
	{Name: "below", V: -5, Lo: 0, Hi: 10, Want: 0},
	{Name: "above", V: 15, Lo: 0, Hi: 10, Want: 10},
	{Name: "at lo", V: 0, Lo: 0, Hi: 10, Want: 0},
	{Name: "at hi", V: 10, Lo: 0, Hi: 10, Want: 10},
	{Name: "negative range", V: -20, Lo: -10, Hi: -1, Want: -10},
	{Name: "degenerate", V: 7, Lo: 3, Hi: 3, Want: 3},
}

func main() {
	for _, c := range ClampCases {
		fmt.Println(c.Name, Clamp(c.V, c.Lo, c.Hi) == c.Want)
	}
}
@@ test
package main

import "testing"

func refClamp(v, lo, hi int) int { return max(lo, min(v, hi)) }

func TestClampCases(t *testing.T) {
	if len(ClampCases) < 6 {
		t.Fatalf("случаев %d, нужно не меньше 6", len(ClampCases))
	}
	names := map[string]bool{}
	var below, above, inside, atLo, atHi, negative, degenerate bool
	for _, c := range ClampCases {
		if c.Name == "" || names[c.Name] {
			t.Errorf("имя случая пустое или повторяется: %q", c.Name)
		}
		names[c.Name] = true
		if c.Lo > c.Hi {
			t.Errorf("%s: lo > hi — некорректный случай", c.Name)
			continue
		}
		if want := refClamp(c.V, c.Lo, c.Hi); c.Want != want {
			t.Errorf("%s: Want = %d, но правильный ответ %d", c.Name, c.Want, want)
		}
		switch {
		case c.V < c.Lo:
			below = true
		case c.V > c.Hi:
			above = true
		case c.V == c.Lo && c.Lo != c.Hi:
			atLo = true
		case c.V == c.Hi && c.Lo != c.Hi:
			atHi = true
		case c.Lo < c.V && c.V < c.Hi:
			inside = true
		}
		if c.Lo < 0 && c.Hi < 0 {
			negative = true
		}
		if c.Lo == c.Hi {
			degenerate = true
		}
	}
	checks := map[string]bool{"ниже lo": below, "выше hi": above, "внутри": inside, "ровно lo": atLo,
		"ровно hi": atHi, "отрицательные границы": negative, "lo == hi": degenerate}
	for name, ok := range checks {
		if !ok {
			t.Errorf("не хватает случая: %s", name)
		}
	}
}
