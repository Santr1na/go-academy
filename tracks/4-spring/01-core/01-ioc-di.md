---
id: spring-ioc
title: IoC и внедрение зависимостей
summary: Главная идея Spring: объекты не создают свои зависимости, а получают их.
xp: 30
---
## Проблема, которую решает Spring

```java
class OrderService {
    private final OrderRepository repository = new JdbcOrderRepository();   // жёсткая связь
    private final Mailer mailer = new SmtpMailer("smtp.company.ru");

    void placeOrder(Order order) {
        repository.save(order);
        mailer.send(order.email(), "Заказ принят");
    }
}
```

Что здесь плохо:

- **нельзя протестировать** без настоящей базы и почтового сервера;
- чтобы сменить базу или способ отправки, нужно править сам сервис;
- сервис знает, как создавать свои зависимости, — это не его работа.

## Внедрение зависимостей

**Dependency Injection (DI)** — объект не создаёт зависимости сам, а получает их снаружи. Лучше всего — через конструктор:

```java
class OrderService {
    private final OrderRepository repository;      // интерфейсы, а не конкретные классы
    private final Mailer mailer;

    OrderService(OrderRepository repository, Mailer mailer) {
        this.repository = repository;
        this.mailer = mailer;
    }
}
```

Теперь в тесте можно передать заглушки, а в бою — настоящие реализации. Сам сервис при этом не меняется.

**Inversion of Control (IoC)** — более общий принцип: не ваш код управляет созданием и связыванием объектов, а внешний механизм. В Spring это **IoC-контейнер** (`ApplicationContext`): он создаёт объекты, находит для них зависимости и передаёт их. DI — способ реализации IoC.

## Как это выглядит в Spring

```java
@Repository
class JdbcOrderRepository implements OrderRepository { ... }

@Component
class SmtpMailer implements Mailer { ... }

@Service
class OrderService {
    private final OrderRepository repository;
    private final Mailer mailer;

    OrderService(OrderRepository repository, Mailer mailer) {   // Spring сам передаст аргументы
        this.repository = repository;
        this.mailer = mailer;
    }
}
```

Аннотации `@Component`, `@Service`, `@Repository`, `@Controller` говорят контейнеру: «создай объект этого класса и управляй им». Такой объект называется **бином**. При старте Spring сканирует пакеты, находит помеченные классы, создаёт бины и связывает их между собой. Вы нигде не пишете `new OrderService(...)`.

## Три способа внедрения

| Способ | Как выглядит | Оценка |
|---|---|---|
| Через конструктор | параметры конструктора | **рекомендуется** |
| Через сеттер | `@Autowired void setMailer(Mailer m)` | для необязательных зависимостей |
| В поле | `@Autowired private Mailer mailer;` | не рекомендуется |

Почему конструктор лучше:

- поля можно сделать `final` — объект неизменяем и всегда полностью собран;
- зависимости видны в сигнатуре: десять параметров сразу показывают, что класс делает слишком много;
- в тесте объект создаётся обычным `new` — без Spring и рефлексии;
- циклическая зависимость обнаруживается при старте, а не в неожиданный момент.

Если конструктор в классе один, аннотация `@Autowired` над ним не нужна. С Lombok конструктор генерирует `@RequiredArgsConstructor`.

## Когда кандидатов несколько

Если интерфейс реализуют два бина, Spring не знает, какой внедрить, и падает при старте с `NoUniqueBeanDefinitionException`. Решения:

- `@Primary` на реализации по умолчанию;
- `@Qualifier("smtpMailer")` в точке внедрения;
- внедрить все сразу: `List<Mailer>` или `Map<String, Mailer>`.

Если бина нужного типа нет вообще — `NoSuchBeanDefinitionException`.

> **На собеседовании.** «Что такое IoC и DI?» — IoC: управление созданием объектов передано контейнеру; DI: зависимости передаются объекту извне. «Какие способы внедрения вы знаете и какой предпочитаете?» — конструктор, с объяснением причин.

@@ quiz
@@ q
Что такое внедрение зависимостей?
- [ ] Создание зависимостей внутри класса через `new`
- [x] Передача объекту его зависимостей извне, а не создание их внутри
- [ ] Наследование от общего базового класса
- [ ] Подключение библиотек в файле сборки
@@ explain
Объект объявляет, что ему нужно (обычно параметрами конструктора), а предоставляет это кто-то снаружи — контейнер Spring или тест.

@@ q
Почему внедрение через конструктор считается лучшим способом?
- [ ] Оно работает быстрее
- [ ] Только оно поддерживается Spring Boot
- [x] Поля можно сделать `final`, объект всегда создаётся полностью собранным и легко тестируется без Spring
- [ ] Оно не требует интерфейсов
@@ explain
При внедрении в поле объект можно создать в «полусобранном» состоянии, а в тесте приходится прибегать к рефлексии. Конструктор делает зависимости обязательными и явными.

