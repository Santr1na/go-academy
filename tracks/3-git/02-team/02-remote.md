---
id: git-remote
title: Удалённый репозиторий
summary: clone, fetch, pull, push, отслеживающие ветки и отклонённый push.
xp: 35
---
## Локальный и удалённый репозиторий

Git — распределённая система: у каждого разработчика **полная копия** репозитория со всей историей. Удалённый репозиторий (на GitHub, GitLab) — такая же копия, через которую команда обменивается коммитами. Почти все команды — `commit`, `branch`, `merge`, `log` — работают локально и без сети.

```bash
git clone <адрес>              # скачать репозиторий и настроить связь с ним
git remote -v                  # список удалённых репозиториев
git remote add origin <адрес>  # привязать удалённый репозиторий к существующему локальному
```

`origin` — общепринятое имя «основного» удалённого репозитория; его автоматически задаёт `git clone`.

## Три вида веток

| Ветка | Пример | Что это |
|---|---|---|
| локальная | `main` | ваша рабочая ветка |
| отслеживающая (remote-tracking) | `origin/main` | **локальная копия** того, где ветка была на сервере при последнем обмене |
| на сервере | `main` в `origin` | настоящая ветка в удалённом репозитории |

`origin/main` двигается только при `fetch`, `pull` и `push` — сам Git на сервер не ходит. Поэтому «`Your branch is up to date with 'origin/main'`» означает лишь «совпадает с тем, что было при последней синхронизации».

## fetch, pull, push

```bash
git fetch                # скачать новые коммиты и обновить origin/*; ваши ветки НЕ меняются
git pull                 # fetch + слияние origin/main в текущую ветку
git pull --rebase        # fetch + rebase ваших коммитов поверх origin/main
git push                 # отправить коммиты текущей ветки на сервер
git push -u origin feature   # первый push новой ветки: создать её на сервере и запомнить связь
```

`git fetch` безопасен всегда: он ничего не меняет в вашей работе. После него можно посмотреть, что пришло: `git log main..origin/main`.

`git pull` = `git fetch` + `git merge` (или `rebase`). Если и у вас, и на сервере появились новые коммиты, обычный `pull` создаст merge-коммит; `pull --rebase` перенесёт ваши коммиты поверх чужих и сохранит историю линейной.

## Отклонённый push

```text
! [rejected]        main -> main (fetch first)
```

Сервер принимает push, только если ваша ветка **продолжает** его историю. Если коллега успел отправить свои коммиты, сначала их нужно получить:

```bash
git pull --rebase        # или git pull
git push
```

> **Ловушка.** `git push --force` «решает» проблему, перезаписывая ветку на сервере вашей историей, — и молча **уничтожает коммиты коллег**. В общих ветках так делать нельзя. В своей ветке после rebase используйте `git push --force-with-lease`: он откажется перезаписывать, если на сервере появилось что-то, чего вы ещё не видели.

## Pull request

В командах напрямую в `main` обычно не пушат. Процесс такой:

1. создать ветку от свежего `main`;
2. сделать коммиты и отправить ветку: `git push -u origin feature`;
3. открыть **pull request** (в GitLab — merge request) — запрос на слияние ветки в `main`;
4. коллеги смотрят код (code review), автоматика гоняет тесты (CI);
5. после одобрения ветку вливают и удаляют.

## Как устроены задачи этого урока

Роль сервера играет «голый» репозиторий `../remote.git`, лежащий рядом с вашей папкой. Работа с ним ничем не отличается от работы с GitHub — только адресом служит путь на диске.

@@ quiz
@@ q
Что делает `git fetch`?
- [ ] Скачивает коммиты и вливает их в текущую ветку
- [x] Скачивает коммиты и обновляет `origin/*`, не меняя ваши локальные ветки и файлы
- [ ] Отправляет коммиты на сервер
- [ ] Удаляет локальные изменения
@@ explain
`fetch` только обновляет сведения об удалённом репозитории. Слияние выполняет отдельная команда — `merge`, `rebase` или `pull`, который объединяет оба шага.

@@ q
`git push` отклонён с сообщением `rejected … fetch first`. Что нужно сделать?
- [ ] `git push --force`
- [x] Получить чужие коммиты (`git pull` или `git pull --rebase`), затем повторить push
- [ ] Удалить локальную ветку
- [ ] `git reset --hard`
@@ explain
На сервере есть коммиты, которых нет у вас. Их нужно забрать и объединить со своими. `--force` затёр бы чужую работу.

@@ q
Что такое `origin/main`?
- [ ] Ветка `main` на сервере, которая всегда актуальна
- [x] Локальная отметка о том, где `main` была на сервере при последнем `fetch`, `pull` или `push`
- [ ] Резервная копия вашей ветки `main`
- [ ] Псевдоним команды `git push`
@@ explain
Отслеживающая ветка обновляется только при обмене с сервером. Между обменами она может устареть — Git сам в сеть не ходит.

