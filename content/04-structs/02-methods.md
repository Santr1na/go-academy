---
id: methods
title: Методы и указатели
summary: указатели, & и *, методы, value vs pointer receivers, method sets, nil-получатели
xp: 30
---
## Указатели

Указатель хранит **адрес** значения. `&x` — взять адрес, `*p` — получить значение по адресу:

```go
x := 10
p := &x        // p имеет тип *int
*p = 20        // меняем x через указатель
fmt.Println(x) // 20

var q *int     // nil
// *q = 1      // panic: invalid memory address or nil pointer dereference

n := new(int)  // выделить int, вернуть указатель на него (*n == 0)
```

Арифметики указателей в Go нет (кроме пакета `unsafe`). Возвращать указатель на локальную переменную **безопасно** — компилятор сам переместит её в кучу.

## Методы

Метод — функция с **получателем** (receiver). Методы можно объявлять для любого именованного типа из **своего** пакета:

```go
type Rect struct{ W, H float64 }

func (r Rect) Area() float64 {   // value receiver
	return r.W * r.H
}

func (r *Rect) Scale(k float64) { // pointer receiver
	r.W *= k
	r.H *= k
}

r := Rect{2, 3}
r.Scale(2)            // Go сам возьмёт &r
fmt.Println(r.Area()) // 24

type Celsius float64
func (c Celsius) String() string { return fmt.Sprintf("%.1f°C", float64(c)) }
```

## Value или pointer receiver?

| Value receiver `(r T)` | Pointer receiver `(r *T)` |
|---|---|
| Метод получает **копию** | Метод может **изменять** значение |
| Подходит для маленьких неизменяемых типов (Point, Celsius, time.Time) | Нужен, если метод меняет состояние |
| | Нужен для больших структур (избежать копирования) |
| | Обязателен, если в структуре `sync.Mutex` (его нельзя копировать) |

> **Совет:** правило консистентности — если хотя бы один метод типа имеет pointer receiver, делайте pointer receiver у всех методов этого типа.

## Ловушка: value receiver не меняет оригинал

```go
type Counter struct{ n int }
func (c Counter) Inc() { c.n++ } // меняет копию!

c := Counter{}
c.Inc()
fmt.Println(c.n) // 0
```

## Адресуемость и method sets

`r.Scale(2)` работает для переменной, потому что Go может взять её адрес. Но значение в map или результат функции не адресуемы:

```go
m := map[string]Rect{"a": {1, 1}}
// m["a"].Scale(2) // ошибка: cannot take the address of m["a"]
```

Набор методов (method set) важен для интерфейсов: у типа `T` есть только методы с value receiver, у `*T` — все методы. Это значит, что `Rect{}` **не реализует** интерфейс с методом `Scale`, а `&Rect{}` — реализует. Подробно — в модуле «Интерфейсы».

## Методы с nil-получателем

Метод с pointer receiver можно вызвать на `nil`-указателе — это не паника, пока вы не обращаетесь к полям:

```go
type Node struct{ Val int; Next *Node }

func (n *Node) Len() int {
	if n == nil {
		return 0
	}
	return 1 + n.Next.Len()
}
```

## Метод как значение

```go
f := r.Area       // method value: привязан к r
g := Rect.Area    // method expression: func(Rect) float64
fmt.Println(f(), g(r))
```

## Разбираем подробнее: копия или оригинал

Вся тема указателей сводится к одному вопросу, который стоит задавать себе при каждом присваивании и каждом вызове: **я сейчас работаю с копией или с оригиналом?**

В Go копируется всё: присваивание, передача в функцию, `range`, вызов метода со значением-получателем — каждый раз создаётся копия. Указатель — способ сказать «не копируй, вот адрес оригинала».

```go
func setZero(n int)     { n = 0 }  // получила копию числа
func setZeroP(n *int)   { *n = 0 } // получила адрес и пишет по нему

x := 5
setZero(x)
fmt.Println(x) // 5 — изменилась копия
setZeroP(&x)
fmt.Println(x) // 0 — изменился оригинал
```

