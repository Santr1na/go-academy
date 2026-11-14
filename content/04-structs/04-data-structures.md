---
id: data-structures
title: "Структуры данных: стек, очередь, список"
summary: реализация стека и очереди на срезах, разворот связного списка, сложность операций
xp: 30
---
## Стек (LIFO)

Стек на срезе — самая простая структура: `append` для push и «отрезание» последнего элемента для pop.

```go
type Stack struct {
	items []int
}

func (s *Stack) Push(v int) { s.items = append(s.items, v) }

func (s *Stack) Pop() (int, bool) {
	if len(s.items) == 0 {
		return 0, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}
```

Все операции — амортизированно O(1). Возврат `(значение, ok)` — идиоматичный способ сообщить о пустом стеке без паники.

## Очередь (FIFO)

Наивная очередь `q = q[1:]` работает, но массив под срезом «уползает» и не переиспользуется. Варианты получше:

1. **Кольцевой буфер** — фиксированный массив и два индекса (head, tail) по модулю размера.
2. **Две стека**: `in` для добавления, `out` для извлечения. Когда `out` пуст — перекладываем в него всё из `in` (порядок разворачивается). Каждая операция амортизированно O(1). Это классическая задача с собеседований.
3. `container/list` — двусвязный список из стандартной библиотеки.

```go
import "container/list"

l := list.New()
l.PushBack(1)
l.PushBack(2)
front := l.Front()
l.Remove(front)
fmt.Println(front.Value) // 1 (тип any)
```

## Связный список

```go
type ListNode struct {
	Val  int
	Next *ListNode
}
```

Разворот односвязного списка — одна из самых частых задач на собеседовании. Идея: идём по списку, перенаправляя `Next` каждого узла на предыдущий:

```text
nil ← 1   2 → 3 → nil      prev=1, cur=2
nil ← 1 ← 2   3 → nil      prev=2, cur=3
nil ← 1 ← 2 ← 3            prev=3 — новая голова
```

## Сложность операций

| Структура | Доступ по индексу | Вставка в начало | Вставка в конец | Поиск |
|---|---|---|---|---|
| Срез | O(1) | O(n) | O(1)* | O(n) |
| Связный список | O(n) | O(1) | O(1) с tail | O(n) |
| map | — | — | O(1)* | O(1)* |

\* амортизированно / в среднем.

> **На собеседовании** проговаривайте сложность по времени и памяти и граничные случаи: пустая структура, один элемент, переполнение.

@@ quiz
@@ q
Какова амортизированная сложность `append` в конец среза?
- [x] O(1)
- [ ] O(n)
- [ ] O(log n)
@@ explain
При нехватке ёмкости массив растёт геометрически, поэтому суммарная стоимость n вставок — O(n), т. е. O(1) на операцию в среднем.

@@ q
Очередь на двух стеках: когда элементы перекладываются из `in` в `out`?
- [ ] При каждом добавлении
- [x] Когда нужно извлечь элемент, а `out` пуст
- [ ] Когда `in` переполнен
@@ explain
Перекладывание только при пустом `out` гарантирует, что каждый элемент перемещается не более одного раза, — амортизированно O(1).

@@ q
Что плохого в очереди вида `q = q[1:]` при длительной работе?
- [ ] Это O(n) на каждую операцию
- [x] Освободившееся начало массива не переиспользуется, память растёт и перевыделяется
- [ ] Это вызывает панику на пустом срезе
@@ explain
`q[1:]` просто сдвигает указатель — O(1). Но место в начале массива теряется: `append` в конце регулярно выделяет новые массивы, а старые элементы до сборки мусора остаются в памяти.

@@ task stack | Стек со минимумом | xp=60 interview
Реализуйте стек целых чисел `MinStack` с операциями за **O(1)**:

- `Push(v int)`
- `Pop() (int, bool)` — `false`, если стек пуст
- `Peek() (int, bool)` — верхний элемент без удаления
- `Min() (int, bool)` — текущий минимум в стеке
- `Len() int`

Нулевое значение `MinStack` должно быть готово к работе (`var s MinStack`).
@@ hint
Храните второй срез `mins`: при `Push` добавляйте в него `min(v, текущий минимум)`, при `Pop` — удаляйте последний элемент вместе с основным.
@@ hint
Тогда `Min()` — это просто последний элемент `mins`.
@@ starter
package main

