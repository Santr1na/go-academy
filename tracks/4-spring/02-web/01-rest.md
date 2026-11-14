---
id: spring-rest
title: REST-контроллеры и слои приложения
summary: Как HTTP-запрос превращается в вызов метода, DTO и коды ответов.
xp: 35
---
## Слои приложения

Типичное Spring-приложение делится на три слоя, и зависимости идут строго сверху вниз:

```text
Controller   — принимает HTTP, проверяет вход, возвращает ответ. Никакой бизнес-логики.
    ↓
Service      — бизнес-логика и транзакции.
    ↓
Repository   — доступ к базе данных.
```

Контроллер не обращается к репозиторию напрямую, а сервис не знает про HTTP — тогда логику можно тестировать и переиспользовать без веба.

## REST в двух словах

REST — стиль построения HTTP API вокруг **ресурсов**. Адрес обозначает ресурс (существительное), а действие задаёт метод:

| Метод | Адрес | Действие | Успешный код |
|---|---|---|---|
| `GET` | `/api/orders` | список | 200 |
| `GET` | `/api/orders/42` | один заказ | 200 |
| `POST` | `/api/orders` | создать | 201 Created |
| `PUT` | `/api/orders/42` | заменить целиком | 200 |
| `PATCH` | `/api/orders/42` | изменить частично | 200 |
| `DELETE` | `/api/orders/42` | удалить | 204 No Content |

**Идемпотентность** — повторный запрос даёт тот же результат, что и один. `GET`, `PUT`, `DELETE` идемпотентны, `POST` — нет: два одинаковых `POST` создадут два заказа. Это важно при повторах после сетевых сбоев.

Коды ответов: `2xx` — успех; `400` — некорректный запрос; `401` — не аутентифицирован; `403` — нет прав; `404` — не найдено; `409` — конфликт; `422` — данные не прошли проверку; `500` — ошибка сервера.

## Контроллер

```java
@RestController
@RequestMapping("/api/orders")
class OrderController {
    private final OrderService service;

    OrderController(OrderService service) { this.service = service; }

    @GetMapping
    List<OrderDto> list(@RequestParam(defaultValue = "0") int page) {       // ?page=2
        return service.findAll(page);
    }

    @GetMapping("/{id}")
    OrderDto get(@PathVariable long id) {                                   // /api/orders/42
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    OrderDto create(@RequestBody @Valid CreateOrderRequest request) {       // JSON из тела
        return service.create(request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
```

`@RestController` = `@Controller` + `@ResponseBody`: результат метода сериализуется в JSON (библиотекой Jackson) и пишется в тело ответа. Обычный `@Controller` возвращает имя HTML-шаблона.

| Аннотация | Откуда берётся значение |
|---|---|
| `@PathVariable` | часть пути: `/orders/{id}` |
| `@RequestParam` | параметр строки запроса: `?page=2` |
| `@RequestBody` | тело запроса (JSON → объект) |
| `@RequestHeader` | заголовок |

`ResponseEntity<T>` нужен, когда надо управлять кодом и заголовками ответа вручную.

## Путь запроса

```text
HTTP-запрос → Tomcat → фильтры (в том числе Spring Security)
            → DispatcherServlet → поиск метода контроллера (HandlerMapping)
            → преобразование аргументов (JSON → объект) → метод контроллера
            → преобразование результата в JSON → HTTP-ответ
```

`DispatcherServlet` — единая точка входа Spring MVC (паттерн Front Controller). По умолчанию каждый запрос обрабатывается своим потоком из пула Tomcat (200 потоков).

## DTO

Не отдавайте наружу и не принимайте из запроса сущности базы данных (`@Entity`). Используйте **DTO** — отдельные классы для API, удобнее всего `record`:

```java
record CreateOrderRequest(long productId, int quantity) { }
record OrderDto(long id, String product, int quantity, String status) { }
```

Причины: клиент не увидит служебные поля (хеш пароля); изменение таблицы не ломает API; из запроса нельзя подставить лишние поля (`"role": "ADMIN"`); не возникает проблем с ленивой загрузкой и циклическими ссылками при сериализации.

