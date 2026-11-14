---
id: embedding
title: Встраивание и конструкторы
summary: композиция вместо наследования, продвижение полей и методов, функции New, функциональные опции
xp: 30
---
## Композиция вместо наследования

В Go нет классов и наследования. Вместо этого используется **встраивание** (embedding): поле без имени, только с типом.

```go
type Animal struct {
	Name string
}

func (a Animal) Describe() string { return "Я " + a.Name }

type Dog struct {
	Animal        // встроенное поле
	Breed  string
}

d := Dog{Animal: Animal{Name: "Шарик"}, Breed: "дворняга"}
fmt.Println(d.Name)       // поле «продвинуто» из Animal
fmt.Println(d.Describe()) // метод тоже продвинут
fmt.Println(d.Animal.Name) // явный доступ
```

## Это не наследование

- `Dog` **не является** `Animal`: функция `func f(a Animal)` не примет `Dog`. Нужно передать `d.Animal`.
- Продвинутый метод вызывается на **встроенном значении**: внутри `Describe` получатель — `Animal`, он ничего не знает о `Dog`. Виртуальных методов нет.

## Переопределение (затенение)

Если у внешнего типа есть метод или поле с тем же именем, оно «закрывает» встроенное:

```go
func (d Dog) Describe() string {
	return d.Animal.Describe() + ", порода " + d.Breed
}
```

Если на одном уровне вложенности окажутся два одинаковых имени (из двух встроенных типов), обращение к нему будет ошибкой компиляции (ambiguous selector).

## Встраивание указателя и интерфейса

```go
type Logger struct{ prefix string }
func (l *Logger) Log(msg string) { fmt.Println(l.prefix + msg) }

type Service struct {
	*Logger              // встроенный указатель
	sync.Mutex           // типичный приём: s.Lock() / s.Unlock()
}
```

Встроить можно и интерфейс — тогда структура «реализует» его методы через поле (часто используется в тестах для частичных моков).

## Конструкторы

В Go нет специальных конструкторов — по соглашению пишут функцию `NewT`:

```go
type Server struct {
	addr    string
	timeout time.Duration
	clients map[string]*Client
}

func NewServer(addr string) *Server {
	return &Server{
		addr:    addr,
		timeout: 30 * time.Second,
		clients: make(map[string]*Client), // map нужно инициализировать!
	}
}
```

> **Совет:** старайтесь, чтобы нулевое значение типа было полезным («make the zero value useful»): `var mu sync.Mutex`, `var b bytes.Buffer`, `var sb strings.Builder` готовы к работе без конструктора.

## Функциональные опции

Популярный паттерн для гибкой настройки без десятка параметров:

```go
type Option func(*Server)

func WithTimeout(d time.Duration) Option {
	return func(s *Server) { s.timeout = d }
}

func NewServer(addr string, opts ...Option) *Server {
	s := &Server{addr: addr, timeout: 30 * time.Second}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

srv := NewServer(":8080", WithTimeout(5*time.Second))
```

@@ quiz
@@ q
Что выведет код?
```go
type Base struct{}
func (Base) Name() string { return "base" }
func (b Base) Hello() string { return "I am " + b.Name() }

type Child struct{ Base }
func (Child) Name() string { return "child" }

func main() {
	fmt.Println(Child{}.Hello())
}
```
- [ ] `I am child`
- [x] `I am base`
- [ ] Ошибка компиляции
@@ explain
`Hello` вызывается на встроенном `Base`, и внутри неё `b.Name()` — это `Base.Name`. Виртуальной диспетчеризации, как в ООП-языках, нет.

@@ q
Можно ли передать `Dog` в функцию `func f(a Animal)`, если `Dog` встраивает `Animal`?
- [ ] Да, это наследование
- [x] Нет, нужно передать `d.Animal`
- [ ] Только через указатель
@@ explain
Встраивание — это композиция. `Dog` и `Animal` — разные типы. Полиморфизм в Go достигается через интерфейсы.

@@ q
Зачем конструктор `NewServer` из примера инициализирует поле `clients` через `make`?
- [ ] Иначе не скомпилируется
- [x] Нулевое значение map — nil, запись в неё вызовет панику
- [ ] Чтобы map была потокобезопасной
@@ explain
nil-map можно читать, но нельзя в неё писать. Конструктор гарантирует корректное начальное состояние.

@@ task options | Функциональные опции | xp=50
Реализуйте конструктор HTTP-клиента с функциональными опциями.

```go
type Client struct {
	BaseURL string
	Timeout time.Duration
	Retries int
	Headers map[string]string
}
```

- `NewClient(baseURL string, opts ...Option) *Client` — значения по умолчанию: `Timeout = 10 * time.Second`, `Retries = 3`, `Headers` — пустая (не nil) map.
- `type Option func(*Client)`
- `WithTimeout(d time.Duration) Option`
- `WithRetries(n int) Option` — отрицательные значения превращать в 0.
- `WithHeader(key, value string) Option` — добавляет заголовок (можно применять несколько раз).
@@ hint
Создайте `c := &Client{...}` со значениями по умолчанию, затем `for _, o := range opts { o(c) }`.
@@ hint
`WithHeader` возвращает `func(c *Client) { c.Headers[key] = value }` — map уже создана в конструкторе.
@@ starter
package main

