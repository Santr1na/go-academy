---
id: interview-algorithms
title: Алгоритмические задачи на Go
summary: группировка анаграмм, top-K частых элементов, слияние интервалов, бинарный поиск, сложность и идиомы Go
xp: 60
---
## Как решать алгоритмическую задачу на собеседовании

1. **Уточните условие**: размеры входа, граничные случаи (пусто, один элемент, дубликаты, отрицательные числа, Unicode), что вернуть при ошибке.
2. **Предложите решение «в лоб»** и его сложность — это показывает понимание.
3. **Улучшите**: map для O(1) поиска, сортировка, два указателя, скользящее окно, куча, бинарный поиск.
4. **Пишите идиоматичный Go**: понятные имена, ранний `return`, без лишних абстракций.
5. **Проверьте** на примерах вслух, включая граничные случаи.

## Полезные инструменты стандартной библиотеки

```go
slices.Sort(xs)                        // O(n log n)
slices.SortFunc(xs, func(a, b T) int { return cmp.Compare(a.X, b.X) })
idx, found := slices.BinarySearch(xs, target)
sort.Search(n, func(i int) bool { return xs[i] >= target }) // первый индекс, где условие истинно

// Куча (приоритетная очередь)
import "container/heap" // реализуйте heap.Interface: Len, Less, Swap, Push, Pop

// Подсчёт частот
freq := make(map[string]int)

// Ключ из нескольких значений — массив или структура
type key [26]byte
```

## Сложность типичных операций

| Операция | Сложность |
|---|---|
| Доступ к элементу среза | O(1) |
| `append` | O(1) амортизированно |
| Поиск/вставка/удаление в map | O(1) в среднем |
| Сортировка | O(n log n) |
| Бинарный поиск | O(log n) |
| Операции кучи (`Push`/`Pop`) | O(log n) |
| `strings.Contains` | O(n·m) в худшем, обычно быстрее |

## Приём: ключ map из отсортированной строки или частот

Для группировки анаграмм ключом может служить отсортированная строка (O(k log k)) или массив частот букв `[26]int` — массивы сравнимы и подходят как ключ map (O(k), но только для фиксированного алфавита).

## Приём: сортировка + один проход

Многие задачи на интервалы, встречи, дубликаты решаются сортировкой и линейным проходом с «текущим» состоянием.

@@ quiz
@@ q
Почему `[26]int` можно использовать как ключ map, а `[]int` — нет?
- [ ] `[26]int` меньше по размеру
- [x] Массивы сравнимы (`==`), срезы — нет
- [ ] map принимает только массивы
@@ explain
Ключ map должен поддерживать `==`. Массивы сравниваются поэлементно, а для срезов `==` определён только с `nil`.

@@ q
Какая сложность у поиска top-K частых элементов через подсчёт в map и кучу размера K?
- [ ] O(n²)
- [x] O(n log K)
- [ ] O(K)
@@ explain
Подсчёт — O(n), затем для каждого из ≤ n уникальных элементов операция с кучей размера K — O(log K).

@@ q
Что вернёт `sort.Search(len(xs), func(i int) bool { return xs[i] >= 5 })` для `xs = [1 3 5 7]`?
- [ ] 5
- [x] 2
- [ ] 3
@@ explain
`sort.Search` возвращает наименьший индекс, для которого условие истинно: `xs[2] = 5`.

@@ task group-anagrams | Группировка анаграмм | xp=60 interview
Реализуйте `GroupAnagrams(words []string) [][]string` — группирует слова-анаграммы.

Чтобы результат был детерминированным:

- слова внутри группы — в порядке появления во входе;
- группы — в порядке появления **первого** слова группы.

`["eat","tea","tan","ate","nat","bat"]` → `[[eat tea ate] [tan nat] [bat]]`.

Слова могут содержать любые символы Unicode (сравнение с учётом регистра).
@@ hint
Ключ группы — отсортированные руны слова: `r := []rune(w); slices.Sort(r); key := string(r)`.
@@ hint
Храните `index map[string]int` — номер группы в результирующем срезе. Новая группа: `index[key] = len(res); res = append(res, []string{w})`.
@@ starter
package main

import "fmt"

func GroupAnagrams(words []string) [][]string {
	return nil
}

func main() {
	fmt.Println(GroupAnagrams([]string{"eat", "tea", "tan", "ate", "nat", "bat"}))
}
@@ solution
package main

import (
	"fmt"
	"slices"
)

func GroupAnagrams(words []string) [][]string {
	index := make(map[string]int)
	var res [][]string
	for _, w := range words {
		r := []rune(w)
		slices.Sort(r)
		key := string(r)
		if i, ok := index[key]; ok {
			res[i] = append(res[i], w)
			continue
		}
		index[key] = len(res)
		res = append(res, []string{w})
	}
	return res
}

