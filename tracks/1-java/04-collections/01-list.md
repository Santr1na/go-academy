---
id: j-list
title: List — ArrayList и LinkedList
summary: Как устроены списки, сколько стоят операции и что выбирать.
xp: 25
---
## Иерархия коллекций

```text
Iterable
└── Collection
    ├── List   — порядок, доступ по индексу, дубликаты разрешены
    ├── Set    — без дубликатов
    └── Queue  — очереди; Deque — двусторонняя очередь

Map — пары «ключ → значение» (отдельная иерархия, не наследует Collection)
```

Переменные объявляют типом интерфейса: `List<String> names = new ArrayList<>();`.

## ArrayList

Внутри — обычный массив. Когда он заполняется, создаётся новый, в полтора раза больше, и элементы копируются.

```java
List<String> list = new ArrayList<>();
list.add("a");              // в конец
list.add(0, "b");           // вставка по индексу — сдвигает остальные
list.get(1);                // "a"
list.set(1, "c");           // замена
list.remove(0);             // удаление по индексу
list.contains("c");         // линейный поиск
list.size();
```

## LinkedList

Двусвязный список: каждый элемент лежит в отдельном узле со ссылками на соседей. Реализует и `List`, и `Deque`.

## Сложность операций

| Операция | `ArrayList` | `LinkedList` |
|---|---|---|
| `get(i)` | **O(1)** | O(n) — идём от ближайшего края |
| `add(x)` в конец | O(1) амортизированно | O(1) |
| вставка/удаление в начале | O(n) — сдвиг всех элементов | **O(1)** |
| вставка/удаление в середине | O(n) — сдвиг | O(n) — поиск узла |
| `contains(x)` | O(n) | O(n) |
| память | компактно | узел + две ссылки на каждый элемент |

«Амортизированно O(1)» значит: большинство добавлений мгновенны, изредка случается дорогое копирование массива, но в среднем на элемент выходит константа.

**Что выбирать.** Почти всегда `ArrayList`. Даже вставка в середину у него на практике часто быстрее: элементы лежат в памяти подряд, и процессор эффективно их кеширует, тогда как узлы `LinkedList` разбросаны по куче. Для очереди или стека берите `ArrayDeque`.

> **На собеседовании.** Вопрос «ArrayList или LinkedList» задают почти всегда. Хороший ответ — таблица выше плюс замечание про кеш процессора и память.

## Неизменяемые и «почти» изменяемые списки

```java
List<String> a = List.of("x", "y");          // неизменяемый: add/set/remove → UnsupportedOperationException, null запрещён
List<String> b = Arrays.asList("x", "y");    // фиксированного размера: set можно, add/remove нельзя
List<String> c = new ArrayList<>(a);         // обычная изменяемая копия
List<String> d = Collections.unmodifiableList(c);   // неизменяемое ПРЕДСТАВЛЕНИЕ: изменения c видны через d
```

## Удаление во время обхода

```java
for (String s : list) {
    if (s.isEmpty()) list.remove(s);     // ConcurrentModificationException
}
```

Цикл for-each использует итератор, а итератор замечает, что список изменили в обход него. Правильно:

```java
list.removeIf(String::isEmpty);          // проще всего

Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().isEmpty()) it.remove();   // удаление через сам итератор
}
```

## Сортировка

```java
list.sort(null);                                   // естественный порядок
list.sort(Comparator.reverseOrder());
people.sort(Comparator.comparing(Person::age).thenComparing(Person::name));
```

@@ quiz
@@ q
Какая операция выполняется за O(1) у `ArrayList`, но за O(n) у `LinkedList`?
- [ ] Добавление в конец
- [x] Получение элемента по индексу
- [ ] Удаление первого элемента
- [ ] Поиск элемента по значению
@@ explain
`ArrayList` — массив, доступ по индексу мгновенный. `LinkedList` вынужден идти по ссылкам от начала или конца. Удаление первого элемента — наоборот, O(1) у `LinkedList` и O(n) у `ArrayList`.

@@ q
Что произойдёт?
```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3, 4));
for (Integer x : list) {
    if (x == 2) list.remove(x);
}
```
- [ ] Список станет `[1, 3, 4]`
- [x] `ConcurrentModificationException`
- [ ] Ошибка компиляции
- [ ] Список не изменится
@@ explain
Список изменён в обход итератора, и при следующем шаге итератор бросает исключение. Потоки для этого не нужны. Используйте `removeIf` или `Iterator.remove()`.

