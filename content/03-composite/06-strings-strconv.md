---
id: strings-strconv
title: Пакеты strings и strconv
summary: поиск, разбиение, замена, Builder, преобразование чисел в строки и обратно
xp: 25
---
## Пакет strings

Самые нужные функции:

```go
strings.Contains("seafood", "foo")       // true
strings.HasPrefix("golang", "go")        // true
strings.HasSuffix("main.go", ".go")      // true
strings.Index("chicken", "ken")          // 4 (байтовый индекс или -1)
strings.Count("cheese", "e")             // 3
strings.ToUpper("привет")                // "ПРИВЕТ"
strings.TrimSpace("  hi \n")             // "hi"
strings.Trim("--x--", "-")               // "x"
strings.TrimPrefix("v1.2", "v")          // "1.2"
strings.Split("a,b,c", ",")              // ["a" "b" "c"]
strings.Fields(" a  b\tc ")              // ["a" "b" "c"] — по пробельным символам
strings.Join([]string{"a", "b"}, "-")    // "a-b"
strings.Repeat("ab", 3)                  // "ababab"
strings.ReplaceAll("oink oink", "k", "ky") // "oinky oinky"
strings.EqualFold("Go", "GO")            // true — сравнение без учёта регистра
before, after, found := strings.Cut("key=value", "=") // "key" "value" true
```

### strings.Builder

Эффективная сборка строки — без копирования на каждой итерации:

```go
var b strings.Builder
b.Grow(64)              // необязательно: заранее выделить память
for i := 3; i > 0; i-- {
	b.WriteString(strconv.Itoa(i))
	b.WriteByte(' ')
}
b.WriteRune('🚀')
fmt.Println(b.String()) // "3 2 1 🚀"
```

`strings.NewReader(s)` превращает строку в `io.Reader`, `strings.NewReplacer` выполняет множество замен за один проход.

## Пакет strconv

Преобразование между строками и базовыми типами:

```go
n, err := strconv.Atoi("42")          // 42, nil
_, err = strconv.Atoi("4x2")          // ошибка: invalid syntax
s := strconv.Itoa(42)                 // "42"

f, _ := strconv.ParseFloat("3.14", 64)
b, _ := strconv.ParseBool("true")
i, _ := strconv.ParseInt("ff", 16, 64) // 255
strconv.FormatInt(255, 2)             // "11111111"
strconv.Quote("привет\n")             // "\"привет\\n\""
```

Ошибки `strconv` имеют тип `*strconv.NumError` с полями `Func`, `Num`, `Err`:

```go
_, err := strconv.Atoi("abc")
fmt.Println(err) // strconv.Atoi: parsing "abc": invalid syntax
```

> **Ловушка:** `string(42)` — это не «42», а символ с кодом 42 (`*`). Для чисел используйте `strconv.Itoa` или `fmt.Sprint`.

## Сравнение строк

Строки сравниваются операторами `==`, `<`, `>` лексикографически **по байтам**. `strings.Compare` существует, но обычно не нужен.

@@ quiz
@@ q
Что вернёт `strings.Fields("  go   is\tfun ")`?
- [ ] `["" "go" "" "is" "fun" ""]`
- [x] `["go" "is" "fun"]`
- [ ] `["go   is" "fun"]`
@@ explain
`Fields` разбивает по любым последовательностям пробельных символов и не возвращает пустых строк. `Split(s, " ")` вернул бы пустые элементы.

@@ q
Что выведет `fmt.Println(strconv.Itoa(65) == string(rune(65)))`?
- [x] `false`
- [ ] `true`
- [ ] Ошибка компиляции
@@ explain
`strconv.Itoa(65)` — это `"65"`, а `string(rune(65))` — `"A"`.

@@ q
Почему в цикле лучше использовать `strings.Builder`, а не `s += x`?
- [ ] `+=` не работает со строками
- [x] Строки неизменяемы, и `+=` каждый раз создаёт новую строку с копированием — O(n²)
- [ ] Builder потокобезопасен
@@ explain
Каждая конкатенация копирует всё накопленное. Builder дописывает в растущий буфер, амортизированно O(n). Builder, кстати, **не** потокобезопасен.

@@ task anagram | Анаграммы | xp=50 interview
Реализуйте `IsAnagram(a, b string) bool` — являются ли строки анаграммами (состоят из одних и тех же букв в том же количестве). Пробелы игнорируются, регистр не важен, строки могут содержать кириллицу.

- `"Listen", "Silent"` → `true`
- `"Апельсин", "спаниель"` → `true`
- `"Dormitory", "dirty room"` → `true`
- `"Go", "Goo"` → `false`

Решение должно работать за O(n) с использованием map.
@@ hint
Посчитайте частоты рун первой строки в `map[rune]int` (увеличивая), а для второй — уменьшайте.
@@ hint
В конце все счётчики должны быть нулевыми. Пробелы пропускайте через `unicode.IsSpace`, регистр приводите `unicode.ToLower`.
@@ starter
package main

