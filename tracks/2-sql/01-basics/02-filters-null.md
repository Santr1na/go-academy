---
id: sql-filters-null
title: Фильтры и NULL
summary: IN, BETWEEN, LIKE, CASE и трёхзначная логика — главный источник ошибок в SQL.
setup: shop
xp: 25
---
## IN, BETWEEN, LIKE

```sql
SELECT * FROM products WHERE category IN ('Электроника', 'Для дома');
SELECT * FROM products WHERE price BETWEEN 3000 AND 12000;      -- обе границы включаются
SELECT * FROM customers WHERE name LIKE 'А%';                   -- начинается с «А»
SELECT * FROM customers WHERE email LIKE '%@example.com';       -- заканчивается на …
```

В шаблоне `LIKE` знак `%` — любое количество любых символов (в том числе ноль), `_` — ровно один символ.

> **Ловушка.** Шаблон, начинающийся с `%` (`LIKE '%текст'`), не может использовать обычный индекс: база просматривает всю таблицу. На больших таблицах это медленно.

## NULL — это не значение

`NULL` означает «неизвестно» или «нет данных». Это не ноль и не пустая строка. В учебной базе `NULL` встречается в `customers.city`, `customers.email`, `employees.department_id` и `employees.manager_id`.

Главное правило: **любое сравнение с `NULL` даёт не TRUE и не FALSE, а третье состояние — UNKNOWN**. А `WHERE` оставляет только строки, где условие равно TRUE.

```sql
SELECT * FROM customers WHERE city = NULL;       -- 0 строк, всегда
SELECT * FROM customers WHERE city <> NULL;      -- тоже 0 строк
SELECT * FROM customers WHERE city IS NULL;      -- правильно
SELECT * FROM customers WHERE city IS NOT NULL;  -- правильно
```

Отсюда неожиданность, на которой ловят на собеседованиях:

```sql
SELECT * FROM customers WHERE city <> 'Москва';
```

Покупатель Пётр, у которого город не указан, в результат **не попадёт**: `NULL <> 'Москва'` — это UNKNOWN. Если он нужен, пишите явно: `WHERE city <> 'Москва' OR city IS NULL`.

## Трёхзначная логика

| Выражение | Результат |
|---|---|
| `NULL = NULL` | UNKNOWN |
| `NULL + 1`, `NULL \|\| 'текст'` | `NULL` |
| `TRUE AND UNKNOWN` | UNKNOWN |
| `FALSE AND UNKNOWN` | FALSE |
| `TRUE OR UNKNOWN` | TRUE |
| `FALSE OR UNKNOWN` | UNKNOWN |
| `NOT UNKNOWN` | UNKNOWN |

## NOT IN и NULL

Самая коварная ловушка:

```sql
SELECT * FROM employees WHERE id NOT IN (1, 5, NULL);   -- 0 строк!
```

`id NOT IN (1, 5, NULL)` разворачивается в `id <> 1 AND id <> 5 AND id <> NULL`. Последнее сравнение всегда UNKNOWN, значит всё условие никогда не станет TRUE. Одно-единственное `NULL` в списке (или в подзапросе) «обнуляет» весь результат. Безопасная замена — `NOT EXISTS` (разберём в уроке о подзапросах).

## COALESCE и CASE

`COALESCE(a, b, c)` возвращает первый аргумент, не равный `NULL`:

```sql
SELECT name, COALESCE(city, 'не указан') AS city FROM customers;
```

`CASE` — условное выражение:

```sql
SELECT name, price,
       CASE
           WHEN price >= 50000 THEN 'дорогой'
           WHEN price >= 5000  THEN 'средний'
           ELSE 'дешёвый'
       END AS segment
FROM products;
```

Ветки проверяются сверху вниз, срабатывает первая подходящая. Без `ELSE` результат для неподходящих строк — `NULL`.

## NULL в сортировке и агрегатах

