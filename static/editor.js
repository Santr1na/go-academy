// Простой редактор кода: textarea + подсветка поверх + номера строк.
(function (global) {
  'use strict';

  function Editor(container, opts) {
    opts = opts || {};
    this.onChange = opts.onChange || function () {};
    this.onRun = opts.onRun || function () {};
    this.onCheck = opts.onCheck || function () {};
    this.errLines = {};
    this.lang = opts.lang || 'go';

    container.classList.add('editor');
    container.innerHTML =
      '<div class="ed-gutter" aria-hidden="true"></div>' +
      '<div class="ed-body">' +
      '<pre class="ed-hl" aria-hidden="true"><code></code></pre>' +
      '<textarea class="ed-input" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Редактор кода. Escape — выйти из редактора"></textarea>' +
      '</div>';
    this.el = container;
    this.gutter = container.querySelector('.ed-gutter');
    this.hl = container.querySelector('.ed-hl');
    this.code = this.hl.querySelector('code');
    this.ta = container.querySelector('.ed-input');

    var self = this;
    this.ta.addEventListener('input', function () {
      if (self._hasErr) self.setErrorLines([]); // пометки ошибок устаревают, как только код изменился
      self.refresh();
      self.onChange(self.ta.value);
    });
    this.ta.addEventListener('scroll', function () { self.hl.scrollLeft = self.ta.scrollLeft; self.hl.scrollTop = self.ta.scrollTop; });
    this.ta.addEventListener('keydown', function (e) { self.keydown(e); });
    this.setValue(opts.value || '');
  }

  Editor.prototype.getValue = function () { return this.ta.value; };

  Editor.prototype.setValue = function (v) {
    this.ta.value = v;
    this.refresh();
  };

  Editor.prototype.hasFocus = function () { return document.activeElement === this.ta; };

  // Подсвечивает номера строк, на которые указал компилятор или паника.
  Editor.prototype.setErrorLines = function (lines) {
    var map = {};
    (lines || []).forEach(function (n) { map[n] = true; });
    this.errLines = map;
    this._hasErr = (lines || []).length > 0;
    this._lines = -1; // перерисовать номера
    this.refresh();
  };

  Editor.prototype.refresh = function () {
    var v = this.ta.value;
    // завершающий перевод строки нужен, чтобы высота pre совпадала с textarea
    this.code.innerHTML = MD.highlight(v, this.lang === 'git' ? 'bash' : this.lang) + '\n';
    var n = v.split('\n').length;
    if (n !== this._lines) {
      this._lines = n;
      var s = '';
      for (var i = 1; i <= n; i++) s += (this.errLines[i] ? '<span class="ed-err">' + i + '</span>' : i) + '\n';
      this.gutter.innerHTML = s;
      this.el.style.setProperty('--rows', Math.max(n, 10) + 1);
    }
  };

  function insert(ta, text) {
    // execCommand сохраняет историю Undo; если недоступно — setRangeText.
    ta.focus();
    if (!document.execCommand || !document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }

  Editor.prototype.keydown = function (e) {
    var ta = this.ta;
    var mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) this.onCheck(); else this.onRun();
      return;
    }
    if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы')) {
      e.preventDefault(); // привычное «сохранить» запускает проверку, а не диалог браузера
      this.onCheck();
      return;
    }
    if (e.key === 'Escape') { ta.blur(); return; } // Tab занят отступами — выход с клавиатуры через Escape
    if (e.key === 'Tab' && !mod && !e.altKey) {
      e.preventDefault();
      var start = ta.selectionStart, end = ta.selectionEnd, v = ta.value;
      if (start === end && !e.shiftKey) { insert(ta, '\t'); return; }
      // отступ/снятие отступа у выделенных строк
      var ls = v.lastIndexOf('\n', start - 1) + 1;
      var block = v.slice(ls, end);
      var changed = e.shiftKey
        ? block.split('\n').map(function (l) { return l.replace(/^(\t| {1,4})/, ''); }).join('\n')
        : block.split('\n').map(function (l) { return '\t' + l; }).join('\n');
      ta.setSelectionRange(ls, end);
      insert(ta, changed);
      ta.setSelectionRange(ls, ls + changed.length);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing) {
      e.preventDefault();
      var pos = ta.selectionStart, val = ta.value;
      var lineStart = val.lastIndexOf('\n', pos - 1) + 1;
      var line = val.slice(lineStart, pos);
      var indent = /^[\t ]*/.exec(line)[0];
      var before = line.trimEnd();
      var after = val.slice(ta.selectionEnd);
      var opener = /[{(\[]$/.test(before);
      if (opener && /^[}\])]/.test(after)) {
        insert(ta, '\n' + indent + '\t\n' + indent);
        var p = ta.selectionStart - indent.length - 1;
        ta.setSelectionRange(p, p);
      } else {
        insert(ta, '\n' + indent + (opener ? '\t' : ''));
      }
      return;
    }
    if (e.key === '}' && !mod) {
      // автоматически убираем один уровень отступа перед закрывающей скобкой
      var s = ta.selectionStart, vv = ta.value;
      var ls2 = vv.lastIndexOf('\n', s - 1) + 1;
      var cur = vv.slice(ls2, s);
      if (/^\t+$/.test(cur) && ta.selectionStart === ta.selectionEnd) {
        e.preventDefault();
        ta.setSelectionRange(s - 1, s);
        insert(ta, '}');
      }
    }
  };

  global.Editor = Editor;
})(window);
