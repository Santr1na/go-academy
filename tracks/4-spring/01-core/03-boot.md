---
id: spring-boot-basics
title: Spring Boot: автоконфигурация, стартеры и настройки
summary: Чем Boot отличается от Spring, откуда берутся бины и как устроена конфигурация.
xp: 30
---
## Spring и Spring Boot

**Spring Framework** — набор библиотек: контейнер, веб, работа с данными, безопасность. Раньше приложение приходилось собирать вручную: десятки зависимостей с совместимыми версиями, XML-конфигурация, отдельный сервер приложений.

**Spring Boot** — надстройка, которая избавляет от этой рутины:

- **стартеры** — готовые наборы зависимостей с согласованными версиями;
- **автоконфигурация** — бины создаются автоматически на основе того, что есть в classpath;
- **встроенный сервер** (Tomcat) — приложение запускается как обычный jar: `java -jar app.jar`;
- готовые средства эксплуатации: Actuator, метрики, проверки состояния.

```java
@SpringBootApplication
public class ShopApplication {
    public static void main(String[] args) {
        SpringApplication.run(ShopApplication.class, args);
    }
}
```

## @SpringBootApplication

Это три аннотации в одной:

| Аннотация | Что делает |
|---|---|
| `@SpringBootConfiguration` | класс — источник определений бинов (то же, что `@Configuration`) |
| `@EnableAutoConfiguration` | включает автоконфигурацию |
| `@ComponentScan` | сканирует компоненты в пакете этого класса **и вложенных пакетах** |

> **Ловушка.** Сканирование идёт от пакета главного класса вниз. Если положить `ShopApplication` в `com.shop.app`, а сервисы — в `com.shop.service`, Spring их не найдёт. Главный класс должен лежать в **корневом** пакете проекта.

## Стартеры

| Стартер | Что приносит |
|---|---|
| `spring-boot-starter-web` | Spring MVC, Jackson (JSON), встроенный Tomcat |
| `spring-boot-starter-data-jpa` | Spring Data JPA, Hibernate, пул соединений HikariCP |
| `spring-boot-starter-security` | Spring Security |
| `spring-boot-starter-validation` | Bean Validation (Hibernate Validator) |
| `spring-boot-starter-test` | JUnit 5, Mockito, AssertJ, MockMvc |
| `spring-boot-starter-actuator` | эндпоинты `/actuator/health`, метрики |

Версии зависимостей не указываются — ими управляет родительский `spring-boot-starter-parent`.

## Как работает автоконфигурация

Boot содержит сотни классов конфигурации, каждый из которых включается **при условии**:

```java
@AutoConfiguration
@ConditionalOnClass(DataSource.class)              // если в classpath есть нужный класс
class DataSourceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean                      // если вы НЕ объявили свой такой бин
    DataSource dataSource(DataSourceProperties props) { ... }
}
```

Отсюда правила:

- добавили стартер — появились бины;
- объявили свой бин того же типа — автоконфигурация **отступает** (`@ConditionalOnMissingBean`);
- поведение настраивается свойствами.

Список автоконфигураций Boot читает из файла `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` внутри библиотек. Узнать, что и почему включилось, помогает запуск с `--debug`.

## Настройки

Свойства задаются в `application.properties` или `application.yml`:

```yaml
server:
  port: 8081
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/shop
    username: shop
    password: ${DB_PASSWORD}          # значение из переменной окружения
app:
  payment:
    url: https://pay.example.com
    timeout: 5s
```

Прочитать свойство:

```java
@Value("${app.payment.url}") String url;                 // одно значение

@ConfigurationProperties(prefix = "app.payment")         // группа свойств — типобезопасно
record PaymentProperties(String url, Duration timeout) { }
```

**Приоритет источников** (от высшего к низшему): аргументы командной строки → переменные окружения → `application-{профиль}.yml` → `application.yml`. Переменная окружения `SERVER_PORT` переопределяет `server.port`.

> **Важно.** Пароли и ключи не хранят в `application.yml` в репозитории — их передают переменными окружения или через хранилище секретов.

## Профили

Профили позволяют иметь разные настройки и бины для разных окружений:

```yaml
# application-dev.yml — подключается при активном профиле dev
spring.datasource.url: jdbc:h2:mem:devdb
```

```java
@Bean
@Profile("dev")
Mailer fakeMailer() { return new LoggingMailer(); }
```

Активировать: `--spring.profiles.active=dev` или переменная окружения `SPRING_PROFILES_ACTIVE=dev`.

## Как попробовать на своём компьютере

Задачи этого курса выполняются на чистой Java — так лучше видно механизмы. Настоящий проект создаётся за минуту:

1. откройте [start.spring.io](https://start.spring.io), выберите Maven, Java 21, зависимости Spring Web, Spring Data JPA, Validation, H2 Database;
2. скачайте и распакуйте архив, откройте в IntelliJ IDEA;
3. запустите `./mvnw spring-boot:run` и откройте `http://localhost:8080`.

Переносите туда примеры из уроков — без этой практики знание Spring останется теоретическим.

@@ quiz
@@ q
Из каких трёх аннотаций состоит `@SpringBootApplication`?
- [ ] `@Service`, `@Repository`, `@Controller`
- [x] `@SpringBootConfiguration`, `@EnableAutoConfiguration`, `@ComponentScan`
- [ ] `@Bean`, `@Autowired`, `@Value`
- [ ] `@Configuration`, `@Transactional`, `@RestController`
@@ explain
Конфигурация, автоконфигурация и сканирование компонентов начиная с пакета главного класса.

@@ q
Главный класс лежит в пакете `com.shop.app`, а сервис с `@Service` — в `com.shop.service`. Что произойдёт?
- [ ] Сервис будет найден: Spring сканирует весь проект
- [x] Сервис не будет найден: сканируется только пакет главного класса и вложенные в него
- [ ] Ошибка компиляции
- [ ] Сервис станет prototype
@@ explain
`com.shop.service` не является вложенным в `com.shop.app`. Главный класс помещают в корневой пакет `com.shop`.

@@ q
Вы объявили собственный бин `DataSource`. Что сделает автоконфигурация источника данных?
- [ ] Создаст второй `DataSource`, и приложение упадёт
- [x] Не станет создавать свой бин — сработает `@ConditionalOnMissingBean`
- [ ] Заменит ваш бин своим
- [ ] Отключит всё приложение
@@ explain
Автоконфигурация задаёт разумные значения по умолчанию и уступает место явной конфигурации разработчика.

@@ q
В `application.yml` указано `server.port: 8080`, а приложение запущено с переменной окружения `SERVER_PORT=9090`. Какой порт будет использован?
- [ ] 8080
- [x] 9090
- [ ] Приложение не запустится из-за конфликта
- [ ] Случайный
@@ explain
Переменные окружения имеют более высокий приоритет, чем файлы настроек. Это позволяет менять конфигурацию при развёртывании, не пересобирая приложение.

@@ q
Что такое стартер в Spring Boot?
- [ ] Скрипт запуска приложения
- [x] Зависимость, которая подтягивает согласованный набор библиотек для определённой задачи
- [ ] Класс с методом `main`
- [ ] Профиль по умолчанию
@@ explain
Например, `spring-boot-starter-web` одной строкой добавляет Spring MVC, Jackson и встроенный Tomcat в совместимых версиях.
