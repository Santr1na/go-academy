---
id: j-encapsulation
title: Инкапсуляция и модификаторы доступа
summary: Зачем прятать поля, четыре уровня доступа и защита инвариантов.
xp: 25
---
## Зачем прятать данные

Если поле открыто, любой код может записать в него что угодно:

```java
class Account {
    public long balance;
}

account.balance = -1_000_000;   // объект в невозможном состоянии, и никто этого не заметил
```

**Инкапсуляция** — это когда объект сам отвечает за своё состояние: поля закрыты, а изменить их можно только через методы, которые проверяют правила. Такие правила называют **инвариантами** («баланс не бывает отрицательным», «возраст от 0 до 150»).

```java
class Account {
    private long balance;                 // снаружи недоступно

    public long getBalance() {            // читать можно
        return balance;
    }

    public void deposit(long amount) {    // менять — только по правилам
        if (amount <= 0) {
            throw new IllegalArgumentException("Сумма должна быть положительной");
        }
        balance += amount;
    }
}
```

Вторая выгода: внутреннее устройство можно менять, не трогая остальной код. Сегодня баланс — поле `long`, завтра — сумма по списку операций; пока метод `getBalance()` работает так же, никто снаружи ничего не заметит.

## Четыре модификатора доступа

| Модификатор | Свой класс | Свой пакет | Наследники в других пакетах | Все остальные |
|---|---|---|---|---|
| `private` | ✅ | — | — | — |
| *(без модификатора)* — package-private | ✅ | ✅ | — | — |
| `protected` | ✅ | ✅ | ✅ | — |
| `public` | ✅ | ✅ | ✅ | ✅ |

Правило хорошего тона: давайте **минимально необходимый** доступ. Поля — `private`, методы — `public` только те, что действительно нужны снаружи.

> **Ловушка.** `private` ограничивает доступ на уровне **класса**, а не объекта. Метод класса `Account` может читать приватные поля *другого* объекта `Account`: `boolean richerThan(Account other) { return balance > other.balance; }` — это компилируется.

## Геттеры и сеттеры

По соглашению: `getName()` / `setName(...)`, для `boolean` — `isActive()`. Но не делайте сеттер на каждое поле автоматически: класс, у которого все поля открыты через `get`/`set`, инкапсулирован не лучше класса с `public`-полями. Сеттер нужен только там, где изменение извне действительно допустимо.

## Ловушка: утечка изменяемого объекта

Закрыть поле мало, если наружу отдаётся ссылка на изменяемый объект:

```java
class Team {
    private final List<String> members = new ArrayList<>();

    public List<String> getMembers() {
        return members;                       // отдали ссылку на внутренний список!
    }
}

team.getMembers().clear();                    // состав команды очищен в обход всех проверок
```

Защита — отдавать копию или неизменяемое представление:

```java
public List<String> getMembers() {
    return List.copyOf(members);              // или Collections.unmodifiableList(members)
}
```

То же в конструкторе: если принять чужой список и сохранить ссылку, вызывающий код сможет менять «ваше» состояние. Делайте **защитную копию**: `this.members = new ArrayList<>(members);`.

## final

`final` у поля означает, что его можно присвоить только один раз — в объявлении или в конструкторе. Объект, у которого все поля `final` и нет утечек, **неизменяемый** — с ним безопасно работать из многих потоков.

> **Важно.** `final` запрещает менять *ссылку*, но не *содержимое* объекта. `final List<String> list` нельзя переприсвоить, но `list.add("x")` работает.

@@ quiz
@@ q
Что произойдёт при выполнении?
```java
final List<String> list = new ArrayList<>();
list.add("a");
list.add("b");
System.out.println(list.size());
```
- [ ] Ошибка компиляции: `final`-список нельзя менять
- [x] Напечатается `2`
- [ ] `UnsupportedOperationException`
- [ ] Напечатается `0`
@@ explain
`final` относится к переменной: ей нельзя присвоить другой список. Сам объект остаётся изменяемым. Неизменяемый список даёт `List.of(...)` или `Collections.unmodifiableList(...)`.

@@ q
Скомпилируется ли метод?
```java
class Account {
    private long balance;

    boolean richerThan(Account other) {
        return this.balance > other.balance;
    }
}
```
- [x] Да: `private` открыт для всего класса, включая другие его объекты
- [ ] Нет: нельзя читать приватное поле чужого объекта
- [ ] Только если `other` объявить `final`
- [ ] Только через геттер
@@ explain
Доступ проверяется по классу, а не по экземпляру. Весь код внутри `Account` видит приватные члены любого объекта `Account`. На этом основаны, например, реализации `equals`.

@@ q
Класс без модификатора доступа у поля: `class User { String name; }`. Откуда поле `name` доступно?
- [ ] Отовсюду
- [ ] Только из класса `User`
- [x] Из любого класса того же пакета
- [ ] Из класса `User` и его наследников в любых пакетах
@@ explain
Отсутствие модификатора — это уровень package-private: доступ есть у всех классов того же пакета. Наследник из *другого* пакета доступа не получит — для этого нужен `protected`.

@@ q
В чём проблема этого класса?
```java
class Team {
    private final List<String> members = new ArrayList<>();
    public List<String> getMembers() { return members; }
}
```
- [ ] Поле должно быть `public`
- [ ] Список нельзя объявлять `final`
- [x] Геттер отдаёт ссылку на внутренний список, и его можно менять снаружи
- [ ] Проблемы нет
@@ explain
Инкапсуляция нарушена: `team.getMembers().clear()` меняет состояние объекта в обход его методов. Нужно возвращать копию или неизменяемое представление.

