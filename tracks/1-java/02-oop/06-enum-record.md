---
id: j-enum-record
title: enum, record и неизменяемые объекты
summary: Перечисления с поведением, компактные классы-данные и почему неизменяемость упрощает жизнь.
xp: 25
---
## enum — фиксированный набор значений

Когда значений заранее известное число (дни недели, статусы заказа), вместо строк и чисел используют перечисление. Компилятор не даст передать несуществующий статус.

```java
enum Status { NEW, PAID, CANCELLED }

Status s = Status.PAID;
if (s == Status.PAID) { ... }         // enum-значения сравнивают через ==
Status.valueOf("NEW");                // из строки; для неизвестного имени — IllegalArgumentException
Status.values();                      // массив всех значений
s.name();                             // "PAID"
s.ordinal();                          // 1 — порядковый номер
```

Каждое значение enum — **единственный объект** на всю программу, поэтому `==` безопасен и даже предпочтительнее `equals` (не упадёт на `null`).

> **Ловушка.** Не сохраняйте в базу `ordinal()`. Стоит добавить новое значение в середину списка — и все сохранённые числа начнут означать другое. Храните `name()` (в JPA — `@Enumerated(EnumType.STRING)`).

enum — это полноценный класс: у него могут быть поля, конструктор и методы.

```java
enum Planet {
    MERCURY(3.303e+23, 2.4397e6),
    EARTH(5.976e+24, 6.37814e6);

    private final double mass, radius;

    Planet(double mass, double radius) {    // конструктор всегда private
        this.mass = mass;
        this.radius = radius;
    }

    double surfaceGravity() { return 6.67300E-11 * mass / (radius * radius); }
}
```

enum отлично работает в `switch`, а для коллекций есть быстрые `EnumMap` и `EnumSet`.

## record — класс-данные в одну строку

```java
record Point(int x, int y) { }
```

Компилятор сам создаёт: `private final` поля, конструктор, методы доступа `x()` и `y()` (без префикса `get`), а также `equals`, `hashCode` и `toString` по всем компонентам.

```java
Point p = new Point(1, 2);
p.x();                                   // 1
p.equals(new Point(1, 2));               // true
System.out.println(p);                   // Point[x=1, y=2]
```

В record можно добавить проверки (компактный конструктор) и свои методы:

```java
record Range(int from, int to) {
    Range {                              // компактный конструктор: параметры те же
        if (from > to) throw new IllegalArgumentException("from > to");
    }

    int length() { return to - from; }
}
```

Ограничения: record неявно `final`, не может наследовать класс (но может реализовывать интерфейсы), поля менять нельзя. Идеален для DTO, ключей `HashMap`, возврата нескольких значений из метода.

> **Ловушка.** record даёт «поверхностную» неизменяемость. В `record Team(List<String> members)` сам список по-прежнему можно менять. Делайте защитную копию в компактном конструкторе: `members = List.copyOf(members);`.

## Неизменяемые объекты

Объект неизменяемый (immutable), если после создания его состояние не меняется. Рецепт:

1. класс `final`;
2. все поля `private final`;
3. нет сеттеров;
4. изменяемые поля копируются на входе и на выходе;
5. «изменение» возвращает новый объект.

```java
final class Money {
    private final long amount;

    Money(long amount) { this.amount = amount; }

    Money plus(Money other) {            // не меняет this, а создаёт новый объект
        return new Money(amount + other.amount);
    }
}
```

Почему это ценят: неизменяемый объект безопасен в многопоточном коде без синхронизации, его можно свободно передавать и использовать как ключ `HashMap`, а его состояние не может испортить чужой код. `String`, `Integer`, `LocalDate`, `BigDecimal` — все неизменяемые.

@@ quiz
@@ q
Что выведет код?
```java
record Point(int x, int y) { }

Point a = new Point(1, 2);
Point b = new Point(1, 2);
System.out.println((a == b) + " " + a.equals(b));
```
- [ ] `true true`
- [x] `false true`
- [ ] `false false`
- [ ] `true false`
@@ explain
`==` сравнивает ссылки — объекта два. А `equals` у record сгенерирован компилятором и сравнивает все компоненты.

@@ q
Почему не стоит хранить в базе данных `status.ordinal()`?
- [ ] `ordinal()` работает медленно
- [ ] `ordinal()` может вернуть `null`
- [x] При добавлении или перестановке значений enum сохранённые числа начнут означать другие статусы
- [ ] Базы данных не умеют хранить целые числа
@@ explain
`ordinal()` — просто позиция в объявлении. Вставили новое значение перед существующими — и все старые записи молча «поменяли» статус. Имя значения (`name()`) устойчиво к таким правкам.

@@ q
Что произойдёт?
```java
record Team(List<String> members) { }

List<String> list = new ArrayList<>(List.of("Анна"));
Team t = new Team(list);
t.members().add("Борис");
System.out.println(t.members().size());
```
- [ ] `UnsupportedOperationException`
- [ ] `1`
- [x] `2`
- [ ] Ошибка компиляции: поля record неизменяемы
@@ explain
Поле record — `final` ссылка: заменить список нельзя, но сам `ArrayList` остаётся изменяемым. Для настоящей неизменяемости нужна защитная копия в конструкторе: `members = List.copyOf(members);`.

