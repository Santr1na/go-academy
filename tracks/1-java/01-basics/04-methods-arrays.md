---
id: j-methods-arrays
title: Методы и массивы
summary: Как объявлять методы, как передаются параметры и как устроены массивы.
xp: 20
---
## Методы

Метод — именованный кусок кода с параметрами и возвращаемым значением.

```java
static int max(int a, int b) {     // тип результата, имя, параметры
    return a > b ? a : b;
}

static void greet(String name) {   // void — ничего не возвращает
    System.out.println("Привет, " + name);
}
```

**Перегрузка** (overloading) — несколько методов с одним именем, но разными параметрами. Компилятор выбирает нужный по типам аргументов:

```java
static int sum(int a, int b) { return a + b; }
static double sum(double a, double b) { return a + b; }
static int sum(int... nums) {      // varargs: любое число аргументов, внутри это массив
    int s = 0;
    for (int n : nums) s += n;
    return s;
}
```

Различаться только типом результата перегруженные методы не могут.

## Параметры передаются по значению

Это один из самых частых вопросов на собеседованиях. В Java **всё передаётся по значению** — метод получает копию.

- Для примитива копируется само число: изменить переменную вызывающего кода метод не может.
- Для объекта и массива копируется **ссылка**. Обе ссылки указывают на один и тот же объект, поэтому изменить его *содержимое* метод может, а вот подменить сам объект — нет.

```java
static void change(int x, int[] arr) {
    x = 100;            // меняем локальную копию числа
    arr[0] = 100;       // меняем общий массив — вызывающий код это увидит
    arr = new int[3];   // теперь локальная ссылка смотрит на другой массив
    arr[1] = 200;       // вызывающий код этого не увидит
}

int n = 1;
int[] a = {1, 2, 3};
change(n, a);
// n == 1,  a == {100, 2, 3}
```

## Массивы

Массив — набор элементов одного типа **фиксированной длины**.

```java
int[] a = new int[5];              // пять нулей
int[] b = {3, 1, 2};               // сразу со значениями
System.out.println(b.length);      // 3 — длина это поле, без скобок
b[0] = 10;                         // индексы с нуля
// b[3] = 1;  →  ArrayIndexOutOfBoundsException
```

Элементы нового массива получают значения по умолчанию: `0`, `false`, а для объектов — `null`.

Массив — это **объект**, переменная хранит ссылку на него:

```java
int[] x = {1, 2, 3};
int[] y = x;                       // копируется ссылка, массив один
y[0] = 99;
System.out.println(x[0]);          // 99

int[] copy = x.clone();            // настоящая копия (или Arrays.copyOf(x, x.length))
System.out.println(x == copy);              // false — разные объекты
System.out.println(Arrays.equals(x, copy)); // true — одинаковое содержимое
```

## Полезное из `java.util.Arrays`

```java
import java.util.Arrays;

Arrays.sort(b);                          // сортировка на месте
System.out.println(Arrays.toString(b));  // [1, 2, 10]
int[] big = Arrays.copyOf(b, 5);         // копия другой длины: [1, 2, 10, 0, 0]
Arrays.fill(big, 7);                     // заполнить значением
```

> **Ловушка.** `System.out.println(b)` напечатает что-то вроде `[I@1b6d3586` — тип и хеш объекта, а не содержимое. Для печати используйте `Arrays.toString(b)`.

Двумерный массив — это массив массивов: `int[][] grid = new int[3][4];`, строки могут быть разной длины.

@@ quiz
@@ q
Что выведет код?
```java
static void inc(int x) { x++; }

public static void main(String[] args) {
    int a = 5;
    inc(a);
    System.out.println(a);
}
```
- [x] `5`
- [ ] `6`
- [ ] `0`
- [ ] Ошибка компиляции
@@ explain
Примитив передаётся по значению: метод получает копию числа и увеличивает её. Переменная `a` в `main` не меняется.

@@ q
Что выведет код?
```java
static void fill(int[] arr) {
    arr[0] = 7;
    arr = new int[]{9, 9, 9};
}

public static void main(String[] args) {
    int[] a = {1, 2, 3};
    fill(a);
    System.out.println(a[0] + " " + a[1]);
}
```
- [ ] `1 2`
- [x] `7 2`
- [ ] `9 9`
- [ ] `7 9`
@@ explain
Метод получил копию ссылки на тот же массив, поэтому `arr[0] = 7` видно снаружи. А присваивание `arr = new int[]{...}` меняет только локальную ссылку — исходный массив и переменная `a` остаются прежними.

