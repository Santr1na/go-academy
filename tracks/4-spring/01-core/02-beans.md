---
id: spring-beans
title: Бины, контейнер и жизненный цикл
summary: Как Spring находит и создаёт бины, области видимости и что происходит при старте.
xp: 35
---
## Как объявить бин

**Способ 1 — сканирование компонентов.** Класс помечается стереотипной аннотацией, Spring находит его при сканировании пакетов.

| Аннотация | Смысл |
|---|---|
| `@Component` | общий случай |
| `@Service` | бизнес-логика |
| `@Repository` | доступ к данным; дополнительно переводит исключения базы в иерархию Spring `DataAccessException` |
| `@Controller` / `@RestController` | обработчики веб-запросов |

Технически `@Service` и `@Component` для контейнера равнозначны — разница в выражении намерения.

**Способ 2 — Java-конфигурация.** Нужен для классов, которые вы не можете аннотировать (чужая библиотека), или когда создание требует логики:

```java
@Configuration
class AppConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    RestClient paymentClient(@Value("${payment.url}") String url) {
        return RestClient.builder().baseUrl(url).build();
    }
}
```

Имя бина по умолчанию — имя класса с маленькой буквы (`orderService`) или имя `@Bean`-метода.

## Области видимости (scope)

| Scope | Сколько экземпляров |
|---|---|
| **singleton** (по умолчанию) | один на контейнер |
| prototype | новый при каждом запросе бина |
| request | один на HTTP-запрос |
| session | один на HTTP-сессию |

> **Важно.** Синглтон-бин обслуживает **все запросы всех пользователей одновременно**, из многих потоков. Поэтому бины должны быть **без изменяемого состояния** (stateless): хранить в поле сервиса «текущего пользователя» или счётчик нельзя — данные одного запроса перемешаются с данными другого.

> **Ловушка.** Prototype-бин, внедрённый в синглтон, создаётся **один раз** — в момент создания синглтона — и дальше ведёт себя как синглтон. Чтобы получать новый экземпляр при каждом обращении, внедряют `ObjectProvider<T>` и вызывают `getObject()`.

## Жизненный цикл бина

1. Spring читает определения бинов (сканирование, `@Configuration`).
2. **Создание экземпляра** — вызов конструктора (с внедрением через конструктор).
3. **Внедрение** в поля и сеттеры.
4. `BeanPostProcessor.postProcessBeforeInitialization`.
5. **Инициализация**: метод с `@PostConstruct`.
6. `BeanPostProcessor.postProcessAfterInitialization` — именно здесь бин может быть **заменён прокси** (для `@Transactional`, `@Async`, `@Cacheable`).
7. Бин готов к работе.
8. При остановке контейнера — метод с `@PreDestroy`.

```java
@Component
class CacheWarmer {
    private final ProductRepository repository;

    CacheWarmer(ProductRepository repository) { this.repository = repository; }

    @PostConstruct
    void warmUp() { ... }      // зависимости уже внедрены

    @PreDestroy
    void shutdown() { ... }
}
```

В конструкторе при внедрении в поля зависимости ещё `null` — ещё одна причина внедрять через конструктор. `@PreDestroy` для prototype-бинов не вызывается: контейнер их не отслеживает.

## Циклические зависимости

`A` требует `B`, а `B` требует `A`. При внедрении через конструктор Spring не может создать ни один из них и падает при старте с `BeanCurrentlyInCreationException`. С Spring Boot 2.6 циклы запрещены по умолчанию при любом способе внедрения.

Цикл — признак ошибки проектирования. Лечится выделением общей логики в третий класс или обменом через события. `@Lazy` на параметре — обходной путь, а не решение.

## Как это работает внутри

Контейнер использует **рефлексию**: читает аннотации классов, находит конструктор, определяет типы параметров, ищет подходящие бины и вызывает конструктор. В задаче этого урока вы напишете такой контейнер сами — это лучший способ понять, что Spring не делает ничего волшебного.

