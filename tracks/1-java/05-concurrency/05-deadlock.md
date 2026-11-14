---
id: j-deadlock
title: Deadlock, wait/notify и производитель–потребитель
summary: Как потоки блокируют друг друга навсегда и как потоки ждут событий.
xp: 35
---
## Deadlock

**Взаимная блокировка** — два потока ждут друг друга, и ни один не может продолжить.

```java
void transfer(Account from, Account to, long amount) {
    synchronized (from) {
        synchronized (to) {
            from.withdraw(amount);
            to.deposit(amount);
        }
    }
}
```

Поток 1 вызывает `transfer(a, b)`, поток 2 — `transfer(b, a)`:

```text
Поток 1: захватил a ───── ждёт b ──┐
Поток 2: захватил b ───── ждёт a ──┘   оба ждут вечно
```

Программа не падает и не грузит процессор — она просто перестаёт отвечать.

Deadlock возможен только при четырёх условиях одновременно: ресурс доступен одному потоку; поток держит один ресурс и ждёт другой; ресурс нельзя отобрать; есть **циклическое ожидание**. Достаточно разрушить одно.

## Как избежать

1. **Единый порядок захвата** — главный приём. Если все потоки берут замки в одном порядке (например, по возрастанию id счёта), цикла быть не может:

```java
Account first = from.id() < to.id() ? from : to;
Account second = first == from ? to : from;
synchronized (first) {
    synchronized (second) { ... }
}
```

2. **`tryLock` с таймаутом**: не получилось взять второй замок — отпустить первый и повторить.
3. **Не держать замок, вызывая чужой код** (слушателей, колбэки, сетевые вызовы).
4. **Меньше замков**: неизменяемые объекты, потокобезопасные коллекции, один замок на операцию.

Диагностика: дамп потоков (`jstack <pid>` или `jcmd <pid> Thread.print`) прямо пишет `Found one Java-level deadlock` и показывает, кто что держит.

Родственные проблемы: **livelock** — потоки не заблокированы, но бесконечно уступают друг другу; **starvation** — потоку никогда не достаётся ресурс.

## wait и notify

Иногда поток должен дождаться **события**: появления элемента в очереди, освобождения места. Крутить цикл с проверкой (busy wait) — значит впустую жечь процессор. Для ожидания у каждого объекта есть методы `wait()`, `notify()` и `notifyAll()`.

```java
class Mailbox {
    private String message;

    synchronized void put(String m) {
        message = m;
        notifyAll();                     // разбудить ждущих
    }

    synchronized String take() throws InterruptedException {
        while (message == null) {        // именно while, не if!
            wait();                      // отпускает монитор и засыпает
        }
        String m = message;
        message = null;
        return m;
    }
}
```

Правила:

- `wait`/`notify` вызываются только **внутри `synchronized`** по тому же объекту, иначе — `IllegalMonitorStateException`;
- `wait()` **отпускает монитор** на время ожидания, а после пробуждения захватывает его снова (`Thread.sleep` монитор не отпускает);
- условие проверяют **в цикле `while`**: поток может проснуться без причины (spurious wakeup), а пока он заново захватывал монитор, условие мог «съесть» другой поток;
- `notify()` будит один произвольный поток, `notifyAll()` — всех. По умолчанию используйте `notifyAll()`: с `notify()` легко разбудить «не того» и получить зависание.

## Производитель–потребитель

Классическая схема: одни потоки кладут задачи в ограниченный буфер, другие забирают. Производитель ждёт, если буфер полон; потребитель — если пуст.