@@ task temperature | Класс с инвариантом | xp=35
Создайте класс `Thermostat`, который не позволяет установить недопустимую температуру:

- конструктор `Thermostat(int target)`;
- `void setTarget(int target)`;
- `int getTarget()`.

Допустимая температура — от 5 до 35 градусов включительно. При попытке установить другое значение — и в конструкторе, и в сеттере — бросайте `IllegalArgumentException`, а текущее значение не меняйте.
@@ hint
Чтобы не дублировать проверку, пусть конструктор вызывает `setTarget(target)`.
@@ hint
`if (target < 5 || target > 35) throw new IllegalArgumentException("Допустимо от 5 до 35");` — проверка должна стоять **до** присваивания полю.
@@ starter
class Thermostat {
    // ваш код
}

public class Main {
    public static void main(String[] args) {
        // Thermostat t = new Thermostat(21);
        // t.setTarget(24);
        // System.out.println(t.getTarget());
    }
}
@@ solution
class Thermostat {
    private int target;

    Thermostat(int target) {
        setTarget(target);
    }

    void setTarget(int target) {
        if (target < 5 || target > 35) {
            throw new IllegalArgumentException("Допустимо от 5 до 35");
        }
        this.target = target;
    }

    int getTarget() { return target; }
}

public class Main {
    public static void main(String[] args) {
        Thermostat t = new Thermostat(21);
        t.setTarget(24);
        System.out.println(t.getTarget());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("обычное значение", () -> { Thermostat t = new Thermostat(21); T.eq(21, t.getTarget()); t.setTarget(24); T.eq(24, t.getTarget()); });
        T.test("границы допустимы", () -> { Thermostat t = new Thermostat(5); t.setTarget(35); T.eq(35, t.getTarget()); });
        T.test("слишком холодно", () -> { Thermostat t = new Thermostat(20); T.throwsEx(IllegalArgumentException.class, () -> t.setTarget(4)); T.eq(20, t.getTarget()); });
        T.test("слишком жарко", () -> { Thermostat t = new Thermostat(20); T.throwsEx(IllegalArgumentException.class, () -> t.setTarget(36)); T.eq(20, t.getTarget()); });
        T.test("проверка в конструкторе", () -> T.throwsEx(IllegalArgumentException.class, () -> new Thermostat(100)));
        T.done();
    }
}

@@ task playlist | Защитные копии | xp=40 interview
Класс `Playlist` хранит список песен. Сейчас его инкапсуляция «течёт» в двух местах: внешний код может изменить плейлист, не вызывая его методов. Исправьте класс:

- изменение списка, переданного в конструктор, **после** создания плейлиста не должно влиять на плейлист;
- список, полученный из `getSongs()`, не должен позволять изменить плейлист (пусть попытка изменения бросает исключение или меняет только копию);
- `void add(String song)` и `int size()` должны работать как раньше.
@@ hint
В конструкторе сохраняйте не чужую ссылку, а копию: `this.songs = new ArrayList<>(songs);`.
@@ hint
В геттере возвращайте `List.copyOf(songs)` или `Collections.unmodifiableList(songs)`.
@@ starter
import java.util.ArrayList;
import java.util.List;

class Playlist {
    private final List<String> songs;

    Playlist(List<String> songs) {
        this.songs = songs;
    }

    void add(String song) { songs.add(song); }

    int size() { return songs.size(); }

    List<String> getSongs() { return songs; }
}

public class Main {
    public static void main(String[] args) {
        List<String> src = new ArrayList<>(List.of("A", "B"));
        Playlist p = new Playlist(src);
        src.clear();
        System.out.println(p.size());   // должно остаться 2
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;

class Playlist {
    private final List<String> songs;

    Playlist(List<String> songs) {
        this.songs = new ArrayList<>(songs);
    }

    void add(String song) { songs.add(song); }

    int size() { return songs.size(); }

    List<String> getSongs() { return List.copyOf(songs); }
}

public class Main {
    public static void main(String[] args) {
        List<String> src = new ArrayList<>(List.of("A", "B"));
        Playlist p = new Playlist(src);
        src.clear();
        System.out.println(p.size());   // должно остаться 2
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("add и size работают", () -> {
            Playlist p = new Playlist(new ArrayList<>(List.of("A")));
            p.add("B");
            T.eq(2, p.size());
            T.eq(List.of("A", "B"), new ArrayList<>(p.getSongs()));
        });
        T.test("изменение исходного списка не влияет на плейлист", () -> {
            List<String> src = new ArrayList<>(List.of("A", "B"));
            Playlist p = new Playlist(src);
            src.clear();
            T.eq(2, p.size());
        });
        T.test("через getSongs нельзя изменить плейлист", () -> {
            Playlist p = new Playlist(new ArrayList<>(List.of("A", "B")));
            try { p.getSongs().clear(); } catch (UnsupportedOperationException e) { /* тоже допустимо */ }
            T.eq(2, p.size());
        });
        T.test("плейлист принимает неизменяемый список", () -> {
            Playlist p = new Playlist(List.of("A"));
            p.add("B");
            T.eq(2, p.size());
        });
        T.done();
    }
}
