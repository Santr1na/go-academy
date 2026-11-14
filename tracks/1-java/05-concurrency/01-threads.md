---
id: j-threads
title: Потоки
summary: Thread и Runnable, start против run, join, состояния потока и прерывание.
xp: 30
---
## Процесс и поток

**Процесс** — запущенная программа со своей памятью. **Поток** — отдельная последовательность выполнения внутри процесса. Потоки одного процесса делят общую память (кучу), но у каждого свой стек вызовов. Отсюда и сила, и опасность: обмениваться данными легко, испортить их — тоже.

## Создание потока

```java
Thread t = new Thread(() -> System.out.println("Работаю в " + Thread.currentThread().getName()));
t.start();          // создаёт новый поток и выполняет в нём лямбду
t.join();           // текущий поток ждёт завершения t
```

Работу описывают интерфейсом `Runnable` (ничего не возвращает) или `Callable<V>` (возвращает результат и может бросать исключения). Наследовать `Thread` можно, но не принято: задача и исполнитель — разные вещи.

> **Ловушка.** `t.run()` — это обычный вызов метода в **текущем** потоке, никакого нового потока не появится. Новый поток создаёт только `t.start()`. Второй вызов `start()` у того же объекта бросает `IllegalThreadStateException`.

## Порядок выполнения не определён

```java
new Thread(() -> System.out.print("A")).start();
new Thread(() -> System.out.print("B")).start();
System.out.print("C");
```

Возможен любой порядок: `ABC`, `CAB`, `BCA`… Планировщик операционной системы сам решает, какому потоку и когда дать процессор. Любой код, который полагается на «обычно сначала выполняется вот это», содержит ошибку.

## Состояния потока

| Состояние | Что значит |
|---|---|
| `NEW` | создан, `start()` ещё не вызван |
| `RUNNABLE` | выполняется или готов выполняться |
| `BLOCKED` | ждёт захвата монитора (`synchronized`) |
| `WAITING` | ждёт без срока: `join()`, `wait()` |
| `TIMED_WAITING` | ждёт с таймаутом: `sleep(ms)`, `wait(ms)` |
| `TERMINATED` | завершён |

## sleep, join, interrupt

- `Thread.sleep(ms)` — приостановить **текущий** поток. Захваченные блокировки при этом не отпускаются.
- `t.join()` — дождаться завершения потока `t`.
- `t.interrupt()` — **вежливо попросить** поток остановиться. Насильно остановить поток в Java нельзя.

Прерывание работает как флаг. Если поток спит или ждёт, он получит `InterruptedException`; если работает — должен сам проверять `Thread.currentThread().isInterrupted()`.

```java
Thread worker = new Thread(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        doStep();
    }
});
```

> **Ловушка.** Поймав `InterruptedException`, нельзя его просто проглотить: при выбросе исключения флаг прерывания сбрасывается, и код выше по стеку не узнает, что поток просили остановиться. Либо пробросьте исключение дальше, либо восстановите флаг: `Thread.currentThread().interrupt();`.

## Демон-потоки

JVM завершается, когда закончились все **обычные** потоки. Потоки-демоны (`t.setDaemon(true)` до `start()`) её не удерживают — они обрываются вместе с JVM, даже не выполнив `finally`. Подходят для фоновых служебных задач.

## Исключение в потоке

Необработанное исключение завершает только **свой** поток; остальные и `main` продолжают работу. `try/catch` вокруг `t.start()` его не поймает — это другой стек вызовов.

## Виртуальные потоки

С Java 21 есть виртуальные потоки (`Thread.ofVirtual().start(...)`, `Executors.newVirtualThreadPerTaskExecutor()`): их планирует JVM, а не ОС, они очень дешёвые, и их можно создавать миллионами. Предназначены для задач, которые много ждут ввода-вывода (запросы к базе, HTTP-вызовы).

@@ quiz
@@ q
Что напечатает код?
```java
Thread t = new Thread(() -> System.out.print(Thread.currentThread().getName()));
t.setName("worker");
t.run();
```
- [ ] `worker`
- [x] `main`
- [ ] Ничего
- [ ] `IllegalThreadStateException`
@@ explain
`run()` — обычный вызов метода: лямбда выполняется в текущем потоке, то есть в `main`. Чтобы код выполнился в потоке `worker`, нужен `start()`.

