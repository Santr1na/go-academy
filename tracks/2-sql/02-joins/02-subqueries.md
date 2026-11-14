---
id: sql-subqueries
title: Подзапросы, EXISTS и CTE
summary: Запрос внутри запроса, коррелированные подзапросы и конструкция WITH.
setup: shop
xp: 35
---
## Подзапрос — запрос внутри запроса

**Скалярный** подзапрос возвращает одно значение и используется как обычное выражение:

```sql
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);   -- выше средней по компании
```

Подзапрос со **списком** значений используют с `IN`:

```sql
SELECT name
FROM customers
WHERE id IN (SELECT customer_id FROM orders WHERE status = 'paid');
```

Подзапрос во `FROM` работает как временная таблица (ему нужен псевдоним):

```sql
SELECT AVG(cnt)
FROM (SELECT customer_id, COUNT(*) AS cnt FROM orders GROUP BY customer_id) AS t;
```

## Коррелированный подзапрос

Обычный подзапрос выполняется один раз. **Коррелированный** ссылается на строку внешнего запроса и логически выполняется для каждой строки заново:

```sql
SELECT e.name, e.salary
FROM employees e
WHERE e.salary > (SELECT AVG(salary)
                  FROM employees
                  WHERE department_id = e.department_id);   -- средняя по СВОЕМУ отделу
```

## EXISTS

`EXISTS (подзапрос)` истинно, если подзапрос вернул хотя бы одну строку. Содержимое строк не важно, поэтому принято писать `SELECT 1`.

```sql
SELECT c.name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);       -- есть заказы

SELECT c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);   -- нет заказов
```

## NOT IN против NOT EXISTS

```sql
-- сотрудники, которые никем не руководят
SELECT name FROM employees
WHERE id NOT IN (SELECT manager_id FROM employees);       -- вернёт 0 строк!
```

В столбце `manager_id` есть `NULL` (у руководителей верхнего уровня). `id NOT IN (…, NULL)` никогда не бывает TRUE — запрос молча возвращает пустой результат. Это одна из самых известных ловушек SQL.

```sql
SELECT e.name FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employees x WHERE x.manager_id = e.id);   -- правильно
```

Правило: для отрицания используйте **`NOT EXISTS`**. `NOT IN` допустим только со списком констант или со столбцом, объявленным `NOT NULL`.

## CTE: WITH

Общее табличное выражение даёт подзапросу имя. Запрос читается сверху вниз, как последовательность шагов:

```sql
WITH order_totals AS (
    SELECT oi.order_id, SUM(oi.quantity * p.price) AS total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    GROUP BY oi.order_id
)
SELECT o.id, c.name, t.total
FROM orders o
JOIN customers c    ON c.id = o.customer_id
JOIN order_totals t ON t.order_id = o.id
WHERE t.total > 50000;
```

CTE можно объявить несколько через запятую, и каждое следующее может ссылаться на предыдущие. `WITH RECURSIVE` позволяет обходить иерархии — например, всех подчинённых руководителя на любую глубину.

## UNION

`UNION` объединяет результаты двух запросов с одинаковым числом столбцов и **удаляет дубликаты**; `UNION ALL` дубликаты оставляет и работает быстрее — без лишней сортировки. Если дубликатов быть не может или они нужны, пишите `UNION ALL`.

@@ quiz
@@ q
В столбце `manager_id` у трёх сотрудников стоит `NULL`. Что вернёт запрос?
```sql
SELECT name FROM employees
WHERE id NOT IN (SELECT manager_id FROM employees);
```
- [ ] Сотрудников, которые никем не руководят
- [x] Пустой результат
- [ ] Всех сотрудников
- [ ] Ошибку
@@ explain
Подзапрос возвращает список с `NULL`. Сравнение `id <> NULL` даёт UNKNOWN, поэтому условие `NOT IN` не истинно ни для одной строки. Нужен `NOT EXISTS` или `WHERE manager_id IS NOT NULL` в подзапросе.

@@ q
Что такое коррелированный подзапрос?
- [ ] Подзапрос, возвращающий несколько столбцов
- [x] Подзапрос, который ссылается на столбцы внешнего запроса и вычисляется для каждой его строки
- [ ] Подзапрос внутри `FROM`
- [ ] Любой подзапрос с `GROUP BY`
@@ explain
Признак корреляции — упоминание псевдонима внешней таблицы внутри подзапроса, например `WHERE department_id = e.department_id`.

@@ q
Чем `UNION` отличается от `UNION ALL`?
- [ ] `UNION ALL` объединяет таблицы с разным числом столбцов
- [x] `UNION` удаляет дубликаты строк, `UNION ALL` — нет
- [ ] `UNION` работает быстрее
- [ ] Ничем
@@ explain
Удаление дубликатов требует сортировки или хеширования, поэтому `UNION` дороже. Когда дубликаты невозможны или не мешают, используют `UNION ALL`.

@@ q
Что вернёт `EXISTS (SELECT NULL FROM orders WHERE customer_id = 1)`, если у покупателя 1 есть заказы?
- [x] TRUE
- [ ] FALSE
- [ ] `NULL`
- [ ] Ошибку
@@ explain
`EXISTS` проверяет только наличие строк. Что именно выбрано — `1`, `*` или `NULL` — значения не имеет.

@@ task above-avg | Зарплата выше средней | xp=30 interview
Выведите имена (`name`) и зарплаты (`salary`) сотрудников, чья зарплата **выше средней по компании**. Отсортируйте по убыванию зарплаты, при равенстве — по имени.
@@ hint
Средняя зарплата — скалярный подзапрос: `(SELECT AVG(salary) FROM employees)`.
@@ hint
`WHERE salary > (SELECT AVG(salary) FROM employees) ORDER BY salary DESC, name`.
@@ starter
SELECT name, salary
FROM employees;
@@ solution
SELECT name, salary
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees)
ORDER BY salary DESC, name;
@@ test
--@ ordered

@@ task not-managers | Кто никем не руководит | xp=40 interview
Выведите имена (`name`) сотрудников, у которых нет ни одного подчинённого. Отсортируйте по имени.

Запрос в заготовке возвращает пустой результат — разберитесь почему и исправьте.
@@ hint
В столбце `manager_id` есть `NULL`, а `NOT IN` со списком, содержащим `NULL`, никогда не истинен.
@@ hint
`WHERE NOT EXISTS (SELECT 1 FROM employees x WHERE x.manager_id = e.id)`.
@@ starter
SELECT name
FROM employees
WHERE id NOT IN (SELECT manager_id FROM employees)
ORDER BY name;
@@ solution
SELECT e.name
FROM employees e
WHERE NOT EXISTS (SELECT 1 FROM employees x WHERE x.manager_id = e.id)
ORDER BY e.name;
@@ test
--@ ordered

@@ task order-totals | Сумма каждого заказа | xp=45 interview
Для каждого заказа со статусом `paid` выведите его номер (`id`), имя покупателя (`name`) и сумму заказа (`total`) — сумму `quantity * price` по всем позициям. Отсортируйте по убыванию суммы.
@@ hint
Нужны четыре таблицы: `orders`, `customers`, `order_items`, `products`. Цена берётся из `products`.
@@ hint
`SUM(oi.quantity * p.price) AS total … WHERE o.status = 'paid' GROUP BY o.id, c.name ORDER BY total DESC`.
@@ starter
SELECT o.id, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id;
@@ solution
SELECT o.id, c.name, SUM(oi.quantity * p.price) AS total
FROM orders o
JOIN customers c ON c.id = o.customer_id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'paid'
GROUP BY o.id, c.name
ORDER BY total DESC;
@@ test
--@ ordered
