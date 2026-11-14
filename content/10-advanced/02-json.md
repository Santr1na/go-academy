---
id: json
title: encoding/json
summary: Marshal и Unmarshal, теги, omitempty, вложенные структуры, any, потоковое декодирование, свои MarshalJSON
xp: 40
---
## Marshal и Unmarshal

```go
type User struct {
	ID       int       `json:"id"`
	Name     string    `json:"name"`
	Email    string    `json:"email,omitempty"` // не выводить пустое
	Password string    `json:"-"`               // никогда не сериализовать
	Tags     []string  `json:"tags"`
	Created  time.Time `json:"created_at"`       // RFC 3339
	internal int                                // неэкспортируемое — игнорируется
}

u := User{ID: 1, Name: "Аня", Tags: []string{"go"}}
data, err := json.Marshal(u)
// {"id":1,"name":"Аня","tags":["go"],"created_at":"0001-01-01T00:00:00Z"}

pretty, _ := json.MarshalIndent(u, "", "  ")

var u2 User
err = json.Unmarshal(data, &u2) // ВАЖНО: передаём указатель
```

Правила сопоставления:

- сериализуются только **экспортируемые** поля;
- имя берётся из тега, иначе — имя поля; при декодировании регистр ключей **не учитывается**;
- неизвестные поля JSON по умолчанию **игнорируются** (`dec.DisallowUnknownFields()` — чтобы считать их ошибкой);
- отсутствующие в JSON поля сохраняют текущие значения.

## Соответствие типов

| JSON | Go |
|---|---|
| object | struct, `map[string]T` |
| array | срез, массив |
| string | string, `[]byte` (как base64), `time.Time` |
| number | int/float; в `any` — **float64** |
| true/false | bool |
| null | nil (указатель, срез, map, any) |

## Различаем «нет поля» и «нулевое значение»

Используйте указатели: `Age *int` — `nil`, если поля не было, и указатель на 0, если пришло `"age": 0`.

## Произвольный JSON

```go
var v map[string]any
json.Unmarshal([]byte(`{"a":1,"b":[true,"x"]}`), &v)
n := v["a"].(float64)     // числа — float64!
arr := v["b"].([]any)
```

Для отложенного разбора части документа есть `json.RawMessage`.

## Потоковая обработка

```go
dec := json.NewDecoder(r.Body)  // читает прямо из io.Reader
dec.DisallowUnknownFields()
if err := dec.Decode(&req); err != nil { ... }

enc := json.NewEncoder(w)
enc.SetIndent("", "  ")
enc.Encode(resp)                // добавляет '\n'
```

## Своя сериализация

```go
type Status int

func (s Status) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.String()) // "active" вместо 1
}

func (s *Status) UnmarshalJSON(b []byte) error {
	var str string
	if err := json.Unmarshal(b, &str); err != nil {
		return err
	}
	// разобрать str → *s
	return nil
}
```

Также `encoding.TextMarshaler` (`MarshalText`) — используется и для ключей map.

> **Совет:** в Go 1.25 появился экспериментальный `encoding/json/v2` (GOEXPERIMENT=jsonv2) — быстрее и строже. Пока основной — v1.

@@ quiz
@@ q
Что получится при `json.Marshal(struct{ name string; Age int }{"a", 1})`?
- [ ] `{"name":"a","Age":1}`
- [x] `{"Age":1}`
- [ ] Ошибка
@@ explain
Неэкспортируемые поля (с маленькой буквы) пакет `encoding/json` не видит.

@@ q
К какому типу декодируется число в `map[string]any`?
- [ ] `int`
- [ ] `int64`
- [x] `float64`
- [ ] `json.Number` всегда
@@ explain
По умолчанию все числа в `any` становятся `float64`. Чтобы сохранить точность больших целых — `dec.UseNumber()` (тогда `json.Number`).

@@ q
Что делает тег `json:"-"`?
- [ ] Поле называется "-"
- [x] Поле никогда не сериализуется и не десериализуется
- [ ] Поле выводится, только если не пустое
@@ explain
`-` полностью исключает поле. Для поля с именем «-» используют `json:"-,"`. Для пропуска пустых — `omitempty`.

@@ task json-order | Разбор заказа | xp=60
Опишите структуры для JSON заказа:

```json
{
  "order_id": "A-42",
  "customer": {"name": "Аня", "email": "a@x.ru"},
  "items": [{"sku": "tea", "qty": 2, "price": 150.5}, {"sku": "cake", "qty": 1, "price": 300}],
  "comment": "без сахара"
}
```