@@ q
Что напечатает код?
```java
Thread t = new Thread(() -> System.out.print("A"));
t.start();
System.out.print("B");
```
- [ ] Всегда `AB`
- [ ] Всегда `BA`
- [x] `AB` или `BA` — порядок не определён
- [ ] Только `B`
@@ explain
После `start()` два потока выполняются независимо, и кто первым доберётся до `print`, решает планировщик. Чтобы гарантировать порядок, нужен `t.join()` перед печатью `B`.

@@ q
Что произойдёт?
```java
Thread t = new Thread(() -> { });
t.start();
t.join();
t.start();
```
- [ ] Поток выполнится второй раз
- [ ] Ничего не произойдёт
- [x] `IllegalThreadStateException`
- [ ] Ошибка компиляции
@@ explain
Поток можно запустить только один раз. Завершённый поток перезапустить нельзя — нужно создать новый объект `Thread` или использовать пул потоков.

@@ q
Что делает вызов `thread.interrupt()`?
- [ ] Немедленно останавливает поток
- [ ] Приостанавливает поток до вызова `resume()`
- [x] Выставляет флаг прерывания; спящий или ждущий поток получает `InterruptedException`
- [ ] Удаляет поток из памяти
@@ explain
Прерывание — кооперативный механизм: поток должен сам заметить просьбу и корректно завершиться. Принудительной остановки (`stop()`) в современной Java нет — она оставляла данные в несогласованном состоянии.

@@ task parallel-sum | Параллельная сумма | xp=45
Реализуйте `Main.parallelSum(int[] nums, int threads)`: разбейте массив на `threads` примерно равных частей, посчитайте сумму каждой части в **отдельном потоке** и верните общую сумму как `long`.

Требования: создавайте потоки через `new Thread(...)`, дождитесь всех через `join()`. Каждый поток пишет результат в **свою** ячейку массива `long[] partial` — так общих изменяемых данных нет и синхронизация не нужна. Гарантируется `1 <= threads <= 16`.
@@ hint
Границы части `i`: `from = (int) ((long) nums.length * i / threads)`, `to = (int) ((long) nums.length * (i + 1) / threads)`.
@@ hint
В лямбде можно использовать только effectively final переменные: заведите внутри цикла `final int idx = i;` и пишите в `partial[idx]`. После цикла запуска сделайте второй цикл с `t.join()`, затем сложите `partial`.
@@ starter
public class Main {
    static long parallelSum(int[] nums, int threads) throws InterruptedException {
        return 0;
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println(parallelSum(new int[]{1, 2, 3, 4, 5}, 2));
    }
}
@@ solution
public class Main {
    static long parallelSum(int[] nums, int threads) throws InterruptedException {
        long[] partial = new long[threads];
        Thread[] workers = new Thread[threads];
        for (int i = 0; i < threads; i++) {
            final int idx = i;
            final int from = (int) ((long) nums.length * i / threads);
            final int to = (int) ((long) nums.length * (i + 1) / threads);
            workers[i] = new Thread(() -> {
                long s = 0;
                for (int j = from; j < to; j++) s += nums[j];
                partial[idx] = s;
            });
            workers[i].start();
        }
        long total = 0;
        for (int i = 0; i < threads; i++) {
            workers[i].join();
            total += partial[i];
        }
        return total;
    }

    public static void main(String[] args) throws InterruptedException {
        System.out.println(parallelSum(new int[]{1, 2, 3, 4, 5}, 2));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("маленький массив", () -> T.eq(15L, Main.parallelSum(new int[]{1, 2, 3, 4, 5}, 2)));
        T.test("один поток", () -> T.eq(6L, Main.parallelSum(new int[]{1, 2, 3}, 1)));
        T.test("потоков больше, чем элементов", () -> T.eq(3L, Main.parallelSum(new int[]{1, 2}, 8)));
        T.test("пустой массив", () -> T.eq(0L, Main.parallelSum(new int[]{}, 4)));
        T.test("сумма не помещается в int", () -> {
            int[] big = new int[1_000_000];
            java.util.Arrays.fill(big, 1_000_000);
            T.eq(1_000_000_000_000L, Main.parallelSum(big, 7));
        });
        T.test("работа идёт не в вызывающем потоке", () -> {
            Thread me = Thread.currentThread();
            long[] before = { java.lang.management.ManagementFactory.getThreadMXBean().getTotalStartedThreadCount() };
            Main.parallelSum(new int[1000], 4);
            long started = java.lang.management.ManagementFactory.getThreadMXBean().getTotalStartedThreadCount() - before[0];
            T.check(started >= 4, "ожидался запуск 4 потоков, запущено " + started);
        });
        T.done();
    }
}
