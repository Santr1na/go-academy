---
id: j-exceptions
title: Исключения
summary: Иерархия, checked и unchecked, try-with-resources и ловушки finally.
xp: 30
---
## Что такое исключение

Исключение — объект, который сообщает об ошибке и прерывает обычный ход выполнения. Оно «летит» вверх по стеку вызовов, пока его кто-нибудь не поймает. Если никто не поймал — поток завершается, а в консоли появляется стек вызовов (stack trace).

```java
try {
    int x = Integer.parseInt("abc");       // бросит NumberFormatException
    System.out.println("сюда не дойдём");
} catch (NumberFormatException e) {
    System.out.println("Не число: " + e.getMessage());
} finally {
    System.out.println("выполняется всегда");
}
```

## Иерархия

```text
Throwable
├── Error                    — сбои JVM: OutOfMemoryError, StackOverflowError. Не ловим.
└── Exception
    ├── RuntimeException     — UNCHECKED: NullPointerException, IllegalArgumentException,
    │                          IndexOutOfBoundsException, ClassCastException, ArithmeticException
    └── все остальные        — CHECKED: IOException, SQLException, InterruptedException
```

**Checked** (проверяемые) — компилятор требует либо поймать их, либо объявить в сигнатуре: `void read() throws IOException`. Это ситуации, которые случаются и в правильной программе: нет файла, оборвалась сеть.

**Unchecked** (непроверяемые) — наследники `RuntimeException`. Обычно это ошибка в коде: обращение к `null`, неверный аргумент. Объявлять и ловить их не обязательно.

## Как бросить и создать своё

```java
class InsufficientFundsException extends RuntimeException {
    InsufficientFundsException(String message) { super(message); }
}

void withdraw(long amount) {
    if (amount > balance) {
        throw new InsufficientFundsException("Не хватает " + (amount - balance));
    }
    balance -= amount;
}
```

Свои исключения в современном коде чаще делают unchecked: они не засоряют сигнатуры и нормально работают в лямбдах и Stream API. Так поступает и Spring.

## Порядок catch

Блоки `catch` проверяются сверху вниз, срабатывает первый подходящий. Поэтому более **конкретные** исключения ставят выше. Обратный порядок не скомпилируется: второй блок недостижим.

```java
try { ... }
catch (FileNotFoundException e) { ... }   // наследник IOException — выше
catch (IOException e) { ... }
catch (IllegalStateException | IllegalArgumentException e) { ... }  // multi-catch
```

## finally и его ловушки

`finally` выполняется всегда: и после нормального завершения, и после исключения, и даже после `return` в `try`. (Не выполнится только при `System.exit()` или гибели JVM.)

```java
static int f() {
    try {
        return 1;
    } finally {
        System.out.println("finally");   // напечатается ДО возврата из метода
    }
}
```

> **Ловушка.** `return` внутри `finally` перекрывает и `return` из `try`, и даже летящее исключение — оно молча пропадает. Никогда не пишите `return` в `finally`.

```java
static int g() {
    try { return 1; }
    finally { return 2; }     // метод вернёт 2
}

static int h() {
    int x = 1;
    try { return x; }         // значение 1 уже вычислено и запомнено
    finally { x = 2; }        // на результат не влияет: метод вернёт 1
}
```

## try-with-resources

Ресурсы (файлы, соединения с базой) обязательно нужно закрывать. Вручную в `finally` это громоздко и легко ошибиться, поэтому есть специальная форма:

```java
try (BufferedReader reader = new BufferedReader(new FileReader("data.txt"))) {
    return reader.readLine();
}   // reader.close() вызовется автоматически — даже при исключении
```

Работает с любым объектом, реализующим `AutoCloseable`. Несколько ресурсов закрываются в порядке, обратном объявлению.

## Плохие практики

- **Проглатывание**: `catch (Exception e) { }` — ошибка исчезает бесследно. Как минимум залогируйте.
- **Ловить `Exception` или `Throwable` «на всякий случай»** — вместе с ожидаемой ошибкой вы поймаете и `NullPointerException` от собственного бага.
- **Потеря причины**: оборачивая, передавайте исходное исключение: `throw new ServiceException("Не удалось сохранить", e);`.
- **Исключения вместо условий**: проверить `if (index < list.size())` дешевле и понятнее, чем ловить `IndexOutOfBoundsException`.

