---
id: j-hashmap
title: HashMap изнутри
summary: Корзины, коллизии, resize и treeify — главный вопрос собеседований по коллекциям.
xp: 30
---
## Основные операции

```java
Map<String, Integer> stock = new HashMap<>();
stock.put("яблоки", 10);                 // добавить или заменить; возвращает прежнее значение или null
stock.get("яблоки");                     // 10
stock.get("груши");                      // null — ключа нет
stock.getOrDefault("груши", 0);          // 0
stock.containsKey("яблоки");
stock.remove("яблоки");

for (Map.Entry<String, Integer> e : stock.entrySet()) {
    System.out.println(e.getKey() + " = " + e.getValue());
}
```

Методы, которые избавляют от «проверил — положил»:

```java
counts.merge(word, 1, Integer::sum);                           // счётчик
groups.computeIfAbsent(key, k -> new ArrayList<>()).add(x);    // группировка
cache.putIfAbsent(key, value);
```

## Как устроена HashMap

Внутри — массив **корзин** (buckets), по умолчанию из 16 штук. Разберём `put(key, value)` по шагам:

1. Вычисляется `key.hashCode()`; старшие биты хеша подмешиваются к младшим (`h ^ (h >>> 16)`), чтобы хеши, различающиеся только «наверху», не попадали в одну корзину.
2. Индекс корзины: `(n - 1) & hash`, где `n` — длина массива. Длина всегда степень двойки, поэтому это быстрая замена остатка от деления.
3. Корзина пуста — кладём туда новый узел `(hash, key, value, next)`.
4. Корзина занята — **коллизия**. Узлы корзины перебираются: если найден узел с таким же хешем и `key.equals(...)`, его значение заменяется; иначе новый узел добавляется в конец цепочки.

```text
table:  [0] → null
        [1] → ("кот", 5) → ("ток", 7)      ← коллизия: два ключа в одной корзине
        [2] → null
        [3] → ("дом", 1)
```

`get(key)` повторяет шаги 1–2 и ищет в корзине узел через `equals`. Отсюда контракт: **равные объекты обязаны иметь равные хеши**, иначе поиск пойдёт не в ту корзину.

## Resize

Чем больше элементов, тем длиннее цепочки. Когда число элементов превышает `capacity × loadFactor` (16 × 0.75 = 12), массив **удваивается**, и все узлы перераспределяются по новым корзинам. Это дорогая операция O(n). Если размер известен заранее, задайте ёмкость в конструкторе: `new HashMap<>(expectedSize * 4 / 3 + 1)`.

Коэффициент 0.75 — компромисс: меньше — тратится память, больше — растут цепочки.

## Treeify

Если в одной корзине накапливается больше 8 узлов (а массив не меньше 64 корзин), цепочка превращается в **красно-чёрное дерево** — поиск в ней становится O(log n) вместо O(n). Это защита от плохих хеш-функций и атак, когда в сервис специально присылают ключи с одинаковым хешем.

| | Среднее | Худший случай |
|---|---|---|
| `get` / `put` / `remove` | O(1) | O(log n) с Java 8 (раньше O(n)) |

## Что ещё нужно знать

- Допускается один ключ `null` (он попадает в корзину 0) и сколько угодно значений `null`. Поэтому `get(k) == null` не означает, что ключа нет, — проверяйте `containsKey`.
- Порядок обхода **не определён** и может измениться после resize. Нужен порядок вставки — `LinkedHashMap`, нужна сортировка — `TreeMap`.
- `HashMap` **не потокобезопасна**. Одновременная запись из нескольких потоков приводит к потере данных; для этого есть `ConcurrentHashMap`.
- Ключ должен быть неизменяемым: изменился хеш — запись потеряна в старой корзине.

> **На собеседовании.** «Расскажите, как работает HashMap» — отвечайте по шагам: хеш → индекс корзины → коллизии и `equals` → resize при 0.75 → деревья с Java 8. Частые добавочные вопросы: «почему размер — степень двойки?», «что если у всех ключей одинаковый `hashCode`?», «может ли `null` быть ключом?».

@@ quiz
@@ q
Как `HashMap` определяет корзину для ключа?
- [ ] По порядку добавления
- [ ] Вызывает `equals` со всеми ключами
- [x] По хешу ключа: `(n - 1) & hash`
- [ ] По адресу объекта в памяти
@@ explain
Сначала вычисляется хеш, по нему — индекс корзины. `equals` вызывается только внутри найденной корзины, для ключей с таким же хешем.

@@ q
Что происходит, когда два разных ключа попадают в одну корзину?
- [ ] Второй ключ заменяет первый
- [ ] Бросается исключение
- [x] Оба хранятся в корзине: в связном списке, а при большой длине — в дереве
- [ ] Массив корзин сразу увеличивается
@@ explain
Это коллизия, обычная ситуация. Узлы образуют цепочку, а при поиске ключи в корзине сравниваются через `equals`. Замена произойдёт только если ключи равны.

@@ q
Что выведет код?
```java
Map<String, Integer> map = new HashMap<>();
map.put("a", null);
System.out.println(map.get("a") + " " + map.get("b") + " " + map.containsKey("a"));
```
- [ ] `null null false`
- [x] `null null true`
- [ ] `NullPointerException`
- [ ] `0 0 true`
@@ explain
`HashMap` допускает `null`-значения. `get` возвращает `null` и для ключа со значением `null`, и для отсутствующего ключа — различить их может только `containsKey`.

