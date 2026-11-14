---
id: spring-tx
title: Транзакции, AOP и прокси
summary: Как работает @Transactional, почему он иногда «не работает» и что такое propagation.
xp: 40
---
## @Transactional

```java
@Service
class TransferService {

    @Transactional
    void transfer(long fromId, long toId, BigDecimal amount) {
        Account from = accounts.findById(fromId).orElseThrow();
        Account to = accounts.findById(toId).orElseThrow();
        from.withdraw(amount);
        to.deposit(amount);
    }   // метод завершился нормально → COMMIT; вылетело исключение → ROLLBACK
}
```

Аннотацию ставят на методы **сервисного** слоя: именно там находится единица бизнес-операции.

## Как это устроено: прокси

Spring не меняет ваш класс. При создании бина он оборачивает его в **прокси** — объект с тем же интерфейсом, который перехватывает вызовы:

```text
Контроллер ──► ПРОКСИ ──► настоящий TransferService
               │ 1. открыть транзакцию
               │ 2. вызвать настоящий метод
               │ 3. commit или rollback
```

В контроллер внедряется именно прокси. Это частный случай **AOP** — аспектно-ориентированного программирования: сквозная логика (транзакции, кеширование, безопасность, логирование) вынесена из бизнес-кода и подключается декларативно.

Виды прокси: **JDK dynamic proxy** (если бин реализует интерфейс) и **CGLIB** (создаёт наследника класса; в Spring Boot используется по умолчанию).

## Ловушка 1: вызов метода того же класса

```java
@Service
class OrderService {

    void placeOrder(Order o) {
        saveOrder(o);                 // вызов через this — МИМО прокси
    }

    @Transactional
    void saveOrder(Order o) { ... }   // транзакция НЕ откроется
}
```

Прокси перехватывает только вызовы, приходящие **снаружи**. Вызов `this.saveOrder()` идёт напрямую в настоящий объект. Это самый частый вопрос о Spring на собеседованиях. Решения: поставить `@Transactional` на внешний метод; вынести метод в другой бин; в крайнем случае — внедрить бин сам в себя.

Та же ловушка у `@Async`, `@Cacheable`, `@Retryable`.

## Ловушка 2: private и final

CGLIB-прокси — наследник класса, а переопределить `private` или `final` метод нельзя. Аннотация на таком методе молча игнорируется. Метод с `@Transactional` должен быть доступен для переопределения (обычно `public`).

## Ловушка 3: какие исключения откатывают транзакцию

По умолчанию откат происходит только при **непроверяемых** исключениях (`RuntimeException` и `Error`). При проверяемом (`IOException` и другие наследники `Exception`) транзакция **фиксируется**.

```java
@Transactional(rollbackFor = Exception.class)   // откатывать при любом исключении
```

И ещё: если исключение поймано внутри метода и не проброшено дальше — отката не будет, прокси о нём не узнает.

## Propagation — поведение при вложенных вызовах

Что делать, если метод с `@Transactional` вызван, когда транзакция уже идёт?

| Значение | Поведение |
|---|---|
| **REQUIRED** (по умолчанию) | присоединиться к текущей; если её нет — создать |
| **REQUIRES_NEW** | приостановить текущую и открыть новую, независимую |
| SUPPORTS | работать в транзакции, если она есть; иначе — без неё |
| MANDATORY | требовать существующую транзакцию, иначе исключение |
| NOT_SUPPORTED | приостановить текущую и выполнить без транзакции |
| NEVER | исключение, если транзакция есть |
| NESTED | вложенная транзакция с точкой сохранения (savepoint) |

`REQUIRES_NEW` применяют, например, для записи в журнал аудита: запись должна сохраниться, даже если основная операция откатится.

> **Ловушка.** При `REQUIRED` внутренний и внешний методы работают в **одной** транзакции. Если внутренний бросил исключение, транзакция помечается «только на откат», и даже если внешний метод поймал исключение, при коммите получится `UnexpectedRollbackException`.

## Другие параметры

- `readOnly = true` — подсказка для запросов только на чтение: Hibernate не делает dirty checking, а база может оптимизировать работу.
- `isolation` — уровень изоляции (по умолчанию — как в базе).
- `timeout` — предельная длительность.

## Чего не делать в транзакции

