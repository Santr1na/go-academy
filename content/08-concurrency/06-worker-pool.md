---
id: worker-pool
title: "Паттерны: worker pool и семафор"
summary: ограничение параллелизма, пул воркеров, сохранение порядка результатов, семафор на канале, errgroup
xp: 40
---
## Зачем ограничивать параллелизм

Запустить горутину на каждую задачу легко, но при 100 000 задач вы получите 100 000 одновременных HTTP-запросов или открытых файлов. Внешние ресурсы ограничены — нужен контроль.

## Worker pool

Фиксированное число воркеров читает задачи из общего канала:

```go
func workerPool(jobs []Job, workers int) []Result {
	jobCh := make(chan Job)
	resCh := make(chan Result)

	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range jobCh {   // воркер берёт задачи, пока канал открыт
				resCh <- process(j)
			}
		}()
	}

	go func() {                      // отправитель задач
		for _, j := range jobs {
			jobCh <- j
		}
		close(jobCh)                 // воркеры завершат range
	}()

	go func() {                      // закрыть результаты, когда все воркеры закончили
		wg.Wait()
		close(resCh)
	}()

	var results []Result
	for r := range resCh {
		results = append(results, r)
	}
	return results
}
```

Ключевые моменты:

1. задачи отправляются из **отдельной** горутины — иначе возможен deadlock, когда воркеры ждут отправки результата, а main ещё отправляет задачи;
2. `jobCh` закрывает отправитель задач;
3. `resCh` закрывается после `wg.Wait()` — когда все воркеры вышли.

### Сохранение порядка

Результаты приходят в произвольном порядке. Чтобы восстановить порядок, передавайте индекс задачи вместе с данными и пишите результат в `results[idx]` заранее выделенного среза.

## Семафор на буферизованном канале

Более простой способ ограничить параллелизм — горутина на задачу, но не более N активных одновременно:

```go
sem := make(chan struct{}, limit)
var wg sync.WaitGroup
for _, url := range urls {
	wg.Add(1)
	go func() {
		defer wg.Done()
		sem <- struct{}{}        // занять слот (блокируется, если заняты все)
		defer func() { <-sem }() // освободить
		fetch(url)
	}()
}
wg.Wait()
```

Есть и готовый взвешенный семафор: `golang.org/x/sync/semaphore`.

## errgroup

