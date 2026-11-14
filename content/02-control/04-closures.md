---
id: closures
title: Анонимные функции и замыкания
summary: функции-литералы, захват переменных, генераторы, ловушка переменной цикла
xp: 25
---
## Анонимные функции

Функцию можно объявить прямо в выражении и сразу вызвать или сохранить в переменную:

```go
square := func(x int) int { return x * x }
fmt.Println(square(4)) // 16

func() {
	fmt.Println("вызвана сразу")
}()
```

## Замыкания

Анонимная функция **захватывает переменные** из окружающей области видимости — не их значения, а сами переменные. Переменная продолжает жить, пока на неё ссылается замыкание:

```go
func counter() func() int {
	count := 0
	return func() int {
		count++
		return count
	}
}

c1 := counter()
fmt.Println(c1(), c1(), c1()) // 1 2 3
c2 := counter()
fmt.Println(c2())             // 1 — у c2 своя переменная count
```

Компилятор видит, что `count` переживает вызов `counter`, и размещает её в куче (escape analysis).

## Замыкания как генераторы

```go
func fib() func() int {
	a, b := 0, 1
	return func() int {
		r := a
		a, b = b, a+b
		return r
	}
}

f := fib()
for range 6 {
	fmt.Print(f(), " ") // 0 1 1 2 3 5
}
```

## Ловушка: захват переменной цикла

Замыкание видит **переменную**, а не значение в момент создания:

```go
x := 1
f := func() { fmt.Println(x) }
x = 2
f() // 2
```

Классический вопрос на собеседовании:

```go
var fns []func()
for i := 0; i < 3; i++ {
	fns = append(fns, func() { fmt.Print(i, " ") })
}
for _, f := range fns {
	f()
}
```

- **До Go 1.22**: `3 3 3` — у всех замыканий одна общая переменная `i`, к моменту вызова равная 3.
- **С Go 1.22** (если в `go.mod` указано `go 1.22` или новее): `0 1 2` — каждая итерация получает новую переменную.

В старом коде вы увидите обходной путь `i := i` внутри цикла — он создавал копию.

> **Важно:** изменение семантики касается только переменных, объявленных в заголовке `for`. Если переменная объявлена снаружи цикла и меняется в нём, замыкания по-прежнему увидят последнее значение.

## Middleware-паттерн

Функции, принимающие и возвращающие функции, — основа middleware в HTTP-серверах:

```go
func logged(f func(int) int) func(int) int {
	return func(x int) int {
		r := f(x)
		fmt.Printf("f(%d) = %d\n", x, r)
		return r
	}
}
```

## Разбираем подробнее: что именно захватывает замыкание

Главная мысль, на которой держится вся тема: замыкание захватывает **саму переменную, а не её значение на момент создания**. Функция и окружающий код смотрят на одну и ту же «коробку».

```go
x := 1
f := func() int { return x * 10 }
x = 5
fmt.Println(f()) // 50, а не 10
```

Когда `f` создавалась, в `x` лежала единица. Но `f` не запомнила единицу — она запомнила, **где лежит `x`**. К моменту вызова там уже 5.

### У каждого вызова фабрики — своя переменная

```go
func counter() func() int {
	n := 0
	return func() int {
		n++
		return n
	}
}

a := counter() // создана первая n
b := counter() // создана вторая, независимая n
a()
a()
fmt.Println(a(), b()) // 3 1
```

Проследим по шагам:

| Шаг | Что происходит | n у `a` | n у `b` |
|---|---|---|---|
| `a := counter()` | вызов создаёт новую `n` и функцию, которая её видит | 0 | — |
| `b := counter()` | ещё один вызов — ещё одна `n` | 0 | 0 |
| `a()`, `a()` | растёт только первая | 2 | 0 |
| `a()` и `b()` | каждая увеличивает свою | 3 | 1 |

Обычно локальная переменная исчезает, когда функция завершилась. Здесь `n` продолжает жить, пока жива функция, которая на неё ссылается, — компилятор сам переносит такую переменную в кучу.

### Два замыкания могут делить одну переменную

```go
func pair() (inc func(), get func() int) {
	n := 0
	inc = func() { n += 2 }
	get = func() int { return n }
	return
}

inc, get := pair()
inc()
inc()
fmt.Println(get()) // 4
```

Обе функции созданы в одном вызове `pair`, поэтому видят одну и ту же `n`. Так делают «объекты без структур»: состояние спрятано, снаружи доступны только функции.

