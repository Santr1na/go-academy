---
id: j-executors
title: Пулы потоков, Future и CompletableFuture
summary: Почему потоки не создают вручную и как получать результат асинхронной задачи.
xp: 35
---
## Зачем нужен пул потоков

Создание потока — дорогая операция: у каждого свой стек (около мегабайта) и структуры ядра ОС. Если создавать поток на каждый запрос, под нагрузкой сервер исчерпает память. **Пул** держит ограниченное число потоков и переиспользует их: задачи ставятся в очередь, свободный поток берёт следующую.

```java
ExecutorService pool = Executors.newFixedThreadPool(4);

pool.execute(() -> System.out.println("без результата"));        // Runnable
Future<Integer> future = pool.submit(() -> 2 + 2);                // Callable — с результатом

Integer result = future.get();    // блокирует текущий поток, пока задача не выполнится

pool.shutdown();                  // новых задач не принимать, начатые доделать
pool.awaitTermination(10, TimeUnit.SECONDS);
```

> **Ловушка.** Потоки пула — не демоны. Если забыть `shutdown()`, программа не завершится, хотя `main` закончился. С Java 19 `ExecutorService` можно использовать в try-with-resources.

## Виды пулов

| Фабрика | Что создаёт | Подводный камень |
|---|---|---|
| `newFixedThreadPool(n)` | n потоков, неограниченная очередь | очередь может расти, пока не кончится память |
| `newCachedThreadPool()` | потоков столько, сколько задач | может создать тысячи потоков |
| `newSingleThreadExecutor()` | один поток, задачи строго по очереди | |
| `newScheduledThreadPool(n)` | выполнение по расписанию | |
| `newVirtualThreadPerTaskExecutor()` | виртуальный поток на задачу (Java 21) | |

В рабочем коде пул часто создают явно через `ThreadPoolExecutor`, чтобы задать **ограниченную очередь** и политику отказа. Порядок его работы: пока потоков меньше `corePoolSize` — создаётся новый поток; иначе задача идёт в очередь; если очередь полна — создаются потоки до `maximumPoolSize`; если и это исчерпано — срабатывает политика отказа (по умолчанию `RejectedExecutionException`).

## Future

`Future<V>` — «квитанция» на результат: `get()` ждёт, `get(1, TimeUnit.SECONDS)` ждёт с таймаутом, `isDone()` проверяет готовность, `cancel(true)` пытается прервать.

Если задача бросила исключение, `get()` бросит `ExecutionException`, а настоящая причина лежит в `getCause()`.

```java
List<Callable<Integer>> tasks = List.of(() -> 1, () -> 2, () -> 3);
List<Future<Integer>> results = pool.invokeAll(tasks);   // запустить все и дождаться
```

Недостаток `Future`: результат можно только ждать, блокируя поток. Нельзя сказать «когда будет готово — сделай вот это».

## CompletableFuture

`CompletableFuture` позволяет строить цепочки без блокировок:

```java
CompletableFuture<String> greeting = CompletableFuture
        .supplyAsync(() -> loadUser(42))                 // выполнить в другом потоке
        .thenApply(user -> "Привет, " + user.name())     // преобразовать результат
        .exceptionally(ex -> "Привет, гость");           // запасной вариант при ошибке

String text = greeting.join();                           // дождаться результата
```

| Метод | Что делает |
|---|---|
| `supplyAsync(supplier)` / `runAsync(runnable)` | запустить задачу |
| `thenApply(fn)` | преобразовать результат (как `map`) |
| `thenCompose(fn)` | продолжить другой асинхронной задачей (как `flatMap`) |
| `thenCombine(other, fn)` | объединить результаты двух независимых задач |
| `thenAccept(consumer)` | использовать результат, ничего не возвращая |
| `exceptionally(fn)`, `handle(fn)` | обработать ошибку |
| `allOf(...)`, `anyOf(...)` | дождаться всех / любой |

`join()` отличается от `get()` тем, что бросает непроверяемое `CompletionException`.

> **Ловушка.** `supplyAsync` без второго аргумента использует общий `ForkJoinPool.commonPool()` с числом потоков порядка количества ядер. Блокирующие операции (запросы к базе, HTTP) в нём легко занимают все потоки и останавливают всё приложение, включая параллельные стримы. Для ввода-вывода передавайте свой пул: `supplyAsync(task, ioPool)`.

## Сколько потоков нужно

- **Вычислительные задачи** (CPU-bound): примерно по числу ядер — `Runtime.getRuntime().availableProcessors()`. Больше потоков только добавят переключений.
- **Задачи с ожиданием** (IO-bound): заметно больше ядер, потому что большую часть времени потоки ждут ответа; либо виртуальные потоки.

