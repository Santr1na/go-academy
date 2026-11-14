---
id: j-interfaces
title: Абстрактные классы и интерфейсы
summary: Контракты без реализации, default-методы и выбор между абстрактным классом и интерфейсом.
xp: 30
---
## Абстрактный класс

Иногда у базового класса нет осмысленной реализации метода: у «фигуры вообще» нет площади. Такой метод объявляют **абстрактным** — без тела, а класс помечают `abstract`.

```java
abstract class Shape {
    private final String name;

    Shape(String name) { this.name = name; }

    abstract double area();                 // наследник ОБЯЗАН реализовать

    String describe() {                     // обычный метод с реализацией
        return name + ": " + area();
    }
}

class Square extends Shape {
    private final double side;
    Square(double side) { super("Квадрат"); this.side = side; }

    @Override
    double area() { return side * side; }
}
```

Создать объект абстрактного класса нельзя: `new Shape("x")` — ошибка компиляции. Но у него есть конструкторы (их вызывают наследники) и состояние.

## Интерфейс

Интерфейс — это **контракт**: набор методов, которые класс обещает реализовать. Он отвечает на вопрос «что объект умеет», а не «чем он является».

```java
interface Payable {
    int pay();                              // public abstract — по умолчанию
}

interface Printable {
    String text();

    default void print() {                  // метод с реализацией (Java 8+)
        System.out.println(text());
    }

    static Printable of(String s) {         // статический метод интерфейса
        return () -> s;
    }
}

class Invoice implements Payable, Printable {   // интерфейсов можно реализовать много
    @Override public int pay() { return 100; }
    @Override public String text() { return "Счёт на 100"; }
}
```

Что важно помнить:

- методы интерфейса неявно `public`, поэтому в реализации обязательно писать `public` — иначе это попытка сузить доступ и ошибка компиляции;
- поля интерфейса — всегда `public static final`, то есть константы; состояния у интерфейса нет;
- класс наследует один класс, но реализует сколько угодно интерфейсов.

## Абстрактный класс или интерфейс

| | Абстрактный класс | Интерфейс |
|---|---|---|
| Сколько можно унаследовать | один | много |
| Поля с состоянием | да | нет, только константы |
| Конструктор | да | нет |
| Смысл | общая основа для родственных классов | способность, роль |

Практическое правило: начинайте с интерфейса. Абстрактный класс нужен, когда у наследников есть общее **состояние** или общий кусок реализации.

## Программируйте на уровне интерфейса

```java
List<String> names = new ArrayList<>();     // тип переменной — интерфейс
```

Если завтра понадобится `LinkedList`, изменится одна строка. Тот же принцип лежит в основе внедрения зависимостей в Spring: сервис зависит от интерфейса `UserRepository`, а реализацию подставляет контейнер (в тестах — заглушку).

## Ромбовидная проблема

Если класс реализует два интерфейса с одинаковыми `default`-методами, компилятор потребует разрешить конфликт явно:

```java
interface A { default String hi() { return "A"; } }
interface B { default String hi() { return "B"; } }

class C implements A, B {
    @Override
    public String hi() { return A.super.hi(); }   // выбираем явно
}
```

Если же один и тот же метод пришёл и от класса-родителя, и от интерфейса, побеждает **класс**.

## Функциональный интерфейс

Интерфейс с ровно одним абстрактным методом называется функциональным — его можно реализовать лямбдой: `Comparator`, `Runnable`, `Predicate`. Подробнее — в уроке о лямбдах.

@@ quiz
@@ q
Скомпилируется ли код?
```java
interface Greeter { String greet(); }

class Hello implements Greeter {
    String greet() { return "Привет"; }
}
```
- [ ] Да
- [x] Нет: метод интерфейса `public`, а реализация пытается сузить доступ
- [ ] Нет: у интерфейса должен быть конструктор
- [ ] Нет: нужна аннотация `@Override`
@@ explain
Методы интерфейса неявно `public`. В классе метод без модификатора имеет доступ package-private, то есть более узкий — а сужать доступ при переопределении нельзя. Нужно написать `public String greet()`.

