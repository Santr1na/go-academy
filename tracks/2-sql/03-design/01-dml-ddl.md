---
id: sql-dml
title: Изменение данных и структура таблиц
summary: INSERT, UPDATE, DELETE, ключи, ограничения и нормализация.
setup: shop
xp: 30
---
## INSERT

```sql
INSERT INTO customers (name, city, email)
VALUES ('Сергей', 'Тула', 'sergey@example.com');

INSERT INTO customers (name, city) VALUES ('Алла', 'Омск'), ('Лев', 'Томск');   -- несколько строк
```

Всегда перечисляйте столбцы: запрос без списка столбцов сломается, как только в таблицу добавят новый.

## UPDATE и DELETE

```sql
UPDATE employees
SET salary = salary * 1.1
WHERE department_id = 2;

DELETE FROM orders
WHERE status = 'cancelled';
```

> **Ловушка.** `UPDATE` и `DELETE` без `WHERE` изменят или удалят **все** строки таблицы. Это реальная причина многих аварий. Привычка профессионала: сначала написать `SELECT` с тем же `WHERE` и посмотреть, какие строки он вернёт, затем выполнять изменение в транзакции.

`DELETE` удаляет строки по одной и может быть отменён в транзакции; `TRUNCATE TABLE` мгновенно очищает таблицу целиком; `DROP TABLE` удаляет таблицу вместе со структурой.

## CREATE TABLE и ограничения

Ограничения (constraints) — правила, за соблюдением которых следит сама база. Это последний рубеж защиты данных: ошибку в приложении они не пропустят.

```sql
CREATE TABLE reviews (
    id          INTEGER PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, customer_id)
);
```

| Ограничение | Что гарантирует |
|---|---|
| `PRIMARY KEY` | уникальный идентификатор строки: `UNIQUE` + `NOT NULL`; в таблице один |
| `FOREIGN KEY` / `REFERENCES` | значение существует в другой таблице |
| `UNIQUE` | нет повторов; ограничений может быть несколько |
| `NOT NULL` | значение обязательно |
| `CHECK` | произвольное условие |
| `DEFAULT` | значение по умолчанию |

Внешний ключ не даст удалить покупателя, у которого есть заказы. Поведение настраивается: `ON DELETE CASCADE` (удалить и заказы), `SET NULL`, `RESTRICT`.

> **Ловушка.** `UNIQUE` допускает несколько строк с `NULL`: с точки зрения SQL два неизвестных значения не равны друг другу. Так ведут себя PostgreSQL, MySQL и SQLite.

Изменение структуры: `ALTER TABLE products ADD COLUMN weight INTEGER;`.

## Нормализация

Нормализация — устранение дублирования данных. Цель: каждый факт хранится в одном месте.

- **1НФ** — в ячейке одно значение: не `"красный, синий"` в одном поле.
- **2НФ** — неключевые столбцы зависят от всего первичного ключа, а не от его части.
- **3НФ** — неключевые столбцы не зависят друг от друга: название отдела хранится в `departments`, а не повторяется в каждой строке сотрудника.

Если хранить название отдела в `employees`, то при переименовании придётся править сотни строк, и рано или поздно данные разойдутся (аномалия обновления). Иногда данные **денормализуют** намеренно — ради скорости чтения, осознанно платя сложностью обновления.

Типы связей: один-ко-многим (внешний ключ на стороне «много»), многие-ко-многим (отдельная таблица связей, как `order_items` между `orders` и `products`), один-к-одному.

## Как проверяются задачи этого урока

Вы пишете команды изменения данных, а проверка смотрит на **состояние таблицы** после них. Каждый запуск начинается с исходной базы.

@@ quiz
@@ q
Что сделает запрос?
```sql
UPDATE employees SET salary = 0;
```
- [ ] Ничего: без `WHERE` запрос не выполнится
- [x] Обнулит зарплату у всех сотрудников
- [ ] Обнулит зарплату у первого сотрудника
- [ ] Вернёт ошибку
@@ explain
Без `WHERE` изменение применяется ко всем строкам. База не спрашивает подтверждения.

@@ q
В таблице есть ограничение `UNIQUE (email)`. Можно ли вставить две строки с `email = NULL`?
- [x] Да: `NULL` не считается равным другому `NULL`
- [ ] Нет: `NULL` тоже должен быть уникален
- [ ] Только одну
- [ ] `UNIQUE` запрещает `NULL` вообще
@@ explain
В PostgreSQL, MySQL и SQLite уникальность проверяется только для известных значений. Чтобы запретить пустые значения, добавляют `NOT NULL`.