### Как «заморозить» значение

Если нужно именно текущее значение, передайте его параметром или скопируйте в новую переменную:

```go
x := 1
f := func(v int) func() int { // v — отдельная копия
	return func() int { return v * 10 }
}(x)
x = 5
fmt.Println(f()) // 10
```

### Где это встречается в настоящем коде

- функция сравнения в `sort.Slice(people, func(i, j int) bool { return people[i].Age < people[j].Age })` — она видит срез `people` снаружи;
- обработчики HTTP, которым нужен доступ к базе или логгеру;
- `defer func() { ... }()`, который читает переменные функции в момент выхода;
- горутины `go func() { ... }()` — самая опасная зона: горутина выполнится **позже**, и переменная к этому моменту может измениться.

> **Ловушка:** до Go 1.22 переменная цикла `for` была одна на все итерации, и все замыкания видели её последнее значение. С Go 1.22 у каждой итерации своя переменная — но только если переменная объявлена **в заголовке** цикла. Объявили снаружи (`i := 0; for ; i < 3; i++`) — она по-прежнему одна на всех.

@@ quiz
@@ q
Что выведет код?
```go
x := 10
add := func(d int) { x += d }
add(5)
add(5)
fmt.Println(x)
```
- [ ] 10
- [ ] 15
- [x] 20
@@ explain
Замыкание захватывает саму переменную `x`, поэтому каждый вызов изменяет её: 10 → 15 → 20.

@@ q
Что выведет код при `go 1.22` и новее в go.mod?
```go
var fns []func()
for i := range 3 {
	fns = append(fns, func() { fmt.Print(i) })
}
for _, f := range fns { f() }
```
- [ ] `333`
- [x] `012`
- [ ] `222`
@@ explain
С Go 1.22 каждая итерация цикла создаёт свою переменную `i`, поэтому замыкания видят 0, 1, 2. До 1.22 результат был бы `333`.

@@ q
Что выведет код?
```go
i := 0
var fns []func()
for ; i < 3; i++ {
	fns = append(fns, func() { fmt.Print(i) })
}
for _, f := range fns { f() }
```
- [ ] `012`
- [x] `333`
- [ ] `000`
@@ explain
Переменная `i` объявлена **вне** заголовка цикла, поэтому она одна для всех итераций (правило Go 1.22 на неё не распространяется). После цикла `i == 3`.

@@ q
Что выведет код?
```go
func counter() func() int {
	n := 0
	return func() int { n++; return n }
}

func main() {
	a, b := counter(), counter()
	a()
	a()
	fmt.Println(a(), b())
}
```
- [ ] `3 3`
- [x] `3 1`
- [ ] `1 1`
- [ ] `3 4`
@@ explain
Каждый вызов `counter()` создаёт новую переменную `n`. У `a` и `b` счётчики независимы: `a` вызвана три раза, `b` — один.

@@ q
Что выведет код?
```go
x := 1
f := func() int { return x * 10 }
x = 5
fmt.Println(f())
```
- [ ] `10`
- [x] `50`
- [ ] `15`
- [ ] Ошибка компиляции: `x` изменена после захвата
@@ explain
Замыкание хранит не значение `x`, а доступ к самой переменной. К моменту вызова `f()` в `x` лежит 5. Это частая причина багов: функцию создали в одном месте, а вызвали позже, когда данные уже другие.

@@ q
Что выведет код?
```go
func pair() (func(), func() int) {
	n := 0
	return func() { n += 2 }, func() int { return n }
}

func main() {
	inc, get := pair()
	inc()
	inc()
	fmt.Println(get())
}
```
- [ ] `0` — у каждой функции своя копия `n`
- [ ] `2`
- [x] `4`
- [ ] Ошибка компиляции
@@ explain
Обе функции созданы внутри одного вызова `pair`, поэтому захватили одну и ту же переменную `n`. Изменения, сделанные через `inc`, видны через `get`.

@@ task counter | Счётчик и генератор Фибоначчи | xp=40
Реализуйте два замыкания:

1. `NewCounter(start, step int) func() int` — каждый вызов возвращает следующее значение: `start`, `start+step`, `start+2*step`, …
2. `Fibonacci() func() int` — каждый вызов возвращает следующее число Фибоначчи: 0, 1, 1, 2, 3, 5, 8, …

