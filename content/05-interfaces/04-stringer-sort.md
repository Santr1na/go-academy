---
id: stringer-sort
title: Stringer и сортировка
summary: fmt.Stringer, sort.Interface, sort.Slice, slices.SortFunc, cmp.Compare, стабильная сортировка
xp: 30
---
## fmt.Stringer

Если тип реализует `String() string`, пакет `fmt` использует этот метод при печати через `%v`, `%s` и `Println`:

```go
type Color int

const (
	Red Color = iota
	Green
	Blue
)

func (c Color) String() string {
	switch c {
	case Red:
		return "красный"
	case Green:
		return "зелёный"
	case Blue:
		return "синий"
	}
	return fmt.Sprintf("Color(%d)", int(c))
}

fmt.Println(Green)          // зелёный
fmt.Printf("%v %d\n", Blue, Blue) // синий 2
```

> **Ловушка:** не вызывайте `fmt.Sprint(c)` или `%v` для самого `c` внутри `String()` — получится бесконечная рекурсия. Преобразуйте к базовому типу: `int(c)`.

> **Ловушка:** если `String()` объявлен с указательным получателем, то при печати **значения** (не указателя) он не будет вызван.

## sort.Interface

Классический способ отсортировать коллекцию — реализовать три метода:

```go
type Interface interface {
	Len() int
	Less(i, j int) bool
	Swap(i, j int)
}

type ByAge []Person

func (a ByAge) Len() int           { return len(a) }
func (a ByAge) Less(i, j int) bool { return a[i].Age < a[j].Age }
func (a ByAge) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }

sort.Sort(ByAge(people))
```

`sort.Sort` не гарантирует сохранение порядка равных элементов. Для этого есть `sort.Stable`.

## sort.Slice и slices.SortFunc

На практике чаще используют функции с компаратором:

```go
sort.Slice(people, func(i, j int) bool {
	return people[i].Name < people[j].Name
})

// Go 1.21+: типобезопасно и обычно быстрее
slices.SortFunc(people, func(a, b Person) int {
	return cmp.Compare(a.Age, b.Age) // <0, 0, >0
})
slices.SortStableFunc(people, ...)
```

### Сортировка по нескольким ключам

```go
slices.SortFunc(people, func(a, b Person) int {
	if c := cmp.Compare(b.Score, a.Score); c != 0 { // по убыванию баллов
		return c
	}
	return cmp.Compare(a.Name, b.Name)             // затем по имени
})
// или короче: cmp.Or(cmp.Compare(b.Score, a.Score), cmp.Compare(a.Name, b.Name))
```

## Простые случаи

```go
sort.Ints(xs); sort.Strings(ss)       // старый API
slices.Sort(xs)                        // новый, для любых упорядоченных типов
i, found := slices.BinarySearch(xs, 42) // бинарный поиск в отсортированном
```

Сложность сортировки в стандартной библиотеке — O(n log n) (pdqsort).

@@ quiz
@@ q
Что выведет код?
```go
type T struct{ n int }
func (t *T) String() string { return "T!" }
func main() {
	fmt.Println(T{1}, &T{2})
}
```
- [ ] `T! T!`
- [x] `{1} T!`
- [ ] `{1} {2}`
@@ explain
`String` объявлен для `*T`. У значения `T{1}` в method set нет этого метода, поэтому `fmt` печатает поля. Для указателя `&T{2}` вызывается `String()`.

@@ q
Что вернёт `cmp.Compare(5, 3)`?
- [ ] `true`
- [ ] `-1`
- [x] `+1`
- [ ] `2`
@@ explain
`cmp.Compare(a, b)` возвращает -1, если a < b, 0 при равенстве и +1, если a > b.

@@ q
Какая функция сохраняет исходный порядок равных элементов?
- [ ] `sort.Sort`
- [ ] `sort.Slice`
- [x] `sort.Stable` / `slices.SortStableFunc`
@@ explain
Стабильная сортировка гарантирует, что равные элементы сохранят взаимный порядок. Обычная сортировка (pdqsort) этого не гарантирует.

@@ task stringer | Stringer для перечисления | xp=40
Дан тип `Level int` с константами `Debug`, `Info`, `Warn`, `Error` (0…3).

1. Реализуйте `String()` так, чтобы `fmt.Sprint(Info)` давал `"INFO"`, а неизвестные значения — `"Level(7)"`.
2. Реализуйте `ParseLevel(s string) (Level, bool)` — обратное преобразование без учёта регистра (`"warn"` → `Warn, true`).
@@ hint
`func (l Level) String() string { switch l { case Debug: return "DEBUG" ... } return fmt.Sprintf("Level(%d)", int(l)) }` — обязательно `int(l)`, иначе рекурсия.
@@ hint
В `ParseLevel` переберите уровни от `Debug` до `Error` и сравните `strings.EqualFold(l.String(), s)`.
@@ starter
package main