@@ q
Чем `PRIMARY KEY` отличается от `UNIQUE`?
- [ ] Ничем
- [x] Первичный ключ в таблице один и не допускает `NULL`; `UNIQUE`-ограничений может быть несколько
- [ ] `UNIQUE` работает только с числами
- [ ] Первичный ключ не создаёт индекс
@@ explain
Первичный ключ — основной идентификатор строки, на него ссылаются внешние ключи. Оба ограничения автоматически создают индекс.

@@ q
Таблица `orders` ссылается на `customers` внешним ключом без `ON DELETE`. Что произойдёт при удалении покупателя, у которого есть заказы?
- [ ] Заказы удалятся вместе с ним
- [ ] В заказах `customer_id` станет `NULL`
- [x] База вернёт ошибку и ничего не удалит
- [ ] Покупатель удалится, заказы останутся с несуществующим `customer_id`
@@ explain
По умолчанию внешний ключ запрещает оставлять «висящие» ссылки. Каскадное удаление или обнуление нужно включать явно: `ON DELETE CASCADE` / `SET NULL`.

@@ task raise | Повышение зарплаты | xp=30
Повысьте зарплату на 10% всем сотрудникам отдела продаж (`department_id = 2`). Остальных не трогайте.
@@ hint
`UPDATE employees SET salary = … WHERE …`.
@@ hint
Новое значение — `salary * 1.1`; условие — `department_id = 2`.
@@ starter
UPDATE employees
SET salary = salary;
@@ solution
UPDATE employees
SET salary = salary * 1.1
WHERE department_id = 2;
@@ test
--@ ordered
--@ check: SELECT id, salary FROM employees ORDER BY id

@@ task cleanup | Удаление отменённых заказов | xp=40 interview
Удалите из базы все отменённые заказы (`status = 'cancelled'`) **вместе с их позициями** в таблице `order_items`.

Таблица `order_items` ссылается на `orders` внешним ключом, поэтому порядок удаления важен.
@@ hint
Сначала удаляются позиции (дочерние строки), затем сами заказы — иначе база не даст удалить заказ, на который есть ссылки.
@@ hint
`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE status = 'cancelled');` — и затем `DELETE FROM orders WHERE status = 'cancelled';`.
@@ starter
DELETE FROM orders
WHERE status = 'cancelled';
@@ solution
DELETE FROM order_items
WHERE order_id IN (SELECT id FROM orders WHERE status = 'cancelled');

DELETE FROM orders
WHERE status = 'cancelled';
@@ test
--@ ordered
--@ check: SELECT 'orders' AS t, COUNT(*) AS n FROM orders UNION ALL SELECT 'items', COUNT(*) FROM order_items UNION ALL SELECT 'cancelled', COUNT(*) FROM orders WHERE status = 'cancelled'

@@ task reviews | Таблица отзывов | xp=45
Создайте таблицу `reviews` со столбцами:

- `id` — целое, первичный ключ;
- `product_id` — целое, обязательное, ссылается на `products(id)`;
- `rating` — целое, обязательное, от 1 до 5;
- `comment` — текст, необязательный.

Затем добавьте в неё два отзыва: `(1, 1, 5, 'Отлично')` и `(2, 3, 4, NULL)`.
@@ hint
Проверка диапазона: `CHECK (rating BETWEEN 1 AND 5)`. Ссылка: `REFERENCES products(id)`.
@@ hint
`INSERT INTO reviews (id, product_id, rating, comment) VALUES (1, 1, 5, 'Отлично'), (2, 3, 4, NULL);`
@@ starter
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY
);
@@ solution
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT
);

INSERT INTO reviews (id, product_id, rating, comment)
VALUES (1, 1, 5, 'Отлично'), (2, 3, 4, NULL);
@@ test
--@ ordered
--@ check: SELECT r.id, r.product_id, r.rating, r.comment, (SELECT COUNT(*) FROM pragma_table_info('reviews') WHERE "notnull" = 1 AND name IN ('product_id', 'rating')) AS notnull_cols, (SELECT COUNT(*) FROM pragma_foreign_key_list('reviews')) AS fks, (SELECT sql LIKE '%CHECK%' FROM sqlite_master WHERE name = 'reviews') AS has_check FROM reviews r ORDER BY r.id
