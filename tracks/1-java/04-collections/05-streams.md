---
id: j-streams
title: Stream API
summary: Декларативная обработка коллекций — фильтрация, преобразование, группировка.
xp: 30
---
## Что такое стрим

Stream — это **конвейер** обработки данных. Он не хранит элементы, а описывает, что с ними сделать.

```java
List<String> names = people.stream()                 // источник
        .filter(p -> p.age() >= 18)                  // промежуточные операции
        .map(Person::name)
        .sorted()
        .toList();                                   // терминальная операция
```

Три части: **источник** (`list.stream()`, `Stream.of(...)`, `IntStream.range(0, n)`, `Arrays.stream(arr)`), **промежуточные** операции (возвращают новый стрим) и одна **терминальная** (запускает вычисление и даёт результат).

## Ленивость

Промежуточные операции ничего не делают, пока не вызвана терминальная:

```java
Stream<String> s = Stream.of("a", "b").peek(x -> System.out.println("вижу " + x));
// пока ничего не напечатано
s.count();
```

Элементы идут по конвейеру **по одному**: первый проходит все стадии, затем второй. Поэтому `findFirst`, `anyMatch`, `limit` останавливают работу досрочно (short-circuit).

> **Ловушка.** Стрим одноразовый. Второй вызов терминальной операции у того же объекта бросит `IllegalStateException: stream has already been operated upon or closed`.

## Основные операции

| Промежуточные | Что делают |
|---|---|
| `filter(predicate)` | оставляет подходящие элементы |
| `map(function)` | преобразует каждый элемент |
| `flatMap(function)` | превращает элемент в стрим и «склеивает» результаты |
| `distinct()`, `sorted()`, `limit(n)`, `skip(n)` | уникальные, сортировка, первые n, пропустить n |
| `peek(consumer)` | подсмотреть (для отладки) |

| Терминальные | Что возвращают |
|---|---|
| `toList()`, `collect(...)` | коллекцию |
| `forEach(consumer)` | ничего |
| `count()`, `min(cmp)`, `max(cmp)` | число / `Optional` |
| `reduce(identity, op)` | свёртку в одно значение |
| `anyMatch`, `allMatch`, `noneMatch` | `boolean` |
| `findFirst()`, `findAny()` | `Optional` |

`map` против `flatMap`: `map` даёт один результат на элемент; `flatMap` — ноль или много, и раскрывает вложенность.

```java
List<List<Integer>> nested = List.of(List.of(1, 2), List.of(3));
nested.stream().flatMap(List::stream).toList();      // [1, 2, 3]
```

## Числовые стримы

`mapToInt`, `mapToLong`, `mapToDouble` дают примитивные стримы без упаковки, у которых есть `sum()`, `average()`, `max()`, `summaryStatistics()`:

```java
int total = orders.stream().mapToInt(Order::amount).sum();
double avg = orders.stream().mapToInt(Order::amount).average().orElse(0);
```

## Collectors

```java
import static java.util.stream.Collectors.*;

Map<String, List<Person>> byCity = people.stream().collect(groupingBy(Person::city));
Map<String, Long> countByCity   = people.stream().collect(groupingBy(Person::city, counting()));
Map<Boolean, List<Person>> adults = people.stream().collect(partitioningBy(p -> p.age() >= 18));
String joined = people.stream().map(Person::name).collect(joining(", "));
Map<Integer, String> byId = people.stream().collect(toMap(Person::id, Person::name));
```

> **Ловушка.** `toMap` бросает `IllegalStateException`, если встречаются одинаковые ключи. Передайте третьим аргументом функцию слияния: `toMap(Person::city, Person::name, (a, b) -> a + ", " + b)`.

`Stream.toList()` (Java 16+) возвращает **неизменяемый** список. Нужен изменяемый — `collect(Collectors.toCollection(ArrayList::new))`.

## Чего в стримах делать нельзя

- **Менять внешнее состояние** в лямбдах: `stream.forEach(x -> list.add(x))` — анти-паттерн; используйте `collect`.
- **Менять источник** во время обработки.
- **Бездумно включать `parallelStream()`**. Он использует общий пул потоков на всё приложение, выигрывает только на больших объёмах чисто вычислительной работы и ломает код с общим изменяемым состоянием. В веб-сервисах почти всегда вреден.

