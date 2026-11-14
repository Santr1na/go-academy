---
id: context
title: context — отмена и дедлайны
summary: context.Context, WithCancel, WithTimeout, WithDeadline, WithValue, распространение отмены, правила использования
xp: 40
---
## Зачем нужен context

Сервер получил запрос, запустил запросы к БД и другим сервисам, а клиент отключился. Продолжать работу бессмысленно — нужно **отменить всё дерево операций**. `context.Context` переносит через границы API сигнал отмены, дедлайн и значения уровня запроса.

```go
type Context interface {
	Deadline() (deadline time.Time, ok bool)
	Done() <-chan struct{}   // закрывается при отмене
	Err() error              // nil, context.Canceled или context.DeadlineExceeded
	Value(key any) any
}
```

## Создание

```go
ctx := context.Background()            // корень: в main, тестах, инициализации
ctx := context.TODO()                  // «пока не знаю, какой контекст передать»

ctx, cancel := context.WithCancel(parent)
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
ctx, cancel := context.WithDeadline(parent, time.Now().Add(time.Minute))
defer cancel() // ОБЯЗАТЕЛЬНО: освобождает ресурсы таймера и дочерних контекстов
```

Контексты образуют **дерево**: отмена родителя отменяет всех потомков, но не наоборот. Таймаут потомка не может быть дольше, чем у родителя.

С Go 1.20/1.21: `context.WithCancelCause`, `context.Cause(ctx)`, `context.WithoutCancel`, `context.AfterFunc`, `WithTimeoutCause`.

## Проверка отмены

```go
func worker(ctx context.Context, jobs <-chan Job) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case j, ok := <-jobs:
			if !ok {
				return nil
			}
			process(j)
		}
	}
}
```

В долгих вычислениях без каналов можно периодически проверять `if err := ctx.Err(); err != nil { return err }`.

Стандартная библиотека поддерживает контекст повсюду: `http.NewRequestWithContext`, `db.QueryContext`, `exec.CommandContext`, `net.Dialer.DialContext`. В HTTP-обработчике контекст запроса — `r.Context()`; он отменяется, когда клиент отключился.

## WithValue

```go
type ctxKey string
const requestIDKey ctxKey = "requestID"

ctx = context.WithValue(ctx, requestIDKey, "abc-123")
id, _ := ctx.Value(requestIDKey).(string)
```

Используйте **только** для данных уровня запроса (request ID, данные аутентификации, trace span). Не передавайте через контекст обязательные параметры функций. Ключ — собственный неэкспортируемый тип, чтобы избежать коллизий.

## Правила

1. `ctx` — **первый** параметр функции: `func Do(ctx context.Context, ...)`.
2. Не храните контекст в структурах — передавайте явно.
3. Никогда не передавайте `nil` контекст — используйте `context.TODO()`.
4. Всегда вызывайте `cancel()` (линтер `go vet` проверяет это — lostcancel).
5. Функция, получившая контекст, должна вернуться **быстро** после его отмены.

## Пример: отмена при первой ошибке

```go
func firstError(ctx context.Context, tasks []func(context.Context) error) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	errCh := make(chan error, len(tasks)) // буфер — никто не зависнет
	for _, task := range tasks {
		go func() { errCh <- task(ctx) }()
	}
	for range tasks {
		if err := <-errCh; err != nil {
			cancel() // остальные увидят ctx.Done()
			return err
		}
	}
	return nil
}
```

## Разбираем подробнее: дерево отмены

Представьте HTTP-запрос. Обработчик идёт в базу, параллельно — в кэш и во внешний сервис. Пользователь закрыл вкладку. Результат больше никому не нужен, но три операции продолжают работать и тратить ресурсы. `context` решает ровно эту задачу: **один сигнал «хватит» для всех, кто работает на этот запрос**.

Контексты образуют дерево. Каждый новый контекст создаётся из родительского:

```text
Background
└── запрос (таймаут 5 с)
    ├── запрос к базе (таймаут 1 с)
    └── запрос к сервису
        └── повторная попытка
```

Отмена распространяется **сверху вниз**: отменили «запрос» — отменились все четыре потомка. Но не наоборот:

```go
parent, cancelParent := context.WithCancel(context.Background())
defer cancelParent()
child, cancelChild := context.WithCancel(parent)

cancelChild()
fmt.Println(parent.Err(), child.Err()) // <nil> context canceled
```

Отмена ребёнка родителя не трогает.

### Потомок не может прожить дольше родителя

```go
parent, c1 := context.WithTimeout(context.Background(), 50*time.Millisecond)
defer c1()
child, c2 := context.WithTimeout(parent, time.Hour) // «хочу час»
defer c2()

<-child.Done()
fmt.Println(child.Err()) // context deadline exceeded — через 50 мс, а не через час
```

