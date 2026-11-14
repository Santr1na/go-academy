---
id: j-inheritance
title: Наследование и полиморфизм
summary: extends, super, переопределение методов и динамическое связывание.
xp: 30
---
## Наследование

Класс-наследник получает поля и методы родителя и может добавить свои или изменить поведение.

```java
class Animal {
    protected String name;

    Animal(String name) { this.name = name; }

    String sound() { return "..."; }

    String describe() { return name + " говорит " + sound(); }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);                 // вызов конструктора родителя — первой строкой
    }

    @Override
    String sound() { return "Мяу"; } // переопределение
}
```

В Java у класса **один** родитель (`extends` принимает один класс). Если родитель не указан, им становится `Object` — от него наследуются `toString`, `equals`, `hashCode`.

- `super(...)` вызывает конструктор родителя. Если его не написать, компилятор вставит `super()` без аргументов — и если такого конструктора у родителя нет, код не скомпилируется.
- `super.method()` вызывает родительскую версию переопределённого метода.

## Полиморфизм

Переменная типа родителя может ссылаться на объект наследника. Какой метод выполнится, определяется **реальным типом объекта** во время выполнения, а не типом переменной. Это называется динамическим (поздним) связыванием.

```java
Animal a = new Cat("Мурка");
System.out.println(a.describe());   // Мурка говорит Мяу
```

Метод `describe()` написан в `Animal`, но внутри него `sound()` вызывается у реального объекта — кошки. Благодаря этому можно писать код, который работает с `Animal` и не знает о конкретных видах:

```java
Animal[] zoo = { new Cat("Мурка"), new Dog("Рекс") };
for (Animal x : zoo) System.out.println(x.sound());
```

## Что НЕ полиморфно

Динамическое связывание работает только для обычных (нестатических, не `private`) методов. Три ловушки, которые очень любят на собеседованиях:

```java
class Parent {
    String name = "parent";
    static String who() { return "static parent"; }
    String hello() { return "hello from parent"; }
}

class Child extends Parent {
    String name = "child";                              // поле СКРЫВАЕТ поле родителя
    static String who() { return "static child"; }      // статический метод СКРЫВАЕТ
    @Override String hello() { return "hello from child"; }   // а это — переопределение
}

Parent p = new Child();
p.name;      // "parent"            — поля выбираются по типу ПЕРЕМЕННОЙ
p.who();     // "static parent"     — статические методы тоже
p.hello();   // "hello from child"  — обычный метод выбирается по типу ОБЪЕКТА
```

## Порядок создания объекта

При `new Child()` сначала полностью инициализируется родительская часть (его поля и конструктор), затем поля наследника, затем тело конструктора наследника.

> **Ловушка.** Никогда не вызывайте переопределяемые методы из конструктора. Конструктор родителя выполняется *раньше*, чем инициализируются поля наследника, поэтому переопределённый метод увидит их равными `null` или `0`.

## Приведение типов и instanceof

```java
Animal a = new Cat("Мурка");
Cat c = (Cat) a;                    // вниз по иерархии — явное приведение
Dog d = (Dog) a;                    // ClassCastException во время выполнения

if (a instanceof Cat cat) {         // Java 16+: проверка и приведение сразу
    cat.purr();
}
```

## final и правила переопределения

- `final`-метод нельзя переопределить, от `final`-класса нельзя наследоваться (`String`, `Integer`).
- При переопределении доступ нельзя сужать (`public` → `protected` — ошибка), тип результата может быть подтипом, новые проверяемые исключения добавлять нельзя.
- Аннотация `@Override` не обязательна, но всегда её ставьте: компилятор сообщит, если вы на самом деле ничего не переопределили (например, опечатались в имени).

## Наследование или композиция

Наследование — отношение «является»: кошка *является* животным. Если отношение — «имеет» (машина *имеет* двигатель), нужна **композиция**: поле типа `Engine`. Правило «предпочитайте композицию наследованию» спрашивают часто: наследование жёстко связывает классы и ломается при изменении родителя.

@@ quiz
@@ q
Что выведет код?
```java
class A { String name = "A"; String get() { return name; } }
class B extends A { String name = "B"; String get() { return name; } }

A x = new B();
System.out.println(x.name + " " + x.get());
```
- [ ] `B B`
- [x] `A B`
- [ ] `A A`
- [ ] `B A`
@@ explain
Поля не полиморфны: `x.name` выбирается по типу переменной (`A`). Метод `get()` переопределён и вызывается у реального объекта `B`, где `name` — это поле класса `B`.

