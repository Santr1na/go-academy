---
id: sql-aggregates
title: Агрегаты, GROUP BY и HAVING
summary: Подсчёты по группам и разница между WHERE и HAVING.
setup: shop
xp: 30
---
## Агрегатные функции

Агрегатная функция сворачивает много строк в одно значение.

```sql
SELECT COUNT(*)      AS total,        -- число строк
       SUM(salary)   AS payroll,      -- сумма
       AVG(salary)   AS avg_salary,   -- среднее
       MIN(salary)   AS min_salary,
       MAX(salary)   AS max_salary
FROM employees;
```

## Три вида COUNT

| Запись | Что считает |
|---|---|
| `COUNT(*)` | все строки |
| `COUNT(столбец)` | строки, где столбец **не NULL** |
| `COUNT(DISTINCT столбец)` | количество разных значений, не считая NULL |

```sql
SELECT COUNT(*), COUNT(city), COUNT(DISTINCT city) FROM customers;   -- 6, 5, 3
```

Все агрегаты, кроме `COUNT(*)`, **пропускают NULL**. Поэтому `AVG(x)` — это сумма, делённая на число строк с известным `x`, а не на число всех строк. На пустом наборе `COUNT` даёт 0, а `SUM`, `AVG`, `MIN`, `MAX` — `NULL`.

## GROUP BY

`GROUP BY` разбивает строки на группы с одинаковым значением и считает агрегат отдельно для каждой.

```sql
SELECT department_id, COUNT(*) AS cnt, AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id;
```

> **Важно.** В `SELECT` запроса с группировкой могут стоять только столбцы из `GROUP BY` и агрегатные функции. Запрос `SELECT department_id, name, COUNT(*) … GROUP BY department_id` бессмыслен: в группе несколько имён, какое показать? PostgreSQL и Oracle вернут ошибку. SQLite и старые настройки MySQL молча подставят имя из произвольной строки группы — и это хуже ошибки.

Строки с `NULL` в столбце группировки образуют одну общую группу.

## WHERE и HAVING

- `WHERE` фильтрует **строки до** группировки. Агрегаты в нём использовать нельзя.
- `HAVING` фильтрует **группы после** группировки. Здесь агрегаты и нужны.

```sql
SELECT department_id, AVG(salary) AS avg_salary
FROM employees
WHERE hired_at >= '2018-01-01'        -- сначала отбираем сотрудников
GROUP BY department_id
HAVING AVG(salary) > 150000           -- затем отбираем отделы
ORDER BY avg_salary DESC;
```

Условие, не зависящее от агрегатов, всегда ставьте в `WHERE`: база отбросит лишние строки до группировки, и запрос будет быстрее.

## Полный порядок выполнения

```text
FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT
```

Этот порядок объясняет почти все «почему нельзя»: агрегат нельзя в `WHERE` (группы ещё не построены), псевдоним из `SELECT` нельзя в `WHERE` и `HAVING` по стандарту (он ещё не вычислен), но можно в `ORDER BY`.

## Условные агрегаты

Чтобы посчитать несколько показателей в одном запросе, внутрь агрегата ставят `CASE`:

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
       SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
