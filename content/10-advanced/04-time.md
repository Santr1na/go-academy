---
id: time
title: Пакет time
summary: time.Time и Duration, форматирование по эталонной дате, парсинг, часовые пояса, монотонные часы, сравнение
xp: 35
---
## Time и Duration

```go
now := time.Now()
later := now.Add(90 * time.Minute)
d := later.Sub(now)                 // time.Duration
fmt.Println(d, d.Minutes())         // 1h30m0s 90

tomorrow := now.AddDate(0, 0, 1)    // годы, месяцы, дни
fmt.Println(later.After(now), now.Before(later))
```

`time.Duration` — это `int64` наносекунд. Константы: `time.Nanosecond … time.Hour`. Дней нет — сутки бывают по 23 и 25 часов при переходе на летнее время.

```go
timeout := 5 * time.Second          // константа × Duration — ок
n := 3
wait := time.Duration(n) * time.Second // переменную int нужно преобразовать
```

## Форматирование по эталонной дате

Вместо `%Y-%m-%d` Go использует **эталонный момент** `Mon Jan 2 15:04:05 MST 2006` (1-2-3-4-5-6-7: месяц 1, день 2, час 15 = 3 PM, минута 4, секунда 5, год 2006, пояс −7):

```go
t := time.Date(2024, time.March, 8, 14, 5, 0, 0, time.UTC)
t.Format("2006-01-02")            // 2024-03-08
t.Format("02.01.2006 15:04")      // 08.03.2024 14:05
t.Format(time.RFC3339)            // 2024-03-08T14:05:00Z
t.Format(time.DateTime)           // 2024-03-08 14:05:00 (Go 1.20+)
t.Format("Jan 2, 3:04 PM")        // Mar 8, 2:05 PM
```

> **Ловушка:** `"2006-01-02"` — правильно; `"2006-02-01"` перепутает день и месяц; `"YYYY-MM-DD"` выведется буквально.

## Парсинг

```go
t, err := time.Parse("2006-01-02", "2024-03-08")          // в UTC
loc, _ := time.LoadLocation("Europe/Moscow")
t, err = time.ParseInLocation("02.01.2006 15:04", "08.03.2024 14:05", loc)
d, err := time.ParseDuration("1h15m30s")
```

## Часовые пояса

`time.Time` хранит момент и локацию. `t.UTC()`, `t.In(loc)` — тот же момент в другом поясе. Храните и передавайте время в UTC, конвертируйте в локальное только для отображения.

## Сравнение

```go
t1.Equal(t2)  // сравнивает МОМЕНТ (с учётом поясов)
t1 == t2      // сравнивает структуры, включая локацию и монотонные часы — обычно не то, что нужно!
```

## Монотонные часы

`time.Now()` содержит показания и «настенных», и **монотонных** часов. `Sub`, `Since`, `Until` используют монотонные, поэтому измерение интервалов не ломается при переводе системных часов:

```go
start := time.Now()
work()
elapsed := time.Since(start)
```

## Округление и усечение

```go
t.Truncate(time.Hour)          // начало часа
d.Round(time.Millisecond)
t.YearDay(); t.Weekday(); t.ISOWeek()
```

@@ quiz
@@ q
Какой layout выведет дату как `31/12/2024`?
- [ ] `"DD/MM/YYYY"`
- [x] `"02/01/2006"`
- [ ] `"01/02/2006"`
- [ ] `"%d/%m/%Y"`
@@ explain
В эталонной дате день — `02`, месяц — `01`, год — `2006`. `"01/02/2006"` дал бы американский формат «месяц/день».

@@ q
Как правильно сравнить два момента времени, возможно, в разных часовых поясах?
- [ ] `t1 == t2`
- [x] `t1.Equal(t2)`
- [ ] `t1.String() == t2.String()`
@@ explain
`Equal` сравнивает момент времени. `==` сравнивает внутренние поля (включая локацию), поэтому один и тот же момент в UTC и MSK будет «не равен».

@@ q
Скомпилируется ли `n := 3; time.Sleep(n * time.Second)`?
- [ ] Да
- [x] Нет: `int` нельзя умножить на `time.Duration` без преобразования
@@ explain
Нужно `time.Duration(n) * time.Second`. С нетипизированной константой (`3 * time.Second`) преобразование не требуется.

