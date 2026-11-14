---
id: j-data-structures
title: Свои структуры данных: LRU-кеш и связный список
summary: Две задачи, которые чаще всего просят написать на доске.
xp: 35
---
## Связный список

На собеседованиях связный список — любимый материал для задач: он проверяет аккуратность работы со ссылками.

```java
class ListNode {
    int val;
    ListNode next;
    ListNode(int val) { this.val = val; }
}
```

### Разворот списка

Самая частая задача. Идём по списку и разворачиваем стрелки, храня три ссылки:

```java
static ListNode reverse(ListNode head) {
    ListNode prev = null;
    ListNode cur = head;
    while (cur != null) {
        ListNode next = cur.next;   // 1) запомнить, куда идти дальше
        cur.next = prev;            // 2) развернуть стрелку
        prev = cur;                 // 3) сдвинуть prev
        cur = next;                 // 4) сдвинуть cur
    }
    return prev;                    // новая голова
}
```

Проследите на списке `1 → 2 → 3`:

| Шаг | prev | cur | Список |
|---|---|---|---|
| начало | null | 1 | 1 → 2 → 3 |
| 1 | 1 | 2 | 1 → null, 2 → 3 |
| 2 | 2 | 3 | 2 → 1 → null, 3 |
| 3 | 3 | null | 3 → 2 → 1 → null |

### Быстрый и медленный указатели

Один указатель идёт по одному узлу, другой — по два. Этим приёмом находят середину списка (когда быстрый дошёл до конца, медленный — в середине) и обнаруживают цикл (если цикл есть, быстрый догонит медленного).

## LRU-кеш

**LRU** (Least Recently Used) — кеш ограниченного размера: когда место кончается, вытесняется элемент, к которому **дольше всего не обращались**. Требование: `get` и `put` за O(1).

Идея: совместить две структуры.

- `HashMap<K, Node>` — мгновенно найти узел по ключу;
- **двусвязный список** узлов в порядке использования: свежие в начале, старые в конце. Перенос узла в начало и удаление последнего — O(1), потому что у узла есть ссылки на обоих соседей.

```text
map:  A ─┐    B ─┐    C ─┐
         ▼       ▼       ▼
head ⇄ [C] ⇄   [A] ⇄   [B] ⇄ tail
       свежий          кандидат на вытеснение
```

- `get(key)`: нашли узел через мапу → перенесли в начало списка → вернули значение.
- `put(key, value)`: ключ есть — обновили значение и перенесли в начало; нет — создали узел в начале; если размер превысил ёмкость — удалили узел перед `tail` и его ключ из мапы.

### Короткий путь в Java

