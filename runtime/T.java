import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Objects;

/** Мини-фреймворк для скрытых тестов: T.test("имя", () -> { T.eq(ожидаем, получили); }); T.done(); */
final class T {
    interface Body { void run() throws Throwable; }

    private static int pass, fail;
    private static final PrintStream OUT = System.out;

    private T() {}

    static void test(String name, Body b) {
        OUT.println("=== RUN   " + name);
        try {
            b.run();
            System.setOut(OUT);
            pass++;
            OUT.println("--- PASS: " + name);
        } catch (AssertionError e) {
            System.setOut(OUT);
            fail++;
            OUT.println("    " + String.valueOf(e.getMessage()).replace("\n", "\n    "));
            OUT.println("--- FAIL: " + name);
        } catch (Throwable e) {
            System.setOut(OUT);
            fail++;
            OUT.println("    исключение: " + e);
            for (StackTraceElement el : e.getStackTrace()) {
                if ("Main.java".equals(el.getFileName())) OUT.println("        at " + el);
            }
            OUT.println("--- FAIL: " + name);
        }
    }

    static String fmt(Object o) {
        if (o == null) return "null";
        if (o instanceof String) return "\"" + o + "\"";
        if (o instanceof Character) return "'" + o + "'";
        if (o instanceof int[]) return Arrays.toString((int[]) o);
        if (o instanceof long[]) return Arrays.toString((long[]) o);
        if (o instanceof double[]) return Arrays.toString((double[]) o);
        if (o instanceof char[]) return Arrays.toString((char[]) o);
        if (o instanceof boolean[]) return Arrays.toString((boolean[]) o);
        if (o instanceof byte[]) return Arrays.toString((byte[]) o);
        if (o instanceof Object[]) return Arrays.deepToString((Object[]) o);
        return String.valueOf(o);
    }

    private static boolean same(Object a, Object b) {
        if (a instanceof Number && b instanceof Number && a.getClass() != b.getClass()) {
            Number x = (Number) a, y = (Number) b;
            boolean fl = x instanceof Double || x instanceof Float || y instanceof Double || y instanceof Float;
            return fl ? Math.abs(x.doubleValue() - y.doubleValue()) < 1e-9 : x.longValue() == y.longValue();
        }
        if (a instanceof Double && b instanceof Double) {
            double x = (Double) a, y = (Double) b;
            return x == y || Math.abs(x - y) < 1e-9 || (Double.isNaN(x) && Double.isNaN(y));
        }
        return Objects.deepEquals(a, b);
    }

    static void eq(Object expected, Object actual) { eq(null, expected, actual); }

    static void eq(String what, Object expected, Object actual) {
        if (!same(expected, actual)) {
            throw new AssertionError((what == null ? "" : what + ": ") + "ожидалось " + fmt(expected) + ", получено " + fmt(actual));
        }
    }

    static void check(boolean cond, String message) {
        if (!cond) throw new AssertionError(message);
    }

    static void fail(String message) { throw new AssertionError(message); }

    static <X extends Throwable> X throwsEx(Class<X> type, Body b) {
        try {
            b.run();
        } catch (Throwable e) {
            if (type.isInstance(e)) return type.cast(e);
            throw new AssertionError("ожидалось исключение " + type.getSimpleName() + ", а брошено " + e);
        }
        throw new AssertionError("ожидалось исключение " + type.getSimpleName() + ", но код завершился без него");
    }

    /** Выполняет код и возвращает всё, что он напечатал в System.out (без пробелов и переводов строк по краям). */
    static String out(Body b) throws Throwable {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        PrintStream ps = new PrintStream(buf, true, StandardCharsets.UTF_8);
        System.setOut(ps);
        try {
            b.run();
        } finally {
            ps.flush();
            System.setOut(OUT);
        }
        return buf.toString(StandardCharsets.UTF_8).replace("\r\n", "\n").strip();
    }

    static void done() {
        OUT.println(fail == 0 ? "PASS" : "FAIL");
        OUT.flush();
        System.exit(fail == 0 ? 0 : 1);
    }
}
