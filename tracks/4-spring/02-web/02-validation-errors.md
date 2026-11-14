---
id: spring-errors
title: Валидация и обработка ошибок
summary: Bean Validation, @ControllerAdvice и единый формат ошибок API.
xp: 30
---
## Валидация входных данных

Данным, пришедшим от клиента, доверять нельзя. Проверку формата описывают аннотациями Bean Validation прямо на DTO:

```java
record CreateUserRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Email String email,
        @Min(18) @Max(120) int age,
        @NotNull @Size(min = 8) String password
) { }
```

| Аннотация | Что проверяет |
|---|---|
| `@NotNull` | значение не `null` |
| `@NotEmpty` | не `null` и не пустое (строка, коллекция) |
| `@NotBlank` | строка не `null` и содержит не только пробелы |
| `@Size(min, max)` | длина строки или размер коллекции |
| `@Min`, `@Max`, `@Positive` | числовые границы |
| `@Email`, `@Pattern(regexp)` | формат |
| `@Past`, `@Future` | даты |

Проверка запускается аннотацией `@Valid` на параметре контроллера:

```java
@PostMapping
UserDto create(@RequestBody @Valid CreateUserRequest request) { ... }
```

> **Ловушка.** Без `@Valid` аннотации на полях DTO **ничего не делают** — данные молча проходят непроверенными. Для вложенных объектов `@Valid` нужно ставить и на поле: `@Valid AddressDto address`.

Если проверка не пройдена, Spring бросает `MethodArgumentNotValidException`, и клиент получает ответ `400`.

Разделяйте два вида проверок: **формат** («email похож на email») — аннотациями на DTO; **бизнес-правила** («такой email ещё не зарегистрирован», «на складе хватает товара») — в сервисе, с выбросом своих исключений.

## Свои исключения

```java
class NotFoundException extends RuntimeException {
    NotFoundException(String message) { super(message); }
}

Order findById(long id) {
    return repository.findById(id)
            .orElseThrow(() -> new NotFoundException("Заказ " + id + " не найден"));
}
```

Сервис сообщает о проблеме исключением и ничего не знает про коды HTTP.

## @RestControllerAdvice — обработка в одном месте