@@ q
Интерфейс `Mailer` реализуют два бина, а в конструктор сервиса внедряется просто `Mailer`. Что произойдёт при старте приложения?
- [ ] Spring выберет первый по алфавиту
- [ ] Будет внедрён `null`
- [x] Приложение не запустится: `NoUniqueBeanDefinitionException`
- [ ] Spring создаст третий бин
@@ explain
Контейнер не угадывает. Неоднозначность нужно снять: `@Primary`, `@Qualifier` или внедрение коллекции `List<Mailer>`.

@@ q
Что такое бин в Spring?
- [ ] Любой объект Java
- [x] Объект, который создаёт и которым управляет IoC-контейнер
- [ ] Класс с геттерами и сеттерами
- [ ] Файл конфигурации
@@ explain
Объект, созданный вами через `new`, бином не является: контейнер о нём не знает, не внедрит в него зависимости и не применит к нему `@Transactional`.

@@ task refactor | Развязать сервис и зависимости | xp=40 interview
Класс `NotificationService` сам создаёт `SmsGateway` — его нельзя протестировать, не отправляя настоящие SMS. Отрефакторьте:

1. объявите интерфейс `Gateway` с методом `boolean send(String phone, String text)`;
2. `SmsGateway` должен его реализовывать;
3. `NotificationService` получает `Gateway` **через конструктор** и хранит в `final`-поле;
4. метод `int notifyAll(List<String> phones, String text)` отправляет сообщение на каждый номер и возвращает число успешных отправок. Пустые номера (`isBlank()`) пропускаются без обращения к шлюзу.
@@ hint
`interface Gateway { boolean send(String phone, String text); }`, а `SmsGateway implements Gateway` с методом `public boolean send(...)`.
@@ hint
В сервисе: `private final Gateway gateway; NotificationService(Gateway gateway) { this.gateway = gateway; }` — и никакого `new SmsGateway()` внутри.
@@ starter
import java.util.List;

class SmsGateway {
    boolean send(String phone, String text) {
        System.out.println("SMS на " + phone + ": " + text);
        return true;
    }
}

class NotificationService {
    private final SmsGateway gateway = new SmsGateway();

    int notifyAll(List<String> phones, String text) {
        int sent = 0;
        for (String p : phones) {
            if (gateway.send(p, text)) sent++;
        }
        return sent;
    }
}

public class Main {
    public static void main(String[] args) {
        System.out.println(new NotificationService().notifyAll(List.of("+7900", "+7901"), "Привет"));
    }
}
@@ solution
import java.util.List;

interface Gateway {
    boolean send(String phone, String text);
}

class SmsGateway implements Gateway {
    @Override
    public boolean send(String phone, String text) {
        System.out.println("SMS на " + phone + ": " + text);
        return true;
    }
}

class NotificationService {
    private final Gateway gateway;

    NotificationService(Gateway gateway) {
        this.gateway = gateway;
    }

    int notifyAll(List<String> phones, String text) {
        int sent = 0;
        for (String p : phones) {
            if (p.isBlank()) continue;
            if (gateway.send(p, text)) sent++;
        }
        return sent;
    }
}

public class Main {
    public static void main(String[] args) {
        NotificationService service = new NotificationService(new SmsGateway());
        System.out.println(service.notifyAll(List.of("+7900", "+7901"), "Привет"));
    }
}
@@ test
import java.util.ArrayList;
import java.util.List;

public class Checker {
    public static void main(String[] args) {
        T.test("Gateway — интерфейс, SmsGateway его реализует", () -> { T.check(Gateway.class.isInterface(), "Gateway должен быть интерфейсом"); T.check(Gateway.class.isAssignableFrom(SmsGateway.class), "SmsGateway должен реализовывать Gateway"); });
        T.test("сервис работает с подставным шлюзом", () -> {
            List<String> calls = new ArrayList<>();
            NotificationService s = new NotificationService((phone, text) -> { calls.add(phone + ":" + text); return true; });
            T.eq(2, s.notifyAll(List.of("1", "2"), "hi"));
            T.eq(List.of("1:hi", "2:hi"), calls);
        });
        T.test("считаются только успешные отправки", () -> {
            NotificationService s = new NotificationService((phone, text) -> !phone.equals("bad"));
            T.eq(2, s.notifyAll(List.of("a", "bad", "b"), "x"));
        });
        T.test("пустые номера пропускаются", () -> {
            List<String> calls = new ArrayList<>();
            NotificationService s = new NotificationService((phone, text) -> calls.add(phone));
            T.eq(1, s.notifyAll(List.of("", "  ", "7"), "x"));
            T.eq(List.of("7"), calls);
        });
        T.test("зависимость хранится в final-поле типа Gateway", () -> {
            boolean ok = false;
            for (java.lang.reflect.Field f : NotificationService.class.getDeclaredFields())
                if (f.getType() == Gateway.class && java.lang.reflect.Modifier.isFinal(f.getModifiers())) ok = true;
            T.check(ok, "нужно поле private final Gateway");
        });
        T.done();
    }
}