Реализуйте `ParseOrder(data []byte) (Order, error)` — разбирает JSON и возвращает ошибку, если JSON некорректен, **есть неизвестные поля** или нет `order_id` или список `items` пуст. Реализуйте `(o Order) Total() float64` — сумма `qty * price`.

Реализуйте `Summary(o Order) ([]byte, error)` — JSON вида `{"id":"A-42","total":601,"items":2}`, при этом поле `comment` должно попасть в вывод **только если оно не пустое** (`"comment":"..."`) — используйте отдельную структуру с `omitempty`.
@@ hint
Добавьте теги к полям и используйте декодер со строгим режимом:
```go
type Order struct {
	ID       string   `json:"order_id"`
	Customer Customer `json:"customer"`
	Items    []Item   `json:"items"`
	Comment  string   `json:"comment"`
}

dec := json.NewDecoder(bytes.NewReader(data))
dec.DisallowUnknownFields()
```
@@ hint
Для `Summary` подойдёт анонимная структура:
```go
struct {
	ID      string  `json:"id"`
	Total   float64 `json:"total"`
	Items   int     `json:"items"`
	Comment string  `json:"comment,omitempty"`
}{o.ID, o.Total(), len(o.Items), o.Comment}
```
@@ starter
package main

import "fmt"

type Item struct {
	SKU   string
	Qty   int
	Price float64
}

type Customer struct {
	Name  string
	Email string
}

type Order struct {
	ID       string
	Customer Customer
	Items    []Item
	Comment  string
}

func ParseOrder(data []byte) (Order, error) {
	return Order{}, nil
}

func (o Order) Total() float64 {
	return 0
}

func Summary(o Order) ([]byte, error) {
	return nil, nil
}

func main() {
	o, err := ParseOrder([]byte(`{"order_id":"A-1","customer":{"name":"x"},"items":[{"sku":"a","qty":1,"price":10}]}`))
	fmt.Println(o, err)
}
@@ solution
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
)

type Item struct {
	SKU   string  `json:"sku"`
	Qty   int     `json:"qty"`
	Price float64 `json:"price"`
}

type Customer struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Order struct {
	ID       string   `json:"order_id"`
	Customer Customer `json:"customer"`
	Items    []Item   `json:"items"`
	Comment  string   `json:"comment"`
}

func ParseOrder(data []byte) (Order, error) {
	var o Order
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&o); err != nil {
		return Order{}, fmt.Errorf("parse order: %w", err)
	}
	if o.ID == "" {
		return Order{}, errors.New("parse order: order_id is required")
	}
	if len(o.Items) == 0 {
		return Order{}, errors.New("parse order: items are empty")
	}
	return o, nil
}

func (o Order) Total() float64 {
	total := 0.0
	for _, it := range o.Items {
		total += float64(it.Qty) * it.Price
	}
	return total
}

func Summary(o Order) ([]byte, error) {
	return json.Marshal(struct {
		ID      string  `json:"id"`
		Total   float64 `json:"total"`
		Items   int     `json:"items"`
		Comment string  `json:"comment,omitempty"`
	}{o.ID, o.Total(), len(o.Items), o.Comment})
}

func main() {
	o, err := ParseOrder([]byte(`{"order_id":"A-1","customer":{"name":"x"},"items":[{"sku":"a","qty":1,"price":10}]}`))
	fmt.Println(o, err)
}
@@ test
package main

import "testing"

const sample = `{
  "order_id": "A-42",
  "customer": {"name": "Аня", "email": "a@x.ru"},
  "items": [{"sku": "tea", "qty": 2, "price": 150.5}, {"sku": "cake", "qty": 1, "price": 300}],
  "comment": "без сахара"
}`

func TestParseOrder(t *testing.T) {
	o, err := ParseOrder([]byte(sample))
	if err != nil {
		t.Fatalf("ParseOrder: %v", err)
	}
	if o.ID != "A-42" || o.Customer.Name != "Аня" || o.Customer.Email != "a@x.ru" || len(o.Items) != 2 || o.Items[0].SKU != "tea" || o.Items[1].Qty != 1 {
		t.Errorf("неверно разобрано: %+v", o)
	}
	if o.Total() != 601 {
		t.Errorf("Total = %v, ожидалось 601", o.Total())
	}
	bad := []string{
		`{"order_id": "A", "items": [{"sku":"x","qty":1,"price":1}], "extra": 1}`,
		`{"items": [{"sku":"x","qty":1,"price":1}]}`,
		`{"order_id": "A", "items": []}`,
		`{"order_id": "A", "items": [`,
		`{"order_id": 42, "items": [{"sku":"x","qty":1,"price":1}]}`,
	}
	for _, b := range bad {
		if _, err := ParseOrder([]byte(b)); err == nil {
			t.Errorf("ParseOrder(%s) должна вернуть ошибку", b)
		}
	}
}