Вместо `try/catch` в каждом контроллере пишут один глобальный обработчик:

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    ErrorResponse notFound(NotFoundException e) {
        return new ErrorResponse("NOT_FOUND", e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ErrorResponse invalid(MethodArgumentNotValidException e) {
        String details = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return new ErrorResponse("VALIDATION_FAILED", details);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    ErrorResponse unexpected(Exception e) {
        log.error("Необработанная ошибка", e);
        return new ErrorResponse("INTERNAL_ERROR", "Внутренняя ошибка сервера");
    }
}

record ErrorResponse(String code, String message) { }
```

Spring выбирает обработчик с **наиболее конкретным** типом исключения; `Exception.class` — запасной вариант «на всё остальное».

Правила хорошего API:

- у всех ошибок **один формат** ответа;
- клиент получает понятное сообщение для ошибок `4xx` и **ничего внутреннего** для `5xx`: стек вызовов и текст SQL-ошибки наружу не отдают — это и некрасиво, и небезопасно;
- непредвиденные ошибки обязательно пишутся в лог со стеком;
- код ответа соответствует смыслу: не возвращайте `200` с телом `{"error": …}`.

Стандартный формат ошибок — **Problem Details** (RFC 9457); в Spring 6 для него есть класс `ProblemDetail`.

@@ quiz
@@ q
На полях DTO стоят `@NotBlank` и `@Email`, но в контроллере параметр объявлен как `@RequestBody CreateUserRequest request`. Что произойдёт с некорректными данными?
- [ ] Spring вернёт 400
- [x] Проверка не выполнится, данные попадут в метод как есть
- [ ] Приложение не запустится
- [ ] Поля будут заменены значениями по умолчанию
@@ explain
Валидацию запускает `@Valid` (или `@Validated`) на параметре. Без неё аннотации на полях — просто метаданные.

@@ q
Чем `@NotBlank` отличается от `@NotNull` для строки?
- [ ] Ничем
- [x] `@NotNull` пропустит пустую строку и строку из пробелов, `@NotBlank` — нет
- [ ] `@NotBlank` разрешает `null`
- [ ] `@NotNull` проверяет длину
@@ explain
`@NotNull` — только «не null». `@NotEmpty` — ещё и ненулевая длина. `@NotBlank` — должен быть хотя бы один непробельный символ.

@@ q
Где правильнее проверять, что пользователь с таким email ещё не зарегистрирован?
- [ ] Аннотацией `@Email` на DTO
- [ ] В контроллере
- [x] В сервисе — это бизнес-правило, требующее обращения к базе
- [ ] В `@RestControllerAdvice`
@@ explain
Аннотации на DTO проверяют формат одного значения. Уникальность — бизнес-правило; надёжно его обеспечивает ещё и ограничение `UNIQUE` в базе.

@@ q
В `@RestControllerAdvice` есть обработчики для `NotFoundException` и для `Exception`. Какой сработает, если сервис бросил `NotFoundException`?
- [x] Обработчик `NotFoundException` — выбирается наиболее конкретный
- [ ] Обработчик `Exception` — он объявлен общим
- [ ] Оба по очереди
- [ ] Тот, что объявлен выше в классе
@@ explain
Spring подбирает обработчик по ближайшему типу в иерархии исключения. Порядок объявления методов не важен.

@@ q
Что должен получить клиент при непредвиденной ошибке сервера?
- [ ] Полный стек вызовов для отладки
- [ ] Текст SQL-запроса, который упал
- [x] Код 500 и общее сообщение; подробности — только в логах сервера
- [ ] Код 200 и поле `error`
@@ explain
Внутренние детали раскрывают устройство системы и помогают атакующему. Подробности нужны разработчику — они остаются в логе.

@@ task validator | Валидация и коды ошибок | xp=50 interview
Реализуйте проверку запроса на регистрацию и перевод исключений в ответы — то, что в Spring делают Bean Validation и `@RestControllerAdvice`.

`record SignupRequest(String name, String email, int age)`, `record ApiError(int status, String code, String message)`.

**`Main.validate(SignupRequest r)`** возвращает список ошибок (пустой, если всё верно) в таком порядке:

- `"name: must not be blank"` — имя `null` или из пробелов;
- `"email: must be a valid email"` — email `null` либо не содержит ровно один символ `@` с непустыми частями до и после;
- `"age: must be between 18 and 120"`.

**`Main.toError(Exception e)`** превращает исключение в ответ:

- `ValidationException` → `400`, код `"VALIDATION_FAILED"`, сообщение — ошибки через `"; "`;
- `NotFoundException` → `404`, `"NOT_FOUND"`, сообщение исключения;
- `ConflictException` → `409`, `"CONFLICT"`, сообщение исключения;
- любое другое → `500`, `"INTERNAL_ERROR"`, сообщение `"Internal server error"` (исходный текст наружу не отдаём).

Классы исключений уже объявлены в заготовке.
@@ hint
Для email: `int at = email.indexOf('@');` — корректно, если `at > 0`, `at == email.lastIndexOf('@')` и `at < email.length() - 1`.
@@ hint
В `toError` используйте `instanceof` с переменной: `if (e instanceof ValidationException v) return new ApiError(400, "VALIDATION_FAILED", String.join("; ", v.errors));`
@@ starter
import java.util.ArrayList;
import java.util.List;

record SignupRequest(String name, String email, int age) { }

record ApiError(int status, String code, String message) { }

class ValidationException extends RuntimeException {
    final List<String> errors;
    ValidationException(List<String> errors) { this.errors = errors; }
}

class NotFoundException extends RuntimeException {
    NotFoundException(String message) { super(message); }
}

class ConflictException extends RuntimeException {
    ConflictException(String message) { super(message); }
}

public class Main {
    static List<String> validate(SignupRequest r) {
        return new ArrayList<>();
    }

    static ApiError toError(Exception e) {
        return new ApiError(500, "INTERNAL_ERROR", e.getMessage());
    }

    public static void main(String[] args) {
        System.out.println(validate(new SignupRequest(" ", "bad", 10)));
    }
}
@@ solution
import java.util.ArrayList;
import java.util.List;

record SignupRequest(String name, String email, int age) { }

record ApiError(int status, String code, String message) { }

class ValidationException extends RuntimeException {
    final List<String> errors;
    ValidationException(List<String> errors) { this.errors = errors; }
}

class NotFoundException extends RuntimeException {
    NotFoundException(String message) { super(message); }
}

class ConflictException extends RuntimeException {
    ConflictException(String message) { super(message); }
}

public class Main {
    static boolean validEmail(String email) {
        if (email == null) return false;
        int at = email.indexOf('@');
        return at > 0 && at == email.lastIndexOf('@') && at < email.length() - 1;
    }

    static List<String> validate(SignupRequest r) {
        List<String> errors = new ArrayList<>();
        if (r.name() == null || r.name().isBlank()) errors.add("name: must not be blank");
        if (!validEmail(r.email())) errors.add("email: must be a valid email");
        if (r.age() < 18 || r.age() > 120) errors.add("age: must be between 18 and 120");
        return errors;
    }

    static ApiError toError(Exception e) {
        if (e instanceof ValidationException v) return new ApiError(400, "VALIDATION_FAILED", String.join("; ", v.errors));
        if (e instanceof NotFoundException) return new ApiError(404, "NOT_FOUND", e.getMessage());
        if (e instanceof ConflictException) return new ApiError(409, "CONFLICT", e.getMessage());
        return new ApiError(500, "INTERNAL_ERROR", "Internal server error");
    }

    public static void main(String[] args) {
        System.out.println(validate(new SignupRequest(" ", "bad", 10)));
        System.out.println(toError(new NotFoundException("Пользователь 5 не найден")));
    }
}
@@ test
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("корректный запрос", () -> T.eq(List.of(), Main.validate(new SignupRequest("Анна", "anna@example.com", 30))));
        T.test("все ошибки сразу и по порядку", () -> T.eq(List.of("name: must not be blank", "email: must be a valid email", "age: must be between 18 and 120"), Main.validate(new SignupRequest("  ", "bad", 10))));
        T.test("null-значения", () -> T.eq(List.of("name: must not be blank", "email: must be a valid email"), Main.validate(new SignupRequest(null, null, 18))));
        T.test("варианты email", () -> {
            for (String bad : new String[]{"@b.c", "a@", "a@@b", "a@b@c", ""}) T.eq("для " + bad, List.of("email: must be a valid email"), Main.validate(new SignupRequest("A", bad, 20)));
            T.eq(List.of(), Main.validate(new SignupRequest("A", "a@b", 20)));
        });
        T.test("границы возраста", () -> { T.eq(List.of(), Main.validate(new SignupRequest("A", "a@b.c", 120))); T.eq(1, Main.validate(new SignupRequest("A", "a@b.c", 121)).size()); T.eq(1, Main.validate(new SignupRequest("A", "a@b.c", 17)).size()); });
        T.test("ошибка валидации → 400", () -> T.eq(new ApiError(400, "VALIDATION_FAILED", "a; b"), Main.toError(new ValidationException(List.of("a", "b")))));
        T.test("не найдено → 404, конфликт → 409", () -> { T.eq(new ApiError(404, "NOT_FOUND", "нет"), Main.toError(new NotFoundException("нет"))); T.eq(new ApiError(409, "CONFLICT", "занято"), Main.toError(new ConflictException("занято"))); });
        T.test("прочее → 500 без подробностей", () -> T.eq(new ApiError(500, "INTERNAL_ERROR", "Internal server error"), Main.toError(new IllegalStateException("password=secret в SQL"))));
        T.done();
    }
}
