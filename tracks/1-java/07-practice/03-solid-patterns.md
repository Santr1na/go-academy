---
id: j-solid-patterns
title: SOLID и паттерны проектирования
summary: Пять принципов и паттерны, которые реально спрашивают и реально используют.
xp: 35
---
## SOLID

Пять принципов, которые помогают писать код, устойчивый к изменениям. На собеседовании просят расшифровать и привести пример.

| Буква | Принцип | Суть |
|---|---|---|
| **S** | Single Responsibility | у класса одна причина для изменения |
| **O** | Open/Closed | открыт для расширения, закрыт для изменения |
| **L** | Liskov Substitution | наследник должен быть полноценной заменой родителя |
| **I** | Interface Segregation | много узких интерфейсов лучше одного «толстого» |
| **D** | Dependency Inversion | зависеть от абстракций, а не от конкретных классов |

**S.** Класс `OrderService`, который считает скидки, пишет в базу, шлёт письма и формирует PDF, изменится по четырём разным причинам. Разделите на `PriceCalculator`, `OrderRepository`, `Mailer`, `InvoiceRenderer`.

**O.** Плохо — `if (type == "card") … else if (type == "paypal") …`: каждый новый способ оплаты требует править старый код. Хорошо — интерфейс `PaymentMethod` и новая реализация без изменения существующих.

**L.** Классический контрпример: `Square extends Rectangle`. Код, который ставит прямоугольнику ширину 5 и высоту 10 и ожидает площадь 50, сломается на квадрате. Если наследник бросает `UnsupportedOperationException` в унаследованном методе или усиливает требования — принцип нарушен.

**I.** Интерфейс `Worker { work(); eat(); sleep(); }` заставит робота реализовывать `eat()`. Разбейте на `Workable`, `Eatable`.

**D.** `OrderService` не создаёт `new MySqlOrderRepository()` внутри себя, а получает `OrderRepository` в конструкторе. Реализацию подставляет внешний код — в Spring это делает контейнер. Именно на этом принципе построено внедрение зависимостей.

## Паттерны

**Singleton** — один экземпляр на приложение. Надёжные способы в Java:

```java
enum Config { INSTANCE; }                       // проще всего и безопасно

class Registry {                                // ленивый, потокобезопасный без блокировок
    private Registry() { }
    private static class Holder { static final Registry INSTANCE = new Registry(); }
    static Registry get() { return Holder.INSTANCE; }
}
```

> **На собеседовании.** Про синглтон спросят «как сделать потокобезопасным». Ответ: enum или holder-класс (JVM гарантирует однократную инициализацию класса). Double-checked locking работает только с `volatile`-полем. И добавьте, что синглтон затрудняет тестирование — в Spring вместо него используют бины со scope singleton.

**Builder** — пошаговое создание объекта с множеством параметров вместо конструктора на десять аргументов:

```java
User user = User.builder().name("Анна").email("a@b.c").age(30).build();
```

**Factory Method / Factory** — создание объектов прячется за методом: вызывающий код не знает конкретный класс (`List.of`, `Executors.newFixedThreadPool`, `LocalDate.of`).

**Strategy** — семейство взаимозаменяемых алгоритмов за одним интерфейсом (`Comparator`, способы расчёта скидки). В современной Java стратегией часто служит лямбда.

**Decorator** — оборачивает объект, добавляя поведение и сохраняя интерфейс: `new BufferedReader(new FileReader(f))`, `Collections.unmodifiableList(list)`.

**Proxy** — объект-заместитель, который перехватывает вызовы: так Spring реализует `@Transactional`, `@Cacheable`, а Hibernate — ленивую загрузку.

**Observer** — подписчики получают уведомления о событиях (слушатели, `ApplicationEventPublisher` в Spring).

**Template Method** — базовый класс задаёт скелет алгоритма, наследники переопределяют шаги (`JdbcTemplate`, `AbstractList`).

**Adapter** — приводит чужой интерфейс к нужному (`Arrays.asList`, `InputStreamReader`).

## Другие принципы

- **DRY** — не повторяйся: одно знание в одном месте.
- **KISS** — делай проще.
- **YAGNI** — не пиши то, что «когда-нибудь пригодится».
- **Композиция вместо наследования** — собирайте поведение из объектов-полей.

@@ quiz
@@ q
Класс `ReportService` получает данные из базы, считает итоги, формирует PDF и отправляет его по почте. Какой принцип SOLID нарушен в первую очередь?
- [x] Single Responsibility
- [ ] Liskov Substitution
- [ ] Interface Segregation
- [ ] Ни один
@@ explain
У класса четыре независимые причины измениться: схема базы, правила расчёта, вид отчёта, способ доставки. Каждую обязанность стоит вынести в отдельный класс.

@@ q
`class Square extends Rectangle` переопределяет `setWidth` так, что меняется и высота. Какой принцип это нарушает?
- [ ] Open/Closed
- [x] Liskov Substitution
- [ ] Dependency Inversion
- [ ] Single Responsibility
@@ explain
Код, написанный для `Rectangle`, ожидает, что ширина и высота меняются независимо. Квадрат подменить прямоугольник не может, не сломав эти ожидания.

@@ q
Какой паттерн лежит в основе `@Transactional` в Spring?
- [ ] Singleton
- [ ] Builder
- [x] Proxy
- [ ] Adapter
@@ explain
Spring оборачивает бин в прокси-объект, который перед вызовом метода открывает транзакцию, а после — фиксирует или откатывает её. Отсюда известная ловушка: вызов метода «изнутри» того же класса идёт мимо прокси.