@@ quiz
@@ q
Что вернёт метод?
```java
static int test() {
    try {
        return 1;
    } finally {
        return 2;
    }
}
```
- [ ] `1`
- [x] `2`
- [ ] Ошибка компиляции
- [ ] Исключение во время выполнения
@@ explain
`finally` выполняется перед выходом из метода, и его `return` перекрывает результат из `try`. Компилируется с предупреждением — и это хороший повод так никогда не писать.

@@ q
Что вернёт метод?
```java
static int test() {
    int x = 1;
    try {
        return x;
    } finally {
        x = 2;
    }
}
```
- [x] `1`
- [ ] `2`
- [ ] `0`
- [ ] Ошибка компиляции
@@ explain
Значение для `return` вычисляется и запоминается до выполнения `finally`. Изменение локальной переменной после этого на результат не влияет. (С объектом иначе: если бы возвращалась ссылка на список, а `finally` добавил в него элемент — вызывающий код это увидел бы.)

@@ q
Что напечатает код?
```java
try {
    throw new RuntimeException("A");
} finally {
    System.out.print("F ");
}
System.out.print("END");
```
- [ ] `F END`
- [x] `F `, затем программа завершится с исключением
- [ ] `END`
- [ ] Ничего
@@ explain
`finally` выполнится, но исключение никто не поймал — оно полетит дальше, и до `END` выполнение не дойдёт.

@@ q
Скомпилируется ли код?
```java
try {
    readFile();   // throws IOException
} catch (Exception e) {
    System.out.println("общая ошибка");
} catch (IOException e) {
    System.out.println("ошибка ввода-вывода");
}
```
- [ ] Да, сработает второй блок
- [ ] Да, сработает первый блок
- [x] Нет: второй `catch` недостижим, `IOException` уже перехвачен блоком `Exception`
- [ ] Нет: `IOException` нельзя ловить
@@ explain
Блоки проверяются по порядку, и `Exception` — родитель `IOException` — поймает всё. Компилятор считает недостижимый `catch` ошибкой. Конкретные исключения нужно ставить выше общих.

@@ q
Какое из исключений является проверяемым (checked)?
- [ ] `NullPointerException`
- [ ] `IllegalArgumentException`
- [x] `IOException`
- [ ] `ArithmeticException`
@@ explain
Checked — всё, что наследует `Exception`, но не `RuntimeException`. Остальные три варианта — наследники `RuntimeException`.

@@ task safe-divide | Своё исключение | xp=35
1. Объявите непроверяемое исключение `DivisionByZeroException` (наследник `RuntimeException`) с конструктором, принимающим сообщение.
2. Реализуйте `Main.divide(int a, int b)`: при `b == 0` бросает `DivisionByZeroException` с сообщением `"Деление на ноль: a=<значение a>"`, иначе возвращает `a / b`.
3. Реализуйте `Main.safeDivide(int a, int b, int fallback)`: вызывает `divide` и, если получено `DivisionByZeroException`, возвращает `fallback`.
@@ hint
`class DivisionByZeroException extends RuntimeException { DivisionByZeroException(String m) { super(m); } }`
@@ hint
В `safeDivide`: `try { return divide(a, b); } catch (DivisionByZeroException e) { return fallback; }`.
@@ starter
// объявите DivisionByZeroException

public class Main {
    static int divide(int a, int b) {
        return a / b;
    }

    static int safeDivide(int a, int b, int fallback) {
        return divide(a, b);
    }

    public static void main(String[] args) {
        System.out.println(safeDivide(10, 2, -1));
    }
}
@@ solution
class DivisionByZeroException extends RuntimeException {
    DivisionByZeroException(String message) {
        super(message);
    }
}

public class Main {
    static int divide(int a, int b) {
        if (b == 0) throw new DivisionByZeroException("Деление на ноль: a=" + a);
        return a / b;
    }