import "fmt"

type MinStack struct {
}

func (s *MinStack) Push(v int) {}

func (s *MinStack) Pop() (int, bool) { return 0, false }

func (s *MinStack) Peek() (int, bool) { return 0, false }

func (s *MinStack) Min() (int, bool) { return 0, false }

func (s *MinStack) Len() int { return 0 }

func main() {
	var s MinStack
	s.Push(3)
	s.Push(1)
	fmt.Println(s.Min())
}
@@ solution
package main

import "fmt"

type MinStack struct {
	items []int
	mins  []int
}

func (s *MinStack) Push(v int) {
	m := v
	if len(s.mins) > 0 {
		m = min(m, s.mins[len(s.mins)-1])
	}
	s.items = append(s.items, v)
	s.mins = append(s.mins, m)
}

func (s *MinStack) Pop() (int, bool) {
	if len(s.items) == 0 {
		return 0, false
	}
	n := len(s.items) - 1
	v := s.items[n]
	s.items = s.items[:n]
	s.mins = s.mins[:n]
	return v, true
}

func (s *MinStack) Peek() (int, bool) {
	if len(s.items) == 0 {
		return 0, false
	}
	return s.items[len(s.items)-1], true
}

func (s *MinStack) Min() (int, bool) {
	if len(s.mins) == 0 {
		return 0, false
	}
	return s.mins[len(s.mins)-1], true
}

func (s *MinStack) Len() int { return len(s.items) }

func main() {
	var s MinStack
	s.Push(3)
	s.Push(1)
	fmt.Println(s.Min())
}
@@ test
package main

import "testing"

func TestMinStack(t *testing.T) {
	var s MinStack
	if _, ok := s.Pop(); ok {
		t.Fatal("Pop на пустом стеке должен вернуть ok=false")
	}
	if _, ok := s.Min(); ok {
		t.Fatal("Min на пустом стеке должен вернуть ok=false")
	}
	for _, v := range []int{5, 3, 7, 3, 1, 8} {
		s.Push(v)
	}
	if s.Len() != 6 {
		t.Fatalf("Len = %d, ожидалось 6", s.Len())
	}
	expect := []struct{ pop, minAfter int }{{8, 1}, {1, 3}, {3, 3}, {7, 3}, {3, 5}}
	if m, _ := s.Min(); m != 1 {
		t.Fatalf("Min = %d, ожидалось 1", m)
	}
	for _, e := range expect {
		if p, _ := s.Peek(); p != e.pop {
			t.Fatalf("Peek = %d, ожидалось %d", p, e.pop)
		}
		v, ok := s.Pop()
		if !ok || v != e.pop {
			t.Fatalf("Pop = %d, %v; ожидалось %d", v, ok, e.pop)
		}
		if m, _ := s.Min(); m != e.minAfter {
			t.Fatalf("после Pop(%d) Min = %d, ожидалось %d", v, m, e.minAfter)
		}
	}
}

@@ task queue | Очередь на двух стеках | xp=60 interview
Реализуйте очередь `Queue` на **двух срезах-стеках** (`in` и `out`) с амортизированной сложностью O(1):

- `Enqueue(v int)`
- `Dequeue() (int, bool)` — `false`, если очередь пуста
- `Len() int`

Нулевое значение должно быть готово к работе.
@@ hint
`Enqueue` всегда кладёт в `in`. `Dequeue`: если `out` пуст — переложите все элементы из `in` в `out` (снимая с конца `in`), затем снимите с конца `out`.
@@ hint
`Len()` = `len(in) + len(out)`.
@@ starter
package main

import "fmt"

type Queue struct {
	in, out []int
}

func (q *Queue) Enqueue(v int) {}

func (q *Queue) Dequeue() (int, bool) { return 0, false }

func (q *Queue) Len() int { return 0 }

func main() {
	var q Queue
	q.Enqueue(1)
	q.Enqueue(2)
	fmt.Println(q.Dequeue())
}
@@ solution
package main

import "fmt"

type Queue struct {
	in, out []int
}

func (q *Queue) Enqueue(v int) { q.in = append(q.in, v) }

