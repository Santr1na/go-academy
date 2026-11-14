---
id: j-algorithms
title: Сложность алгоритмов и типовые приёмы
summary: O-нотация, бинарный поиск, два указателя и скользящее окно.
xp: 35
---
## O-нотация

На собеседовании после любой задачи спросят: «Какая сложность у вашего решения?» O-нотация описывает, как растёт время (или память) с ростом размера входа `n`. Константы и младшие слагаемые отбрасываются.

| Сложность | Название | Пример | n = 1 000 000 |
|---|---|---|---|
| O(1) | константная | `HashMap.get`, доступ по индексу | 1 операция |
| O(log n) | логарифмическая | бинарный поиск, `TreeMap.get` | ~20 |
| O(n) | линейная | один проход по массиву | 1 000 000 |
| O(n log n) | | сортировка | ~20 000 000 |
| O(n²) | квадратичная | вложенный цикл по всем парам | 10¹² — слишком долго |
| O(2ⁿ) | экспоненциальная | перебор всех подмножеств | невозможно |

Как оценивать: последовательные участки складываются (берём больший), вложенные циклы перемножаются. Не забывайте скрытую сложность методов: `list.contains` внутри цикла — это уже O(n²), склейка строк через `+=` в цикле — тоже.

## Приём 1: хеш-таблица вместо вложенного цикла

«Найти пару», «найти дубликат», «посчитать частоты» — почти всегда решается одним проходом с `HashMap` или `HashSet`: O(n) времени ценой O(n) памяти. Так решалась задача Two Sum.

## Приём 2: бинарный поиск

Если данные **отсортированы**, искать нужно делением пополам — O(log n).

```java
static int binarySearch(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;       // не (lo + hi) / 2 — переполнение!
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
```

> **Ловушка.** `(lo + hi) / 2` переполняется на больших массивах — эта ошибка годами жила в стандартной библиотеке Java. Пишите `lo + (hi - lo) / 2`.

## Приём 3: два указателя

Два индекса движутся по массиву навстречу друг другу или в одну сторону. Так разворачивают массив, проверяют палиндром, ищут пару с заданной суммой в **отсортированном** массиве за O(n) без дополнительной памяти, удаляют дубликаты на месте.

## Приём 4: скользящее окно

Задачи про «самый длинный / короткий непрерывный участок с условием». Окно `[left, right]` расширяется вправо; как только условие нарушено — левая граница сдвигается. Каждый элемент входит в окно и выходит из него не более одного раза — итого O(n).

```java
// длина самой длинной подстроки без повторяющихся символов
int left = 0, best = 0;
Map<Character, Integer> last = new HashMap<>();   // символ → его последняя позиция
for (int right = 0; right < s.length(); right++) {
    char c = s.charAt(right);
    if (last.containsKey(c) && last.get(c) >= left) left = last.get(c) + 1;
    last.put(c, right);
    best = Math.max(best, right - left + 1);
}
```

## Как вести себя на задаче

1. Повторите условие своими словами, уточните ограничения и крайние случаи (пустой вход, один элемент, дубликаты, отрицательные числа).
2. Проговорите простое решение и его сложность — даже если оно O(n²).
3. Предложите улучшение, назовите структуру данных.
4. Пишите код, комментируя вслух.
5. Пройдите пример вручную и назовите итоговую сложность по времени и памяти.

Молчаливое написание кода — худшая стратегия: интервьюер оценивает ход мысли.

@@ quiz
@@ q
Какова сложность кода?
```java
for (int i = 0; i < list.size(); i++) {
    if (other.contains(list.get(i))) count++;
}
```
`list` и `other` — `ArrayList` размера n.
- [ ] O(n)
- [ ] O(n log n)
- [x] O(n²)
- [ ] O(1)
@@ explain
`contains` у `ArrayList` — линейный поиск, и он вызывается n раз. Если заменить `other` на `HashSet`, получится O(n).

@@ q
Массив из миллиона отсортированных чисел. Сколько примерно сравнений нужно бинарному поиску в худшем случае?
- [ ] 1 000 000
- [ ] 1000
- [x] 20
- [ ] 2
@@ explain
Каждое сравнение делит область поиска пополам: log₂(1 000 000) ≈ 20.

@@ q
Почему середину считают как `lo + (hi - lo) / 2`, а не `(lo + hi) / 2`?
- [ ] Так быстрее
- [ ] Результаты отличаются для чётных длин
- [x] Сумма `lo + hi` может переполнить `int` на больших массивах
- [ ] Деление на 2 нельзя применять к сумме
@@ explain
При индексах больше миллиарда сумма выходит за пределы `int` и становится отрицательной — получаем отрицательный индекс и исключение.

@@ q
Решение использует `HashSet` для хранения всех элементов массива и один проход. Какова его сложность по времени и памяти?
- [ ] Время O(1), память O(n)
- [x] Время O(n), память O(n)
- [ ] Время O(n²), память O(1)
- [ ] Время O(n log n), память O(1)
@@ explain
Один проход с операциями O(1) даёт O(n) времени. Множество в худшем случае хранит все n элементов. Обмен памяти на время — самый частый компромисс.