@@ q
Что выведет код?
```java
class A { static String who() { return "A"; } }
class B extends A { static String who() { return "B"; } }

A x = new B();
System.out.println(x.who());
```
- [x] `A`
- [ ] `B`
- [ ] Ошибка компиляции
- [ ] `NullPointerException`
@@ explain
Статические методы не переопределяются, а скрываются. Вызов разрешается на этапе компиляции по типу переменной — `A`. Поэтому статические методы принято вызывать через имя класса.

@@ q
Что выведет код?
```java
class Base {
    Base() { System.out.print("Base "); init(); }
    void init() { System.out.print("base-init "); }
}
class Derived extends Base {
    String s = "ready";
    Derived() { System.out.print("Derived "); }
    @Override void init() { System.out.print(s + " "); }
}

new Derived();
```
- [ ] `Base base-init Derived`
- [ ] `Base ready Derived`
- [x] `Base null Derived`
- [ ] `Derived Base ready`
@@ explain
Сначала выполняется конструктор `Base`. Он вызывает `init()` — полиморфно, то есть версию из `Derived`. Но поле `s` ещё не инициализировано (инициализаторы наследника выполняются после конструктора родителя), поэтому печатается `null`.

@@ q
Что произойдёт?
```java
Object o = "строка";
Integer n = (Integer) o;
```
- [ ] Ошибка компиляции
- [x] `ClassCastException` во время выполнения
- [ ] `n` будет равно `null`
- [ ] `n` будет равно `0`
@@ explain
Компилятор верит приведению: `Object` в принципе может оказаться `Integer`. Проверка происходит при выполнении, и так как реальный объект — `String`, бросается `ClassCastException`.

@@ q
Класс `Child` наследует `Parent`, у которого есть только конструктор `Parent(String name)`. Что будет, если в `Child` написать конструктор `Child() { }`?
- [ ] Всё скомпилируется, `name` будет `null`
- [x] Ошибка компиляции: неявный вызов `super()` не находит конструктор без параметров
- [ ] Ошибка во время выполнения
- [ ] Конструктор родителя не вызовется
@@ explain
Первой строкой любого конструктора неявно стоит `super()`. У `Parent` конструктора без параметров нет, поэтому нужно написать явно: `Child() { super("имя"); }`.

@@ task shapes | Фигуры | xp=40
Реализуйте иерархию фигур:

- класс `Shape` с методами `double area()` (возвращает `0`) и `String describe()`, который возвращает строку вида `"Circle: 3.14"` — имя фигуры (`name()`), двоеточие, пробел и площадь, округлённая до двух знаков. Метод `String name()` в `Shape` возвращает `"Shape"`;
- `Circle extends Shape` с конструктором `Circle(double radius)`: площадь `Math.PI * r * r`, имя `"Circle"`;
- `Rect extends Shape` с конструктором `Rect(double width, double height)`: имя `"Rect"`.

Метод `describe()` должен быть написан **только** в `Shape` — наследники его не переопределяют. Для форматирования используйте `String.format(java.util.Locale.ROOT, "%.2f", value)`.
@@ hint
`describe()` в `Shape` вызывает `name()` и `area()` — благодаря полиморфизму выполнятся версии реального объекта.
@@ hint
`return name() + ": " + String.format(java.util.Locale.ROOT, "%.2f", area());` — а в наследниках переопределите только `area()` и `name()` с аннотацией `@Override`.
@@ starter
class Shape {
    double area() { return 0; }

    String name() { return "Shape"; }

    String describe() {
        // имя + ": " + площадь с двумя знаками
        return "";
    }
}

// добавьте классы Circle и Rect

public class Main {
    public static void main(String[] args) {
        Shape s = new Shape();
        System.out.println(s.describe());
    }
}
@@ solution
import java.util.Locale;

class Shape {
    double area() { return 0; }

    String name() { return "Shape"; }

    String describe() {
        return name() + ": " + String.format(Locale.ROOT, "%.2f", area());
    }
}

class Circle extends Shape {
    private final double radius;

    Circle(double radius) { this.radius = radius; }

    @Override
    double area() { return Math.PI * radius * radius; }

    @Override
    String name() { return "Circle"; }
}

class Rect extends Shape {
    private final double width, height;

    Rect(double width, double height) {
        this.width = width;
        this.height = height;
    }

    @Override
    double area() { return width * height; }

