---
id: rate-limiter
title: "Паттерны: rate limiter, тикеры и backoff"
summary: time.Ticker, ограничение частоты, token bucket, экспоненциальная задержка с джиттером, тестируемое время
xp: 40
---
## Таймеры и тикеры

```go
timer := time.NewTimer(2 * time.Second)
<-timer.C            // сработает один раз
timer.Stop()         // отменить, если ещё не сработал
timer.Reset(time.Second)

ticker := time.NewTicker(500 * time.Millisecond)
defer ticker.Stop()  // обязательно останавливайте тикер
for t := range ticker.C {
	fmt.Println("тик", t)
}

time.AfterFunc(time.Second, func() { fmt.Println("через секунду") })
```

## Простейший rate limiter на тикере

Не больше одного запроса каждые 100 мс:

```go
limiter := time.NewTicker(100 * time.Millisecond)
defer limiter.Stop()
for _, req := range requests {
	<-limiter.C   // ждём следующий «тик»
	handle(req)
}
```

Недостаток — нет «всплесков»: даже после долгого простоя запросы идут строго по одному.

## Token bucket

Самый популярный алгоритм ограничения частоты:

- в «ведре» помещается максимум `capacity` токенов;
- токены добавляются со скоростью `rate` в секунду;
- каждый запрос забирает токен; нет токенов — запрос отклоняется (или ждёт).

Так разрешаются короткие всплески до `capacity`, а средняя скорость ограничена `rate`.

```go
type Bucket struct {
	mu       sync.Mutex
	capacity float64
	tokens   float64
	rate     float64   // токенов в секунду
	last     time.Time
	now      func() time.Time // источник времени — для тестов
}

func (b *Bucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	elapsed := now.Sub(b.last).Seconds()
	b.tokens = min(b.capacity, b.tokens+elapsed*b.rate) // «досыпаем» токены за прошедшее время
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}
```

Токены не нужно добавлять по таймеру — достаточно пересчитывать их «лениво» при каждом вызове. В продакшене используют `golang.org/x/time/rate` (`rate.NewLimiter(r, burst)`, методы `Allow`, `Wait(ctx)`).

## Тестируемое время

Код, зависящий от `time.Now()`, трудно тестировать. Внедряйте источник времени как зависимость: функцию `now func() time.Time` или интерфейс `Clock`. В тесте подставляйте фальшивые часы и «двигайте» время вручную — тесты становятся мгновенными и детерминированными. С Go 1.24 для этого есть ещё пакет `testing/synctest` с «пузырём» виртуального времени.

## Экспоненциальный backoff

При повторах после ошибки задержку увеличивают экспоненциально: 100мс, 200мс, 400мс, … — до верхнего предела. Добавляют **джиттер** (случайный разброс), чтобы тысячи клиентов не повторяли запрос синхронно и не создавали «эффект толпы»:

```go
func backoff(attempt int, base, maxDelay time.Duration) time.Duration {
	d := base << attempt          // base * 2^attempt
	if d > maxDelay || d <= 0 {   // d <= 0 — защита от переполнения сдвига
		d = maxDelay
	}
	return d/2 + rand.N(d/2)      // «equal jitter»
}
```

@@ quiz
@@ q
Что нужно сделать с `time.Ticker`, когда он больше не нужен?
- [ ] Ничего, GC сам остановит
- [x] Вызвать `ticker.Stop()`
- [ ] Закрыть `ticker.C`
@@ explain
Хорошая практика — всегда вызывать `Stop()` (обычно через `defer`). Закрывать канал `C` вручную нельзя — он принадлежит runtime.

@@ q
Bucket: capacity = 5, rate = 1 токен/с, ведро полное. Клиент мгновенно отправляет 8 запросов. Сколько будет разрешено?
- [ ] 1
- [x] 5
- [ ] 8
@@ explain
Ведро позволяет всплеск размером `capacity`. Остальные 3 запроса будут отклонены, пока не накопятся новые токены.

@@ q
Зачем добавлять джиттер к экспоненциальному backoff?
- [ ] Чтобы задержка была короче
- [x] Чтобы клиенты не повторяли запросы одновременно и не перегружали сервер волнами
- [ ] Это требование TCP
@@ explain
Без случайности клиенты, получившие ошибку одновременно, будут ретраить синхронно. Джиттер «размазывает» нагрузку.

@@ task token-bucket | Token bucket | xp=70 interview
Реализуйте rate limiter по алгоритму token bucket с внедряемым источником времени:

```go
func NewBucket(capacity int, ratePerSec float64, now func() time.Time) *Bucket
func (b *Bucket) Allow() bool
```

- изначально ведро **полное**;
- токены пополняются непрерывно со скоростью `ratePerSec` (дробные доли накапливаются), но не больше `capacity`;
- `Allow` забирает 1 токен и возвращает `true`, либо возвращает `false`, если токенов меньше 1;
- метод должен быть безопасен для конкурентного использования (мьютекс).

Тест использует фальшивые часы — никаких `time.Sleep` не нужно.
@@ hint
Храните `tokens float64` и `last time.Time`. В `Allow`: `elapsed := now.Sub(b.last).Seconds(); b.tokens = min(cap, b.tokens + elapsed*rate); b.last = now`.
@@ hint
Не используйте `time.Now()` напрямую — только переданную функцию `now`.
@@ starter
package main

import (
	"fmt"
	"time"
)

type Bucket struct {
}

func NewBucket(capacity int, ratePerSec float64, now func() time.Time) *Bucket {
	return &Bucket{}
}

func (b *Bucket) Allow() bool {
	return true
}

