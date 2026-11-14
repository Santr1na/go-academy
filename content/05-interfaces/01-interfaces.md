---
id: interfaces
title: Интерфейсы и неявная реализация
summary: объявление интерфейсов, утиная типизация, полиморфизм, маленькие интерфейсы, method sets
xp: 30
---
## Интерфейс — набор методов

Интерфейс описывает **поведение**: какие методы должны быть у типа.

```go
type Shape interface {
	Area() float64
	Perimeter() float64
}
```

## Неявная реализация

В Go нет ключевого слова `implements`. Тип реализует интерфейс **автоматически**, если у него есть все нужные методы:

```go
type Rect struct{ W, H float64 }
func (r Rect) Area() float64      { return r.W * r.H }
func (r Rect) Perimeter() float64 { return 2 * (r.W + r.H) }

type Circle struct{ R float64 }
func (c Circle) Area() float64      { return math.Pi * c.R * c.R }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.R }

shapes := []Shape{Rect{3, 4}, Circle{1}}
for _, s := range shapes {
	fmt.Printf("%T: %.2f\n", s, s.Area())
}
```

Это позволяет объявлять интерфейс **там, где он используется** (у потребителя), а не там, где реализован. Типы из чужих пакетов могут удовлетворять вашим интерфейсам, даже не зная о них.

> **Совет:** «Accept interfaces, return structs» — принимайте интерфейсы в параметрах, возвращайте конкретные типы.

## Маленькие интерфейсы

Лучшие интерфейсы стандартной библиотеки — из одного-двух методов:

```go
type Reader interface { Read(p []byte) (n int, err error) }
type Writer interface { Write(p []byte) (n int, err error) }
type Stringer interface { String() string }
type error interface { Error() string }
```

Их можно комбинировать встраиванием:

```go
type ReadWriter interface {
	Reader
	Writer
}
```

«The bigger the interface, the weaker the abstraction» — Роб Пайк.

## Указательные получатели и интерфейсы

Если метод объявлен с pointer receiver, интерфейс реализует только **указатель**:

```go
type Counter struct{ n int }
func (c *Counter) Inc() { c.n++ }

type Incrementer interface{ Inc() }

var i Incrementer = &Counter{} // ок
// var j Incrementer = Counter{} // ошибка: Counter does not implement Incrementer (method Inc has pointer receiver)
```

## Проверка реализации на этапе компиляции

```go
var _ Shape = Rect{}        // не скомпилируется, если Rect перестанет реализовывать Shape
var _ Incrementer = (*Counter)(nil)
```

## Что внутри интерфейса

Значение интерфейсного типа — пара **(динамический тип, динамическое значение)**. Вызов метода — косвенный, через таблицу методов (itab). Интерфейсы сравнимы через `==`: равны, если равны и типы, и значения (паника, если динамический тип несравним, например срез).

## Разбираем подробнее: зачем это всё

Интерфейсы трудно понять, пока не видно задачи, которую они решают. Вот она.

Допустим, функция считает суммарную площадь фигур. Без интерфейсов пришлось бы писать её отдельно для кругов, отдельно для квадратов и переписывать при появлении каждой новой фигуры. С интерфейсом функция говорит: «мне всё равно, что это; мне нужно только, чтобы у этого был метод `Area`».

```go
type Shape interface {
	Area() float64
}

type Square struct{ Side float64 }
type Circle struct{ R float64 }

func (s Square) Area() float64 { return s.Side * s.Side }
func (c Circle) Area() float64 { return math.Pi * c.R * c.R }

func Total(shapes []Shape) float64 {
	sum := 0.0
	for _, s := range shapes {
		sum += s.Area() // у каждого значения вызовется свой метод
	}
	return sum
}

fmt.Println(Total([]Shape{Square{2}, Circle{1}})) // 7.14…
```

Функция `Total` написана один раз и работает с любым типом, у которого есть `Area()`, — в том числе с тем, который напишут через год.

### Через интерфейс видно только то, что в нём объявлено

```go
var sh Shape = Square{2}
fmt.Println(sh.Area()) // 4
fmt.Println(sh.Side)   // ошибка компиляции: у типа Shape нет поля Side
```

