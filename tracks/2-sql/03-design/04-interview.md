---
id: sql-interview
title: Классические задачи собеседований
summary: Вторая зарплата, дубликаты, сравнение с руководителем и другие задачи, которые дают чаще всего.
setup: shop
xp: 40
---
## Как решать SQL-задачу на собеседовании

1. **Уточните данные**: какие таблицы и ключи, могут ли быть `NULL` и дубликаты, что делать с равными значениями («вторая зарплата» при двух одинаковых максимальных — какая?).
2. **Проговорите план** по шагам: что соединяем, по чему группируем, что фильтруем.
3. **Соберите запрос от простого к сложному**: сначала `FROM` и `JOIN`, затем фильтры, группировку, сортировку.
4. **Проверьте крайние случаи**: пустая таблица, `NULL`, одна строка, повторы.

Ниже — шаблоны, которыми закрывается большинство задач.

## N-е по величине значение

«Найдите вторую по величине зарплату».

```sql
-- Вариант 1: подзапрос
SELECT MAX(salary) FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);

-- Вариант 2: DISTINCT + OFFSET
SELECT DISTINCT salary FROM employees
ORDER BY salary DESC
LIMIT 1 OFFSET 1;

-- Вариант 3: оконная функция — обобщается на любое N
SELECT DISTINCT salary
FROM (SELECT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS r FROM employees) t
WHERE r = 2;
```

Обратите внимание на `DISTINCT` и `DENSE_RANK`: если максимальную зарплату получают двое, «вторая зарплата» — это следующее **значение**, а не зарплата второго человека в списке. Первый вариант хорош ещё и тем, что вернёт `NULL`, если второй зарплаты не существует.

## Поиск дубликатов

```sql
SELECT city, COUNT(*) AS cnt
FROM customers
WHERE city IS NOT NULL
GROUP BY city
HAVING COUNT(*) > 1;
```

Удаление дубликатов с сохранением одной строки (с наименьшим `id`):

```sql
DELETE FROM customers
WHERE id NOT IN (SELECT MIN(id) FROM customers GROUP BY email);
```

## Сравнение строки с «родителем»

«Сотрудники, которые зарабатывают больше своего руководителя» — самосоединение:

```sql
SELECT e.name
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;
```

## Строки без пары

«Отделы без сотрудников», «товары, которые ни разу не заказали» — `LEFT JOIN … WHERE … IS NULL` или `NOT EXISTS`.

## Топ-N в группе

`ROW_NUMBER()` / `DENSE_RANK()` с `PARTITION BY` в CTE и фильтр по номеру во внешнем запросе.

## Доля и процент

```sql
SELECT status,
       COUNT(*) AS cnt,
       ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM orders), 1) AS percent
FROM orders
GROUP BY status;
```

Множитель `100.0` нужен, чтобы деление было дробным: `COUNT(*) / COUNT(*)` — деление целых чисел, результат без него получится 0.

## Вопросы без кода, которые задают рядом

- Чем `WHERE` отличается от `HAVING`? Чем `DELETE` от `TRUNCATE` и `DROP`?
- Что такое первичный и внешний ключ? Что такое индекс и когда он не используется?
- Что такое транзакция и ACID? Какие бывают уровни изоляции?
- Чем `UNION` отличается от `UNION ALL`? `INNER JOIN` от `LEFT JOIN`?
- В каком порядке выполняются части запроса `SELECT`?

Все они разобраны в предыдущих уроках, а для устной тренировки есть курс «Собеседование».

@@ quiz
@@ q
Зарплаты: 300, 300, 220, 150. Что вернёт запрос?
```sql
SELECT salary FROM employees ORDER BY salary DESC LIMIT 1 OFFSET 1;
```
- [ ] 220
- [x] 300
- [ ] 150
- [ ] `NULL`
@@ explain
Без `DISTINCT` вторая строка отсортированного списка — снова 300. Чтобы получить вторую по величине зарплату как значение, нужен `SELECT DISTINCT salary …`.

