---
id: io-bufio
title: io и bufio
summary: io.Reader и io.Writer, композиция потоков, io.Copy, bufio.Scanner, буферизованная запись
xp: 40
---
## Два главных интерфейса

```go
type Reader interface {
	Read(p []byte) (n int, err error)
}
type Writer interface {
	Write(p []byte) (n int, err error)
}
```

Их реализуют файлы, сетевые соединения, HTTP-тела, буферы, архиваторы, шифраторы — всё. Поэтому код, написанный для `io.Reader`, работает с любым источником.

### Контракт Read

- `Read` читает **до** `len(p)` байт и возвращает, сколько прочитал (может меньше!);
- в конце данных возвращает `io.EOF` (иногда вместе с последними `n > 0` байтами — **сначала обработайте n байт, потом смотрите на ошибку**);
- `io.EOF` — не ошибка, а сигнал конца.

```go
buf := make([]byte, 4096)
for {
	n, err := r.Read(buf)
	process(buf[:n])
	if err == io.EOF {
		break
	}
	if err != nil {
		return err
	}
}
```

На практике такой цикл пишут редко — есть хелперы:

```go
data, err := io.ReadAll(r)          // всё в память
n, err := io.Copy(dst, src)         // поток из Reader в Writer (буфер 32 КБ)
io.CopyN(dst, src, 1024)
lr := io.LimitReader(r, 1<<20)      // не больше 1 МБ — защита от огромных входов
mr := io.MultiReader(r1, r2)        // последовательно
mw := io.MultiWriter(file, os.Stdout) // запись в несколько мест
tr := io.TeeReader(r, hasher)       // читать и одновременно хешировать
pr, pw := io.Pipe()                 // синхронная труба между горутинами
```

## Источники и приёмники в памяти

```go
r := strings.NewReader("hello")
var buf bytes.Buffer                // и Reader, и Writer
buf.WriteString("data")
fmt.Fprintf(&buf, "%d", 42)         // fmt пишет в любой io.Writer
b := bytes.NewReader([]byte{1, 2})
```

## Свой Reader / Writer

Обёртки-декораторы — мощный приём:

```go
type upperWriter struct{ w io.Writer }

func (u upperWriter) Write(p []byte) (int, error) {
	return u.w.Write(bytes.ToUpper(p))
}

fmt.Fprintln(upperWriter{os.Stdout}, "hello") // HELLO
```

## bufio

Системные вызовы дороги. `bufio` добавляет буфер:

```go
// Построчное чтение
sc := bufio.NewScanner(r)
for sc.Scan() {
	line := sc.Text()  // без '\n'
	_ = line
}
if err := sc.Err(); err != nil { ... }

sc.Split(bufio.ScanWords) // по словам вместо строк
sc.Buffer(make([]byte, 1024*1024), 10*1024*1024) // если строки длиннее 64 КБ

// Буферизованная запись
w := bufio.NewWriter(file)
defer w.Flush() // ВАЖНО: без Flush последние данные потеряются
fmt.Fprintln(w, "строка")
```

> **Ловушка:** `bufio.Scanner` по умолчанию не читает строки длиннее 64 КБ — `Scan` вернёт false, а `Err()` — `bufio.ErrTooLong`. Для больших строк увеличьте буфер или используйте `bufio.Reader.ReadString('\n')`.

## Закрытие

`io.Closer` (`Close() error`) — освобождение ресурса. Ошибку `Close` при **записи** в файл важно проверять: данные могут не записаться на диск.

@@ quiz
@@ q
`Read` вернул `n = 10, err = io.EOF`. Что делать?
- [ ] Отбросить данные — произошла ошибка
- [x] Обработать 10 байт, затем завершить чтение
- [ ] Повторить Read
@@ explain
Контракт `io.Reader` позволяет вернуть последние данные вместе с `io.EOF`. Сначала обрабатывайте `n` байт, потом смотрите на ошибку.