Срок ребёнка — **меньший** из двух: его собственного и родительского. Попросить больше времени, чем осталось у родителя, невозможно.

### Как функция узнаёт об отмене

Контекст сам ничего не останавливает. Он только **сообщает**: канал `ctx.Done()` закрывается, и `ctx.Err()` начинает возвращать причину. Функция должна сама это проверять:

```go
func process(ctx context.Context, items []Item) error {
	for _, it := range items {
		select {
		case <-ctx.Done():
			return ctx.Err() // context.Canceled или context.DeadlineExceeded
		default:
		}
		handle(it)
	}
	return nil
}
```

Если функция не смотрит в контекст, отмена на неё не подействует — она честно доработает до конца.

### cancel нужно вызывать всегда

```go
ctx, cancel := context.WithTimeout(parent, time.Second)
defer cancel() // даже если операция уложилась в срок
```

Вместе с контекстом создаются таймер и запись в родительском контексте. `cancel` их освобождает. Без него они живут, пока не истечёт срок или не отменится родитель, — на нагруженном сервисе это утечка. Вызывать `cancel` несколько раз безопасно: второй вызов ничего не делает.

### Значения: ключ должен быть своего типа

```go
type ctxKey string

ctx := context.WithValue(context.Background(), ctxKey("id"), 42)

fmt.Println(ctx.Value("id"))         // <nil> — ключ типа string не совпадает
fmt.Println(ctx.Value(ctxKey("id"))) // 42
```

Ключи сравниваются **вместе с типом**: `"id"` типа `string` и `"id"` типа `ctxKey` — разные ключи. Это не случайность, а защита: два пакета, не сговариваясь, могут выбрать одно и то же слово, но их неэкспортируемые типы ключей не совпадут.

В контекст кладут только данные, относящиеся к запросу: идентификатор запроса, сведения о пользователе, трассировку. Параметры функций и зависимости (подключение к базе, логгер) через контекст не передают.

### Правила оформления

- `ctx` — **первый параметр** функции: `func Load(ctx context.Context, id int)`.
- Не храните контекст в полях структур — передавайте его в каждый вызов.
- Не передавайте `nil`: если подходящего контекста нет, используйте `context.TODO()`.
- Получив `ctx.Err()`, возвращайте именно её — вызывающий код проверит причину через `errors.Is(err, context.Canceled)`.

@@ quiz
@@ q
Что вернёт `ctx.Err()` после истечения таймаута `context.WithTimeout`?
- [ ] `nil`
- [ ] `context.Canceled`
- [x] `context.DeadlineExceeded`
@@ explain
При истечении дедлайна `Err()` возвращает `context.DeadlineExceeded`, при явном вызове `cancel()` — `context.Canceled`.

@@ q
Что произойдёт с дочерним контекстом, если отменить родительский?
- [x] Дочерний тоже будет отменён
- [ ] Ничего
- [ ] Паника
@@ explain
Отмена распространяется вниз по дереву. Отмена дочернего контекста на родителя не влияет.

@@ q
Зачем вызывать `cancel()`, если операция завершилась успешно и контекст больше не нужен?
- [ ] Не нужно
- [x] Чтобы освободить ресурсы (таймер, связь с родителем); иначе — утечка до отмены родителя
- [ ] Чтобы сохранить результат
@@ explain
Пока `cancel` не вызван, родитель хранит ссылку на дочерний контекст, а таймер продолжает существовать. `go vet` предупреждает о потерянном cancel.

@@ q
Что выведет код?
```go
ctx, cancel := context.WithCancel(context.Background())
cancel()
cancel()
fmt.Println(ctx.Err())
```
- [ ] Паника: повторный вызов `cancel`
- [x] `context canceled`
- [ ] `<nil>`
- [ ] `context deadline exceeded`
@@ explain
Функцию `cancel` можно вызывать сколько угодно раз — срабатывает только первый вызов. Поэтому идиома `defer cancel()` безопасна, даже если контекст уже отменён явно.

@@ q
Что выведет код?
```go
parent, pc := context.WithCancel(context.Background())
defer pc()
child, cc := context.WithCancel(parent)
cc()
fmt.Println(parent.Err(), child.Err())
```
- [ ] `context canceled context canceled`
- [x] `<nil> context canceled`
- [ ] `context canceled <nil>`
- [ ] `<nil> <nil>`
@@ explain
Отмена идёт сверху вниз: отмена родителя отменяет всех потомков, но отмена потомка родителя не затрагивает.