    static int safeDivide(int a, int b, int fallback) {
        try {
            return divide(a, b);
        } catch (DivisionByZeroException e) {
            return fallback;
        }
    }

    public static void main(String[] args) {
        System.out.println(safeDivide(10, 2, -1));
        System.out.println(safeDivide(10, 0, -1));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("обычное деление", () -> { T.eq(5, Main.divide(10, 2)); T.eq(-3, Main.divide(-7, 2)); });
        T.test("деление на ноль бросает своё исключение", () -> {
            RuntimeException e = T.throwsEx(DivisionByZeroException.class, () -> Main.divide(7, 0));
            T.eq("Деление на ноль: a=7", e.getMessage());
        });
        T.test("исключение непроверяемое", () -> T.check(RuntimeException.class.isAssignableFrom(DivisionByZeroException.class), "должно наследовать RuntimeException"));
        T.test("safeDivide", () -> { T.eq(5, Main.safeDivide(10, 2, -1)); T.eq(-1, Main.safeDivide(10, 0, -1)); });
        T.done();
    }
}

@@ task resource | Ресурс, который закрывается сам | xp=45 interview
Класс `Connection` имитирует соединение: он пишет свои действия в общий журнал `Main.log`. Сейчас метод `Main.query` оставляет соединение открытым, если `execute` бросает исключение.

1. Сделайте так, чтобы `Connection` можно было использовать в try-with-resources (реализуйте `AutoCloseable`; метод `close()` уже есть).
2. Перепишите `Main.query(String sql)` с try-with-resources: соединение должно закрываться и при успехе, и при исключении. Исключение из `execute` должно долететь до вызывающего кода.
@@ hint
`class Connection implements AutoCloseable` — и метод `close()` должен стать `public`.
@@ hint
`try (Connection c = new Connection()) { return c.execute(sql); }` — блоки `catch` и `finally` не нужны.
@@ starter
import java.util.ArrayList;
import java.util.List;

class Connection {
    Connection() { Main.log.add("open"); }

    String execute(String sql) {
        if (sql.isBlank()) throw new IllegalArgumentException("пустой запрос");
        Main.log.add("execute " + sql);
        return "результат " + sql;
    }

    void close() { Main.log.add("close"); }
}

public class Main {
    static final List<String> log = new ArrayList<>();

    static String query(String sql) {
        Connection c = new Connection();
        String result = c.execute(sql);
        c.close();
        return result;
    }

    public static void main(String[] args) {
        System.out.println(query("SELECT 1"));
        System.out.println(log);
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;

class Connection implements AutoCloseable {
    Connection() { Main.log.add("open"); }

    String execute(String sql) {
        if (sql.isBlank()) throw new IllegalArgumentException("пустой запрос");
        Main.log.add("execute " + sql);
        return "результат " + sql;
    }

    @Override
    public void close() { Main.log.add("close"); }
}

public class Main {
    static final List<String> log = new ArrayList<>();

    static String query(String sql) {
        try (Connection c = new Connection()) {
            return c.execute(sql);
        }
    }

    public static void main(String[] args) {
        System.out.println(query("SELECT 1"));
        System.out.println(log);
    }
}
@@ test
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("Connection реализует AutoCloseable", () -> T.check(AutoCloseable.class.isAssignableFrom(Connection.class), "нужен implements AutoCloseable"));
        T.test("успешный запрос", () -> {
            Main.log.clear();
            T.eq("результат SELECT 1", Main.query("SELECT 1"));
            T.eq(List.of("open", "execute SELECT 1", "close"), Main.log);
        });
        T.test("при исключении соединение закрывается", () -> {
            Main.log.clear();
            T.throwsEx(IllegalArgumentException.class, () -> Main.query(" "));
            T.eq(List.of("open", "close"), Main.log);
        });
        T.test("соединение закрывается ровно один раз", () -> {
            Main.log.clear();
            Main.query("A");
            T.eq(1L, Main.log.stream().filter("close"::equals).count());
        });
        T.done();
    }
}