@@ q
Что произойдёт, если забыть `w.Flush()` у `bufio.Writer`?
- [ ] Ничего, данные запишутся при выходе
- [x] Данные, оставшиеся в буфере, будут потеряны
- [ ] Паника
@@ explain
`bufio.Writer` копит данные в памяти и пишет в нижележащий Writer только при заполнении буфера или вызове `Flush`.

@@ q
Какая функция защитит от чтения слишком большого тела запроса?
- [ ] `io.ReadAll`
- [x] `io.LimitReader` (или `http.MaxBytesReader`)
- [ ] `bufio.NewReader`
@@ explain
`io.LimitReader(r, n)` вернёт EOF после n байт. Для HTTP-серверов есть `http.MaxBytesReader`, который ещё и возвращает ошибку.

@@ task wc | Утилита wc | xp=50
Реализуйте `WordCount(r io.Reader) (lines, words, bytes int, err error)` — аналог Unix-утилиты `wc`:

- `lines` — количество символов `\n`;
- `words` — количество слов (последовательностей непробельных символов);
- `bytes` — общее количество байт.

Читайте поток через `bufio` (не загружайте всё в память через `io.ReadAll`). Ошибку чтения верните.
@@ hint
Удобно читать по байтам/рунам через `bufio.NewReader(r)` и `ReadRune()`: считайте байты (`size`), переводы строк и переходы «пробел → не пробел».
@@ hint
Альтернатива: `bufio.Scanner` со `ScanLines` не подойдёт для подсчёта `\n` в последней строке без перевода — проще ReadRune. Слово начинается, когда текущий символ не пробельный (`unicode.IsSpace`), а предыдущий был пробельным.
@@ starter
package main

import (
	"fmt"
	"io"
	"strings"
)

func WordCount(r io.Reader) (lines, words, bytes int, err error) {
	return 0, 0, 0, nil
}

func main() {
	fmt.Println(WordCount(strings.NewReader("hello world\nпривет мир\n")))
}
@@ solution
package main

import (
	"bufio"
	"fmt"
	"io"
	"strings"
	"unicode"
)

func WordCount(r io.Reader) (lines, words, bytes int, err error) {
	br := bufio.NewReader(r)
	inWord := false
	for {
		ch, size, rerr := br.ReadRune()
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return lines, words, bytes, rerr
		}
		bytes += size
		if ch == '\n' {
			lines++
		}
		if unicode.IsSpace(ch) {
			inWord = false
		} else if !inWord {
			inWord = true
			words++
		}
	}
	return lines, words, bytes, nil
}

func main() {
	fmt.Println(WordCount(strings.NewReader("hello world\nпривет мир\n")))
}
@@ test
package main

import (
	"errors"
	"io"
	"strings"
	"testing"
)

type failReader struct{ n int }

func (f *failReader) Read(p []byte) (int, error) {
	if f.n > 0 {
		f.n--
		copy(p, "ab ")
		return 3, nil
	}
	return 0, errors.New("disk failure")
}

func TestWordCount(t *testing.T) {
	cases := []struct {
		in             string
		lines, words, b int
	}{
		{"hello world\nпривет мир\n", 2, 4, 32},
		{"", 0, 0, 0},
		{"one", 0, 1, 3},
		{"  a  b\t\tc \n\n d", 2, 4, 14},
	}
	for _, c := range cases {
		l, w, b, err := WordCount(strings.NewReader(c.in))
		if err != nil || l != c.lines || w != c.words || b != c.b {
			t.Errorf("WordCount(%q) = %d %d %d %v; ожидалось %d %d %d", c.in, l, w, b, err, c.lines, c.words, c.b)
		}
	}
	big := strings.Repeat("word ", 100000) + "\n"
	if _, w, _, _ := WordCount(io.MultiReader(strings.NewReader(big), strings.NewReader("x"))); w != 100001 {
		t.Errorf("большой вход: слов %d", w)
	}
	if _, _, _, err := WordCount(&failReader{n: 2}); err == nil || err.Error() != "disk failure" {
		t.Errorf("ошибка чтения должна возвращаться, получено %v", err)
	}
}

