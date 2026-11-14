---
id: strings-runes
title: Строки, байты, руны и UTF-8
summary: неизменяемые строки, индексация по байтам, range по рунам, []byte и []rune, utf8
xp: 30
---
## Строка — неизменяемая последовательность байт

`string` в Go — это **последовательность байт** (обычно в кодировке UTF-8) плюс длина. Строки неизменяемы:

```go
s := "hello"
// s[0] = 'H'    // ошибка компиляции: cannot assign to s[0]
s = "H" + s[1:] // создаётся новая строка
```

## len — это байты, а не символы

В UTF-8 латиница занимает 1 байт, кириллица — 2, иероглифы — 3, эмодзи — 4:

```go
s := "Привет"
fmt.Println(len(s))                    // 12 — байт
fmt.Println(utf8.RuneCountInString(s)) // 6 — символов (рун)
fmt.Println(s[0])                      // 208 — первый БАЙТ, а не 'П'
fmt.Println(s[:2])                     // "П" — срез по байтам
```

> **Ловушка:** `s[:1]` от кириллической строки даст «половинку» символа — невалидный UTF-8.

## rune — символ Unicode

`rune` — псевдоним `int32`, хранит **кодовую точку** Unicode. Символьные литералы пишутся в одинарных кавычках:

```go
r := 'Ж'
fmt.Println(r)          // 1046
fmt.Printf("%c %U\n", r, r) // Ж U+0416
```

## range по строке идёт по рунам

```go
for i, r := range "Go!Яz" {
	fmt.Println(i, string(r))
}
// 0 G
// 1 o
// 2 !
// 3 Я    ← индекс байта
// 5 z    ← 'Я' заняла 2 байта
```

Индекс `i` — позиция **байта**, где начинается руна. Обычный `for i := 0; i < len(s); i++` идёт по байтам.

## Преобразования

```go
b := []byte("Привет")   // байты (копия)
r := []rune("Привет")   // руны (копия), len(r) == 6
s1 := string(b)         // обратно
s2 := string(r)
s3 := string(rune(65))  // "A"
// string(65) — устарело и ловится go vet: даёт "A", а не "65"!
s4 := strconv.Itoa(65)  // "65"
```

Преобразования `string ↔ []byte` и `string ↔ []rune` **копируют** данные.

## Правильный разворот строки

```go
func reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}
```

Разворот по байтам сломает многобайтовые символы. Строго говоря, даже руны не идеальны: некоторые «видимые символы» (графемы), например эмодзи с модификатором цвета кожи или буква с комбинирующим ударением, состоят из нескольких рун. Для них нужны специальные библиотеки.

## Конкатенация

`+` в цикле создаёт новую строку на каждой итерации — O(n²). Для сборки строк используйте `strings.Builder`:

```go
var sb strings.Builder
for i := range 3 {
	fmt.Fprintf(&sb, "%d;", i)
}
fmt.Println(sb.String()) // 0;1;2;
```

## Пакеты unicode и utf8

```go
unicode.IsLetter('ж')   // true
unicode.IsDigit('7')    // true
unicode.ToUpper('ж')    // 'Ж'
utf8.ValidString(s)     // корректна ли UTF-8
utf8.RuneLen('😀')      // 4
```

## Разбираем подробнее: три взгляда на одну строку

На строку можно смотреть тремя способами, и почти все ошибки возникают, когда их путают.

Возьмём строку `"Go🙂"`:

| Взгляд | Что видим | Сколько |
|---|---|---|
| байты (`len(s)`, `s[i]`) | `47 6F F0 9F 99 82` | 6 |
| руны (`[]rune(s)`, `range`) | `G`, `o`, `🙂` | 3 |
| то, что видит человек | три знака | 3 |

Латинская буква занимает 1 байт, кириллическая — 2, большинство эмодзи — 4. Поэтому «длина строки» — вопрос с подвохом: всегда уточняйте, в чём считаем.

```go
s := "Go🙂"
fmt.Println(len(s))                    // 6 — байты
fmt.Println(len([]rune(s)))            // 3 — руны
fmt.Println(utf8.RuneCountInString(s)) // 3 — то же, но без создания среза
```

### Индекс и срез работают с байтами

```go
s := "Привет"
fmt.Println(s[0])       // 208 — первый БАЙТ буквы «П», а не сама буква
fmt.Println(s[:2])      // П  — два байта как раз составляют одну букву
fmt.Println(len(s[:3])) // 3  — отрезали полторы буквы: строка «сломана»
```