@@ task dates | Работа с датами | xp=50
Реализуйте:

- `DaysBetween(a, b string) (int, error)` — количество полных суток между датами в формате `ДД.ММ.ГГГГ` (`"01.03.2024"`, `"08.03.2024"` → 7); если `b` раньше `a` — отрицательное число. Разбирайте даты в UTC.
- `FormatRU(t time.Time) string` — формат `"08.03.2024 14:05"`.
- `NextWeekday(t time.Time, wd time.Weekday) time.Time` — ближайшая **будущая** дата (строго после `t`) с днём недели `wd`, время сохраняется.
@@ hint
Layout для разбора: `"02.01.2006"`. Разница: `int(tb.Sub(ta).Hours() / 24)`.
@@ hint
`NextWeekday`: `days := (int(wd) - int(t.Weekday()) + 7) % 7; if days == 0 { days = 7 }; return t.AddDate(0, 0, days)`.
@@ starter
package main

import (
	"fmt"
	"time"
)

func DaysBetween(a, b string) (int, error) {
	return 0, nil
}

func FormatRU(t time.Time) string {
	return t.String()
}

func NextWeekday(t time.Time, wd time.Weekday) time.Time {
	return t
}

func main() {
	fmt.Println(DaysBetween("01.03.2024", "08.03.2024"))
}
@@ solution
package main

import (
	"fmt"
	"time"
)

const layoutRU = "02.01.2006"

func DaysBetween(a, b string) (int, error) {
	ta, err := time.Parse(layoutRU, a)
	if err != nil {
		return 0, fmt.Errorf("дата %q: %w", a, err)
	}
	tb, err := time.Parse(layoutRU, b)
	if err != nil {
		return 0, fmt.Errorf("дата %q: %w", b, err)
	}
	return int(tb.Sub(ta).Hours() / 24), nil
}

func FormatRU(t time.Time) string {
	return t.Format("02.01.2006 15:04")
}

func NextWeekday(t time.Time, wd time.Weekday) time.Time {
	days := (int(wd) - int(t.Weekday()) + 7) % 7
	if days == 0 {
		days = 7
	}
	return t.AddDate(0, 0, days)
}

func main() {
	fmt.Println(DaysBetween("01.03.2024", "08.03.2024"))
}
@@ test
package main

import (
	"testing"
	"time"
)

func TestDaysBetween(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"01.03.2024", "08.03.2024", 7},
		{"28.02.2024", "01.03.2024", 2},
		{"28.02.2023", "01.03.2023", 1},
		{"01.01.2024", "01.01.2025", 366},
		{"10.05.2024", "01.05.2024", -9},
		{"01.01.2024", "01.01.2024", 0},
	}
	for _, c := range cases {
		if got, err := DaysBetween(c.a, c.b); err != nil || got != c.want {
			t.Errorf("DaysBetween(%s, %s) = %d, %v; ожидалось %d", c.a, c.b, got, err, c.want)
		}
	}
	for _, bad := range [][2]string{{"2024-03-01", "01.03.2024"}, {"01.03.2024", "32.01.2024"}} {
		if _, err := DaysBetween(bad[0], bad[1]); err == nil {
			t.Errorf("DaysBetween(%v) должна вернуть ошибку", bad)
		}
	}
}

func TestFormatAndWeekday(t *testing.T) {
	tm := time.Date(2024, time.March, 8, 14, 5, 59, 0, time.UTC) // пятница
	if got := FormatRU(tm); got != "08.03.2024 14:05" {
		t.Errorf("FormatRU = %q", got)
	}
	cases := map[time.Weekday]string{
		time.Saturday: "09.03.2024 14:05",
		time.Monday:   "11.03.2024 14:05",
		time.Friday:   "15.03.2024 14:05",
		time.Thursday: "14.03.2024 14:05",
	}
	for wd, want := range cases {
		if got := FormatRU(NextWeekday(tm, wd)); got != want {
			t.Errorf("NextWeekday(пт, %v) = %s, ожидалось %s", wd, got, want)
		}
	}
}