Не вызывайте внешние сервисы (HTTP, отправка писем, очереди) внутри транзакции: она удерживает соединение с базой и блокировки на всё время ожидания, а «отправленное письмо» откатить нельзя. Сначала зафиксируйте данные, затем выполняйте внешние действия (например, через `@TransactionalEventListener(phase = AFTER_COMMIT)`).

@@ quiz
@@ q
Метод `a()` без аннотаций вызывает метод `b()` того же класса, помеченный `@Transactional`. Контроллер вызывает `a()`. Будет ли `b()` выполнен в транзакции?
- [ ] Да
- [x] Нет: вызов `this.b()` идёт мимо прокси
- [ ] Да, но только при `REQUIRES_NEW`
- [ ] Будет ошибка при старте приложения
@@ explain
Транзакцию открывает прокси, а он перехватывает только внешние вызовы. Внутренний вызов попадает сразу в настоящий объект. Нужно аннотировать `a()` или вынести `b()` в другой бин.

@@ q
Метод с `@Transactional` (без параметров) бросил `IOException`. Что произойдёт с транзакцией?
- [ ] Откатится
- [x] Зафиксируется: по умолчанию откат только при непроверяемых исключениях
- [ ] Останется открытой
- [ ] Приложение остановится
@@ explain
`IOException` — проверяемое исключение. Чтобы оно вызывало откат, пишут `@Transactional(rollbackFor = Exception.class)`.

@@ q
Какое значение propagation использовать, чтобы запись в журнал аудита сохранилась, даже если основная транзакция откатится?
- [ ] REQUIRED
- [x] REQUIRES_NEW
- [ ] SUPPORTS
- [ ] MANDATORY
@@ explain
`REQUIRES_NEW` приостанавливает внешнюю транзакцию и выполняет метод в собственной, которая фиксируется независимо. (Метод должен находиться в другом бине — иначе снова обход прокси.)

@@ q
Почему `@Transactional` на `private`-методе не работает?
- [ ] Приватные методы нельзя аннотировать
- [x] Прокси не может перехватить вызов приватного метода
- [ ] Приватные методы выполняются в другом потоке
- [ ] Работает, но только в тестах
@@ explain
CGLIB-прокси — это наследник класса, а приватные методы не переопределяются. К тому же приватный метод вызывается только изнутри класса, то есть мимо прокси.

@@ q
Что такое AOP?
- [ ] Способ ускорить запуск приложения
- [x] Подход, при котором сквозная логика (транзакции, логирование, безопасность) отделена от бизнес-кода и применяется через перехват вызовов
- [ ] Формат конфигурации
- [ ] Библиотека для работы с JSON
@@ explain
Аспект описывает, что делать (advice) и к каким методам применять (pointcut). В Spring AOP это реализовано через прокси вокруг бинов.

@@ task tx-proxy | Транзакционный прокси | xp=60 interview
Напишите упрощённый механизм `@Transactional` на динамических прокси JDK — так вы увидите, что именно делает Spring.

В заготовке есть аннотация `@Tx`, интерфейс `TxManager` (`begin()`, `commit()`, `rollback()`) и интерфейс `PaymentService` с двумя методами, один из которых помечен `@Tx`.

Реализуйте `Main.wrap(Class<T> iface, T target, TxManager tx)`: метод возвращает прокси, реализующий интерфейс `iface`, который:

- для методов интерфейса **с аннотацией `@Tx`**: вызывает `tx.begin()`, затем настоящий метод; при нормальном завершении — `tx.commit()`; если метод бросил `RuntimeException` — `tx.rollback()`; если бросил проверяемое исключение — `tx.commit()` (как в Spring по умолчанию). Исключение в любом случае пробрасывается вызывающему коду **в исходном виде**;
- для методов **без аннотации** — просто вызывает настоящий метод, не трогая `TxManager`.
@@ hint
`Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[]{iface}, (proxy, method, args) -> { ... })`. Наличие аннотации: `method.isAnnotationPresent(Tx.class)`. Настоящий вызов: `method.invoke(target, args)`.
@@ hint
`method.invoke` заворачивает исключение метода в `InvocationTargetException` — достаньте исходное через `e.getCause()`, решите, `rollback` или `commit`, и бросьте именно причину: `throw cause;`.
@@ starter
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;

@Retention(RetentionPolicy.RUNTIME)
@interface Tx { }

interface TxManager {
    void begin();
    void commit();
    void rollback();
}

