---
id: performance
title: Память, GC и производительность
summary: стек и куча, escape analysis, сборщик мусора и GOGC, pprof, аллокации, strings.Builder, предаллокация, выравнивание
xp: 45
---
## Стек и куча

- **Стек** горутины — быстрая память, освобождается автоматически при выходе из функции.
- **Куча** — общая память, которую освобождает сборщик мусора (GC). Аллокация в куче и последующая сборка стоят заметно дороже.

Где разместить переменную, решает **компилятор**, а не программист — с помощью **escape analysis**. Переменная «убегает» в кучу, если может пережить свою функцию или её размер неизвестен на этапе компиляции:

```go
func newUser() *User {
	u := User{}  // escapes to heap: указатель возвращается наружу
	return &u
}

func sum() int {
	xs := [3]int{1, 2, 3} // остаётся на стеке
	return xs[0] + xs[1] + xs[2]
}
```

Посмотреть решения компилятора:

```bash
go build -gcflags='-m' ./...
# ./main.go:5:2: moved to heap: u
# ./main.go:12:13: ... argument does not escape
```

Частые причины «побега»: возврат указателя, сохранение в интерфейс (`fmt.Println(x)` обычно заставляет `x` убежать), замыкания, срезы неизвестного размера (`make([]T, n)` с переменным n), очень большие объекты.

## Сборщик мусора

GC в Go — **конкурентный tri-color mark-and-sweep**: большая часть работы идёт параллельно с программой, паузы (STW) обычно меньше миллисекунды. С Go 1.25 доступен новый GC «Green Tea» (по умолчанию с 1.26), лучше работающий с мелкими объектами.

Настройки:

- `GOGC=100` (по умолчанию) — следующий цикл GC начинается, когда куча вырастет на 100% от живых данных. Больше — реже GC, больше памяти;
- `GOMEMLIMIT=1GiB` — мягкий лимит памяти (Go 1.19+): GC работает активнее при приближении к лимиту. Полезно в контейнерах.

Главный способ ускорить GC — **меньше аллокаций**.

## Профилирование: pprof

