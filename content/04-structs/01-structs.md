---
id: structs
title: Структуры
summary: объявление struct, литералы, доступ к полям, анонимные структуры, сравнение, теги
xp: 25
---
## Объявление и создание

Структура объединяет именованные поля разных типов:

```go
type User struct {
	ID    int
	Name  string
	Email string
	Admin bool
}

u1 := User{ID: 1, Name: "Аня"}       // по именам (рекомендуется); остальные поля — нулевые
u2 := User{2, "Боря", "b@x.ru", false} // позиционно — хрупко, все поля обязательны
var u3 User                           // все поля нулевые
p := &User{Name: "Вика"}               // указатель на новую структуру

u1.Email = "anya@example.com"
p.Name = "Виктория" // автоматическое разыменование: то же, что (*p).Name
```

## Структуры копируются

Структура — значение. Присваивание и передача в функцию копируют все поля:

```go
a := User{Name: "A"}
b := a
b.Name = "B"
fmt.Println(a.Name) // A
```

Чтобы функция могла изменить структуру, передайте указатель `*User`.

## Сравнение

Структуры сравнимы через `==`, если сравнимы все их поля. Структура со срезом или map внутри не сравнима:

```go
type Point struct{ X, Y int }
fmt.Println(Point{1, 2} == Point{1, 2}) // true
```

Сравнимые структуры можно использовать как ключи map: `map[Point]string`.

## Анонимные структуры

Удобны для одноразовых данных — тестовых таблиц, JSON-ответов:

```go
cfg := struct {
	Host string
	Port int
}{"localhost", 8080}

tests := []struct {
	in   int
	want int
}{
	{1, 2},
	{2, 4},
}
```

## Пустая структура

`struct{}` занимает 0 байт. Используется в множествах `map[string]struct{}` и как сигнал в каналах `chan struct{}`.

## Теги полей

Строка после типа поля — тег. Его читают библиотеки через рефлексию, например `encoding/json`:

```go
type Product struct {
	ID    int     `json:"id"`
	Title string  `json:"title"`
	Price float64 `json:"price,omitempty"`
	secret string // неэкспортируемое поле — json его не видит
}
```

## Выравнивание полей

Компилятор выравнивает поля в памяти. Порядок полей влияет на размер структуры:

```go
type Bad struct {  // 24 байта
	a bool  // 1 + 7 байт выравнивания
	b int64 // 8
	c bool  // 1 + 7
}
type Good struct { // 16 байт
	b int64
	a bool
	c bool
}
```

`unsafe.Sizeof(Bad{})` покажет размер. Для миллионов объектов это существенно.

@@ quiz
@@ q
Что выведет код?
```go
type P struct{ X int }
func move(p P) { p.X = 10 }
func main() {
	p := P{1}
	move(p)
	fmt.Println(p.X)
}
```
- [x] 1
- [ ] 10
- [ ] Ошибка компиляции
@@ explain
Структура передаётся по значению — функция меняет копию. Чтобы изменить оригинал, нужен указатель `*P`.

@@ q
Какая структура может быть ключом map?
- [x] `struct{ A int; B string }`
- [ ] `struct{ Tags []string }`
- [ ] `struct{ M map[string]int }`
@@ explain
Ключ map должен быть сравнимым. Структуры со срезами или map внутри несравнимы.

@@ q
Сколько памяти занимает значение `struct{}{}`?
- [x] 0 байт
- [ ] 1 байт
- [ ] 8 байт
@@ explain
Пустая структура не содержит данных и занимает 0 байт — поэтому `map[K]struct{}` экономнее, чем `map[K]bool`.

@@ task points | Точки и прямоугольники | xp=40
Даны типы:

```go
type Point struct{ X, Y float64 }
type Rect struct{ Min, Max Point } // левый нижний и правый верхний углы
```

Реализуйте функции:

- `Distance(a, b Point) float64` — евклидово расстояние (`math.Hypot`);
- `Contains(r Rect, p Point) bool` — лежит ли точка внутри прямоугольника или на его границе;
- `Center(r Rect) Point` — центр прямоугольника.
@@ hint
`math.Hypot(dx, dy)` = √(dx² + dy²).
@@ hint
Точка внутри, если `r.Min.X <= p.X && p.X <= r.Max.X` и аналогично по Y.
@@ starter
package main

import "fmt"

type Point struct{ X, Y float64 }
type Rect struct{ Min, Max Point }

func Distance(a, b Point) float64 {
	return 0
}

func Contains(r Rect, p Point) bool {
	return false
}

