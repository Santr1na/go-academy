---
id: j-generics
title: Generics
summary: Параметры типов, wildcard-ы, правило PECS и стирание типов.
xp: 30
---
## Зачем нужны generics

До Java 5 коллекции хранили `Object`, и ошибка типа обнаруживалась только при выполнении:

```java
List list = new ArrayList();           // «сырой» тип
list.add("строка");
Integer n = (Integer) list.get(0);     // ClassCastException во время работы программы
```

Generics переносят проверку на этап **компиляции**:

```java
List<String> list = new ArrayList<>();
list.add("строка");
// list.add(42);                        // ошибка компиляции
String s = list.get(0);                 // приведение не нужно
```

## Свои обобщённые классы и методы

```java
class Box<T> {                          // T — параметр типа
    private T value;
    Box(T value) { this.value = value; }
    T get() { return value; }
}

Box<String> b = new Box<>("привет");    // <> — «ромб», тип выводится сам

static <T> T first(List<T> list) {      // обобщённый метод: <T> перед типом результата
    return list.get(0);
}
```

**Ограничение сверху** позволяет вызывать методы у `T`:

```java
static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}
```

Примитивы подставлять нельзя: `List<int>` не существует, только `List<Integer>`.

## Инвариантность: главная неожиданность

`Integer` — наследник `Number`, но `List<Integer>` **не** является `List<Number>`.

```java
List<Integer> ints = new ArrayList<>();
List<Number> nums = ints;               // ошибка компиляции — и вот почему:
nums.add(3.14);                         // иначе в список Integer попал бы Double
```

С массивами в Java это разрешено (`Number[] a = new Integer[1];`), и расплата приходит во время выполнения — `ArrayStoreException`. Generics этой дыры не повторяют.

## Wildcard-ы и правило PECS

Чтобы метод принимал «список чего-то числового», используют подстановочные символы:

```java
static double sum(List<? extends Number> list) {     // можно ЧИТАТЬ как Number
    double s = 0;
    for (Number n : list) s += n.doubleValue();
    return s;
}

static void fill(List<? super Integer> list) {       // можно ПИСАТЬ Integer
    list.add(1);
    list.add(2);
}
```

- `List<? extends Number>` — список какого-то подтипа `Number`. Читать элементы можно, добавлять нельзя (кроме `null`): компилятор не знает, `List<Integer>` это или `List<Double>`.
- `List<? super Integer>` — список `Integer` или его предка. Добавлять `Integer` можно, а при чтении получите только `Object`.

Правило **PECS**: *Producer — Extends, Consumer — Super*. Если коллекция только **отдаёт** вам элементы — `extends`; если только **принимает** — `super`. Пример из JDK: `Collections.copy(List<? super T> dest, List<? extends T> src)`.

## Стирание типов (type erasure)

Generics существуют только для компилятора. В байт-коде параметры типа **стираются**: `List<String>` и `List<Integer>` — один и тот же класс `ArrayList`.

```java
List<String> a = new ArrayList<>();
List<Integer> b = new ArrayList<>();
System.out.println(a.getClass() == b.getClass());   // true
```

Следствия:

- нельзя `new T()`, `new T[10]`, `T.class`;
- нельзя `if (list instanceof List<String>)` — только `List<?>`;
- нельзя перегрузить методы `void f(List<String> x)` и `void f(List<Integer> x)` — после стирания у них одинаковая сигнатура;
- статическое поле не может иметь тип `T`.

> **На собеседовании.** «Что такое стирание типов?» и «В чём разница между `List<?>`, `List<Object>` и `List`?» — `List<?>` принимает список любого типа, но добавлять в него нельзя; `List<Object>` — только список именно `Object`; сырой `List` отключает проверки типов и существует ради совместимости.

@@ quiz
@@ q
Скомпилируется ли код?
```java
List<Integer> ints = new ArrayList<>();
List<Number> nums = ints;
```
- [ ] Да: `Integer` — наследник `Number`
- [x] Нет: `List<Integer>` не является подтипом `List<Number>`
- [ ] Да, но с предупреждением
- [ ] Нет: `Number` — абстрактный класс
@@ explain
Generics инвариантны. Иначе через `nums` можно было бы добавить `Double` в список, который объявлен как `List<Integer>`. Чтобы принять список любых чисел, пишут `List<? extends Number>`.

@@ q
Что выведет код?
```java
List<String> a = new ArrayList<>();
List<Integer> b = new ArrayList<>();
System.out.println(a.getClass() == b.getClass());
```
- [x] `true`
- [ ] `false`
- [ ] Ошибка компиляции
- [ ] `ClassCastException`
@@ explain
Из-за стирания типов во время выполнения параметров типа нет: оба объекта — просто `ArrayList`.

@@ q
Какая строка не скомпилируется?
```java
List<? extends Number> list = new ArrayList<Integer>();
Number n = list.get(0);     // строка 1
list.add(Integer.valueOf(1)); // строка 2
list.add(null);             // строка 3
```
- [ ] Строка 1
- [x] Строка 2
- [ ] Строка 3
- [ ] Все компилируются
@@ explain
`? extends Number` означает «какой-то неизвестный подтип». Читать как `Number` безопасно, а добавлять нельзя: компилятор не знает, не `List<Double>` ли это. Единственное, что можно добавить, — `null`.

