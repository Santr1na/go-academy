---
id: start-for
title: Циклы — повторяем действия
summary: Цикл for, счётчик, накопление суммы и как не зациклиться навсегда
xp: 20
---
## Зачем нужны циклы

Напечатать числа от 1 до 5 можно пятью строками `Println`. А от 1 до 1000? Писать тысячу строк никто не станет. Когда действие нужно **повторить**, используют **цикл**.

```go
for i := 1; i <= 5; i++ {
	fmt.Println(i)
}
```

Эта программа напечатает числа 1, 2, 3, 4, 5 — каждое на своей строке.

## Из чего состоит цикл for

В заголовке цикла три части, разделённые точкой с запятой:

```go
for i := 1; i <= 5; i++ {
//  ───┬───  ───┬──  ─┬─
//     │        │     └─ шаг: что сделать после каждого повтора (i++ — прибавить 1)
//     │        └─ условие: пока оно истинно, цикл продолжается
//     └─ начало: создаём переменную-счётчик
```

Компьютер действует так:

1. Создаёт счётчик: `i` равно 1.
2. Проверяет условие `i <= 5`. Если оно ложно — цикл закончен.
3. Выполняет строки внутри фигурных скобок — **тело цикла**.
4. Делает шаг `i++` и возвращается к пункту 2.

Проследим за `i`: 1 → печать, 2 → печать, … 5 → печать, затем `i` становится 6, условие `6 <= 5` ложно — выходим.

Счётчик по традиции называют `i`. Его можно использовать внутри цикла как обычную переменную.

## Меняем границы и шаг

```go
for i := 10; i >= 1; i-- {   // обратный отсчёт: 10, 9, 8, … 1
	fmt.Println(i)
}

for i := 0; i <= 20; i += 5 { // с шагом 5: 0, 5, 10, 15, 20
	fmt.Println(i)
}
```

## Накопление результата

Очень частый приём: до цикла создаём переменную для результата, а в цикле понемногу её изменяем.

```go
sum := 0
for i := 1; i <= 4; i++ {
	sum = sum + i
}
fmt.Println(sum) // 10
```

Что происходит с `sum`: 0 → 1 → 3 → 6 → 10. Переменная создана **до** цикла, поэтому она «живёт» всё время и после цикла хранит итог. Если создать её внутри цикла, она будет каждый раз начинаться заново.

## Условие внутри цикла

Цикл и `if` отлично работают вместе. Напечатаем только числа, которые делятся на 3:

```go
for i := 1; i <= 10; i++ {
	if i%3 == 0 {
		fmt.Println(i) // 3, 6, 9
	}
}
```

## Цикл «пока»

Иногда заранее неизвестно, сколько будет повторов. Тогда в заголовке оставляют только условие:

```go
n := 100
for n > 1 {
	n = n / 2
	fmt.Println(n) // 50, 25, 12, 6, 3, 1
}
```

Цикл работает, **пока** условие истинно.

## Бесконечный цикл

Если условие никогда не станет ложным, цикл не остановится:

```go
i := 1
for i <= 5 {
	fmt.Println(i) // забыли увеличить i — будет печатать 1 вечно
}
```

Такое случается у всех. На этом сайте зависшая программа сама остановится через несколько секунд с сообщением «Превышено время выполнения». Увидели его — проверьте, что счётчик действительно меняется и условие когда-нибудь станет ложным.

> **Совет:** если цикл ведёт себя странно, выполните его «в уме» на маленьком числе — например, для `n = 3`. Запишите на бумаге значения переменных после каждого шага. Это самый надёжный способ найти ошибку.

@@ quiz
@@ q
Сколько раз выполнится тело цикла?
```go
for i := 0; i < 4; i++ {
	fmt.Println("Привет")
}
```
- [ ] 3 раза
- [x] 4 раза
- [ ] 5 раз
- [ ] Бесконечно
@@ explain
Счётчик принимает значения 0, 1, 2, 3 — это четыре значения. Когда `i` становится равным 4, условие `i < 4` ложно, и цикл заканчивается.

@@ q
Что напечатает программа?
```go
total := 0
for i := 1; i <= 3; i++ {
	total = total + i * 2
}
fmt.Println(total)
```
- [ ] `6`
- [x] `12`
- [ ] `9`
- [ ] `2`, `4`, `6` на трёх строках
@@ explain
На каждом шаге к `total` прибавляется `i * 2`: 0 + 2 = 2, затем 2 + 4 = 6, затем 6 + 6 = 12. `Println` стоит после цикла, поэтому печатает только итог.

@@ q
Что произойдёт при запуске?
```go
x := 10
for x > 0 {
	x = x + 1
}
```
- [ ] Цикл выполнится 10 раз
- [ ] Цикл не выполнится ни разу
- [x] Цикл никогда не закончится: `x` только растёт, и условие всегда истинно
- [ ] Ошибка компиляции
@@ explain
Условие `x > 0` истинно в начале, а внутри цикла `x` увеличивается — условие не станет ложным никогда. Это бесконечный цикл. Чтобы он закончился, `x` должен уменьшаться.

@@ task count | Счёт до N | xp=30
В переменной `n` записано число. Напечатайте все числа от 1 до `n` включительно, каждое на своей строке. Для `n = 5`:

```
1
2
3
4
5
```
@@ hint
Нужен цикл со счётчиком от 1, который работает, пока счётчик не больше `n`: `for i := 1; i <= n; i++ { … }`.
@@ hint
Внутри цикла — одна строка: `fmt.Println(i)`.
@@ starter
package main

import "fmt"

// Тесты будут подставлять сюда другие числа.
var n = 5

func main() {
	// Замените эти строки циклом
	fmt.Println(1)
	fmt.Println(2)
}
@@ solution
package main

import "fmt"

// Тесты будут подставлять сюда другие числа.
var n = 5

func main() {
	for i := 1; i <= n; i++ {
		fmt.Println(i)
	}
}
@@ test
package main

import (
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
)

func runMain(t *testing.T) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	func() {
		defer func() { os.Stdout = old; w.Close() }()
		main()
	}()
	b, _ := io.ReadAll(r)
	lines := strings.Split(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n")
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " \t")
	}
	return strings.TrimRight(strings.Join(lines, "\n"), "\n")
}

func TestCount(t *testing.T) {
	for _, v := range []int{5, 1, 12, 3} {
		n = v
		var want []string
		for i := 1; i <= v; i++ {
			want = append(want, fmt.Sprint(i))
		}
		if got := runMain(t); got != strings.Join(want, "\n") {
			t.Errorf("при n = %d программа напечатала:\n%s\n\nа нужно:\n%s\n", v, got, strings.Join(want, "\n"))
		}
	}
}

@@ task sum | Сумма чисел | xp=30
Вычислите сумму всех целых чисел от 1 до `n` включительно и напечатайте её. Для `n = 10`:

```
Сумма: 55
```

(1 + 2 + 3 + … + 10 = 55)
@@ hint
Заведите переменную `sum := 0` **до** цикла и прибавляйте к ней счётчик на каждом шаге.
@@ hint
`for i := 1; i <= n; i++ { sum += i }`, а после цикла — `fmt.Println("Сумма:", sum)`. Печать должна стоять после закрывающей скобки цикла, иначе сумма напечатается много раз.
@@ starter
package main

import "fmt"

// Тесты будут подставлять сюда другие числа.
var n = 10

func main() {
	sum := 0
	// Прибавьте к sum все числа от 1 до n

	fmt.Println("Сумма:", sum)
}
@@ solution
package main

import "fmt"

// Тесты будут подставлять сюда другие числа.
var n = 10

func main() {
	sum := 0
	for i := 1; i <= n; i++ {
		sum += i
	}
	fmt.Println("Сумма:", sum)
}
@@ test
package main

import (
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
)

func runMain(t *testing.T) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	func() {
		defer func() { os.Stdout = old; w.Close() }()
		main()
	}()
	b, _ := io.ReadAll(r)
	lines := strings.Split(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n")
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " \t")
	}
	return strings.TrimRight(strings.Join(lines, "\n"), "\n")
}

func TestSum(t *testing.T) {
	for _, v := range []int{10, 1, 100, 4} {
		n = v
		want := fmt.Sprintf("Сумма: %d", v*(v+1)/2)
		if got := runMain(t); got != want {
			t.Errorf("при n = %d программа напечатала:\n%s\n\nа нужно:\n%s\n", v, got, want)
		}
	}
}

@@ task evens | Только чётные | xp=30
Напечатайте все **чётные** числа от 1 до `n` включительно, каждое на своей строке. Для `n = 9`:

```
2
4
6
8
```
@@ hint
Есть два пути. Первый: перебрать все числа от 1 до `n` и печатать только те, у которых остаток от деления на 2 равен нулю (`i%2 == 0`). Второй: начать с 2 и увеличивать счётчик сразу на 2.
@@ hint
Первый способ: `for i := 1; i <= n; i++ { if i%2 == 0 { fmt.Println(i) } }`. Второй: `for i := 2; i <= n; i += 2 { fmt.Println(i) }`.
@@ starter
package main

import "fmt"

// Тесты будут подставлять сюда другие числа.
var n = 9

func main() {
	// Сейчас печатаются все числа подряд — оставьте только чётные
	for i := 1; i <= n; i++ {
		fmt.Println(i)
	}
}
@@ solution
package main

import "fmt"

// Тесты будут подставлять сюда другие числа.
var n = 9

func main() {
	for i := 1; i <= n; i++ {
		if i%2 == 0 {
			fmt.Println(i)
		}
	}
}
@@ test
package main

import (
	"fmt"
	"io"
	"os"
	"strings"
	"testing"
)

func runMain(t *testing.T) string {
	t.Helper()
	old := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = w
	func() {
		defer func() { os.Stdout = old; w.Close() }()
		main()
	}()
	b, _ := io.ReadAll(r)
	lines := strings.Split(strings.ReplaceAll(string(b), "\r\n", "\n"), "\n")
	for i := range lines {
		lines[i] = strings.TrimRight(lines[i], " \t")
	}
	return strings.TrimRight(strings.Join(lines, "\n"), "\n")
}

func TestEvens(t *testing.T) {
	for _, v := range []int{9, 10, 2, 7, 20} {
		n = v
		var want []string
		for i := 2; i <= v; i += 2 {
			want = append(want, fmt.Sprint(i))
		}
		if got := runMain(t); got != strings.Join(want, "\n") {
			t.Errorf("при n = %d программа напечатала:\n%s\n\nа нужно:\n%s\n", v, got, strings.Join(want, "\n"))
		}
	}
}