@@ q
Как правильно сравнивать значения enum?
- [ ] Только через `equals`
- [x] Через `==` — каждое значение существует в единственном экземпляре
- [ ] Через `compareTo() == 0`, остальное ненадёжно
- [ ] Сравнивать `name()` как строки
@@ explain
JVM гарантирует, что у каждой константы enum ровно один объект. `==` короче, проверяется компилятором по типам и не бросает `NullPointerException`, если слева `null`.

@@ task order-status | Статусы заказа | xp=40
Создайте перечисление `OrderStatus` со значениями `NEW`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED` и методом `boolean canMoveTo(OrderStatus next)`, который проверяет допустимость перехода:

- `NEW` → `PAID` или `CANCELLED`;
- `PAID` → `SHIPPED` или `CANCELLED`;
- `SHIPPED` → `DELIVERED`;
- из `DELIVERED` и `CANCELLED` переходов нет.
@@ hint
Внутри метода удобно использовать `switch (this)` со стрелками: `case NEW -> next == PAID || next == CANCELLED;`.
@@ hint
```java
return switch (this) {
    case NEW -> next == PAID || next == CANCELLED;
    case PAID -> next == SHIPPED || next == CANCELLED;
    case SHIPPED -> next == DELIVERED;
    default -> false;
};
```
@@ starter
enum OrderStatus {
    NEW;

    boolean canMoveTo(OrderStatus next) {
        return false;
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(OrderStatus.NEW.canMoveTo(OrderStatus.NEW));
    }
}
@@ solution
enum OrderStatus {
    NEW, PAID, SHIPPED, DELIVERED, CANCELLED;

    boolean canMoveTo(OrderStatus next) {
        return switch (this) {
            case NEW -> next == PAID || next == CANCELLED;
            case PAID -> next == SHIPPED || next == CANCELLED;
            case SHIPPED -> next == DELIVERED;
            default -> false;
        };
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(OrderStatus.NEW.canMoveTo(OrderStatus.PAID));
    }
}
@@ test
public class Checker {
    static boolean can(String from, String to) { return OrderStatus.valueOf(from).canMoveTo(OrderStatus.valueOf(to)); }

    public static void main(String[] args) {
        T.test("пять статусов", () -> T.eq(5, OrderStatus.values().length));
        T.test("из NEW", () -> { T.eq(true, can("NEW", "PAID")); T.eq(true, can("NEW", "CANCELLED")); T.eq(false, can("NEW", "SHIPPED")); T.eq(false, can("NEW", "DELIVERED")); });
        T.test("из PAID", () -> { T.eq(true, can("PAID", "SHIPPED")); T.eq(true, can("PAID", "CANCELLED")); T.eq(false, can("PAID", "NEW")); T.eq(false, can("PAID", "DELIVERED")); });
        T.test("из SHIPPED", () -> { T.eq(true, can("SHIPPED", "DELIVERED")); T.eq(false, can("SHIPPED", "CANCELLED")); });
        T.test("конечные статусы", () -> {
            for (OrderStatus s : OrderStatus.values()) { T.eq(false, OrderStatus.DELIVERED.canMoveTo(s)); T.eq(false, OrderStatus.CANCELLED.canMoveTo(s)); }
        });
        T.test("нельзя перейти в тот же статус", () -> { for (OrderStatus s : OrderStatus.values()) T.eq(false, s.canMoveTo(s)); });
        T.done();
    }
}

@@ task range | record с проверкой | xp=35
Объявите `record Range(int from, int to)`:

- при создании с `from > to` бросается `IllegalArgumentException`;
- `int length()` возвращает `to - from`;
- `boolean contains(int x)` — истина, если `from <= x < to` (правая граница не включается);
- `Range shift(int delta)` возвращает **новый** диапазон, сдвинутый на `delta`.
@@ hint
Проверка пишется в компактном конструкторе: `Range { if (from > to) throw new IllegalArgumentException(); }` — без списка параметров.
@@ hint
`Range shift(int delta) { return new Range(from + delta, to + delta); }` — исходный объект не меняется.
@@ starter
record Range(int from, int to) {
    // проверка и методы
}

public class Main {
    public static void main(String[] args) {
        Range r = new Range(2, 5);
        System.out.println(r);
    }
}
@@ solution
record Range(int from, int to) {
    Range {
        if (from > to) throw new IllegalArgumentException("from > to");
    }

    int length() { return to - from; }

    boolean contains(int x) { return x >= from && x < to; }

    Range shift(int delta) { return new Range(from + delta, to + delta); }
}

public class Main {
    public static void main(String[] args) {
        Range r = new Range(2, 5);
        System.out.println(r + " " + r.length() + " " + r.shift(10));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("это record", () -> T.check(Range.class.isRecord(), "Range должен быть record"));
        T.test("length", () -> { T.eq(3, new Range(2, 5).length()); T.eq(0, new Range(4, 4).length()); });
        T.test("contains", () -> { Range r = new Range(2, 5); T.eq(true, r.contains(2)); T.eq(true, r.contains(4)); T.eq(false, r.contains(5)); T.eq(false, r.contains(1)); });
        T.test("shift возвращает новый объект", () -> { Range r = new Range(2, 5); Range s = r.shift(10); T.eq(new Range(12, 15), s); T.eq(new Range(2, 5), r); });
        T.test("неверные границы", () -> T.throwsEx(IllegalArgumentException.class, () -> new Range(5, 2)));
        T.done();
    }
}