import "fmt"

type Level int

const (
	Debug Level = iota
	Info
	Warn
	Error
)

func ParseLevel(s string) (Level, bool) {
	return 0, false
}

func main() {
	fmt.Println(Info, Level(7))
}
@@ solution
package main

import (
	"fmt"
	"strings"
)

type Level int

const (
	Debug Level = iota
	Info
	Warn
	Error
)

func (l Level) String() string {
	switch l {
	case Debug:
		return "DEBUG"
	case Info:
		return "INFO"
	case Warn:
		return "WARN"
	case Error:
		return "ERROR"
	}
	return fmt.Sprintf("Level(%d)", int(l))
}

func ParseLevel(s string) (Level, bool) {
	for l := Debug; l <= Error; l++ {
		if strings.EqualFold(l.String(), s) {
			return l, true
		}
	}
	return 0, false
}

func main() {
	fmt.Println(Info, Level(7))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func TestLevel(t *testing.T) {
	want := map[Level]string{Debug: "DEBUG", Info: "INFO", Warn: "WARN", Error: "ERROR", 7: "Level(7)", -1: "Level(-1)"}
	for l, w := range want {
		if got := fmt.Sprint(l); got != w {
			t.Errorf("fmt.Sprint(Level(%d)) = %q, ожидалось %q", int(l), got, w)
		}
	}
	for s, w := range map[string]Level{"debug": Debug, "INFO": Info, "Warn": Warn, "error": Error} {
		if got, ok := ParseLevel(s); !ok || got != w {
			t.Errorf("ParseLevel(%q) = %d, %v", s, int(got), ok)
		}
	}
	if _, ok := ParseLevel("fatal"); ok {
		t.Error("ParseLevel(fatal) должен вернуть false")
	}
}

@@ task leaderboard | Таблица лидеров | xp=50 interview
Дан тип:

```go
type Player struct {
	Name  string
	Score int
	Time  int // секунды, меньше — лучше
}
```

Реализуйте `Rank(players []Player) []string` — возвращает имена в порядке рейтинга, **не изменяя** исходный срез:

1. по убыванию `Score`;
2. при равном счёте — по возрастанию `Time`;
3. при равенстве обоих — по имени в алфавитном порядке.
@@ hint
Скопируйте срез через `slices.Clone`, затем `slices.SortFunc` с компаратором.
@@ hint
`cmp.Or(cmp.Compare(b.Score, a.Score), cmp.Compare(a.Time, b.Time), cmp.Compare(a.Name, b.Name))` — `cmp.Or` возвращает первый ненулевой аргумент.
@@ starter
package main

import "fmt"

type Player struct {
	Name  string
	Score int
	Time  int
}

func Rank(players []Player) []string {
	var names []string
	for _, p := range players {
		names = append(names, p.Name)
	}
	return names
}

func main() {
	fmt.Println(Rank([]Player{{"bob", 10, 50}, {"amy", 20, 70}}))
}
@@ solution
package main

import (
	"cmp"
	"fmt"
	"slices"
)

type Player struct {
	Name  string
	Score int
	Time  int
}

func Rank(players []Player) []string {
	sorted := slices.Clone(players)
	slices.SortFunc(sorted, func(a, b Player) int {
		return cmp.Or(
			cmp.Compare(b.Score, a.Score),
			cmp.Compare(a.Time, b.Time),
			cmp.Compare(a.Name, b.Name),
		)
	})
	names := make([]string, len(sorted))
	for i, p := range sorted {
		names[i] = p.Name
	}
	return names
}

func main() {
	fmt.Println(Rank([]Player{{"bob", 10, 50}, {"amy", 20, 70}}))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func TestRank(t *testing.T) {
	in := []Player{
		{"dan", 50, 100}, {"amy", 80, 90}, {"bob", 80, 60},
		{"eve", 50, 100}, {"cat", 80, 60}, {"fox", 10, 1},
	}
	orig := fmt.Sprint(in)
	got := fmt.Sprint(Rank(in))
	want := "[bob cat amy dan eve fox]"
	if got != want {
		t.Errorf("Rank = %s, ожидалось %s", got, want)
	}
	if fmt.Sprint(in) != orig {
		t.Error("исходный срез не должен изменяться")
	}
	if len(Rank(nil)) != 0 {
		t.Error("Rank(nil) должен вернуть пустой результат")
	}
}