`s[i]` возвращает число типа `byte`. Для строк из латиницы это совпадает с символом, поэтому ошибка долго остаётся незамеченной — до первого русского имени или эмодзи. Если нужен «третий символ», сначала превратите строку в руны:

```go
r := []rune("Привет")
fmt.Println(string(r[2])) // и
```

### Символ в одинарных кавычках — это число

```go
x := 'a'
fmt.Println(x)         // 97 — код символа
fmt.Println(string(x)) // a
fmt.Println(x + 1)     // 98
fmt.Println(string(x + 1)) // b
```

`'a'` — константа типа `rune`, то есть обычное целое число. С ним можно считать: `r - '0'` превращает символ-цифру в число, `r - 'a'` — букву в её номер в алфавите.

> **Ловушка:** `string(65)` — это не `"65"`, а `"A"`: число воспринимается как код символа. Чтобы получить текст числа, используйте `strconv.Itoa(65)`.

### Строку нельзя изменить

```go
s := "hello"
s[0] = 'H' // ошибка компиляции: cannot assign to s[0]
```

Строки неизменяемы. Чтобы «исправить» строку, её превращают в срез, меняют и собирают обратно:

```go
b := []byte(s) // для латиницы достаточно байтов
b[0] = 'H'
s = string(b)  // Hello

r := []rune("привет") // для любого текста — руны
r[0] = 'П'
fmt.Println(string(r)) // Привет
```

Каждое такое преобразование **копирует** данные: срез и строка после него независимы.

```go
b := []byte("abc")
s := string(b)
b[0] = 'X'
fmt.Println(s, string(b)) // abc Xbc
```

### Какой инструмент когда использовать

| Задача | Чем пользоваться |
|---|---|
| размер в памяти, работа с сетью и файлами | `len(s)`, `[]byte(s)` |
| количество символов | `utf8.RuneCountInString(s)` |
| обход по символам | `for i, r := range s` |
| доступ к N-му символу, разворот, замена | `[]rune(s)` |
| сборка большой строки по частям | `strings.Builder` |

@@ quiz
@@ q
Что выведет код?
```go
s := "héllo"
fmt.Println(len(s), len([]rune(s)))
```
- [ ] `5 5`
- [x] `6 5`
- [ ] `5 6`
- [ ] `10 5`
@@ explain
`é` в UTF-8 занимает 2 байта, поэтому байт 6, а рун (символов) — 5.

@@ q
Что выведет код?
```go
for i, r := range "аб" {
	fmt.Print(i, string(r), " ")
}
```
- [ ] `0а 1б `
- [x] `0а 2б `
- [ ] `0а 0б `
@@ explain
`range` по строке возвращает байтовый индекс начала руны. Кириллическая «а» занимает 2 байта, поэтому «б» начинается с индекса 2.

@@ q
Что выведет `fmt.Println(string(rune(1046)), strconv.Itoa(1046))`?
- [ ] `1046 1046`
- [x] `Ж 1046`
- [ ] `Ж Ж`
@@ explain
`string(rune)` даёт символ с этим кодом, а `strconv.Itoa` — десятичную запись числа.

@@ q
Что выведет код?
```go
s := "Go🙂"
fmt.Println(len(s), len([]rune(s)))
```
- [ ] `3 3`
- [ ] `4 3`
- [x] `6 3`
- [ ] `6 6`
@@ explain
`len(s)` считает байты: `G` и `o` — по одному, эмодзи в UTF-8 занимает четыре. Всего 6. Рун (символов Unicode) — три.

@@ q
Скомпилируется ли код?
```go
s := "hello"
s[0] = 'H'
fmt.Println(s)
```
- [ ] Да, выведет `Hello`
- [ ] Да, но строка не изменится
- [x] Нет: строки неизменяемы, присваивать по индексу нельзя
- [ ] Скомпилируется, но будет паника
@@ explain
Строка в Go — неизменяемая последовательность байт. Чтобы изменить символ, строку преобразуют в `[]byte` или `[]rune`, меняют элемент и собирают новую строку через `string(...)`.

@@ q
Что выведет код?
```go
b := []byte("abc")
s := string(b)
b[0] = 'X'
fmt.Println(s, string(b))
```
- [ ] `Xbc Xbc`
- [x] `abc Xbc`
- [ ] `abc abc`
- [ ] `Xbc abc`
@@ explain
Преобразование `string(b)` копирует байты: строка `s` и срез `b` после него не связаны. Изменение среза на уже созданную строку не влияет.