FROM orders;
```

@@ quiz
@@ q
В таблице 6 покупателей, у одного `city` равен `NULL`, остальные живут в трёх разных городах. Что вернёт запрос?
```sql
SELECT COUNT(*), COUNT(city), COUNT(DISTINCT city) FROM customers;
```
- [ ] `6, 6, 4`
- [x] `6, 5, 3`
- [ ] `6, 5, 4`
- [ ] `5, 5, 3`
@@ explain
`COUNT(*)` считает строки, `COUNT(city)` пропускает `NULL`, а `COUNT(DISTINCT city)` считает разные известные значения — `NULL` среди них нет.

@@ q
Почему этот запрос некорректен?
```sql
SELECT department_id, COUNT(*)
FROM employees
WHERE COUNT(*) > 2
GROUP BY department_id;
```
- [ ] Нельзя использовать `COUNT(*)` вместе с `GROUP BY`
- [x] Агрегат нельзя использовать в `WHERE`: условие на группы пишут в `HAVING`
- [ ] Не хватает `ORDER BY`
- [ ] `department_id` должен быть в `WHERE`
@@ explain
`WHERE` выполняется до группировки, когда групп ещё нет. Правильно: `GROUP BY department_id HAVING COUNT(*) > 2`.

@@ q
Зарплаты трёх сотрудников: 100, 200 и `NULL`. Чему равно `AVG(salary)`?
- [ ] 100
- [x] 150
- [ ] `NULL`
- [ ] 0
@@ explain
Агрегаты пропускают `NULL`: (100 + 200) / 2 = 150. Если считать `NULL` нулём, нужно `AVG(COALESCE(salary, 0))` — получится 100.

@@ q
Что вернёт `SELECT SUM(price) FROM products WHERE price > 1000000;`, если таких товаров нет?
- [ ] 0
- [x] Одну строку со значением `NULL`
- [ ] Ни одной строки
- [ ] Ошибку
@@ explain
Агрегат без `GROUP BY` всегда возвращает ровно одну строку. Сумма пустого набора — `NULL`, а не ноль. Нужен ноль — `COALESCE(SUM(price), 0)`.

@@ q
Куда правильнее поместить условие `status = 'paid'` в запросе, считающем число оплаченных заказов по покупателям?
- [x] В `WHERE`
- [ ] В `HAVING`
- [ ] В `ORDER BY`
- [ ] Не имеет значения
@@ explain
Условие относится к отдельным строкам, а не к группам. В `WHERE` оно отсечёт лишние строки до группировки — это и логичнее, и быстрее.

@@ task dept-stats | Статистика по отделам | xp=30
Для каждого отдела (`department_id`) выведите число сотрудников (`cnt`) и максимальную зарплату (`max_salary`). Сотрудников без отдела (`department_id IS NULL`) не учитывайте. Отсортируйте по `department_id`.
@@ hint
Сотрудников без отдела отсекает `WHERE department_id IS NOT NULL` — до группировки.
@@ hint
`SELECT department_id, COUNT(*) AS cnt, MAX(salary) AS max_salary … GROUP BY department_id ORDER BY department_id`.
@@ starter
SELECT department_id
FROM employees;
@@ solution
SELECT department_id, COUNT(*) AS cnt, MAX(salary) AS max_salary
FROM employees
WHERE department_id IS NOT NULL
GROUP BY department_id
ORDER BY department_id;
@@ test
--@ ordered
--@ columns

@@ task big-categories | Категории с несколькими товарами | xp=35 interview
Выведите категории товаров (`category`), в которых **больше двух** товаров, и среднюю цену товара в категории (`avg_price`). Отсортируйте по убыванию средней цены.
@@ hint
Условие «больше двух товаров» относится к группе, значит оно пишется в `HAVING`.
@@ hint
`GROUP BY category HAVING COUNT(*) > 2 ORDER BY avg_price DESC`.
@@ starter
SELECT category
FROM products;
@@ solution
SELECT category, AVG(price) AS avg_price
FROM products
GROUP BY category
HAVING COUNT(*) > 2
ORDER BY avg_price DESC;
@@ test
--@ ordered

@@ task order-statuses | Заказы по статусам | xp=35
Одним запросом выведите одну строку с тремя столбцами: `total` — всего заказов, `paid` — число оплаченных (`status = 'paid'`), `not_paid` — число остальных.
@@ hint
Условный подсчёт: `SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)`.
@@ hint
`GROUP BY` здесь не нужен: агрегаты считаются по всей таблице и дают одну строку.
@@ starter
SELECT COUNT(*) AS total
FROM orders;
@@ solution
SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
       SUM(CASE WHEN status <> 'paid' THEN 1 ELSE 0 END) AS not_paid
FROM orders;
@@ test
--@ columns
