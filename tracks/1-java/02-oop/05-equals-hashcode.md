---
id: j-equals-hashcode
title: equals, hashCode и toString
summary: Контракт, который спрашивают на каждом собеседовании, и что ломается при его нарушении.
xp: 30
---
## Методы, которые есть у каждого объекта

Любой класс наследует от `Object` три метода, которые почти всегда стоит переопределить:

- `toString()` — текстовое представление. По умолчанию — `Point@1b6d3586` (имя класса и хеш), что бесполезно в логах.
- `equals(Object o)` — равенство по смыслу. По умолчанию сравнивает ссылки, то есть работает как `==`.
- `hashCode()` — число, по которому хеш-коллекции раскладывают объекты по корзинам. По умолчанию зависит от конкретного объекта.

## Как правильно написать equals и hashCode

```java
import java.util.Objects;

class Point {
    private final int x, y;

    Point(int x, int y) { this.x = x; this.y = y; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;                    // тот же объект
        if (!(o instanceof Point other)) return false; // null или другой тип
        return x == other.x && y == other.y;           // сравниваем значимые поля
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y);                     // те же поля, что и в equals
    }

    @Override
    public String toString() {
        return "Point(" + x + ", " + y + ")";
    }
}
```

> **Ловушка.** Параметр `equals` должен иметь тип `Object`. Метод `public boolean equals(Point p)` — это не переопределение, а перегрузка: коллекции будут вызывать старую версию из `Object`. Аннотация `@Override` ловит эту ошибку на этапе компиляции.

## Контракт

1. Если `a.equals(b)`, то `a.hashCode() == b.hashCode()` — **всегда**.
2. Обратное не обязательно: разные объекты могут иметь одинаковый хеш (**коллизия**).
3. `hashCode` объекта не должен меняться, пока не изменились поля, участвующие в `equals`.
4. `equals` рефлексивен (`a.equals(a)`), симметричен (`a.equals(b)` ⇔ `b.equals(a)`), транзитивен, а `a.equals(null)` — `false`.

## Что ломается, если нарушить контракт

Разберём, как `HashSet` ищет элемент — тогда правила перестанут казаться формальностью.

```text
set.contains(p):
  1) h = p.hashCode()            → по h выбирается корзина
  2) в этой корзине перебираются элементы и сравниваются через equals
```

**Переопределили только `equals`.** Два равных по смыслу объекта получают разные хеши и попадают в разные корзины. Шаг 2 до нужного элемента просто не доходит:

```java
Set<Point> set = new HashSet<>();
set.add(new Point(1, 2));
set.contains(new Point(1, 2));   // false — хотя equals вернул бы true
set.add(new Point(1, 2));        // добавится «дубликат», size() == 2
```

**Переопределили только `hashCode`.** Объекты попадут в одну корзину, но `equals` по умолчанию сравнит ссылки и скажет «разные». Результат тот же.

**Изменили ключ после добавления.** Объект лежит в корзине, выбранной по старому хешу, а ищут его по новому:

```java
List<String> key = new ArrayList<>(List.of("a"));
Map<List<String>, Integer> map = new HashMap<>();
map.put(key, 1);
key.add("b");                    // хеш списка изменился
map.get(key);                    // null — запись «потерялась»
```

Отсюда правило: **ключи `HashMap` и элементы `HashSet` должны быть неизменяемыми**.

## `hashCode` всегда `return 1` — это законно?

Да, контракт не нарушен: равные объекты имеют равный хеш. Но все элементы окажутся в одной корзине, и поиск из O(1) превратится в перебор. Хороший хеш равномерно распределяет объекты.

## Что уже умеет делать это за вас

- `record Point(int x, int y) {}` — компилятор сам создаёт `equals`, `hashCode`, `toString` по всем компонентам.
- IDE и библиотека Lombok (`@EqualsAndHashCode`, `@Data`) генерируют методы.
- `Objects.equals(a, b)` безопасно сравнивает с учётом `null`; `Objects.hash(...)` считает хеш по набору полей.

@@ quiz
@@ q
В классе `Point` переопределён `equals` (сравнивает `x` и `y`), но не `hashCode`. Что выведет код?
```java
Set<Point> set = new HashSet<>();
set.add(new Point(1, 2));
set.add(new Point(1, 2));
System.out.println(set.size());
```
- [ ] `1`
- [x] `2` (практически всегда)
- [ ] `0`
- [ ] Исключение
@@ explain
`HashSet` сначала ищет корзину по `hashCode`. Без переопределения хеши двух объектов разные, они попадают в разные корзины, и до `equals` дело не доходит. Теоретически хеши могут случайно совпасть, но рассчитывать на это нельзя.

@@ q
Что выведет код?
```java
class Key {
    int id;
    Key(int id) { this.id = id; }
    public boolean equals(Key other) { return id == other.id; }
    @Override public int hashCode() { return id; }
}

List<Key> list = List.of(new Key(1));
System.out.println(list.contains(new Key(1)));
```
- [ ] `true`
- [x] `false`
- [ ] Ошибка компиляции
- [ ] `ClassCastException`
@@ explain
`equals(Key)` — перегрузка, а не переопределение: у `Object` метод принимает `Object`. Коллекции вызывают `equals(Object)`, то есть версию по умолчанию, сравнивающую ссылки. Поставьте `@Override` — и компилятор сразу укажет на ошибку.

