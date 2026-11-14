---
id: operators-fmt
title: Операторы и пакет fmt
summary: арифметика, сравнения, логика, битовые операции, глаголы форматирования Printf
xp: 20
---
## Операторы

| Группа | Операторы |
|---|---|
| Арифметика | `+ - * / %` |
| Инкремент | `x++`, `x--` (это **инструкции**, а не выражения: `y := x++` нельзя) |
| Присваивание | `= += -= *= /= %= &= \|= ^= <<= >>=` |
| Сравнение | `== != < <= > >=` |
| Логические | `&& \|\| !` (с коротким замыканием) |
| Битовые | `& \| ^ &^ << >>` |

Приоритет: `* / % << >> & &^` выше, чем `+ - | ^`, выше сравнений, выше `&&`, выше `||`.

### Битовые операции

```go
a := 0b1100 // 12
b := 0b1010 // 10
fmt.Printf("%04b\n", a&b)  // 1000 — И
fmt.Printf("%04b\n", a|b)  // 1110 — ИЛИ
fmt.Printf("%04b\n", a^b)  // 0110 — исключающее ИЛИ
fmt.Printf("%04b\n", a&^b) // 0100 — сброс битов (AND NOT)
fmt.Println(1 << 3)        // 8
fmt.Println(^0)            // -1: унарный ^ — побитовое НЕ
```

> **На собеседовании** часто спрашивают: как проверить, что число — степень двойки? Ответ: `n > 0 && n&(n-1) == 0`. У степени двойки ровно один единичный бит, а `n-1` «переворачивает» его и все биты справа.

## Пакет fmt

```go
fmt.Print("без перевода строки")
fmt.Println("с пробелами", 42, true) // с пробелами 42 true
fmt.Printf("%s: %d\n", "возраст", 30)
s := fmt.Sprintf("%.2f", 3.14159)    // вернуть строку: "3.14"
fmt.Fprintf(os.Stderr, "ошибка: %v\n", err) // в любой io.Writer
```

### Основные глаголы (verbs)

| Глагол | Значение | Пример → результат |
|---|---|---|
| `%v` | значение по умолчанию | `Point{1 2}` → `{1 2}` |
| `%+v` | с именами полей | `{X:1 Y:2}` |
| `%#v` | синтаксис Go | `main.Point{X:1, Y:2}` |
| `%T` | тип | `main.Point` |
| `%d` | целое | `42` |
| `%b %o %x %X` | двоичное, восьмеричное, hex | `%x` от 255 → `ff` |
| `%f %.2f %e` | вещественное | `%.2f` от 3.14159 → `3.14` |
| `%s` | строка | |
| `%q` | строка в кавычках | `"hi"` |
| `%c` | символ по коду | `%c` от 1046 → `Ж` |
| `%U` | Unicode-код | `U+0416` |
| `%t` | bool | `true` |
| `%p` | указатель | `0xc000012345` |
| `%%` | знак процента | `%` |

### Ширина и выравнивание

```go
fmt.Printf("|%5d|%-5d|%05d|\n", 42, 42, 42) // |   42|42   |00042|
fmt.Printf("|%8.2f|\n", 3.14159)            // |    3.14|
fmt.Printf("|%-10s|%10s|\n", "left", "right")
```

> **Совет:** `go vet` проверяет, что глаголы `Printf` соответствуют типам аргументов, — запускайте его регулярно.

@@ quiz
@@ q
Что выведет `fmt.Printf("%05.1f|%-4d|%x", 3.14159, 7, 255)`?
- [ ] `3.1|7|255`
- [x] `003.1|7   |ff`
- [ ] `3.14159|0007|FF`
- [ ] `00003|7|ff`
@@ explain
`%05.1f` — ширина 5, один знак после запятой, дополнение нулями: `003.1`. `%-4d` выравнивает влево в поле ширины 4. `%x` — шестнадцатеричное в нижнем регистре.

@@ q
Какое выражение верно проверяет, что `n` — степень двойки (n > 0)?
- [ ] `n%2 == 0`
- [x] `n&(n-1) == 0`
- [ ] `n|(n-1) == 0`
- [ ] `n^n == 0`
@@ explain
У степени двойки установлен ровно один бит. Вычитание единицы сбрасывает его и выставляет все младшие, поэтому `n & (n-1)` = 0. Проверка `n%2 == 0` верна для любого чётного числа.

@@ q
Скомпилируется ли `y := x++`?
- [ ] Да, y получит старое значение x
- [ ] Да, y получит новое значение x
- [x] Нет: `x++` — инструкция, а не выражение
@@ explain
В Go `++` и `--` — отдельные инструкции без значения. Нет и префиксной формы `++x`.

