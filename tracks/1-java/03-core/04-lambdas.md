---
id: j-lambdas
title: Лямбды и функциональные интерфейсы
summary: Функции как значения, ссылки на методы, вложенные классы и замыкания.
xp: 30
---
## От анонимного класса к лямбде

Часто в метод нужно передать не данные, а **поведение**: как сравнивать, что делать по клику, какое условие проверять. До Java 8 для этого создавали анонимный класс:

```java
Comparator<String> byLength = new Comparator<String>() {
    @Override
    public int compare(String a, String b) {
        return Integer.compare(a.length(), b.length());
    }
};
```

Лямбда — та же самая мысль без церемоний:

```java
Comparator<String> byLength = (a, b) -> Integer.compare(a.length(), b.length());
```

Синтаксис: `(параметры) -> выражение` или `(параметры) -> { несколько команд; return результат; }`. Типы параметров компилятор выводит сам; скобки вокруг единственного параметра можно опустить: `x -> x * 2`.

## Функциональный интерфейс

Лямбду можно записать только туда, где ожидается **функциональный интерфейс** — интерфейс с ровно одним абстрактным методом (`default` и `static` не считаются). Аннотация `@FunctionalInterface` просит компилятор это проверить.

Стандартные интерфейсы из `java.util.function` нужно знать наизусть:

| Интерфейс | Метод | Смысл | Пример |
|---|---|---|---|
| `Function<T, R>` | `R apply(T t)` | преобразование | `s -> s.length()` |
| `Predicate<T>` | `boolean test(T t)` | условие | `s -> s.isEmpty()` |
| `Consumer<T>` | `void accept(T t)` | действие без результата | `s -> System.out.println(s)` |
| `Supplier<T>` | `T get()` | поставщик значения | `() -> new ArrayList<>()` |
| `BiFunction<T, U, R>` | `R apply(T t, U u)` | функция двух аргументов | `(a, b) -> a + b` |
| `UnaryOperator<T>` | `T apply(T t)` | `Function<T, T>` | `s -> s.trim()` |
| `Runnable` | `void run()` | действие без аргументов | `() -> doWork()` |

Функции можно комбинировать: `f.andThen(g)`, `f.compose(g)`, `p.and(q)`, `p.negate()`.

## Ссылки на методы

Если лямбда только вызывает готовый метод, её можно заменить ссылкой:

```java
s -> s.toUpperCase()          →  String::toUpperCase     // метод параметра
x -> System.out.println(x)    →  System.out::println     // метод конкретного объекта
s -> Integer.parseInt(s)      →  Integer::parseInt       // статический метод
() -> new ArrayList<>()       →  ArrayList::new          // конструктор
```

## Замыкания и effectively final

Лямбда может использовать локальные переменные окружающего метода, но только если они **не меняются** после инициализации (effectively final):

```java
int factor = 3;
Function<Integer, Integer> mul = x -> x * factor;   // ок
// factor = 4;                                      // эта строка сломала бы компиляцию
```

Причина: лямбда запоминает **копию значения** переменной. Если бы переменную можно было менять, копия и оригинал разошлись бы. Поля объекта и элементы массива менять можно — копируется ссылка, а не сам объект (отсюда трюк с `int[] counter = {0}`; в многопоточном коде он опасен).

## Лямбда — не анонимный класс

Внутри анонимного класса `this` — это сам анонимный объект. Внутри лямбды `this` — объект **окружающего** класса: лямбда не создаёт новую область видимости.

## Вложенные классы

| Вид | Объявление | Ссылка на внешний объект |
|---|---|---|
| Статический вложенный | `static class Node` внутри класса | нет |
| Внутренний (inner) | `class Iter` внутри класса | **есть**, неявная |
| Локальный | класс внутри метода | есть |
| Анонимный | `new Runnable() { ... }` | есть |

> **Ловушка.** Нестатический внутренний класс неявно хранит ссылку на внешний объект. Пока жив внутренний объект, сборщик мусора не удалит и внешний — классическая причина утечек памяти. Если доступ к полям внешнего объекта не нужен, объявляйте вложенный класс `static` (так сделаны `HashMap.Node` и узлы `LinkedList`).

@@ quiz
@@ q
Скомпилируется ли код?
```java
int count = 0;
Runnable r = () -> count++;
```
- [ ] Да
- [x] Нет: локальная переменная, используемая в лямбде, должна быть effectively final
- [ ] Нет: `Runnable` не может использовать переменные
- [ ] Да, но `count` останется 0
@@ explain
Лямбда захватывает копию значения локальной переменной, поэтому менять переменную нельзя ни внутри лямбды, ни снаружи. Для счётчика используют поле объекта или `AtomicInteger`.