@@ q
Два объекта имеют одинаковый `hashCode`. Что из этого следует?
- [ ] Объекты равны по `equals`
- [ ] Это один и тот же объект
- [x] Ничего: это может быть коллизия
- [ ] Контракт нарушен
@@ explain
Контракт требует равенства хешей у равных объектов, но не наоборот. Значений `int` конечное число, а объектов бесконечно много — коллизии неизбежны. Именно поэтому в корзине после сравнения хешей всё равно вызывается `equals`.

@@ q
Что выведет код?
```java
List<String> key = new ArrayList<>(List.of("a"));
Map<List<String>, String> map = new HashMap<>();
map.put(key, "значение");
key.add("b");
System.out.println(map.get(key));
```
- [ ] `значение`
- [x] `null`
- [ ] Исключение `ConcurrentModificationException`
- [ ] Ошибка компиляции
@@ explain
Хеш `ArrayList` зависит от содержимого. Запись лежит в корзине, выбранной по старому хешу, а `get` ищет по новому — в другой корзине. Запись осталась в мапе (`size()` равен 1), но найти её по ключу нельзя.

@@ q
Реализация `public int hashCode() { return 42; }` для всех объектов класса…
- [ ] Нарушает контракт `hashCode`
- [x] Корректна, но превращает поиск в хеш-коллекции в полный перебор
- [ ] Не скомпилируется
- [ ] Ускоряет работу `HashMap`
@@ explain
Контракт соблюдён: равные объекты имеют равный хеш. Но все объекты попадают в одну корзину, и хеш-таблица вырождается в список (в Java 8+ — в дерево, если ключи сравнимы).

@@ task money | equals и hashCode для Money | xp=40 interview
Класс `Money` хранит сумму в копейках и валюту. Сейчас два объекта с одинаковыми значениями считаются разными, а в логах класс выглядит как `Money@1b6d3586`. Переопределите:

- `equals` — объекты равны, если совпадают и сумма, и валюта;
- `hashCode` — согласованно с `equals`;
- `toString` — формат `"1500 RUB"` (сумма, пробел, валюта).
@@ hint
Сигнатура обязана быть `public boolean equals(Object o)`. Строки сравнивайте через `equals`, а не `==`.
@@ hint
`if (!(o instanceof Money m)) return false; return amount == m.amount && currency.equals(m.currency);` и `return Objects.hash(amount, currency);`.
@@ starter
class Money {
    private final long amount;
    private final String currency;

    Money(long amount, String currency) {
        this.amount = amount;
        this.currency = currency;
    }

    // переопределите equals, hashCode и toString
}

public class Main {
    public static void main(String[] args) {
        Money a = new Money(1500, "RUB");
        Money b = new Money(1500, "RUB");
        System.out.println(a.equals(b));
        System.out.println(a);
    }
}
@@ solution
import java.util.Objects;

class Money {
    private final long amount;
    private final String currency;

    Money(long amount, String currency) {
        this.amount = amount;
        this.currency = currency;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money m)) return false;
        return amount == m.amount && currency.equals(m.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount, currency);
    }

    @Override
    public String toString() {
        return amount + " " + currency;
    }
}

public class Main {
    public static void main(String[] args) {
        Money a = new Money(1500, "RUB");
        Money b = new Money(1500, "RUB");
        System.out.println(a.equals(b));
        System.out.println(a);
    }
}
@@ test
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class Checker {
    public static void main(String[] args) {
        T.test("равные объекты", () -> T.check(new Money(1500, "RUB").equals(new Money(1500, new String("RUB"))), "объекты с одинаковыми суммой и валютой должны быть равны"));
        T.test("разная сумма или валюта", () -> {
            T.check(!new Money(1500, "RUB").equals(new Money(1501, "RUB")), "разные суммы не равны");
            T.check(!new Money(1500, "RUB").equals(new Money(1500, "USD")), "разные валюты не равны");
        });
        T.test("сравнение с null и чужим типом", () -> {
            Object m = new Money(1, "RUB");
            T.check(!m.equals(null), "equals(null) должен вернуть false");
            T.check(!m.equals("1 RUB"), "Money не равен строке");
        });
        T.test("hashCode согласован с equals", () -> T.eq(new Money(1500, "RUB").hashCode(), new Money(1500, new String("RUB")).hashCode()));
        T.test("работает в HashSet и HashMap", () -> {
            Set<Money> set = new HashSet<>();
            set.add(new Money(10, "USD"));
            set.add(new Money(10, "USD"));
            T.eq(1, set.size());
            Map<Money, String> map = new HashMap<>();
            map.put(new Money(5, "EUR"), "кофе");
            T.eq("кофе", map.get(new Money(5, "EUR")));
        });
        T.test("toString", () -> T.eq("1500 RUB", new Money(1500, "RUB").toString()));
        T.done();
    }
}