Пакет `golang.org/x/sync/errgroup` объединяет WaitGroup, сбор первой ошибки, отмену контекста и ограничение параллелизма:

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(10)
for _, url := range urls {
	g.Go(func() error {
		return fetch(ctx, url)
	})
}
if err := g.Wait(); err != nil { // первая ошибка; ctx отменён для остальных
	return err
}
```

> **На собеседовании** worker pool просят написать «с нуля» почти всегда. Проговорите: кто закрывает каналы, как избежать deadlock, как дождаться завершения, как сохранить порядок, как обрабатывать ошибки и отмену.

@@ quiz
@@ q
Кто должен закрывать канал задач в worker pool?
- [ ] Каждый воркер после обработки задачи
- [x] Горутина, которая отправляет задачи, — после отправки последней
- [ ] Никто, каналы закрываются автоматически
@@ explain
Закрывает отправитель. Воркеры читают через `range` и завершатся, когда канал закроется и опустеет.

@@ q
Как в семафоре на канале `sem := make(chan struct{}, 3)` занять слот?
- [x] `sem <- struct{}{}`
- [ ] `<-sem`
- [ ] `close(sem)`
@@ explain
Отправка в буферизованный канал блокируется, когда буфер (3 слота) заполнен. Освобождение слота — чтение `<-sem`.

@@ q
Почему `close(results)` в примере выполняется в отдельной горутине после `wg.Wait()`?
- [ ] Так быстрее
- [x] Главная горутина в это время читает результаты; если ждать `wg.Wait()` в ней до чтения, воркеры заблокируются на отправке — deadlock
- [ ] `close` нельзя вызывать в main
@@ explain
Воркеры не завершатся, пока кто-то не прочитает их результаты из небуферизованного канала. Поэтому ожидание и закрытие выносят в отдельную горутину.

@@ task worker-pool | Worker pool с сохранением порядка | xp=70 interview
Реализуйте `WorkerPool(jobs []int, workers int, f func(int) int) []int`:

- запускает ровно `workers` горутин-воркеров (если `workers <= 0` — 1);
- воркеры получают задачи через канал;
- результат `f(jobs[i])` должен оказаться в `res[i]` — порядок сохраняется;
- одновременно выполняется **не больше** `workers` вызовов `f` (тест проверит это и то, что параллелизм действительно есть).
@@ hint
Передавайте в канал индекс задачи: `idx := make(chan int)`; воркер делает `for i := range idx { res[i] = f(jobs[i]) }`.
@@ hint
Каждый воркер пишет в свой `res[i]` — гонки нет. Отправьте все индексы, закройте канал и дождитесь воркеров через WaitGroup.
@@ starter
package main

import "fmt"

func WorkerPool(jobs []int, workers int, f func(int) int) []int {
	res := make([]int, len(jobs))
	return res
}

func main() {
	fmt.Println(WorkerPool([]int{1, 2, 3, 4, 5}, 2, func(x int) int { return x * x }))
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

func WorkerPool(jobs []int, workers int, f func(int) int) []int {
	if workers <= 0 {
		workers = 1
	}
	res := make([]int, len(jobs))
	idx := make(chan int)
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range idx {
				res[i] = f(jobs[i])
			}
		}()
	}
	for i := range jobs {
		idx <- i
	}
	close(idx)
	wg.Wait()
	return res
}

func main() {
	fmt.Println(WorkerPool([]int{1, 2, 3, 4, 5}, 2, func(x int) int { return x * x }))
}
@@ test
package main

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

func TestWorkerPoolOrder(t *testing.T) {
	jobs := make([]int, 100)
	for i := range jobs {
		jobs[i] = i
	}
	got := WorkerPool(jobs, 7, func(x int) int { return x * 2 })
	for i, v := range got {
		if v != i*2 {
			t.Fatalf("res[%d] = %d, ожидалось %d", i, v, i*2)
		}
	}
	if fmt.Sprint(WorkerPool([]int{3}, 0, func(x int) int { return -x })) != "[-3]" {
		t.Error("workers <= 0 должен работать как 1 воркер")
	}
}

func TestWorkerPoolLimit(t *testing.T) {
	var cur, peak atomic.Int32
	f := func(x int) int {
		n := cur.Add(1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
		cur.Add(-1)
		return x
	}
	jobs := make([]int, 24)
	start := time.Now()
	WorkerPool(jobs, 4, f)
	if p := peak.Load(); p > 4 {
		t.Errorf("одновременно выполнялось %d вызовов, лимит 4", p)
	}
	if p := peak.Load(); p < 2 {
		t.Errorf("пик параллелизма %d — задачи выполняются последовательно", p)
	}
	if el := time.Since(start); el > 2*time.Second {
		t.Errorf("слишком медленно: %v (ожидалось ~120мс)", el)
	}
}

@@ task semaphore | Ограничитель параллельных загрузок | xp=60
Реализуйте `FetchAll(urls []string, limit int, fetch func(string) string) map[string]string`:

- для каждого URL запускает **отдельную горутину**;
- с помощью **семафора на буферизованном канале** гарантирует, что одновременно выполняется не более `limit` вызовов `fetch`;
- возвращает map «url → результат». Запись в map защитите мьютексом.
@@ hint
`sem := make(chan struct{}, limit)`; в горутине: `sem <- struct{}{}; defer func() { <-sem }()`.
@@ hint
`mu.Lock(); res[u] = body; mu.Unlock()` — map не потокобезопасна.
@@ starter
package main

import "fmt"

func FetchAll(urls []string, limit int, fetch func(string) string) map[string]string {
	res := map[string]string{}
	for _, u := range urls {
		res[u] = fetch(u)
	}
	return res
}

func main() {
	fmt.Println(FetchAll([]string{"a", "b"}, 1, func(u string) string { return "body of " + u }))
}
@@ solution
package main

import (
	"fmt"
	"sync"
)

func FetchAll(urls []string, limit int, fetch func(string) string) map[string]string {
	if limit <= 0 {
		limit = 1
	}
	res := make(map[string]string, len(urls))
	sem := make(chan struct{}, limit)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, u := range urls {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			body := fetch(u)
			mu.Lock()
			res[u] = body
			mu.Unlock()
		}()
	}
	wg.Wait()
	return res
}

func main() {
	fmt.Println(FetchAll([]string{"a", "b"}, 1, func(u string) string { return "body of " + u }))
}
@@ test
package main

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

func TestFetchAll(t *testing.T) {
	var cur, peak atomic.Int32
	fetch := func(u string) string {
		n := cur.Add(1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(15 * time.Millisecond)
		cur.Add(-1)
		return "body:" + u
	}
	urls := make([]string, 30)
	for i := range urls {
		urls[i] = fmt.Sprint("https://example.com/", i)
	}
	start := time.Now()
	res := FetchAll(urls, 5, fetch)
	if len(res) != 30 || res[urls[7]] != "body:"+urls[7] {
		t.Fatalf("неверный результат: %d записей", len(res))
	}
	if p := peak.Load(); p > 5 || p < 2 {
		t.Errorf("пиковый параллелизм %d, ожидалось от 2 до 5", p)
	}
	if el := time.Since(start); el > 2*time.Second {
		t.Errorf("слишком медленно: %v", el)
	}
}
