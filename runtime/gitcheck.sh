# Помощники для проверок Git-задач. Подключается перед скриптом проверки.
__fail=0
# ok "название" команда...   — проверка пройдена, если команда завершилась успешно
ok() {
  local name="$1"; shift
  echo "=== RUN   $name"
  if "$@" >/dev/null 2>&1; then echo "--- PASS: $name"; else echo "--- FAIL: $name"; __fail=1; fi
}
# eq "название" "получено" "ожидалось"
eq() {
  echo "=== RUN   $1"
  if [ "$2" = "$3" ]; then echo "--- PASS: $1"; else
    echo "    ожидалось: $3"; echo "    получено:  $2"; echo "--- FAIL: $1"; __fail=1; fi
}
# no "название" команда...   — проверка пройдена, если команда завершилась с ошибкой
no() {
  local name="$1"; shift
  echo "=== RUN   $name"
  if "$@" >/dev/null 2>&1; then echo "--- FAIL: $name"; __fail=1; else echo "--- PASS: $name"; fi
}
__finish() { if [ "$__fail" = 0 ]; then echo PASS; else echo FAIL; fi; exit "$__fail"; }