Разные вызовы `NewCounter` должны давать **независимые** счётчики.
@@ hint
Храните текущее значение в локальной переменной внешней функции и возвращайте `func() int { ... }`, которая её меняет.
@@ hint
В счётчике сначала запомните текущее значение `r := cur`, затем увеличьте `cur += step` и верните `r`.
@@ starter
package main

import "fmt"

func NewCounter(start, step int) func() int {
	return func() int {
		return start
	}
}

func Fibonacci() func() int {
	return func() int {
		return 0
	}
}

func main() {
	c := NewCounter(10, 5)
	fmt.Println(c(), c(), c())
	f := Fibonacci()
	fmt.Println(f(), f(), f(), f(), f())
}
@@ solution
package main

import "fmt"

func NewCounter(start, step int) func() int {
	cur := start
	return func() int {
		r := cur
		cur += step
		return r
	}
}

func Fibonacci() func() int {
	a, b := 0, 1
	return func() int {
		r := a
		a, b = b, a+b
		return r
	}
}

func main() {
	c := NewCounter(10, 5)
	fmt.Println(c(), c(), c())
	f := Fibonacci()
	fmt.Println(f(), f(), f(), f(), f())
}
@@ test
package main

import "testing"

func TestCounter(t *testing.T) {
	a := NewCounter(10, 5)
	b := NewCounter(0, -1)
	for i, want := range []int{10, 15, 20, 25} {
		if got := a(); got != want {
			t.Fatalf("вызов %d счётчика (10, 5) вернул %d, ожидалось %d", i+1, got, want)
		}
	}
	for i, want := range []int{0, -1, -2} {
		if got := b(); got != want {
			t.Fatalf("вызов %d счётчика (0, -1) вернул %d, ожидалось %d", i+1, got, want)
		}
	}
	if got := a(); got != 30 {
		t.Errorf("счётчики не независимы: ожидалось 30, получено %d", got)
	}
}

func TestFibonacci(t *testing.T) {
	f := Fibonacci()
	want := []int{0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55}
	for i, w := range want {
		if got := f(); got != w {
			t.Fatalf("F(%d) = %d, ожидалось %d", i, got, w)
		}
	}
	g := Fibonacci()
	if g() != 0 || g() != 1 {
		t.Error("генераторы Fibonacci() должны быть независимы")
	}
}

@@ task memo | Мемоизация | xp=50 interview
Реализуйте `Memoize(f func(int) int) func(int) int` — обёртку, которая кэширует результаты: при повторном вызове с тем же аргументом исходная `f` **не вызывается**, а результат берётся из кэша (используйте map внутри замыкания).

Для каждой обёртки — свой кэш.
@@ hint
Создайте `cache := map[int]int{}` во внешней функции.
@@ hint
`if v, ok := cache[x]; ok { return v }` — иначе вычислите, сохраните и верните.
@@ starter
package main

import "fmt"

func Memoize(f func(int) int) func(int) int {
	return f
}

func main() {
	slowSquare := func(x int) int {
		fmt.Println("вычисляю", x)
		return x * x
	}
	sq := Memoize(slowSquare)
	fmt.Println(sq(4), sq(4), sq(5))
}
@@ solution
package main

import "fmt"

func Memoize(f func(int) int) func(int) int {
	cache := map[int]int{}
	return func(x int) int {
		if v, ok := cache[x]; ok {
			return v
		}
		v := f(x)
		cache[x] = v
		return v
	}
}

func main() {
	slowSquare := func(x int) int {
		fmt.Println("вычисляю", x)
		return x * x
	}
	sq := Memoize(slowSquare)
	fmt.Println(sq(4), sq(4), sq(5))
}
@@ test
package main

import "testing"

func TestMemoize(t *testing.T) {
	calls := 0
	f := func(x int) int { calls++; return x * 3 }
	m := Memoize(f)
	for i := 0; i < 5; i++ {
		if got := m(7); got != 21 {
			t.Fatalf("m(7) = %d, ожидалось 21", got)
		}
	}
	if calls != 1 {
		t.Errorf("исходная функция вызвана %d раз, ожидался 1", calls)
	}
	m(8)
	m(0)
	m(0)
	if calls != 3 {
		t.Errorf("после m(8), m(0), m(0) всего вызовов %d, ожидалось 3", calls)
	}
	m2 := Memoize(f)
	m2(7)
	if calls != 4 {
		t.Errorf("у каждой обёртки должен быть свой кэш")
	}
}