@@ quiz
@@ q
Что напечатает код?
```java
Stream.of("a", "b", "c")
      .filter(s -> { System.out.print(s); return true; })
      .map(String::toUpperCase);
```
- [ ] `abc`
- [ ] `ABC`
- [x] Ничего
- [ ] Ошибку компиляции
@@ explain
Терминальной операции нет, поэтому конвейер не запускается и `filter` ни разу не вызывается. Стримы ленивы.

@@ q
Что напечатает код?
```java
Stream.of(1, 2, 3, 4)
      .peek(x -> System.out.print(x))
      .filter(x -> x % 2 == 0)
      .findFirst();
```
- [ ] `1234`
- [x] `12`
- [ ] `2`
- [ ] `24`
@@ explain
Элементы идут по конвейеру по одному. Единица доходит до `filter` и отбрасывается, двойка проходит — `findFirst` получил результат и останавливает обработку. Тройка и четвёрка не затрагиваются.

@@ q
Что произойдёт?
```java
Stream<String> s = Stream.of("a", "b");
s.forEach(System.out::println);
long n = s.count();
```
- [ ] `n` будет равно 2
- [ ] `n` будет равно 0
- [x] `IllegalStateException`
- [ ] Ошибка компиляции
@@ explain
Стрим нельзя использовать повторно: после терминальной операции он закрыт. Нужно создать новый стрим от источника.

@@ q
Что произойдёт?
```java
List<String> words = List.of("кот", "кит", "дом");
Map<Character, String> map = words.stream()
        .collect(Collectors.toMap(w -> w.charAt(0), w -> w));
```
- [ ] В мапе останется `к → кит`
- [ ] В мапе останется `к → кот`
- [x] `IllegalStateException`: повторяющийся ключ
- [ ] Ошибка компиляции
@@ explain
Двухаргументный `toMap` не знает, как объединять значения с одинаковым ключом, и бросает исключение. Нужна функция слияния третьим аргументом либо `groupingBy`.

@@ q
Чем `map` отличается от `flatMap`?
- [ ] `flatMap` работает быстрее
- [x] `map` даёт один результат на элемент, `flatMap` превращает элемент в стрим и объединяет все результаты в один плоский стрим
- [ ] `flatMap` — терминальная операция
- [ ] `map` нельзя применять к спискам
@@ explain
`Stream<List<T>>` после `map(List::stream)` станет `Stream<Stream<T>>`, а после `flatMap(List::stream)` — `Stream<T>`.

@@ task orders-report | Отчёт по заказам | xp=45 interview
Дан `record Order(String customer, String category, int amount)`. Реализуйте три метода с помощью Stream API:

- `Main.totalByCustomer(List<Order> orders)` — `Map<String, Integer>`: суммарная сумма заказов каждого покупателя;
- `Main.topCategories(List<Order> orders, int n)` — список из `n` категорий с наибольшей суммарной выручкой, по убыванию выручки (при равной выручке — по названию по алфавиту);
- `Main.bigSpenders(List<Order> orders, int min)` — отсортированный по алфавиту список покупателей, у которых суммарная сумма заказов **не меньше** `min`.
@@ hint
Сумма по группе: `Collectors.groupingBy(Order::customer, Collectors.summingInt(Order::amount))`.
@@ hint
Для топа пройдитесь стримом по `entrySet()` полученной мапы: `sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))`, затем `limit(n)` и `map(Map.Entry::getKey)`.
@@ starter
import java.util.HashMap;
import java.util.List;
import java.util.Map;

record Order(String customer, String category, int amount) { }

public class Main {
    static Map<String, Integer> totalByCustomer(List<Order> orders) {
        return new HashMap<>();
    }

    static List<String> topCategories(List<Order> orders, int n) {
        return List.of();
    }

    static List<String> bigSpenders(List<Order> orders, int min) {
        return List.of();
    }

    public static void main(String[] args) {
        List<Order> orders = List.of(new Order("Анна", "книги", 500), new Order("Анна", "еда", 300));
        System.out.println(totalByCustomer(orders));
    }
}
@@ solution
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

record Order(String customer, String category, int amount) { }

public class Main {
    static Map<String, Integer> totalByCustomer(List<Order> orders) {
        return orders.stream().collect(Collectors.groupingBy(Order::customer, Collectors.summingInt(Order::amount)));
    }

    static List<String> topCategories(List<Order> orders, int n) {
        Map<String, Integer> byCategory = orders.stream()
                .collect(Collectors.groupingBy(Order::category, Collectors.summingInt(Order::amount)));
        return byCategory.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(n)
                .map(Map.Entry::getKey)
                .toList();
    }

