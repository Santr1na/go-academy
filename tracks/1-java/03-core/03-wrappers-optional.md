---
id: j-wrappers-optional
title: Классы-обёртки, автоупаковка и Optional
summary: Integer против int, кеш Integer, NullPointerException при распаковке и Optional вместо null.
xp: 30
---
## Зачем нужны обёртки

У каждого примитива есть класс-обёртка: `int` → `Integer`, `long` → `Long`, `double` → `Double`, `boolean` → `Boolean`, `char` → `Character`. Обёртки нужны, потому что:

- коллекции и generics работают только с объектами: `List<Integer>`, но не `List<int>`;
- объект может быть `null` — «значения нет» (например, необязательное поле из базы);
- в обёртках лежат полезные методы: `Integer.parseInt`, `Integer.MAX_VALUE`, `Integer.compare`.

## Автоупаковка и распаковка

Компилятор сам превращает примитив в объект и обратно:

```java
Integer boxed = 5;          // автоупаковка: Integer.valueOf(5)
int plain = boxed;          // распаковка:   boxed.intValue()

List<Integer> list = new ArrayList<>();
list.add(10);               // упаковка
int first = list.get(0);    // распаковка
```

## Ловушка 1: NullPointerException при распаковке

```java
Integer count = null;
int n = count;              // NullPointerException: вызывается count.intValue()

Map<String, Integer> stock = new HashMap<>();
int qty = stock.get("нет такого");   // тоже NPE: get вернул null
```

Строка выглядит безобидно — метода никто не вызывает, а исключение есть. Используйте `getOrDefault(key, 0)`.

## Ловушка 2: сравнение обёрток через ==

```java
Integer a = 127, b = 127;
System.out.println(a == b);       // true

Integer c = 128, d = 128;
System.out.println(c == d);       // false
System.out.println(c.equals(d));  // true
```

`==` сравнивает ссылки. `Integer.valueOf` **кеширует** объекты для значений от −128 до 127, поэтому для маленьких чисел возвращается один и тот же объект, а для больших — каждый раз новый. В тестах с маленькими числами всё «работает», а в бою с идентификатором 100500 — нет. **Обёртки сравнивают только через `equals`.**

Если один из операндов примитив, второй распаковывается и сравниваются значения: `c == 128` — `true`.

## Ловушка 3: remove у List<Integer>

```java
List<Integer> list = new ArrayList<>(List.of(10, 20, 30));
list.remove(1);                    // удаляет элемент с ИНДЕКСОМ 1 → [10, 30]
list.remove(Integer.valueOf(10));  // удаляет ЗНАЧЕНИЕ 10 → [30]
```

Из двух перегруженных методов `remove(int index)` и `remove(Object o)` компилятор выбирает тот, что не требует упаковки.

## Ловушка 4: производительность

```java
Long sum = 0L;                     // обёртка вместо примитива
for (long i = 0; i < 1_000_000; i++) {
    sum += i;                      // каждый раз: распаковать, сложить, создать новый Long
}
```

В вычислениях используйте примитивы; обёртки — только там, где нужен объект или `null`.

## Optional — явное «значения может не быть»

`null` как признак отсутствия опасен: по сигнатуре метода не видно, может ли он вернуть `null`. `Optional<T>` делает это явным.

```java
Optional<User> findByEmail(String email) { ... }

Optional<User> found = findByEmail("a@b.c");

String name = found
        .map(User::getName)            // преобразовать, если значение есть
        .orElse("Гость");              // иначе — значение по умолчанию

found.ifPresent(u -> System.out.println(u.getName()));
User user = found.orElseThrow(() -> new NotFoundException("Нет такого пользователя"));
```

Создание: `Optional.of(x)` (если `x` — `null`, будет NPE), `Optional.ofNullable(x)`, `Optional.empty()`.

> **Ловушка.** `orElse(вычисление())` вычисляет аргумент **всегда**, даже когда значение есть. Если значение по умолчанию дорогое (запрос в базу), используйте `orElseGet(() -> вычисление())` — лямбда вызовется только при пустом `Optional`.

Правила хорошего тона: `Optional` — для **возвращаемых значений**. Не делайте его полем класса или параметром метода и никогда не возвращайте `null` вместо `Optional`. Вызов `get()` без проверки ничем не лучше NPE.

@@ quiz
@@ q
Что выведет код?
```java
Integer a = 100, b = 100;
Integer c = 1000, d = 1000;
System.out.println((a == b) + " " + (c == d));
```
- [ ] `true true`
- [x] `true false`
- [ ] `false false`
- [ ] `false true`
@@ explain
`==` сравнивает ссылки. Значения от −128 до 127 кешируются, поэтому `a` и `b` — один объект. Для 1000 создаются два разных объекта. Сравнивать обёртки нужно через `equals`.