Три знака, которые нужно различать:

| Запись | Читается | Пример |
|---|---|---|
| `*int` в типе | «указатель на int» | `var p *int` |
| `&x` | «адрес переменной x» | `p = &x` |
| `*p` в выражении | «значение по адресу p» | `*p = 10` |

### Указатель тоже передаётся копией

```go
func swap(a, b *int) {
	a, b = b, a // поменяли местами две локальные копии адресов
}

x, y := 1, 2
swap(&x, &y)
fmt.Println(x, y) // 1 2 — ничего не изменилось
```

Функция получила копии двух адресов и поменяла их между собой — снаружи этого не видно. Чтобы обменять значения, нужно писать **по адресам**: `*a, *b = *b, *a`.

### Копия структуры — не всегда полная копия

```go
type T struct {
	tags []string
	n    int
}

a := T{[]string{"x"}, 1}
b := a          // копируются поля: число и ЗАГОЛОВОК среза
b.n = 2         // у b своё число
b.tags[0] = "y" // а массив под срезом общий
fmt.Println(a.n, a.tags[0]) // 1 y
```

Присваивание копирует поля «на один уровень». Если внутри есть срез, map или указатель, копируется только ссылка — данные остаются общими. Это называют **поверхностной копией**.

### range отдаёт копии элементов

```go
type C struct{ n int }

func (c *C) Inc() { c.n++ }

cs := []C{{}, {}}
for _, c := range cs {
	c.Inc() // c — копия элемента; увеличили копию
}
fmt.Println(cs[0].n) // 0

for i := range cs {
	cs[i].Inc() // обращаемся к самому элементу
}
fmt.Println(cs[0].n) // 1
```

Метод с указателем-получателем здесь ни при чём — он честно меняет то, что ему дали. Просто дали ему копию.

### Метод, сохранённый в переменную, запоминает получателя

```go
type T struct{ n int }

func (t T) Get() int { return t.n }

t := T{1}
g := t.Get // получатель-значение копируется прямо сейчас
t.n = 2
fmt.Println(g()) // 1
```

Правило то же, что и у `defer`: получатель вычисляется в момент, когда вы написали `t.Get`, а не в момент вызова.

### Как выбирать получателя: короткая памятка

- метод **меняет** состояние → указатель;
- структура большая или содержит `sync.Mutex` → указатель (мьютекс копировать нельзя);
- маленький неизменяемый тип вроде `Point` или `time.Time` → значение;
- если хотя бы один метод типа требует указатель — делайте указатель **у всех**, не смешивайте.

@@ quiz
@@ q
Что выведет код?
```go
type C struct{ n int }
func (c C) Inc()     { c.n++ }
func (c *C) IncP()   { c.n++ }
func main() {
	c := C{}
	c.Inc(); c.IncP(); c.IncP()
	fmt.Println(c.n)
}
```
- [ ] 3
- [x] 2
- [ ] 0
- [ ] 1
@@ explain
`Inc` с value receiver меняет копию. `IncP` дважды увеличивает оригинал — Go автоматически берёт `&c`.

@@ q
Когда **обязательно** нужен pointer receiver?
- [ ] Когда метод только читает поля
- [x] Когда метод изменяет состояние получателя или в структуре есть `sync.Mutex`
- [ ] Всегда для структур
@@ explain
Pointer receiver нужен для изменения состояния и для типов, которые нельзя копировать (мьютексы). Для маленьких неизменяемых значений подходит value receiver.

@@ q
Что произойдёт?
```go
type T struct{ name string }
func (t *T) Hello() string {
	if t == nil { return "nil!" }
	return t.name
}
func main() {
	var t *T
	fmt.Println(t.Hello())
}
```
- [ ] Паника: nil pointer dereference
- [x] Выведет `nil!`
- [ ] Ошибка компиляции
@@ explain
Вызов метода на nil-указателе допустим. Паника возникла бы только при обращении к `t.name`, но метод проверяет `nil` заранее.

