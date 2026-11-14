---
id: git-undo
title: История и отмена изменений
summary: log и diff, restore, reset трёх видов, revert и amend.
xp: 30
---
## Смотрим историю

```bash
git log --oneline                  # коротко: хеш и сообщение
git log --oneline --graph --all    # с ветками
git log -p file.txt                # история изменений файла с содержимым
git show HEAD                      # что изменил последний коммит
git blame file.txt                 # кто и когда менял каждую строку
```

`HEAD` — указатель на текущий коммит. `HEAD~1` — его родитель, `HEAD~2` — «дедушка».

## diff — что изменилось

```bash
git diff               # рабочая папка против индекса (что ещё НЕ добавлено)
git diff --staged      # индекс против последнего коммита (что попадёт в коммит)
git diff HEAD          # рабочая папка против последнего коммита (всё вместе)
git diff main feature  # разница между ветками
```

> **Ловушка.** После `git add` команда `git diff` ничего не покажет — изменения уже в индексе. Смотрите `git diff --staged`.

## Отмена: что и где

Какую команду выбрать, зависит от того, **где** находится изменение.

| Ситуация | Команда |
|---|---|
| Испортил файл, ещё не делал `add` | `git restore file.txt` |
| Сделал `add`, хочу убрать из индекса (правки оставить) | `git restore --staged file.txt` |
| Опечатка в последнем коммите или забыл файл | `git commit --amend` |
| Нужно отменить коммит, который уже отправлен в общий репозиторий | `git revert <хеш>` |
| Нужно убрать последние коммиты, которые есть только у меня | `git reset` |

> **Важно.** `git restore file.txt` безвозвратно стирает несохранённые правки в файле: их не было ни в индексе, ни в истории, и вернуть их нечем.

## Три вида reset

`git reset <коммит>` передвигает текущую ветку на указанный коммит. Режим определяет, что станет с изменениями «отменённых» коммитов:

| Режим | Ветка | Индекс | Рабочая папка | Итог |
|---|---|---|---|---|
| `--soft` | передвинута | не тронут | не тронута | изменения остались в индексе, готовы к новому коммиту |
| `--mixed` (по умолчанию) | передвинута | сброшен | не тронута | изменения остались в файлах, но не в индексе |
| `--hard` | передвинута | сброшен | сброшена | изменения **удалены** |

```bash
git reset --soft HEAD~1    # «разобрать» последний коммит, оставив всё в индексе
git reset --hard HEAD~1    # выбросить последний коммит вместе с изменениями
```

Типичное применение `--soft`: склеить несколько мелких коммитов в один.

## revert — отмена новым коммитом

```bash
git revert <хеш>
```

`revert` не удаляет коммит, а создаёт **новый**, который делает обратные изменения. История остаётся целой, поэтому это единственный безопасный способ отменить коммит, который уже скачали коллеги.

## Главное правило

**Не переписывайте историю, которая уже отправлена в общий репозиторий.** `reset`, `commit --amend` и `rebase` создают новые коммиты взамен старых. Если старые уже есть у коллег, истории разойдутся, и следующий `git pull` превратится в хаос. Для опубликованных коммитов — только `revert`.

## amend

```bash
git add forgotten.txt
git commit --amend -m "Правильное сообщение"
```

`--amend` заменяет последний коммит новым: с добавленными файлами и/или исправленным сообщением. Хеш коммита при этом меняется — это тоже переписывание истории.

## reflog — страховка

Git записывает каждое перемещение `HEAD` в журнал `git reflog`. Даже после `reset --hard` «потерянный» коммит можно найти там по хешу и вернуть: `git reset --hard <хеш>`. Записи живут около трёх месяцев. Незакоммиченные изменения reflog не спасает.

@@ quiz
@@ q
Вы сделали три локальных коммита и выполнили `git reset --soft HEAD~3`. Что стало с изменениями из этих коммитов?
- [ ] Они удалены
- [x] Они лежат в индексе, готовые к коммиту
- [ ] Они в рабочей папке, но не в индексе
- [ ] Они перенесены в отдельную ветку
@@ explain
`--soft` двигает только указатель ветки. Индекс и рабочая папка не меняются, поэтому все изменения оказываются «добавленными» — одним `git commit` их можно превратить в один коммит.

@@ q
Коммит с ошибкой уже отправлен в общий репозиторий, и коллеги его скачали. Как правильно его отменить?
- [ ] `git reset --hard HEAD~1` и `git push --force`
- [x] `git revert <хеш>`
- [ ] `git commit --amend`
- [ ] Удалить папку `.git`
@@ explain
`revert` создаёт новый коммит с обратными изменениями и не трогает существующую историю. `reset` и `amend` переписывают историю и ломают работу тем, кто уже получил старые коммиты.

@@ q
Вы изменили файл и выполнили `git add file.txt`. Что покажет `git diff`?
- [ ] Изменения файла
- [x] Ничего
- [ ] Ошибку
- [ ] Всю историю файла
@@ explain
`git diff` без параметров сравнивает рабочую папку с индексом, а они сейчас одинаковы. Изменения, готовые к коммиту, показывает `git diff --staged`.