@@ q
Чем `git push --force-with-lease` безопаснее `git push --force`?
- [ ] Он не переписывает историю
- [x] Он откажется перезаписывать ветку, если на сервере появились коммиты, которых вы не видели
- [ ] Он создаёт резервную копию ветки
- [ ] Он работает только с тегами
@@ explain
`--force` перезаписывает ветку безусловно. `--force-with-lease` сверяет состояние сервера с вашей отслеживающей веткой и не даёт случайно затереть чужой push.

@@ task push | Первый push | xp=30
Ваш репозиторий — клон `../remote.git`. Создайте файл `notes.txt` с любым текстом, закоммитьте его с сообщением `Add notes` и отправьте ветку `main` на сервер.
@@ hint
Обычная последовательность: `git add`, `git commit -m`, `git push`.
@@ hint
Связь `main` с `origin/main` уже настроена клонированием, поэтому достаточно `git push` (или явно `git push origin main`).
@@ starter
git remote -v
@@ solution
echo "заметки" > notes.txt
git add notes.txt
git commit -m "Add notes"
git push origin main
@@ test
git init -q --bare ../remote.git
git clone -q ../remote.git ../seed 2>/dev/null
(cd ../seed && echo base > README.md && git add . && git commit -qm "Initial commit" && git push -q origin main)
git clone -q ../remote.git .
#--- check
eq "на сервере два коммита" "$(git --git-dir=../remote.git rev-list --count main)" "2"
eq "последний коммит на сервере" "$(git --git-dir=../remote.git log -1 --format=%s main)" "Add notes"
ok "notes.txt есть на сервере" git --git-dir=../remote.git cat-file -e main:notes.txt
eq "локальная и удалённая ветки совпадают" "$(git rev-parse main)" "$(git --git-dir=../remote.git rev-parse main)"

@@ task rejected | Отклонённый push | xp=50 interview
Вы сделали локальный коммит `Add feature`, но за это время коллега отправил на сервер свой коммит `Update docs` — ваш `git push` будет отклонён.

Доставьте свой коммит на сервер, **не потеряв** коммит коллеги и **не создавая** коммит слияния. История на сервере должна стать такой: `Initial commit` → `Update docs` → `Add feature`.
@@ hint
`git push --force` уничтожит коммит коллеги. Сначала нужно получить его изменения.
@@ hint
`git pull --rebase origin main` перенесёт ваш коммит поверх коммита коллеги, после чего `git push origin main` пройдёт.
@@ starter
git push origin main
@@ solution
git pull --rebase origin main
git push origin main
@@ test
git init -q --bare ../remote.git
git clone -q ../remote.git ../seed 2>/dev/null
(cd ../seed && echo base > README.md && git add . && git commit -qm "Initial commit" && git push -q origin main)
git clone -q ../remote.git .
echo f > feature.txt && git add . && git commit -qm "Add feature"
(cd ../seed && echo docs > docs.txt && git add . && git commit -qm "Update docs" && git push -q origin main)
#--- check
eq "история на сервере" "$(git --git-dir=../remote.git log main --format=%s | tr '\n' '|')" "Add feature|Update docs|Initial commit|"
eq "коммитов слияния нет" "$(git --git-dir=../remote.git rev-list --merges --count main)" "0"
ok "файл коллеги на месте" git --git-dir=../remote.git cat-file -e main:docs.txt
ok "ваш файл на сервере" git --git-dir=../remote.git cat-file -e main:feature.txt
eq "локальная ветка совпадает с сервером" "$(git rev-parse main)" "$(git --git-dir=../remote.git rev-parse main)"

@@ task feature-push | Ветка для pull request | xp=35
Подготовьте ветку для pull request: создайте от `main` ветку `fix/login`, добавьте в неё файл `login.txt` с любым текстом, закоммитьте с сообщением `Fix login` и отправьте ветку на сервер, настроив отслеживание. Ветку `main` на сервере менять нельзя.
@@ hint
`git switch -c fix/login` — в именах веток допустима косая черта.
@@ hint
Первый push новой ветки: `git push -u origin fix/login`.
@@ starter
git branch -a
@@ solution
git switch -c fix/login
echo "исправление" > login.txt
git add login.txt
git commit -m "Fix login"
git push -u origin fix/login
@@ test
git init -q --bare ../remote.git
git clone -q ../remote.git ../seed 2>/dev/null
(cd ../seed && echo base > README.md && git add . && git commit -qm "Initial commit" && git push -q origin main)
git clone -q ../remote.git .
#--- check
ok "ветка fix/login есть на сервере" git --git-dir=../remote.git rev-parse --verify fix/login
eq "коммит в ветке" "$(git --git-dir=../remote.git log -1 --format=%s fix/login)" "Fix login"
eq "main на сервере не изменилась" "$(git --git-dir=../remote.git rev-list --count main)" "1"
eq "отслеживание настроено" "$(git rev-parse --abbrev-ref fix/login@{upstream} 2>/dev/null)" "origin/fix/login"
