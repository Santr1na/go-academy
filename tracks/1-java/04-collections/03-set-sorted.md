---
id: j-set-sorted
title: Set, TreeMap и сравнение объектов
summary: Три вида множеств и мап, Comparable и Comparator.
xp: 25
---
## Set — коллекция без дубликатов

```java
Set<String> tags = new HashSet<>();
tags.add("java");            // true — добавлен
tags.add("java");            // false — уже есть
tags.contains("java");       // O(1)
```

`HashSet` внутри — это `HashMap`, где элементы хранятся как ключи. Поэтому всё сказанное про `hashCode`/`equals` относится и к нему.

## Три реализации — три порядка

| Множество / мапа | Порядок обхода | Основа | Сложность |
|---|---|---|---|
| `HashSet` / `HashMap` | не определён | хеш-таблица | O(1) |
| `LinkedHashSet` / `LinkedHashMap` | порядок вставки | хеш-таблица + связный список | O(1) |
| `TreeSet` / `TreeMap` | по возрастанию ключей | красно-чёрное дерево | O(log n) |

```java
Set<Integer> a = new HashSet<>(List.of(30, 10, 20));        // порядок не гарантирован
Set<Integer> b = new LinkedHashSet<>(List.of(30, 10, 20));  // [30, 10, 20]
Set<Integer> c = new TreeSet<>(List.of(30, 10, 20));        // [10, 20, 30]
```

`TreeMap` и `TreeSet` умеют больше, чем просто сортировать:

```java
TreeMap<Integer, String> grades = new TreeMap<>();
grades.put(50, "E"); grades.put(70, "C"); grades.put(90, "A");

grades.firstKey();          // 50
grades.floorKey(85);        // 70 — наибольший ключ ≤ 85
grades.ceilingKey(85);      // 90 — наименьший ключ ≥ 85
grades.headMap(70);         // ключи строго меньше 70
grades.descendingMap();     // в обратном порядке
```

`LinkedHashMap` с параметром `accessOrder = true` переставляет запись в конец при каждом обращении — на этом строят LRU-кеш (сделаем в модуле «Практика»).

## Comparable — естественный порядок

Чтобы объекты можно было сортировать или класть в `TreeSet`, класс реализует `Comparable<T>`:

```java
record Version(int major, int minor) implements Comparable<Version> {
    @Override
    public int compareTo(Version o) {
        int c = Integer.compare(major, o.major);
        return c != 0 ? c : Integer.compare(minor, o.minor);
    }
}
```

Результат: отрицательное число — `this` меньше, ноль — равны, положительное — больше.

> **Ловушка.** Не пишите `return this.x - o.x;` — при больших значениях разных знаков вычитание переполняется, и порядок получается неверным. Используйте `Integer.compare(a, b)`.

## Comparator — порядок снаружи

Когда порядков несколько или класс менять нельзя, порядок задают отдельным объектом:

```java
Comparator<Person> byAge = Comparator.comparingInt(Person::age);

people.sort(byAge);
people.sort(byAge.reversed());
people.sort(Comparator.comparing(Person::city).thenComparing(Person::name));
people.sort(Comparator.comparing(Person::email, Comparator.nullsLast(Comparator.naturalOrder())));

Set<String> byLength = new TreeSet<>(Comparator.comparingInt(String::length));
```

## Ловушка: TreeSet не использует equals

`TreeSet` и `TreeMap` считают элементы одинаковыми, когда сравнение возвращает **0**, — `equals` и `hashCode` они не вызывают вообще.

```java
Set<String> set = new TreeSet<>(Comparator.comparingInt(String::length));
set.add("кот");
set.add("пёс");            // длина тоже 3 → compare вернул 0 → «дубликат», не добавлен
System.out.println(set);   // [кот]
```

Если такое поведение не нужно, добавьте в компаратор второй ключ: `.thenComparing(Comparator.naturalOrder())`. Ещё одно следствие: в `TreeSet` с естественным порядком нельзя положить `null` — у него нельзя вызвать `compareTo`.

