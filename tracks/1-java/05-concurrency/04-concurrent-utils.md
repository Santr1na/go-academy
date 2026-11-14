---
id: j-concurrent-utils
title: Потокобезопасные коллекции, атомики и блокировки
summary: ConcurrentHashMap, CopyOnWriteArrayList, BlockingQueue, ReentrantLock и синхронизаторы.
xp: 35
---
## Почему обычные коллекции не годятся

`ArrayList`, `HashMap`, `HashSet` не рассчитаны на одновременную запись. Два потока, делающих `map.put`, могут потерять записи или получить мапу в испорченном состоянии; `list.add` из двух потоков теряет элементы или бросает `ArrayIndexOutOfBoundsException`.

Обёртки `Collections.synchronizedList/Map` делают каждый метод синхронизированным на одном замке. Это корректно, но медленно — и не спасает составные операции: обход всё равно нужно вручную оборачивать в `synchronized`.

## ConcurrentHashMap

Блокирует не всю таблицу, а отдельную корзину; чтение не блокируется вовсе. Поэтому с ней одновременно работают много потоков.

> **Ловушка.** Потокобезопасность отдельных методов не делает потокобезопасной их **последовательность**.

```java
// ГОНКА: между get и put другой поток успеет изменить значение
Integer old = map.get(key);
map.put(key, old == null ? 1 : old + 1);

// ПРАВИЛЬНО: одна атомарная операция
map.merge(key, 1, Integer::sum);
map.computeIfAbsent(key, k -> loadExpensive(k));
map.putIfAbsent(key, value);
```

`ConcurrentHashMap` не допускает `null` ни в ключах, ни в значениях: иначе нельзя было бы отличить «ключа нет» от «значение равно null» без дополнительной блокировки.

## Другие коллекции

| Коллекция | Как устроена | Когда использовать |
|---|---|---|
| `CopyOnWriteArrayList` | при каждой записи копирует весь массив; чтение без блокировок | читают часто, пишут редко (списки слушателей) |
| `ConcurrentLinkedQueue` | неблокирующая очередь на CAS | простая очередь между потоками |
| `BlockingQueue` (`ArrayBlockingQueue`, `LinkedBlockingQueue`) | `put` ждёт, если очередь полна; `take` ждёт, если пуста | производитель–потребитель, пулы потоков |
| `ConcurrentSkipListMap` | потокобезопасная отсортированная мапа | нужна сортировка ключей |

Итераторы этих коллекций **не** бросают `ConcurrentModificationException`: они работают со снимком или слабо согласованы.

## Атомарные классы и CAS

`AtomicInteger`, `AtomicLong`, `AtomicReference`, `AtomicBoolean` основаны на операции **compare-and-swap**: «запиши новое значение, только если текущее равно ожидаемому». Если значение успел изменить другой поток, операция повторяется в цикле. Блокировок нет, поток не засыпает.

```java
AtomicInteger counter = new AtomicInteger();
counter.incrementAndGet();
counter.updateAndGet(x -> x * 2);
```

При очень высокой конкуренции счётчик лучше делать на `LongAdder`: он ведёт несколько ячеек и суммирует их при чтении.

## ReentrantLock

Явная блокировка умеет больше, чем `synchronized`:

```java
private final ReentrantLock lock = new ReentrantLock();

void update() {
    lock.lock();
    try {
        // критическая секция
    } finally {
        lock.unlock();        // ОБЯЗАТЕЛЬНО в finally
    }
}
```

| Возможность | `synchronized` | `ReentrantLock` |
|---|---|---|
| Освобождается автоматически | да | нет — только `unlock()` в `finally` |
| Попытка без ожидания / с таймаутом | нет | `tryLock()`, `tryLock(time, unit)` |
| Ожидание можно прервать | нет | `lockInterruptibly()` |
| Справедливая очередь потоков | нет | `new ReentrantLock(true)` |
| Несколько условий ожидания | одно (`wait`/`notify`) | сколько угодно (`newCondition()`) |

`ReadWriteLock` разделяет доступ: читать могут многие одновременно, писать — только один и без читателей. Выгоден, когда чтений намного больше, чем записей.

## Синхронизаторы

- `CountDownLatch(n)` — одноразовая «защёлка»: `await()` ждёт, пока `countDown()` вызовут n раз. Типичное применение — дождаться завершения нескольких задач.
- `Semaphore(n)` — не больше n потоков одновременно: `acquire()` / `release()`. Ограничение числа соединений.
- `CyclicBarrier(n)` — потоки ждут друг друга в общей точке, барьер можно использовать повторно.

## ThreadLocal

`ThreadLocal<T>` хранит отдельное значение для каждого потока (контекст запроса, текущий пользователь, транзакция в Spring). В пуле потоки переиспользуются, поэтому значение обязательно нужно удалять: `threadLocal.remove()` в `finally` — иначе данные одного запроса «протекут» в следующий.

@@ quiz
@@ q
Несколько потоков выполняют этот код с общей `ConcurrentHashMap`. Корректен ли он?
```java
if (!map.containsKey(key)) {
    map.put(key, 1);
} else {
    map.put(key, map.get(key) + 1);
}
```
- [ ] Да: `ConcurrentHashMap` потокобезопасна
- [x] Нет: между проверкой и записью значение может изменить другой поток, обновления теряются
- [ ] Нет: будет брошено `ConcurrentModificationException`
- [ ] Да, но только если ключи — строки
@@ explain
Каждый вызов атомарен сам по себе, но последовательность «проверить → прочитать → записать» — нет. Нужна одна атомарная операция: `map.merge(key, 1, Integer::sum)`.

