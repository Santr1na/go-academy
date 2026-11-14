---
id: panic-recover
title: panic и recover
summary: когда паникует runtime, раскрутка стека, recover в defer, превращение паники в ошибку
xp: 30
---
## panic

`panic` аварийно останавливает нормальное выполнение функции. Начинается **раскрутка стека**: выполняются все отложенные (`defer`) вызовы текущей горутины, после чего программа завершается с сообщением и трассировкой стека.

Runtime паникует сам при:

- выходе за границы среза/массива (`index out of range`);
- разыменовании nil-указателя;
- записи в nil-map;
- неудачном type assertion без `ok`;
- делении целого на ноль;
- закрытии закрытого канала, отправке в закрытый канал.

Вызвать панику вручную можно с любым значением: `panic("невозможное состояние")`, `panic(err)`.

## Когда использовать panic

**Почти никогда** для обычных ошибок. Допустимо:

- нарушение инварианта, которое означает баг в программе («этого не может быть»);
- ошибки инициализации, без которых запуск бессмыслен — функции вида `MustCompile`:

```go
var re = regexp.MustCompile(`^\d+$`) // паникует, если регулярка некорректна
```

## recover

`recover()` останавливает панику и возвращает переданное в `panic` значение. Работает **только внутри отложенной функции**, вызванной непосредственно при раскрутке:

```go
func safeDivide(a, b int) (res int, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("recovered: %v", r)
		}
	}()
	return a / b, nil
}

fmt.Println(safeDivide(1, 0)) // 0 recovered: runtime error: integer divide by zero
```

Обратите внимание на **именованный результат** `err` — только так отложенная функция может изменить возвращаемое значение после паники.

## Важные ограничения

- `recover()` вне `defer` (или во вложенной функции внутри defer) возвращает `nil` и ничего не делает.
- Паника в **другой горутине** не может быть перехвачена — она уронит всю программу. Каждая горутина должна сама защищаться, если это нужно:

```go
go func() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("горутина упала: %v", r)
		}
	}()
	work()
}()
```

- `net/http` сервер сам перехватывает панику в обработчике, чтобы один запрос не уронил сервер.
- Фатальные ошибки runtime (`concurrent map writes`, нехватка памяти, deadlock всех горутин) **не перехватываются** `recover`.

## Re-panic

Если паника «не ваша», её можно пробросить дальше: `panic(r)` внутри defer.

@@ quiz
@@ q
Что выведет программа?
```go
func main() {
	defer fmt.Println("1")
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("recovered:", r)
		}
	}()
	panic("boom")
	fmt.Println("2")
}
```
- [ ] `2`, затем `1`
- [x] `recovered: boom`, затем `1`
- [ ] `1`, затем `recovered: boom`
- [ ] Программа упадёт
@@ explain
После паники выполняются отложенные вызовы в порядке LIFO: сначала recover-функция, потом печать «1». Строка `fmt.Println("2")` не выполняется.

@@ q
Можно ли в `main` перехватить панику, произошедшую в другой горутине?
- [ ] Да, через recover в main
- [x] Нет, recover работает только в той же горутине
- [ ] Да, через канал ошибок автоматически
@@ explain
Паника раскручивает стек только своей горутины. Если её там не перехватили — падает весь процесс.

@@ q
Что вернёт функция?
```go
func f() (n int) {
	defer func() { recover(); n = -1 }()
	panic("x")
}
```
- [ ] 0
- [x] -1
- [ ] Программа упадёт
@@ explain
recover останавливает панику, а отложенная функция устанавливает именованный результат `n = -1`. Функция возвращает его нормально.

@@ task safe-call | Превращение паники в ошибку | xp=50 interview
Реализуйте `SafeCall(f func()) (err error)`, которая вызывает `f` и:

- если `f` завершилась нормально — возвращает `nil`;
- если `f` запаниковала — возвращает ошибку с текстом `"panic: <значение>"`;
- если значение паники само является `error` — ошибка должна **оборачивать** его (чтобы работал `errors.Is`).
@@ hint
`defer func() { if r := recover(); r != nil { ... } }()` с именованным результатом `err`.
@@ hint
Для error: `if e, ok := r.(error); ok { err = fmt.Errorf("panic: %w", e) } else { err = fmt.Errorf("panic: %v", r) }`.
@@ starter
package main

