// Мини-рендерер Markdown и подсветка синтаксиса Go — без внешних зависимостей.
(function (global) {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- Подсветка Go ----------
  var KEYWORDS = new Set(('break case chan const continue default defer else fallthrough for func go goto if ' +
    'import interface map package range return select struct switch type var').split(' '));
  var TYPES = new Set(('bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string ' +
    'uint uint8 uint16 uint32 uint64 uintptr any comparable').split(' '));
  var BUILTINS = new Set(('append cap clear close complex copy delete imag len make max min new panic print println real recover').split(' '));
  var CONSTS = new Set(['true', 'false', 'nil', 'iota']);

  var TOKEN_RE = new RegExp([
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$))',             // 1 comment
    '(`[^`]*`?|"(?:\\\\.|[^"\\\\\\n])*"?|\'(?:\\\\.|[^\'\\\\\\n])*\'?)', // 2 string/rune
    '(\\b(?:0[xX][\\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*(?:\\.\\d*)?(?:[eE][+-]?\\d+)?i?)\\b|\\.\\d+\\b)', // 3 number
    '([A-Za-z_\\u00C0-\\uFFFF][\\w\\u00C0-\\uFFFF]*)'             // 4 identifier
  ].join('|'), 'g');

  function highlightGo(code) {
    var out = '', last = 0, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code)) !== null) {
      if (m[0] === '') { TOKEN_RE.lastIndex++; continue; }
      out += esc(code.slice(last, m.index));
      var t = m[0], cls = null;
      if (m[1]) cls = 'c';
      else if (m[2]) cls = 's';
      else if (m[3]) cls = 'n';
      else if (m[4]) {
        if (KEYWORDS.has(t)) cls = 'k';
        else if (TYPES.has(t)) cls = 't';
        else if (CONSTS.has(t)) cls = 'b';
        else if (BUILTINS.has(t) && code.charAt(TOKEN_RE.lastIndex) === '(') cls = 'bf';
        else if (code.charAt(TOKEN_RE.lastIndex) === '(') cls = 'f';
        else if (/^[A-Z]/.test(t) && code.charAt(m.index - 1) !== '.') cls = 'ty';
      }
      out += cls ? '<span class="tok-' + cls + '">' + esc(t) + '</span>' : esc(t);
      last = TOKEN_RE.lastIndex;
    }
    return out + esc(code.slice(last));
  }

  // ---------- Подсветка Java и SQL (общий токенизатор, разные словари) ----------
  function makeHighlighter(opts) {
    var re = new RegExp('(' + opts.comment.source + ')|(' + opts.string.source + ')|' +
      '(\\b(?:0[xX][\\da-fA-F_]+|\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[LlFfDd]?)\\b)|' +
      '(@?[A-Za-z_\\u00C0-\\uFFFF][\\w\\u00C0-\\uFFFF]*)', 'g');
    return function (code) {
      var out = '', last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(code)) !== null) {
        if (m[0] === '') { re.lastIndex++; continue; }
        out += esc(code.slice(last, m.index));
        var t = m[0], cls = null, w = opts.ci ? t.toUpperCase() : t;
        if (m[1]) cls = 'c';
        else if (m[2]) cls = 's';
        else if (m[3]) cls = 'n';
        else if (m[4]) {
          if (t.charAt(0) === '@') cls = 'b';
          else if (opts.keywords.has(w)) cls = 'k';
          else if (opts.types.has(w)) cls = 't';
          else if (opts.consts.has(w)) cls = 'b';
          else if (code.charAt(re.lastIndex) === '(') cls = opts.ci ? 'bf' : 'f';
          else if (!opts.ci && /^[A-Z]/.test(t)) cls = 'ty';
        }
        out += cls ? '<span class="tok-' + cls + '">' + esc(t) + '</span>' : esc(t);
        last = re.lastIndex;
      }
      return out + esc(code.slice(last));
    };
  }
  var highlightJava = makeHighlighter({
    comment: /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/,
    string: /"""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/,
    keywords: new Set(('abstract assert break case catch class continue default do else enum extends final finally for if implements import ' +
      'instanceof interface native new package private protected public record return sealed permits static strictfp super switch synchronized this ' +
      'throw throws transient try var volatile while yield').split(' ')),
    types: new Set('boolean byte char double float int long short void'.split(' ')),
    consts: new Set(['true', 'false', 'null'])
  });
  var highlightSQL = makeHighlighter({
    ci: true,
    comment: /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/,
    string: /'(?:''|[^'])*'?/,
    keywords: new Set(('SELECT FROM WHERE GROUP BY HAVING ORDER LIMIT OFFSET JOIN INNER LEFT RIGHT FULL OUTER CROSS ON AS AND OR NOT IN IS LIKE BETWEEN EXISTS ' +
      'DISTINCT UNION ALL EXCEPT INTERSECT INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX VIEW DROP ALTER ADD COLUMN PRIMARY KEY FOREIGN REFERENCES ' +
      'UNIQUE CHECK DEFAULT CONSTRAINT CASE WHEN THEN ELSE END ASC DESC WITH RECURSIVE OVER PARTITION ROWS RANGE PRECEDING FOLLOWING CURRENT ROW UNBOUNDED ' +
      'BEGIN COMMIT ROLLBACK TRANSACTION EXPLAIN ANALYZE QUERY PLAN IF USING NULLS FIRST LAST CASCADE RETURNING SAVEPOINT').split(' ')),
    types: new Set('INTEGER INT BIGINT SMALLINT TEXT VARCHAR CHAR REAL NUMERIC DECIMAL BOOLEAN DATE TIMESTAMP SERIAL BLOB FLOAT DOUBLE'.split(' ')),
    consts: new Set(['NULL', 'TRUE', 'FALSE'])
  });

  function highlightShell(code) {
    return code.split('\n').map(function (line) {
      if (/^\s*#/.test(line)) return '<span class="tok-c">' + esc(line) + '</span>';
      var m = /^(\s*\$?\s*)(\S+)(.*)$/.exec(line);
      if (!m) return esc(line);
      var rest = m[3], c = rest.indexOf(' #');
      var tail = c >= 0 ? esc(rest.slice(0, c)) + '<span class="tok-c">' + esc(rest.slice(c)) + '</span>' : esc(rest);
      return esc(m[1]) + '<span class="tok-k">' + esc(m[2]) + '</span>' + tail;
    }).join('\n');
  }

  var LANG_LABELS = { java: 'Java', sql: 'SQL', xml: 'XML', yaml: 'YAML', yml: 'YAML', properties: 'properties', http: 'HTTP', go: 'Go', golang: 'Go', sh: 'Терминал', bash: 'Терминал', shell: 'Терминал', console: 'Терминал', json: 'JSON' };

  // Блок без указания языка — это обычный текст (например, образец вывода
  // программы), его не нужно раскрашивать как код.
  function highlight(code, lang) {
    lang = (lang || '').toLowerCase();
    if (lang === 'go' || lang === 'golang') return highlightGo(code);
    if (lang === 'java') return highlightJava(code);
    if (lang === 'sql') return highlightSQL(code);
    if (lang === 'sh' || lang === 'bash' || lang === 'shell' || lang === 'console') return highlightShell(code);
    return esc(code);
  }

  var COPY_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';

  function codeBlock(code, lang, highlighted) {
    var label = LANG_LABELS[(lang || '').toLowerCase()];
    return '<div class="code-block' + (label ? ' has-head' : '') + '">' +
      (label ? '<div class="code-head"><span class="code-lang">' + label + '</span></div>' : '') +
      '<button class="copy-btn" type="button" title="Копировать" aria-label="Копировать код">' + COPY_ICON + '</button>' +
      '<pre><code>' + (highlighted !== undefined ? highlighted : highlight(code, lang)) + '</code></pre></div>';
  }

  // ---------- Markdown ----------
  function inline(text) {
    var codes = [];
    text = text.replace(/`([^`]+)`/g, function (_, c) {
      codes.push('<code>' + esc(c) + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    text = esc(text);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      var safe = /^(https?:|#|\/)/.test(u) ? u : '#';
      var ext = /^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + safe + '"' + ext + '>' + t + '</a>';
    });
    return text.replace(/\u0000(\d+)\u0000/g, function (_, i) { return codes[+i]; });
  }

  function splitRow(line) {
    line = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    return line.split(/(?<!\\)\|/).map(function (c) { return c.trim().replace(/\\\|/g, '|'); });
  }

  var LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

  // Список с поддержкой вложенности (по отступу) и нумерации не с единицы.
  function renderList(lines, start) {
    var m0 = LIST_RE.exec(lines[start]);
    var indent = m0[1].length, ordered = /\d/.test(m0[2]);
    var first = ordered ? parseInt(m0[2], 10) : 1;
    var items = [], i = start;
    while (i < lines.length) {
      var m = LIST_RE.exec(lines[i]);
      if (m) {
        var ind = m[1].length;
        if (ind < indent) break;
        if (ind >= indent + 2 && items.length) {
          var sub = renderList(lines, i);
          items[items.length - 1].sub += sub.html;
          i = sub.next;
          continue;
        }
        if (/\d/.test(m[2]) !== ordered) break;
        items.push({ text: m[3], sub: '' });
        i++;
        continue;
      }
      // продолжение пункта (строка с отступом), но не блок кода
      if (/^\s{2,}\S/.test(lines[i]) && items.length && !/^\s*```/.test(lines[i])) {
        items[items.length - 1].text += ' ' + lines[i].trim();
        i++;
        continue;
      }
      break;
    }
    var tag = ordered ? 'ol' : 'ul';
    var attr = ordered && first > 1 ? ' start="' + first + '"' : '';
    return {
      html: '<' + tag + attr + '>' + items.map(function (x) { return '<li>' + inline(x.text) + x.sub + '</li>'; }).join('') + '</' + tag + '>',
      next: i
    };
  }

  function render(src) {
    var lines = (src || '').replace(/\r\n/g, '\n').split('\n');
    var html = [], i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var fence = /^(\s*)```\s*([\w+-]*)\s*$/.exec(line);
      if (fence) {
        var buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        html.push(codeBlock(buf.join('\n'), fence[2]));
        continue;
      }
      if (/^\s*$/.test(line)) { i++; continue; }
      var h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        var lvl = Math.min(6, h[1].length + 1);
        html.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
        i++; continue;
      }
      if (/^(-{3,}|\*{3,})\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
      if (/^>/.test(line)) {
        var q = [];
        while (i < lines.length && /^>/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        var kind = '';
        var first = q[0] || '';
        if (/^\*\*(Важно|Внимание|Ловушка|Осторожно)/i.test(first)) kind = ' warn';
        else if (/^\*\*(Совет|Подсказка|Tip|Попробуйте)/i.test(first)) kind = ' tip';
        else if (/^\*\*(Собеседование|На собеседовании)/i.test(first)) kind = ' interview';
        html.push('<blockquote class="callout' + kind + '">' + render(q.join('\n')) + '</blockquote>');
        continue;
      }
      if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        var t = '<div class="table-wrap"><table><thead><tr>' + head.map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (r) { t += '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>'; });
        html.push(t + '</tbody></table></div>');
        continue;
      }
      if (LIST_RE.test(line)) {
        var list = renderList(lines, i);
        html.push(list.html);
        i = list.next;
        continue;
      }
      var p = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4}\s|>|\s*```|\s*([-*]|\d+\.)\s|\|)/.test(lines[i])) {
        p.push(lines[i]); i++;
      }
      if (!p.length) { p.push(lines[i]); i++; }
      html.push('<p>' + inline(p.join('\n')).replace(/\n/g, ' ') + '</p>');
    }
    return html.join('\n');
  }

  global.MD = { render: render, highlight: highlight, highlightGo: highlightGo, esc: esc, inline: inline, codeBlock: codeBlock };
})(window);