@@ q
Что произойдёт?
```java
Map<String, String> map = new ConcurrentHashMap<>();
map.put("ключ", null);
```
- [ ] В мапе появится запись со значением `null`
- [x] `NullPointerException`
- [ ] Запись будет молча проигнорирована
- [ ] Ошибка компиляции
@@ explain
`ConcurrentHashMap` запрещает `null` и в ключах, и в значениях. В многопоточной среде `get(k) == null` должно однозначно значить «ключа нет».

@@ q
Для какой нагрузки подходит `CopyOnWriteArrayList`?
- [ ] Частые записи, редкие чтения
- [x] Частые чтения, редкие записи
- [ ] Очень большие списки с постоянными вставками
- [ ] Для любой — он всегда быстрее `ArrayList`
@@ explain
Каждая запись копирует весь внутренний массив — это дорого. Зато чтение и обход не требуют блокировок и никогда не бросают `ConcurrentModificationException`.

@@ q
Почему `lock.unlock()` пишут в блоке `finally`?
- [ ] Так код выполняется быстрее
- [x] Иначе при исключении блокировка не освободится, и остальные потоки будут ждать вечно
- [ ] Иначе код не скомпилируется
- [ ] `finally` делает блокировку реентерабельной
@@ explain
В отличие от `synchronized`, явная блокировка сама не освобождается. Если критическая секция бросит исключение, а `unlock()` стоит после неё без `finally`, замок останется захваченным навсегда.

@@ task hit-counter | Счётчик посещений | xp=45 interview
Реализуйте потокобезопасный класс `HitCounter`:

- `void hit(String page)` — зафиксировать посещение страницы;
- `long count(String page)` — число посещений страницы (0, если её не посещали);
- `long total()` — общее число посещений;
- `String top()` — страница с наибольшим числом посещений или `null`, если посещений не было (при равенстве — любая из лидеров).

Методом `hit` одновременно пользуются десятки потоков — ни одно посещение не должно потеряться. Не используйте `synchronized`: возьмите `ConcurrentHashMap` и атомарные операции.
@@ hint
`private final ConcurrentHashMap<String, Long> hits = new ConcurrentHashMap<>();` и в `hit`: `hits.merge(page, 1L, Long::sum);`.
@@ hint
`count` — `hits.getOrDefault(page, 0L)`. `total` — сумма значений. `top` — обход `entrySet()` с поиском максимума.
@@ starter
import java.util.HashMap;
import java.util.Map;

class HitCounter {
    private final Map<String, Long> hits = new HashMap<>();

    void hit(String page) {
        Long old = hits.get(page);
        hits.put(page, old == null ? 1 : old + 1);
    }

    long count(String page) { return hits.getOrDefault(page, 0L); }

    long total() { return 0; }

    String top() { return null; }
}

public class Main {
    public static void main(String[] args) {
        HitCounter c = new HitCounter();
        c.hit("/home");
        c.hit("/home");
        c.hit("/about");
        System.out.println(c.count("/home") + " " + c.total() + " " + c.top());
    }
}
@@ solution
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

class HitCounter {
    private final ConcurrentHashMap<String, Long> hits = new ConcurrentHashMap<>();

    void hit(String page) {
        hits.merge(page, 1L, Long::sum);
    }

    long count(String page) { return hits.getOrDefault(page, 0L); }

    long total() {
        long sum = 0;
        for (long v : hits.values()) sum += v;
        return sum;
    }

    String top() {
        String best = null;
        long max = 0;
        for (Map.Entry<String, Long> e : hits.entrySet()) {
            if (e.getValue() > max) {
                max = e.getValue();
                best = e.getKey();
            }
        }
        return best;
    }
}

public class Main {
    public static void main(String[] args) {
        HitCounter c = new HitCounter();
        c.hit("/home");
        c.hit("/home");
        c.hit("/about");
        System.out.println(c.count("/home") + " " + c.total() + " " + c.top());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("один поток", () -> {
            HitCounter c = new HitCounter();
            c.hit("/home"); c.hit("/home"); c.hit("/about");
            T.eq(2L, c.count("/home")); T.eq(1L, c.count("/about")); T.eq(0L, c.count("/none")); T.eq(3L, c.total()); T.eq("/home", c.top());
        });
        T.test("пустой счётчик", () -> { HitCounter c = new HitCounter(); T.eq(0L, c.total()); T.eq(null, c.top()); });
        T.test("16 потоков, ничего не теряется", () -> {
            for (int round = 0; round < 3; round++) {
                HitCounter c = new HitCounter();
                java.util.concurrent.CountDownLatch go = new java.util.concurrent.CountDownLatch(1);
                Thread[] ts = new Thread[16];
                Throwable[] err = new Throwable[1];
                for (int i = 0; i < ts.length; i++) {
                    ts[i] = new Thread(() -> {
                        try { go.await(); for (int k = 0; k < 50_000; k++) c.hit("/p" + (k % 5)); } catch (Throwable e) { err[0] = e; }
                    });
                    ts[i].start();
                }
                go.countDown();
                for (Thread t : ts) t.join();
                T.check(err[0] == null, "поток упал с исключением: " + err[0]);
                T.eq(800_000L, c.total());
                for (int p = 0; p < 5; p++) T.eq(160_000L, c.count("/p" + p));
            }
        });
        T.done();
    }
}
