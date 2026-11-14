---
id: sql-join
title: JOIN — соединение таблиц
summary: INNER и LEFT JOIN, самосоединение и ловушка с условием в WHERE.
setup: shop
xp: 35
---
## Зачем соединять таблицы

В реляционной базе данные разложены по таблицам, чтобы не дублироваться: в заказе хранится не имя покупателя, а его `customer_id`. Связь задаётся парой: **первичный ключ** (`customers.id`) и **внешний ключ** (`orders.customer_id`). `JOIN` собирает данные обратно.

## INNER JOIN

Возвращает только те пары строк, для которых условие соединения истинно.

```sql
SELECT o.id, c.name, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id;     -- JOIN = INNER JOIN
```

`o` и `c` — псевдонимы таблиц. Покупательница Нина, у которой нет заказов, в результат не попадёт: для неё нет пары.

## LEFT JOIN

Возвращает **все** строки левой таблицы. Если пары справа нет — столбцы правой таблицы заполняются `NULL`.

```sql
SELECT c.name, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```

Нина появится в результате со значением `order_id = NULL`. На этом основан стандартный приём «найти строки без пары»:

```sql
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;                            -- покупатели без заказов
```

## Виды соединений

| Вид | Что возвращает |
|---|---|
| `INNER JOIN` | только совпавшие пары |
| `LEFT JOIN` | все строки левой таблицы + совпадения |
| `RIGHT JOIN` | все строки правой + совпадения (на практике переписывают в LEFT) |
| `FULL JOIN` | все строки обеих таблиц |
| `CROSS JOIN` | каждая строка с каждой (декартово произведение) |

## Ловушка: условие в WHERE превращает LEFT JOIN в INNER

```sql
-- Хотим: все покупатели и их ОПЛАЧЕННЫЕ заказы (у кого нет — NULL)
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid';                       -- ОШИБКА
```

Для покупателя без заказов `o.status` равен `NULL`, сравнение даёт UNKNOWN, и `WHERE` выбрасывает строку. `LEFT JOIN` перестал отличаться от `INNER`. Условие на **правую** таблицу нужно ставить в `ON`:

```sql
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
```

Правило: `ON` определяет, какие строки считаются парой; `WHERE` фильтрует уже собранный результат.

## Ловушка: размножение строк

Соединение «один ко многим» повторяет строку «одного» столько раз, сколько у неё пар. Если после этого суммировать столбец из таблицы «один», сумма окажется завышенной. Сначала агрегируйте, потом соединяйте — либо считайте `COUNT(DISTINCT …)`.

При `LEFT JOIN` считайте `COUNT(o.id)`, а не `COUNT(*)`: у покупателя без заказов есть одна строка с `NULL`, и `COUNT(*)` дал бы 1 вместо 0.

## Самосоединение

Таблицу можно соединить с самой собой — так читают иерархии. У сотрудника есть `manager_id`, ссылающийся на другого сотрудника:

```sql
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;
```

`LEFT`, потому что у руководителей менеджера нет.

## Несколько соединений

```sql
SELECT c.name, p.name AS product, oi.quantity
FROM customers c
JOIN orders o       ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id;
```

> **На собеседовании.** Попросят объяснить разницу между `INNER` и `LEFT JOIN` на примере двух маленьких таблиц и посчитать число строк в результате. Запомните: если ключ повторяется m раз слева и n раз справа, в результате будет m × n строк с этим ключом.

@@ quiz
@@ q
В `customers` 6 покупателей, заказы есть у пятерых. Сколько **разных покупателей** будет в результате?
```sql
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id;
```
- [ ] 5
- [x] 6
- [ ] 8
- [ ] 0
@@ explain
`LEFT JOIN` сохраняет все строки левой таблицы. У покупателя без заказов столбцы из `orders` будут `NULL`.

