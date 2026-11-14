---
id: spring-data
title: Spring Data JPA и Hibernate
summary: Сущности и репозитории, связи, ленивая загрузка и проблема N+1.
xp: 35
---
## JPA, Hibernate, Spring Data

- **JPA** — стандарт (набор интерфейсов и аннотаций) для отображения объектов на таблицы: ORM.
- **Hibernate** — самая популярная реализация JPA.
- **Spring Data JPA** — надстройка, которая генерирует репозитории, избавляя от шаблонного кода.

## Сущность

```java
@Entity
@Table(name = "orders")
class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    protected Order() { }                 // JPA требует конструктор без параметров
}
```

Требования к сущности: аннотация `@Entity`, поле `@Id`, конструктор без параметров, класс не `final` (Hibernate создаёт для него прокси-наследников).

## Репозиторий

```java
interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByStatus(String status);                       // запрос строится по имени метода

    Optional<Order> findFirstByCustomerIdOrderByCreatedAtDesc(Long customerId);

    @Query("select o from Order o join fetch o.items where o.id = :id")
    Optional<Order> findWithItems(@Param("id") Long id);
}
```

Вы пишете только интерфейс — реализацию Spring создаёт сам. От `JpaRepository` наследуются `save`, `findById`, `findAll`, `deleteById`, `count`, постраничная выдача (`Pageable`).

Язык в `@Query` — **JPQL**: похож на SQL, но оперирует сущностями и их полями, а не таблицами.

## Состояния сущности и контекст персистентности

Hibernate отслеживает загруженные сущности в **контексте персистентности** (кеш первого уровня), который живёт в рамках транзакции.

| Состояние | Смысл |
|---|---|
| transient | новый объект, Hibernate о нём не знает |
| managed (persistent) | отслеживается; изменения сами попадут в базу |
| detached | был отслеживаемым, но контекст закрыт |
| removed | помечен на удаление |

Следствие — **dirty checking**: в транзакции достаточно изменить поле отслеживаемой сущности, вызывать `save` не нужно. При фиксации Hibernate сравнит состояние со снимком и сам выполнит `UPDATE`.

```java
@Transactional
void rename(long id, String name) {
    Customer c = repository.findById(id).orElseThrow();
    c.setName(name);                  // UPDATE уйдёт при коммите
}
```

## Ленивая и жадная загрузка

| Связь | По умолчанию |
|---|---|
| `@ManyToOne`, `@OneToOne` | **EAGER** — загружается сразу |
| `@OneToMany`, `@ManyToMany` | **LAZY** — при первом обращении |

Рекомендация: ставить `LAZY` везде и загружать связи явно там, где они нужны.

> **Ловушка.** Обращение к ленивой связи вне транзакции (например, при сериализации сущности в контроллере) даёт `LazyInitializationException`: контекст уже закрыт, догрузить данные нечем. Решение — загрузить нужное внутри транзакции и вернуть DTO.

## Проблема N+1

```java
List<Order> orders = orderRepository.findAll();          // 1 запрос
for (Order o : orders) {
    System.out.println(o.getCustomer().getName());       // + по запросу на каждый заказ
}
```

Для 100 заказов — 101 запрос. Это самая частая причина медленных приложений на Hibernate, и про неё спрашивают почти всегда.

Решения:

- `join fetch` в JPQL: `select o from Order o join fetch o.customer`;
- `@EntityGraph(attributePaths = "customer")` над методом репозитория;
- пакетная загрузка: `@BatchSize` или свойство `hibernate.default_batch_fetch_size`;
- проекция сразу в DTO.

Как заметить: включить вывод SQL (`spring.jpa.show-sql=true`) и посмотреть, сколько запросов уходит на одну операцию.

## Ещё на что обратить внимание

- **`equals`/`hashCode` у сущностей** — не по всем полям и не через Lombok `@Data`: у новой сущности `id` ещё `null`, а обход ленивых связей в `hashCode` вызовет загрузку. Сравнивайте по идентификатору или бизнес-ключу.
- **`open-in-view`** в Boot включён по умолчанию и держит соединение с базой до конца HTTP-запроса; в серьёзных проектах его отключают.
- **Миграции схемы** делают инструментами Flyway или Liquibase, а не `ddl-auto=update`.