import "fmt"

func IsAnagram(a, b string) bool {
	return false
}

func main() {
	fmt.Println(IsAnagram("Listen", "Silent"))
}
@@ solution
package main

import (
	"fmt"
	"unicode"
)

func IsAnagram(a, b string) bool {
	counts := make(map[rune]int)
	for _, r := range a {
		if !unicode.IsSpace(r) {
			counts[unicode.ToLower(r)]++
		}
	}
	for _, r := range b {
		if !unicode.IsSpace(r) {
			counts[unicode.ToLower(r)]--
		}
	}
	for _, c := range counts {
		if c != 0 {
			return false
		}
	}
	return true
}

func main() {
	fmt.Println(IsAnagram("Listen", "Silent"))
}
@@ test
package main

import "testing"

func TestIsAnagram(t *testing.T) {
	cases := []struct {
		a, b string
		want bool
	}{
		{"Listen", "Silent", true},
		{"Апельсин", "спаниель", true},
		{"Dormitory", "dirty room", true},
		{"Go", "Goo", false},
		{"ab", "bb", false},
		{"", "", true},
		{"кот", "ток", true},
		{"aab", "abb", false},
	}
	for _, c := range cases {
		if got := IsAnagram(c.a, c.b); got != c.want {
			t.Errorf("IsAnagram(%q, %q) = %v, ожидалось %v", c.a, c.b, got, c.want)
		}
	}
}

@@ task rle | Сжатие RLE | xp=50 interview
Реализуйте кодирование длин серий: `Compress(s string) string` заменяет каждую серию одинаковых **символов (рун)** на символ и длину серии.

- `"aaabccdddd"` → `"a3b1c2d4"`
- `"жжж"` → `"ж3"`
- `""` → `""`

И обратную функцию `Decompress(s string) (string, error)`: `"a3b1c2"` → `"aaabcc"`. Длина серии может быть многозначной (`"x12"`). Если формат неверный (нет числа после символа, например `"ab2"`), верните ошибку.

Используйте `strings.Builder` и `strconv`.
@@ hint
Для `Compress` пройдите по `[]rune(s)`, считая длину текущей серии; при смене символа запишите `string(prev) + strconv.Itoa(count)`.
@@ hint
Для `Decompress`: берите руну, затем считывайте подряд идущие цифры (`unicode.IsDigit`), превращайте их через `strconv.Atoi` и пишите `strings.Repeat(string(r), n)`.
@@ starter
package main

import "fmt"

func Compress(s string) string {
	return s
}

func Decompress(s string) (string, error) {
	return s, nil
}

func main() {
	c := Compress("aaabccdddd")
	d, err := Decompress(c)
	fmt.Println(c, d, err)
}
@@ solution
package main

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

func Compress(s string) string {
	rs := []rune(s)
	var b strings.Builder
	for i := 0; i < len(rs); {
		j := i
		for j < len(rs) && rs[j] == rs[i] {
			j++
		}
		b.WriteRune(rs[i])
		b.WriteString(strconv.Itoa(j - i))
		i = j
	}
	return b.String()
}

func Decompress(s string) (string, error) {
	rs := []rune(s)
	var b strings.Builder
	for i := 0; i < len(rs); {
		ch := rs[i]
		j := i + 1
		for j < len(rs) && unicode.IsDigit(rs[j]) {
			j++
		}
		if j == i+1 {
			return "", errors.New("ожидалось число после символа " + string(ch))
		}
		n, err := strconv.Atoi(string(rs[i+1 : j]))
		if err != nil {
			return "", err
		}
		b.WriteString(strings.Repeat(string(ch), n))
		i = j
	}
	return b.String(), nil
}

func main() {
	c := Compress("aaabccdddd")
	d, err := Decompress(c)
	fmt.Println(c, d, err)
}
@@ test
package main

import (
	"strings"
	"testing"
)

func TestCompress(t *testing.T) {
	cases := map[string]string{
		"aaabccdddd":            "a3b1c2d4",
		"жжж":                   "ж3",
		"":                      "",
		"a":                     "a1",
		strings.Repeat("x", 12): "x12",
		"abab":                  "a1b1a1b1",
	}
	for in, want := range cases {
		if got := Compress(in); got != want {
			t.Errorf("Compress(%q) = %q, ожидалось %q", in, got, want)
		}
	}
}

func TestDecompress(t *testing.T) {
	cases := map[string]string{"a3b1c2": "aaabcc", "x12": strings.Repeat("x", 12), "": "", "ж2я1": "жжя"}
	for in, want := range cases {
		got, err := Decompress(in)
		if err != nil || got != want {
			t.Errorf("Decompress(%q) = %q, %v; ожидалось %q, nil", in, got, err, want)
		}
	}
	for _, bad := range []string{"ab2", "a", "a2b"} {
		if _, err := Decompress(bad); err == nil {
			t.Errorf("Decompress(%q) должна вернуть ошибку", bad)
		}
	}
}