@@ q
Что выведет код?
```java
int[] a = {1, 2, 3};
int[] b = {1, 2, 3};
System.out.println(a == b);
System.out.println(a.equals(b));
```
- [ ] `true` и `true`
- [ ] `false` и `true`
- [x] `false` и `false`
- [ ] `true` и `false`
@@ explain
`==` сравнивает ссылки — это два разных объекта. Метод `equals` у массивов не переопределён и делает то же самое. Содержимое сравнивает `Arrays.equals(a, b)`.

@@ q
Какое значение у `arr[2]` после `String[] arr = new String[3];`?
- [ ] Пустая строка `""`
- [x] `null`
- [ ] `"0"`
- [ ] Обращение вызовет ошибку
@@ explain
Элементы массива объектов инициализируются `null`. Вызов метода у такого элемента, например `arr[2].length()`, приведёт к `NullPointerException`.

@@ task max | Максимум в массиве | xp=25
Реализуйте метод `max(int[] nums)`, который возвращает наибольший элемент массива. Гарантируется, что массив не пуст. Учтите, что все числа могут быть отрицательными.
@@ hint
Не начинайте с `int max = 0` — для массива из отрицательных чисел ответ получится неверным.
@@ hint
Возьмите за начальное значение первый элемент: `int max = nums[0]`, затем пройдите по остальным.
@@ starter
public class Main {
    static int max(int[] nums) {
        // ваш код
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(max(new int[]{3, 9, 2}));
    }
}
@@ solution
public class Main {
    static int max(int[] nums) {
        int max = nums[0];
        for (int n : nums) {
            if (n > max) max = n;
        }
        return max;
    }

    public static void main(String[] args) {
        System.out.println(max(new int[]{3, 9, 2}));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("обычный массив", () -> T.eq(9, Main.max(new int[]{3, 9, 2})));
        T.test("один элемент", () -> T.eq(4, Main.max(new int[]{4})));
        T.test("только отрицательные", () -> T.eq(-2, Main.max(new int[]{-5, -2, -9})));
        T.test("максимум в конце", () -> T.eq(100, Main.max(new int[]{1, 2, 100})));
        T.done();
    }
}

@@ task reverse | Разворот массива на месте | xp=35 interview
Реализуйте метод `reverse(int[] nums)`, который разворачивает массив **на месте** — без создания второго массива. Метод ничего не возвращает: после вызова сам переданный массив должен содержать элементы в обратном порядке.
@@ hint
Используйте два индекса: `left = 0` и `right = nums.length - 1`. Меняйте элементы местами и двигайте индексы навстречу друг другу.
@@ hint
Обмен через временную переменную: `int tmp = nums[left]; nums[left] = nums[right]; nums[right] = tmp;`. Цикл идёт, пока `left < right`.
@@ starter
import java.util.Arrays;

public class Main {
    static void reverse(int[] nums) {
        // ваш код
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4};
        reverse(a);
        System.out.println(Arrays.toString(a));
    }
}
@@ solution
import java.util.Arrays;

public class Main {
    static void reverse(int[] nums) {
        int left = 0, right = nums.length - 1;
        while (left < right) {
            int tmp = nums[left];
            nums[left] = nums[right];
            nums[right] = tmp;
            left++;
            right--;
        }
    }

    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4};
        reverse(a);
        System.out.println(Arrays.toString(a));
    }
}
@@ test
public class Checker {
    static int[] rev(int... a) { Main.reverse(a); return a; }

    public static void main(String[] args) {
        T.test("чётная длина", () -> T.eq(new int[]{4, 3, 2, 1}, rev(1, 2, 3, 4)));
        T.test("нечётная длина", () -> T.eq(new int[]{3, 2, 1}, rev(1, 2, 3)));
        T.test("один элемент", () -> T.eq(new int[]{5}, rev(5)));
        T.test("пустой массив", () -> T.eq(new int[]{}, rev()));
        T.done();
    }
}
