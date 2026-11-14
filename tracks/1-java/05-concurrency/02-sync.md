---
id: j-sync
title: Гонки данных, synchronized и volatile
summary: Почему count++ не атомарен, что такое монитор и что на самом деле гарантирует volatile.
xp: 35
---
## Гонка данных

```java
class Counter {
    int count = 0;
    void inc() { count++; }
}
```

Запустим `inc()` по 100 000 раз из двух потоков. Ожидаем 200 000, получаем, например, 137 482 — и каждый раз разное число. Причина: `count++` — это **три** действия.

```text
Поток A                     Поток B
читает count = 5
                            читает count = 5
прибавляет → 6
                            прибавляет → 6
записывает 6
                            записывает 6      ← одно увеличение потеряно
```

Это **гонка** (race condition): результат зависит от того, как переплелись действия потоков. Такие ошибки — худшие: они не воспроизводятся в отладчике и проявляются под нагрузкой.

## synchronized

`synchronized` гарантирует, что участок кода в каждый момент выполняет только один поток. У каждого объекта есть **монитор** (встроенная блокировка): поток захватывает его при входе в блок и отпускает при выходе — даже если вылетело исключение.

```java
class Counter {
    private int count = 0;

    synchronized void inc() { count++; }       // блокировка на this
    synchronized int get() { return count; }
}
```

Варианты записи:

```java
synchronized void m() { }                      // монитор объекта this
static synchronized void m() { }               // монитор объекта Counter.class
void m() { synchronized (lock) { ... } }       // монитор произвольного объекта
```

Что нужно понимать:

- блокировка привязана к **объекту**, а не к методу: два синхронизированных метода одного объекта не выполнятся одновременно, а у двух разных объектов — выполнятся;
- статический и нестатический `synchronized` используют **разные** мониторы и друг друга не исключают;
- блокировка **реентерабельна**: поток, который уже владеет монитором, может захватить его повторно (синхронизированный метод вызывает другой синхронизированный метод того же объекта);
- синхронизировать нужно **все** обращения к общим данным — и запись, и чтение.

> **Ловушка.** Не синхронизируйтесь на строковых литералах, `Integer` и других объектах из пулов: тот же объект может использовать чужой код. Заведите приватный замок: `private final Object lock = new Object();`.

## Видимость и volatile

Вторая проблема многопоточности — **видимость**. Поток может держать значение переменной в регистре или кеше процессора и не замечать, что другой поток его изменил.

```java
class Worker {
    private boolean running = true;

    void run() {
        while (running) { /* работа */ }       // может никогда не завершиться!
    }

    void stop() { running = false; }           // вызывается из другого потока
}
```

Ключевое слово `volatile` гарантирует, что запись в переменную сразу видна всем потокам:

```java
private volatile boolean running = true;
```

> **Важно.** `volatile` даёт **видимость**, но не **атомарность**. `volatile int count; count++;` по-прежнему теряет обновления: чтение, сложение и запись остаются тремя отдельными действиями.

| | `synchronized` | `volatile` |
|---|---|---|
| Взаимное исключение (атомарность) | да | нет |
| Видимость изменений | да | да |
| Блокирует потоки | да | нет |
| Подходит для | составных операций | флагов, одной записи |

## happens-before

Модель памяти Java описывает, когда один поток **гарантированно** видит результат другого. Такие гарантии называют отношением happens-before. Главные правила:

- освобождение монитора происходит раньше следующего его захвата;
- запись в `volatile`-поле — раньше последующего чтения этого поля;
- `thread.start()` — раньше любого действия в запущенном потоке;
- все действия потока — раньше возврата из `join()` для него.

Если между записью и чтением нет ни одной такой связи, читающий поток может увидеть старое значение.

## Атомарные классы

Для счётчиков и флагов есть классы из `java.util.concurrent.atomic`, которые работают без блокировок — на процессорной операции CAS (compare-and-swap):

```java
AtomicInteger count = new AtomicInteger();
count.incrementAndGet();                 // атомарно
count.compareAndSet(5, 6);               // записать 6, только если сейчас 5
```

@@ quiz
@@ q
Два потока по 10 000 раз вызывают `counter.inc()`. Поле объявлено как `volatile int count`, метод — `void inc() { count++; }`. Что окажется в `count`?
- [ ] Ровно 20 000: `volatile` делает операцию потокобезопасной
- [x] Число от 2 до 20 000: обновления могут теряться
- [ ] Ровно 10 000
- [ ] Программа зависнет
@@ explain
`volatile` гарантирует только видимость. `count++` состоит из чтения, сложения и записи, и два потока могут прочитать одно и то же значение. Нужен `synchronized` или `AtomicInteger`.