Интерфейс — это «окно» определённой формы. Внутри лежит целый `Square`, но через окно `Shape` виден только метод `Area`. Чтобы добраться до остального, нужно утверждение типа — о нём следующий урок.

### В интерфейсе лежит копия значения — или указатель

```go
type Namer interface{ Name() string }
type User struct{ name string }

func (u User) Name() string { return u.name }

u := User{"a"}
var n1 Namer = u  // в интерфейс скопировано значение
var n2 Namer = &u // в интерфейс положен адрес
u.name = "b"
fmt.Println(n1.Name(), n2.Name()) // a b
```

`n1` хранит свою копию структуры и о дальнейших изменениях `u` не знает. `n2` хранит адрес и видит актуальные данные.

### Встраивание и интерфейсы

Методы встроенного типа «поднимаются» наверх, поэтому внешний тип тоже удовлетворяет интерфейсу. А если внешний тип объявит метод с тем же именем — победит его версия:

```go
type Animal interface{ Sound() string }

type Base struct{}
func (Base) Sound() string { return "..." }

type Dog struct{ Base }
func (Dog) Sound() string { return "Woof" } // перекрывает Base.Sound

type Cat struct{ Base } // своего метода нет — используется Base.Sound

for _, a := range []Animal{Dog{}, Cat{}} {
	fmt.Print(a.Sound(), " ") // Woof ...
}
```

### Правило, которое экономит часы

Набор методов зависит от того, значение перед вами или указатель:

| Методы объявлены на | Интерфейсу удовлетворяет `T` | Интерфейсу удовлетворяет `*T` |
|---|---|---|
| значении: `func (t T) M()` | да | да |
| указателе: `func (t *T) M()` | **нет** | да |

Если компилятор говорит `T does not implement I (method M has pointer receiver)` — вы положили в интерфейс значение, а метод объявлен на указателе. Передайте `&t`.

### Где объявлять интерфейс

В Go интерфейс объявляет **тот, кто им пользуется**, а не тот, кто реализует. Функции нужен только метод `Read` — она объявляет (или берёт готовый) интерфейс с одним `Read`. Поэтому хорошие интерфейсы маленькие: один-два метода. Чем меньше интерфейс, тем больше типов под него подходит и тем проще подменить реализацию в тестах.

@@ quiz
@@ q
Как тип `T` объявляет, что реализует интерфейс `I`?
- [ ] `type T struct{} implements I`
- [ ] `func (T) implements(I)`
- [x] Никак — достаточно иметь все методы `I`
@@ explain
Реализация интерфейсов неявная (структурная типизация): если методы есть — тип подходит.

@@ q
Скомпилируется ли код?
```go
type I interface{ M() }
type T struct{}
func (t *T) M() {}
var x I = T{}
```
- [ ] Да
- [x] Нет: метод M объявлен для *T, а T{} — не указатель
@@ explain
Method set типа `T` не включает методы с указательным получателем. Нужно `var x I = &T{}`.

@@ q
Что делает строка `var _ io.Writer = (*MyWriter)(nil)`?
- [ ] Создаёт глобальный writer
- [x] Проверяет на этапе компиляции, что `*MyWriter` реализует `io.Writer`
- [ ] Регистрирует тип в пакете io
@@ explain
Присваивание пустому идентификатору ничего не делает во время выполнения, но компилятор проверит совместимость типов.

@@ q
Что выведет код?
```go
type Namer interface{ Name() string }
type User struct{ name string }

func (u User) Name() string { return u.name }

func main() {
	u := User{"a"}
	var n1 Namer = u
	var n2 Namer = &u
	u.name = "b"
	fmt.Println(n1.Name(), n2.Name())
}
```
- [ ] `b b`
- [ ] `a a`
- [x] `a b`
- [ ] Ошибка компиляции: `&u` не реализует `Namer`
@@ explain
В `n1` положена копия структуры — она не знает об изменении `u`. В `n2` положен указатель, через него видно актуальное значение. Указатель `*User` тоже удовлетворяет интерфейсу: методы, объявленные на значении, доступны и через указатель.

