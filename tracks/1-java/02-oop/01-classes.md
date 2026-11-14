---
id: j-classes
title: Классы и объекты
summary: Поля, методы, конструкторы, this и static.
xp: 25
---
## Класс — чертёж, объект — изделие

**Класс** описывает, какие данные (поля) есть у объектов и что они умеют (методы). **Объект** — конкретный экземпляр класса, созданный оператором `new`.

```java
class Dog {
    String name;          // поля — состояние объекта
    int age;

    void bark() {         // метод — поведение
        System.out.println(name + ": Гав!");
    }
}

Dog d = new Dog();        // создаём объект
d.name = "Рекс";
d.bark();                 // Рекс: Гав!
```

Переменная `d` хранит не сам объект, а **ссылку** на него. Объекты живут в области памяти, которая называется куча (heap).

```java
Dog a = new Dog();
Dog b = a;                // вторая ссылка на ТОТ ЖЕ объект
b.name = "Шарик";
System.out.println(a.name);   // Шарик
```

Если в ссылке ничего нет, она равна `null`. Вызов метода у `null` — `NullPointerException`, самое частое исключение в Java.

## Конструктор

Конструктор — специальный метод, который вызывается при `new` и приводит объект в корректное начальное состояние. Имя совпадает с именем класса, типа результата нет.

```java
class Dog {
    String name;
    int age;

    Dog(String name, int age) {
        this.name = name;     // this.name — поле, name — параметр
        this.age = age;
    }

    Dog(String name) {
        this(name, 0);        // вызов другого конструктора — только первой строкой
    }
}
```

`this` — ссылка на текущий объект. Чаще всего нужна, чтобы отличить поле от одноимённого параметра.

> **Ловушка.** Если вы не написали ни одного конструктора, компилятор добавит пустой конструктор без параметров. Но стоит объявить хоть один свой — конструктор по умолчанию **исчезает**, и `new Dog()` перестаёт компилироваться.

Поля, которым не присвоено значение, получают значения по умолчанию: `0`, `false`, `null`.

## static — общее для всего класса

Обычные поля свои у каждого объекта. **Статическое** поле одно на весь класс.

```java
class Dog {
    static int count = 0;     // одно на всех собак
    String name;

    Dog(String name) {
        this.name = name;
        count++;              // считаем созданные объекты
    }

    static int getCount() {   // статический метод: вызывается без объекта
        return count;
    }
}

new Dog("Рекс");
new Dog("Шарик");
System.out.println(Dog.getCount());   // 2
```

В статическом методе нет `this`, поэтому он не может напрямую обращаться к нестатическим полям и методам — непонятно, какого объекта. Именно поэтому из `main` нельзя вызвать нестатический метод без создания объекта.

## Порядок инициализации

При создании объекта выполняется: сначала статические поля и блоки класса (один раз, при первой загрузке класса), затем инициализаторы полей объекта сверху вниз, затем тело конструктора.

```java
class Demo {
    int x = 10;               // 1) инициализатор поля
    Demo() { x = 20; }        // 2) конструктор
}
// new Demo().x == 20
```

> **На собеседовании.** «Что такое `this`?», «Может ли конструктор быть `private`?» (да — так делают Singleton и классы с фабричными методами), «Можно ли перегружать конструкторы?» (да).

@@ quiz
@@ q
Что выведет код?
```java
class Box { int value; }

Box a = new Box();
a.value = 1;
Box b = a;
b.value = 2;
a = new Box();
System.out.println(a.value + " " + b.value);
```
- [ ] `2 2`
- [ ] `1 2`
- [x] `0 2`
- [ ] `0 0`
@@ explain
Сначала `a` и `b` указывают на один объект, его поле становится равным 2. Затем `a` начинает указывать на новый объект с полем по умолчанию — 0. `b` по-прежнему указывает на первый объект.

@@ q
Скомпилируется ли код?
```java
class User {
    String name;
    User(String name) { this.name = name; }
}

User u = new User();
```
- [ ] Да, `name` будет `null`
- [x] Нет: конструктора без параметров в классе нет
- [ ] Да, но будет предупреждение
- [ ] Нет: поле `name` должно быть `private`
@@ explain
Компилятор добавляет конструктор по умолчанию, только если в классе нет ни одного конструктора. Здесь объявлен конструктор с параметром, значит `new User()` вызвать нечем.

@@ q
Что выведет код?
```java
class Counter {
    static int total = 0;
    int own = 0;
    void inc() { total++; own++; }
}

Counter a = new Counter(), b = new Counter();
a.inc(); a.inc(); b.inc();
System.out.println(a.own + " " + b.own + " " + Counter.total);
```
- [ ] `2 1 2`
- [x] `2 1 3`
- [ ] `3 3 3`
- [ ] `2 1 1`
@@ explain
Поле `own` у каждого объекта своё: 2 и 1. Статическое поле `total` общее — его увеличили три раза.