@@ q
Что выведет код?
```java
interface A { default String hi() { return "A"; } }
class Base { public String hi() { return "Base"; } }
class C extends Base implements A { }

System.out.println(new C().hi());
```
- [ ] `A`
- [x] `Base`
- [ ] Ошибка компиляции: конфликт методов
- [ ] `null`
@@ explain
Правило «класс побеждает»: метод, унаследованный от класса, имеет приоритет над `default`-методом интерфейса. Конфликт, требующий явного разрешения, возникает только между двумя интерфейсами.

@@ q
Что верно про абстрактный класс?
- [ ] У него не может быть конструктора
- [ ] Все его методы должны быть абстрактными
- [x] Его нельзя создать через `new`, но у него могут быть поля, конструкторы и обычные методы
- [ ] Класс может наследовать несколько абстрактных классов
@@ explain
Абстрактный класс — обычный класс с запретом на создание экземпляров. Он может вообще не содержать абстрактных методов. Множественного наследования классов в Java нет.

@@ q
Какие модификаторы неявно имеет поле `int MAX = 10;`, объявленное в интерфейсе?
- [ ] `private final`
- [ ] Никаких: это обычное поле
- [x] `public static final`
- [ ] `protected static`
@@ explain
Любое поле интерфейса — константа: `public static final`. Присвоить ему новое значение нельзя, и принадлежит оно интерфейсу, а не объектам.

@@ task discount | Стратегии скидок | xp=40
Объявите интерфейс `Discount` с методом `int apply(int price)` и три его реализации:

- `NoDiscount` — возвращает цену без изменений;
- `PercentDiscount(int percent)` — уменьшает цену на заданный процент (целочисленно: `price - price * percent / 100`);
- `FixedDiscount(int amount)` — вычитает фиксированную сумму, но цена не может стать меньше нуля.

Реализуйте метод `Main.total(int[] prices, Discount d)` — сумму цен после применения скидки к **каждой** цене.
@@ hint
`interface Discount { int apply(int price); }`. В классах-реализациях метод должен быть `public`.
@@ hint
Для `FixedDiscount`: `return Math.max(0, price - amount);`. В `total` вызывайте `d.apply(p)` для каждой цены.
@@ starter
// объявите интерфейс Discount и классы NoDiscount, PercentDiscount, FixedDiscount

public class Main {
    // static int total(int[] prices, Discount d) { ... }

    public static void main(String[] args) {
        // System.out.println(total(new int[]{1000, 500}, new PercentDiscount(10)));
    }
}
@@ solution
interface Discount {
    int apply(int price);
}

class NoDiscount implements Discount {
    @Override
    public int apply(int price) { return price; }
}

class PercentDiscount implements Discount {
    private final int percent;

    PercentDiscount(int percent) { this.percent = percent; }

    @Override
    public int apply(int price) { return price - price * percent / 100; }
}

class FixedDiscount implements Discount {
    private final int amount;

    FixedDiscount(int amount) { this.amount = amount; }

    @Override
    public int apply(int price) { return Math.max(0, price - amount); }
}

public class Main {
    static int total(int[] prices, Discount d) {
        int sum = 0;
        for (int p : prices) sum += d.apply(p);
        return sum;
    }

    public static void main(String[] args) {
        System.out.println(total(new int[]{1000, 500}, new PercentDiscount(10)));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("Discount — интерфейс", () -> T.check(Discount.class.isInterface(), "Discount должен быть интерфейсом"));
        T.test("без скидки", () -> T.eq(1000, new NoDiscount().apply(1000)));
        T.test("процент", () -> { T.eq(900, new PercentDiscount(10).apply(1000)); T.eq(0, new PercentDiscount(100).apply(555)); });
        T.test("фиксированная скидка", () -> { T.eq(700, new FixedDiscount(300).apply(1000)); T.eq(0, new FixedDiscount(300).apply(200)); });
        T.test("total с процентом", () -> T.eq(1350, Main.total(new int[]{1000, 500}, new PercentDiscount(10))));
        T.test("total с фиксированной скидкой применяется к каждой цене", () -> T.eq(800, Main.total(new int[]{1000, 100}, new FixedDiscount(200))));
        T.test("своя реализация через лямбду", () -> T.eq(3, Main.total(new int[]{10, 20, 30}, p -> 1)));
        T.done();
    }
}