@@ q
Что делает `git restore --staged file.txt`?
- [ ] Удаляет файл
- [ ] Отменяет все правки в файле
- [x] Убирает файл из индекса, оставляя правки в рабочей папке
- [ ] Отменяет последний коммит
@@ explain
Команда отменяет `git add`: изменение перестаёт быть частью будущего коммита, но сам файл на диске не меняется.

@@ q
После `git reset --hard HEAD~2` вы поняли, что удалили нужные коммиты. Можно ли их вернуть?
- [ ] Нет, они удалены навсегда
- [x] Да: их хеши есть в `git reflog`
- [ ] Только если был сделан `git stash`
- [ ] Только из резервной копии диска
@@ explain
Коммиты физически остаются в репозитории, пока их не уберёт сборщик мусора. `git reflog` показывает, где был `HEAD`, и `git reset --hard <хеш>` возвращает ветку на место.

@@ task unstage | Убрать лишнее из индекса | xp=30
В индекс добавлены два файла: `feature.txt` и `secret.txt`. Файл `secret.txt` попал туда по ошибке. Уберите его из индекса (сам файл должен остаться на диске) и закоммитьте только `feature.txt` с сообщением `Add feature`.
@@ hint
Отменить `git add` для одного файла: `git restore --staged secret.txt`.
@@ hint
После этого `git commit -m "Add feature"` — в коммит попадёт только то, что осталось в индексе.
@@ starter
git status
@@ solution
git restore --staged secret.txt
git commit -m "Add feature"
@@ test
git init -q
echo base > README.md
git add . && git commit -qm "Initial commit"
echo feature > feature.txt
echo password > secret.txt
git add feature.txt secret.txt
#--- check
eq "сообщение последнего коммита" "$(git log -1 --format=%s)" "Add feature"
eq "в коммите только feature.txt" "$(git show --name-only --format= HEAD)" "feature.txt"
ok "secret.txt остался на диске" test -f secret.txt
no "secret.txt не в истории" git cat-file -e HEAD:secret.txt
eq "secret.txt не отслеживается" "$(git status --porcelain secret.txt)" "?? secret.txt"

@@ task squash | Три коммита в один | xp=40 interview
В истории после коммита `Initial commit` есть три мелких коммита: `wip 1`, `wip 2`, `wip 3`. Они ещё никуда не отправлены. Превратите их в **один** коммит с сообщением `Add report`, сохранив все изменения.
@@ hint
`git reset --soft HEAD~3` уберёт три коммита, оставив их изменения в индексе.
@@ hint
После сброса достаточно одного `git commit -m "Add report"`.
@@ starter
git log --oneline
@@ solution
git reset --soft HEAD~3
git commit -m "Add report"
@@ test
git init -q
echo base > README.md
git add . && git commit -qm "Initial commit"
echo 1 > report.txt && git add . && git commit -qm "wip 1"
echo 2 >> report.txt && git add . && git commit -qm "wip 2"
echo 3 >> report.txt && git add . && git commit -qm "wip 3"
#--- check
eq "в истории два коммита" "$(git rev-list --count HEAD)" "2"
eq "сообщение последнего коммита" "$(git log -1 --format=%s)" "Add report"
eq "первый коммит на месте" "$(git log -1 --skip=1 --format=%s)" "Initial commit"
eq "содержимое report.txt сохранено" "$(cat report.txt | tr '\n' ' ')" "1 2 3 "
ok "рабочая папка чистая" test -z "$(git status --porcelain)"

@@ task revert | Безопасная отмена | xp=40 interview
В истории три коммита: `Initial commit`, `Add prices`, `Add docs`. Коммит `Add prices` оказался ошибочным, но история уже опубликована — переписывать её нельзя. Отмените изменения этого коммита так, чтобы все три прежних коммита остались в истории, а файл `prices.txt` исчез.
@@ hint
Нужна команда `git revert` с указанием коммита. На предпоследний коммит можно сослаться как `HEAD~1`.
@@ hint
`git revert --no-edit HEAD~1` — флаг `--no-edit` принимает сообщение по умолчанию.
@@ starter
git log --oneline
@@ solution
git revert --no-edit HEAD~1
@@ test
git init -q
echo base > README.md
git add . && git commit -qm "Initial commit"
echo 100 > prices.txt && git add . && git commit -qm "Add prices"
echo docs > docs.txt && git add . && git commit -qm "Add docs"
#--- check
eq "в истории четыре коммита" "$(git rev-list --count HEAD)" "4"
eq "старые коммиты на месте" "$(git log --skip=1 --format=%s | tr '\n' '|')" "Add docs|Add prices|Initial commit|"
no "prices.txt удалён" test -e prices.txt
ok "docs.txt на месте" test -f docs.txt
ok "рабочая папка чистая" test -z "$(git status --porcelain)"