func TestSummary(t *testing.T) {
	o, _ := ParseOrder([]byte(sample))
	b, err := Summary(o)
	if err != nil || string(b) != `{"id":"A-42","total":601,"items":2,"comment":"без сахара"}` {
		t.Errorf("Summary = %s, %v", b, err)
	}
	o.Comment = ""
	b, _ = Summary(o)
	if string(b) != `{"id":"A-42","total":601,"items":2}` {
		t.Errorf("пустой comment не должен выводиться: %s", b)
	}
}

@@ task json-enum | Своя сериализация статуса | xp=50
Тип `Status int` с константами `Pending`, `Active`, `Banned` (0, 1, 2) должен сериализоваться в JSON **строкой**: `"pending"`, `"active"`, `"banned"`.

Реализуйте `MarshalJSON` (value receiver) и `UnmarshalJSON` (pointer receiver). Неизвестная строка при разборе → ошибка.

Пример: `json.Marshal(Account{Name: "a", Status: Active})` → `{"name":"a","status":"active"}`.
@@ hint
`func (s Status) MarshalJSON() ([]byte, error) { name, ok := names[s]; if !ok { return nil, fmt.Errorf(...) }; return json.Marshal(name) }`.
@@ hint
В `UnmarshalJSON` сначала `json.Unmarshal(b, &str)`, затем найдите статус по строке и присвойте `*s = st`.
@@ starter
package main

import (
	"encoding/json"
	"fmt"
)

type Status int

const (
	Pending Status = iota
	Active
	Banned
)

type Account struct {
	Name   string `json:"name"`
	Status Status `json:"status"`
}

func main() {
	b, err := json.Marshal(Account{Name: "a", Status: Active})
	fmt.Println(string(b), err)
}
@@ solution
package main

import (
	"encoding/json"
	"fmt"
)

type Status int

const (
	Pending Status = iota
	Active
	Banned
)

var statusNames = map[Status]string{Pending: "pending", Active: "active", Banned: "banned"}

func (s Status) MarshalJSON() ([]byte, error) {
	name, ok := statusNames[s]
	if !ok {
		return nil, fmt.Errorf("unknown status %d", int(s))
	}
	return json.Marshal(name)
}

func (s *Status) UnmarshalJSON(b []byte) error {
	var str string
	if err := json.Unmarshal(b, &str); err != nil {
		return err
	}
	for st, name := range statusNames {
		if name == str {
			*s = st
			return nil
		}
	}
	return fmt.Errorf("unknown status %q", str)
}

type Account struct {
	Name   string `json:"name"`
	Status Status `json:"status"`
}

func main() {
	b, err := json.Marshal(Account{Name: "a", Status: Active})
	fmt.Println(string(b), err)
}
@@ test
package main

import (
	"encoding/json"
	"testing"
)

func TestStatusJSON(t *testing.T) {
	b, err := json.Marshal(Account{Name: "a", Status: Active})
	if err != nil || string(b) != `{"name":"a","status":"active"}` {
		t.Errorf("Marshal = %s, %v", b, err)
	}
	b, _ = json.Marshal([]Status{Pending, Banned})
	if string(b) != `["pending","banned"]` {
		t.Errorf("Marshal среза = %s", b)
	}
	var a Account
	if err := json.Unmarshal([]byte(`{"name":"b","status":"banned"}`), &a); err != nil || a.Status != Banned {
		t.Errorf("Unmarshal: %+v, %v", a, err)
	}
	if err := json.Unmarshal([]byte(`{"status":"deleted"}`), &a); err == nil {
		t.Error("неизвестный статус должен давать ошибку")
	}
	if err := json.Unmarshal([]byte(`{"status":1}`), &a); err == nil {
		t.Error("числовой статус должен давать ошибку")
	}
	if _, err := json.Marshal(Status(9)); err == nil {
		t.Error("Marshal неизвестного статуса должен давать ошибку")
	}
}