@@ q
Что выведет код?
```go
x := 'a'
fmt.Println(x, string(x), x+1)
```
- [ ] `a a b`
- [ ] `a a a1`
- [x] `97 a 98`
- [ ] `97 97 98`
@@ explain
Символ в одинарных кавычках — это число типа `rune`: код символа `a` равен 97. `string(x)` превращает код обратно в текст, а `x + 1` — обычное сложение чисел, получается 98 (код буквы `b`).

@@ task reverse-unicode | Разворот строки с Unicode | xp=50 interview
Реализуйте `Reverse(s string) string`, корректно работающую с любыми символами Unicode (кириллица, иероглифы, эмодзи).

`Reverse("Привет, 世界! 👋")` → `"👋 !界世 ,тевирП"`.

Также реализуйте `RuneLen(s string) int` — количество символов (рун) в строке, **не используя** пакет `utf8` (подсказка: `range`).
@@ hint
Преобразуйте строку в `[]rune`, разверните срез, верните `string(runes)`.
@@ hint
Для `RuneLen` достаточно посчитать итерации `for range s`.
@@ starter
package main

import "fmt"

func Reverse(s string) string {
	b := []byte(s)
	for i, j := 0, len(b)-1; i < j; i, j = i+1, j-1 {
		b[i], b[j] = b[j], b[i]
	}
	return string(b)
}

func RuneLen(s string) int {
	return len(s)
}

func main() {
	fmt.Println(Reverse("Привет, 世界! 👋"), RuneLen("Привет"))
}
@@ solution
package main

import "fmt"

func Reverse(s string) string {
	r := []rune(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

func RuneLen(s string) int {
	n := 0
	for range s {
		n++
	}
	return n
}

func main() {
	fmt.Println(Reverse("Привет, 世界! 👋"), RuneLen("Привет"))
}
@@ test
package main

import "testing"

func TestReverse(t *testing.T) {
	cases := map[string]string{
		"":                 "",
		"a":                "a",
		"Go":               "oG",
		"Привет":           "тевирП",
		"Привет, 世界! 👋": "👋 !界世 ,тевирП",
		"абв123":           "321вба",
	}
	for in, want := range cases {
		if got := Reverse(in); got != want {
			t.Errorf("Reverse(%q) = %q, ожидалось %q", in, got, want)
		}
	}
}

func TestRuneLen(t *testing.T) {
	cases := map[string]int{"": 0, "abc": 3, "Привет": 6, "世界": 2, "👋!": 2}
	for in, want := range cases {
		if got := RuneLen(in); got != want {
			t.Errorf("RuneLen(%q) = %d, ожидалось %d", in, got, want)
		}
	}
}

@@ task palindrome | Палиндром | xp=50 interview
Реализуйте `IsPalindrome(s string) bool`: учитываются только **буквы и цифры** (`unicode.IsLetter`, `unicode.IsDigit`), регистр игнорируется (`unicode.ToLower`).

- `"А роза упала на лапу Азора"` → `true`
- `"A man, a plan, a canal: Panama"` → `true`
- `"Go"` → `false`
- `""` → `true`
@@ hint
Соберите отфильтрованные руны в срез `[]rune` в нижнем регистре, затем сравните с двух концов.
@@ hint
Можно обойтись без доп. памяти: два указателя по `[]rune(s)`, пропуская небуквенные символы. Но вариант со срезом проще и тоже засчитается.
@@ starter
package main

import "fmt"

func IsPalindrome(s string) bool {
	return false
}

func main() {
	fmt.Println(IsPalindrome("А роза упала на лапу Азора"))
}
@@ solution
package main

import (
	"fmt"
	"unicode"
)

func IsPalindrome(s string) bool {
	var rs []rune
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			rs = append(rs, unicode.ToLower(r))
		}
	}
	for i, j := 0, len(rs)-1; i < j; i, j = i+1, j-1 {
		if rs[i] != rs[j] {
			return false
		}
	}
	return true
}

func main() {
	fmt.Println(IsPalindrome("А роза упала на лапу Азора"))
}
@@ test
package main

import "testing"

func TestIsPalindrome(t *testing.T) {
	cases := map[string]bool{
		"А роза упала на лапу Азора":     true,
		"A man, a plan, a canal: Panama": true,
		"Go":                             false,
		"":                               true,
		"!!!":                            true,
		"12321":                          true,
		"12345":                          false,
		"Аргентина манит негра":          true,
		"abca":                           false,
	}
	for in, want := range cases {
		if got := IsPalindrome(in); got != want {
			t.Errorf("IsPalindrome(%q) = %v, ожидалось %v", in, got, want)
		}
	}
}