func (q *Queue) Dequeue() (int, bool) {
	if len(q.out) == 0 {
		for len(q.in) > 0 {
			n := len(q.in) - 1
			q.out = append(q.out, q.in[n])
			q.in = q.in[:n]
		}
	}
	if len(q.out) == 0 {
		return 0, false
	}
	n := len(q.out) - 1
	v := q.out[n]
	q.out = q.out[:n]
	return v, true
}

func (q *Queue) Len() int { return len(q.in) + len(q.out) }

func main() {
	var q Queue
	q.Enqueue(1)
	q.Enqueue(2)
	fmt.Println(q.Dequeue())
}
@@ test
package main

import "testing"

func TestQueue(t *testing.T) {
	var q Queue
	if _, ok := q.Dequeue(); ok {
		t.Fatal("Dequeue из пустой очереди должен вернуть false")
	}
	q.Enqueue(1)
	q.Enqueue(2)
	q.Enqueue(3)
	if v, _ := q.Dequeue(); v != 1 {
		t.Fatalf("Dequeue = %d, ожидалось 1", v)
	}
	q.Enqueue(4)
	if q.Len() != 3 {
		t.Fatalf("Len = %d, ожидалось 3", q.Len())
	}
	for _, want := range []int{2, 3, 4} {
		if v, ok := q.Dequeue(); !ok || v != want {
			t.Fatalf("Dequeue = %d, %v; ожидалось %d", v, ok, want)
		}
	}
	if q.Len() != 0 {
		t.Fatalf("очередь должна быть пуста")
	}
	for i := 0; i < 1000; i++ {
		q.Enqueue(i)
	}
	for i := 0; i < 1000; i++ {
		if v, _ := q.Dequeue(); v != i {
			t.Fatalf("элемент %d: получено %d", i, v)
		}
	}
}

@@ task reverse-list | Разворот связного списка | xp=50 interview
Реализуйте `ReverseList(head *ListNode) *ListNode` — разворот односвязного списка **на месте** (без создания новых узлов), итеративно за O(n) и O(1) памяти. Верните новую голову.
@@ hint
Три переменные: `var prev *ListNode`, `cur := head`. На каждом шаге: запомните `next := cur.Next`, разверните `cur.Next = prev`, сдвиньтесь `prev, cur = cur, next`.
@@ hint
В конце `prev` указывает на новую голову.
@@ starter
package main

import "fmt"

type ListNode struct {
	Val  int
	Next *ListNode
}

func ReverseList(head *ListNode) *ListNode {
	return head
}

func main() {
	l := &ListNode{1, &ListNode{2, &ListNode{3, nil}}}
	for n := ReverseList(l); n != nil; n = n.Next {
		fmt.Print(n.Val, " ")
	}
}
@@ solution
package main

import "fmt"

type ListNode struct {
	Val  int
	Next *ListNode
}

func ReverseList(head *ListNode) *ListNode {
	var prev *ListNode
	cur := head
	for cur != nil {
		next := cur.Next
		cur.Next = prev
		prev, cur = cur, next
	}
	return prev
}

func main() {
	l := &ListNode{1, &ListNode{2, &ListNode{3, nil}}}
	for n := ReverseList(l); n != nil; n = n.Next {
		fmt.Print(n.Val, " ")
	}
	fmt.Println()
}
@@ test
package main

import (
	"fmt"
	"testing"
)

func build(vals ...int) (*ListNode, []*ListNode) {
	var head *ListNode
	nodes := make([]*ListNode, len(vals))
	for i := len(vals) - 1; i >= 0; i-- {
		head = &ListNode{vals[i], head}
		nodes[i] = head
	}
	return head, nodes
}

func dump(n *ListNode) string {
	var vals []int
	for ; n != nil && len(vals) < 100; n = n.Next {
		vals = append(vals, n.Val)
	}
	return fmt.Sprint(vals)
}

func TestReverseList(t *testing.T) {
	if ReverseList(nil) != nil {
		t.Error("ReverseList(nil) должен вернуть nil")
	}
	h, nodes := build(1, 2, 3, 4, 5)
	r := ReverseList(h)
	if got := dump(r); got != "[5 4 3 2 1]" {
		t.Fatalf("получено %s, ожидалось [5 4 3 2 1]", got)
	}
	if r != nodes[4] {
		t.Error("нужно развернуть существующие узлы, а не создавать новые")
	}
	one, _ := build(7)
	if got := dump(ReverseList(one)); got != "[7]" {
		t.Errorf("один элемент: %s", got)
	}
}