@@ q
Что выведет код?
```go
type Animal interface{ Sound() string }

type Base struct{}
func (Base) Sound() string { return "..." }

type Dog struct{ Base }
func (Dog) Sound() string { return "Woof" }

type Cat struct{ Base }

func main() {
	for _, a := range []Animal{Dog{}, Cat{}} {
		fmt.Print(a.Sound(), " ")
	}
}
```
- [ ] `... ...`
- [x] `Woof ...`
- [ ] `Woof Woof`
- [ ] Ошибка компиляции: `Cat` не реализует `Animal`
@@ explain
`Cat` получает метод `Sound` от встроенного `Base`, поэтому удовлетворяет интерфейсу. У `Dog` есть собственный `Sound` — он перекрывает метод встроенного типа.

@@ q
Скомпилируется ли код?
```go
type Shape interface{ Area() float64 }
type Sq struct{ a float64 }

func (s Sq) Area() float64 { return s.a * s.a }

func main() {
	var sh Shape = Sq{2}
	fmt.Println(sh.a)
}
```
- [ ] Да, выведет `2`
- [ ] Да, выведет `4`
- [x] Нет: через переменную типа `Shape` доступны только методы интерфейса
- [ ] Скомпилируется, но будет паника
@@ explain
Тип переменной `sh` — интерфейс `Shape`, а в нём объявлен только `Area()`. Поле `a` принадлежит конкретному типу `Sq`; чтобы до него добраться, нужно утверждение типа: `sh.(Sq).a`.

@@ task shapes | Фигуры | xp=50
Объявите интерфейс `Shape` с методами `Area() float64` и `Perimeter() float64`.

Реализуйте типы `Rect{W, H float64}`, `Circle{R float64}` и `Triangle{A, B, C float64}` (стороны; площадь — по формуле Герона).

Напишите функцию `Largest(shapes ...Shape) Shape` — фигура с наибольшей площадью (`nil`, если фигур нет), и `TotalPerimeter(shapes []Shape) float64`.
@@ hint
Формула Герона: `p := (a+b+c)/2; S = √(p(p−a)(p−b)(p−c))`.
@@ hint
В `Largest` храните `var best Shape` и сравнивайте `s.Area() > best.Area()` (для первой фигуры `best == nil`).
@@ starter
package main

import "fmt"

type Shape interface {
	Area() float64
	Perimeter() float64
}

type Rect struct{ W, H float64 }
type Circle struct{ R float64 }
type Triangle struct{ A, B, C float64 }

// реализуйте методы

func Largest(shapes ...Shape) Shape {
	return nil
}

func TotalPerimeter(shapes []Shape) float64 {
	return 0
}

func main() {
	fmt.Println(Largest())
}
@@ solution
package main

import (
	"fmt"
	"math"
)

type Shape interface {
	Area() float64
	Perimeter() float64
}

type Rect struct{ W, H float64 }
type Circle struct{ R float64 }
type Triangle struct{ A, B, C float64 }

func (r Rect) Area() float64      { return r.W * r.H }
func (r Rect) Perimeter() float64 { return 2 * (r.W + r.H) }

func (c Circle) Area() float64      { return math.Pi * c.R * c.R }
func (c Circle) Perimeter() float64 { return 2 * math.Pi * c.R }

func (t Triangle) Perimeter() float64 { return t.A + t.B + t.C }
func (t Triangle) Area() float64 {
	p := t.Perimeter() / 2
	return math.Sqrt(p * (p - t.A) * (p - t.B) * (p - t.C))
}

func Largest(shapes ...Shape) Shape {
	var best Shape
	for _, s := range shapes {
		if best == nil || s.Area() > best.Area() {
			best = s
		}
	}
	return best
}

func TotalPerimeter(shapes []Shape) float64 {
	total := 0.0
	for _, s := range shapes {
		total += s.Perimeter()
	}
	return total
}

func main() {
	fmt.Println(Largest(Rect{2, 3}, Circle{1}, Triangle{3, 4, 5}))
}
@@ test
package main

import (
	"math"
	"testing"
)

