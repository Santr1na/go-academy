---
id: git-rebase
title: Rebase, cherry-pick и stash
summary: Линейная история, перенос отдельных коммитов и временное хранилище правок.
xp: 35
---
## Rebase — перенос ветки на новое основание

Пока вы работали в `feature`, в `main` появились новые коммиты. Получить их в свою ветку можно двумя способами.

**merge** создаёт коммит слияния:

```text
A ← B ← C ← D (main)
     ↖        ↘
       E ← F ← M (feature)
```

**rebase** берёт ваши коммиты и по одному применяет их поверх свежего `main`:

```text
A ← B ← C ← D (main) ← E' ← F' (feature)
```

```bash
git switch feature
git rebase main
```

История становится линейной, как будто вы начали работу только что. Но `E'` и `F'` — это **новые коммиты с новыми хешами**: содержимое то же, родитель другой.

| | merge | rebase |
|---|---|---|
| История | сохраняется как была, с развилками | линейная, чистая |
| Существующие коммиты | не меняются | пересоздаются |
| Конфликты | решаются один раз | могут возникать на каждом переносимом коммите |
| Безопасность для общих веток | безопасен | опасен |

> **Золотое правило rebase.** Не делайте rebase веток, с которыми работают другие люди. Вы замените коммиты новыми, а у коллег останутся старые — истории разойдутся. Rebase — для своей локальной ветки до того, как она стала общей.

Конфликт при rebase решается так же, как при слиянии, но завершается иначе: исправить файл → `git add` → `git rebase --continue`. Отменить всё — `git rebase --abort`.

**Интерактивный rebase** (`git rebase -i HEAD~3`) позволяет перед публикацией навести порядок: объединить коммиты (`squash`), переименовать (`reword`), поменять местами, выбросить (`drop`).

## cherry-pick — взять один коммит

```bash
git cherry-pick <хеш>
```

Применяет изменения указанного коммита к текущей ветке, создавая **новый** коммит. Типичный случай: исправление ошибки сделано в рабочей ветке, а нужно срочно доставить его в релизную, не забирая остальное.

## stash — отложить незаконченное

Вы посреди работы, а нужно срочно переключиться на другую ветку. Коммитить недоделанное не хочется.

```bash
git stash                # спрятать изменения отслеживаемых файлов; рабочая папка станет чистой
git stash -u             # то же, включая новые (untracked) файлы
git stash list           # список отложенного
git stash pop            # вернуть последнее и удалить из списка
git stash apply          # вернуть, но оставить в списке
```

Stash — это стек: `pop` возвращает то, что спрятано последним. Он не привязан к ветке — спрятать можно в одной, а достать в другой.

> **Ловушка.** Обычный `git stash` не трогает новые файлы, которые ещё ни разу не добавляли через `git add`. Они останутся в рабочей папке и «переедут» с вами на другую ветку. Нужен флаг `-u`.

## Теги

Тег — неподвижная метка на коммите, обычно версия релиза:

```bash
git tag v1.0.0                       # лёгкий тег на текущем коммите
git tag -a v1.0.0 -m "Первый релиз"  # аннотированный: с автором, датой и сообщением
git push origin v1.0.0               # теги отправляются отдельно
```

В отличие от ветки, тег не двигается при новых коммитах.

@@ quiz
@@ q
Что происходит с коммитами ветки `feature` при `git rebase main`?
- [ ] Они переносятся в `main`
- [x] Создаются новые коммиты с теми же изменениями, но другими хешами, поверх `main`
- [ ] Они объединяются в один коммит
- [ ] Ничего, меняется только `main`
@@ explain
Хеш коммита зависит от родителя. У перенесённых коммитов другой родитель, значит это новые объекты. Ветка `main` при этом не меняется.

@@ q
Почему нельзя делать rebase ветки, в которую уже пушат коллеги?
- [ ] Rebase работает только с локальными файлами
- [x] Старые коммиты заменяются новыми, и история у коллег расходится с вашей
- [ ] Rebase удаляет файлы коллег
- [ ] Git запрещает это технически
@@ explain
У коллег останутся прежние коммиты, а на сервере (после `push --force`) — ваши новые. При следующей синхронизации получатся дубликаты коммитов и конфликты. Технически Git этого не запрещает — отсюда и правило.

@@ q
Вы создали новый файл `draft.txt`, не делали `git add` и выполнили `git stash`. Что произойдёт с файлом?
- [ ] Он спрячется в stash
- [x] Он останется в рабочей папке
- [ ] Он будет удалён
- [ ] Он автоматически закоммитится
@@ explain
По умолчанию `git stash` сохраняет только изменения отслеживаемых файлов. Чтобы спрятать и новые файлы, нужен `git stash -u`.