В реальном коде её не пишут руками — есть `BlockingQueue`:

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);
queue.put(task);          // ждёт, если очередь полна
Task t = queue.take();    // ждёт, если очередь пуста
```

Но на собеседованиях просят реализовать именно через `wait`/`notifyAll` — чтобы проверить понимание.

@@ quiz
@@ q
Что нужно, чтобы исключить deadlock в методе `transfer(from, to)`, который захватывает замки обоих счетов?
- [ ] Объявить метод `static`
- [x] Всегда захватывать замки в одном и том же порядке, например по возрастанию id
- [ ] Добавить `Thread.sleep` между захватами
- [ ] Использовать `volatile` для баланса
@@ explain
Deadlock требует циклического ожидания. Если порядок захвата един для всех потоков, цикл невозможен. `sleep` только увеличит вероятность блокировки.

@@ q
Почему условие перед `wait()` проверяют в цикле `while`, а не в `if`?
- [ ] `if` внутри `synchronized` запрещён
- [x] После пробуждения условие может снова быть ложным: ложные пробуждения и другие потоки, успевшие раньше
- [ ] Так поток быстрее просыпается
- [ ] `wait()` всегда возвращается сразу
@@ explain
Проснувшийся поток должен заново захватить монитор — за это время другой поток мог забрать элемент. Кроме того, спецификация допускает пробуждение без `notify`. Поэтому условие всегда перепроверяют.

@@ q
Чем `wait()` отличается от `Thread.sleep()`?
- [ ] Ничем, это синонимы
- [ ] `sleep` можно вызывать только в `synchronized`
- [x] `wait()` освобождает монитор объекта на время ожидания, `sleep()` — нет
- [ ] `wait()` нельзя прервать
@@ explain
`sleep` просто приостанавливает поток, удерживая все захваченные блокировки. `wait` вызывается внутри `synchronized`, отпускает монитор и ждёт `notify`.

@@ q
Что произойдёт?
```java
Object lock = new Object();
lock.notify();
```
- [ ] Ничего: ждущих потоков нет
- [x] `IllegalMonitorStateException`
- [ ] Deadlock
- [ ] Ошибка компиляции
@@ explain
`wait`, `notify` и `notifyAll` разрешено вызывать, только владея монитором этого объекта, то есть внутри `synchronized (lock)`.

@@ task transfer | Перевод без deadlock | xp=50 interview
Метод `Bank.transfer(from, to, amount)` захватывает замки двух счетов в порядке аргументов. Когда один поток переводит с A на B, а другой — с B на A, они блокируют друг друга навсегда.

Исправьте `transfer` так, чтобы deadlock был невозможен, а переводы оставались потокобезопасными: сумма денег на всех счетах не должна меняться. Если на счёте `from` не хватает средств, перевод не выполняется, метод возвращает `false`.
@@ hint
У каждого счёта есть уникальный `id`. Захватывайте сначала замок счёта с меньшим `id`, потом — с большим.
@@ hint
`Account first = from.id < to.id ? from : to; Account second = first == from ? to : from;` — и `synchronized (first) { synchronized (second) { ... } }`. Логика списания остаётся прежней: списываем с `from`, зачисляем на `to`.
@@ starter
class Account {
    final int id;
    long balance;

    Account(int id, long balance) {
        this.id = id;
        this.balance = balance;
    }
}

class Bank {
    static boolean transfer(Account from, Account to, long amount) {
        synchronized (from) {
            Thread.yield();
            synchronized (to) {
                if (from.balance < amount) return false;
                from.balance -= amount;
                to.balance += amount;
                return true;
            }
        }
    }
}

public class Main {
    public static void main(String[] args) {
        Account a = new Account(1, 100), b = new Account(2, 100);
        System.out.println(Bank.transfer(a, b, 30) + " " + a.balance + " " + b.balance);
    }
}
@@ solution
class Account {
    final int id;
    long balance;

    Account(int id, long balance) {
        this.id = id;
        this.balance = balance;
    }
}

class Bank {
    static boolean transfer(Account from, Account to, long amount) {
        Account first = from.id < to.id ? from : to;
        Account second = first == from ? to : from;
        synchronized (first) {
            synchronized (second) {
                if (from.balance < amount) return false;
                from.balance -= amount;
                to.balance += amount;
                return true;
            }
        }
    }
}

public class Main {
    public static void main(String[] args) {
        Account a = new Account(1, 100), b = new Account(2, 100);
        System.out.println(Bank.transfer(a, b, 30) + " " + a.balance + " " + b.balance);
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("обычный перевод", () -> { Account a = new Account(1, 100), b = new Account(2, 50); T.eq(true, Bank.transfer(a, b, 30)); T.eq(70L, a.balance); T.eq(80L, b.balance); });
        T.test("перевод в обратную сторону", () -> { Account a = new Account(1, 100), b = new Account(2, 50); T.eq(true, Bank.transfer(b, a, 50)); T.eq(150L, a.balance); T.eq(0L, b.balance); });
        T.test("недостаточно средств", () -> { Account a = new Account(1, 10), b = new Account(2, 0); T.eq(false, Bank.transfer(a, b, 11)); T.eq(10L, a.balance); T.eq(0L, b.balance); });
        T.test("встречные переводы не блокируют друг друга", () -> {
            Account a = new Account(1, 1_000_000), b = new Account(2, 1_000_000);
            Thread t1 = new Thread(() -> { for (int i = 0; i < 200_000; i++) Bank.transfer(a, b, 1); });
            Thread t2 = new Thread(() -> { for (int i = 0; i < 200_000; i++) Bank.transfer(b, a, 1); });
            t1.setDaemon(true); t2.setDaemon(true);
            t1.start(); t2.start();
            t1.join(8000); t2.join(8000);
            T.check(!t1.isAlive() && !t2.isAlive(), "потоки не завершились за 8 секунд — это deadlock");
            T.eq(2_000_000L, a.balance + b.balance);
        });
        T.done();
    }
}

@@ task bounded-buffer | Ограниченный буфер | xp=55 interview
Реализуйте класс `BoundedBuffer` — очередь целых чисел ограниченной ёмкости для схемы «производитель–потребитель». Используйте `synchronized`, `wait()` и `notifyAll()`; классы из `java.util.concurrent` применять нельзя.

- `BoundedBuffer(int capacity)`;
- `void put(int x) throws InterruptedException` — добавляет элемент; если буфер полон, **ждёт**, пока освободится место;
- `int take() throws InterruptedException` — забирает самый старый элемент; если буфер пуст, **ждёт** появления элемента;
- `int size()`.
@@ hint
Храните элементы в `ArrayDeque<Integer>`. Оба метода — `synchronized`; условие ожидания проверяйте в `while`.
@@ hint
`put`: `while (queue.size() == capacity) wait(); queue.addLast(x); notifyAll();`. `take`: `while (queue.isEmpty()) wait(); int x = queue.removeFirst(); notifyAll(); return x;`.
@@ starter
import java.util.ArrayDeque;
import java.util.Deque;

class BoundedBuffer {
    private final Deque<Integer> queue = new ArrayDeque<>();
    private final int capacity;

    BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    void put(int x) throws InterruptedException {
        queue.addLast(x);
    }

    int take() throws InterruptedException {
        return queue.isEmpty() ? -1 : queue.removeFirst();
    }

    int size() { return queue.size(); }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        BoundedBuffer buf = new BoundedBuffer(2);
        buf.put(1);
        buf.put(2);
        System.out.println(buf.take() + " " + buf.take());
    }
}
@@ solution
import java.util.ArrayDeque;
import java.util.Deque;

class BoundedBuffer {
    private final Deque<Integer> queue = new ArrayDeque<>();
    private final int capacity;

    BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    synchronized void put(int x) throws InterruptedException {
        while (queue.size() == capacity) wait();
        queue.addLast(x);
        notifyAll();
    }

    synchronized int take() throws InterruptedException {
        while (queue.isEmpty()) wait();
        int x = queue.removeFirst();
        notifyAll();
        return x;
    }

    synchronized int size() { return queue.size(); }
}

public class Main {
    public static void main(String[] args) throws InterruptedException {
        BoundedBuffer buf = new BoundedBuffer(2);
        buf.put(1);
        buf.put(2);
        System.out.println(buf.take() + " " + buf.take());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("порядок FIFO", () -> { BoundedBuffer b = new BoundedBuffer(3); b.put(1); b.put(2); b.put(3); T.eq(3, b.size()); T.eq(1, b.take()); T.eq(2, b.take()); T.eq(3, b.take()); });
        T.test("take ждёт появления элемента", () -> {
            BoundedBuffer b = new BoundedBuffer(1);
            int[] got = { -100 };
            Thread consumer = new Thread(() -> { try { got[0] = b.take(); } catch (InterruptedException e) { } });
            consumer.setDaemon(true);
            consumer.start();
            Thread.sleep(200);
            T.check(consumer.isAlive(), "take() на пустом буфере должен ждать, а не возвращаться сразу");
            b.put(42);
            consumer.join(3000);
            T.check(!consumer.isAlive(), "take() не проснулся после put()");
            T.eq(42, got[0]);
        });
        T.test("put ждёт освобождения места", () -> {
            BoundedBuffer b = new BoundedBuffer(1);
            b.put(1);
            Thread producer = new Thread(() -> { try { b.put(2); } catch (InterruptedException e) { } });
            producer.setDaemon(true);
            producer.start();
            Thread.sleep(200);
            T.check(producer.isAlive(), "put() в полный буфер должен ждать");
            T.eq(1, b.size());
            T.eq(1, b.take());
            producer.join(3000);
            T.check(!producer.isAlive(), "put() не проснулся после take()");
            T.eq(2, b.take());
        });
        T.test("4 производителя и 4 потребителя", () -> {
            BoundedBuffer b = new BoundedBuffer(5);
            java.util.concurrent.atomic.AtomicLong sum = new java.util.concurrent.atomic.AtomicLong();
            Thread[] ts = new Thread[8];
            for (int i = 0; i < 4; i++) {
                ts[i] = new Thread(() -> { try { for (int k = 1; k <= 5000; k++) b.put(k); } catch (InterruptedException e) { } });
                ts[4 + i] = new Thread(() -> { try { for (int k = 0; k < 5000; k++) sum.addAndGet(b.take()); } catch (InterruptedException e) { } });
            }
            for (Thread t : ts) { t.setDaemon(true); t.start(); }
            for (Thread t : ts) t.join(8000);
            for (Thread t : ts) T.check(!t.isAlive(), "потоки зависли — проверьте notifyAll() и условие в while");
            T.eq(4L * 5000 * 5001 / 2, sum.get());
            T.eq(0, b.size());
        });
        T.done();
    }
}