@@ quiz
@@ q
Что произойдёт после выполнения `main`?
```java
public static void main(String[] args) {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    pool.submit(() -> System.out.println("готово"));
}
```
- [ ] Программа напечатает `готово` и завершится
- [x] Программа напечатает `готово` и не завершится
- [ ] Ничего не напечатается
- [ ] `RejectedExecutionException`
@@ explain
Потоки пула — обычные, не демоны, и продолжают ждать новые задачи. JVM не завершится, пока не вызван `shutdown()`.

@@ q
Задача, отправленная через `submit`, бросила `IllegalStateException`. Что произойдёт при вызове `future.get()`?
- [ ] Вернётся `null`
- [ ] Будет брошено `IllegalStateException`
- [x] Будет брошено `ExecutionException`, исходное исключение — в `getCause()`
- [ ] Поток зависнет навсегда
@@ explain
Исключение задачи сохраняется в `Future` и заворачивается в `ExecutionException` при получении результата. Если `get()` не вызвать, об ошибке можно вообще не узнать.

@@ q
Чем `thenApply` отличается от `thenCompose`?
- [ ] `thenCompose` выполняется синхронно
- [x] `thenApply` принимает функцию, возвращающую значение; `thenCompose` — функцию, возвращающую другой `CompletableFuture`, и «разворачивает» его
- [ ] `thenApply` нельзя вызывать несколько раз
- [ ] Ничем
@@ explain
Аналогия со стримами: `thenApply` — это `map`, `thenCompose` — `flatMap`. С `thenApply` и асинхронной функцией получится вложенный `CompletableFuture<CompletableFuture<T>>`.

@@ q
Сколько потоков разумно выделить пулу для чисто вычислительных задач на 8-ядерной машине?
- [ ] 1
- [x] Около 8
- [ ] 100
- [ ] Чем больше, тем лучше
@@ explain
Вычислительная задача занимает ядро целиком. Потоков больше, чем ядер, не ускорят работу, а только добавят переключений контекста. Много потоков оправдано, когда задачи в основном ждут ввода-вывода.

@@ task fetch-all | Параллельная загрузка | xp=45 interview
Реализуйте `Main.fetchAll(List<String> urls, Function<String, String> loader, int threads)`: вызовите `loader` для каждого адреса **параллельно** в пуле из `threads` потоков и верните список результатов **в том же порядке**, что и адреса.

- Если `loader` для какого-то адреса бросил исключение, в списке на этом месте должна быть строка `"ERROR"`.
- Пул обязательно нужно завершить (`shutdown`) — и при успехе, и при ошибке.
@@ hint
Отправьте все задачи через `pool.submit(() -> loader.apply(url))`, сложите `Future` в список в порядке адресов, затем пройдите по списку и вызывайте `get()`.
@@ hint
`get()` бросает `ExecutionException`, если задача упала, — поймайте его и добавьте `"ERROR"`. Вызов `pool.shutdown()` поместите в `finally`.
@@ starter
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