@@ quiz
@@ q
Что такое проблема N+1?
- [ ] Ошибка на единицу при постраничной выдаче
- [x] Один запрос за списком сущностей и по дополнительному запросу для связи каждой из них
- [ ] Лишний столбец в таблице
- [ ] Превышение числа соединений в пуле
@@ explain
Классический случай — обход ленивой связи в цикле. Лечится `join fetch`, `@EntityGraph` или пакетной загрузкой.

@@ q
Что произойдёт?
```java
@Transactional
void rename(long id, String name) {
    Customer c = repository.findById(id).orElseThrow();
    c.setName(name);
}
```
- [ ] Ничего: не вызван `save`
- [x] Имя обновится в базе при фиксации транзакции
- [ ] Будет брошено исключение
- [ ] Изменение сохранится только в кеше
@@ explain
Сущность, загруженная в транзакции, находится в состоянии managed. Hibernate отслеживает её изменения (dirty checking) и выполнит `UPDATE` сам.

@@ q
Какой тип загрузки по умолчанию у связи `@OneToMany`?
- [ ] EAGER
- [x] LAZY
- [ ] Зависит от базы данных
- [ ] Связь не загружается вообще
@@ explain
Связи «ко многим» по умолчанию ленивые, «к одному» (`@ManyToOne`, `@OneToOne`) — жадные. Обычно и их переводят в `LAZY`.

@@ q
Когда возникает `LazyInitializationException`?
- [ ] При сохранении сущности без идентификатора
- [x] При обращении к незагруженной ленивой связи после закрытия контекста персистентности
- [ ] При вызове `findById` для несуществующего id
- [ ] При слишком большом числе запросов
@@ explain
Ленивую связь может догрузить только открытая сессия. За пределами транзакции сессии уже нет.

@@ q
Что возвращает `repository.findById(id)` в Spring Data, если записи нет?
- [ ] `null`
- [x] Пустой `Optional`
- [ ] Исключение `EntityNotFoundException`
- [ ] Новый пустой объект
@@ explain
`findById` возвращает `Optional<T>`, заставляя явно обработать отсутствие: `orElseThrow(() -> new NotFoundException(...))`.

@@ task repository | Репозиторий в памяти | xp=50
Реализуйте `InMemoryUserRepository` — хранилище в памяти с интерфейсом в стиле Spring Data. Сущность: `class User` с полями `Long id`, `String email`, `String name` (геттеры и сеттеры уже есть).

- `User save(User user)` — если `id == null`, назначает следующий идентификатор (начиная с 1) и сохраняет; иначе заменяет существующую запись с этим id. Возвращает сохранённого пользователя;
- если у **другого** пользователя уже есть такой email, `save` бросает `IllegalStateException` (аналог ограничения `UNIQUE`);
- `Optional<User> findById(long id)`;
- `Optional<User> findByEmail(String email)`;
- `List<User> findAll()` — по возрастанию id;
- `boolean deleteById(long id)`;
- `long count()`.
@@ hint
Храните данные в `Map<Long, User>` (`TreeMap` сразу даст порядок по id) и счётчик `long nextId = 1`.
@@ hint
Проверка уникальности: `findByEmail(user.getEmail())` вернул пользователя, и его `id` не равен `user.getId()` — конфликт. Сравнивайте через `Objects.equals`.
@@ starter
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

class User {
    private Long id;
    private String email;
    private String name;

    User(String email, String name) {
        this.email = email;
        this.name = name;
    }

    Long getId() { return id; }
    void setId(Long id) { this.id = id; }
    String getEmail() { return email; }
    void setEmail(String email) { this.email = email; }
    String getName() { return name; }
    void setName(String name) { this.name = name; }
}

class InMemoryUserRepository {
    User save(User user) { return user; }

    Optional<User> findById(long id) { return Optional.empty(); }

    Optional<User> findByEmail(String email) { return Optional.empty(); }

