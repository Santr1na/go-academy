# Образ сайта Academy: сервер + всё, чем он проверяет задачи
# (Go, JDK 21, Python с SQLite для SQL-задач, git и bash для Git-задач).
FROM golang:1.27-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates iptables \
 && rm -rf /var/lib/apt/lists/*

# JDK 21 из официального образа Eclipse Temurin.
COPY --from=eclipse-temurin:21-jdk /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH

# Код учеников выполняется от имени отдельного пользователя без прав:
# он не может читать данные сервера и его переменные окружения.
RUN useradd --uid 10001 --create-home --home-dir /home/runner --shell /bin/bash runner
ENV HOME=/home/runner \
    GOCACHE=/home/runner/.cache/go-build \
    GOPATH=/home/runner/go \
    GOTOOLCHAIN=local \
    GOFLAGS=-buildvcs=false

# Прогреваем кеш сборки Go от имени этого пользователя: первая проверка
# задачи на сервере будет быстрой, а не 20–30 секунд.
USER runner
RUN mkdir -p /tmp/warm && cd /tmp/warm \
 && printf 'module warm\n\ngo 1.27\n' > go.mod \
 && printf 'package main\n\nimport (\n\t"fmt"\n\t"sort"\n\t"strings"\n\t"sync"\n\t"errors"\n\t"context"\n\t"time"\n)\n\nfunc main() { fmt.Println(sort.IntsAreSorted(nil), strings.ToUpper("a"), errors.New("x"), context.Background(), time.Second); var m sync.Mutex; m.Lock() }\n' > main.go \
 && printf 'package main\n\nimport "testing"\n\nfunc TestX(t *testing.T) {}\n' > main_test.go \
 && CGO_ENABLED=0 go build -o /dev/null . && CGO_ENABLED=0 go test -c -o /dev/null . \
 && cd / && rm -rf /tmp/warm
USER root

WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o /usr/local/bin/academy . && rm -rf /src

# Прогресс: на бесплатном тарифе Render диск временный и очищается при
# каждом перезапуске — тогда прогресс восстанавливается из браузера.
# Подключите постоянный диск в /data, чтобы он хранился и на сервере.
RUN mkdir -p /data
ENV ACADEMY_DATA=/data \
    ACADEMY_SANDBOX_UID=10001
WORKDIR /data

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["academy"]