@@ q
В классе два метода: `synchronized void a()` и `static synchronized void b()`. Могут ли два потока одновременно выполнять `obj.a()` и `Demo.b()`?
- [x] Да: они захватывают разные мониторы — объекта `obj` и объекта `Demo.class`
- [ ] Нет: оба метода `synchronized`
- [ ] Только на многоядерном процессоре
- [ ] Это ошибка компиляции
@@ explain
Нестатический `synchronized` блокирует `this`, статический — объект класса. Это разные мониторы, поэтому такие методы друг друга не исключают. Если они работают с одними данными — это ошибка.

@@ q
Поток уже находится внутри `synchronized`-метода объекта и вызывает другой `synchronized`-метод того же объекта. Что произойдёт?
- [ ] Deadlock: поток будет ждать сам себя
- [x] Метод выполнится: мониторы в Java реентерабельны
- [ ] `IllegalMonitorStateException`
- [ ] Второй метод выполнится в новом потоке
@@ explain
Поток, владеющий монитором, может захватывать его повторно: ведётся счётчик захватов, и монитор освобождается, когда счётчик вернётся к нулю.

@@ q
Цикл `while (running) { }` в одном потоке не завершается, хотя другой поток записал `running = false`. В чём причина и как исправить?
- [ ] Нужно вызвать `Thread.sleep` в цикле
- [x] Нет гарантии видимости: поле нужно объявить `volatile`
- [ ] Нужно объявить поле `static`
- [ ] Нужно объявить поле `final`
@@ explain
Без `volatile` (или синхронизации) JIT-компилятор вправе считать, что поле не меняется, и вынести проверку из цикла. `volatile` заставляет каждый раз читать актуальное значение.

@@ task safe-counter | Потокобезопасный счётчик | xp=40 interview
Класс `Counter` теряет обновления, когда им пользуются несколько потоков. Сделайте его потокобезопасным — любым способом: `synchronized` или `AtomicInteger`.

- `void inc()` — увеличить на 1;
- `void add(int delta)` — увеличить на `delta`;
- `int get()` — текущее значение.
@@ hint
Самый короткий путь — объявить все три метода `synchronized`. Чтение тоже должно быть синхронизировано.
@@ hint
Вариант без блокировок: `private final AtomicInteger value = new AtomicInteger();` и методы `incrementAndGet()`, `addAndGet(delta)`, `get()`.
@@ starter
class Counter {
    private int value;

    void inc() { value++; }

    void add(int delta) { value += delta; }

    int get() { return value; }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        Counter c = new Counter();
        Thread[] ts = new Thread[4];
        for (int i = 0; i < ts.length; i++) {
            ts[i] = new Thread(() -> { for (int k = 0; k < 100_000; k++) c.inc(); });
            ts[i].start();
        }
        for (Thread t : ts) t.join();
        System.out.println(c.get() + " (ожидается 400000)");
    }
}
@@ solution
import java.util.concurrent.atomic.AtomicInteger;

class Counter {
    private final AtomicInteger value = new AtomicInteger();

    void inc() { value.incrementAndGet(); }

    void add(int delta) { value.addAndGet(delta); }

    int get() { return value.get(); }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        Counter c = new Counter();
        Thread[] ts = new Thread[4];
        for (int i = 0; i < ts.length; i++) {
            ts[i] = new Thread(() -> { for (int k = 0; k < 100_000; k++) c.inc(); });
            ts[i].start();
        }
        for (Thread t : ts) t.join();
        System.out.println(c.get() + " (ожидается 400000)");
    }
}
@@ test
public class Checker {
    static int hammer(int threads, int perThread, boolean useAdd) throws Exception {
        Counter c = new Counter();
        java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
        Thread[] ts = new Thread[threads];
        for (int i = 0; i < threads; i++) {
            ts[i] = new Thread(() -> {
                try { go.await(); } catch (InterruptedException e) { return; }
                for (int k = 0; k < perThread; k++) { if (useAdd) c.add(2); else c.inc(); }
            });
            ts[i].start();
        }
        go.countDown();
        for (Thread t : ts) t.join();
        return c.get();
    }

    public static void main(String[] args) {
        T.test("один поток", () -> { Counter c = new Counter(); c.inc(); c.add(5); T.eq(6, c.get()); });
        T.test("8 потоков по 200 000 inc", () -> { for (int r = 0; r < 3; r++) T.eq(1_600_000, hammer(8, 200_000, false)); });
        T.test("8 потоков по 200 000 add(2)", () -> { for (int r = 0; r < 3; r++) T.eq(3_200_000, hammer(8, 200_000, true)); });
        T.done();
    }
}