@@ q
Чему равно выражение `COUNT(*) / (SELECT COUNT(*) FROM orders)` для группы из 2 заказов при 8 заказах всего?
- [ ] 0.25
- [x] 0
- [ ] 25
- [ ] `NULL`
@@ explain
Оба операнда — целые числа, а деление целых отбрасывает дробную часть: 2 / 8 = 0. Умножьте на `1.0` или `100.0` до деления.

@@ q
Как найти значения `email`, которые встречаются в таблице больше одного раза?
- [ ] `WHERE COUNT(email) > 1`
- [x] `GROUP BY email HAVING COUNT(*) > 1`
- [ ] `SELECT DISTINCT email`
- [ ] `ORDER BY email LIMIT 2`
@@ explain
Группируем по значению и оставляем группы с числом строк больше одного. Условие на агрегат пишется в `HAVING`.

@@ q
Чем `DELETE FROM t` отличается от `TRUNCATE TABLE t`?
- [ ] Ничем
- [x] `DELETE` удаляет строки по одной, поддерживает `WHERE` и триггеры; `TRUNCATE` быстро очищает всю таблицу целиком
- [ ] `TRUNCATE` удаляет и структуру таблицы
- [ ] `DELETE` нельзя откатить
@@ explain
Структуру таблицы удаляет `DROP TABLE`. `TRUNCATE` не просматривает строки, поэтому работает мгновенно даже на огромных таблицах, но условия в нём задать нельзя.

@@ task second-salary | Вторая по величине зарплата | xp=45 interview
Выведите одно число — вторую по величине зарплату в компании (столбец `salary`). Одинаковые зарплаты считаются одним значением.
@@ hint
Вторая по величине — это максимум среди зарплат, которые меньше общей максимальной.
@@ hint
`SELECT MAX(salary) AS salary FROM employees WHERE salary < (SELECT MAX(salary) FROM employees);`
@@ starter
SELECT MAX(salary) AS salary
FROM employees;
@@ solution
SELECT MAX(salary) AS salary
FROM employees
WHERE salary < (SELECT MAX(salary) FROM employees);
@@ test

@@ task richer-than-boss | Зарабатывают больше руководителя | xp=45 interview
Выведите имена сотрудников (`name`), чья зарплата **больше**, чем у их непосредственного руководителя.
@@ hint
Соедините `employees` с собой: `e` — сотрудник, `m` — его руководитель (`m.id = e.manager_id`).
@@ hint
`WHERE e.salary > m.salary`. Сотрудники без руководителя отпадут сами — у них нет пары в `INNER JOIN`.
@@ starter
SELECT name
FROM employees;
@@ solution
SELECT e.name
FROM employees e
JOIN employees m ON m.id = e.manager_id
WHERE e.salary > m.salary;
@@ test

@@ task best-customers | Лучшие покупатели | xp=55 interview
Для каждого покупателя посчитайте выручку (`revenue`) — сумму `quantity * price` по позициям его **оплаченных** заказов (`status = 'paid'`). Выведите имя (`name`) и выручку двух покупателей с наибольшей выручкой, по убыванию.
@@ hint
Цепочка соединений: `customers → orders → order_items → products`.
@@ hint
`WHERE o.status = 'paid' GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 2`.
@@ starter
SELECT c.name
FROM customers c
JOIN orders o ON o.customer_id = c.id;
@@ solution
SELECT c.name, SUM(oi.quantity * p.price) AS revenue
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
WHERE o.status = 'paid'
GROUP BY c.id, c.name
ORDER BY revenue DESC
LIMIT 2;
@@ test
--@ ordered

@@ task never-ordered | Товары, которые не покупали | xp=45 interview
Выведите названия товаров (`name`), которые не встречаются **ни в одном оплаченном** заказе. Товар, который есть только в новых или отменённых заказах, тоже считается некупленным. Отсортируйте по названию.
@@ hint
`NOT EXISTS` с подзапросом, который ищет позицию оплаченного заказа с этим товаром.
@@ hint
`WHERE NOT EXISTS (SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status = 'paid')`.
@@ starter
SELECT name
FROM products
ORDER BY name;
@@ solution
SELECT p.name
FROM products p
WHERE NOT EXISTS (
    SELECT 1
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = p.id AND o.status = 'paid'
)
ORDER BY p.name;
@@ test
--@ ordered