@@ q
Чем отличается результат этого запроса от предыдущего?
```sql
SELECT c.name, o.id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid';
```
- [ ] Ничем
- [x] Пропадут покупатели без заказов и без оплаченных заказов — запрос ведёт себя как INNER JOIN
- [ ] У всех покупателей `o.id` станет `NULL`
- [ ] Запрос вернёт ошибку
@@ explain
У строк без пары `o.status` равен `NULL`, условие в `WHERE` даёт UNKNOWN, и строки отбрасываются. Чтобы сохранить всех покупателей, условие переносят в `ON`.

@@ q
В таблице `a` значение ключа 7 встречается 2 раза, в таблице `b` — 3 раза. Сколько строк с ключом 7 вернёт `a JOIN b ON a.k = b.k`?
- [ ] 3
- [ ] 5
- [x] 6
- [ ] 2
@@ explain
Каждая строка слева соединяется с каждой подходящей строкой справа: 2 × 3 = 6. Отсюда «размножение» строк и завышенные суммы.

@@ q
Как найти покупателей, у которых нет ни одного заказа?
- [ ] `JOIN orders o ON o.customer_id = c.id WHERE o.id = NULL`
- [x] `LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL`
- [ ] `JOIN orders o ON o.customer_id <> c.id`
- [ ] `LEFT JOIN orders o ON o.customer_id = c.id AND o.id IS NULL`
@@ explain
`LEFT JOIN` оставляет покупателей без пары со значениями `NULL` справа, а `WHERE o.id IS NULL` отбирает именно их. `= NULL` никогда не истинно, а `<>` в условии соединения даст почти декартово произведение.

@@ task orders-with-names | Заказы с именами | xp=30
Выведите номер заказа (`id`), имя покупателя (`name`) и статус заказа (`status`) для всех заказов. Отсортируйте по номеру заказа.
@@ hint
Соедините `orders` и `customers` по условию `customers.id = orders.customer_id`.
@@ hint
Столбец `id` есть в обеих таблицах — уточняйте, чей он: `o.id`.
@@ starter
SELECT id, status
FROM orders
ORDER BY id;
@@ solution
SELECT o.id, c.name, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id;
@@ test
--@ ordered

@@ task no-orders | Покупатели без заказов | xp=35 interview
Выведите имена (`name`) покупателей, которые не сделали **ни одного** заказа.
@@ hint
`LEFT JOIN` оставит всех покупателей; у тех, кто без заказов, столбцы таблицы `orders` будут `NULL`.
@@ hint
`FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL`.
@@ starter
SELECT c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id;
@@ solution
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
@@ test

@@ task orders-count | Число оплаченных заказов у каждого | xp=40 interview
Выведите для **каждого** покупателя имя (`name`) и число его оплаченных заказов (`paid_orders`). Покупатели без оплаченных заказов тоже должны быть в результате — с нулём. Отсортируйте по убыванию числа заказов, при равенстве — по имени.
@@ hint
Условие `o.status = 'paid'` должно стоять в `ON`, а не в `WHERE`, иначе покупатели без оплаченных заказов исчезнут.
@@ hint
Считайте `COUNT(o.id)`, а не `COUNT(*)`: у покупателя без пары есть одна строка с `NULL`, и `COUNT(*)` дал бы 1.
@@ starter
SELECT c.name, COUNT(*) AS paid_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.status = 'paid'
GROUP BY c.id, c.name;
@@ solution
SELECT c.name, COUNT(o.id) AS paid_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'
GROUP BY c.id, c.name
ORDER BY paid_orders DESC, c.name;
@@ test
--@ ordered

@@ task managers | Сотрудники и их руководители | xp=40 interview
Выведите имя каждого сотрудника (`employee`) и имя его руководителя (`manager`). Для сотрудников без руководителя в столбце `manager` должно быть `NULL`. Отсортируйте по имени сотрудника.
@@ hint
Соедините таблицу `employees` саму с собой под двумя псевдонимами: `e` — сотрудник, `m` — руководитель.
@@ hint
`FROM employees e LEFT JOIN employees m ON m.id = e.manager_id`.
@@ starter
SELECT name AS employee
FROM employees
ORDER BY name;
@@ solution
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.name;
@@ test
--@ ordered
--@ columns