func main() {
	b := NewBucket(2, 1, time.Now)
	fmt.Println(b.Allow(), b.Allow(), b.Allow())
}
@@ solution
package main

import (
	"fmt"
	"sync"
	"time"
)

type Bucket struct {
	mu       sync.Mutex
	capacity float64
	tokens   float64
	rate     float64
	last     time.Time
	now      func() time.Time
}

func NewBucket(capacity int, ratePerSec float64, now func() time.Time) *Bucket {
	return &Bucket{
		capacity: float64(capacity),
		tokens:   float64(capacity),
		rate:     ratePerSec,
		last:     now(),
		now:      now,
	}
}

func (b *Bucket) Allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	if elapsed := now.Sub(b.last).Seconds(); elapsed > 0 {
		b.tokens = min(b.capacity, b.tokens+elapsed*b.rate)
	}
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

func main() {
	b := NewBucket(2, 1, time.Now)
	fmt.Println(b.Allow(), b.Allow(), b.Allow())
}
@@ test
package main

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func count(b *Bucket, n int) int {
	ok := 0
	for i := 0; i < n; i++ {
		if b.Allow() {
			ok++
		}
	}
	return ok
}

func TestBucketBurstAndRefill(t *testing.T) {
	clk := &fakeClock{t: time.Unix(1000, 0)}
	b := NewBucket(5, 2, clk.Now)
	if n := count(b, 8); n != 5 {
		t.Fatalf("всплеск: разрешено %d из 8, ожидалось 5", n)
	}
	clk.Advance(500 * time.Millisecond) // +1 токен
	if n := count(b, 3); n != 1 {
		t.Fatalf("через 0.5с при rate=2: разрешено %d, ожидалось 1", n)
	}
	clk.Advance(250 * time.Millisecond) // +0.5
	if b.Allow() {
		t.Fatal("половины токена недостаточно")
	}
	clk.Advance(250 * time.Millisecond) // ещё +0.5 = 1
	if !b.Allow() {
		t.Fatal("дробные доли должны накапливаться")
	}
	clk.Advance(time.Hour)
	if n := count(b, 10); n != 5 {
		t.Fatalf("после простоя ведро не должно переполняться: разрешено %d, ожидалось 5", n)
	}
}

func TestBucketConcurrent(t *testing.T) {
	clk := &fakeClock{t: time.Unix(0, 0)}
	b := NewBucket(100, 1, clk.Now)
	var allowed atomic.Int32
	var wg sync.WaitGroup
	for g := 0; g < 20; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 50; i++ {
				if b.Allow() {
					allowed.Add(1)
				}
			}
		}()
	}
	wg.Wait()
	if allowed.Load() != 100 {
		t.Errorf("конкурентно разрешено %d, ожидалось ровно 100", allowed.Load())
	}
}

@@ task backoff | Экспоненциальный backoff | xp=50
Реализуйте `Backoff(attempt int, base, maxDelay time.Duration) time.Duration` **без джиттера** (детерминированно):

- задержка = `base * 2^attempt` (attempt начинается с 0);
- не больше `maxDelay`;
- защититесь от переполнения при больших `attempt` (например, 100) — результат должен быть `maxDelay`, а не отрицательное число или 0;
- для `attempt < 0` верните `base`.

И `Delays(n int, base, maxDelay time.Duration) []time.Duration` — задержки для попыток 0…n-1.
@@ hint
Сдвиг `base << attempt` при attempt ≥ 63 переполнится. Проще в цикле удваивать `d`, пока `d < maxDelay` и не сделано `attempt` шагов.
@@ hint
`d := base; for i := 0; i < attempt && d < maxDelay; i++ { d *= 2 }; return min(d, maxDelay)`.
@@ starter
package main

import (
	"fmt"
	"time"
)

func Backoff(attempt int, base, maxDelay time.Duration) time.Duration {
	return base << attempt
}

func Delays(n int, base, maxDelay time.Duration) []time.Duration {
	return nil
}

func main() {
	fmt.Println(Delays(6, 100*time.Millisecond, 2*time.Second))
}
@@ solution
package main

import (
	"fmt"
	"time"
)

func Backoff(attempt int, base, maxDelay time.Duration) time.Duration {
	if attempt < 0 {
		return base
	}
	d := base
	for i := 0; i < attempt && d < maxDelay; i++ {
		d *= 2
	}
	return min(d, maxDelay)
}

func Delays(n int, base, maxDelay time.Duration) []time.Duration {
	res := make([]time.Duration, 0, n)
	for i := 0; i < n; i++ {
		res = append(res, Backoff(i, base, maxDelay))
	}
	return res
}

func main() {
	fmt.Println(Delays(6, 100*time.Millisecond, 2*time.Second))
}
@@ test
package main

import (
	"fmt"
	"testing"
	"time"
)

func TestBackoff(t *testing.T) {
	base, mx := 100*time.Millisecond, 2*time.Second
	want := map[int]time.Duration{-1: base, 0: base, 1: 200 * time.Millisecond, 3: 800 * time.Millisecond, 4: 1600 * time.Millisecond, 5: mx, 63: mx, 100: mx, 1000: mx}
	for a, w := range want {
		if got := Backoff(a, base, mx); got != w {
			t.Errorf("Backoff(%d) = %v, ожидалось %v", a, got, w)
		}
	}
	got := fmt.Sprint(Delays(6, base, mx))
	if got != "[100ms 200ms 400ms 800ms 1.6s 2s]" {
		t.Errorf("Delays(6) = %s", got)
	}
	if len(Delays(0, base, mx)) != 0 {
		t.Error("Delays(0) должен быть пустым")
	}
}
