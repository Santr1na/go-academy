---
id: j-strings
title: Строки
summary: Неизменяемость String, пул строк, сравнение и StringBuilder.
xp: 25
---
## String — это объект, и он неизменяемый

Строка в Java — объект класса `String`. Главное его свойство: **строку нельзя изменить**. Любой метод, который «меняет» строку, на самом деле возвращает новую.

```java
String s = "java";
s.toUpperCase();              // результат никуда не сохранён
System.out.println(s);        // java

s = s.toUpperCase();          // переменная теперь указывает на новую строку
System.out.println(s);        // JAVA
```

## Сравнение: `==` против `equals`

`==` сравнивает **ссылки** (тот же ли объект), `equals` — **содержимое**.

```java
String a = "hello";
String b = "hello";
String c = new String("hello");

System.out.println(a == b);        // true  — оба литерала взяты из пула строк
System.out.println(a == c);        // false — new всегда создаёт новый объект
System.out.println(a.equals(c));   // true  — содержимое одинаковое
```

**Пул строк** — хранилище, в котором одинаковые строковые литералы существуют в одном экземпляре. Это экономит память и безопасно именно потому, что строки неизменяемы.

> **Важно.** Строки всегда сравнивают через `equals`. Сравнение через `==` «иногда работает» из-за пула — и это делает ошибку особенно коварной: в тестах всё хорошо, а на строке, пришедшей от пользователя или из базы, сравнение даёт `false`.

Чтобы не получить `NullPointerException`, константу ставят слева: `"да".equals(answer)`. Без учёта регистра: `equalsIgnoreCase`.

## Основные методы

```java
String s = "  Привет, мир  ";
s.length();              // 15 — длина
s.trim();                // "Привет, мир" — без пробелов по краям (strip() — то же для Unicode)
s.charAt(2);             // 'П' — символ по индексу
s.indexOf("мир");        // 10 — позиция подстроки или -1
s.contains("мир");       // true
s.substring(2, 8);       // "Привет" — с индекса 2 включительно до 8 не включая
s.replace("мир", "Java");
s.isEmpty();             // длина 0?
s.isBlank();             // пусто или только пробелы?
"a,b,c".split(",");      // ["a", "b", "c"]
String.join("-", "a", "b");   // "a-b"
"abc".toCharArray();     // ['a', 'b', 'c']
String.valueOf(42);      // "42"
Integer.parseInt("42");  // 42
```

## StringBuilder: склейка в цикле

Раз строка неизменяема, каждое `+=` создаёт новый объект и копирует в него всё накопленное:

```java
String s = "";
for (int i = 0; i < 100_000; i++) {
    s += i;                      // 100 000 новых строк, время растёт квадратично
}
```

Для сборки строки по частям есть изменяемый `StringBuilder`:

```java
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 100_000; i++) {
    sb.append(i);                // дописывает в один и тот же буфер
}
String result = sb.toString();
```

Полезные методы: `append`, `insert`, `reverse`, `deleteCharAt`, `length`, `setLength(0)`.

| | Изменяемый | Потокобезопасный | Когда использовать |
|---|---|---|---|
| `String` | нет | да (неизменяем) | обычные строки |
| `StringBuilder` | да | нет | сборка строки — по умолчанию |
| `StringBuffer` | да | да (`synchronized`) | почти никогда, устаревший выбор |

## Символы

`char` — это число (код символа), поэтому с ним работает арифметика:

```java
char c = 'a';
c++;                              // 'b'
int digit = '7' - '0';            // 7 — частый приём для перевода символа-цифры в число
Character.isDigit('7');           // true
Character.isLetter('ж');          // true
Character.toUpperCase('ж');       // 'Ж'
```

> **На собеседовании.** «Сколько объектов создаст `String s = new String("abc");`?» — до двух: литерал `"abc"` в пуле (если его там ещё не было) и отдельный объект в куче, созданный оператором `new`.

@@ quiz
@@ q
Что выведет код?
```java
String a = "java";
String b = "ja" + "va";
String c = new String("java");
System.out.println((a == b) + " " + (a == c));
```
- [x] `true false`
- [ ] `true true`
- [ ] `false false`
- [ ] `false true`
@@ explain
`"ja" + "va"` — выражение из констант, компилятор вычисляет его заранее и получает литерал `"java"` из пула, тот же объект, что и `a`. А `new String(...)` всегда создаёт новый объект.

@@ q
Что выведет код?
```java
String s1 = "ja";
String s2 = s1 + "va";
System.out.println(s2 == "java");
```
- [ ] `true`
- [x] `false`
- [ ] Ошибка компиляции
- [ ] `NullPointerException`
@@ explain
Здесь в склейке участвует переменная, а не константа, поэтому строка собирается во время выполнения и получается новый объект вне пула. Содержимое то же, ссылки разные. Ещё одна причина сравнивать строки только через `equals`.

@@ q
Что выведет код?
```java
String s = "Hello";
s.concat(" World");
s.toUpperCase();
System.out.println(s);
```
- [ ] `HELLO WORLD`
- [ ] `Hello World`
- [x] `Hello`
- [ ] `HELLO`
@@ explain
Строки неизменяемы: `concat` и `toUpperCase` возвращают новые строки, а здесь результат отброшен. Переменная `s` по-прежнему указывает на `"Hello"`.