@@ q
Какой способ создания синглтона в Java считается самым надёжным и простым?
- [ ] Публичное статическое поле без `final`
- [x] `enum` с единственным элементом `INSTANCE`
- [ ] Ленивая инициализация в `getInstance()` без синхронизации
- [ ] Наследование от `Object`
@@ explain
JVM гарантирует единственность и потокобезопасную инициализацию констант enum, а заодно защищает от создания второго экземпляра через рефлексию и сериализацию. Ленивая инициализация без синхронизации в многопоточном коде может создать два объекта.

@@ q
Сервис получает `OrderRepository` (интерфейс) через конструктор, а не создаёт `new JdbcOrderRepository()` сам. Какой принцип здесь применён?
- [ ] Interface Segregation
- [ ] Liskov Substitution
- [x] Dependency Inversion
- [ ] DRY
@@ explain
Сервис зависит от абстракции, а конкретную реализацию ему передают снаружи. Это позволяет в тестах подставить заглушку и сменить базу данных, не трогая сервис.

@@ task builder | Builder | xp=45 interview
Реализуйте неизменяемый класс `HttpRequest` и вложенный статический класс `HttpRequest.Builder`:

```java
HttpRequest r = HttpRequest.builder("https://example.com")
        .method("POST")
        .header("Accept", "json")
        .timeout(5000)
        .build();
```

- `HttpRequest.builder(String url)` — статический метод, возвращает `Builder`;
- методы `Builder`: `method(String)`, `header(String name, String value)`, `timeout(int millis)` — каждый возвращает сам `Builder`; `build()` создаёт `HttpRequest`;
- значения по умолчанию: метод `"GET"`, таймаут `1000`, заголовков нет;
- `build()` бросает `IllegalStateException`, если таймаут не положительный;
- геттеры `HttpRequest`: `url()`, `method()`, `timeout()`, `headers()` — последний возвращает `Map<String, String>`, которую **нельзя изменить**; изменения билдера после `build()` не должны влиять на уже созданный объект.
@@ hint
У `HttpRequest` приватный конструктор, принимающий `Builder`; поля `final`. Методы билдера заканчиваются на `return this;`.
@@ hint
Защитная копия заголовков: `this.headers = Map.copyOf(b.headers);` — она и неизменяемая, и независимая от билдера.
@@ starter
import java.util.Map;

final class HttpRequest {
    // поля, приватный конструктор, геттеры, static builder(url) и вложенный class Builder
}

public class Main {
    public static void main(String[] args) {
        // HttpRequest r = HttpRequest.builder("https://example.com").method("POST").header("Accept", "json").build();
        // System.out.println(r.method() + " " + r.url() + " " + r.headers());
    }
}
@@ solution
import java.util.LinkedHashMap;
import java.util.Map;

final class HttpRequest {
    private final String url;
    private final String method;
    private final int timeout;
    private final Map<String, String> headers;

    private HttpRequest(Builder b) {
        this.url = b.url;
        this.method = b.method;
        this.timeout = b.timeout;
        this.headers = Map.copyOf(b.headers);
    }

    static Builder builder(String url) { return new Builder(url); }

    String url() { return url; }

    String method() { return method; }

    int timeout() { return timeout; }

    Map<String, String> headers() { return headers; }

    static final class Builder {
        private final String url;
        private String method = "GET";
        private int timeout = 1000;
        private final Map<String, String> headers = new LinkedHashMap<>();

        private Builder(String url) { this.url = url; }

        Builder method(String method) { this.method = method; return this; }

        Builder header(String name, String value) { headers.put(name, value); return this; }

        Builder timeout(int millis) { this.timeout = millis; return this; }

        HttpRequest build() {
            if (timeout <= 0) throw new IllegalStateException("таймаут должен быть положительным");
            return new HttpRequest(this);
        }
    }
}

public class Main {
    public static void main(String[] args) {
        HttpRequest r = HttpRequest.builder("https://example.com").method("POST").header("Accept", "json").build();
        System.out.println(r.method() + " " + r.url() + " " + r.headers());
    }
}
@@ test
import java.util.Map;

public class Checker {
    public static void main(String[] args) {
        T.test("значения по умолчанию", () -> { HttpRequest r = HttpRequest.builder("u").build(); T.eq("u", r.url()); T.eq("GET", r.method()); T.eq(1000, r.timeout()); T.eq(Map.of(), r.headers()); });
        T.test("цепочка вызовов", () -> { HttpRequest r = HttpRequest.builder("u").method("POST").header("A", "1").header("B", "2").timeout(5000).build(); T.eq("POST", r.method()); T.eq(5000, r.timeout()); T.eq(Map.of("A", "1", "B", "2"), r.headers()); });
        T.test("неверный таймаут", () -> T.throwsEx(IllegalStateException.class, () -> HttpRequest.builder("u").timeout(0).build()));
        T.test("headers нельзя изменить", () -> { HttpRequest r = HttpRequest.builder("u").header("A", "1").build(); try { r.headers().put("X", "y"); } catch (UnsupportedOperationException e) { } T.eq(1, r.headers().size()); });
        T.test("билдер не влияет на созданный объект", () -> { HttpRequest.Builder b = HttpRequest.builder("u").header("A", "1"); HttpRequest r = b.build(); b.header("B", "2").method("PUT"); T.eq(1, r.headers().size()); T.eq("GET", r.method()); });
        T.test("поля final", () -> { for (java.lang.reflect.Field f : HttpRequest.class.getDeclaredFields()) T.check(java.lang.reflect.Modifier.isFinal(f.getModifiers()), "поле " + f.getName() + " должно быть final"); });
        T.done();
    }
}