@@ q
Почему этот код не компилируется?
```java
public class Main {
    int value = 5;
    public static void main(String[] args) {
        System.out.println(value);
    }
}
```
- [ ] `value` нужно объявить `public`
- [x] Статический метод обращается к нестатическому полю без объекта
- [ ] В `main` нельзя использовать поля класса
- [ ] Поле нужно инициализировать в конструкторе
@@ explain
`main` статический, объекта `Main` не существует, а `value` принадлежит объекту. Нужно либо сделать поле `static`, либо создать объект: `new Main().value`.

@@ task account | Банковский счёт | xp=35
Создайте класс `Account` (не `public`, в том же файле):

- конструктор `Account(String owner)` — баланс нового счёта равен 0;
- `void deposit(long amount)` — пополнение;
- `boolean withdraw(long amount)` — снятие: если денег хватает, уменьшает баланс и возвращает `true`; иначе ничего не меняет и возвращает `false`;
- `long getBalance()` и `String getOwner()`.
@@ hint
Храните состояние в полях `private String owner;` и `private long balance;`. Конструктор записывает владельца через `this.owner = owner`.
@@ hint
В `withdraw` сначала проверка: `if (amount > balance) return false;` — и только потом уменьшайте баланс.
@@ starter
class Account {
    // поля, конструктор и методы
}

public class Main {
    public static void main(String[] args) {
        // Account acc = new Account("Анна");
        // acc.deposit(100);
        // System.out.println(acc.withdraw(30) + " " + acc.getBalance());
    }
}
@@ solution
class Account {
    private final String owner;
    private long balance;

    Account(String owner) {
        this.owner = owner;
    }

    void deposit(long amount) {
        balance += amount;
    }

    boolean withdraw(long amount) {
        if (amount > balance) return false;
        balance -= amount;
        return true;
    }

    long getBalance() { return balance; }

    String getOwner() { return owner; }
}

public class Main {
    public static void main(String[] args) {
        Account acc = new Account("Анна");
        acc.deposit(100);
        System.out.println(acc.withdraw(30) + " " + acc.getBalance());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("новый счёт пуст", () -> { Account a = new Account("Анна"); T.eq(0L, a.getBalance()); T.eq("Анна", a.getOwner()); });
        T.test("пополнение", () -> { Account a = new Account("А"); a.deposit(100); a.deposit(50); T.eq(150L, a.getBalance()); });
        T.test("успешное снятие", () -> { Account a = new Account("А"); a.deposit(100); T.eq(true, a.withdraw(30)); T.eq(70L, a.getBalance()); });
        T.test("снять всё", () -> { Account a = new Account("А"); a.deposit(100); T.eq(true, a.withdraw(100)); T.eq(0L, a.getBalance()); });
        T.test("недостаточно средств", () -> { Account a = new Account("А"); a.deposit(100); T.eq(false, a.withdraw(101)); T.eq(100L, a.getBalance()); });
        T.test("счета независимы", () -> { Account a = new Account("А"), b = new Account("Б"); a.deposit(10); T.eq(0L, b.getBalance()); });
        T.done();
    }
}

@@ task id-generator | Счётчик созданных объектов | xp=30
Создайте класс `Ticket`: каждому новому объекту автоматически присваивается номер — 1, 2, 3 и так далее.

- конструктор без параметров;
- `int getId()` — номер этого талона;
- статический метод `static int issued()` — сколько талонов создано всего.
@@ hint
Общий счётчик — статическое поле: `private static int counter = 0;`. Номер конкретного талона — обычное поле `private final int id;`.
@@ hint
В конструкторе: `id = ++counter;` — сначала увеличить общий счётчик, потом запомнить значение.
@@ starter
class Ticket {
    // ваш код
}

public class Main {
    public static void main(String[] args) {
        // Ticket a = new Ticket();
        // Ticket b = new Ticket();
        // System.out.println(a.getId() + " " + b.getId() + " " + Ticket.issued());
    }
}
@@ solution
class Ticket {
    private static int counter = 0;
    private final int id;

    Ticket() {
        id = ++counter;
    }

    int getId() { return id; }

    static int issued() { return counter; }
}

public class Main {
    public static void main(String[] args) {
        Ticket a = new Ticket();
        Ticket b = new Ticket();
        System.out.println(a.getId() + " " + b.getId() + " " + Ticket.issued());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("номера идут подряд", () -> {
            int before = Ticket.issued();
            Ticket a = new Ticket(), b = new Ticket(), c = new Ticket();
            T.eq(before + 1, a.getId());
            T.eq(before + 2, b.getId());
            T.eq(before + 3, c.getId());
            T.eq(before + 3, Ticket.issued());
        });
        T.test("номер талона не меняется", () -> {
            Ticket a = new Ticket();
            int id = a.getId();
            new Ticket();
            T.eq(id, a.getId());
        });
        T.done();
    }
}