@@ q
В `HashMap` с параметрами по умолчанию (16 корзин, load factor 0.75) добавляют 13-й элемент. Что произойдёт?
- [ ] Ничего особенного
- [ ] Самая длинная цепочка превратится в дерево
- [x] Массив корзин увеличится до 32, элементы перераспределятся
- [ ] Будет брошено исключение
@@ explain
Порог равен 16 × 0.75 = 12. Как только элементов становится больше, таблица удваивается (resize).

@@ q
У всех объектов-ключей `hashCode()` возвращает одно и то же число. Что будет с `HashMap`?
- [ ] Она перестанет работать правильно
- [x] Работать будет правильно, но медленно: все ключи окажутся в одной корзине
- [ ] В ней сможет храниться только один элемент
- [ ] Она будет бросать исключения при вставке
@@ explain
Корректность обеспечивает `equals`, скорость — хорошее распределение хешей. При одинаковых хешах таблица вырождается в одну длинную цепочку (или дерево), и операции перестают быть O(1).

@@ task word-count | Подсчёт слов | xp=35 interview
Реализуйте `Main.wordCount(String text)`: метод возвращает `Map<String, Integer>` — сколько раз каждое слово встречается в тексте.

Слова разделены одним или несколькими пробелами; регистр не учитывается (`"Кот"` и `"кот"` — одно слово, ключи в нижнем регистре). Для пустой строки или строки из одних пробелов верните пустую мапу.
@@ hint
Разбить строку: `text.trim().toLowerCase().split("\\s+")`. Осторожно: для пустой строки `split` вернёт массив из одной пустой строки — её надо пропустить.
@@ hint
Счётчик в одну строку: `map.merge(word, 1, Integer::sum);`.
@@ starter
import java.util.HashMap;
import java.util.Map;

public class Main {
    static Map<String, Integer> wordCount(String text) {
        return new HashMap<>();
    }

    public static void main(String[] args) {
        System.out.println(wordCount("кот и Кот и пёс"));
    }
}
@@ solution
import java.util.HashMap;
import java.util.Map;

public class Main {
    static Map<String, Integer> wordCount(String text) {
        Map<String, Integer> map = new HashMap<>();
        for (String word : text.trim().toLowerCase().split("\\s+")) {
            if (word.isEmpty()) continue;
            map.merge(word, 1, Integer::sum);
        }
        return map;
    }

    public static void main(String[] args) {
        System.out.println(wordCount("кот и Кот и пёс"));
    }
}
@@ test
import java.util.Map;

public class Checker {
    public static void main(String[] args) {
        T.test("обычный текст", () -> T.eq(Map.of("кот", 2, "и", 2, "пёс", 1), Main.wordCount("кот и Кот и пёс")));
        T.test("несколько пробелов", () -> T.eq(Map.of("a", 2, "b", 1), Main.wordCount("  a   b  A ")));
        T.test("пустая строка", () -> T.eq(Map.of(), Main.wordCount("")));
        T.test("только пробелы", () -> T.eq(Map.of(), Main.wordCount("   ")));
        T.test("одно слово", () -> T.eq(Map.of("java", 1), Main.wordCount("Java")));
        T.done();
    }
}

@@ task two-sum | Two Sum | xp=45 interview
Классика собеседований. Реализуйте `Main.twoSum(int[] nums, int target)`: найдите два **разных по позиции** элемента, сумма которых равна `target`, и верните их индексы в порядке возрастания. Если такой пары нет, верните пустой массив.

Решение должно работать за O(n): массив может содержать сотни тысяч элементов. Гарантируется, что подходящая пара не более чем одна.
@@ hint
Перебор всех пар — O(n²). Идите по массиву один раз и запоминайте в `HashMap` уже встреченные числа и их индексы.
@@ hint
Для текущего числа `x` ищите в мапе `target - x`: если нашлось — ответ готов, если нет — кладите `x → i`. Проверять нужно **до** добавления, чтобы элемент не образовал пару сам с собой.
@@ starter
import java.util.Arrays;

public class Main {
    static int[] twoSum(int[] nums, int target) {
        return new int[0];
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(twoSum(new int[]{2, 7, 11, 15}, 9)));
    }
}
@@ solution
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class Main {
    static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            Integer j = seen.get(target - nums[i]);
            if (j != null) return new int[]{j, i};
            seen.put(nums[i], i);
        }
        return new int[0];
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(twoSum(new int[]{2, 7, 11, 15}, 9)));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("пример из условия", () -> T.eq(new int[]{0, 1}, Main.twoSum(new int[]{2, 7, 11, 15}, 9)));
        T.test("пара в конце", () -> T.eq(new int[]{2, 3}, Main.twoSum(new int[]{1, 5, 3, 4}, 7)));
        T.test("одинаковые числа", () -> T.eq(new int[]{0, 1}, Main.twoSum(new int[]{3, 3}, 6)));
        T.test("элемент не складывается сам с собой", () -> T.eq(new int[]{}, Main.twoSum(new int[]{3, 1}, 6)));
        T.test("отрицательные числа", () -> T.eq(new int[]{0, 2}, Main.twoSum(new int[]{-3, 4, 3}, 0)));
        T.test("пары нет", () -> T.eq(new int[]{}, Main.twoSum(new int[]{1, 2, 3}, 100)));
        T.test("300 000 элементов", () -> {
            int n = 300_000;
            int[] a = new int[n];
            for (int i = 0; i < n; i++) a[i] = i * 2;
            T.eq(new int[]{n - 2, n - 1}, Main.twoSum(a, (n - 2) * 2 + (n - 1) * 2));
        });
        T.done();
    }
}