@@ quiz
@@ q
Какой метод HTTP **не** является идемпотентным?
- [ ] `GET`
- [ ] `PUT`
- [ ] `DELETE`
- [x] `POST`
@@ explain
Повторный `POST` создаст ещё один ресурс. `PUT` дважды запишет одно и то же состояние, `DELETE` дважды даст тот же итог — ресурса нет.

@@ q
Чем `@RestController` отличается от `@Controller`?
- [ ] Ничем
- [x] Результат методов пишется прямо в тело ответа (обычно как JSON), а не трактуется как имя шаблона
- [ ] Он работает только с методом `GET`
- [ ] Он не является бином
@@ explain
`@RestController` — это `@Controller` плюс `@ResponseBody` на всех методах.

@@ q
Запрос `GET /api/orders/42?expand=items`. Какими аннотациями получить `42` и `items`?
- [ ] `@RequestBody` и `@RequestHeader`
- [x] `@PathVariable` и `@RequestParam`
- [ ] `@RequestParam` и `@PathVariable`
- [ ] Обе через `@RequestParam`
@@ explain
`42` — часть пути (`/orders/{id}`), это `@PathVariable`. `expand=items` — параметр строки запроса, это `@RequestParam`.

@@ q
Клиент аутентифицирован, но пытается открыть чужой заказ, на который у него нет прав. Какой код ответа уместен?
- [ ] 401
- [x] 403
- [ ] 400
- [ ] 500
@@ explain
401 — «кто вы?» (нет или неверные учётные данные). 403 — «я знаю, кто вы, но вам сюда нельзя».

@@ q
Почему из контроллера не возвращают объекты `@Entity` напрямую?
- [ ] Jackson не умеет сериализовать сущности
- [x] Наружу утекают внутренние поля, API оказывается привязан к схеме базы, возможны проблемы с ленивой загрузкой
- [ ] Сущности нельзя передавать между слоями
- [ ] Это запрещено Spring
@@ explain
Технически вернуть сущность можно, и именно поэтому это частая ошибка. DTO отделяет контракт API от модели хранения.

@@ task todo-api | Сервис и контроллер | xp=55 interview
Реализуйте слой сервиса и контроллер для списка задач — на чистой Java, в стиле Spring.

`record Todo(long id, String title, boolean done)`, `record Response(int status, Object body)`.

**`TodoService`** (хранит задачи в памяти, идентификаторы выдаёт по порядку начиная с 1):

- `Todo create(String title)`;
- `Optional<Todo> find(long id)`;
- `List<Todo> all()` — в порядке создания;
- `Optional<Todo> complete(long id)` — помечает задачу выполненной и возвращает её; для несуществующего id — пустой `Optional`;
- `boolean delete(long id)`.

**`TodoController`** получает сервис через конструктор:

- `Response create(String title)` — `201` и созданная задача; если заголовок `null` или пустой (`isBlank`) — `400` и строка `"title is required"`;
- `Response get(long id)` — `200` и задача либо `404` и `"not found"`;
- `Response list()` — `200` и список;
- `Response complete(long id)` — `200` и задача либо `404`;
- `Response delete(long id)` — `204` и `null` либо `404` и `"not found"`.
@@ hint
В сервисе: `Map<Long, Todo> todos = new LinkedHashMap<>()` и счётчик `long nextId = 1`. `record` неизменяем, поэтому «пометить выполненной» — значит положить в мапу новый объект `new Todo(id, title, true)`.
@@ hint
В контроллере удобно: `return service.find(id).map(t -> new Response(200, t)).orElse(new Response(404, "not found"));`
@@ starter
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

record Todo(long id, String title, boolean done) { }

record Response(int status, Object body) { }

class TodoService {
    Todo create(String title) { return null; }

    Optional<Todo> find(long id) { return Optional.empty(); }

    List<Todo> all() { return new ArrayList<>(); }

    Optional<Todo> complete(long id) { return Optional.empty(); }

    boolean delete(long id) { return false; }
}