@@ q
Для чего используют `git cherry-pick`?
- [ ] Чтобы удалить коммит из истории
- [ ] Чтобы объединить две ветки целиком
- [x] Чтобы применить изменения одного конкретного коммита к текущей ветке
- [ ] Чтобы выбрать, какие файлы добавить в индекс
@@ explain
Команда копирует изменения выбранного коммита в виде нового коммита. Остальная история исходной ветки не затрагивается.

@@ task rebase | Линейная история | xp=45 interview
Ветка `feature` ответвилась от `main`, после чего в `main` появился новый коммит `Update readme`. В `feature` есть коммит `Add feature`. Изменения затрагивают разные файлы.

Перенесите `feature` поверх актуального `main` с помощью rebase, затем влейте её в `main`. В итоге история `main` должна быть **линейной** — без коммитов слияния — и содержать три коммита: `Initial commit`, `Update readme`, `Add feature`.
@@ hint
Находясь в `feature`, выполните `git rebase main`.
@@ hint
Затем `git switch main` и `git merge feature` — слияние пройдёт как fast-forward.
@@ starter
git log --oneline --graph --all
@@ solution
git switch feature
git rebase main
git switch main
git merge feature
@@ test
git init -q
echo base > README.md
git add . && git commit -qm "Initial commit"
git switch -qc feature
echo f > feature.txt && git add . && git commit -qm "Add feature"
git switch -q main
echo more >> README.md && git commit -qam "Update readme"
#--- check
eq "история main" "$(git log main --format=%s | tr '\n' '|')" "Add feature|Update readme|Initial commit|"
eq "коммитов слияния нет" "$(git rev-list --merges --count main)" "0"
eq "main и feature указывают на один коммит" "$(git rev-parse main)" "$(git rev-parse feature)"
ok "оба файла на месте" test -f feature.txt -a -f README.md

@@ task cherry-pick | Срочное исправление | xp=40 interview
В ветке `dev` три коммита поверх `main`: `Add experiment`, `Fix typo`, `More experiments`. В `main` нужно доставить **только** исправление `Fix typo` (оно меняет файл `README.md`), не забирая эксперименты. Вы находитесь в `main`.
@@ hint
Коммит `Fix typo` — предпоследний в `dev`, на него можно сослаться как `dev~1`.
@@ hint
`git cherry-pick dev~1`
@@ starter
git log --oneline dev
@@ solution
git cherry-pick dev~1
@@ test
git init -q
echo "Helo" > README.md
git add . && git commit -qm "Initial commit"
git switch -qc dev
echo x > experiment.txt && git add . && git commit -qm "Add experiment"
echo "Hello" > README.md && git commit -qam "Fix typo"
echo y >> experiment.txt && git commit -qam "More experiments"
git switch -q main
#--- check
eq "текущая ветка — main" "$(git branch --show-current)" "main"
eq "последний коммит main" "$(git log -1 --format=%s main)" "Fix typo"
eq "в main два коммита" "$(git rev-list --count main)" "2"
eq "README исправлен" "$(cat README.md)" "Hello"
no "экспериментов в main нет" test -e experiment.txt
eq "ветка dev не изменилась" "$(git rev-list --count dev)" "4"

@@ task stash | Отложить и вернуть | xp=35
Вы в ветке `feature` с незакоммиченной правкой в `app.txt`. Нужно срочно исправить опечатку в `main`:

1. отложите текущую правку;
2. перейдите в `main`, замените содержимое `README.md` на `Hello` и закоммитьте с сообщением `Fix typo`;
3. вернитесь в `feature` и восстановите отложенную правку (коммитить её не нужно).
@@ hint
`git stash` прячет правку, `git stash pop` возвращает.
@@ hint
Между ними: `git switch main`, `echo "Hello" > README.md`, `git commit -am "Fix typo"`, `git switch feature`.
@@ starter
git status
@@ solution
git stash
git switch main
echo "Hello" > README.md
git commit -am "Fix typo"
git switch feature
git stash pop
@@ test
git init -q
echo "Helo" > README.md
echo v1 > app.txt
git add . && git commit -qm "Initial commit"
git switch -qc feature
echo "v2 in progress" > app.txt
#--- check
eq "текущая ветка — feature" "$(git branch --show-current)" "feature"
eq "правка в app.txt восстановлена" "$(cat app.txt)" "v2 in progress"
eq "правка не закоммичена" "$(git status --porcelain app.txt)" " M app.txt"
eq "последний коммит main" "$(git log -1 --format=%s main)" "Fix typo"
eq "README в main исправлен" "$(git show main:README.md)" "Hello"
eq "stash пуст" "$(git stash list | wc -l | tr -d ' ')" "0"