@@ q
Чему равно `"abcdef".substring(2, 4)`?
- [ ] `"bcd"`
- [ ] `"cde"`
- [x] `"cd"`
- [ ] `"bc"`
@@ explain
Начальный индекс включается, конечный — нет. Индексы 2 и 3 — это символы `c` и `d`. Длина результата всегда равна разности индексов.

@@ q
Почему для сборки длинной строки в цикле используют `StringBuilder`?
- [ ] `String` не поддерживает оператор `+`
- [ ] `StringBuilder` потокобезопасен
- [x] Каждая склейка `String` создаёт новый объект и копирует всё накопленное содержимое
- [ ] У `String` ограничена длина
@@ explain
Из-за неизменяемости `s += x` в цикле даёт квадратичное время и много мусора. `StringBuilder` дописывает в один буфер. Потокобезопасным он как раз не является — этим отличается `StringBuffer`.

@@ task palindrome | Палиндром | xp=35 interview
Реализуйте метод `isPalindrome(String s)`, который возвращает `true`, если строка читается одинаково слева направо и справа налево. Регистр букв не важен, а все символы, кроме букв и цифр, игнорируются.

Примеры: `"А роза упала на лапу Азора"` → `true`, `"Java"` → `false`, пустая строка → `true`.
@@ hint
Удобно идти двумя индексами с краёв к середине, пропуская символы, для которых `Character.isLetterOrDigit(c)` ложно.
@@ hint
Сравнивайте символы без учёта регистра: `Character.toLowerCase(s.charAt(i)) != Character.toLowerCase(s.charAt(j))` — значит, не палиндром.
@@ starter
public class Main {
    static boolean isPalindrome(String s) {
        // ваш код
        return false;
    }

    public static void main(String[] args) {
        System.out.println(isPalindrome("А роза упала на лапу Азора"));
    }
}
@@ solution
public class Main {
    static boolean isPalindrome(String s) {
        int i = 0, j = s.length() - 1;
        while (i < j) {
            if (!Character.isLetterOrDigit(s.charAt(i))) { i++; continue; }
            if (!Character.isLetterOrDigit(s.charAt(j))) { j--; continue; }
            if (Character.toLowerCase(s.charAt(i)) != Character.toLowerCase(s.charAt(j))) return false;
            i++;
            j--;
        }
        return true;
    }

    public static void main(String[] args) {
        System.out.println(isPalindrome("А роза упала на лапу Азора"));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("простой палиндром", () -> T.eq(true, Main.isPalindrome("level")));
        T.test("не палиндром", () -> T.eq(false, Main.isPalindrome("Java")));
        T.test("регистр и пробелы", () -> T.eq(true, Main.isPalindrome("А роза упала на лапу Азора")));
        T.test("знаки препинания", () -> T.eq(true, Main.isPalindrome("A man, a plan, a canal: Panama")));
        T.test("пустая строка", () -> T.eq(true, Main.isPalindrome("")));
        T.test("почти палиндром", () -> T.eq(false, Main.isPalindrome("abca")));
        T.done();
    }
}

@@ task compress | Сжатие строки | xp=40 interview
Реализуйте метод `compress(String s)`, который заменяет повторяющиеся подряд символы на символ и количество повторов: `"aaabbc"` → `"a3b2c1"`.

Если сжатая строка **не короче** исходной, верните исходную строку: `"abc"` → `"abc"` (потому что `"a1b1c1"` длиннее). Пустая строка остаётся пустой. Собирайте результат через `StringBuilder`.
@@ hint
Идите по строке и считайте длину текущей серии. Когда символ меняется (или строка кончилась), дописывайте в `StringBuilder` символ и счётчик.
@@ hint
Удобно проверять «конец серии» так: `i + 1 == s.length() || s.charAt(i + 1) != s.charAt(i)`. В конце сравните длины: `sb.length() < s.length() ? sb.toString() : s`.
@@ starter
public class Main {
    static String compress(String s) {
        // ваш код
        return s;
    }

    public static void main(String[] args) {
        System.out.println(compress("aaabbc"));
    }
}
@@ solution
public class Main {
    static String compress(String s) {
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            count++;
            if (i + 1 == s.length() || s.charAt(i + 1) != s.charAt(i)) {
                sb.append(s.charAt(i)).append(count);
                count = 0;
            }
        }
        return sb.length() < s.length() ? sb.toString() : s;
    }

    public static void main(String[] args) {
        System.out.println(compress("aaabbc"));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("aaabbbcc", () -> T.eq("a3b3c2", Main.compress("aaabbbcc")));
        T.test("длинная серия", () -> T.eq("a12", Main.compress("aaaaaaaaaaaa")));
        T.test("сжатие не выгодно", () -> T.eq("abc", Main.compress("abc")));
        T.test("та же длина — исходная строка", () -> T.eq("aabb", Main.compress("aabb")));
        T.test("пустая строка", () -> T.eq("", Main.compress("")));
        T.test("серии с повтором символа", () -> T.eq("a3b1a3", Main.compress("aaabaaa")));
        T.done();
    }
}