```go
import _ "net/http/pprof" // регистрирует /debug/pprof/* в DefaultServeMux
go http.ListenAndServe("localhost:6060", nil)
```

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30  # CPU
go tool pprof http://localhost:6060/debug/pprof/heap                # память
go tool pprof -http=:8081 cpu.out                                   # веб-интерфейс, flame graph
go test -bench=. -cpuprofile=cpu.out -memprofile=mem.out
```

Также: профили `goroutine`, `block`, `mutex`; `go tool trace` для анализа планировщика. **Сначала измерьте, потом оптимизируйте.**

## Практические приёмы

**1. Предаллокация.** Если размер известен — выделяйте сразу:

```go
res := make([]int, 0, len(input))          // вместо var res []int
m := make(map[string]int, len(input))
```

**2. strings.Builder** вместо конкатенации в цикле, с `Grow`, если размер можно оценить.

**3. Избегайте лишних преобразований** `string ↔ []byte` — каждое копирует данные. Многие функции имеют обе версии: `strings.*` и `bytes.*`.

**4. sync.Pool** для часто создаваемых временных буферов.

**5. Передача по указателю** больших структур; маленькие (до нескольких машинных слов) быстрее передавать по значению — они остаются на стеке.

**6. Порядок полей** структуры: от крупных к мелким уменьшает выравнивание.

```go
type Bad struct {  // 24 байта
	a bool
	b int64
	c bool
}
type Good struct { // 16 байт
	b int64
	a bool
	c bool
}
```

**7. Бенчмарки с `-benchmem`** и `testing.AllocsPerRun` в тестах фиксируют число аллокаций и защищают от регрессий.

@@ quiz
@@ q
Как узнать, какие переменные компилятор разместил в куче?
- [ ] `go vet -heap`
- [x] `go build -gcflags='-m'`
- [ ] `GODEBUG=heap=1`
@@ explain
Флаг `-m` выводит решения escape analysis и инлайнинга.

@@ q
Что делает `GOGC=200`?
- [ ] Запускает GC каждые 200 мс
- [x] GC запускается реже: когда куча вырастет на 200% от живых данных
- [ ] Ограничивает память 200 МБ
@@ explain
GOGC задаёт допустимый рост кучи между циклами в процентах. Больше значение — меньше нагрузка на CPU, больше расход памяти.

@@ q
Куда, скорее всего, попадёт `u` в коде `func f() *User { u := User{}; return &u }`?
- [ ] На стек — так безопаснее
- [x] В кучу — указатель переживает функцию
- [ ] Ошибка компиляции: возврат адреса локальной переменной
@@ explain
В Go возвращать адрес локальной переменной безопасно: escape analysis переместит её в кучу.

@@ task join-fast | Быстрая склейка чисел | xp=60 interview
Реализуйте `JoinInts(nums []int, sep string) string` — склеивает числа через разделитель: `JoinInts([]int{1, -20, 300}, ", ")` → `"1, -20, 300"`.

Требование производительности: **не больше 1 аллокации** на вызов (тест проверит через `testing.AllocsPerRun`). Используйте `strings.Builder` с `Grow` и `strconv.AppendInt` в стековый буфер — или посчитайте точную длину заранее.
@@ hint
`fmt.Sprint`, `strconv.Itoa` и `+` создают временные строки — это лишние аллокации.
@@ hint
Объявите `var buf [20]byte` на стеке; `b.Write(strconv.AppendInt(buf[:0], int64(n), 10))`. Перед циклом — `b.Grow(len(nums)*(len(sep)+20))`, чтобы Builder выделил память один раз.
@@ starter
package main

import (
	"fmt"
	"strconv"
)

func JoinInts(nums []int, sep string) string {
	s := ""
	for i, n := range nums {
		if i > 0 {
			s += sep
		}
		s += strconv.Itoa(n)
	}
	return s
}

func main() {
	fmt.Println(JoinInts([]int{1, -20, 300}, ", "))
}
@@ solution
package main

import (
	"fmt"
	"strconv"
	"strings"
)

func JoinInts(nums []int, sep string) string {
	if len(nums) == 0 {
		return ""
	}
	var b strings.Builder
	b.Grow(len(nums)*20 + (len(nums)-1)*len(sep))
	var buf [20]byte
	for i, n := range nums {
		if i > 0 {
			b.WriteString(sep)
		}
		b.Write(strconv.AppendInt(buf[:0], int64(n), 10))
	}
	return b.String()
}

func main() {
	fmt.Println(JoinInts([]int{1, -20, 300}, ", "))
}
@@ test
package main

import (
	"math"
	"strconv"
	"strings"
	"testing"
)

func TestJoinInts(t *testing.T) {
	cases := []struct {
		in   []int
		sep  string
		want string
	}{
		{[]int{1, -20, 300}, ", ", "1, -20, 300"},
		{nil, ",", ""},
		{[]int{7}, "-", "7"},
		{[]int{math.MinInt64, math.MaxInt64}, "|", "-9223372036854775808|9223372036854775807"},
	}
	for _, c := range cases {
		if got := JoinInts(c.in, c.sep); got != c.want {
			t.Errorf("JoinInts(%v, %q) = %q, ожидалось %q", c.in, c.sep, got, c.want)
		}
	}
}

func TestJoinIntsAllocs(t *testing.T) {
	nums := make([]int, 1000)
	parts := make([]string, len(nums))
	for i := range nums {
		nums[i] = i * 7919
		parts[i] = strconv.Itoa(nums[i])
	}
	if JoinInts(nums, ",") != strings.Join(parts, ",") {
		t.Fatal("неверный результат на 1000 чисел")
	}
	allocs := testing.AllocsPerRun(20, func() { JoinInts(nums, ",") })
	if allocs > 1 {
		t.Errorf("аллокаций на вызов: %.0f, допустимо не больше 1", allocs)
	}
}

@@ task struct-layout | Оптимизация раскладки структуры | xp=40
Структура `Event` занимает в памяти **больше, чем нужно**, из-за выравнивания полей. Переставьте поля (не меняя их имена и типы) так, чтобы `unsafe.Sizeof(Event{})` стал **минимально возможным — 32 байта** на 64-битной платформе.

Подсказка: размеры — `int64`/`float64`/указатель = 8 байт (выравнивание 8), `int32` = 4, `int16` = 2, `bool`/`byte` = 1.
@@ hint
Расположите поля по убыванию размера: сначала 8-байтовые, затем 4, 2 и 1.
@@ hint
8 (ID) + 8 (Value) + 8 (Next) + 4 (Count) + 2 (Kind) + 1 + 1 (Active, Flag) = 32 байта ровно.
@@ starter
package main

import (
	"fmt"
	"unsafe"
)

type Event struct {
	Active bool
	ID     int64
	Kind   int16
	Value  float64
	Flag   byte
	Count  int32
	Next   *Event
}

func main() {
	fmt.Println("размер Event:", unsafe.Sizeof(Event{}))
}
@@ solution
package main

import (
	"fmt"
	"unsafe"
)

type Event struct {
	ID     int64
	Value  float64
	Next   *Event
	Count  int32
	Kind   int16
	Active bool
	Flag   byte
}

func main() {
	fmt.Println("размер Event:", unsafe.Sizeof(Event{}))
}
@@ test
package main

import (
	"reflect"
	"testing"
	"unsafe"
)

func TestEventLayout(t *testing.T) {
	e := Event{Active: true, ID: 1, Kind: 2, Value: 3.5, Flag: 'x', Count: 4}
	e.Next = &e
	_ = e
	want := map[string]string{"Active": "bool", "ID": "int64", "Kind": "int16", "Value": "float64", "Flag": "uint8", "Count": "int32", "Next": "*main.Event"}
	rt := reflect.TypeOf(Event{})
	if rt.NumField() != len(want) {
		t.Fatalf("у Event %d полей, ожидалось %d", rt.NumField(), len(want))
	}
	for i := 0; i < rt.NumField(); i++ {
		f := rt.Field(i)
		if want[f.Name] != f.Type.String() {
			t.Errorf("поле %s имеет тип %s — менять типы нельзя", f.Name, f.Type)
		}
	}
	if size := unsafe.Sizeof(Event{}); size != 32 {
		t.Errorf("unsafe.Sizeof(Event{}) = %d, ожидалось 32", size)
	}
}