class TodoController {
    private final TodoService service;

    TodoController(TodoService service) { this.service = service; }

    Response create(String title) { return new Response(500, null); }

    Response get(long id) { return new Response(500, null); }

    Response list() { return new Response(500, null); }

    Response complete(long id) { return new Response(500, null); }

    Response delete(long id) { return new Response(500, null); }
}

public class Main {
    public static void main(String[] args) {
        TodoController c = new TodoController(new TodoService());
        System.out.println(c.create("Выучить Spring"));
        System.out.println(c.list());
    }
}
@@ solution
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

record Todo(long id, String title, boolean done) { }

record Response(int status, Object body) { }

class TodoService {
    private final Map<Long, Todo> todos = new LinkedHashMap<>();
    private long nextId = 1;

    Todo create(String title) {
        Todo t = new Todo(nextId++, title, false);
        todos.put(t.id(), t);
        return t;
    }

    Optional<Todo> find(long id) { return Optional.ofNullable(todos.get(id)); }

    List<Todo> all() { return new ArrayList<>(todos.values()); }

    Optional<Todo> complete(long id) {
        Todo t = todos.get(id);
        if (t == null) return Optional.empty();
        Todo done = new Todo(t.id(), t.title(), true);
        todos.put(id, done);
        return Optional.of(done);
    }

    boolean delete(long id) { return todos.remove(id) != null; }
}

class TodoController {
    private final TodoService service;

    TodoController(TodoService service) { this.service = service; }

    Response create(String title) {
        if (title == null || title.isBlank()) return new Response(400, "title is required");
        return new Response(201, service.create(title));
    }

    Response get(long id) {
        return service.find(id).map(t -> new Response(200, t)).orElse(new Response(404, "not found"));
    }

    Response list() { return new Response(200, service.all()); }

    Response complete(long id) {
        return service.complete(id).map(t -> new Response(200, t)).orElse(new Response(404, "not found"));
    }

    Response delete(long id) {
        return service.delete(id) ? new Response(204, null) : new Response(404, "not found");
    }
}

public class Main {
    public static void main(String[] args) {
        TodoController c = new TodoController(new TodoService());
        System.out.println(c.create("Выучить Spring"));
        System.out.println(c.list());
    }
}
@@ test
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("создание", () -> { TodoController c = new TodoController(new TodoService()); T.eq(new Response(201, new Todo(1, "A", false)), c.create("A")); T.eq(new Response(201, new Todo(2, "B", false)), c.create("B")); });
        T.test("пустой заголовок", () -> { TodoController c = new TodoController(new TodoService()); T.eq(new Response(400, "title is required"), c.create("  ")); T.eq(new Response(400, "title is required"), c.create(null)); T.eq(new Response(200, List.of()), c.list()); });
        T.test("получение", () -> { TodoController c = new TodoController(new TodoService()); c.create("A"); T.eq(new Response(200, new Todo(1, "A", false)), c.get(1)); T.eq(new Response(404, "not found"), c.get(99)); });
        T.test("список в порядке создания", () -> { TodoController c = new TodoController(new TodoService()); c.create("A"); c.create("B"); T.eq(new Response(200, List.of(new Todo(1, "A", false), new Todo(2, "B", false))), c.list()); });
        T.test("выполнение", () -> { TodoController c = new TodoController(new TodoService()); c.create("A"); T.eq(new Response(200, new Todo(1, "A", true)), c.complete(1)); T.eq(new Response(200, new Todo(1, "A", true)), c.get(1)); T.eq(404, c.complete(5).status()); });
        T.test("удаление", () -> { TodoController c = new TodoController(new TodoService()); c.create("A"); T.eq(new Response(204, null), c.delete(1)); T.eq(new Response(404, "not found"), c.delete(1)); T.eq(404, c.get(1).status()); });
        T.test("id не переиспользуются", () -> { TodoController c = new TodoController(new TodoService()); c.create("A"); c.delete(1); T.eq(2L, ((Todo) c.create("B").body()).id()); });
        T.done();
    }
}
