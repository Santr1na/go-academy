---
id: j-control-flow
title: Условия и циклы
summary: if, switch, тернарный оператор, for, while и управление циклом.
xp: 20
---
## if / else

```java
int age = 17;
if (age >= 18) {
    System.out.println("Взрослый");
} else if (age >= 14) {
    System.out.println("Подросток");
} else {
    System.out.println("Ребёнок");
}
```

Условие обязано иметь тип `boolean`. В отличие от C или JavaScript, написать `if (count)` нельзя — только `if (count != 0)`.

Логические операторы: `&&` (И), `||` (ИЛИ), `!` (НЕ). Операторы `&&` и `||` **ленивые** (short-circuit): если результат ясен по левой части, правая не вычисляется.

```java
if (s != null && s.length() > 3) { ... }   // безопасно: при s == null правая часть не выполнится
```

> **Ловушка.** Одиночные `&` и `|` для `boolean` тоже работают, но вычисляют **обе** части всегда. `if (s != null & s.length() > 3)` упадёт с `NullPointerException`.

## Тернарный оператор

```java
String status = age >= 18 ? "взрослый" : "ребёнок";
```

Короткая замена `if/else`, когда нужно выбрать одно из двух значений.

## switch

Классическая форма требует `break`, иначе выполнение «проваливается» в следующую ветку:

```java
switch (day) {
    case 1:
        System.out.println("Пн");
        break;
    case 2:
        System.out.println("Вт");   // нет break — выполнится и следующая ветка!
    default:
        System.out.println("Другой день");
}
```

С Java 14 есть удобная форма со стрелками — без проваливания и с возвратом значения:

```java
String name = switch (day) {
    case 1, 7 -> "Выходной по-восточному";
    case 2 -> "Вторник";
    default -> "Другой день";
};
```

`switch` работает с `int`, `char`, `String`, enum (и их обёртками).

## Циклы

```java
for (int i = 0; i < 5; i++) {          // счётчик: 0, 1, 2, 3, 4
    System.out.println(i);
}

int n = 10;
while (n > 0) {                        // пока условие истинно
    n -= 3;
}

do {                                   // тело выполнится минимум один раз
    n++;
} while (n < 0);

int[] nums = {1, 2, 3};
for (int x : nums) {                   // for-each: по всем элементам
    System.out.println(x);
}
```

- `break` — немедленно выйти из цикла;
- `continue` — перейти к следующей итерации.

Во вложенных циклах `break` выходит только из **внутреннего**. Чтобы выйти из внешнего, используют метку:

```java
outer:
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (i * j == 2) break outer;   // выходим сразу из обоих циклов
    }
}
```

## Типичные ошибки

- **Ошибка на единицу** (off-by-one): `i <= arr.length` вместо `i < arr.length` — выход за границу массива.
- **Точка с запятой после условия**: `if (x > 0);` — тело условия пустое, а блок ниже выполнится всегда.
- **Сравнение строк через `==`**: `if (s == "да")` сравнивает ссылки. Нужно `"да".equals(s)`.
- **Изменение переменной for-each**: `for (int x : nums) x = 0;` массив не меняет — `x` это копия элемента.

@@ quiz
@@ q
Что выведет код?
```java
int day = 2;
switch (day) {
    case 1: System.out.print("A");
    case 2: System.out.print("B");
    case 3: System.out.print("C");
    default: System.out.print("D");
}
```
- [ ] `B`
- [ ] `BC`
- [x] `BCD`
- [ ] `ABCD`
@@ explain
Без `break` выполнение «проваливается» во все следующие ветки, включая `default`. Начинается оно с подходящего `case 2`.

@@ q
Что произойдёт при выполнении?
```java
String s = null;
if (s != null & s.length() > 0) {
    System.out.println("не пусто");
}
```
- [ ] Ничего не напечатается
- [ ] Напечатается `не пусто`
- [x] `NullPointerException`
- [ ] Ошибка компиляции
@@ explain
Одиночный `&` вычисляет обе части всегда, поэтому `s.length()` вызывается у `null`. С ленивым `&&` правая часть не выполнилась бы.