@@ quiz
@@ q
Какой scope у бина по умолчанию?
- [x] singleton
- [ ] prototype
- [ ] request
- [ ] session
@@ explain
Один экземпляр на весь контейнер. Его разделяют все потоки, поэтому изменяемое состояние в полях бина — источник гонок.

@@ q
Почему нельзя хранить данные текущего запроса в поле `@Service`-бина?
- [ ] Поля сервисов должны быть `static`
- [x] Бин один на всё приложение, и его одновременно используют потоки разных запросов
- [ ] Spring очищает поля после каждого запроса
- [ ] Это ошибка компиляции
@@ explain
Два одновременных запроса запишут в одно и то же поле разные значения, и один пользователь увидит данные другого. Данные запроса передают параметрами методов.

@@ q
Бин со scope prototype внедрён через конструктор в singleton-бин. Сколько экземпляров прототипа будет создано за время работы приложения?
- [x] Один — при создании синглтона
- [ ] По одному на каждый вызов метода синглтона
- [ ] По одному на каждый HTTP-запрос
- [ ] Ни одного
@@ explain
Внедрение происходит один раз — когда создаётся синглтон. Для получения свежих экземпляров используют `ObjectProvider<T>`.

@@ q
В какой момент вызывается метод, помеченный `@PostConstruct`?
- [ ] До вызова конструктора
- [x] После создания бина и внедрения всех зависимостей
- [ ] При каждом обращении к бину
- [ ] При остановке приложения
@@ explain
К этому моменту все зависимости уже на месте, поэтому `@PostConstruct` подходит для начальной инициализации. При остановке вызывается `@PreDestroy`.

@@ q
Бины `A` и `B` требуют друг друга через конструкторы. Что произойдёт?
- [ ] Spring создаст оба бина с `null`-зависимостями
- [x] Приложение не запустится
- [ ] Spring автоматически создаст прокси
- [ ] Один из бинов станет prototype
@@ explain
Ни один из бинов нельзя создать первым: каждому нужен готовый второй. Spring сообщает о цикле и останавливает запуск.

@@ task container | Свой IoC-контейнер | xp=60 interview
Напишите упрощённый IoC-контейнер — так устроен Spring внутри. Класс `Container`:

- `void register(Class<?> type)` — зарегистрировать класс как компонент;
- `<T> T get(Class<T> type)` — получить бин указанного типа.

Правила:

- у каждого компонента ровно один конструктор; его параметры — зависимости, которые контейнер рекурсивно получает через `get`;
- бины — **синглтоны**: повторный `get` возвращает тот же объект;
- `get` можно вызывать с **интерфейсом**: контейнер должен найти зарегистрированный класс, который его реализует;
- если подходящего зарегистрированного класса нет — `IllegalStateException`; если подходящих несколько — тоже `IllegalStateException`.

Подсказка по рефлексии: `type.getDeclaredConstructors()[0]` — конструктор, `c.getParameterTypes()` — типы параметров, `c.setAccessible(true)` и `c.newInstance(args)` — создание объекта, `iface.isAssignableFrom(cls)` — проверка, что класс реализует интерфейс.
@@ hint
Храните `Set<Class<?>> registered` и `Map<Class<?>, Object> singletons`. В `get` сначала найдите реализацию: переберите `registered` и отберите классы, для которых `type.isAssignableFrom(candidate)`.
@@ hint
Найдя единственную реализацию `impl`: если она уже есть в `singletons` — верните её. Иначе возьмите конструктор, для каждого типа параметра вызовите `get(paramType)`, создайте объект, положите в `singletons` и верните `type.cast(obj)`.
@@ starter
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

class Container {
    private final Set<Class<?>> registered = new LinkedHashSet<>();
    private final Map<Class<?>, Object> singletons = new HashMap<>();

    void register(Class<?> type) {
        registered.add(type);
    }

    <T> T get(Class<T> type) throws Exception {
        throw new IllegalStateException("не реализовано");
    }
}

interface Repo { String find(); }

class MemoryRepo implements Repo {
    public String find() { return "данные"; }
}

class Service {
    final Repo repo;
    Service(Repo repo) { this.repo = repo; }
}

