---
id: maps
title: Map (словари)
summary: создание, чтение с comma ok, удаление, порядок обхода, nil-map, map как множество
xp: 25
---
## Создание и использование

`map[K]V` — хеш-таблица. Ключ должен быть **сравнимым** типом (числа, строки, bool, указатели, каналы, интерфейсы, структуры и массивы из сравнимых полей).

```go
ages := map[string]int{
	"Аня":  25,
	"Боря": 31,
}
ages["Вика"] = 19       // добавить / обновить
delete(ages, "Боря")    // удалить (если ключа нет — ничего не произойдёт)
fmt.Println(len(ages))  // 2

m := make(map[string][]string, 100) // с подсказкой размера
```

## Чтение: идиома comma ok

Чтение отсутствующего ключа возвращает **нулевое значение** типа — не ошибку и не панику:

```go
fmt.Println(ages["Гоша"]) // 0

age, ok := ages["Гоша"]
if !ok {
	fmt.Println("нет такого")
}
```

Нулевое значение удобно для счётчиков:

```go
counts := map[string]int{}
for _, w := range words {
	counts[w]++ // не нужно проверять наличие ключа
}
```

## Порядок обхода случаен

```go
for k, v := range ages {
	fmt.Println(k, v)
}
```

> **Важно:** порядок обхода map **не определён** и намеренно рандомизируется при каждом `range`. Нужен порядок — соберите ключи и отсортируйте: `keys := slices.Sorted(maps.Keys(m))`.

## nil-map

```go
var m map[string]int   // nil
fmt.Println(m["x"])    // 0 — читать можно
m["x"] = 1             // panic: assignment to entry in nil map
```

Всегда инициализируйте map через `make` или литерал перед записью.

## Map — ссылочный тип

Как и срез, map передаётся «заголовком» (фактически указателем на внутреннюю структуру). Функция, получившая map, может её изменить.

## Множество (set)

В Go нет отдельного типа множества — используют `map[T]struct{}` (пустая структура занимает 0 байт) или `map[T]bool`:

```go
seen := map[string]struct{}{}
seen["go"] = struct{}{}
if _, ok := seen["go"]; ok { /* есть */ }
```

## Значения в map не адресуемы

```go
type P struct{ X int }
m := map[string]P{"a": {1}}
// m["a"].X = 2       // ошибка компиляции: cannot assign
p := m["a"]; p.X = 2; m["a"] = p // так можно
// или храните указатели: map[string]*P
```

## Конкурентный доступ

Обычная map **не потокобезопасна**. Одновременная запись из нескольких горутин приводит к фатальной ошибке `concurrent map writes`. Защищайте мьютексом или используйте `sync.Map` (подробнее — в модуле о конкурентности).

## Пакет maps

```go
import "maps"
maps.Clone(m)              // копия
maps.Equal(a, b)
maps.Keys(m)               // итератор по ключам (Go 1.23+)
clear(m)                   // удалить все ключи (встроенная функция, Go 1.21+)
```

## Разбираем подробнее: четыре свойства, которые нужно понимать

### 1. Переменная типа map — это «пульт», а не сами данные

Сами данные лежат в хеш-таблице где-то в памяти, а переменная хранит ссылку на неё. При передаче в функцию копируется ссылка — обе стороны работают с одной таблицей:

```go
func f(m map[string]int) {
	m["x"] = 1 // меняет общую таблицу — вызывающий это увидит
	m = nil    // меняет только локальную копию ссылки
}

func main() {
	m := map[string]int{}
	f(m)
	fmt.Println(len(m)) // 1
}
```

Запись `m["x"] = 1` идёт «через пульт» в общую таблицу. А `m = nil` — это просто «я положил свой пульт на полку»: у вызывающего кода пульт остался.

### 2. Отсутствующий ключ даёт нулевое значение — и это удобно

Чтение несуществующего ключа не паникует и **не создаёт** этот ключ, а возвращает нулевое значение типа. На этом построены две самые частые идиомы:

```go
// Подсчёт: нулевое значение int — это 0
counts := map[string]int{}
for _, w := range []string{"a", "b", "a"} {
	counts[w]++ // для нового слова: 0 + 1
}
fmt.Println(counts) // map[a:2 b:1]

// Группировка: нулевое значение среза — nil, а append умеет с ним работать
groups := map[string][]int{}
groups["чётные"] = append(groups["чётные"], 2)
groups["чётные"] = append(groups["чётные"], 4)
fmt.Println(groups["чётные"], len(groups["нечётные"])) // [2 4] 0
fmt.Println(len(groups))                                // 1 — чтение ключ не создало
```

Оборотная сторона: по значению `0` нельзя понять, лежит ли в map ноль или ключа нет вовсе. Когда это важно, используйте форму с двумя значениями: `v, ok := m[k]`.