- В `ORDER BY` значения `NULL` идут все вместе — в начале или в конце в зависимости от базы (в SQLite и MySQL при сортировке по возрастанию — в начале, в PostgreSQL и Oracle — в конце). Управлять можно через `NULLS FIRST` / `NULLS LAST`.
- Агрегатные функции (`SUM`, `AVG`, `COUNT(столбец)`) **пропускают** `NULL`. Об этом — в следующем уроке.

@@ quiz
@@ q
В таблице `customers` 6 строк, у одного покупателя `city` равен `NULL`, двое живут в Москве. Сколько строк вернёт запрос?
```sql
SELECT * FROM customers WHERE city <> 'Москва';
```
- [ ] 4
- [x] 3
- [ ] 6
- [ ] 0
@@ explain
Для строки с `city IS NULL` сравнение даёт UNKNOWN, и `WHERE` её отбрасывает. Остаются трое покупателей из Казани и Самары. Чтобы включить четвёртого, нужно `OR city IS NULL`.

@@ q
Что вернёт запрос?
```sql
SELECT * FROM employees WHERE manager_id = NULL;
```
- [ ] Сотрудников без менеджера
- [x] Ни одной строки
- [ ] Всех сотрудников
- [ ] Ошибку
@@ explain
Сравнение `= NULL` никогда не истинно. Проверка на отсутствие значения пишется как `manager_id IS NULL`.

@@ q
Сколько строк вернёт запрос к таблице из 10 сотрудников?
```sql
SELECT * FROM employees WHERE id NOT IN (1, 2, NULL);
```
- [ ] 8
- [ ] 10
- [x] 0
- [ ] 2
@@ explain
Условие эквивалентно `id <> 1 AND id <> 2 AND id <> NULL`. Третья часть всегда UNKNOWN, поэтому всё условие не бывает TRUE ни для одной строки.

@@ q
Какой шаблон найдёт названия, в которых вторая буква — «о»?
- [ ] `LIKE 'о%'`
- [x] `LIKE '_о%'`
- [ ] `LIKE '%о%'`
- [ ] `LIKE '%о_'`
@@ explain
`_` — ровно один любой символ, затем «о», затем `%` — что угодно. `'%о%'` нашёл бы «о» в любом месте.

@@ q
Чему равно `COALESCE(NULL, NULL, 'x', 'y')`?
- [ ] `NULL`
- [x] `'x'`
- [ ] `'y'`
- [ ] `'xy'`
@@ explain
`COALESCE` возвращает первый аргумент, отличный от `NULL`, и дальше не смотрит.

@@ task not-moscow | Все, кроме москвичей | xp=25 interview
Выведите имена (`name`) всех покупателей, которые **не** из Москвы — включая тех, у кого город не указан.
@@ hint
`city <> 'Москва'` молча отбрасывает строки, где `city` равен `NULL`.
@@ hint
Добавьте второе условие через `OR`: `OR city IS NULL`.
@@ starter
SELECT name
FROM customers
WHERE city <> 'Москва';
@@ solution
SELECT name
FROM customers
WHERE city <> 'Москва' OR city IS NULL;
@@ test

@@ task segments | Ценовые сегменты | xp=30
Выведите для каждого товара название (`name`) и сегмент (столбец `segment`):

- `'premium'` — цена от 50000 и выше;
- `'middle'` — от 5000 до 49999;
- `'budget'` — меньше 5000.

Отсортируйте по названию товара.
@@ hint
Используйте `CASE WHEN … THEN … WHEN … THEN … ELSE … END AS segment`.
@@ hint
Ветки проверяются по порядку: сначала `price >= 50000`, затем `price >= 5000`, остальное — в `ELSE`.
@@ starter
SELECT name
FROM products
ORDER BY name;
@@ solution
SELECT name,
       CASE
           WHEN price >= 50000 THEN 'premium'
           WHEN price >= 5000 THEN 'middle'
           ELSE 'budget'
       END AS segment
FROM products
ORDER BY name;
@@ test
--@ ordered
--@ columns