@@ task stack | Стек на массиве | xp=45 interview
Дан интерфейс `IntStack`. Реализуйте его классом `ArrayIntStack`, который хранит элементы в массиве `int[]` и сам увеличивает его, когда место кончается (начальная ёмкость — любая).

- `push(int x)` — положить на вершину;
- `pop()` — снять и вернуть вершину; для пустого стека бросить `IllegalStateException`;
- `peek()` — вернуть вершину, не снимая; для пустого стека бросить `IllegalStateException`;
- `size()` и `isEmpty()` (`isEmpty` уже реализован в интерфейсе как `default`-метод).

Пользоваться коллекциями (`ArrayList`, `Deque` и т. п.) нельзя.
@@ hint
Нужны два поля: массив `int[] data` и счётчик `int size`. Вершина стека — элемент `data[size - 1]`.
@@ hint
В `push`: если `size == data.length`, увеличьте массив: `data = java.util.Arrays.copyOf(data, data.length * 2);` — затем `data[size++] = x;`.
@@ starter
interface IntStack {
    void push(int x);
    int pop();
    int peek();
    int size();

    default boolean isEmpty() { return size() == 0; }
}

class ArrayIntStack implements IntStack {
    // ваш код

    @Override public void push(int x) { }
    @Override public int pop() { return 0; }
    @Override public int peek() { return 0; }
    @Override public int size() { return 0; }
}

public class Main {
    public static void main(String[] args) {
        IntStack s = new ArrayIntStack();
        s.push(1);
        s.push(2);
        System.out.println(s.pop() + " " + s.pop() + " " + s.isEmpty());
    }
}
@@ solution
import java.util.Arrays;

interface IntStack {
    void push(int x);
    int pop();
    int peek();
    int size();

    default boolean isEmpty() { return size() == 0; }
}

class ArrayIntStack implements IntStack {
    private int[] data = new int[4];
    private int size;

    @Override
    public void push(int x) {
        if (size == data.length) data = Arrays.copyOf(data, data.length * 2);
        data[size++] = x;
    }

    @Override
    public int pop() {
        if (size == 0) throw new IllegalStateException("стек пуст");
        return data[--size];
    }

    @Override
    public int peek() {
        if (size == 0) throw new IllegalStateException("стек пуст");
        return data[size - 1];
    }

    @Override
    public int size() { return size; }
}

public class Main {
    public static void main(String[] args) {
        IntStack s = new ArrayIntStack();
        s.push(1);
        s.push(2);
        System.out.println(s.pop() + " " + s.pop() + " " + s.isEmpty());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("новый стек пуст", () -> { IntStack s = new ArrayIntStack(); T.eq(0, s.size()); T.eq(true, s.isEmpty()); });
        T.test("последним пришёл — первым ушёл", () -> {
            IntStack s = new ArrayIntStack();
            s.push(1); s.push(2); s.push(3);
            T.eq(3, s.pop()); T.eq(2, s.pop()); T.eq(1, s.size()); T.eq(1, s.pop()); T.eq(true, s.isEmpty());
        });
        T.test("peek не снимает элемент", () -> { IntStack s = new ArrayIntStack(); s.push(7); T.eq(7, s.peek()); T.eq(1, s.size()); });
        T.test("стек растёт", () -> {
            IntStack s = new ArrayIntStack();
            for (int i = 0; i < 1000; i++) s.push(i);
            T.eq(1000, s.size());
            for (int i = 999; i >= 0; i--) T.eq(i, s.pop());
        });
        T.test("pop и peek на пустом стеке", () -> {
            IntStack s = new ArrayIntStack();
            T.throwsEx(IllegalStateException.class, s::pop);
            T.throwsEx(IllegalStateException.class, s::peek);
        });
        T.test("без коллекций", () -> {
            for (java.lang.reflect.Field f : ArrayIntStack.class.getDeclaredFields())
                T.check(!java.util.Collection.class.isAssignableFrom(f.getType()), "поле " + f.getName() + " — коллекция, а нужен массив");
        });
        T.done();
    }
}