@@ q
Что выведет код?
```go
type T struct {
	tags []string
	n    int
}

func main() {
	a := T{[]string{"x"}, 1}
	b := a
	b.n = 2
	b.tags[0] = "y"
	fmt.Println(a.n, a.tags[0])
}
```
- [ ] `1 x`
- [x] `1 y`
- [ ] `2 y`
- [ ] `2 x`
@@ explain
Присваивание `b := a` копирует поля структуры. Число скопировалось по-настоящему, а у среза скопировался только заголовок — массив под ним общий. Поэтому `a.n` осталось 1, а `a.tags[0]` изменилось.

@@ q
Что выведет код?
```go
type C struct{ n int }

func (c *C) Inc() { c.n++ }

func main() {
	cs := []C{{}, {}}
	for _, c := range cs {
		c.Inc()
	}
	fmt.Print(cs[0].n, " ")
	for i := range cs {
		cs[i].Inc()
	}
	fmt.Println(cs[0].n)
}
```
- [ ] `1 2`
- [x] `0 1`
- [ ] `0 0`
- [ ] `1 1`
@@ explain
В первом цикле `c` — копия элемента: `Inc` увеличивает копию, срез не меняется. Во втором цикле `cs[i]` — сам элемент среза, и изменение сохраняется.

@@ q
Что выведет код?
```go
type T struct{ n int }

func (t T) Get() int { return t.n }

func main() {
	t := T{1}
	g := t.Get
	t.n = 2
	fmt.Println(g())
}
```
- [x] `1`
- [ ] `2`
- [ ] `0`
- [ ] Ошибка компиляции: метод нельзя присвоить переменной
@@ explain
`t.Get` — «метод как значение». Получатель-значение копируется в момент создания `g`, когда `n` равнялось 1. Дальнейшие изменения `t` на `g` не влияют. С получателем-указателем `func (t *T) Get()` результат был бы 2.

@@ q
Что выведет код?
```go
func swap(a, b *int) {
	a, b = b, a
}

func main() {
	x, y := 1, 2
	swap(&x, &y)
	fmt.Println(x, y)
}
```
- [ ] `2 1`
- [x] `1 2`
- [ ] `2 2`
- [ ] Паника
@@ explain
Указатели передаются в функцию копиями. `a, b = b, a` меняет местами две локальные переменные с адресами и не трогает то, что по этим адресам лежит. Обменять значения можно так: `*a, *b = *b, *a`.

@@ task bank | Банковский счёт | xp=50
Реализуйте тип `Account` с полем `balance int` (в копейках) и методами:

- `Deposit(amount int) error` — пополнение; если `amount <= 0` — ошибка;
- `Withdraw(amount int) error` — снятие; ошибка, если `amount <= 0` или недостаточно средств (баланс не меняется);
- `Balance() int`.

Подумайте, какие получатели нужны: методы должны менять **один и тот же** счёт.
@@ hint
`Deposit` и `Withdraw` меняют состояние — используйте `(a *Account)`. Для единообразия сделайте указательным и `Balance`.
@@ hint
Ошибки создавайте через `errors.New("...")` или `fmt.Errorf`.
@@ starter
package main

import "fmt"

type Account struct {
	balance int
}

func (a Account) Deposit(amount int) error {
	a.balance += amount
	return nil
}

func (a Account) Withdraw(amount int) error {
	a.balance -= amount
	return nil
}

func (a Account) Balance() int {
	return a.balance
}

func main() {
	acc := &Account{}
	acc.Deposit(1000)
	fmt.Println(acc.Withdraw(300), acc.Balance())
}
@@ solution
package main

import (
	"errors"
	"fmt"
)

type Account struct {
	balance int
}

func (a *Account) Deposit(amount int) error {
	if amount <= 0 {
		return errors.New("сумма пополнения должна быть положительной")
	}
	a.balance += amount
	return nil
}

func (a *Account) Withdraw(amount int) error {
	if amount <= 0 {
		return errors.New("сумма снятия должна быть положительной")
	}
	if amount > a.balance {
		return fmt.Errorf("недостаточно средств: баланс %d, запрошено %d", a.balance, amount)
	}
	a.balance -= amount
	return nil
}