@@ q
Параметр метода только **читается**: метод перебирает элементы и суммирует их. Какой тип параметра выбрать по правилу PECS?
- [x] `List<? extends Number>`
- [ ] `List<? super Number>`
- [ ] `List<Number>`
- [ ] `List<Object>`
@@ explain
Коллекция здесь — производитель (producer) значений: Producer — Extends. Такой метод примет и `List<Integer>`, и `List<Double>`. `List<Number>` принял бы только список, объявленный именно как `List<Number>`.

@@ task pair | Обобщённая пара | xp=35
Создайте обобщённый класс `Pair<A, B>`:

- конструктор `Pair(A first, B second)`;
- методы `A first()` и `B second()`;
- метод `Pair<B, A> swap()`, который возвращает новую пару с переставленными элементами.

И обобщённый статический метод `Main.max`, который принимает два значения одного типа, реализующего `Comparable`, и возвращает большее (при равенстве — первое).
@@ hint
Объявление класса: `class Pair<A, B> { private final A first; private final B second; ... }`.
@@ hint
`static <T extends Comparable<T>> T max(T a, T b) { return a.compareTo(b) >= 0 ? a : b; }`
@@ starter
// объявите класс Pair<A, B>

public class Main {
    // объявите обобщённый метод max

    public static void main(String[] args) {
        // Pair<String, Integer> p = new Pair<>("возраст", 30);
        // System.out.println(p.swap().first() + " " + max("b", "a"));
    }
}
@@ solution
class Pair<A, B> {
    private final A first;
    private final B second;

    Pair(A first, B second) {
        this.first = first;
        this.second = second;
    }

    A first() { return first; }

    B second() { return second; }

    Pair<B, A> swap() { return new Pair<>(second, first); }
}

public class Main {
    static <T extends Comparable<T>> T max(T a, T b) {
        return a.compareTo(b) >= 0 ? a : b;
    }

    public static void main(String[] args) {
        Pair<String, Integer> p = new Pair<>("возраст", 30);
        System.out.println(p.swap().first() + " " + max("b", "a"));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("first и second", () -> { Pair<String, Integer> p = new Pair<>("a", 1); String f = p.first(); Integer s = p.second(); T.eq("a", f); T.eq(1, s); });
        T.test("swap", () -> { Pair<Integer, String> p = new Pair<>("a", 1).swap(); Integer f = p.first(); String s = p.second(); T.eq(1, f); T.eq("a", s); });
        T.test("swap не меняет исходную пару", () -> { Pair<String, Integer> p = new Pair<>("a", 1); p.swap(); T.eq("a", p.first()); });
        T.test("max для чисел и строк", () -> { T.eq(7, Main.max(3, 7)); T.eq("груша", Main.max("груша", "ананас")); T.eq(2.5, Main.max(2.5, -1.0)); });
        T.done();
    }
}

@@ task sum-all | PECS на практике | xp=40 interview
Реализуйте два метода с правильными wildcard-ами:

- `Main.sum(...)` принимает список **любых чисел** (`List<Integer>`, `List<Double>`, `List<Long>`…) и возвращает их сумму как `double`;
- `Main.addRange(...)` принимает список, в который можно положить `Integer` (`List<Integer>`, `List<Number>`, `List<Object>`), и добавляет в него числа от `from` до `to` включительно.

Сигнатуры в заготовке слишком узкие — тесты с `List<Double>` и `List<Number>` не скомпилируются, пока вы их не исправите.
@@ hint
Из списка в `sum` мы только читаем — это producer: `List<? extends Number>`.
@@ hint
В список в `addRange` мы только пишем — это consumer: `List<? super Integer>`.
@@ starter
import java.util.ArrayList;
import java.util.List;

public class Main {
    static double sum(List<Number> list) {
        double s = 0;
        for (Number n : list) s += n.doubleValue();
        return s;
    }

    static void addRange(List<Integer> list, int from, int to) {
        for (int i = from; i <= to; i++) list.add(i);
    }

    public static void main(String[] args) {
        List<Integer> ints = new ArrayList<>();
        addRange(ints, 1, 3);
        System.out.println(ints);
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;

public class Main {
    static double sum(List<? extends Number> list) {
        double s = 0;
        for (Number n : list) s += n.doubleValue();
        return s;
    }

    static void addRange(List<? super Integer> list, int from, int to) {
        for (int i = from; i <= to; i++) list.add(i);
    }

    public static void main(String[] args) {
        List<Integer> ints = new ArrayList<>();
        addRange(ints, 1, 3);
        System.out.println(ints + " " + sum(ints));
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("sum для List<Integer>", () -> T.eq(6.0, Main.sum(List.of(1, 2, 3))));
        T.test("sum для List<Double> и List<Long>", () -> { List<Double> d = List.of(1.5, 2.5); List<Long> l = List.of(10L, 20L); T.eq(4.0, Main.sum(d)); T.eq(30.0, Main.sum(l)); });
        T.test("addRange в List<Integer>", () -> { List<Integer> a = new ArrayList<>(); Main.addRange(a, 1, 3); T.eq(List.of(1, 2, 3), a); });
        T.test("addRange в List<Number> и List<Object>", () -> {
            List<Number> n = new ArrayList<>(); n.add(0.5); Main.addRange(n, 5, 6); T.eq(3, n.size());
            List<Object> o = new ArrayList<>(); Main.addRange(o, 1, 1); T.eq(1, o.size());
        });
        T.done();
    }
}
