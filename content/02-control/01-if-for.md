---
id: if-for
title: if и все формы for
summary: условия с инициализацией, классический for, while-форма, бесконечный цикл, range, break/continue и метки
xp: 20
---
## if

Скобки вокруг условия не нужны, фигурные скобки обязательны:

```go
if x > 10 {
	fmt.Println("больше")
} else if x == 10 {
	fmt.Println("равно")
} else {
	fmt.Println("меньше")
}
```

### if с инициализацией

Перед условием можно выполнить короткую инструкцию. Переменная живёт только внутри `if/else`:

```go
if n, err := strconv.Atoi(s); err != nil {
	fmt.Println("не число:", err)
} else {
	fmt.Println("число", n)
}
// n и err здесь уже недоступны
```

Это идиоматичный способ обработки ошибок. Условие должно быть строго `bool`: `if x { }` для `int` не скомпилируется.

## for — единственный цикл в Go

В Go нет `while` и `do-while` — всё делает `for`.

```go
// 1. Классический
for i := 0; i < 5; i++ {
	fmt.Println(i)
}

// 2. «while»
n := 1
for n < 100 {
	n *= 2
}

// 3. Бесконечный
for {
	if done() {
		break
	}
}

// 4. range по срезу/массиву/строке/map/каналу
nums := []int{10, 20, 30}
for i, v := range nums {
	fmt.Println(i, v)
}
for _, v := range nums { /* только значения */ }
for i := range nums { /* только индексы */ }

// 5. range по целому числу (Go 1.22+)
for i := range 3 {
	fmt.Println(i) // 0 1 2
}
```

> **Важно:** в `for i, v := range xs` переменная `v` — **копия** элемента. Изменение `v` не меняет срез. Чтобы изменить элемент, пишите `xs[i] = ...`.

## break, continue и метки

```go
outer:
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			if j == 2 {
				continue outer // к следующей итерации внешнего цикла
			}
			if i == 2 {
				break outer    // выйти из обоих циклов
			}
			fmt.Println(i, j)
		}
	}
```

## Переменная цикла с Go 1.22

Начиная с Go 1.22 **каждая итерация** цикла `for` получает свою копию переменной цикла. Раньше переменная была одна на весь цикл, что приводило к знаменитым багам с замыканиями и горутинами (разберём в уроке про замыкания).

@@ quiz
@@ q
Что выведет код?
```go
xs := []int{1, 2, 3}
for _, v := range xs {
	v *= 10
}
fmt.Println(xs)
```
- [ ] `[10 20 30]`
- [x] `[1 2 3]`
- [ ] Ошибка компиляции
@@ explain
`v` — копия элемента. Чтобы изменить срез, нужно писать `xs[i] *= 10`.

@@ q
Как в Go записать цикл «пока условие истинно»?
- [ ] `while x < 10 { }`
- [x] `for x < 10 { }`
- [ ] `loop x < 10 { }`
- [ ] `do { } while x < 10`
@@ explain
В Go только одно ключевое слово цикла — `for`. Форма с одним условием эквивалентна `while`.

@@ q
Где видна переменная `n` из `if n := f(); n > 0 { ... } else { ... }`?
- [ ] Во всей функции
- [x] Только внутри веток if и else
- [ ] Только в ветке if
@@ explain
Переменная, объявленная в инструкции инициализации `if`, видна во всех ветках этого `if/else if/else`, но не после него.

@@ task fizzbuzz | FizzBuzz | xp=40 interview
Классика собеседований. Реализуйте `FizzBuzz(n int) []string`, возвращающую срез из `n` строк для чисел от 1 до `n`:

- кратно 3 и 5 → `"FizzBuzz"`
- кратно 3 → `"Fizz"`
- кратно 5 → `"Buzz"`
- иначе — само число строкой (используйте `strconv.Itoa` или `fmt.Sprint`).

`FizzBuzz(5)` → `["1" "2" "Fizz" "4" "Buzz"]`.
@@ hint
Создайте срез `res := make([]string, 0, n)` и добавляйте элементы через `append`.
@@ hint
Сначала проверяйте кратность 15, иначе `"FizzBuzz"` никогда не получится.
@@ starter
package main

import "fmt"

func FizzBuzz(n int) []string {
	var res []string
	// ваш код
	return res
}

func main() {
	fmt.Println(FizzBuzz(15))
}
@@ solution
package main

import (
	"fmt"
	"strconv"
)

func FizzBuzz(n int) []string {
	res := make([]string, 0, n)
	for i := 1; i <= n; i++ {
		switch {
		case i%15 == 0:
			res = append(res, "FizzBuzz")
		case i%3 == 0:
			res = append(res, "Fizz")
		case i%5 == 0:
			res = append(res, "Buzz")
		default:
			res = append(res, strconv.Itoa(i))
		}
	}
	return res
}

func main() {
	fmt.Println(FizzBuzz(15))
}
@@ test
package main

import (
	"strings"
	"testing"
)

func TestFizzBuzz(t *testing.T) {
	got := strings.Join(FizzBuzz(15), ",")
	want := "1,2,Fizz,4,Buzz,Fizz,7,8,Fizz,Buzz,11,Fizz,13,14,FizzBuzz"
	if got != want {
		t.Errorf("FizzBuzz(15) = %s\nожидалось %s", got, want)
	}
	if n := len(FizzBuzz(0)); n != 0 {
		t.Errorf("len(FizzBuzz(0)) = %d, ожидалось 0", n)
	}
	if r := FizzBuzz(30); len(r) != 30 || r[29] != "FizzBuzz" {
		t.Errorf("FizzBuzz(30) неверен в конце: %v", r)
	}
}

@@ task digits | Сумма цифр и разворот числа | xp=40
Реализуйте без преобразования в строку:

- `SumDigits(n int) int` — сумма цифр числа (для отрицательных — по модулю): `SumDigits(-123)` = 6.
- `ReverseInt(n int) int` — число с цифрами в обратном порядке, знак сохраняется: `ReverseInt(-120)` = `-21`.
@@ hint
Последняя цифра — `n % 10`, отбросить её — `n /= 10`. Цикл `for n != 0 { ... }`.
@@ hint
Для разворота: `rev = rev*10 + n%10`. Для отрицательных чисел остаток тоже отрицателен — это работает само собой!
@@ starter
package main

import "fmt"

func SumDigits(n int) int {
	return 0
}

func ReverseInt(n int) int {
	return 0
}

func main() {
	fmt.Println(SumDigits(-123), ReverseInt(-120))
}
@@ solution
package main

import "fmt"

func SumDigits(n int) int {
	if n < 0 {
		n = -n
	}
	sum := 0
	for n != 0 {
		sum += n % 10
		n /= 10
	}
	return sum
}

func ReverseInt(n int) int {
	rev := 0
	for n != 0 {
		rev = rev*10 + n%10
		n /= 10
	}
	return rev
}

func main() {
	fmt.Println(SumDigits(-123), ReverseInt(-120))
}
@@ test
package main

import "testing"

func TestDigits(t *testing.T) {
	sums := map[int]int{0: 0, 7: 7, 123: 6, -123: 6, 99999: 45, 1000000: 1}
	for in, want := range sums {
		if got := SumDigits(in); got != want {
			t.Errorf("SumDigits(%d) = %d, ожидалось %d", in, got, want)
		}
	}
	revs := map[int]int{0: 0, 5: 5, 123: 321, -120: -21, 1000: 1, 90817: 71809}
	for in, want := range revs {
		if got := ReverseInt(in); got != want {
			t.Errorf("ReverseInt(%d) = %d, ожидалось %d", in, got, want)
		}
	}
}