    static List<String> bigSpenders(List<Order> orders, int min) {
        return totalByCustomer(orders).entrySet().stream()
                .filter(e -> e.getValue() >= min)
                .map(Map.Entry::getKey)
                .sorted()
                .toList();
    }

    public static void main(String[] args) {
        List<Order> orders = List.of(new Order("Анна", "книги", 500), new Order("Анна", "еда", 300));
        System.out.println(totalByCustomer(orders));
        System.out.println(topCategories(orders, 1));
    }
}
@@ test
import java.util.List;
import java.util.Map;

public class Checker {
    static final List<Order> ORDERS = List.of(
        new Order("Анна", "книги", 500), new Order("Борис", "техника", 9000), new Order("Анна", "еда", 300),
        new Order("Вера", "еда", 700), new Order("Борис", "книги", 500), new Order("Вера", "одежда", 1000));

    public static void main(String[] args) {
        T.test("сумма по покупателям", () -> T.eq(Map.of("Анна", 800, "Борис", 9500, "Вера", 1700), Main.totalByCustomer(ORDERS)));
        T.test("топ-2 категорий", () -> T.eq(List.of("техника", "еда"), Main.topCategories(ORDERS, 2)));
        T.test("при равной выручке — по алфавиту", () -> T.eq(List.of("техника", "еда", "книги", "одежда"), Main.topCategories(ORDERS, 10)));
        T.test("крупные покупатели", () -> T.eq(List.of("Борис", "Вера"), Main.bigSpenders(ORDERS, 1700)));
        T.test("пустой список заказов", () -> { T.eq(Map.of(), Main.totalByCustomer(List.of())); T.eq(List.of(), Main.topCategories(List.of(), 3)); T.eq(List.of(), Main.bigSpenders(List.of(), 0)); });
        T.done();
    }
}

@@ task anagrams | Группировка анаграмм | xp=45 interview
Реализуйте `Main.groupAnagrams(List<String> words)`: сгруппируйте слова, составленные из одних и тех же букв. Верните список групп, где:

- слова внутри группы отсортированы по алфавиту;
- группы отсортированы по своему первому слову.

Пример: `[кот, ток, сон, нос, окт, дом]` → `[[дом], [кот, окт, ток], [нос, сон]]`.
@@ hint
У анаграмм совпадает «подпись» — буквы слова в отсортированном порядке. Получить её: `char[] c = w.toCharArray(); Arrays.sort(c); String key = new String(c);`.
@@ hint
`words.stream().collect(Collectors.groupingBy(Main::key))` даёт `Map<String, List<String>>`. Затем возьмите `values()`, отсортируйте каждую группу и сами группы: `sorted(Comparator.comparing(g -> g.get(0)))`.
@@ starter
import java.util.List;

public class Main {
    static List<List<String>> groupAnagrams(List<String> words) {
        return List.of();
    }

    public static void main(String[] args) {
        System.out.println(groupAnagrams(List.of("кот", "ток", "сон", "нос", "окт", "дом")));
    }
}
@@ solution
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public class Main {
    static String key(String w) {
        char[] c = w.toCharArray();
        Arrays.sort(c);
        return new String(c);
    }

    static List<List<String>> groupAnagrams(List<String> words) {
        return words.stream()
                .collect(Collectors.groupingBy(Main::key))
                .values().stream()
                .map(g -> g.stream().sorted().toList())
                .sorted(Comparator.comparing(g -> g.get(0)))
                .toList();
    }

    public static void main(String[] args) {
        System.out.println(groupAnagrams(List.of("кот", "ток", "сон", "нос", "окт", "дом")));
    }
}
@@ test
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("пример из условия", () -> T.eq(List.of(List.of("дом"), List.of("кот", "окт", "ток"), List.of("нос", "сон")), Main.groupAnagrams(List.of("кот", "ток", "сон", "нос", "окт", "дом"))));
        T.test("нет анаграмм", () -> T.eq(List.of(List.of("a"), List.of("b")), Main.groupAnagrams(List.of("b", "a"))));
        T.test("повторяющиеся слова остаются", () -> T.eq(List.of(List.of("ab", "ab", "ba")), Main.groupAnagrams(List.of("ba", "ab", "ab"))));
        T.test("пустой список", () -> T.eq(List.of(), Main.groupAnagrams(List.of())));
        T.done();
    }
}
