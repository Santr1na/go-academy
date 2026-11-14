---
id: j-queues
title: Очереди, стек и PriorityQueue
summary: Deque вместо Stack, куча с приоритетами и типовые задачи на них.
xp: 25
---
## Queue и Deque

**Очередь** (FIFO) — первым пришёл, первым ушёл. **Стек** (LIFO) — последним пришёл, первым ушёл. **Deque** — двусторонняя очередь: добавлять и забирать можно с обоих концов, поэтому она заменяет и то, и другое.

```java
Deque<String> queue = new ArrayDeque<>();
queue.offer("a");            // в конец
queue.offer("b");
queue.peek();                // "a" — посмотреть первый, не забирая
queue.poll();                // "a" — забрать первый

Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);               // на вершину
stack.push(2);
stack.peek();                // 2
stack.pop();                 // 2
```

У операций очереди есть две формы — с исключением и со специальным значением:

| Действие | Бросает исключение | Возвращает `null` / `false` |
|---|---|---|
| добавить | `add(e)` | `offer(e)` |
| забрать | `remove()` | `poll()` |
| посмотреть | `element()` | `peek()` |

> **На собеседовании.** «Почему не стоит использовать класс `Stack`?» — он наследует устаревший `Vector`, все его методы синхронизированы (медленно), а наследование открывает лишние операции вроде вставки в середину. Правильный стек — `ArrayDeque`. Он же быстрее `LinkedList` в роли очереди. Ограничение: `ArrayDeque` не принимает `null`.

## PriorityQueue

Очередь с приоритетом отдаёт не самый старый элемент, а **наименьший** (по естественному порядку или по компаратору). Внутри — двоичная куча в массиве.

```java
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.add(5); pq.add(1); pq.add(3);
pq.poll();     // 1
pq.poll();     // 3

PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());
PriorityQueue<Task> byPriority = new PriorityQueue<>(Comparator.comparingInt(Task::priority));
```

| Операция | Сложность |
|---|---|
| `add` / `offer` | O(log n) |
| `poll` | O(log n) |
| `peek` | O(1) |
| `contains` / `remove(obj)` | O(n) |

> **Ловушка.** Обход `PriorityQueue` циклом for-each или печать через `toString()` идут в порядке внутреннего массива кучи, а **не** по возрастанию. Упорядоченную последовательность даёт только многократный `poll()`.

## Задача «K наибольших»

Типовое применение кучи — найти K наибольших элементов, не сортируя всё. Держим **min-кучу размера K**: если новый элемент больше минимума в куче — заменяем минимум. В конце в куче ровно K наибольших. Сложность O(n log k) вместо O(n log n), а память O(k) — это позволяет обрабатывать поток, который не помещается в память.

```java
PriorityQueue<Integer> heap = new PriorityQueue<>();
for (int x : nums) {
    heap.offer(x);
    if (heap.size() > k) heap.poll();   // выбрасываем наименьший
}
```

## Стек в задачах

Стек — стандартный инструмент для всего «вложенного»: проверка скобок, вычисление выражений, обход дерева без рекурсии, история «отменить». Правило для скобок: открывающую кладём в стек; встретив закрывающую, снимаем вершину и проверяем, что это её пара; в конце стек должен быть пуст.

@@ quiz
@@ q
Что выведет код?
```java
Deque<Integer> d = new ArrayDeque<>();
d.push(1);
d.push(2);
d.offer(3);
System.out.println(d.poll() + " " + d.peekLast());
```
- [ ] `1 3`
- [x] `2 3`
- [ ] `3 1`
- [ ] `2 1`
@@ explain
`push` кладёт в **начало**: после двух вызовов дек выглядит как `[2, 1]`. `offer` добавляет в конец: `[2, 1, 3]`. `poll` забирает из начала — 2, последним остаётся 3.

@@ q
Что выведет код?
```java
PriorityQueue<Integer> pq = new PriorityQueue<>(List.of(5, 1, 4, 2));
System.out.println(pq.poll() + " " + pq.poll());
```
- [ ] `5 1`
- [x] `1 2`
- [ ] `5 4`
- [ ] `1 4`
@@ explain
По умолчанию `PriorityQueue` — min-куча: `poll` всегда возвращает наименьший из оставшихся элементов, независимо от порядка добавления.

@@ q
Чем `poll()` отличается от `remove()` на пустой очереди?
- [ ] Ничем
- [x] `poll()` вернёт `null`, а `remove()` бросит `NoSuchElementException`
- [ ] `poll()` бросит исключение, а `remove()` вернёт `null`
- [ ] Оба заблокируют поток до появления элемента
@@ explain
У очередей две группы методов: `add`/`remove`/`element` сообщают о неудаче исключением, `offer`/`poll`/`peek` — специальным значением.