### 3. Значение-структуру нельзя менять «на месте»

```go
type Point struct{ X, Y int }

m := map[string]Point{"a": {1, 2}}
m["a"].X = 10 // ошибка компиляции: cannot assign to struct field m["a"].X in map
```

Элементы map могут переезжать при росте таблицы, поэтому Go не даёт получить на них адрес. Есть два решения:

```go
// Вариант 1: достать, изменить, положить обратно
p := m["a"]
p.X = 10
m["a"] = p

// Вариант 2: хранить указатели
mp := map[string]*Point{"a": {1, 2}}
mp["a"].X = 10 // можно: меняем структуру, на которую указывает значение
```

### 4. Удалять во время обхода можно, добавлять — не стоит

```go
for k := range m {
	delete(m, k) // безопасно: удалённые ключи просто не встретятся дальше
}
```

Если же **добавлять** ключи внутри `range`, новый ключ может попасть в обход, а может и не попасть — результат непредсказуем.

### Обход в нужном порядке

Порядок `range` по map случаен намеренно — чтобы никто на него не полагался. Когда порядок важен, сортируют ключи:

```go
keys := make([]string, 0, len(m))
for k := range m {
	keys = append(keys, k)
}
sort.Strings(keys)
for _, k := range keys {
	fmt.Println(k, m[k])
}
```

### Что может быть ключом

Ключ должен поддерживать сравнение `==`: числа, строки, `bool`, указатели, массивы и структуры из таких типов. Срезы, map и функции ключами быть **не могут** — это ошибка компиляции.

@@ quiz
@@ q
Что произойдёт?
```go
var m map[string]int
m["a"] = 1
```
- [ ] m станет `map[a:1]`
- [x] Паника: assignment to entry in nil map
- [ ] Ошибка компиляции
@@ explain
nil-map можно читать (вернёт нулевые значения), но запись в неё вызывает панику. Нужен `make` или литерал.

@@ q
Что выведет код?
```go
m := map[string]int{"a": 1}
v, ok := m["b"]
fmt.Println(v, ok)
```
- [ ] `nil false`
- [x] `0 false`
- [ ] Паника: key not found
@@ explain
Отсутствующий ключ даёт нулевое значение типа (0) и `ok == false`.

@@ q
В каком порядке `range` обходит map?
- [ ] В порядке добавления
- [ ] Отсортированно по ключам
- [x] В неопределённом порядке, который может меняться от запуска к запуску
@@ explain
Порядок обхода map не специфицирован, а runtime специально рандомизирует его, чтобы код не полагался на случайный порядок.

@@ q
Скомпилируется ли код?
```go
type P struct{ n int }

m := map[string]P{"a": {1}}
m["a"].n = 2
```
- [ ] Да, в `m["a"].n` окажется 2
- [ ] Да, но значение в map не изменится — правится копия
- [x] Нет: `cannot assign to struct field m["a"].n in map`
- [ ] Скомпилируется, но будет паника при запуске
@@ explain
Элементы map не адресуемы — их нельзя менять «на месте». Нужно достать значение, изменить и записать обратно (`p := m["a"]; p.n = 2; m["a"] = p`) либо хранить в map указатели: `map[string]*P`.

@@ q
Что выведет код?
```go
m := map[string]int{"a": 1, "b": 2, "c": 3}
for k := range m {
	delete(m, k)
}
fmt.Println(len(m))
```
- [ ] Паника: нельзя менять map во время обхода
- [x] `0`
- [ ] Непредсказуемо: от 0 до 2
- [ ] `3`
@@ explain
Удаление элементов во время `range` в Go разрешено и безопасно: удалённый ключ просто не встретится в оставшейся части обхода. Непредсказуемо ведёт себя только **добавление** ключей во время обхода.

@@ q
Что выведет код?
```go
m := map[string][]int{}
m["a"] = append(m["a"], 1)
fmt.Println(len(m["a"]), len(m["b"]), len(m))
```
- [ ] Паника: ключа `"a"` нет в map
- [ ] `1 0 2`
- [x] `1 0 1`
- [ ] `1 1 2`
@@ explain
Для отсутствующего ключа возвращается нулевое значение — nil-срез, и `append` с ним работает. Чтение `m["b"]` тоже даёт nil-срез длины 0, но **ключ при чтении не создаётся**: в map по-прежнему один элемент.

@@ q
Что выведет код?
```go
func f(m map[string]int) {
	m["x"] = 1
	m = nil
}

func main() {
	m := map[string]int{}
	f(m)
	fmt.Println(len(m))
}
```
- [ ] `0` — функция получила копию map
- [x] `1`
- [ ] Паника: в `main` map стала nil
- [ ] Ошибка компиляции
@@ explain
В функцию копируется ссылка на общую таблицу, поэтому запись `m["x"] = 1` видна снаружи. А `m = nil` меняет только локальную переменную функции — у `main` своя ссылка, и она по-прежнему указывает на таблицу.