func approx(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func TestShapes(t *testing.T) {
	var shapes []Shape = []Shape{Rect{2, 3}, Circle{1}, Triangle{3, 4, 5}}
	areas := []float64{6, math.Pi, 6}
	perims := []float64{10, 2 * math.Pi, 12}
	for i, s := range shapes {
		if !approx(s.Area(), areas[i]) || !approx(s.Perimeter(), perims[i]) {
			t.Errorf("%T: Area=%v Perimeter=%v; ожидалось %v, %v", s, s.Area(), s.Perimeter(), areas[i], perims[i])
		}
	}
	if !approx(TotalPerimeter(shapes), 22+2*math.Pi) {
		t.Errorf("TotalPerimeter = %v", TotalPerimeter(shapes))
	}
	if got := Largest(shapes...); got != (Rect{2, 3}) {
		t.Errorf("Largest = %v, ожидалось Rect{2 3} (первая из равных по площади)", got)
	}
	if got := Largest(Circle{10}, Rect{1, 1}); got != (Circle{10}) {
		t.Errorf("Largest = %v, ожидалось Circle{10}", got)
	}
	if Largest() != nil {
		t.Error("Largest() без аргументов должна вернуть nil")
	}
}

@@ task notifier | Уведомления через интерфейс | xp=40
Объявите интерфейс `Notifier` с методом `Notify(msg string) error`.

Реализуйте:

- `EmailNotifier{Addr string, Sent []string}` — с **указательным** получателем добавляет в `Sent` строку `"email to <Addr>: <msg>"`;
- `SMSNotifier{Phone string, Sent []string}` — аналогично `"sms to <Phone>: <msg>"`, но если `len(msg) > 20`, возвращает ошибку и ничего не отправляет.
- `Broadcast(msg string, ns ...Notifier) int` — отправляет всем и возвращает количество **успешных** отправок.
@@ hint
`func (e *EmailNotifier) Notify(msg string) error { e.Sent = append(e.Sent, "email to "+e.Addr+": "+msg); return nil }`
@@ hint
В `Broadcast` передавайте указатели: `Broadcast("hi", &email, &sms)` — иначе `Notifier` не реализован.
@@ starter
package main

import "fmt"

type Notifier interface {
	Notify(msg string) error
}

type EmailNotifier struct {
	Addr string
	Sent []string
}

type SMSNotifier struct {
	Phone string
	Sent  []string
}

func Broadcast(msg string, ns ...Notifier) int {
	return 0
}

func main() {
	fmt.Println(Broadcast("hi"))
}
@@ solution
package main

import (
	"errors"
	"fmt"
)

type Notifier interface {
	Notify(msg string) error
}

type EmailNotifier struct {
	Addr string
	Sent []string
}

func (e *EmailNotifier) Notify(msg string) error {
	e.Sent = append(e.Sent, "email to "+e.Addr+": "+msg)
	return nil
}

type SMSNotifier struct {
	Phone string
	Sent  []string
}

func (s *SMSNotifier) Notify(msg string) error {
	if len(msg) > 20 {
		return errors.New("sms: сообщение слишком длинное")
	}
	s.Sent = append(s.Sent, "sms to "+s.Phone+": "+msg)
	return nil
}

func Broadcast(msg string, ns ...Notifier) int {
	ok := 0
	for _, n := range ns {
		if err := n.Notify(msg); err == nil {
			ok++
		}
	}
	return ok
}

func main() {
	e := &EmailNotifier{Addr: "a@b.c"}
	s := &SMSNotifier{Phone: "+7900"}
	fmt.Println(Broadcast("hi", e, s), e.Sent, s.Sent)
}
@@ test
package main

import "testing"

func TestBroadcast(t *testing.T) {
	e := &EmailNotifier{Addr: "a@b.c"}
	s := &SMSNotifier{Phone: "+7900"}
	var _ Notifier = e
	var _ Notifier = s
	if n := Broadcast("hi", e, s); n != 2 {
		t.Errorf("Broadcast(hi) = %d, ожидалось 2", n)
	}
	long := "this message is longer than twenty"
	if n := Broadcast(long, e, s); n != 1 {
		t.Errorf("Broadcast(long) = %d, ожидалось 1", n)
	}
	if len(e.Sent) != 2 || e.Sent[0] != "email to a@b.c: hi" {
		t.Errorf("email Sent = %q", e.Sent)
	}
	if len(s.Sent) != 1 || s.Sent[0] != "sms to +7900: hi" {
		t.Errorf("sms Sent = %q", s.Sent)
	}
	if Broadcast("x") != 0 {
		t.Error("Broadcast без получателей должен вернуть 0")
	}
}
