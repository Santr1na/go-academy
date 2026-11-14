---
id: arrays
title: Массивы
summary: массивы фиксированной длины, семантика значения, сравнение, многомерные массивы
xp: 20
---
## Массив — значение фиксированной длины

Длина массива — **часть его типа**: `[3]int` и `[4]int` — разные типы.

```go
var a [3]int              // [0 0 0]
b := [3]string{"a", "b"}  // [a b ""]
c := [...]int{1, 2, 3, 4} // длину посчитает компилятор: [4]int
d := [5]int{1: 10, 3: 30} // по индексам: [0 10 0 30 0]

fmt.Println(len(c)) // 4
c[0] = 100
```

Выход за границы — ошибка компиляции для константного индекса и **паника** во время выполнения для переменного:

```go
i := 5
_ = c[i] // panic: runtime error: index out of range [5] with length 4
```

## Массивы копируются целиком

В отличие от многих языков, массив в Go — **значение**, а не ссылка. Присваивание и передача в функцию копируют все элементы:

```go
a := [3]int{1, 2, 3}
b := a       // полная копия
b[0] = 100
fmt.Println(a, b) // [1 2 3] [100 2 3]

func zero(arr [3]int) { arr[0] = 0 }    // меняет копию
func zeroP(arr *[3]int) { arr[0] = 0 }  // меняет оригинал
```

Большие массивы дорого копировать — поэтому в коде чаще используют **срезы**.

## Сравнение

Массивы одного типа можно сравнивать через `==`, если сравнимы их элементы. Поэтому массив может быть **ключом map**:

```go
type Point [2]int
visited := map[Point]bool{}
visited[Point{1, 2}] = true
```

## Многомерные массивы

```go
var grid [3][3]int
grid[1][1] = 5
for _, row := range grid {
	fmt.Println(row)
}
```

## Когда нужны массивы

- фиксированные по смыслу данные: координаты `[3]float64`, хеш `[32]byte` (`sha256.Sum256` возвращает именно массив);
- ключ map из нескольких значений;
- как «хранилище» под срезом (каждый срез ссылается на массив).

@@ quiz
@@ q
Что выведет код?
```go
a := [2]int{1, 2}
b := a
b[0] = 9
fmt.Println(a[0], b[0])
```
- [ ] `9 9`
- [x] `1 9`
- [ ] `1 1`
@@ explain
Массив копируется при присваивании полностью, `a` и `b` — независимые значения.

@@ q
Можно ли присвоить `var x [3]int` значение типа `[4]int`?
- [ ] Да, лишний элемент отбросится
- [x] Нет, это разные типы
- [ ] Да, если использовать `copy`
@@ explain
Длина — часть типа массива, поэтому `[3]int` и `[4]int` несовместимы.

@@ q
Что из этого может быть ключом map?
- [x] `[2]int`
- [ ] `[]int`
- [ ] `map[string]int`
- [ ] `func()`
@@ explain
Ключ map должен быть сравнимым (`==`). Массивы сравнимы, если сравнимы элементы. Срезы, map и функции — нет.

@@ task rotate | Поворот массива | xp=40
Реализуйте `Rotate(a [5]int, k int) [5]int`, которая возвращает **новый** массив, циклически сдвинутый вправо на `k` позиций. `k` может быть больше 5 или отрицательным (сдвиг влево).

`Rotate([5]int{1,2,3,4,5}, 2)` → `[4 5 1 2 3]`.

Исходный массив вызывающего меняться не должен — убедитесь, что понимаете, почему это получается «бесплатно».
@@ hint
Элемент с индексом `i` переходит на позицию `(i + k) % 5`. Для отрицательного `k` сначала нормализуйте: `k = ((k % 5) + 5) % 5`.
@@ hint
Объявите `var res [5]int` и заполните её в цикле `for i, v := range a`.
@@ starter
package main

import "fmt"

func Rotate(a [5]int, k int) [5]int {
	return a
}

func main() {
	fmt.Println(Rotate([5]int{1, 2, 3, 4, 5}, 2))
}
@@ solution
package main

import "fmt"

func Rotate(a [5]int, k int) [5]int {
	n := len(a)
	k = ((k % n) + n) % n
	var res [5]int
	for i, v := range a {
		res[(i+k)%n] = v
	}
	return res
}

func main() {
	fmt.Println(Rotate([5]int{1, 2, 3, 4, 5}, 2))
}
@@ test
package main

import "testing"

func TestRotate(t *testing.T) {
	src := [5]int{1, 2, 3, 4, 5}
	cases := []struct {
		k    int
		want [5]int
	}{
		{0, [5]int{1, 2, 3, 4, 5}},
		{1, [5]int{5, 1, 2, 3, 4}},
		{2, [5]int{4, 5, 1, 2, 3}},
		{5, [5]int{1, 2, 3, 4, 5}},
		{7, [5]int{4, 5, 1, 2, 3}},
		{-1, [5]int{2, 3, 4, 5, 1}},
		{-12, [5]int{3, 4, 5, 1, 2}},
	}
	for _, c := range cases {
		if got := Rotate(src, c.k); got != c.want {
			t.Errorf("Rotate(%v, %d) = %v, ожидалось %v", src, c.k, got, c.want)
		}
	}
	if src != [5]int{1, 2, 3, 4, 5} {
		t.Errorf("исходный массив изменился: %v", src)
	}
}

@@ task matrix | Транспонирование матрицы | xp=40
Реализуйте `Transpose(m [3][3]int) [3][3]int` — транспонирование матрицы 3×3 (строки становятся столбцами), и `Trace(m [3][3]int) int` — сумму элементов главной диагонали.
@@ hint
`res[j][i] = m[i][j]` в двойном цикле.
@@ hint
След: `m[0][0] + m[1][1] + m[2][2]`, лучше в цикле.
@@ starter
package main

import "fmt"

func Transpose(m [3][3]int) [3][3]int {
	return m
}

func Trace(m [3][3]int) int {
	return 0
}

func main() {
	m := [3][3]int{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}
	fmt.Println(Transpose(m), Trace(m))
}
@@ solution
package main

import "fmt"

func Transpose(m [3][3]int) [3][3]int {
	var res [3][3]int
	for i := range m {
		for j := range m[i] {
			res[j][i] = m[i][j]
		}
	}
	return res
}

func Trace(m [3][3]int) int {
	s := 0
	for i := range m {
		s += m[i][i]
	}
	return s
}

func main() {
	m := [3][3]int{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}
	fmt.Println(Transpose(m), Trace(m))
}
@@ test
package main

import "testing"

func TestMatrix(t *testing.T) {
	m := [3][3]int{{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}
	want := [3][3]int{{1, 4, 7}, {2, 5, 8}, {3, 6, 9}}
	if got := Transpose(m); got != want {
		t.Errorf("Transpose = %v, ожидалось %v", got, want)
	}
	if got := Trace(m); got != 15 {
		t.Errorf("Trace = %d, ожидалось 15", got)
	}
	if got := Trace([3][3]int{{-1, 9, 9}, {9, 0, 9}, {9, 9, 4}}); got != 3 {
		t.Errorf("Trace = %d, ожидалось 3", got)
	}
}