public class Main {
    public static void main(String[] args) throws Exception {
        Container c = new Container();
        c.register(MemoryRepo.class);
        c.register(Service.class);
        System.out.println(c.get(Service.class).repo.find());
    }
}
@@ solution
import java.lang.reflect.Constructor;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

class Container {
    private final Set<Class<?>> registered = new LinkedHashSet<>();
    private final Map<Class<?>, Object> singletons = new HashMap<>();

    void register(Class<?> type) {
        registered.add(type);
    }

    <T> T get(Class<T> type) throws Exception {
        Class<?> impl = null;
        for (Class<?> candidate : registered) {
            if (type.isAssignableFrom(candidate)) {
                if (impl != null) throw new IllegalStateException("несколько бинов типа " + type.getSimpleName());
                impl = candidate;
            }
        }
        if (impl == null) throw new IllegalStateException("нет бина типа " + type.getSimpleName());

        Object bean = singletons.get(impl);
        if (bean == null) {
            Constructor<?> ctor = impl.getDeclaredConstructors()[0];
            ctor.setAccessible(true);
            Class<?>[] params = ctor.getParameterTypes();
            Object[] args = new Object[params.length];
            for (int i = 0; i < params.length; i++) args[i] = get(params[i]);
            bean = ctor.newInstance(args);
            singletons.put(impl, bean);
        }
        return type.cast(bean);
    }
}

interface Repo { String find(); }

class MemoryRepo implements Repo {
    public String find() { return "данные"; }
}

class Service {
    final Repo repo;
    Service(Repo repo) { this.repo = repo; }
}

public class Main {
    public static void main(String[] args) throws Exception {
        Container c = new Container();
        c.register(MemoryRepo.class);
        c.register(Service.class);
        System.out.println(c.get(Service.class).repo.find());
    }
}
@@ test
public class Checker {
    interface Clock { long now(); }
    static class FixedClock implements Clock { public long now() { return 42; } }
    static class OtherClock implements Clock { public long now() { return 1; } }
    static class Audit { final Clock clock; Audit(Clock clock) { this.clock = clock; } }
    static class Facade { final Audit audit; final Service service; Facade(Audit audit, Service service) { this.audit = audit; this.service = service; } }
    static class Lonely { }

    public static void main(String[] args) {
        T.test("бин без зависимостей", () -> { Container c = new Container(); c.register(Lonely.class); T.check(c.get(Lonely.class) != null, "бин не создан"); });
        T.test("зависимость по интерфейсу", () -> { Container c = new Container(); c.register(MemoryRepo.class); c.register(Service.class); T.eq("данные", c.get(Service.class).repo.find()); });
        T.test("получение по интерфейсу", () -> { Container c = new Container(); c.register(MemoryRepo.class); Repo r = c.get(Repo.class); T.check(r instanceof MemoryRepo, "ожидался MemoryRepo"); });
        T.test("бины — синглтоны", () -> {
            Container c = new Container(); c.register(MemoryRepo.class); c.register(Service.class);
            T.check(c.get(Service.class) == c.get(Service.class), "повторный get должен вернуть тот же объект");
            T.check(c.get(Service.class).repo == c.get(Repo.class), "зависимость и бин, полученный напрямую, должны быть одним объектом");
        });
        T.test("цепочка зависимостей", () -> {
            Container c = new Container();
            c.register(Facade.class); c.register(Audit.class); c.register(FixedClock.class); c.register(Service.class); c.register(MemoryRepo.class);
            Facade f = c.get(Facade.class);
            T.eq(42L, f.audit.clock.now()); T.eq("данные", f.service.repo.find());
        });
        T.test("нет бина", () -> { Container c = new Container(); c.register(Service.class); T.throwsEx(IllegalStateException.class, () -> c.get(Service.class)); });
        T.test("несколько кандидатов", () -> { Container c = new Container(); c.register(FixedClock.class); c.register(OtherClock.class); c.register(Audit.class); T.throwsEx(IllegalStateException.class, () -> c.get(Audit.class)); });
        T.done();
    }
}