    List<User> findAll() { return new ArrayList<>(); }

    boolean deleteById(long id) { return false; }

    long count() { return 0; }
}

public class Main {
    public static void main(String[] args) {
        InMemoryUserRepository repo = new InMemoryUserRepository();
        User u = repo.save(new User("anna@example.com", "Анна"));
        System.out.println(u.getId() + " " + repo.count());
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;

class User {
    private Long id;
    private String email;
    private String name;

    User(String email, String name) {
        this.email = email;
        this.name = name;
    }

    Long getId() { return id; }
    void setId(Long id) { this.id = id; }
    String getEmail() { return email; }
    void setEmail(String email) { this.email = email; }
    String getName() { return name; }
    void setName(String name) { this.name = name; }
}

class InMemoryUserRepository {
    private final Map<Long, User> users = new TreeMap<>();
    private long nextId = 1;

    User save(User user) {
        Optional<User> sameEmail = findByEmail(user.getEmail());
        if (sameEmail.isPresent() && !Objects.equals(sameEmail.get().getId(), user.getId())) {
            throw new IllegalStateException("email уже занят: " + user.getEmail());
        }
        if (user.getId() == null) user.setId(nextId++);
        users.put(user.getId(), user);
        return user;
    }

    Optional<User> findById(long id) { return Optional.ofNullable(users.get(id)); }

    Optional<User> findByEmail(String email) {
        return users.values().stream().filter(u -> Objects.equals(u.getEmail(), email)).findFirst();
    }

    List<User> findAll() { return new ArrayList<>(users.values()); }

    boolean deleteById(long id) { return users.remove(id) != null; }

    long count() { return users.size(); }
}

public class Main {
    public static void main(String[] args) {
        InMemoryUserRepository repo = new InMemoryUserRepository();
        User u = repo.save(new User("anna@example.com", "Анна"));
        System.out.println(u.getId() + " " + repo.count());
    }
}
@@ test
public class Checker {
    public static void main(String[] args) {
        T.test("save назначает id по порядку", () -> { InMemoryUserRepository r = new InMemoryUserRepository(); T.eq(1L, r.save(new User("a@x", "A")).getId()); T.eq(2L, r.save(new User("b@x", "B")).getId()); T.eq(2L, r.count()); });
        T.test("findById и findByEmail", () -> { InMemoryUserRepository r = new InMemoryUserRepository(); r.save(new User("a@x", "A")); T.eq("A", r.findById(1).orElseThrow().getName()); T.eq(1L, r.findByEmail("a@x").orElseThrow().getId()); T.eq(true, r.findById(9).isEmpty()); T.eq(true, r.findByEmail("z@x").isEmpty()); });
        T.test("save с id обновляет запись", () -> { InMemoryUserRepository r = new InMemoryUserRepository(); User u = r.save(new User("a@x", "A")); u.setName("AA"); r.save(u); T.eq(1L, r.count()); T.eq("AA", r.findById(1).orElseThrow().getName()); });
        T.test("уникальность email", () -> { InMemoryUserRepository r = new InMemoryUserRepository(); r.save(new User("a@x", "A")); T.throwsEx(IllegalStateException.class, () -> r.save(new User("a@x", "Другой"))); T.eq(1L, r.count()); });
        T.test("обновление своего же email не конфликт", () -> { InMemoryUserRepository r = new InMemoryUserRepository(); User u = r.save(new User("a@x", "A")); u.setName("B"); T.check(r.save(u) != null, "повторное сохранение того же пользователя должно проходить"); });
        T.test("findAll по возрастанию id, deleteById", () -> {
            InMemoryUserRepository r = new InMemoryUserRepository();
            r.save(new User("a@x", "A")); r.save(new User("b@x", "B")); r.save(new User("c@x", "C"));
            T.eq(true, r.deleteById(2)); T.eq(false, r.deleteById(2));
            StringBuilder sb = new StringBuilder(); for (User u : r.findAll()) sb.append(u.getId());
            T.eq("13", sb.toString());
            T.eq(4L, r.save(new User("d@x", "D")).getId());
        });
        T.done();
    }
}