func main() {
	fmt.Println(GroupAnagrams([]string{"eat", "tea", "tan", "ate", "nat", "bat"}))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func TestGroupAnagrams(t *testing.T) {
	cases := []struct {
		in   []string
		want string
	}{
		{[]string{"eat", "tea", "tan", "ate", "nat", "bat"}, "[[eat tea ate] [tan nat] [bat]]"},
		{[]string{"кот", "ток", "кто", "мир", "рим"}, "[[кот ток кто] [мир рим]]"},
		{[]string{"", ""}, "[[ ]]"},
		{[]string{"a"}, "[[a]]"},
		{[]string{"ab", "Ba", "ba"}, "[[ab ba] [Ba]]"},
		{nil, "[]"},
	}
	for _, c := range cases {
		if got := fmt.Sprint(GroupAnagrams(c.in)); got != c.want {
			t.Errorf("GroupAnagrams(%q) = %s, ожидалось %s", c.in, got, c.want)
		}
	}
}

@@ task top-k | Top-K частых слов | xp=70 interview
Реализуйте `TopK(words []string, k int) []string` — `k` самых частых слов, по убыванию частоты; при равной частоте — в алфавитном порядке. Если уникальных слов меньше `k` — вернуть все.

`TopK(["go","rust","go","java","rust","go","c"], 2)` → `["go","rust"]`.

Для бонуса решите через `container/heap` за O(n log k), но засчитается и решение с сортировкой.
@@ hint
Посчитайте частоты в map, соберите уникальные слова в срез и отсортируйте `slices.SortFunc` с компаратором `cmp.Or(cmp.Compare(freq[b], freq[a]), cmp.Compare(a, b))`.
@@ hint
Верните `res[:min(k, len(res))]`. Не забудьте случай `k <= 0` — пустой результат.
@@ starter
package main

import "fmt"

func TopK(words []string, k int) []string {
	return nil
}

func main() {
	fmt.Println(TopK([]string{"go", "rust", "go", "java", "rust", "go", "c"}, 2))
}
@@ solution
package main

import (
	"cmp"
	"fmt"
	"slices"
)

func TopK(words []string, k int) []string {
	if k <= 0 {
		return []string{}
	}
	freq := make(map[string]int)
	for _, w := range words {
		freq[w]++
	}
	uniq := make([]string, 0, len(freq))
	for w := range freq {
		uniq = append(uniq, w)
	}
	slices.SortFunc(uniq, func(a, b string) int {
		return cmp.Or(cmp.Compare(freq[b], freq[a]), cmp.Compare(a, b))
	})
	return uniq[:min(k, len(uniq))]
}

func main() {
	fmt.Println(TopK([]string{"go", "rust", "go", "java", "rust", "go", "c"}, 2))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func TestTopK(t *testing.T) {
	words := []string{"go", "rust", "go", "java", "rust", "go", "c"}
	cases := []struct {
		k    int
		want string
	}{
		{2, "[go rust]"},
		{1, "[go]"},
		{4, "[go rust c java]"},
		{10, "[go rust c java]"},
		{0, "[]"},
	}
	for _, c := range cases {
		if got := fmt.Sprint(TopK(words, c.k)); got != c.want {
			t.Errorf("TopK(%d) = %s, ожидалось %s", c.k, got, c.want)
		}
	}
	if got := fmt.Sprint(TopK([]string{"b", "a", "c", "b", "a"}, 2)); got != "[a b]" {
		t.Errorf("равные частоты должны идти по алфавиту: %s", got)
	}
}

@@ task merge-intervals | Слияние интервалов | xp=60 interview
Дан срез интервалов `[][2]int` (начало, конец включительно). Реализуйте `MergeIntervals(in [][2]int) [][2]int` — объединяет пересекающиеся и **соприкасающиеся** (`[1,3]` и `[3,5]`) интервалы, результат отсортирован по началу. Входной срез изменять нельзя.

`[[8,10] [1,3] [2,6] [15,18]]` → `[[1 6] [8 10] [15 18]]`.
@@ hint
Скопируйте вход (`slices.Clone`), отсортируйте по началу интервала.
@@ hint
Идите по отсортированным интервалам: если начало текущего `<=` конца последнего в результате — расширьте конец `last[1] = max(last[1], cur[1])`, иначе добавьте новый.
@@ starter
package main

import "fmt"

func MergeIntervals(in [][2]int) [][2]int {
	return in
}

func main() {
	fmt.Println(MergeIntervals([][2]int{{8, 10}, {1, 3}, {2, 6}, {15, 18}}))
}
@@ solution
package main

import (
	"cmp"
	"fmt"
	"slices"
)

func MergeIntervals(in [][2]int) [][2]int {
	if len(in) == 0 {
		return nil
	}
	sorted := slices.Clone(in)
	slices.SortFunc(sorted, func(a, b [2]int) int { return cmp.Compare(a[0], b[0]) })
	res := [][2]int{sorted[0]}
	for _, cur := range sorted[1:] {
		last := &res[len(res)-1]
		if cur[0] <= last[1] {
			last[1] = max(last[1], cur[1])
		} else {
			res = append(res, cur)
		}
	}
	return res
}

func main() {
	fmt.Println(MergeIntervals([][2]int{{8, 10}, {1, 3}, {2, 6}, {15, 18}}))
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func TestMergeIntervals(t *testing.T) {
	cases := []struct {
		in   [][2]int
		want string
	}{
		{[][2]int{{8, 10}, {1, 3}, {2, 6}, {15, 18}}, "[[1 6] [8 10] [15 18]]"},
		{[][2]int{{1, 3}, {3, 5}}, "[[1 5]]"},
		{[][2]int{{1, 10}, {2, 3}, {4, 5}}, "[[1 10]]"},
		{[][2]int{{5, 6}}, "[[5 6]]"},
		{nil, "[]"},
		{[][2]int{{-5, -1}, {0, 0}, {-1, 0}}, "[[-5 0]]"},
	}
	for _, c := range cases {
		orig := fmt.Sprint(c.in)
		if got := fmt.Sprint(MergeIntervals(c.in)); got != c.want {
			t.Errorf("MergeIntervals(%v) = %s, ожидалось %s", orig, got, c.want)
		}
		if fmt.Sprint(c.in) != orig {
			t.Errorf("входной срез изменён: было %s, стало %v", orig, c.in)
		}
	}
}
