---
id: generic-types
title: Обобщённые типы и структуры данных
summary: generic-структуры, методы с параметрами типа, Set, Stack, LRU-кэш на map + двусвязном списке
xp: 45
---
## Обобщённый тип

Параметры типов могут быть у типов. Методы используют параметры получателя:

```go
type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }

func (s *Stack[T]) Pop() (T, bool) {
	var zero T                      // нулевое значение T
	if len(s.items) == 0 {
		return zero, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}

var s Stack[string]
s.Push("go")
ints := &Stack[int]{}
```

`var zero T` — стандартный способ получить нулевое значение произвольного типа (ещё можно `*new(T)`).

## Set

```go
type Set[T comparable] map[T]struct{}

func NewSet[T comparable](items ...T) Set[T] {
	s := make(Set[T], len(items))
	for _, it := range items {
		s[it] = struct{}{}
	}
	return s
}

func (s Set[T]) Has(v T) bool { _, ok := s[v]; return ok }
```

Тип, основанный на map, — ссылочный: методы с value receiver всё равно меняют общие данные.

## Generic-ограничение как интерфейс с типом

```go
type Number interface{ ~int | ~float64 }

type Matrix[T Number] [][]T

func (m Matrix[T]) Sum() T {
	var s T
	for _, row := range m {
		for _, v := range row {
			s += v
		}
	}
	return s
}
```

## LRU-кэш

**LRU (Least Recently Used)** — кэш фиксированного размера, который при переполнении вытесняет элемент, к которому **дольше всего не обращались**. Классическая задача собеседований: все операции за O(1).

Устройство:

- **map** `key → *элемент списка` — поиск за O(1);
- **двусвязный список** — порядок использования: в начале — самые свежие, в конце — самые старые. Перемещение элемента и удаление с конца — O(1).

```text
map: {a→●, b→●, c→●}
list: [c] ⇄ [a] ⇄ [b]      ← b используется дольше всего
Get(b) → list: [b] ⇄ [c] ⇄ [a]
Put(d) при capacity=3 → вытесняется a: [d] ⇄ [b] ⇄ [c]
```

В Go удобно использовать `container/list` (элементы хранят `any`) — или написать свой generic-список.

```go
import "container/list"

type entry[K comparable, V any] struct {
	key K
	val V
}

l := list.New()
e := l.PushFront(&entry[string, int]{"a", 1})
l.MoveToFront(e)
last := l.Back()
l.Remove(last)
ent := last.Value.(*entry[string, int]) // type assertion из any
```

> **На собеседовании** сначала опишите структуру (map + список), объясните, зачем в элементе списка хранить ключ (чтобы удалить запись из map при вытеснении), затем пишите код.

@@ quiz
@@ q
Как получить нулевое значение параметра типа `T`?
- [ ] `nil`
- [ ] `T{}`
- [x] `var zero T`
- [ ] `T(0)`
@@ explain
`nil` подходит не всем типам, `T{}` — только составным, `T(0)` — только числовым. `var zero T` работает для любого T.

@@ q
Почему в LRU-кэше элемент списка хранит не только значение, но и ключ?
- [ ] Для сортировки
- [x] Чтобы при вытеснении последнего элемента списка удалить соответствующую запись из map
- [ ] Чтобы считать хеш
@@ explain
При вытеснении мы знаем лишь элемент в конце списка; чтобы удалить его из map, нужен ключ.

@@ q
Какова сложность операций Get и Put в правильно реализованном LRU?
- [x] O(1)
- [ ] O(log n)
- [ ] O(n)
@@ explain
Map даёт поиск за O(1), двусвязный список — перемещение и удаление за O(1).

@@ task generic-set | Обобщённое множество | xp=50
Реализуйте тип `Set[T comparable]` на основе map со следующими функциями и методами:

```go
func NewSet[T comparable](items ...T) Set[T]
func (s Set[T]) Add(v T)
func (s Set[T]) Has(v T) bool
func (s Set[T]) Len() int
func Union[T comparable](a, b Set[T]) Set[T]        // новое множество
func Intersect[T comparable](a, b Set[T]) Set[T]    // новое множество
```