@@ q
Родительский контекст создан с таймаутом 50 мс, дочерний — `context.WithTimeout(parent, time.Hour)`. Когда будет отменён дочерний?
- [ ] Через час
- [x] Через 50 мс — вместе с родителем
- [ ] Через час и 50 мс
- [ ] Никогда: у дочернего свой таймер
@@ explain
Срок дочернего контекста — меньший из собственного и родительского. Потомок не может пережить родителя: когда родитель отменяется, отменяются и все производные от него контексты.

@@ q
Что выведет код?
```go
type key string

func main() {
	ctx := context.WithValue(context.Background(), key("id"), 42)
	fmt.Println(ctx.Value("id"), ctx.Value(key("id")))
}
```
- [ ] `42 42`
- [x] `<nil> 42`
- [ ] `<nil> <nil>`
- [ ] Ошибка компиляции
@@ explain
Ключи контекста сравниваются с учётом типа. Строка `"id"` типа `string` и `key("id")` — разные ключи, хотя текст одинаковый. Поэтому для ключей заводят собственный неэкспортируемый тип: чужой пакет не сможет случайно прочитать или затереть ваше значение.

@@ task process-ctx | Обработка с отменой | xp=60 interview
Реализуйте `Process(ctx context.Context, items []int, f func(int) int) ([]int, error)`:

- последовательно обрабатывает элементы `f(item)`;
- **перед каждым** элементом проверяет контекст; если он отменён — немедленно возвращает уже обработанные результаты и `ctx.Err()`;
- если всё обработано — результаты и `nil`.

И `ProcessWithTimeout(items []int, f func(int) int, d time.Duration) ([]int, error)` — то же самое с таймаутом `d`, созданным через `context.WithTimeout` (не забудьте `cancel`).
@@ hint
`for _, it := range items { if err := ctx.Err(); err != nil { return res, err }; res = append(res, f(it)) }`.
@@ hint
`ctx, cancel := context.WithTimeout(context.Background(), d); defer cancel(); return Process(ctx, items, f)`.
@@ starter
package main

import (
	"context"
	"fmt"
	"time"
)

func Process(ctx context.Context, items []int, f func(int) int) ([]int, error) {
	var res []int
	for _, it := range items {
		res = append(res, f(it))
	}
	return res, nil
}

func ProcessWithTimeout(items []int, f func(int) int, d time.Duration) ([]int, error) {
	return Process(context.Background(), items, f)
}

func main() {
	fmt.Println(ProcessWithTimeout([]int{1, 2, 3}, func(x int) int { return x * 2 }, time.Second))
}
@@ solution
package main

import (
	"context"
	"fmt"
	"time"
)

func Process(ctx context.Context, items []int, f func(int) int) ([]int, error) {
	res := make([]int, 0, len(items))
	for _, it := range items {
		if err := ctx.Err(); err != nil {
			return res, err
		}
		res = append(res, f(it))
	}
	return res, nil
}

func ProcessWithTimeout(items []int, f func(int) int, d time.Duration) ([]int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), d)
	defer cancel()
	return Process(ctx, items, f)
}

func main() {
	fmt.Println(ProcessWithTimeout([]int{1, 2, 3}, func(x int) int { return x * 2 }, time.Second))
}
@@ test
package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestProcessOK(t *testing.T) {
	res, err := Process(context.Background(), []int{1, 2, 3}, func(x int) int { return x + 1 })
	if err != nil || len(res) != 3 || res[2] != 4 {
		t.Errorf("Process = %v, %v", res, err)
	}
}

func TestProcessCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	res, err := Process(ctx, []int{1, 2, 3, 4, 5}, func(x int) int {
		calls++
		if x == 2 {
			cancel()
		}
		return x
	})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("ожидалась context.Canceled, получено %v", err)
	}
	if calls != 2 || len(res) != 2 {
		t.Errorf("после отмены обработка должна остановиться: calls=%d res=%v", calls, res)
	}
}

func TestProcessWithTimeout(t *testing.T) {
	start := time.Now()
	res, err := ProcessWithTimeout(make([]int, 100), func(x int) int {
		time.Sleep(10 * time.Millisecond)
		return x
	}, 55*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("ожидалась DeadlineExceeded, получено %v", err)
	}
	if len(res) == 0 || len(res) > 20 {
		t.Errorf("обработано %d элементов — ожидалось около 5", len(res))
	}
	if time.Since(start) > 500*time.Millisecond {
		t.Errorf("таймаут не сработал вовремя: %v", time.Since(start))
	}
}

@@ task first-error | Параллельные запросы с отменой | xp=70 interview
Реализуйте аналог `errgroup`:

```go
func FetchAll(ctx context.Context, ids []int,
	fetch func(ctx context.Context, id int) (string, error)) ([]string, error)
```

