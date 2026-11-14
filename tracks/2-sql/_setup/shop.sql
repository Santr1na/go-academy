CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  manager_id INTEGER REFERENCES employees(id),
  salary INTEGER NOT NULL,
  hired_at TEXT NOT NULL
);
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  email TEXT
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL
);

INSERT INTO departments VALUES (1, 'Разработка'), (2, 'Продажи'), (3, 'Бухгалтерия'), (4, 'Маркетинг');

INSERT INTO employees VALUES
  (1, 'Анна Орлова',     1, NULL, 300000, '2018-03-01'),
  (2, 'Борис Клименко',  1, 1,    220000, '2019-06-15'),
  (3, 'Вера Соколова',   1, 1,    220000, '2020-01-10'),
  (4, 'Глеб Назаров',    1, 2,    150000, '2022-09-01'),
  (5, 'Дарья Лебедева',  2, NULL, 180000, '2017-11-20'),
  (6, 'Егор Тихонов',    2, 5,    120000, '2021-04-05'),
  (7, 'Жанна Ким',       2, 5,    190000, '2019-02-11'),
  (8, 'Захар Попов',     3, NULL, 140000, '2016-08-30'),
  (9, 'Инна Белова',     3, 8,    95000,  '2023-02-01'),
  (10, 'Кирилл Юдин',    NULL, 1, 110000, '2024-05-20');

INSERT INTO customers VALUES
  (1, 'Алексей', 'Москва', 'alex@example.com'),
  (2, 'Мария',   'Казань', 'maria@example.com'),
  (3, 'Иван',    'Москва', NULL),
  (4, 'Ольга',   'Самара', 'olga@example.com'),
  (5, 'Пётр',    NULL,     'petr@example.com'),
  (6, 'Нина',    'Казань', NULL);

INSERT INTO products VALUES
  (1, 'Ноутбук',     'Электроника', 90000),
  (2, 'Смартфон',    'Электроника', 60000),
  (3, 'Наушники',    'Электроника', 8000),
  (4, 'Кофеварка',   'Для дома',    12000),
  (5, 'Чайник',      'Для дома',    3000),
  (6, 'Рюкзак',      'Аксессуары',  5000),
  (7, 'Чехол',       'Аксессуары',  1000),
  (8, 'Монитор',     'Электроника', 25000);

INSERT INTO orders VALUES
  (1, 1, '2024-01-15', 'paid'),
  (2, 1, '2024-02-03', 'paid'),
  (3, 2, '2024-02-10', 'paid'),
  (4, 3, '2024-02-21', 'cancelled'),
  (5, 2, '2024-03-05', 'new'),
  (6, 4, '2024-03-09', 'paid'),
  (7, 1, '2024-03-18', 'new'),
  (8, 5, '2024-03-25', 'paid');

INSERT INTO order_items VALUES
  (1, 1, 1), (1, 7, 2),
  (2, 3, 1),
  (3, 2, 1), (3, 7, 1), (3, 6, 1),
  (4, 8, 2),
  (5, 5, 1), (5, 4, 1),
  (6, 2, 2),
  (7, 6, 3),
  (8, 3, 2), (8, 5, 1);
