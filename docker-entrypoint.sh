#!/bin/sh
# Запуск сайта в Docker. Сначала закрываем коду учеников (пользователь
# песочницы ACADEMY_SANDBOX_UID) доступ в сеть: иначе с сервера можно было бы
# рассылать спам или атаковать другие сайты. Для этого контейнеру нужна
# возможность NET_ADMIN (docker run --cap-add NET_ADMIN).
uid="${ACADEMY_SANDBOX_UID:-}"
if [ -n "$uid" ]; then
	for t in iptables ip6tables; do
		$t -C OUTPUT -m owner --uid-owner "$uid" -j REJECT 2>/dev/null ||
			$t -A OUTPUT -m owner --uid-owner "$uid" -j REJECT 2>/dev/null
	done
	if setpriv --reuid "$uid" --regid "$uid" --clear-groups \
		python3 -c "import socket; socket.create_connection(('1.1.1.1', 443), 3)" 2>/dev/null; then
		case "$(echo "${ACADEMY_PUBLIC:-}" | tr 'A-Z' 'a-z')" in
		1 | true | yes | on)
			echo "Открытый режим требует закрыть коду учеников доступ в сеть, а это не удалось." >&2
			echo "Запустите контейнер с --cap-add NET_ADMIN или задайте пароль ACADEMY_PASSWORD вместо ACADEMY_PUBLIC." >&2
			exit 1
			;;
		esac
		echo "ВНИМАНИЕ: код учеников имеет доступ в сеть (нет NET_ADMIN); сайт защищён паролем" >&2
	else
		echo "Код учеников не имеет доступа в сеть"
	fi
fi
exec "$@"