@@ q
Какой из интерфейсов является функциональным?
```java
interface A { void run(); void stop(); }
interface B { void run(); default void stop() { } }
interface C { }
```
- [ ] `A`
- [x] `B`
- [ ] `C`
- [ ] Все три
@@ explain
Функциональный интерфейс содержит ровно один **абстрактный** метод. У `A` их два, у `C` — ни одного. `default`-методы не считаются.

@@ q
Какой стандартный интерфейс подходит для лямбды `s -> s.length() > 5`?
- [ ] `Function<String, Integer>`
- [ ] `Consumer<String>`
- [x] `Predicate<String>`
- [ ] `Supplier<Boolean>`
@@ explain
Лямбда принимает значение и возвращает `boolean` — это условие, `Predicate<T>` с методом `test`. Формально подошёл бы и `Function<String, Boolean>`, но для условий принят `Predicate`: с ним работают `filter`, `removeIf`, `and`/`or`/`negate`.

@@ q
Почему вложенный класс `Node` в реализации связного списка объявляют `static`?
- [ ] Чтобы у всех узлов были общие поля
- [ ] Иначе он не скомпилируется
- [x] Нестатический внутренний класс хранит скрытую ссылку на внешний объект — это лишняя память и риск утечки
- [ ] Статические классы работают быстрее в многопоточном коде
@@ explain
`static` у вложенного класса означает только «не привязан к экземпляру внешнего класса». Поля у каждого узла свои. Без `static` каждый узел хранил бы ещё одну ссылку — на список.

@@ task compose | Конвейер функций | xp=40
Реализуйте три метода:

- `Main.filter(List<T> list, Predicate<T> p)` — новый список из элементов, для которых условие истинно (исходный список не меняется);
- `Main.mapAll(List<T> list, Function<T, R> f)` — новый список из результатов применения функции;
- `Main.pipeline(List<Function<Integer, Integer>> steps)` — возвращает **одну** функцию, которая применяет все шаги по порядку. Для пустого списка шагов функция возвращает аргумент без изменений.

Stream API не используйте — напишите циклы сами.
@@ hint
Обобщённый метод объявляется так: `static <T> List<T> filter(List<T> list, Predicate<T> p)`; условие проверяется вызовом `p.test(x)`, функция применяется через `f.apply(x)`.
@@ hint
В `pipeline` начните с `Function<Integer, Integer> result = x -> x;` и в цикле делайте `result = result.andThen(step);`.
@@ starter
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

public class Main {
    static <T> List<T> filter(List<T> list, Predicate<T> p) {
        return list;
    }

    static <T, R> List<R> mapAll(List<T> list, Function<T, R> f) {
        return new ArrayList<>();
    }

    static Function<Integer, Integer> pipeline(List<Function<Integer, Integer>> steps) {
        return x -> x;
    }

    public static void main(String[] args) {
        System.out.println(filter(List.of(1, 2, 3, 4), x -> x % 2 == 0));
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Predicate;

public class Main {
    static <T> List<T> filter(List<T> list, Predicate<T> p) {
        List<T> out = new ArrayList<>();
        for (T x : list) {
            if (p.test(x)) out.add(x);
        }
        return out;
    }

    static <T, R> List<R> mapAll(List<T> list, Function<T, R> f) {
        List<R> out = new ArrayList<>();
        for (T x : list) out.add(f.apply(x));
        return out;
    }

    static Function<Integer, Integer> pipeline(List<Function<Integer, Integer>> steps) {
        Function<Integer, Integer> result = x -> x;
        for (Function<Integer, Integer> step : steps) result = result.andThen(step);
        return result;
    }

    public static void main(String[] args) {
        System.out.println(filter(List.of(1, 2, 3, 4), x -> x % 2 == 0));
        System.out.println(mapAll(List.of("a", "bb"), String::length));
        System.out.println(pipeline(List.of(x -> x + 1, x -> x * 10)).apply(2));
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

public class Checker {
    public static void main(String[] args) {
        T.test("filter", () -> T.eq(List.of(2, 4), Main.filter(List.of(1, 2, 3, 4), x -> x % 2 == 0)));
        T.test("filter не меняет исходный список", () -> { List<String> src = new ArrayList<>(List.of("a", "", "b")); List<String> r = Main.filter(src, s -> !s.isEmpty()); T.eq(3, src.size()); T.eq(List.of("a", "b"), r); });
        T.test("mapAll", () -> { List<Integer> r = Main.mapAll(List.of("a", "bb", "ccc"), String::length); T.eq(List.of(1, 2, 3), r); });
        T.test("pipeline применяет шаги по порядку", () -> { List<Function<Integer, Integer>> steps = List.of(x -> x + 1, x -> x * 10); T.eq(30, Main.pipeline(steps).apply(2)); });
        T.test("пустой pipeline", () -> T.eq(7, Main.pipeline(List.of()).apply(7)));
        T.done();
    }
}