    @Override
    String name() { return "Rect"; }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = { new Shape(), new Circle(1), new Rect(2, 3) };
        for (Shape s : shapes) System.out.println(s.describe());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("базовая фигура", () -> T.eq("Shape: 0.00", new Shape().describe()));
        T.test("круг", () -> { Shape s = new Circle(1); T.eq(Math.PI, s.area()); T.eq("Circle: 3.14", s.describe()); });
        T.test("прямоугольник", () -> { Shape s = new Rect(2, 3.5); T.eq(7.0, s.area()); T.eq("Rect: 7.00", s.describe()); });
        T.test("describe написан только в Shape", () -> {
            for (Class<?> c : new Class<?>[]{ Circle.class, Rect.class }) {
                boolean own = true;
                try { c.getDeclaredMethod("describe"); } catch (NoSuchMethodException e) { own = false; }
                T.check(!own, c.getSimpleName() + " не должен переопределять describe()");
            }
        });
        T.test("полиморфизм через массив", () -> {
            Shape[] arr = { new Circle(2), new Rect(1, 1) };
            double sum = 0;
            for (Shape s : arr) sum += s.area();
            T.eq(Math.PI * 4 + 1, sum);
        });
        T.done();
    }
}

@@ task employees | Зарплаты сотрудников | xp=40 interview
Есть базовый класс `Employee` с именем и базовой ставкой. Добавьте наследника `Manager`:

- конструктор `Manager(String name, int baseSalary, int teamSize)`;
- зарплата менеджера — зарплата обычного сотрудника **плюс** 1000 за каждого человека в команде. Используйте `super.salary()`, а не копируйте формулу;
- `title()` возвращает `"Manager"`.

Затем реализуйте статический метод `Main.totalPayroll(Employee[] staff)` — суммарную зарплату всех сотрудников.
@@ hint
Конструктор наследника начинается с `super(name, baseSalary);`.
@@ hint
`@Override int salary() { return super.salary() + 1000 * teamSize; }`. В `totalPayroll` просто вызывайте `e.salary()` у каждого — нужная версия выберется сама.
@@ starter
class Employee {
    protected final String name;
    protected final int baseSalary;

    Employee(String name, int baseSalary) {
        this.name = name;
        this.baseSalary = baseSalary;
    }

    int salary() { return baseSalary; }

    String title() { return "Employee"; }
}

// добавьте класс Manager

public class Main {
    static int totalPayroll(Employee[] staff) {
        // ваш код
        return 0;
    }

    public static void main(String[] args) {
        Employee[] staff = { new Employee("Анна", 5000) };
        System.out.println(totalPayroll(staff));
    }
}
@@ solution
class Employee {
    protected final String name;
    protected final int baseSalary;

    Employee(String name, int baseSalary) {
        this.name = name;
        this.baseSalary = baseSalary;
    }

    int salary() { return baseSalary; }

    String title() { return "Employee"; }
}

class Manager extends Employee {
    private final int teamSize;

    Manager(String name, int baseSalary, int teamSize) {
        super(name, baseSalary);
        this.teamSize = teamSize;
    }

    @Override
    int salary() { return super.salary() + 1000 * teamSize; }

    @Override
    String title() { return "Manager"; }
}

public class Main {
    static int totalPayroll(Employee[] staff) {
        int total = 0;
        for (Employee e : staff) total += e.salary();
        return total;
    }

    public static void main(String[] args) {
        Employee[] staff = { new Employee("Анна", 5000), new Manager("Борис", 7000, 3) };
        System.out.println(totalPayroll(staff));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("обычный сотрудник", () -> { Employee e = new Employee("А", 5000); T.eq(5000, e.salary()); T.eq("Employee", e.title()); });
        T.test("менеджер", () -> { Employee m = new Manager("Б", 7000, 3); T.eq(10000, m.salary()); T.eq("Manager", m.title()); });
        T.test("менеджер без команды", () -> T.eq(7000, new Manager("Б", 7000, 0).salary()));
        T.test("Manager — наследник Employee", () -> T.check(Employee.class.isAssignableFrom(Manager.class), "Manager должен наследовать Employee"));
        T.test("фонд оплаты труда", () -> T.eq(15000, Main.totalPayroll(new Employee[]{ new Employee("А", 5000), new Manager("Б", 7000, 3) })));
        T.test("пустой штат", () -> T.eq(0, Main.totalPayroll(new Employee[0])));
        T.done();
    }
}