@@ q
Почему для стека рекомендуют `ArrayDeque`, а не `Stack`?
- [ ] `Stack` удалён из Java
- [ ] `Stack` не поддерживает generics
- [x] `Stack` основан на устаревшем синхронизированном `Vector` и открывает лишние операции
- [ ] `ArrayDeque` потокобезопасен
@@ explain
`Stack` остался ради совместимости. `ArrayDeque` быстрее и даёт чистый интерфейс стека и очереди; потокобезопасным он как раз не является.

@@ task brackets | Правильные скобки | xp=45 interview
Одна из самых частых задач на собеседованиях. Реализуйте `Main.isValid(String s)`: строка состоит из символов `()[]{}` и считается правильной, если каждая открывающая скобка закрыта скобкой того же вида и в правильном порядке.

`"([]{})"` → `true`, `"([)]"` → `false`, `"(("` → `false`, пустая строка → `true`.
@@ hint
Используйте стек `Deque<Character>`: открывающие скобки кладите в него.
@@ hint
Встретив закрывающую: если стек пуст — `false`; иначе снимите вершину и проверьте, что это парная открывающая. В конце верните `stack.isEmpty()`.
@@ starter
public class Main {
    static boolean isValid(String s) {
        return false;
    }

    public static void main(String[] args) {
        System.out.println(isValid("([]{})"));
    }
}
@@ solution
import java.util.ArrayDeque;
import java.util.Deque;

public class Main {
    static boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(' || c == '[' || c == '{') {
                stack.push(c);
            } else {
                if (stack.isEmpty()) return false;
                char open = stack.pop();
                if ((c == ')' && open != '(') || (c == ']' && open != '[') || (c == '}' && open != '{')) return false;
            }
        }
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        System.out.println(isValid("([]{})"));
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("правильные", () -> { T.eq(true, Main.isValid("()")); T.eq(true, Main.isValid("([]{})")); T.eq(true, Main.isValid("{[()()]}")); });
        T.test("пустая строка", () -> T.eq(true, Main.isValid("")));
        T.test("перепутан порядок", () -> T.eq(false, Main.isValid("([)]")));
        T.test("не закрыта", () -> { T.eq(false, Main.isValid("((")); T.eq(false, Main.isValid("{[]")); });
        T.test("лишняя закрывающая", () -> { T.eq(false, Main.isValid(")")); T.eq(false, Main.isValid("())")); });
        T.test("неверная пара", () -> T.eq(false, Main.isValid("(]")));
        T.done();
    }
}

@@ task top-k | K наибольших элементов | xp=45 interview
Реализуйте `Main.topK(int[] nums, int k)`: метод возвращает список из `k` наибольших элементов массива **в порядке убывания**. Если `k` больше длины массива, верните все элементы. Повторяющиеся значения считаются отдельно.

Используйте `PriorityQueue` размера не больше `k` — представьте, что массив очень длинный и сортировать его целиком нельзя.
@@ hint
Min-куча хранит K лучших на данный момент: добавляйте элемент и, если размер стал больше `k`, удаляйте минимум через `poll()`.
@@ hint
В конце куча отдаёт элементы по возрастанию. Добавляйте их в начало списка (`result.add(0, heap.poll())`) или разверните список через `Collections.reverse`.
@@ starter
import java.util.ArrayList;
import java.util.List;

public class Main {
    static List<Integer> topK(int[] nums, int k) {
        return new ArrayList<>();
    }

    public static void main(String[] args) {
        System.out.println(topK(new int[]{3, 1, 5, 2, 4}, 2));
    }
}
@@ solution
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.PriorityQueue;

public class Main {
    static List<Integer> topK(int[] nums, int k) {
        PriorityQueue<Integer> heap = new PriorityQueue<>();
        for (int x : nums) {
            heap.offer(x);
            if (heap.size() > k) heap.poll();
        }
        List<Integer> result = new ArrayList<>();
        while (!heap.isEmpty()) result.add(heap.poll());
        Collections.reverse(result);
        return result;
    }

    public static void main(String[] args) {
        System.out.println(topK(new int[]{3, 1, 5, 2, 4}, 2));
    }
}
@@ test
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("два наибольших", () -> T.eq(List.of(5, 4), Main.topK(new int[]{3, 1, 5, 2, 4}, 2)));
        T.test("повторы", () -> T.eq(List.of(7, 7, 3), Main.topK(new int[]{7, 3, 7, 1}, 3)));
        T.test("k больше длины", () -> T.eq(List.of(2, 1), Main.topK(new int[]{1, 2}, 5)));
        T.test("k = 0", () -> T.eq(List.of(), Main.topK(new int[]{1, 2}, 0)));
        T.test("отрицательные числа", () -> T.eq(List.of(-1), Main.topK(new int[]{-5, -1, -3}, 1)));
        T.done();
    }
}