import "fmt"

func SafeCall(f func()) (err error) {
	f()
	return nil
}

func main() {
	fmt.Println(SafeCall(func() { panic("boom") }))
}
@@ solution
package main

import "fmt"

func SafeCall(f func()) (err error) {
	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(error); ok {
				err = fmt.Errorf("panic: %w", e)
			} else {
				err = fmt.Errorf("panic: %v", r)
			}
		}
	}()
	f()
	return nil
}

func main() {
	fmt.Println(SafeCall(func() { panic("boom") }))
}
@@ test
package main

import (
	"errors"
	"testing"
)

func TestSafeCall(t *testing.T) {
	if err := SafeCall(func() {}); err != nil {
		t.Errorf("нормальное завершение: %v", err)
	}
	err := SafeCall(func() { panic("boom") })
	if err == nil || err.Error() != "panic: boom" {
		t.Errorf("panic(\"boom\"): %v", err)
	}
	err = SafeCall(func() { panic(42) })
	if err == nil || err.Error() != "panic: 42" {
		t.Errorf("panic(42): %v", err)
	}
	sentinel := errors.New("sentinel")
	err = SafeCall(func() { panic(sentinel) })
	if !errors.Is(err, sentinel) {
		t.Errorf("паника с error должна оборачиваться: %v", err)
	}
	err = SafeCall(func() {
		var m map[string]int
		m["x"] = 1
	})
	if err == nil {
		t.Error("запись в nil map должна превратиться в ошибку")
	}
}

@@ task must | Хелпер Must | xp=40
Реализуйте две функции:

- `MustAtoi(s string) int` — как `strconv.Atoi`, но при ошибке **паникует** с этой ошибкой (`panic(err)`).
- `SumStrings(xs []string) (sum int, err error)` — суммирует числа, вызывая `MustAtoi` для каждой строки, но **сама не паникует**: перехватывает панику через `recover` и возвращает её как ошибку (значение паники — `error`, верните его как есть).
@@ hint
В `SumStrings` объявите именованный `err` и `defer func() { if r := recover(); r != nil { err = r.(error); sum = 0 } }()`.
@@ hint
Сумму при ошибке лучше обнулить, чтобы не возвращать частичный результат.
@@ starter
package main

import (
	"fmt"
	"strconv"
)

func MustAtoi(s string) int {
	n, _ := strconv.Atoi(s)
	return n
}

func SumStrings(xs []string) (sum int, err error) {
	for _, x := range xs {
		sum += MustAtoi(x)
	}
	return sum, nil
}

func main() {
	fmt.Println(SumStrings([]string{"1", "2", "x"}))
}
@@ solution
package main

import (
	"fmt"
	"strconv"
)

func MustAtoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		panic(err)
	}
	return n
}

func SumStrings(xs []string) (sum int, err error) {
	defer func() {
		if r := recover(); r != nil {
			e, ok := r.(error)
			if !ok {
				panic(r)
			}
			sum, err = 0, e
		}
	}()
	for _, x := range xs {
		sum += MustAtoi(x)
	}
	return sum, nil
}

func main() {
	fmt.Println(SumStrings([]string{"1", "2", "x"}))
}
@@ test
package main

import (
	"errors"
	"strconv"
	"testing"
)

func TestMustAtoi(t *testing.T) {
	if MustAtoi("15") != 15 {
		t.Error("MustAtoi(\"15\") != 15")
	}
	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("MustAtoi(\"x\") должна паниковать")
		}
		if _, ok := r.(error); !ok {
			t.Errorf("значение паники должно быть error, получено %T", r)
		}
	}()
	MustAtoi("x")
}

func TestSumStrings(t *testing.T) {
	if s, err := SumStrings([]string{"1", "2", "3"}); s != 6 || err != nil {
		t.Errorf("SumStrings(1,2,3) = %d, %v", s, err)
	}
	s, err := SumStrings([]string{"1", "oops", "3"})
	var ne *strconv.NumError
	if err == nil || !errors.As(err, &ne) || s != 0 {
		t.Errorf("SumStrings с ошибкой: sum=%d err=%v (ожидалась *strconv.NumError и sum=0)", s, err)
	}
}