`Union` и `Intersect` не должны изменять аргументы.
@@ hint
`type Set[T comparable] map[T]struct{}`.
@@ hint
В `Intersect` итерируйте по меньшему множеству и проверяйте наличие элемента в большем — это быстрее.
@@ starter
package main

import "fmt"

type Set[T comparable] map[T]struct{}

func NewSet[T comparable](items ...T) Set[T] {
	return Set[T]{}
}

func (s Set[T]) Add(v T) {}

func (s Set[T]) Has(v T) bool { return false }

func (s Set[T]) Len() int { return 0 }

func Union[T comparable](a, b Set[T]) Set[T] { return a }

func Intersect[T comparable](a, b Set[T]) Set[T] { return a }

func main() {
	fmt.Println(NewSet(1, 2, 3).Has(2))
}
@@ solution
package main

import "fmt"

type Set[T comparable] map[T]struct{}

func NewSet[T comparable](items ...T) Set[T] {
	s := make(Set[T], len(items))
	for _, it := range items {
		s.Add(it)
	}
	return s
}

func (s Set[T]) Add(v T) { s[v] = struct{}{} }

func (s Set[T]) Has(v T) bool {
	_, ok := s[v]
	return ok
}

func (s Set[T]) Len() int { return len(s) }

func Union[T comparable](a, b Set[T]) Set[T] {
	res := make(Set[T], len(a)+len(b))
	for v := range a {
		res.Add(v)
	}
	for v := range b {
		res.Add(v)
	}
	return res
}

func Intersect[T comparable](a, b Set[T]) Set[T] {
	if len(a) > len(b) {
		a, b = b, a
	}
	res := make(Set[T])
	for v := range a {
		if b.Has(v) {
			res.Add(v)
		}
	}
	return res
}

func main() {
	fmt.Println(NewSet(1, 2, 3).Has(2))
}
@@ test
package main

import "testing"

func TestSet(t *testing.T) {
	s := NewSet("a", "b", "a")
	if s.Len() != 2 || !s.Has("a") || s.Has("z") {
		t.Fatalf("NewSet: len=%d", s.Len())
	}
	s.Add("z")
	if !s.Has("z") || s.Len() != 3 {
		t.Error("Add не работает")
	}
	a := NewSet(1, 2, 3, 4)
	b := NewSet(3, 4, 5)
	u := Union(a, b)
	i := Intersect(a, b)
	if u.Len() != 5 || !u.Has(5) || !u.Has(1) {
		t.Errorf("Union: %v", u)
	}
	if i.Len() != 2 || !i.Has(3) || !i.Has(4) || i.Has(1) {
		t.Errorf("Intersect: %v", i)
	}
	if a.Len() != 4 || b.Len() != 3 {
		t.Error("аргументы не должны изменяться")
	}
	if Intersect(NewSet[int](), a).Len() != 0 {
		t.Error("пересечение с пустым должно быть пустым")
	}
}

@@ task lru | LRU-кэш | xp=80 interview
Реализуйте обобщённый LRU-кэш с операциями за O(1):

```go
func NewLRU[K comparable, V any](capacity int) *LRU[K, V]
func (c *LRU[K, V]) Get(key K) (V, bool)   // обращение делает ключ «самым свежим»
func (c *LRU[K, V]) Put(key K, val V)      // вставка/обновление; при переполнении вытесняет самый старый
func (c *LRU[K, V]) Len() int
```

Обновление существующего ключа через `Put` тоже делает его самым свежим. Используйте map + `container/list` (или свой двусвязный список).
@@ hint
Поля: `cap int`, `ll *list.List`, `items map[K]*list.Element`. В элементе списка храните `*entry[K, V]{key, val}`.
@@ hint
`Get`: найти в map → `ll.MoveToFront(e)` → вернуть значение. `Put`: если есть — обновить и `MoveToFront`; иначе `PushFront`, и если `ll.Len() > cap` — удалить `ll.Back()` и его ключ из map.
@@ starter
package main

import "fmt"

type LRU[K comparable, V any] struct {
	data map[K]V
}