@@ q
Сколько раз напечатается `x`?
```java
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (j == 1) break;
        System.out.print("x");
    }
}
```
- [ ] 1
- [x] 3
- [ ] 6
- [ ] 9
@@ explain
`break` прерывает только внутренний цикл. На каждой из трёх итераций внешнего цикла внутренний успевает напечатать `x` один раз (при `j == 0`) и выходит при `j == 1`.

@@ q
Что выведет код?
```java
int[] nums = {1, 2, 3};
for (int x : nums) {
    x = x * 2;
}
System.out.println(nums[0] + nums[1] + nums[2]);
```
- [x] `6`
- [ ] `12`
- [ ] `0`
- [ ] Ошибка компиляции
@@ explain
В for-each переменная `x` — копия очередного элемента. Присваивание меняет копию, массив остаётся `{1, 2, 3}`. Чтобы изменить массив, нужен цикл по индексу: `nums[i] *= 2`.

@@ task fizzbuzz | FizzBuzz | xp=30 interview
Самая известная разминочная задача с собеседований. Реализуйте метод `fizzBuzz(int n)`, который возвращает:

- `"FizzBuzz"`, если `n` делится и на 3, и на 5;
- `"Fizz"`, если `n` делится на 3;
- `"Buzz"`, если `n` делится на 5;
- само число в виде строки — в остальных случаях.
@@ hint
Проверка делимости: `n % 3 == 0`. Число в строку превращает `String.valueOf(n)`.
@@ hint
Порядок проверок важен: сначала проверьте делимость сразу на 3 и на 5 (то есть на 15), иначе до этой ветки дело не дойдёт.
@@ starter
public class Main {
    static String fizzBuzz(int n) {
        // ваш код
        return "";
    }

    public static void main(String[] args) {
        for (int i = 1; i <= 15; i++) {
            System.out.println(fizzBuzz(i));
        }
    }
}
@@ solution
public class Main {
    static String fizzBuzz(int n) {
        if (n % 15 == 0) return "FizzBuzz";
        if (n % 3 == 0) return "Fizz";
        if (n % 5 == 0) return "Buzz";
        return String.valueOf(n);
    }

    public static void main(String[] args) {
        for (int i = 1; i <= 15; i++) {
            System.out.println(fizzBuzz(i));
        }
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("обычные числа", () -> { T.eq("1", Main.fizzBuzz(1)); T.eq("7", Main.fizzBuzz(7)); T.eq("98", Main.fizzBuzz(98)); });
        T.test("делится на 3", () -> { T.eq("Fizz", Main.fizzBuzz(3)); T.eq("Fizz", Main.fizzBuzz(9)); });
        T.test("делится на 5", () -> { T.eq("Buzz", Main.fizzBuzz(5)); T.eq("Buzz", Main.fizzBuzz(20)); });
        T.test("делится на 3 и на 5", () -> { T.eq("FizzBuzz", Main.fizzBuzz(15)); T.eq("FizzBuzz", Main.fizzBuzz(90)); });
        T.done();
    }
}

@@ task sum-digits | Сумма цифр | xp=30
Реализуйте метод `sumDigits(int n)`, который возвращает сумму цифр числа. Для отрицательных чисел знак игнорируется: `sumDigits(-123)` равно `6`.
@@ hint
Последняя цифра числа — `n % 10`. Отбросить последнюю цифру — `n / 10`.
@@ hint
Сначала уберите знак: `n = Math.abs(n)`. Затем в цикле `while (n > 0)` прибавляйте `n % 10` и делите `n` на 10.
@@ starter
public class Main {
    static int sumDigits(int n) {
        // ваш код
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(sumDigits(12345));
    }
}
@@ solution
public class Main {
    static int sumDigits(int n) {
        n = Math.abs(n);
        int sum = 0;
        while (n > 0) {
            sum += n % 10;
            n /= 10;
        }
        return sum;
    }

    public static void main(String[] args) {
        System.out.println(sumDigits(12345));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("12345 → 15", () -> T.eq(15, Main.sumDigits(12345)));
        T.test("одна цифра", () -> T.eq(7, Main.sumDigits(7)));
        T.test("ноль", () -> T.eq(0, Main.sumDigits(0)));
        T.test("отрицательное число", () -> T.eq(6, Main.sumDigits(-123)));
        T.test("1000000", () -> T.eq(1, Main.sumDigits(1000000)));
        T.done();
    }
}