@@ task binary-search | Первое вхождение | xp=45 interview
Реализуйте `Main.firstIndex(int[] sorted, int target)`: массив отсортирован по возрастанию и может содержать повторы. Верните индекс **первого** вхождения `target` или `-1`, если его нет.

Решение должно работать за O(log n) — линейный проход не пройдёт тест на время.
@@ hint
Обычный бинарный поиск останавливается на любом совпадении. Здесь, найдя `target`, запомните индекс и продолжайте искать **левее**: `hi = mid - 1`.
@@ hint
```java
int ans = -1;
while (lo <= hi) {
    int mid = lo + (hi - lo) / 2;
    if (a[mid] >= target) { if (a[mid] == target) ans = mid; hi = mid - 1; }
    else lo = mid + 1;
}
```
@@ starter
public class Main {
    static int firstIndex(int[] sorted, int target) {
        return -1;
    }

    public static void main(String[] args) {
        System.out.println(firstIndex(new int[]{1, 2, 2, 2, 5}, 2));
    }
}
@@ solution
public class Main {
    static int firstIndex(int[] sorted, int target) {
        int lo = 0, hi = sorted.length - 1, ans = -1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (sorted[mid] >= target) {
                if (sorted[mid] == target) ans = mid;
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        }
        return ans;
    }

    public static void main(String[] args) {
        System.out.println(firstIndex(new int[]{1, 2, 2, 2, 5}, 2));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("повторы", () -> T.eq(1, Main.firstIndex(new int[]{1, 2, 2, 2, 5}, 2)));
        T.test("нет элемента", () -> { T.eq(-1, Main.firstIndex(new int[]{1, 3, 5}, 4)); T.eq(-1, Main.firstIndex(new int[]{1, 3, 5}, 0)); T.eq(-1, Main.firstIndex(new int[]{1, 3, 5}, 9)); });
        T.test("края массива", () -> { T.eq(0, Main.firstIndex(new int[]{1, 3, 5}, 1)); T.eq(2, Main.firstIndex(new int[]{1, 3, 5}, 5)); });
        T.test("пустой и одноэлементный", () -> { T.eq(-1, Main.firstIndex(new int[]{}, 1)); T.eq(0, Main.firstIndex(new int[]{7}, 7)); });
        T.test("все элементы одинаковые", () -> T.eq(0, Main.firstIndex(new int[]{4, 4, 4, 4}, 4)));
        T.test("O(log n): 20 млн элементов, 200 000 запросов", () -> {
            int[] big = new int[20_000_000];
            for (int i = 0; i < big.length; i++) big[i] = i / 2;
            long start = System.nanoTime();
            long sum = 0;
            for (int q = 0; q < 200_000; q++) sum += Main.firstIndex(big, 9_000_000 + q);
            long ms = (System.nanoTime() - start) / 1_000_000;
            T.eq(200_000L * 18_000_000 + 2L * (199_999L * 200_000 / 2), sum);
            T.check(ms < 2000, "слишком медленно (" + ms + " мс) — похоже на линейный поиск");
        });
        T.done();
    }
}

@@ task longest-unique | Самая длинная подстрока без повторов | xp=55 interview
Реализуйте `Main.longestUnique(String s)`: верните длину самой длинной подстроки (непрерывного участка), в которой все символы различны.

`"abcabcbb"` → `3` (`abc`), `"bbbbb"` → `1`, `"pwwkew"` → `3` (`wke`), `""` → `0`. Нужно решение за O(n).
@@ hint
Скользящее окно: держите левую границу `left` и мапу «символ → последняя позиция».
@@ hint
Если текущий символ уже встречался на позиции `p >= left`, сдвиньте `left = p + 1`. Проверка `>= left` обязательна: старое вхождение за пределами окна не считается (пример — `"abba"`).
@@ starter
public class Main {
    static int longestUnique(String s) {
        return 0;
    }

    public static void main(String[] args) {
        System.out.println(longestUnique("abcabcbb"));
    }
}
@@ solution
import java.util.HashMap;
import java.util.Map;

public class Main {
    static int longestUnique(String s) {
        Map<Character, Integer> last = new HashMap<>();
        int left = 0, best = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            Integer p = last.get(c);
            if (p != null && p >= left) left = p + 1;
            last.put(c, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }

    public static void main(String[] args) {
        System.out.println(longestUnique("abcabcbb"));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("abcabcbb", () -> T.eq(3, Main.longestUnique("abcabcbb")));
        T.test("bbbbb", () -> T.eq(1, Main.longestUnique("bbbbb")));
        T.test("pwwkew", () -> T.eq(3, Main.longestUnique("pwwkew")));
        T.test("пустая строка", () -> T.eq(0, Main.longestUnique("")));
        T.test("abba", () -> T.eq(2, Main.longestUnique("abba")));
        T.test("все символы разные", () -> T.eq(6, Main.longestUnique("abcdef")));
        T.test("dvdf", () -> T.eq(3, Main.longestUnique("dvdf")));
        T.test("длинная строка за O(n)", () -> {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 400_000; i++) sb.append((char) ('a' + i % 26));
            long start = System.nanoTime();
            T.eq(26, Main.longestUnique(sb.toString()));
            T.check((System.nanoTime() - start) / 1_000_000 < 1500, "слишком медленно");
        });
        T.done();
    }
}