func (a *Account) Balance() int {
	return a.balance
}

func main() {
	acc := &Account{}
	acc.Deposit(1000)
	fmt.Println(acc.Withdraw(300), acc.Balance())
}
@@ test
package main

import "testing"

func TestAccount(t *testing.T) {
	var acc Account
	if err := acc.Deposit(1000); err != nil {
		t.Fatalf("Deposit(1000): %v", err)
	}
	if acc.Balance() != 1000 {
		t.Fatalf("баланс %d, ожидалось 1000 — метод меняет копию?", acc.Balance())
	}
	if err := acc.Deposit(0); err == nil {
		t.Error("Deposit(0) должен вернуть ошибку")
	}
	if err := acc.Deposit(-5); err == nil {
		t.Error("Deposit(-5) должен вернуть ошибку")
	}
	if err := acc.Withdraw(300); err != nil || acc.Balance() != 700 {
		t.Errorf("Withdraw(300): err=%v баланс=%d, ожидалось nil и 700", err, acc.Balance())
	}
	if err := acc.Withdraw(701); err == nil || acc.Balance() != 700 {
		t.Errorf("Withdraw(701) при балансе 700: err=%v баланс=%d", err, acc.Balance())
	}
	if err := acc.Withdraw(-1); err == nil {
		t.Error("Withdraw(-1) должен вернуть ошибку")
	}
	if err := acc.Withdraw(700); err != nil || acc.Balance() != 0 {
		t.Errorf("Withdraw всего баланса: err=%v баланс=%d", err, acc.Balance())
	}
}

@@ task linked-len | Список с nil-получателем | xp=40
Дан односвязный список:

```go
type Node struct {
	Val  int
	Next *Node
}
```

Реализуйте методы с **указательным** получателем, которые корректно работают на `nil` (пустом списке):

- `(n *Node) Len() int` — длина списка;
- `(n *Node) Sum() int` — сумма значений;
- `(n *Node) Push(v int) *Node` — возвращает **новую голову** списка, где `v` добавлен в начало.
@@ hint
Начните каждый метод с `if n == nil { return 0 }` (или пройдите циклом `for cur := n; cur != nil; cur = cur.Next`).
@@ hint
`Push`: `return &Node{Val: v, Next: n}` — работает и для nil.
@@ starter
package main

import "fmt"

type Node struct {
	Val  int
	Next *Node
}

func (n *Node) Len() int {
	return 1 + n.Next.Len()
}

func (n *Node) Sum() int {
	return 0
}

func (n *Node) Push(v int) *Node {
	return n
}

func main() {
	var list *Node
	fmt.Println(list.Len())
}
@@ solution
package main

import "fmt"

type Node struct {
	Val  int
	Next *Node
}

func (n *Node) Len() int {
	count := 0
	for cur := n; cur != nil; cur = cur.Next {
		count++
	}
	return count
}

func (n *Node) Sum() int {
	if n == nil {
		return 0
	}
	return n.Val + n.Next.Sum()
}

func (n *Node) Push(v int) *Node {
	return &Node{Val: v, Next: n}
}

func main() {
	var list *Node
	list = list.Push(3).Push(2).Push(1)
	fmt.Println(list.Len(), list.Sum())
}
@@ test
package main

import "testing"

func TestNilList(t *testing.T) {
	var list *Node
	func() {
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("метод на nil-списке вызвал панику: %v", r)
			}
		}()
		if list.Len() != 0 || list.Sum() != 0 {
			t.Errorf("пустой список: Len=%d Sum=%d", list.Len(), list.Sum())
		}
	}()
	list = list.Push(3).Push(2).Push(1)
	if list == nil || list.Val != 1 || list.Len() != 3 || list.Sum() != 6 {
		t.Fatalf("после Push(3).Push(2).Push(1): Len=%d Sum=%d", list.Len(), list.Sum())
	}
	if list.Next.Val != 2 || list.Next.Next.Val != 3 {
		t.Errorf("неверный порядок элементов")
	}
}