- запускает `fetch` для всех `ids` **параллельно**;
- результаты возвращает в порядке `ids`;
- при **первой ошибке** отменяет общий контекст (чтобы остальные `fetch` могли прерваться) и возвращает эту ошибку, **не дожидаясь** медленных вызовов дольше, чем им нужно на реакцию на отмену;
- если внешний `ctx` отменён — возвращает его ошибку.

Никаких утечек горутин: все запущенные горутины должны завершиться.
@@ hint
`ctx, cancel := context.WithCancel(ctx); defer cancel()`. Ошибки собирайте в буферизованный канал `errCh := make(chan error, len(ids))`.
@@ hint
Каждая горутина: `s, err := fetch(ctx, id); if err != nil { errCh <- err; return }; res[i] = s; errCh <- nil`. Главная горутина читает `len(ids)` значений из `errCh`; на первой ошибке — `cancel()` и `return nil, err`. Благодаря буферу оставшиеся горутины не зависнут.
@@ starter
package main

import (
	"context"
	"fmt"
)

func FetchAll(ctx context.Context, ids []int, fetch func(ctx context.Context, id int) (string, error)) ([]string, error) {
	res := make([]string, len(ids))
	for i, id := range ids {
		s, err := fetch(ctx, id)
		if err != nil {
			return nil, err
		}
		res[i] = s
	}
	return res, nil
}

func main() {
	res, err := FetchAll(context.Background(), []int{1, 2, 3}, func(ctx context.Context, id int) (string, error) {
		return fmt.Sprint("item-", id), nil
	})
	fmt.Println(res, err)
}
@@ solution
package main

import (
	"context"
	"fmt"
)

func FetchAll(ctx context.Context, ids []int, fetch func(ctx context.Context, id int) (string, error)) ([]string, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	res := make([]string, len(ids))
	errCh := make(chan error, len(ids))
	for i, id := range ids {
		go func() {
			s, err := fetch(ctx, id)
			if err == nil {
				res[i] = s
			}
			errCh <- err
		}()
	}
	for range ids {
		select {
		case err := <-errCh:
			if err != nil {
				cancel()
				return nil, err
			}
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return res, nil
}

func main() {
	res, err := FetchAll(context.Background(), []int{1, 2, 3}, func(ctx context.Context, id int) (string, error) {
		return fmt.Sprint("item-", id), nil
	})
	fmt.Println(res, err)
}
@@ test
package main

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"sync/atomic"
	"testing"
	"time"
)

func TestFetchAllOK(t *testing.T) {
	start := time.Now()
	res, err := FetchAll(context.Background(), []int{3, 1, 2}, func(ctx context.Context, id int) (string, error) {
		time.Sleep(time.Duration(id) * 20 * time.Millisecond)
		return fmt.Sprint("item-", id), nil
	})
	if err != nil || fmt.Sprint(res) != "[item-3 item-1 item-2]" {
		t.Errorf("FetchAll = %v, %v", res, err)
	}
	if el := time.Since(start); el > 150*time.Millisecond {
		t.Errorf("запросы должны идти параллельно: %v", el)
	}
}

func TestFetchAllFirstError(t *testing.T) {
	before := runtime.NumGoroutine()
	boom := errors.New("boom")
	var cancelled atomic.Int32
	start := time.Now()
	_, err := FetchAll(context.Background(), []int{1, 2, 3, 4}, func(ctx context.Context, id int) (string, error) {
		if id == 2 {
			time.Sleep(10 * time.Millisecond)
			return "", boom
		}
		select {
		case <-time.After(2 * time.Second):
			return "slow", nil
		case <-ctx.Done():
			cancelled.Add(1)
			return "", ctx.Err()
		}
	})
	if !errors.Is(err, boom) {
		t.Errorf("ожидалась ошибка boom, получено %v", err)
	}
	if el := time.Since(start); el > 500*time.Millisecond {
		t.Errorf("FetchAll ждал медленные запросы (%v) вместо отмены", el)
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) && (cancelled.Load() < 3 || runtime.NumGoroutine() > before) {
		time.Sleep(10 * time.Millisecond)
	}
	if cancelled.Load() != 3 {
		t.Errorf("остальные запросы должны получить отмену контекста: отменено %d из 3", cancelled.Load())
	}
	if runtime.NumGoroutine() > before {
		t.Errorf("утечка горутин: было %d, стало %d", before, runtime.NumGoroutine())
	}
}

func TestFetchAllParentCancel(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err := FetchAll(ctx, []int{1}, func(ctx context.Context, id int) (string, error) {
		<-ctx.Done()
		return "", ctx.Err()
	})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("ожидалась DeadlineExceeded, получено %v", err)
	}
}