import (
	"fmt"
	"time"
)

type Client struct {
	BaseURL string
	Timeout time.Duration
	Retries int
	Headers map[string]string
}

type Option func(*Client)

func WithTimeout(d time.Duration) Option {
	return func(c *Client) {}
}

func WithRetries(n int) Option {
	return func(c *Client) {}
}

func WithHeader(key, value string) Option {
	return func(c *Client) {}
}

func NewClient(baseURL string, opts ...Option) *Client {
	return &Client{BaseURL: baseURL}
}

func main() {
	c := NewClient("https://api.example.com", WithTimeout(time.Second), WithHeader("X-Token", "abc"))
	fmt.Printf("%+v\n", *c)
}
@@ solution
package main

import (
	"fmt"
	"time"
)

type Client struct {
	BaseURL string
	Timeout time.Duration
	Retries int
	Headers map[string]string
}

type Option func(*Client)

func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.Timeout = d }
}

func WithRetries(n int) Option {
	return func(c *Client) { c.Retries = max(n, 0) }
}

func WithHeader(key, value string) Option {
	return func(c *Client) { c.Headers[key] = value }
}

func NewClient(baseURL string, opts ...Option) *Client {
	c := &Client{
		BaseURL: baseURL,
		Timeout: 10 * time.Second,
		Retries: 3,
		Headers: make(map[string]string),
	}
	for _, o := range opts {
		o(c)
	}
	return c
}

func main() {
	c := NewClient("https://api.example.com", WithTimeout(time.Second), WithHeader("X-Token", "abc"))
	fmt.Printf("%+v\n", *c)
}
@@ test
package main

import (
	"testing"
	"time"
)

func TestDefaults(t *testing.T) {
	c := NewClient("u")
	if c.BaseURL != "u" || c.Timeout != 10*time.Second || c.Retries != 3 || c.Headers == nil || len(c.Headers) != 0 {
		t.Errorf("значения по умолчанию неверны: %+v", *c)
	}
}

func TestOptions(t *testing.T) {
	c := NewClient("u", WithTimeout(time.Second), WithRetries(5), WithHeader("A", "1"), WithHeader("B", "2"))
	if c.Timeout != time.Second || c.Retries != 5 || c.Headers["A"] != "1" || c.Headers["B"] != "2" {
		t.Errorf("опции применены неверно: %+v", *c)
	}
	if c := NewClient("u", WithRetries(-2)); c.Retries != 0 {
		t.Errorf("WithRetries(-2): Retries = %d, ожидалось 0", c.Retries)
	}
	c1 := NewClient("u", WithHeader("K", "v"))
	c2 := NewClient("u")
	if len(c2.Headers) != 0 || len(c1.Headers) != 1 {
		t.Errorf("у каждого клиента должна быть своя map заголовков")
	}
}

@@ task embed-logger | Встраивание: счётчик с логом | xp=40
Есть тип `Logger`:

```go
type Logger struct{ Lines []string }
func (l *Logger) Log(s string) { l.Lines = append(l.Lines, s) }
```

Создайте тип `Counter`, который **встраивает** `Logger` (по значению) и имеет поле `N int`. Реализуйте метод `(c *Counter) Inc()`, который увеличивает `N` и вызывает **продвинутый** метод `c.Log(...)` со строкой `"inc 1"`, `"inc 2"` и т. д. (новое значение `N`).

Пример: после трёх вызовов `Inc` поле `c.Lines` содержит `["inc 1" "inc 2" "inc 3"]`.
@@ hint
`type Counter struct { Logger; N int }` — встроенное поле без имени.
@@ hint
`c.Log(fmt.Sprintf("inc %d", c.N))` — метод `Log` доступен напрямую благодаря встраиванию.
@@ starter
package main

import "fmt"

type Logger struct{ Lines []string }

func (l *Logger) Log(s string) { l.Lines = append(l.Lines, s) }

type Counter struct {
	// встройте Logger и добавьте поле N
}

func (c *Counter) Inc() {
}

func main() {
	var c Counter
	c.Inc()
	fmt.Println(c)
}
@@ solution
package main

import "fmt"

type Logger struct{ Lines []string }

func (l *Logger) Log(s string) { l.Lines = append(l.Lines, s) }

type Counter struct {
	Logger
	N int
}

func (c *Counter) Inc() {
	c.N++
	c.Log(fmt.Sprintf("inc %d", c.N))
}

func main() {
	var c Counter
	c.Inc()
	c.Inc()
	fmt.Println(c.N, c.Lines)
}
@@ test
package main

import (
	"strings"
	"testing"
)

func TestCounter(t *testing.T) {
	var c Counter
	c.Inc()
	c.Inc()
	c.Inc()
	if c.N != 3 {
		t.Errorf("N = %d, ожидалось 3", c.N)
	}
	if got := strings.Join(c.Lines, ","); got != "inc 1,inc 2,inc 3" {
		t.Errorf("Lines = %q, ожидалось inc 1,inc 2,inc 3", got)
	}
	var l *Logger = &c.Logger
	l.Log("x")
	if len(c.Lines) != 4 {
		t.Errorf("Logger должен быть встроен по значению")
	}
}