@@ quiz
@@ q
Что выведет код?
```java
Set<String> set = new TreeSet<>(Comparator.comparingInt(String::length));
set.add("one");
set.add("two");
set.add("three");
System.out.println(set.size());
```
- [ ] `3`
- [x] `2`
- [ ] `1`
- [ ] Исключение
@@ explain
`TreeSet` определяет дубликаты по компаратору. У `"one"` и `"two"` одинаковая длина, сравнение даёт 0, и второй элемент считается уже существующим.

@@ q
Какая коллекция сохраняет порядок вставки элементов?
- [ ] `HashSet`
- [x] `LinkedHashSet`
- [ ] `TreeSet`
- [ ] Никакая из перечисленных
@@ explain
`LinkedHashSet` дополнительно связывает элементы в список в порядке добавления. `HashSet` порядок не гарантирует, `TreeSet` сортирует.

@@ q
Почему компаратор `(a, b) -> a - b` для `int` считается ошибочным?
- [ ] Он сортирует по убыванию
- [ ] Лямбды нельзя использовать как компараторы
- [x] Вычитание может переполниться, и знак результата окажется неверным
- [ ] Он не возвращает 0 для равных чисел
@@ explain
Например, `Integer.MIN_VALUE - 1` переполняется и даёт положительное число, хотя первое значение меньше. `Integer.compare(a, b)` этого лишён.

@@ q
Какова сложность `contains` у `TreeSet`?
- [ ] O(1)
- [x] O(log n)
- [ ] O(n)
- [ ] O(n log n)
@@ explain
`TreeSet` построен на сбалансированном дереве поиска: высота дерева — логарифм числа элементов. O(1) в среднем даёт `HashSet`.

@@ task sort-people | Сортировка по нескольким полям | xp=35 interview
Дан `record Person(String name, int age, String city)`. Реализуйте `Main.sorted(List<Person> people)`: метод возвращает **новый** список, отсортированный так:

1. по городу в алфавитном порядке;
2. внутри города — по возрасту **от старших к младшим**;
3. при равном возрасте — по имени по алфавиту.

Исходный список менять нельзя (он может быть неизменяемым).
@@ hint
Сделайте копию: `List<Person> copy = new ArrayList<>(people);` и вызовите `copy.sort(...)`.
@@ hint
`Comparator.comparing(Person::city).thenComparing(Person::age, Comparator.reverseOrder()).thenComparing(Person::name)`. Осторожно с `reversed()`: он переворачивает **весь** построенный к этому моменту компаратор, включая сортировку по городу.
@@ starter
import java.util.ArrayList;
import java.util.List;

record Person(String name, int age, String city) { }

public class Main {
    static List<Person> sorted(List<Person> people) {
        return people;
    }

    public static void main(String[] args) {
        System.out.println(sorted(List.of(new Person("Вера", 30, "Казань"), new Person("Анна", 25, "Казань"))));
    }
}
@@ solution
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

record Person(String name, int age, String city) { }

public class Main {
    static List<Person> sorted(List<Person> people) {
        List<Person> copy = new ArrayList<>(people);
        copy.sort(Comparator.comparing(Person::city)
                .thenComparing(Person::age, Comparator.reverseOrder())
                .thenComparing(Person::name));
        return copy;
    }

    public static void main(String[] args) {
        System.out.println(sorted(List.of(new Person("Вера", 30, "Казань"), new Person("Анна", 25, "Казань"))));
    }
}
@@ test
import java.util.List;

public class Checker {
    static String names(List<Person> l) { StringBuilder sb = new StringBuilder(); for (Person p : l) sb.append(p.name()).append(' '); return sb.toString().trim(); }

    public static void main(String[] args) {
        List<Person> src = List.of(
            new Person("Глеб", 40, "Москва"), new Person("Анна", 25, "Казань"), new Person("Вера", 30, "Казань"),
            new Person("Борис", 30, "Казань"), new Person("Дина", 50, "Москва"), new Person("Ева", 20, "Абакан"));
        T.test("город → возраст по убыванию → имя", () -> T.eq("Ева Борис Вера Анна Дина Глеб", names(Main.sorted(src))));
        T.test("исходный список не меняется", () -> { Main.sorted(src); T.eq("Глеб", src.get(0).name()); });
        T.test("возвращается новый список", () -> T.check(Main.sorted(src) != src, "нужно вернуть копию"));
        T.test("пустой список", () -> T.eq(0, Main.sorted(List.of()).size()));
        T.done();
    }
}