@@ q
Что произойдёт?
```java
List<String> list = Arrays.asList("a", "b");
list.set(0, "z");
list.add("c");
```
- [ ] Список станет `[z, b, c]`
- [x] `set` сработает, а `add` бросит `UnsupportedOperationException`
- [ ] Обе операции бросят исключение
- [ ] Ошибка компиляции
@@ explain
`Arrays.asList` возвращает список фиксированного размера поверх массива: менять элементы можно, менять размер — нет. `List.of` запрещает и то, и другое.

@@ q
Что выведет код?
```java
List<String> src = new ArrayList<>(List.of("a"));
List<String> view = Collections.unmodifiableList(src);
src.add("b");
System.out.println(view.size());
```
- [ ] `1`
- [x] `2`
- [ ] `UnsupportedOperationException`
- [ ] `0`
@@ explain
`unmodifiableList` — не копия, а обёртка-представление: менять через неё нельзя, но изменения исходного списка в ней видны. Независимую неизменяемую копию даёт `List.copyOf(src)`.

@@ task dedupe | Удаление дубликатов с сохранением порядка | xp=35 interview
Реализуйте `Main.dedupe(List<String> list)`: метод возвращает **новый** список без повторов, сохраняя порядок первого появления элементов. Исходный список не меняется.

Пример: `[b, a, b, c, a]` → `[b, a, c]`.
@@ hint
Проверять `result.contains(x)` для каждого элемента — квадратичное время. Заведите `Set<String> seen = new HashSet<>()`.
@@ hint
Метод `seen.add(x)` возвращает `true`, только если элемента ещё не было: `if (seen.add(x)) result.add(x);`. Короткий вариант — `new ArrayList<>(new LinkedHashSet<>(list))`.
@@ starter
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<String> dedupe(List<String> list) {
        return list;
    }

    public static void main(String[] args) {
        System.out.println(dedupe(List.of("b", "a", "b", "c", "a")));
    }
}
@@ solution
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Main {
    static List<String> dedupe(List<String> list) {
        Set<String> seen = new HashSet<>();
        List<String> result = new ArrayList<>();
        for (String s : list) {
            if (seen.add(s)) result.add(s);
        }
        return result;
    }

    public static void main(String[] args) {
        System.out.println(dedupe(List.of("b", "a", "b", "c", "a")));
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("порядок первого появления", () -> T.eq(List.of("b", "a", "c"), Main.dedupe(List.of("b", "a", "b", "c", "a"))));
        T.test("без повторов", () -> T.eq(List.of("x", "y"), Main.dedupe(List.of("x", "y"))));
        T.test("пустой список", () -> T.eq(List.of(), Main.dedupe(List.of())));
        T.test("исходный список не меняется", () -> { List<String> src = new ArrayList<>(List.of("a", "a")); List<String> r = Main.dedupe(src); T.eq(2, src.size()); T.eq(List.of("a"), r); });
        T.test("большой список — за разумное время", () -> {
            List<String> big = new ArrayList<>();
            for (int i = 0; i < 200_000; i++) big.add("s" + (i % 50_000));
            T.eq(50_000, Main.dedupe(big).size());
        });
        T.done();
    }
}

@@ task remove-evens | Безопасное удаление | xp=30
Метод `Main.removeNegatives(List<Integer> list)` должен удалить из **переданного** списка все отрицательные числа (изменить его на месте). Сейчас он падает с `ConcurrentModificationException`. Исправьте.
@@ hint
Удалять из списка внутри for-each нельзя.
@@ hint
`list.removeIf(x -> x < 0);`
@@ starter
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void removeNegatives(List<Integer> list) {
        for (Integer x : list) {
            if (x < 0) list.remove(x);
        }
    }

    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(1, -2, -3, 4));
        removeNegatives(list);
        System.out.println(list);
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;

public class Main {
    static void removeNegatives(List<Integer> list) {
        list.removeIf(x -> x < 0);
    }

    public static void main(String[] args) {
        List<Integer> list = new ArrayList<>(List.of(1, -2, -3, 4));
        removeNegatives(list);
        System.out.println(list);
    }
}
@@ test
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;

public class Checker {
    static List<Integer> run(List<Integer> l) { Main.removeNegatives(l); return l; }

    public static void main(String[] args) {
        T.test("отрицательные подряд", () -> T.eq(List.of(1, 4), run(new ArrayList<>(List.of(1, -2, -3, 4)))));
        T.test("все отрицательные", () -> T.eq(List.of(), run(new ArrayList<>(List.of(-1, -2, -3)))));
        T.test("нет отрицательных", () -> T.eq(List.of(0, 5), run(new ArrayList<>(List.of(0, 5)))));
        T.test("LinkedList", () -> T.eq(List.of(2), run(new LinkedList<>(List.of(-1, 2, -3)))));
        T.done();
    }
}