interface PaymentService {
    @Tx
    String pay(int amount) throws Exception;

    String status();
}

public class Main {
    static <T> T wrap(Class<T> iface, T target, TxManager tx) {
        return target;
    }

    public static void main(String[] args) throws Exception {
        TxManager tx = new TxManager() {
            public void begin() { System.out.println("BEGIN"); }
            public void commit() { System.out.println("COMMIT"); }
            public void rollback() { System.out.println("ROLLBACK"); }
        };
        PaymentService real = new PaymentService() {
            public String pay(int amount) { return "оплачено " + amount; }
            public String status() { return "ok"; }
        };
        PaymentService proxy = wrap(PaymentService.class, real, tx);
        System.out.println(proxy.pay(100));
        System.out.println(proxy.status());
    }
}
@@ solution
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;

@Retention(RetentionPolicy.RUNTIME)
@interface Tx { }

interface TxManager {
    void begin();
    void commit();
    void rollback();
}

interface PaymentService {
    @Tx
    String pay(int amount) throws Exception;

    String status();
}

public class Main {
    static <T> T wrap(Class<T> iface, T target, TxManager tx) {
        Object proxy = Proxy.newProxyInstance(iface.getClassLoader(), new Class<?>[]{iface}, (p, method, args) -> {
            boolean transactional = method.isAnnotationPresent(Tx.class);
            if (transactional) tx.begin();
            try {
                Object result = method.invoke(target, args);
                if (transactional) tx.commit();
                return result;
            } catch (InvocationTargetException e) {
                Throwable cause = e.getCause();
                if (transactional) {
                    if (cause instanceof RuntimeException || cause instanceof Error) tx.rollback();
                    else tx.commit();
                }
                throw cause;
            }
        });
        return iface.cast(proxy);
    }

    public static void main(String[] args) throws Exception {
        TxManager tx = new TxManager() {
            public void begin() { System.out.println("BEGIN"); }
            public void commit() { System.out.println("COMMIT"); }
            public void rollback() { System.out.println("ROLLBACK"); }
        };
        PaymentService real = new PaymentService() {
            public String pay(int amount) { return "оплачено " + amount; }
            public String status() { return "ok"; }
        };
        PaymentService proxy = wrap(PaymentService.class, real, tx);
        System.out.println(proxy.pay(100));
        System.out.println(proxy.status());
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;

public class Checker {
    static List<String> log = new ArrayList<>();
    static TxManager tx = new TxManager() {
        public void begin() { log.add("begin"); }
        public void commit() { log.add("commit"); }
        public void rollback() { log.add("rollback"); }
    };
    static PaymentService service(int mode) {
        return new PaymentService() {
            public String pay(int amount) throws Exception {
                log.add("pay");
                if (mode == 1) throw new IllegalStateException("нет денег");
                if (mode == 2) throw new java.io.IOException("нет связи");
                return "ok " + amount;
            }
            public String status() { log.add("status"); return "up"; }
        };
    }

    public static void main(String[] args) {
        T.test("успешный вызов: begin → метод → commit", () -> { log.clear(); T.eq("ok 5", Main.wrap(PaymentService.class, service(0), tx).pay(5)); T.eq(List.of("begin", "pay", "commit"), log); });
        T.test("RuntimeException: rollback, исключение проброшено", () -> {
            log.clear();
            PaymentService p = Main.wrap(PaymentService.class, service(1), tx);
            IllegalStateException e = T.throwsEx(IllegalStateException.class, () -> p.pay(1));
            T.eq("нет денег", e.getMessage());
            T.eq(List.of("begin", "pay", "rollback"), log);
        });
        T.test("проверяемое исключение: commit, исключение проброшено", () -> {
            log.clear();
            PaymentService p = Main.wrap(PaymentService.class, service(2), tx);
            T.throwsEx(java.io.IOException.class, () -> p.pay(1));
            T.eq(List.of("begin", "pay", "commit"), log);
        });
        T.test("метод без @Tx — без транзакции", () -> { log.clear(); T.eq("up", Main.wrap(PaymentService.class, service(0), tx).status()); T.eq(List.of("status"), log); });
        T.test("возвращается именно прокси", () -> { PaymentService real = service(0); T.check(Main.wrap(PaymentService.class, real, tx) != real, "wrap должен вернуть прокси, а не исходный объект"); });
        T.done();
    }
}
