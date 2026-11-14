#!/usr/bin/env bash
# Запуск Go Academy из любой папки:  bash "/путь/к/go-academy/start.sh" [флаги сервера]
set -e
cd "$(dirname "$(readlink -f "$0")")"

GO="${GO_BIN:-}"
if [ -z "$GO" ]; then
  for c in "$(command -v go 2>/dev/null)" "$HOME/.local/go/bin/go" "$HOME/go/bin/go" /usr/local/go/bin/go /usr/lib/go/bin/go; do
    if [ -n "$c" ] && [ -x "$c" ]; then GO="$c"; break; fi
  done
fi
if [ -z "$GO" ]; then
  echo "Go не найден. Установите его с https://go.dev/dl/ или задайте путь: GO_BIN=/путь/к/go bash start.sh" >&2
  exit 1
fi

echo "Запускаю Go Academy… Откройте в браузере http://127.0.0.1:8080 (остановка — Ctrl+C)"
exec "$GO" run . "$@"