@@ task upper-writer | Декоратор Writer | xp=50
Реализуйте тип `LineNumberWriter`, оборачивающий `io.Writer`: он добавляет перед каждой строкой её номер в формате `"%d: "`:

```go
w := NewLineNumberWriter(os.Stdout)
fmt.Fprint(w, "a\nb")
fmt.Fprint(w, "c\n")
// 1: a
// 2: bc
```

Важно: данные могут приходить **кусками**, и разрыв может быть посередине строки. Номер ставится только в начале новой строки. `Write` должна возвращать `len(p)` (количество байт **исходных** данных) при успехе.
@@ hint
Храните состояние `atLineStart bool` (изначально `true`) и счётчик `line int`. Перебирайте байты `p`.
@@ hint
Если `atLineStart` — сначала запишите префикс `fmt.Fprintf(w.w, "%d: ", line)`. Байт `\n` переводит `atLineStart = true`. Для простоты можно писать в нижележащий writer через `bytes.Buffer`, собрав результат за один `Write`.
@@ starter
package main

import (
	"fmt"
	"io"
	"os"
)

type LineNumberWriter struct {
	w io.Writer
}

func NewLineNumberWriter(w io.Writer) *LineNumberWriter {
	return &LineNumberWriter{w: w}
}

func (l *LineNumberWriter) Write(p []byte) (int, error) {
	return l.w.Write(p)
}

func main() {
	w := NewLineNumberWriter(os.Stdout)
	fmt.Fprint(w, "a\nb")
	fmt.Fprint(w, "c\n")
}
@@ solution
package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strconv"
)

type LineNumberWriter struct {
	w           io.Writer
	line        int
	atLineStart bool
}

func NewLineNumberWriter(w io.Writer) *LineNumberWriter {
	return &LineNumberWriter{w: w, atLineStart: true}
}

func (l *LineNumberWriter) Write(p []byte) (int, error) {
	var buf bytes.Buffer
	for _, b := range p {
		if l.atLineStart {
			l.line++
			buf.WriteString(strconv.Itoa(l.line) + ": ")
			l.atLineStart = false
		}
		buf.WriteByte(b)
		if b == '\n' {
			l.atLineStart = true
		}
	}
	if _, err := l.w.Write(buf.Bytes()); err != nil {
		return 0, err
	}
	return len(p), nil
}

func main() {
	w := NewLineNumberWriter(os.Stdout)
	fmt.Fprint(w, "a\nb")
	fmt.Fprint(w, "c\n")
}
@@ test
package main

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"testing"
)

func TestLineNumberWriter(t *testing.T) {
	var out bytes.Buffer
	w := NewLineNumberWriter(&out)
	var _ io.Writer = w
	n, err := w.Write([]byte("a\nb"))
	if n != 3 || err != nil {
		t.Errorf("Write вернул %d, %v; ожидалось 3, nil", n, err)
	}
	fmt.Fprint(w, "c\n")
	fmt.Fprint(w, "\nd\n")
	want := "1: a\n2: bc\n3: \n4: d\n"
	if out.String() != want {
		t.Errorf("получено %q, ожидалось %q", out.String(), want)
	}
}

func TestLineNumberWriterCopy(t *testing.T) {
	var out bytes.Buffer
	w := NewLineNumberWriter(&out)
	src := strings.Repeat("строка\n", 3)
	if _, err := io.Copy(w, strings.NewReader(src)); err != nil {
		t.Fatal(err)
	}
	if out.String() != "1: строка\n2: строка\n3: строка\n" {
		t.Errorf("io.Copy: %q", out.String())
	}
}
