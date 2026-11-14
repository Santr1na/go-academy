---
id: sql-windows
title: Оконные функции
summary: ROW_NUMBER, RANK, накопительные суммы и задача «топ-N в каждой группе».
setup: shop
xp: 40
---
## Чем окно отличается от GROUP BY

`GROUP BY` **сворачивает** строки: из десяти сотрудников получается три строки отделов. Оконная функция считает то же самое, но **сохраняет все строки** и дописывает результат к каждой.

```sql
SELECT name, department_id, salary,
       AVG(salary) OVER (PARTITION BY department_id) AS dept_avg
FROM employees;
```

Каждый сотрудник остаётся в результате, и рядом появляется средняя зарплата его отдела. Сделать это через `GROUP BY` можно только соединением с подзапросом.

## Устройство OVER

```sql
функция() OVER (
    PARTITION BY …   -- на какие группы делить (необязательно)
    ORDER BY …       -- порядок строк внутри группы (необязательно)
)
```

- без `PARTITION BY` окно — весь результат;
- `ORDER BY` внутри `OVER` задаёт порядок **для функции** и не обязан совпадать с сортировкой запроса.

## Нумерация: ROW_NUMBER, RANK, DENSE_RANK

Три функции отличаются поведением при одинаковых значениях:

| salary | `ROW_NUMBER()` | `RANK()` | `DENSE_RANK()` |
|---|---|---|---|
| 300000 | 1 | 1 | 1 |
| 220000 | 2 | 2 | 2 |
| 220000 | 3 | 2 | 2 |
| 150000 | 4 | **4** | **3** |

- `ROW_NUMBER` — всегда разные номера; порядок среди равных произвольный, если не добавить второй ключ сортировки;
- `RANK` — равным одинаковый номер, затем **пропуск**;
- `DENSE_RANK` — равным одинаковый номер, **без пропуска**.

```sql
SELECT name, department_id, salary,
       RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk
FROM employees;
```

## Топ-N в каждой группе

Классика собеседований: «по два самых высокооплачиваемых сотрудника в каждом отделе».

> **Ловушка.** Оконные функции вычисляются на этапе `SELECT`, то есть **после** `WHERE`. Написать `WHERE rnk <= 2` в том же запросе нельзя — столбца ещё не существует. Нужен внешний запрос или CTE.

```sql
WITH ranked AS (
    SELECT name, department_id, salary,
           DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk
    FROM employees
)
SELECT name, department_id, salary
FROM ranked
WHERE rnk <= 2;
```

Какую функцию взять — зависит от того, что делать с равными зарплатами: `ROW_NUMBER` даст ровно двух человек, `DENSE_RANK` — всех, чья зарплата входит в две наибольшие.

## Накопительный итог

Если в окне есть `ORDER BY`, агрегат считается не по всей группе, а **от начала до текущей строки**:

```sql
SELECT id, created_at,
       COUNT(*) OVER (ORDER BY created_at) AS orders_so_far
FROM orders;
```

> **Ловушка.** По умолчанию рамка окна с `ORDER BY` — `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, и строки с **одинаковым** значением ключа сортировки попадают в неё все сразу: у двух заказов от одной даты накопительная сумма будет одинаковой. Чтобы считать строго по строкам, указывайте рамку явно: `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — или сортируйте по уникальному ключу.

## LAG и LEAD

Доступ к соседним строкам — для сравнения «с предыдущим периодом»:

```sql
SELECT id, created_at,
       LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at) AS prev_order
FROM orders;
```

`LAG(x)` — значение из предыдущей строки окна, `LEAD(x)` — из следующей; для первой (последней) строки результат `NULL`.

@@ quiz
@@ q
Зарплаты по убыванию: 300, 220, 220, 150. Какие значения даст `DENSE_RANK() OVER (ORDER BY salary DESC)`?
- [ ] 1, 2, 3, 4
- [ ] 1, 2, 2, 4
- [x] 1, 2, 2, 3
- [ ] 1, 1, 2, 3
@@ explain
`DENSE_RANK` даёт равным значениям один номер и не пропускает следующий. Вариант 1, 2, 2, 4 — это `RANK`, а 1, 2, 3, 4 — `ROW_NUMBER`.

@@ q
Почему запрос не сработает?
```sql
SELECT name, ROW_NUMBER() OVER (ORDER BY salary DESC) AS rn
FROM employees
WHERE rn <= 3;
```
- [ ] `ROW_NUMBER` требует `PARTITION BY`
- [x] `WHERE` выполняется раньше оконных функций, столбца `rn` ещё нет
- [ ] В `OVER` нельзя использовать `DESC`
- [ ] Нужен `GROUP BY`
@@ explain
Оконные функции вычисляются после `WHERE`, `GROUP BY` и `HAVING`. Фильтровать по их результату можно только во внешнем запросе или через CTE.

@@ q
Чем оконная функция отличается от агрегата с `GROUP BY`?
- [ ] Работает только с числами
- [x] Не сворачивает строки: результат вычисляется для каждой строки отдельно
- [ ] Не может использовать `SUM` и `AVG`
- [ ] Выполняется до `WHERE`
@@ explain
`GROUP BY` оставляет одну строку на группу. Оконная функция оставляет все строки и добавляет к каждой значение, посчитанное по её «окну».

@@ q
Что вернёт `LAG(salary) OVER (ORDER BY salary)` для первой строки окна?
- [ ] 0
- [x] `NULL`
- [ ] Значение последней строки
- [ ] Ошибку
@@ explain
У первой строки нет предыдущей, поэтому `LAG` возвращает `NULL` (можно задать значение по умолчанию третьим аргументом: `LAG(salary, 1, 0)`).

@@ task rank-in-dept | Место в отделе | xp=40 interview
Выведите для сотрудников, у которых указан отдел: имя (`name`), номер отдела (`department_id`), зарплату (`salary`) и место по зарплате внутри отдела (`rnk`) — у самого высокооплачиваемого 1; при равных зарплатах место одинаковое, следующее место идёт **без пропуска**. Отсортируйте по номеру отдела, затем по месту, затем по имени.
@@ hint
«Без пропуска» — это `DENSE_RANK()`.
@@ hint
`DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk`, а сотрудников без отдела уберите через `WHERE department_id IS NOT NULL`.
@@ starter
SELECT name, department_id, salary
FROM employees
WHERE department_id IS NOT NULL;
@@ solution
SELECT name, department_id, salary,
       DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk
FROM employees
WHERE department_id IS NOT NULL
ORDER BY department_id, rnk, name;
@@ test
--@ ordered

@@ task top-earner | Самые высокооплачиваемые в отделах | xp=50 interview
Выведите название отдела (`department`), имя сотрудника (`name`) и зарплату (`salary`) для сотрудников с **наибольшей зарплатой в своём отделе**. Если таких в отделе несколько — выведите всех. Отсортируйте по названию отдела, затем по имени.
@@ hint
Пронумеруйте сотрудников внутри отдела в CTE: `RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk`.
@@ hint
Во внешнем запросе оставьте `rnk = 1` и соедините с `departments`, чтобы получить название.
@@ starter
SELECT d.name AS department, e.name, e.salary
FROM employees e
JOIN departments d ON d.id = e.department_id;
@@ solution
WITH ranked AS (
    SELECT name, department_id, salary,
           RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS rnk
    FROM employees
    WHERE department_id IS NOT NULL
)
SELECT d.name AS department, r.name, r.salary
FROM ranked r
JOIN departments d ON d.id = r.department_id
WHERE r.rnk = 1
ORDER BY d.name, r.name;
@@ test
--@ ordered