@@ task wordcount | Подсчёт слов | xp=40
Реализуйте `WordCount(s string) map[string]int` — подсчёт количества вхождений каждого слова. Слова разделены пробельными символами (используйте `strings.Fields`), регистр не учитывается (приводите к нижнему через `strings.ToLower`).

`WordCount("Go go GO gopher")` → `map[go:3 gopher:1]`.
@@ hint
`for _, w := range strings.Fields(s) { counts[strings.ToLower(w)]++ }`
@@ hint
Не забудьте создать map: `counts := make(map[string]int)`.
@@ starter
package main

import "fmt"

func WordCount(s string) map[string]int {
	return nil
}

func main() {
	fmt.Println(WordCount("Go go GO gopher"))
}
@@ solution
package main

import (
	"fmt"
	"strings"
)

func WordCount(s string) map[string]int {
	counts := make(map[string]int)
	for _, w := range strings.Fields(s) {
		counts[strings.ToLower(w)]++
	}
	return counts
}

func main() {
	fmt.Println(WordCount("Go go GO gopher"))
}
@@ test
package main

import (
	"maps"
	"testing"
)

func TestWordCount(t *testing.T) {
	cases := []struct {
		in   string
		want map[string]int
	}{
		{"Go go GO gopher", map[string]int{"go": 3, "gopher": 1}},
		{"  a\tb\nA  ", map[string]int{"a": 2, "b": 1}},
		{"Привет ПРИВЕТ мир", map[string]int{"привет": 2, "мир": 1}},
		{"", map[string]int{}},
	}
	for _, c := range cases {
		got := WordCount(c.in)
		if got == nil {
			t.Fatalf("WordCount(%q) вернула nil", c.in)
		}
		if !maps.Equal(got, c.want) {
			t.Errorf("WordCount(%q) = %v, ожидалось %v", c.in, got, c.want)
		}
	}
}

@@ task twosum | Two Sum | xp=60 interview
Знаменитая задача. Дан срез `nums` и число `target`. Реализуйте `TwoSum(nums []int, target int) (int, int, bool)`, которая возвращает **индексы** `i < j` двух разных элементов, сумма которых равна `target`. Если пары нет — `-1, -1, false`.

Требование: решение за **O(n)** — один проход с map «значение → индекс». Если подходящих пар несколько, верните ту, у которой `j` минимален.

`TwoSum([]int{2, 7, 11, 15}, 9)` → `0, 1, true`.
@@ hint
Для каждого элемента `v` с индексом `j` ищите в map число `target - v`, встреченное раньше.
@@ hint
Сначала проверьте map, и только потом добавьте в неё текущий элемент — так один элемент не будет использован дважды.
@@ starter
package main

import "fmt"

func TwoSum(nums []int, target int) (int, int, bool) {
	return -1, -1, false
}

func main() {
	fmt.Println(TwoSum([]int{2, 7, 11, 15}, 9))
}
@@ solution
package main

import "fmt"

func TwoSum(nums []int, target int) (int, int, bool) {
	seen := make(map[int]int, len(nums))
	for j, v := range nums {
		if i, ok := seen[target-v]; ok {
			return i, j, true
		}
		if _, ok := seen[v]; !ok {
			seen[v] = j
		}
	}
	return -1, -1, false
}

func main() {
	fmt.Println(TwoSum([]int{2, 7, 11, 15}, 9))
}
@@ test
package main

import "testing"

func TestTwoSum(t *testing.T) {
	cases := []struct {
		nums   []int
		target int
		i, j   int
		ok     bool
	}{
		{[]int{2, 7, 11, 15}, 9, 0, 1, true},
		{[]int{3, 2, 4}, 6, 1, 2, true},
		{[]int{3, 3}, 6, 0, 1, true},
		{[]int{3}, 6, -1, -1, false},
		{[]int{1, 2, 3}, 100, -1, -1, false},
		{[]int{-3, 4, 3, 90}, 0, 0, 2, true},
		{[]int{5, 1, 5, 4}, 10, 0, 2, true},
	}
	for _, c := range cases {
		i, j, ok := TwoSum(c.nums, c.target)
		if i != c.i || j != c.j || ok != c.ok {
			t.Errorf("TwoSum(%v, %d) = %d, %d, %v; ожидалось %d, %d, %v", c.nums, c.target, i, j, ok, c.i, c.j, c.ok)
		}
	}
	big := make([]int, 200000)
	for i := range big {
		big[i] = i
	}
	if i, j, ok := TwoSum(big, 399997); !ok || i != 199998 || j != 199999 {
		t.Errorf("большой вход: %d %d %v", i, j, ok)
	}
}
