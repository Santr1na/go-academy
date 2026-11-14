---
id: packages-modules
title: Пакеты, модули и видимость
summary: go.mod, структура проекта, экспорт, internal, init, зависимости и go.sum
xp: 30
---
## Модуль

**Модуль** — единица версионирования и распространения кода: набор пакетов с файлом `go.mod` в корне.

```bash
mkdir shop && cd shop
go mod init github.com/me/shop
```

```text
module github.com/me/shop

go 1.22

require (
	github.com/google/uuid v1.6.0
)
```

- `go get github.com/google/uuid@latest` — добавить/обновить зависимость;
- `go mod tidy` — убрать лишние и добавить недостающие зависимости;
- `go.sum` — контрольные суммы зависимостей (коммитится в репозиторий);
- `go work` — работа с несколькими модулями одновременно.

## Пакет

**Пакет** — каталог с `.go`-файлами, у которых одинаковая строка `package`. Путь импорта = путь модуля + путь каталога:

```text
shop/
├── go.mod                 module github.com/me/shop
├── main.go                package main
├── cart/
│   ├── cart.go            package cart
│   └── cart_test.go
└── internal/
    └── pricing/
        └── pricing.go     package pricing
```

```go
import (
	"github.com/me/shop/cart"
	"github.com/me/shop/internal/pricing"
)
```

Имя пакета — короткое, в нижнем регистре, без подчёркиваний: `cart`, `httputil`, не `cartUtils`. Избегайте пакетов-свалок `util`, `common`, `helpers`.

## Видимость: заглавная буква

Единственное правило доступа в Go: идентификатор, начинающийся с **заглавной буквы**, экспортируется из пакета. Всё остальное приватно для пакета (но видно во всех его файлах).

```go
package cart

type Cart struct {
	Items []Item   // экспортируемое поле
	total int      // приватное
}

func New() *Cart { ... }          // cart.New()
func (c *Cart) Total() int { ... } // геттер без префикса Get
func recalc(c *Cart) { ... }       // видна только внутри пакета cart
```

## Каталог internal

Пакеты внутри `internal/` можно импортировать **только** из родительского дерева каталогов. Это способ скрыть детали реализации от внешних пользователей модуля.

## Функция init

`func init()` выполняется автоматически при инициализации пакета — после инициализации переменных пакета, до `main`. Их может быть несколько в пакете.

Порядок: сначала инициализируются импортированные пакеты (каждый ровно один раз), затем переменные уровня пакета (в порядке зависимостей), затем `init()` в порядке следования файлов.

> **Совет:** избегайте сложной логики в `init` — её трудно тестировать, и она выполняется даже там, где не нужна. Предпочитайте явную инициализацию.

## Циклические импорты запрещены

Если `a` импортирует `b`, то `b` не может импортировать `a`. Решение — вынести общее в третий пакет или ввести интерфейс.

## Пустой импорт и алиасы

```go
import (
	_ "image/png"            // только ради init() — регистрация декодера
	mrand "math/rand/v2"     // алиас при конфликте имён
)
```

@@ quiz
@@ q
Какое поле структуры доступно из другого пакета?
- [ ] `name string`
- [x] `Name string`
- [ ] `_Name string`
- [ ] Все поля, если структура экспортирована
@@ explain
Экспортируются только идентификаторы с заглавной буквы — это касается и полей структур.

@@ q
Кто может импортировать пакет `github.com/me/shop/internal/pricing`?
- [ ] Любой модуль
- [x] Только код внутри `github.com/me/shop/...`
- [ ] Только пакет `main`
@@ explain
Пакеты в `internal` доступны лишь из дерева, корнем которого является родитель каталога `internal`.

@@ q
В каком порядке выполняется инициализация?
- [ ] `main` → `init` → переменные пакета
- [x] импортированные пакеты → переменные пакета → `init` → `main`
- [ ] `init` → импортированные пакеты → `main`
@@ explain
Сначала полностью инициализируются зависимости, затем переменные текущего пакета, затем его функции `init`, и только потом `main`.

@@ task encapsulation | Инкапсуляция | xp=50
Реализуйте тип «счётчик посещений» с **приватными** полями, доступ к которым только через методы:

```go
type Visits struct {
	counts map[string]int // приватное
	total  int            // приватное
}
```

- `NewVisits() *Visits` — конструктор;
- `(v *Visits) Hit(page string)` — увеличивает счётчик страницы и общий счётчик;
- `(v *Visits) Count(page string) int`;
- `(v *Visits) Total() int`;
- `(v *Visits) Top() (page string, n int)` — самая посещаемая страница (при равенстве — лексикографически меньшая; для пустого счётчика — `"", 0`).

Также объявите переменную уровня пакета `registry map[string]*Visits` и заполните её в функции `init()` ключом `"default"` со свежим `NewVisits()`.
@@ hint
`func init() { registry = map[string]*Visits{"default": NewVisits()} }`.
@@ hint
В `Top` перебирайте map и выбирайте `c > n || (c == n && p < page)`.
@@ starter
package main

import "fmt"

type Visits struct {
	counts map[string]int
	total  int
}

func NewVisits() *Visits {
	return &Visits{}
}

func (v *Visits) Hit(page string) {}

func (v *Visits) Count(page string) int { return 0 }

func (v *Visits) Total() int { return 0 }

func (v *Visits) Top() (page string, n int) { return "", 0 }

var registry map[string]*Visits

func main() {
	v := NewVisits()
	v.Hit("/")
	fmt.Println(v.Top())
}
@@ solution
package main

import "fmt"

type Visits struct {
	counts map[string]int
	total  int
}

func NewVisits() *Visits {
	return &Visits{counts: make(map[string]int)}
}

func (v *Visits) Hit(page string) {
	v.counts[page]++
	v.total++
}

func (v *Visits) Count(page string) int { return v.counts[page] }

func (v *Visits) Total() int { return v.total }

func (v *Visits) Top() (page string, n int) {
	for p, c := range v.counts {
		if c > n || (c == n && p < page) {
			page, n = p, c
		}
	}
	return page, n
}

var registry map[string]*Visits

func init() {
	registry = map[string]*Visits{"default": NewVisits()}
}

func main() {
	v := NewVisits()
	v.Hit("/")
	fmt.Println(v.Top())
}
@@ test
package main

import "testing"

func TestVisits(t *testing.T) {
	v := NewVisits()
	if p, n := v.Top(); p != "" || n != 0 {
		t.Errorf("пустой Top = %q, %d", p, n)
	}
	for _, p := range []string{"/b", "/a", "/b", "/c", "/a", "/x"} {
		v.Hit(p)
	}
	if v.Total() != 6 || v.Count("/b") != 2 || v.Count("/none") != 0 {
		t.Errorf("Total=%d Count(/b)=%d", v.Total(), v.Count("/b"))
	}
	if p, n := v.Top(); p != "/a" || n != 2 {
		t.Errorf("Top = %q, %d; ожидалось /a, 2", p, n)
	}
}

func TestRegistry(t *testing.T) {
	d := registry["default"]
	if d == nil {
		t.Fatal("registry[\"default\"] должен быть создан в init()")
	}
	d.Hit("/")
	if d.Total() != 1 {
		t.Error("registry[\"default\"] должен быть рабочим счётчиком")
	}
}