`LinkedHashMap` уже содержит и мапу, и двусвязный список. Третий параметр конструктора `accessOrder = true` включает порядок по обращениям, а метод `removeEldestEntry` решает, удалять ли самый старый элемент после вставки:

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LruCache(int capacity) {
        super(16, 0.75f, true);
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}
```

На собеседовании сначала назовите этот способ — это показывает знание библиотеки, — а затем будьте готовы написать версию «руками»: обычно просят именно её.

@@ quiz
@@ q
Какие структуры данных нужны, чтобы и `get`, и `put` LRU-кеша работали за O(1)?
- [ ] Только `HashMap`
- [ ] `TreeMap`, упорядоченная по времени обращения
- [x] `HashMap` и двусвязный список
- [ ] `ArrayList` и `HashSet`
@@ explain
Мапа даёт поиск узла по ключу за O(1), двусвязный список — перенос узла в начало и удаление самого старого за O(1). С `TreeMap` операции были бы O(log n), с `ArrayList` перенос элемента — O(n).

@@ q
Почему в LRU-кеше список должен быть именно двусвязным?
- [ ] Так он занимает меньше памяти
- [x] Чтобы вырезать узел из середины за O(1), нужна ссылка на предыдущий узел
- [ ] Односвязный список нельзя обходить
- [ ] Этого требует `HashMap`
@@ explain
Чтобы удалить узел, надо перенаправить ссылку его предшественника. В односвязном списке предшественника пришлось бы искать проходом от головы — O(n).

@@ q
Что вернёт `reverse` для пустого списка (`head == null`) в реализации из урока?
- [ ] `NullPointerException`
- [x] `null`
- [ ] Узел со значением 0
- [ ] Бесконечный цикл
@@ explain
Цикл `while (cur != null)` не выполнится ни разу, и метод вернёт `prev`, равный `null`. Крайние случаи — пустой список и список из одного узла — нужно проверять в первую очередь.

@@ q
Как с помощью двух указателей обнаружить цикл в связном списке?
- [ ] Сравнивать значения соседних узлов
- [x] Двигать один указатель на шаг, другой на два: если они встретятся — цикл есть
- [ ] Посчитать длину списка
- [ ] Никак, нужен `HashSet`
@@ explain
Алгоритм «черепаха и заяц»: в цикле быстрый указатель неизбежно догонит медленный; если цикла нет — быстрый дойдёт до `null`. Память O(1), в отличие от решения с `HashSet` посещённых узлов.

@@ task reverse-list | Разворот связного списка | xp=45 interview
Реализуйте `Main.reverse(ListNode head)`: разверните односвязный список и верните новую голову. Новые узлы создавать нельзя — нужно перенаправить ссылки `next` у существующих.
@@ hint
Три ссылки: `prev` (уже развёрнутая часть), `cur` (текущий узел) и `next` (сохранённый следующий).
@@ hint
В цикле `while (cur != null)`: `ListNode next = cur.next; cur.next = prev; prev = cur; cur = next;` — и в конце `return prev;`.
@@ starter
class ListNode {
    int val;
    ListNode next;

    ListNode(int val) { this.val = val; }
}

public class Main {
    static ListNode reverse(ListNode head) {
        return head;
    }

    public static void main(String[] args) {
        ListNode a = new ListNode(1);
        a.next = new ListNode(2);
        a.next.next = new ListNode(3);
        for (ListNode n = reverse(a); n != null; n = n.next) System.out.print(n.val + " ");
    }
}
@@ solution
class ListNode {
    int val;
    ListNode next;

    ListNode(int val) { this.val = val; }
}

public class Main {
    static ListNode reverse(ListNode head) {
        ListNode prev = null, cur = head;
        while (cur != null) {
            ListNode next = cur.next;
            cur.next = prev;
            prev = cur;
            cur = next;
        }
        return prev;
    }

    public static void main(String[] args) {
        ListNode a = new ListNode(1);
        a.next = new ListNode(2);
        a.next.next = new ListNode(3);
        for (ListNode n = reverse(a); n != null; n = n.next) System.out.print(n.val + " ");
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;

public class Checker {
    static ListNode build(int... v) { ListNode head = null, tail = null; for (int x : v) { ListNode n = new ListNode(x); if (head == null) head = n; else tail.next = n; tail = n; } return head; }
    static List<Integer> toList(ListNode h) { List<Integer> l = new ArrayList<>(); for (int guard = 0; h != null && guard < 1000; h = h.next, guard++) l.add(h.val); return l; }

    public static void main(String[] args) {
        T.test("три узла", () -> T.eq(List.of(3, 2, 1), toList(Main.reverse(build(1, 2, 3)))));
        T.test("пустой список", () -> T.eq(null, Main.reverse(null)));
        T.test("один узел", () -> T.eq(List.of(7), toList(Main.reverse(build(7)))));
        T.test("узлы те же самые", () -> { ListNode a = build(1, 2); ListNode b = a.next; ListNode r = Main.reverse(a); T.check(r == b && r.next == a && a.next == null, "нужно перенаправить ссылки, а не создавать новые узлы"); });
        T.test("длинный список", () -> { int[] v = new int[500]; for (int i = 0; i < 500; i++) v[i] = i; List<Integer> r = toList(Main.reverse(build(v))); T.eq(500, r.size()); T.eq(499, r.get(0)); T.eq(0, r.get(499)); });
        T.done();
    }
}

@@ task lru | LRU-кеш | xp=60 interview
Реализуйте класс `LruCache` для ключей и значений типа `int`:

- `LruCache(int capacity)` — ёмкость не меньше 1;
- `int get(int key)` — значение по ключу или `-1`, если ключа нет. Обращение делает ключ «самым свежим»;
- `void put(int key, int value)` — добавить или обновить значение; ключ становится самым свежим. Если после добавления нового ключа элементов больше, чем `capacity`, удаляется ключ, к которому дольше всего не обращались;
- `int size()`.

Обе операции должны работать за O(1). Можно использовать `LinkedHashMap` с `accessOrder = true` или написать `HashMap` + двусвязный список самостоятельно.
@@ hint
Короткий путь: поле `LinkedHashMap<Integer, Integer> map = new LinkedHashMap<>(16, 0.75f, true) { protected boolean removeEldestEntry(Map.Entry<Integer, Integer> e) { return size() > capacity; } };`.
@@ hint
Тогда `get` — это `map.getOrDefault(key, -1)` (вызов `get`/`getOrDefault` сам переносит запись в конец), а `put` — просто `map.put(key, value)`.
@@ starter
class LruCache {
    LruCache(int capacity) {
    }

    int get(int key) { return -1; }

    void put(int key, int value) { }

    int size() { return 0; }
}

public class Main {
    public static void main(String[] args) {
        LruCache cache = new LruCache(2);
        cache.put(1, 10);
        cache.put(2, 20);
        cache.get(1);
        cache.put(3, 30);
        System.out.println(cache.get(1) + " " + cache.get(2) + " " + cache.get(3));   // 10 -1 30
    }
}
@@ solution
import java.util.HashMap;
import java.util.Map;

class LruCache {
    private static final class Node {
        int key, value;
        Node prev, next;
    }

    private final int capacity;
    private final Map<Integer, Node> map = new HashMap<>();
    private final Node head = new Node(), tail = new Node();   // служебные узлы-границы

    LruCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    private void unlink(Node n) {
        n.prev.next = n.next;
        n.next.prev = n.prev;
    }

    private void addFirst(Node n) {
        n.next = head.next;
        n.prev = head;
        head.next.prev = n;
        head.next = n;
    }

    int get(int key) {
        Node n = map.get(key);
        if (n == null) return -1;
        unlink(n);
        addFirst(n);
        return n.value;
    }

    void put(int key, int value) {
        Node n = map.get(key);
        if (n != null) {
            n.value = value;
            unlink(n);
            addFirst(n);
            return;
        }
        n = new Node();
        n.key = key;
        n.value = value;
        map.put(key, n);
        addFirst(n);
        if (map.size() > capacity) {
            Node old = tail.prev;
            unlink(old);
            map.remove(old.key);
        }
    }

    int size() { return map.size(); }
}

public class Main {
    public static void main(String[] args) {
        LruCache cache = new LruCache(2);
        cache.put(1, 10);
        cache.put(2, 20);
        cache.get(1);
        cache.put(3, 30);
        System.out.println(cache.get(1) + " " + cache.get(2) + " " + cache.get(3));   // 10 -1 30
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("положить и получить", () -> { LruCache c = new LruCache(2); c.put(1, 10); T.eq(10, c.get(1)); T.eq(-1, c.get(2)); T.eq(1, c.size()); });
        T.test("вытесняется самый старый", () -> { LruCache c = new LruCache(2); c.put(1, 10); c.put(2, 20); c.put(3, 30); T.eq(-1, c.get(1)); T.eq(20, c.get(2)); T.eq(30, c.get(3)); T.eq(2, c.size()); });
        T.test("get освежает ключ", () -> { LruCache c = new LruCache(2); c.put(1, 10); c.put(2, 20); c.get(1); c.put(3, 30); T.eq(10, c.get(1)); T.eq(-1, c.get(2)); T.eq(30, c.get(3)); });
        T.test("обновление значения освежает ключ и не увеличивает размер", () -> { LruCache c = new LruCache(2); c.put(1, 10); c.put(2, 20); c.put(1, 11); c.put(3, 30); T.eq(11, c.get(1)); T.eq(-1, c.get(2)); T.eq(2, c.size()); });
        T.test("ёмкость 1", () -> { LruCache c = new LruCache(1); c.put(1, 1); c.put(2, 2); T.eq(-1, c.get(1)); T.eq(2, c.get(2)); });
        T.test("миллион операций за O(1)", () -> {
            LruCache c = new LruCache(50_000);
            long start = System.nanoTime();
            for (int i = 0; i < 1_000_000; i++) { c.put(i, i); c.get(i / 2); }
            T.eq(50_000, c.size());
            T.eq(999_999, c.get(999_999));
            T.check((System.nanoTime() - start) / 1_000_000 < 3000, "слишком медленно — операции должны быть O(1)");
        });
        T.done();
    }
}