public class Main {
    static List<String> fetchAll(List<String> urls, Function<String, String> loader, int threads) throws InterruptedException {
        List<String> out = new ArrayList<>();
        for (String u : urls) out.add(loader.apply(u));   // последовательно и без обработки ошибок
        return out;
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println(fetchAll(List.of("a", "b"), u -> "page:" + u, 2));
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Function;

public class Main {
    static List<String> fetchAll(List<String> urls, Function<String, String> loader, int threads) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        try {
            List<Future<String>> futures = new ArrayList<>();
            for (String u : urls) futures.add(pool.submit(() -> loader.apply(u)));
            List<String> out = new ArrayList<>();
            for (Future<String> f : futures) {
                try {
                    out.add(f.get());
                } catch (ExecutionException e) {
                    out.add("ERROR");
                }
            }
            return out;
        } finally {
            pool.shutdown();
        }
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println(fetchAll(List.of("a", "b"), u -> "page:" + u, 2));
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

public class Checker {
    public static void main(String[] args) {
        T.test("порядок результатов", () -> {
            List<String> urls = new ArrayList<>();
            for (int i = 0; i < 20; i++) urls.add("u" + i);
            Function<String, String> loader = u -> { try { Thread.sleep((u.hashCode() & 15)); } catch (InterruptedException e) { } return "page:" + u; };
            List<String> r = Main.fetchAll(urls, loader, 4);
            for (int i = 0; i < 20; i++) T.eq("page:u" + i, r.get(i));
        });
        T.test("ошибка загрузчика даёт ERROR", () -> {
            Function<String, String> loader = u -> { if (u.equals("bad")) throw new IllegalStateException("нет сети"); return u.toUpperCase(); };
            T.eq(List.of("A", "ERROR", "C"), Main.fetchAll(List.of("a", "bad", "c"), loader, 2));
        });
        T.test("загрузка идёт параллельно", () -> {
            Function<String, String> slow = u -> { try { Thread.sleep(300); } catch (InterruptedException e) { } return u; };
            long start = System.nanoTime();
            Main.fetchAll(List.of("1", "2", "3", "4"), slow, 4);
            long ms = (System.nanoTime() - start) / 1_000_000;
            T.check(ms < 900, "4 загрузки по 300 мс заняли " + ms + " мс — похоже, они выполняются по очереди");
        });
        T.test("пул завершён", () -> {
            Main.fetchAll(List.of("a"), u -> u, 3);
            Thread.sleep(150);
            Thread[] ts = new Thread[64];
            int n = Thread.enumerate(ts);
            for (int i = 0; i < n; i++) T.check(!ts[i].getName().startsWith("pool-") || !ts[i].isAlive() || ts[i].getState() == Thread.State.TERMINATED, "поток " + ts[i].getName() + " всё ещё жив — забыт shutdown()");
        });
        T.test("пустой список", () -> T.eq(List.of(), Main.fetchAll(List.of(), u -> u, 2)));
        T.done();
    }
}

@@ task combine | Цепочка CompletableFuture | xp=40
Реализуйте `Main.priceWithTax(Supplier<Integer> price, Supplier<Integer> taxPercent)`: метод возвращает `CompletableFuture<Integer>`.

- Цену и ставку налога нужно получить **двумя независимыми** асинхронными задачами (`supplyAsync`) и объединить результаты: `price + price * taxPercent / 100`.
- Если любая из задач завершилась с исключением, итоговое значение должно быть `-1` (а не исключение).
@@ hint
`CompletableFuture.supplyAsync(price).thenCombine(CompletableFuture.supplyAsync(taxPercent), (p, t) -> p + p * t / 100)`.
@@ hint
Добавьте в конец цепочки `.exceptionally(ex -> -1)`.
@@ starter
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

public class Main {
    static CompletableFuture<Integer> priceWithTax(Supplier<Integer> price, Supplier<Integer> taxPercent) {
        return CompletableFuture.completedFuture(0);
    }

    public static void main(String[] args) {
        System.out.println(priceWithTax(() -> 1000, () -> 20).join());
    }
}
@@ solution
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

public class Main {
    static CompletableFuture<Integer> priceWithTax(Supplier<Integer> price, Supplier<Integer> taxPercent) {
        return CompletableFuture.supplyAsync(price)
                .thenCombine(CompletableFuture.supplyAsync(taxPercent), (p, t) -> p + p * t / 100)
                .exceptionally(ex -> -1);
    }

    public static void main(String[] args) {
        System.out.println(priceWithTax(() -> 1000, () -> 20).join());
    }
}
@@ test
import java.util.function.Supplier;

public class Checker {
    static Supplier<Integer> slow(int v) { return () -> { try { Thread.sleep(300); } catch (InterruptedException e) { } return v; }; }

    public static void main(String[] args) {
        T.test("цена с налогом", () -> { T.eq(1200, Main.priceWithTax(() -> 1000, () -> 20).join()); T.eq(500, Main.priceWithTax(() -> 500, () -> 0).join()); });
        T.test("ошибка в получении цены", () -> T.eq(-1, Main.priceWithTax(() -> { throw new IllegalStateException("x"); }, () -> 20).join()));
        T.test("ошибка в получении налога", () -> T.eq(-1, Main.priceWithTax(() -> 100, () -> { throw new IllegalStateException("x"); }).join()));
        T.test("задачи выполняются параллельно", () -> {
            long start = System.nanoTime();
            T.eq(110, Main.priceWithTax(slow(100), slow(10)).join());
            long ms = (System.nanoTime() - start) / 1_000_000;
            T.check(ms < 550, "две задачи по 300 мс заняли " + ms + " мс — они должны выполняться одновременно");
        });
        T.test("метод не блокируется", () -> {
            long start = System.nanoTime();
            var f = Main.priceWithTax(slow(1), slow(1));
            long ms = (System.nanoTime() - start) / 1_000_000;
            T.check(ms < 200, "метод должен сразу вернуть CompletableFuture, а не ждать результата");
            f.join();
        });
        T.done();
    }
}