@@ q
Что произойдёт?
```java
Map<String, Integer> ages = new HashMap<>();
int age = ages.get("Анна");
```
- [ ] `age` будет равно 0
- [ ] Ошибка компиляции
- [x] `NullPointerException`
- [ ] `NoSuchElementException`
@@ explain
`get` для отсутствующего ключа возвращает `null`. Присваивание в `int` требует распаковки — вызова `intValue()` у `null`. Безопаснее `getOrDefault("Анна", 0)`.

@@ q
Что выведет код?
```java
List<Integer> list = new ArrayList<>(List.of(5, 1, 3));
list.remove(1);
System.out.println(list);
```
- [ ] `[5, 3]` — удалено значение 1
- [x] `[5, 3]` — удалён элемент с индексом 1
- [ ] `[1, 3]`
- [ ] `[5, 1]`
@@ explain
Результат в этом примере совпадает по случайности: по индексу 1 как раз лежит значение 1. Вызывается `remove(int index)`. Для списка `[5, 3, 1]` тот же вызов удалил бы тройку. Чтобы удалить по значению, пишут `list.remove(Integer.valueOf(1))`.

@@ q
Чем `orElse` отличается от `orElseGet`?
```java
user = found.orElse(loadDefaultUser());
user = found.orElseGet(() -> loadDefaultUser());
```
- [ ] Ничем
- [x] В первой строке `loadDefaultUser()` вызывается всегда, во второй — только если значения нет
- [ ] `orElseGet` бросает исключение, если значения нет
- [ ] `orElse` не принимает вызовы методов
@@ explain
Аргумент обычного метода вычисляется до вызова, независимо от того, пригодится ли он. `orElseGet` принимает лямбду и выполняет её лениво.

@@ q
Что выведет код?
```java
Integer x = 128;
int y = 128;
System.out.println(x == y);
```
- [x] `true`
- [ ] `false`
- [ ] Ошибка компиляции
- [ ] `NullPointerException`
@@ explain
Когда один из операндов — примитив, обёртка распаковывается и сравниваются числа. Проблема с кешем возникает только при сравнении двух объектов.

@@ task find-user | Optional вместо null | xp=40
Дан список пользователей (`record User(String name, String email)`, email может быть `null`).

1. `Main.findByName(List<User> users, String name)` возвращает `Optional<User>` — первого пользователя с таким именем или пустой `Optional`.
2. `Main.emailOf(List<User> users, String name)` возвращает email пользователя **в верхнем регистре**, а если пользователь не найден или email у него `null` — строку `"нет email"`. Не используйте `if`, `get()` и `isPresent()` — только цепочку методов `Optional`.
@@ hint
Для поиска подойдёт цикл с `return Optional.of(u)` и `return Optional.empty()` в конце — или `users.stream().filter(...).findFirst()`.
@@ hint
`map` на пустом `Optional` ничего не делает, а если функция вернула `null` — результат становится пустым: `findByName(users, name).map(User::email).map(String::toUpperCase).orElse("нет email")`.
@@ starter
import java.util.List;
import java.util.Optional;

record User(String name, String email) { }

public class Main {
    static Optional<User> findByName(List<User> users, String name) {
        return Optional.empty();
    }

    static String emailOf(List<User> users, String name) {
        return "";
    }

    public static void main(String[] args) {
        List<User> users = List.of(new User("Анна", "anna@example.com"), new User("Борис", null));
        System.out.println(emailOf(users, "Анна"));
    }
}
@@ solution
import java.util.List;
import java.util.Optional;

record User(String name, String email) { }

public class Main {
    static Optional<User> findByName(List<User> users, String name) {
        return users.stream().filter(u -> u.name().equals(name)).findFirst();
    }

    static String emailOf(List<User> users, String name) {
        return findByName(users, name)
                .map(User::email)
                .map(String::toUpperCase)
                .orElse("нет email");
    }

    public static void main(String[] args) {
        List<User> users = List.of(new User("Анна", "anna@example.com"), new User("Борис", null));
        System.out.println(emailOf(users, "Анна"));
        System.out.println(emailOf(users, "Борис"));
    }
}
@@ test
import java.util.List;

public class Checker {
    static final List<User> USERS = List.of(new User("Анна", "anna@example.com"), new User("Борис", null), new User("Анна", "second@example.com"));

    public static void main(String[] args) {
        T.test("найден первый подходящий", () -> T.eq("anna@example.com", Main.findByName(USERS, "Анна").orElseThrow().email()));
        T.test("не найден — пустой Optional, а не null", () -> { T.check(Main.findByName(USERS, "Вера") != null, "нельзя возвращать null"); T.eq(true, Main.findByName(USERS, "Вера").isEmpty()); });
        T.test("email в верхнем регистре", () -> T.eq("ANNA@EXAMPLE.COM", Main.emailOf(USERS, "Анна")));
        T.test("email равен null", () -> T.eq("нет email", Main.emailOf(USERS, "Борис")));
        T.test("пользователя нет", () -> T.eq("нет email", Main.emailOf(USERS, "Вера")));
        T.test("пустой список", () -> T.eq("нет email", Main.emailOf(List.of(), "Анна")));
        T.done();
    }
}
