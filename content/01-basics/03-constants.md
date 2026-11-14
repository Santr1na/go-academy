---
id: constants
title: Константы и iota
summary: const, типизированные и нетипизированные константы, перечисления через iota
xp: 20
---
## Константы

Константа — значение, известное **на этапе компиляции**. Его нельзя изменить.

```go
const Pi = 3.14159
const Greeting = "Привет"

const (
	MaxUsers = 100
	Timeout  = 30
)
```

Константами могут быть только числа, строки, руны и булевы значения. Срез или map константой быть не может.

## Нетипизированные константы

`const Big = 1 << 62` — это **нетипизированная** константа. Она имеет «вид» (целое число), но конкретный тип получает только в момент использования. Нетипизированные константы вычисляются с произвольной точностью:

```go
const Huge = 1 << 100        // допустимо, пока не присвоено в int
const Small = Huge >> 98     // 4
var x int = Small            // ок
var f float64 = Huge         // ок: float64 вмещает
// var y int = Huge          // ошибка: constant overflows int
```

Благодаря этому `const Timeout = 30` можно использовать и как `int`, и как `float64`, и как `time.Duration` без преобразований.

Типизированная константа (`const N int = 10`) уже жёстко имеет тип `int`.

## iota — генератор перечислений

Внутри блока `const` идентификатор `iota` равен номеру строки (с нуля). Если у константы не указано выражение, повторяется предыдущее:

```go
type Weekday int

const (
	Sunday Weekday = iota // 0
	Monday                // 1
	Tuesday               // 2
	Wednesday             // 3
)
```

Пропуск значения и выражения:

```go
const (
	_  = iota             // 0 пропускаем
	KB = 1 << (10 * iota) // 1 << 10 = 1024
	MB                    // 1 << 20
	GB                    // 1 << 30
)
```

Битовые флаги:

```go
type Perm uint8

const (
	Read  Perm = 1 << iota // 1
	Write                  // 2
	Exec                   // 4
)

p := Read | Write         // 3
fmt.Println(p&Write != 0) // true
```

> **Совет:** часто первое значение перечисления делают «неизвестным» (`Unknown = iota`), чтобы нулевое значение переменной не совпадало с осмысленным вариантом.

> **Важно:** `iota` сбрасывается в 0 в каждом новом блоке `const`.

@@ quiz
@@ q
Чему равны `A`, `B`, `C`?
```go
const (
	A = iota * 10
	B
	_
	C
)
```
- [ ] 0, 1, 3
- [x] 0, 10, 30
- [ ] 0, 10, 20
- [ ] 10, 20, 40
@@ explain
Выражение `iota * 10` повторяется для каждой строки; `iota` — номер строки: A=0·10, B=1·10, `_`=20 (пропущено), C=3·10=30.

@@ q
Что из этого **не может** быть константой?
- [ ] `const s = "abc"`
- [ ] `const f = 2.5`
- [x] `const xs = []int{1, 2}`
- [ ] `const b = 1 < 2`
@@ explain
Константы — только базовые значения (числа, строки, руны, bool), вычислимые при компиляции. Срез создаётся во время выполнения.

@@ q
Скомпилируется ли код?
```go
const big = 1 << 100
fmt.Println(big >> 98)
```
- [x] Да, напечатает 4
- [ ] Нет: переполнение
- [ ] Да, напечатает 0
@@ explain
Нетипизированные константы вычисляются с произвольной точностью. `big >> 98` = 4 — помещается в `int`, поэтому всё корректно.

@@ task weekdays | Дни недели через iota | xp=40
Объявите тип `Weekday int` и константы `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday` со значениями **1…7** через `iota`.

Также реализуйте `IsWeekend(d Weekday) bool` — `true` для субботы и воскресенья.
@@ hint
Начните с `Monday Weekday = iota + 1`, остальные строки оставьте без выражения.
@@ hint
`return d == Saturday || d == Sunday`
@@ starter
package main

import "fmt"

type Weekday int

// const ( ... )

func IsWeekend(d Weekday) bool {
	return false
}

func main() {
	fmt.Println(IsWeekend(6))
}
@@ solution
package main

import "fmt"

type Weekday int

const (
	Monday Weekday = iota + 1
	Tuesday
	Wednesday
	Thursday
	Friday
	Saturday
	Sunday
)

func IsWeekend(d Weekday) bool {
	return d == Saturday || d == Sunday
}

func main() {
	fmt.Println(IsWeekend(Saturday))
}
@@ test
package main

import "testing"

func TestWeekdays(t *testing.T) {
	days := []Weekday{Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday}
	for i, d := range days {
		if int(d) != i+1 {
			t.Errorf("день №%d имеет значение %d, ожидалось %d", i+1, d, i+1)
		}
		want := i >= 5
		if IsWeekend(d) != want {
			t.Errorf("IsWeekend(%d) = %v, ожидалось %v", d, !want, want)
		}
	}
}

@@ task bytesize | Размеры в байтах | xp=40
Объявите нетипизированные константы `KB`, `MB`, `GB`, `TB` (1024, 1024², …) с помощью `iota` и сдвига.

Затем реализуйте `HumanSize(n int64) string`, которая возвращает размер в самой крупной подходящей единице с одним знаком после запятой: `HumanSize(1536)` → `"1.5 KB"`, `HumanSize(500)` → `"500 B"`, `HumanSize(3*GB)` → `"3.0 GB"`.
@@ hint
`_ = iota` в первой строке, затем `KB = 1 << (10 * iota)`.
@@ hint
Проверяйте от большего к меньшему: `if n >= TB { return fmt.Sprintf("%.1f TB", float64(n)/TB) }`.
@@ starter
package main

import "fmt"

// const ( ... )

func HumanSize(n int64) string {
	return fmt.Sprint(n)
}

func main() {
	fmt.Println(HumanSize(1536))
}
@@ solution
package main

import "fmt"

const (
	_  = iota
	KB = 1 << (10 * iota)
	MB
	GB
	TB
)

func HumanSize(n int64) string {
	switch {
	case n >= TB:
		return fmt.Sprintf("%.1f TB", float64(n)/TB)
	case n >= GB:
		return fmt.Sprintf("%.1f GB", float64(n)/GB)
	case n >= MB:
		return fmt.Sprintf("%.1f MB", float64(n)/MB)
	case n >= KB:
		return fmt.Sprintf("%.1f KB", float64(n)/KB)
	}
	return fmt.Sprintf("%d B", n)
}

func main() {
	fmt.Println(HumanSize(1536))
}
@@ test
package main

import "testing"

func TestByteSize(t *testing.T) {
	if KB != 1024 || MB != 1024*1024 || GB != 1<<30 || TB != 1<<40 {
		t.Fatalf("неверные константы: KB=%d MB=%d GB=%d TB=%d", KB, MB, GB, int64(TB))
	}
	cases := map[int64]string{
		0:        "0 B",
		500:      "500 B",
		1023:     "1023 B",
		1024:     "1.0 KB",
		1536:     "1.5 KB",
		5 * MB:   "5.0 MB",
		3 * GB:   "3.0 GB",
		2*TB + 1: "2.0 TB",
	}
	for in, want := range cases {
		if got := HumanSize(in); got != want {
			t.Errorf("HumanSize(%d) = %q, ожидалось %q", in, got, want)
		}
	}
}