func Center(r Rect) Point {
	return Point{}
}

func main() {
	r := Rect{Point{0, 0}, Point{4, 2}}
	fmt.Println(Distance(Point{0, 0}, Point{3, 4}), Contains(r, Point{1, 1}), Center(r))
}
@@ solution
package main

import (
	"fmt"
	"math"
)

type Point struct{ X, Y float64 }
type Rect struct{ Min, Max Point }

func Distance(a, b Point) float64 {
	return math.Hypot(b.X-a.X, b.Y-a.Y)
}

func Contains(r Rect, p Point) bool {
	return r.Min.X <= p.X && p.X <= r.Max.X && r.Min.Y <= p.Y && p.Y <= r.Max.Y
}

func Center(r Rect) Point {
	return Point{(r.Min.X + r.Max.X) / 2, (r.Min.Y + r.Max.Y) / 2}
}

func main() {
	r := Rect{Point{0, 0}, Point{4, 2}}
	fmt.Println(Distance(Point{0, 0}, Point{3, 4}), Contains(r, Point{1, 1}), Center(r))
}
@@ test
package main

import "testing"

func TestPoints(t *testing.T) {
	if d := Distance(Point{0, 0}, Point{3, 4}); d != 5 {
		t.Errorf("Distance((0,0),(3,4)) = %v, ожидалось 5", d)
	}
	if d := Distance(Point{-1, -1}, Point{-1, -1}); d != 0 {
		t.Errorf("Distance до самой себя = %v", d)
	}
	r := Rect{Point{0, 0}, Point{4, 2}}
	in := []Point{{1, 1}, {0, 0}, {4, 2}, {4, 0}}
	out := []Point{{5, 1}, {-0.1, 1}, {2, 2.5}, {2, -1}}
	for _, p := range in {
		if !Contains(r, p) {
			t.Errorf("Contains(%v, %v) = false, ожидалось true", r, p)
		}
	}
	for _, p := range out {
		if Contains(r, p) {
			t.Errorf("Contains(%v, %v) = true, ожидалось false", r, p)
		}
	}
	if c := Center(r); c != (Point{2, 1}) {
		t.Errorf("Center = %v, ожидалось {2 1}", c)
	}
}

@@ task group-by | Группировка студентов | xp=50
Дан тип:

```go
type Student struct {
	Name  string
	Group string
	Score int
}
```

Реализуйте `BestByGroup(students []Student) map[string]Student` — для каждой группы вернуть студента с максимальным баллом (при равенстве — того, кто встретился раньше).
@@ hint
Используйте comma ok: `best, ok := res[s.Group]`; если `!ok || s.Score > best.Score` — запишите `res[s.Group] = s`.
@@ hint
Строгое `>` гарантирует, что при равенстве останется первый студент.
@@ starter
package main

import "fmt"

type Student struct {
	Name  string
	Group string
	Score int
}

func BestByGroup(students []Student) map[string]Student {
	return nil
}

func main() {
	fmt.Println(BestByGroup([]Student{{"Аня", "A", 90}, {"Боря", "A", 95}, {"Вика", "B", 70}}))
}
@@ solution
package main

import "fmt"

type Student struct {
	Name  string
	Group string
	Score int
}

func BestByGroup(students []Student) map[string]Student {
	res := make(map[string]Student)
	for _, s := range students {
		if best, ok := res[s.Group]; !ok || s.Score > best.Score {
			res[s.Group] = s
		}
	}
	return res
}

func main() {
	fmt.Println(BestByGroup([]Student{{"Аня", "A", 90}, {"Боря", "A", 95}, {"Вика", "B", 70}}))
}
@@ test
package main

import "testing"

func TestBestByGroup(t *testing.T) {
	in := []Student{
		{"Аня", "A", 90}, {"Боря", "A", 95}, {"Вика", "B", 70},
		{"Гоша", "B", 70}, {"Дима", "C", 0}, {"Ева", "A", 95},
	}
	got := BestByGroup(in)
	want := map[string]string{"A": "Боря", "B": "Вика", "C": "Дима"}
	if len(got) != len(want) {
		t.Fatalf("получено %d групп, ожидалось %d: %v", len(got), len(want), got)
	}
	for g, name := range want {
		if got[g].Name != name {
			t.Errorf("группа %s: лучший %q, ожидался %q", g, got[g].Name, name)
		}
	}
	if r := BestByGroup(nil); r == nil || len(r) != 0 {
		t.Errorf("для пустого входа ожидалась пустая (не nil) map")
	}
}
