# Запуск и проверка SQL-задач на SQLite (в памяти). Вход — JSON в stdin:
# {"mode": "run"|"check", "setup": "...", "code": "...", "solution": "..."}
# В setup могут быть служебные строки:
#   --@ ordered        порядок строк результата важен
#   --@ columns        имена столбцов результата тоже сравниваются
#   --@ check: SELECT  после скрипта ученика выполняется этот запрос, сравнивается его результат
import json
import sqlite3
import sys

MAX_ROWS = 40


def statements(script):
    out, buf = [], ""
    for line in script.splitlines(True):
        buf += line
        if sqlite3.complete_statement(buf):
            if strip_comments(buf).strip(" \t\r\n;"):
                out.append(buf.strip())
            buf = ""
    if strip_comments(buf).strip(" \t\r\n;"):
        out.append(buf.strip())
    return out


def strip_comments(s):
    return "\n".join(l for l in s.splitlines() if not l.strip().startswith("--"))


def connect(setup):
    con = sqlite3.connect(":memory:", isolation_level=None)  # транзакциями управляет сам ученик
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(setup)
    con.commit()
    return con


def run_script(con, code):
    """Выполняет все команды; возвращает список (sql, columns|None, rows, rowcount)."""
    res = []
    for st in statements(code):
        cur = con.execute(st)
        if cur.description is not None:
            res.append((st, [d[0] for d in cur.description], cur.fetchall(), -1))
        else:
            res.append((st, None, [], cur.rowcount))
    con.commit()
    return res


def cell(v):
    if v is None:
        return "NULL"
    if isinstance(v, float):
        s = ("%.6f" % v).rstrip("0").rstrip(".")
        return s if s not in ("", "-0") else "0"
    if isinstance(v, bytes):
        return "<blob>"
    return str(v)


def table(cols, rows):
    shown = [[cell(v) for v in r] for r in rows[:MAX_ROWS]]
    w = [len(c) for c in cols]
    for r in shown:
        for i, v in enumerate(r):
            w[i] = max(w[i], len(v))
    line = "+" + "+".join("-" * (x + 2) for x in w) + "+"
    out = [line, "| " + " | ".join(c.ljust(w[i]) for i, c in enumerate(cols)) + " |", line]
    for r in shown:
        out.append("| " + " | ".join(v.ljust(w[i]) for i, v in enumerate(r)) + " |")
    out.append(line)
    n = len(rows)
    out.append("(%d %s%s)" % (n, plural(n), ", показаны первые %d" % MAX_ROWS if n > MAX_ROWS else ""))
    return "\n".join(out)


def plural(n):
    a, b = abs(n) % 100, abs(n) % 10
    if 10 < a < 20:
        return "строк"
    return "строка" if b == 1 else "строки" if 2 <= b <= 4 else "строк"


def norm(v):
    if isinstance(v, bool):
        return float(v)
    if isinstance(v, (int, float)):
        return round(float(v), 6)
    return v


def key(row):
    return tuple((0, "") if v is None else (1, v) if isinstance(v, float) else (2, str(v)) for v in row)


def last_select(res):
    for st, cols, rows, _ in reversed(res):
        if cols is not None:
            return cols, rows
    return None


def flags(setup):
    f = {"ordered": False, "columns": False, "check": None}
    for l in setup.splitlines():
        l = l.strip()
        if l == "--@ ordered":
            f["ordered"] = True
        elif l == "--@ columns":
            f["columns"] = True
        elif l.startswith("--@ check:"):
            f["check"] = l[len("--@ check:"):].strip()
    return f


def result_of(setup, code, check):
    con = connect(setup)
    res = run_script(con, code)
    if check:
        cur = con.execute(check)
        return [d[0] for d in cur.description], cur.fetchall(), res
    ls = last_select(res)
    if ls is None:
        return None, None, res
    return ls[0], ls[1], res


def show(res):
    for st, cols, rows, rc in res:
        if cols is not None:
            print(table(cols, rows))
        elif rc >= 0:
            print("OK, затронуто строк: %d" % rc)
        else:
            print("OK")


def main():
    req = json.load(sys.stdin)
    setup, code = req.get("setup", ""), req.get("code", "")
    f = flags(setup)
    if req.get("mode") != "check":
        con = connect(setup)
        res = run_script(con, code)
        if not res:
            print("(нет ни одной команды)")
        show(res)
        if f["check"]:
            cur = con.execute(f["check"])
            print("\nСостояние после ваших команд — " + f["check"])
            print(table([d[0] for d in cur.description], cur.fetchall()))
        return 0

    ecols, erows, _ = result_of(setup, req.get("solution", ""), f["check"])
    print("=== RUN   запрос выполняется")
    try:
        cols, rows, res = result_of(setup, code, f["check"])
    except sqlite3.Error as e:
        print("    ошибка SQL: %s" % e)
        print("--- FAIL: запрос выполняется")
        return 1
    print("--- PASS: запрос выполняется")
    name = "результат совпадает с ожидаемым"
    print("=== RUN   " + name)
    problems = []
    if cols is None:
        problems.append("в вашем коде нет запроса SELECT, который возвращает результат")
    else:
        if len(cols) != len(ecols):
            problems.append("столбцов в результате: %d, ожидалось %d (%s)" % (len(cols), len(ecols), ", ".join(ecols)))
        elif f["columns"] and [c.lower() for c in cols] != [c.lower() for c in ecols]:
            problems.append("имена столбцов: %s; ожидались: %s" % (", ".join(cols), ", ".join(ecols)))
        if not problems:
            a = [tuple(norm(v) for v in r) for r in rows]
            b = [tuple(norm(v) for v in r) for r in erows]
            if len(a) != len(b):
                problems.append("строк в результате: %d, ожидалось %d" % (len(a), len(b)))
            elif f["ordered"]:
                if a != b:
                    problems.append("строки те же, но порядок другой — проверьте ORDER BY" if sorted(a, key=key) == sorted(b, key=key) else "данные в строках отличаются от ожидаемых")
            elif sorted(a, key=key) != sorted(b, key=key):
                problems.append("данные в строках отличаются от ожидаемых")
    if not problems:
        print(table(cols, rows))
        print("--- PASS: " + name)
        print("PASS")
        return 0
    for p in problems:
        print("    " + p)
    if cols is not None:
        print("Ваш результат:")
        print(table(cols, rows))
    print("Ожидаемый результат:")
    print(table(ecols, erows))
    print("--- FAIL: " + name)
    print("FAIL")
    return 1


try:
    code = main()
except sqlite3.Error as e:
    print("Ошибка SQL: %s" % e, file=sys.stderr)
    code = 1
sys.exit(code)