@@ task power-of-two | Степень двойки | xp=40 interview
Реализуйте две функции:

- `IsPowerOfTwo(n int) bool` — `true`, если `n` является степенью двойки (1, 2, 4, 8, …). Для `n <= 0` — `false`.
- `CountBits(n uint) int` — количество единичных битов в числе (популяционный счёт). Не используйте пакет `math/bits`.
@@ hint
Для `IsPowerOfTwo` используйте трюк `n & (n-1)`.
@@ hint
Для `CountBits`: пока `n != 0`, выполняйте `n &= n - 1` (это убирает младший единичный бит) и увеличивайте счётчик.
@@ starter
package main

import "fmt"

func IsPowerOfTwo(n int) bool {
	return false
}

func CountBits(n uint) int {
	return 0
}

func main() {
	fmt.Println(IsPowerOfTwo(64), CountBits(0b1011))
}
@@ solution
package main

import "fmt"

func IsPowerOfTwo(n int) bool {
	return n > 0 && n&(n-1) == 0
}

func CountBits(n uint) int {
	count := 0
	for n != 0 {
		n &= n - 1
		count++
	}
	return count
}

func main() {
	fmt.Println(IsPowerOfTwo(64), CountBits(0b1011))
}
@@ test
package main

import "testing"

func TestIsPowerOfTwo(t *testing.T) {
	yes := []int{1, 2, 4, 8, 1024, 1 << 40}
	no := []int{0, -2, -8, 3, 6, 12, 1023, 1<<40 + 1}
	for _, n := range yes {
		if !IsPowerOfTwo(n) {
			t.Errorf("IsPowerOfTwo(%d) = false, ожидалось true", n)
		}
	}
	for _, n := range no {
		if IsPowerOfTwo(n) {
			t.Errorf("IsPowerOfTwo(%d) = true, ожидалось false", n)
		}
	}
}

func TestCountBits(t *testing.T) {
	cases := map[uint]int{0: 0, 1: 1, 0b1011: 3, 255: 8, 1 << 63: 1, ^uint(0): 64}
	for n, want := range cases {
		if got := CountBits(n); got != want {
			t.Errorf("CountBits(%b) = %d, ожидалось %d", n, got, want)
		}
	}
}

@@ task receipt | Строка чека | xp=40
Реализуйте `ReceiptLine(name string, price float64, qty int) string`, которая форматирует строку чека:

- название выровнено **влево** в поле шириной 12;
- затем цена с **двумя** знаками после запятой, выровненная **вправо** в поле шириной 8;
- затем ` x` и количество;
- затем ` = ` и сумма (цена × количество) с двумя знаками.

Пример: `ReceiptLine("Кофе", 150.5, 2)` → `"Кофе          150.50 x2 = 301.00"`.

Обратите внимание: ширина в `fmt` считается в **символах (рунах)**, а не в байтах, так что кириллица выравнивается правильно.
@@ hint
Используйте `fmt.Sprintf` с глаголами `%-12s`, `%8.2f`, `%d`, `%.2f`.
@@ hint
Сумма: `price * float64(qty)`.
@@ starter
package main

import "fmt"

func ReceiptLine(name string, price float64, qty int) string {
	return fmt.Sprint(name, price, qty)
}

func main() {
	fmt.Println(ReceiptLine("Кофе", 150.5, 2))
	fmt.Println(ReceiptLine("Круассан", 99, 1))
}
@@ solution
package main

import "fmt"

func ReceiptLine(name string, price float64, qty int) string {
	return fmt.Sprintf("%-12s%8.2f x%d = %.2f", name, price, qty, price*float64(qty))
}

func main() {
	fmt.Println(ReceiptLine("Кофе", 150.5, 2))
	fmt.Println(ReceiptLine("Круассан", 99, 1))
}
@@ test
package main

import "testing"

func TestReceiptLine(t *testing.T) {
	cases := []struct {
		name  string
		price float64
		qty   int
		want  string
	}{
		{"Кофе", 150.5, 2, "Кофе          150.50 x2 = 301.00"},
		{"Круассан", 99, 1, "Круассан       99.00 x1 = 99.00"},
		{"Tea", 0.5, 10, "Tea             0.50 x10 = 5.00"},
	}
	for _, c := range cases {
		if got := ReceiptLine(c.name, c.price, c.qty); got != c.want {
			t.Errorf("ReceiptLine(%q, %v, %d) =\n%q\nожидалось\n%q", c.name, c.price, c.qty, got, c.want)
		}
	}
}