func NewLRU[K comparable, V any](capacity int) *LRU[K, V] {
	return &LRU[K, V]{data: map[K]V{}}
}

func (c *LRU[K, V]) Get(key K) (V, bool) {
	v, ok := c.data[key]
	return v, ok
}

func (c *LRU[K, V]) Put(key K, val V) {
	c.data[key] = val
}

func (c *LRU[K, V]) Len() int { return len(c.data) }

func main() {
	c := NewLRU[string, int](2)
	c.Put("a", 1)
	c.Put("b", 2)
	c.Get("a")
	c.Put("c", 3)
	_, ok := c.Get("b")
	fmt.Println("b в кэше:", ok)
}
@@ solution
package main

import (
	"container/list"
	"fmt"
)

type entry[K comparable, V any] struct {
	key K
	val V
}

type LRU[K comparable, V any] struct {
	cap   int
	ll    *list.List
	items map[K]*list.Element
}

func NewLRU[K comparable, V any](capacity int) *LRU[K, V] {
	return &LRU[K, V]{cap: capacity, ll: list.New(), items: make(map[K]*list.Element)}
}

func (c *LRU[K, V]) Get(key K) (V, bool) {
	if e, ok := c.items[key]; ok {
		c.ll.MoveToFront(e)
		return e.Value.(*entry[K, V]).val, true
	}
	var zero V
	return zero, false
}

func (c *LRU[K, V]) Put(key K, val V) {
	if c.cap <= 0 {
		return
	}
	if e, ok := c.items[key]; ok {
		e.Value.(*entry[K, V]).val = val
		c.ll.MoveToFront(e)
		return
	}
	c.items[key] = c.ll.PushFront(&entry[K, V]{key, val})
	if c.ll.Len() > c.cap {
		last := c.ll.Back()
		c.ll.Remove(last)
		delete(c.items, last.Value.(*entry[K, V]).key)
	}
}

func (c *LRU[K, V]) Len() int { return c.ll.Len() }

func main() {
	c := NewLRU[string, int](2)
	c.Put("a", 1)
	c.Put("b", 2)
	c.Get("a")
	c.Put("c", 3)
	_, ok := c.Get("b")
	fmt.Println("b в кэше:", ok)
}
@@ test
package main

import (
	"fmt"
	"testing"
	"time"
)

func TestLRUBasic(t *testing.T) {
	c := NewLRU[string, int](2)
	c.Put("a", 1)
	c.Put("b", 2)
	if v, ok := c.Get("a"); !ok || v != 1 {
		t.Fatalf("Get(a) = %d, %v", v, ok)
	}
	c.Put("c", 3) // вытесняет b (a недавно читали)
	if _, ok := c.Get("b"); ok {
		t.Error("b должен быть вытеснен")
	}
	if v, ok := c.Get("a"); !ok || v != 1 {
		t.Error("a должен остаться")
	}
	if c.Len() != 2 {
		t.Errorf("Len = %d", c.Len())
	}
	c.Put("c", 30) // обновление делает c свежим
	c.Put("d", 4)  // вытесняет a
	if _, ok := c.Get("a"); ok {
		t.Error("a должен быть вытеснен после обновления c")
	}
	if v, _ := c.Get("c"); v != 30 {
		t.Errorf("c = %d, ожидалось 30", v)
	}
}

func TestLRUCapacityOne(t *testing.T) {
	c := NewLRU[int, string](1)
	c.Put(1, "x")
	c.Put(2, "y")
	if _, ok := c.Get(1); ok || c.Len() != 1 {
		t.Error("ёмкость 1: первый ключ должен быть вытеснен")
	}
}

func TestLRUPerformance(t *testing.T) {
	c := NewLRU[string, int](50000)
	start := time.Now()
	for i := 0; i < 200000; i++ {
		k := fmt.Sprint(i % 70000)
		if _, ok := c.Get(k); !ok {
			c.Put(k, i)
		}
	}
	if c.Len() != 50000 {
		t.Errorf("Len = %d, ожидалось 50000", c.Len())
	}
	if el := time.Since(start); el > 3*time.Second {
		t.Errorf("слишком медленно (%v) — операции должны быть O(1)", el)
	}
}
