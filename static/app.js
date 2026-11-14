// Go Academy — одностраничное приложение (vanilla JS, hash-роутинг).
(function () {
  'use strict';

  var LS_KEY = 'goacademy.progress';
  var TRACK_KEY = 'goacademy.track';
  var CARD_XP = 10;                 // XP за вопрос собеседования с оценкой «знаю» (половина — за «частично»)
  var QUIZ_XP = 10;                 // XP за верный ответ в тесте
  var HINT_PENALTY = 0.15;          // штраф за каждую подсказку (доля XP задачи)
  var SOLUTION_FACTOR = 0.25;       // доля XP, если решение было подсмотрено
  var SOLUTION_AFTER = 3;           // после стольких неудачных проверок можно открыть решение
  var RANKS = [
    { name: 'Новичок', f: 0, icon: '🌱' },
    { name: 'Junior', f: 0.15, icon: '🐣' },
    { name: 'Middle', f: 0.40, icon: '⚙️' },
    { name: 'Senior', f: 0.70, icon: '🚀' },
    { name: 'Expert', f: 0.90, icon: '🏆' }
  ];

  var S = {
    tracks: [],        // все курсы: {id, title, short, lang, modules, stats, flat}
    track: null,       // выбранный курс
    course: null,      // то же, что track (модули выбранного курса)
    flat: [],          // уроки по порядку: {id, title, xp, minutes, quizCount, tasks, module, index}
    byId: {},
    lessons: {},       // кэш полных уроков
    p: null,           // прогресс
    collapsed: {},
    active: null,      // id открытого урока
    refreshers: { view: [], tab: [] }, // функции, обновляющие экран после изменения прогресса извне
    health: null
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = MD.esc;

  // ------------------------------------------------------------------ Иконки
  var ICONS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sliders: '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    undo: '<path d="M4 8h10a5 5 0 0 1 0 10H8"/><path d="M7 5L4 8l3 3"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M9 8h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h0"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h0"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    terminal: '<path d="M4 6l6 6-6 6M12 18h8"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>'
  };
  function icon(name, size) {
    size = size || 18;
    return '<svg class="ic" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  function ring(pct, cls, size) {
    // круговой индикатор: длина окружности r=15.9155 равна 100 — процент можно писать напрямую
    var v = Math.max(0, Math.min(100, pct));
    return '<svg class="ring ' + (cls || '') + '" viewBox="0 0 36 36" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<circle class="ring-bg" cx="18" cy="18" r="15.9155"/>' +
      '<circle class="ring-fg" cx="18" cy="18" r="15.9155" stroke-dasharray="' + v.toFixed(1) + ' 100"/></svg>';
  }

  // ------------------------------------------------------------------ Мелкие помощники
  function plural(n, forms) {
    var a = Math.abs(n) % 100, b = a % 10;
    return forms[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
  }
  function fmtMinutes(min) {
    if (min < 60) return min + ' мин';
    var h = Math.round(min / 30) / 2;
    return String(h).replace('.', ',') + ' ч';
  }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }

  function api(path, body) {
    var opts = body === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    };
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    }, function () {
      throw new Error('Сервер не отвечает. Проверьте, что он запущен (go run . в папке go-academy), и попробуйте снова.');
    });
  }

  // ------------------------------------------------------------------ Прогресс
  //
  // Прогресс хранится в трёх местах: в памяти вкладки (S.p), в localStorage
  // браузера и в файле на сервере. Копии объединяются по каждому элементу
  // (а не «кто новее — тот и прав»): решённая задача или пройденный урок
  // никогда не теряются, код задачи берётся самый свежий. Поэтому ни вторая
  // вкладка, ни другой браузер, ни очистка хранилища не затирают прогресс.
  function emptyProgress() {
    return {
      version: 2,
      epoch: 0,          // растёт при сбросе/импорте: состояние с меньшим epoch отбрасывается целиком
      updatedAt: 0,
      lessons: {},       // id → {completed, completedAt}
      quiz: {},          // id урока → {answers: {номер: вариант}, correct, t}
      tasks: {},         // id → {solved, solvedAt, hintsUsed, attempts, solutionShown, xp, code, ct}
      cards: {},         // id вопроса собеседования → {g: 1 не знал | 2 частично | 3 знаю, n: сколько раз отвечал, a: свой ответ, t}
      settings: { theme: 'auto', freeMode: false, t: 0 },
      lastLesson: null,
      lastAt: 0,
      xp: 0,
      level: RANKS[0].name
    };
  }

  // normalize возвращает новую, полностью проверенную копию прогресса.
  function normalize(p) {
    var r = emptyProgress();
    if (!isObj(p)) return r;
    r.epoch = num(p.epoch);
    r.updatedAt = num(p.updatedAt);
    if (isObj(p.lessons)) Object.keys(p.lessons).forEach(function (id) {
      var l = p.lessons[id];
      if (isObj(l) && l.completed) r.lessons[id] = { completed: true, completedAt: num(l.completedAt) };
    });
    if (isObj(p.quiz)) Object.keys(p.quiz).forEach(function (id) {
      var q = p.quiz[id];
      if (!isObj(q)) return;
      var answers = {};
      if (isObj(q.answers)) Object.keys(q.answers).forEach(function (k) {
        if (typeof q.answers[k] === 'number') answers[k] = q.answers[k];
      });
      r.quiz[id] = { answers: answers, correct: num(q.correct), t: num(q.t) };
    });
    if (isObj(p.tasks)) Object.keys(p.tasks).forEach(function (id) {
      var t = p.tasks[id];
      if (!isObj(t)) return;
      r.tasks[id] = {
        solved: !!t.solved, solvedAt: num(t.solvedAt), hintsUsed: num(t.hintsUsed), attempts: num(t.attempts),
        solutionShown: !!t.solutionShown, xp: num(t.xp), code: typeof t.code === 'string' ? t.code : null, ct: num(t.ct)
      };
    });
    if (isObj(p.cards)) Object.keys(p.cards).forEach(function (id) {
      var c = p.cards[id];
      if (!isObj(c)) return;
      r.cards[id] = { g: [1, 2, 3].indexOf(c.g) >= 0 ? c.g : 0, n: num(c.n), a: typeof c.a === 'string' ? c.a.slice(0, 4000) : '', t: num(c.t) };
    });
    if (isObj(p.settings)) {
      if (['auto', 'dark', 'light'].indexOf(p.settings.theme) >= 0) r.settings.theme = p.settings.theme;
      r.settings.freeMode = !!p.settings.freeMode;
      r.settings.t = num(p.settings.t);
    }
    r.lastLesson = typeof p.lastLesson === 'string' ? p.lastLesson : null;
    r.lastAt = num(p.lastAt);
    return r;
  }

  function answered(q) { return Object.keys(q.answers).length; }

  // mergeInto вливает чужую копию прогресса в t, не заменяя уже существующие
  // объекты (на них ссылаются открытые редакторы и тесты).
  // Возвращает false (ничего не изменилось), true или 'replaced' (t заменён целиком).
  function mergeInto(t, src) {
    var s = normalize(src);
    if (s.epoch < t.epoch) return false;
    if (s.epoch > t.epoch) {
      ['lessons', 'quiz', 'tasks', 'cards'].forEach(function (k) { t[k] = s[k]; });
      t.settings.theme = s.settings.theme; t.settings.freeMode = s.settings.freeMode; t.settings.t = s.settings.t;
      t.epoch = s.epoch; t.updatedAt = s.updatedAt; t.lastLesson = s.lastLesson; t.lastAt = s.lastAt;
      return 'replaced';
    }
    var changed = false;
    // У данных старого формата нет отметок времени по элементам. При равных
    // отметках верим той копии, которая в целом новее.
    var srcNewer = s.updatedAt > t.updatedAt;
    Object.keys(s.lessons).forEach(function (id) {
      if (!t.lessons[id]) { t.lessons[id] = s.lessons[id]; changed = true; }
    });
    Object.keys(s.quiz).forEach(function (id) {
      var a = t.quiz[id], b = s.quiz[id];
      if (!a) { t.quiz[id] = b; changed = true; return; }
      var newer = b.t > a.t || (b.t === a.t && (answered(b) > answered(a) || (answered(b) === answered(a) && b.correct > a.correct)));
      if (newer) { a.answers = b.answers; a.correct = b.correct; a.t = b.t; changed = true; }
    });
    Object.keys(s.tasks).forEach(function (id) {
      var a = t.tasks[id], b = s.tasks[id];
      if (!a) { t.tasks[id] = b; changed = true; return; }
      var before = JSON.stringify(a);
      if (b.ct > a.ct) { a.code = b.code; a.ct = b.ct; }             // свежий код побеждает (в том числе «сброшен к исходному»)
      else if (b.ct === a.ct && (a.code === null || (srcNewer && b.code !== null))) a.code = b.code;
      if (b.solved) {
        if (!a.solved) { a.solved = true; a.xp = b.xp; a.solvedAt = b.solvedAt; }
        else { a.xp = Math.max(a.xp, b.xp); if (b.solvedAt && (!a.solvedAt || b.solvedAt < a.solvedAt)) a.solvedAt = b.solvedAt; }
      }
      a.hintsUsed = Math.max(a.hintsUsed, b.hintsUsed);
      a.attempts = Math.max(a.attempts, b.attempts);
      a.solutionShown = a.solutionShown || b.solutionShown;
      if (JSON.stringify(a) !== before) changed = true;
    });
    Object.keys(s.cards).forEach(function (id) {
      var a = t.cards[id], b = s.cards[id];
      if (!a) { t.cards[id] = b; changed = true; return; }
      if (b.t > a.t || (b.t === a.t && srcNewer && (b.g !== a.g || b.a !== a.a))) { a.g = b.g; a.n = Math.max(a.n, b.n); a.a = b.a; a.t = b.t; changed = true; }
    });
    if (s.settings.t > t.settings.t || (s.settings.t === t.settings.t && srcNewer && (s.settings.theme !== t.settings.theme || s.settings.freeMode !== t.settings.freeMode))) {
      t.settings.theme = s.settings.theme; t.settings.freeMode = s.settings.freeMode; t.settings.t = s.settings.t;
      changed = true;
    }
    if (s.lastAt > t.lastAt || (s.lastAt === t.lastAt && srcNewer && s.lastLesson && s.lastLesson !== t.lastLesson)) {
      t.lastLesson = s.lastLesson; t.lastAt = s.lastAt; changed = true;
    }
    if (s.updatedAt > t.updatedAt) t.updatedAt = s.updatedAt;
    return changed;
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; }
  }
  function writeLocal() {
    S.p.xp = totalXP();
    S.p.level = rankFor(S.p.xp).cur.name;
    try { localStorage.setItem(LS_KEY, JSON.stringify(S.p)); } catch (e) { /* хранилище недоступно или переполнено — остаётся сервер */ }
  }
  // persist записывает прогресс в localStorage, предварительно подмешав то,
  // что могла записать туда другая вкладка.
  function persist() {
    var other = readLocal();
    if (other) {
      var ch = mergeInto(S.p, other);
      if (ch) afterExternalChange(ch);
    }
    writeLocal();
  }

  // ---- синхронизация с сервером
  var sync = { rev: null, loaded: false, dirty: false, inflight: false, timer: null, fails: 0, conflicts: 0, snapshot: false, state: 'init', lastPull: 0 };

  function setSync(state) {
    if (sync.state === state) return;
    sync.state = state;
    renderSync();
  }
  function renderSync() {
    var box = $('#syncBox');
    if (!box) return;
    var text = {
      init: 'Синхронизация…',
      ok: 'Прогресс сохранён',
      saving: 'Сохраняю…',
      offline: 'Нет связи с сервером — прогресс пока хранится только в этом браузере'
    }[sync.state];
    box.className = 'sync ' + sync.state;
    box.innerHTML = '<span class="sync-dot"></span><span>' + text + '</span>';
  }

  // pull читает прогресс с сервера и запоминает его ревизию.
  function pull() {
    return fetch('/api/progress', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      if (!d || typeof d.rev !== 'string') throw new Error('неожиданный ответ сервера');
      sync.rev = d.rev;
      sync.loaded = true;
      sync.lastPull = Date.now();
      return d.progress;
    });
  }

  function schedulePush(ms) {
    clearTimeout(sync.timer);
    sync.timer = setTimeout(push, ms);
  }

  // push отправляет прогресс на сервер. Сервер принимает запись, только если мы
  // видели его актуальную версию; иначе присылает свою — объединяем и повторяем.
  // Пока состояние сервера ни разу не прочитано, ничего не отправляем: так
  // браузер с очищенным хранилищем не может затереть сохранённый прогресс.
  function push() {
    clearTimeout(sync.timer);
    sync.timer = null;
    if (sync.inflight) return; // по завершении текущей отправки dirty будет проверен снова
    sync.inflight = true;
    var ready = sync.loaded ? Promise.resolve() : pull().then(function (srv) {
      var ch = mergeInto(S.p, srv);
      writeLocal();
      if (ch) afterExternalChange(ch);
    });
    ready.then(function () {
      if (!sync.dirty) return 'ok';
      sync.dirty = false;
      var snap = sync.snapshot;
      sync.snapshot = false;
      setSync('saving');
      writeLocal();
      return fetch('/api/progress?base=' + encodeURIComponent(sync.rev) + (snap ? '&snapshot=1' : ''), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S.p)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.status === 200 && d.rev) { sync.rev = d.rev; return 'ok'; }
          if (r.status === 409 && d.rev) {
            sync.rev = d.rev;
            if (snap) sync.snapshot = true;
            var ch = mergeInto(S.p, d.progress);
            writeLocal();
            if (ch) afterExternalChange(ch);
            sync.dirty = true;
            return 'conflict';
          }
          throw new Error(d.error || ('HTTP ' + r.status));
        });
      });
    }).then(function (res) {
      sync.inflight = false;
      sync.fails = 0;
      sync.conflicts = res === 'conflict' ? sync.conflicts + 1 : 0;
      if (sync.dirty) schedulePush(res === 'conflict' ? (sync.conflicts > 5 ? 5000 : 0) : 300);
      else setSync('ok');
    }).catch(function () {
      sync.inflight = false;
      sync.fails++;
      setSync('offline');
      schedulePush(Math.min(30000, 2000 * sync.fails)); // сервер недоступен — пробуем снова, прогресс цел в браузере
    });
  }

  // save — единственная точка, через которую проходят изменения прогресса.
  function save(immediate) {
    S.p.updatedAt = Date.now();
    persist();
    sync.dirty = true;
    schedulePush(immediate ? 0 : 800);
  }

  // Прогресс изменился не в этой вкладке (другая вкладка, другой браузер).
  function afterExternalChange(kind) {
    if (!S.course) return;
    applyTheme();
    if (kind === 'replaced') { lastRank = null; renderRank(); route(); return; }
    refreshUI();
  }
  function refreshUI() {
    renderRank();
    renderSidebar(S.active);
    S.refreshers.view.concat(S.refreshers.tab).forEach(function (f) { f(); });
  }

  window.addEventListener('storage', function (e) {
    if (!S.p || !S.course || (e.key !== null && e.key !== LS_KEY)) return;
    if (!e.newValue) { writeLocal(); return; } // хранилище очистили при открытой вкладке — возвращаем прогресс на место
    var incoming;
    try { incoming = JSON.parse(e.newValue); } catch (err) { return; }
    var ch = mergeInto(S.p, incoming);
    if (ch) afterExternalChange(ch);
  });

  // При уходе со страницы сохраняем всё, что ещё не успело сохраниться.
  window.addEventListener('pagehide', function () {
    if (!S.p || !S.course) return;
    writeLocal();
    if (sync.dirty && sync.loaded && !sync.inflight && navigator.sendBeacon) {
      clearTimeout(sync.timer);
      navigator.sendBeacon('/api/progress?base=' + encodeURIComponent(sync.rev), new Blob([JSON.stringify(S.p)], { type: 'application/json' }));
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (!S.p || !S.course) return;
    if (document.visibilityState === 'hidden') {
      writeLocal();
      if (sync.dirty) push();
      return;
    }
    // вкладку снова открыли: подтягиваем изменения, сделанные в другом браузере
    if (sync.dirty || sync.inflight || Date.now() - sync.lastPull < 10000) return;
    var prev = sync.rev;
    pull().then(function (srv) {
      if (sync.rev === prev) return;
      var ch = mergeInto(S.p, srv);
      writeLocal();
      if (ch) afterExternalChange(ch);
    }).catch(function () { setSync('offline'); schedulePush(2000); });
  });

  function taskState(id) {
    if (!S.p.tasks[id]) S.p.tasks[id] = { solved: false, solvedAt: 0, hintsUsed: 0, attempts: 0, solutionShown: false, xp: 0, code: null, ct: 0 };
    return S.p.tasks[id];
  }
  function quizState(id) {
    if (!S.p.quiz[id]) S.p.quiz[id] = { answers: {}, correct: 0, t: 0 };
    return S.p.quiz[id];
  }
  function isDone(lessonId) { return !!(S.p.lessons[lessonId] && S.p.lessons[lessonId].completed); }
  function hasSolved(l) { return l.tasks.some(function (t) { return (S.p.tasks[t.id] || {}).solved; }); }
  function isUnlocked(lessonId) {
    if (S.p.settings.freeMode) return true;
    var l = S.byId[lessonId];
    if (!l) return false;
    if (l.track.free || l.index === 0 || isDone(lessonId)) return true;
    var flat = l.track.flat;
    var prev = flat[l.index - 1];
    if (isDone(prev.id)) return true;
    // вводный модуль необязателен: модуль после него открыт сразу
    if (prev.module !== l.module && prev.module.optional) return true;
    // урок, до которого уже доходили (например, перед ним позже добавили новые уроки)
    if (hasSolved(l)) return true;
    for (var i = l.index + 1; i < flat.length; i++) if (isDone(flat[i].id) || hasSolved(flat[i])) return true;
    return false;
  }
  function cardState(id) {
    if (!S.p.cards[id]) S.p.cards[id] = { g: 0, n: 0, a: '', t: 0 };
    return S.p.cards[id];
  }
  // Оценки вопросов собеседований по урокам: {idУрока: {known, partial, seen}}.
  function cardStats() {
    var out = {};
    Object.keys(S.p.cards).forEach(function (id) {
      var c = S.p.cards[id], lid = id.split(':')[0];
      if (!c.g) return;
      var o = out[lid] || (out[lid] = { known: 0, partial: 0, seen: 0 });
      o.seen++;
      if (c.g === 3) o.known++; else if (c.g === 2) o.partial++;
    });
    return out;
  }
  function cardXP(l, cs) {
    var o = cs[l.id];
    if (!o || !l.cardCount) return 0;
    return Math.min(l.cardCount * CARD_XP, o.known * CARD_XP + o.partial * CARD_XP / 2);
  }
  function lessonStatus(id) { return isDone(id) ? 'done' : isUnlocked(id) ? 'open' : 'locked'; }
  function moduleStatus(m) {
    if (m.lessons.every(function (l) { return isDone(l.id); })) return 'done';
    return m.lessons.some(function (l) { return isUnlocked(l.id); }) ? 'open' : 'locked';
  }

  function maxXP(flat) {
    var x = 0;
    (flat || S.flat).forEach(function (l) {
      x += l.xp + l.quizCount * QUIZ_XP + (l.cardCount || 0) * CARD_XP;
      l.tasks.forEach(function (t) { x += t.xp; });
    });
    return x || 1;
  }
  function totalXP(flat) {
    var x = 0, cs = cardStats();
    (flat || S.flat).forEach(function (l) {
      if (isDone(l.id)) x += l.xp;
      x += cardXP(l, cs);
      var q = S.p.quiz[l.id];
      if (q) x += Math.min(q.correct || 0, l.quizCount) * QUIZ_XP;
      l.tasks.forEach(function (t) { var s = S.p.tasks[t.id]; if (s && s.solved) x += s.xp || 0; });
    });
    return x;
  }
  function rankFor(xp) {
    var max = maxXP(), frac = xp / max, i = 0;
    for (var k = 0; k < RANKS.length; k++) if (frac >= RANKS[k].f) i = k;
    var cur = RANKS[i], next = RANKS[i + 1];
    var from = Math.round(cur.f * max), to = next ? Math.round(next.f * max) : max;
    var pct = next ? (xp - from) / Math.max(1, to - from) : Math.min(1, xp / max);
    return { cur: cur, next: next, idx: i, pct: Math.max(0, Math.min(1, pct)), toNext: next ? Math.max(0, to - xp) : 0, max: max };
  }
  function earnedXP(task, st) {
    var base = task.xp, floor = Math.round(base * SOLUTION_FACTOR);
    if (st.solutionShown) return floor;
    return Math.max(floor, base - Math.round(base * HINT_PENALTY) * st.hintsUsed);
  }

  // ------------------------------------------------------------------ Общие элементы интерфейса
  function toast(html, kind, ms) {
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.setAttribute('role', 'status');
    t.innerHTML = html;
    $('#toasts').appendChild(t);
    setTimeout(function () { t.classList.add('hide'); setTimeout(function () { t.remove(); }, 350); }, ms || 3200);
  }
  function applyTheme() {
    var t = S.p.settings.theme;
    if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    var b = $('#themeBtn');
    if (b) b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 20);
  }
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (S.p) applyTheme(); });

  var lastRank = null;
  function renderRank() {
    var xp = totalXP(), r = rankFor(xp);
    $('#rankName').textContent = r.cur.name;
    $('#rankIcon').textContent = r.cur.icon;
    $('#rankXP').textContent = xp + ' XP';
    $('#rankRing').setAttribute('stroke-dasharray', (r.pct * 100).toFixed(1) + ' 100');
    $('#rankBox').title = r.next ? ('До ранга ' + r.next.name + ': ' + r.toNext + ' XP') : 'Максимальный ранг!';
    if (lastRank !== null && r.idx > lastRank) toast('🎉 Новый ранг: <b>' + r.cur.name + '</b>!', 'xp', 5000);
    lastRank = r.idx;
  }

  // ------------------------------------------------------------------ Курсы
  function trackPct(t) { return Math.round(totalXP(t.flat) / maxXP(t.flat) * 100); }
  function setTrack(id, silent) {
    var t = S.tracks.filter(function (x) { return x.id === id; })[0] || S.tracks[0];
    if (S.track === t) return;
    S.track = t; S.course = t; S.flat = t.flat;
    S.collapsed = {};
    lastRank = null;
    try { localStorage.setItem(TRACK_KEY, t.id); } catch (e) { /* не страшно */ }
    $('#logoMark').textContent = t.short;
    document.title = t.title + ' — Academy';
    renderTrackSwitch();
    if (!silent) renderRank();
  }
  function trackMenuHTML() {
    return S.tracks.map(function (t) {
      return '<a class="track-item' + (t === S.track ? ' on' : '') + '" href="#/track/' + t.id + '"><span class="track-emoji">' + t.icon + '</span>' +
        '<span class="track-item-body"><b>' + esc(t.title) + '</b><small>' + t.flat.length + ' ' + plural(t.flat.length, ['урок', 'урока', 'уроков']) + ' · пройдено ' + trackPct(t) + '%</small></span></a>';
    }).join('');
  }
  function renderTrackSwitch() {
    var box = $('#trackSwitch');
    box.innerHTML = '<button class="track-btn" id="trackBtn" aria-haspopup="true" aria-expanded="false" title="Выбрать курс">' +
      '<span class="track-emoji">' + S.track.icon + '</span><span class="track-name">' + esc(S.track.title) + '</span>' + icon('chevron', 14) + '</button>' +
      '<div class="track-menu" id="trackMenu" hidden></div>';
    var btn = $('#trackBtn'), menu = $('#trackMenu');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) menu.innerHTML = trackMenuHTML(); // свежие проценты
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
  }
  document.addEventListener('click', function () { var m = $('#trackMenu'); if (m) m.hidden = true; });

  function renderSidebar(activeId) {
    var html = '';
    var activeModule = activeId && S.byId[activeId] ? S.byId[activeId].module.id : null;
    S.course.modules.forEach(function (m, mi) {
      var ms = moduleStatus(m);
      var done = m.lessons.filter(function (l) { return isDone(l.id); }).length;
      var collapsed = S.collapsed[m.id] !== undefined ? S.collapsed[m.id] : (activeModule ? m.id !== activeModule : ms !== 'open');
      html += '<div class="side-module ' + ms + (collapsed ? ' collapsed' : '') + '" data-mod="' + m.id + '">' +
        '<button class="side-module-title" aria-expanded="' + (!collapsed) + '">' +
        '<span class="mod-mark ' + ms + '">' + (ms === 'done' ? icon('check', 14) : ms === 'locked' ? icon('lock', 13) : (mi + 1)) + '</span>' +
        '<span class="mod-title">' + esc(m.title) + '</span><span class="count">' + done + '/' + m.lessons.length + '</span>' +
        '<span class="chev">' + icon('chevron', 14) + '</span></button><ul class="side-lessons">';
      m.lessons.forEach(function (l) {
        var st = lessonStatus(l.id);
        var mark = '<span class="st ' + st + '">' + (st === 'done' ? icon('check', 13) : st === 'locked' ? icon('lock', 12) : '') + '</span>';
        var cls = 'side-lesson ' + st + (l.id === activeId ? ' active' : '');
        if (st === 'locked') html += '<li class="' + cls + '"><span class="lk">' + mark + '<span>' + esc(l.title) + '</span></span></li>';
        else html += '<li class="' + cls + '"><a href="#/lesson/' + l.id + '"' + (l.id === activeId ? ' aria-current="page"' : '') + '>' + mark + '<span>' + esc(l.title) + '</span></a></li>';
      });
      html += '</ul></div>';
    });
    var sb = $('#sidebar');
    sb.innerHTML = html;
    $$('.side-module-title', sb).forEach(function (b) {
      b.addEventListener('click', function () {
        var box = b.parentElement, id = box.dataset.mod;
        box.classList.toggle('collapsed');
        S.collapsed[id] = box.classList.contains('collapsed');
        b.setAttribute('aria-expanded', String(!S.collapsed[id]));
      });
    });
  }

  // Следующий урок: первый непройденный после самого дальнего места, куда дошёл
  // ученик. Тот, кто пропустил вводный модуль, не возвращается к нему кнопкой «Продолжить».
  function nextLesson() {
    var far = -1, i;
    S.flat.forEach(function (l, idx) { if (isDone(l.id) || hasSolved(l)) far = idx; });
    for (i = Math.max(0, far); i < S.flat.length; i++) if (!isDone(S.flat[i].id) && isUnlocked(S.flat[i].id)) return S.flat[i];
    for (i = 0; i < far; i++) {
      var l = S.flat[i];
      if (!isDone(l.id) && isUnlocked(l.id) && !l.module.optional) return l;
    }
    return null;
  }
  function setView(activeLesson) {
    S.active = activeLesson || null;
    S.refreshers.view = [];
    S.refreshers.tab = [];
  }

  // ------------------------------------------------------------------ Главная
  function viewDashboard() {
    setView(null);
    S.refreshers.view.push(viewDashboard);
    var xp = totalXP(), r = rankFor(xp);
    var lessonsDone = S.flat.filter(function (l) { return isDone(l.id); }).length;
    var tasksAll = 0, tasksDone = 0, qAll = 0, qOk = 0, minLeft = 0;
    S.flat.forEach(function (l) {
      qAll += l.quizCount; qOk += Math.min(l.quizCount, (S.p.quiz[l.id] || {}).correct || 0);
      l.tasks.forEach(function (t) { tasksAll++; if ((S.p.tasks[t.id] || {}).solved) tasksDone++; });
      if (!isDone(l.id)) minLeft += l.minutes || 0;
    });
    var nl = nextLesson();
    var cont = S.p.lastLesson && S.byId[S.p.lastLesson] && !isDone(S.p.lastLesson) && isUnlocked(S.p.lastLesson) ? S.byId[S.p.lastLesson] : nl;
    var started = lessonsDone > 0 || tasksDone > 0 || qOk > 0;
    var pct = Math.round(xp / r.max * 100);
    var cardsAll = 0, cardsKnown = 0, cst = cardStats();
    S.flat.forEach(function (l) { cardsAll += l.cardCount || 0; cardsKnown += (cst[l.id] || {}).known || 0; });
    started = started || cardsKnown > 0;
    var T = S.track;
    var heroTitle = esc(T.hero).replace(/(Senior|Junior|оффера|работы|собеседовани[ея])/, '<span class="grad">$1</span>');
    var firstOptional = S.course.modules[0] && S.course.modules[0].optional ? S.course.modules[0] : null;
    var afterOptional = firstOptional ? S.course.modules[1] : null;

    var h = '<section class="hero card">' +
      '<div class="hero-main"><div class="eyebrow">' + (cardsAll && !tasksAll ? 'Тренажёр' : 'Интерактивный курс') + ' · ' + esc(T.title) + '</div>' +
      '<h1>' + heroTitle + '</h1>' +
      '<p class="lead">' + esc(T.lead || T.description) + '</p>' +
      '<div class="hero-cta">' +
      (cardsAll && !tasksAll ? '<a class="btn primary lg" href="#/drill"><span>Тренировка: 10 вопросов</span>' + icon('arrowRight', 18) + '</a>' : '') +
      (cont ? '<a class="btn ' + (cardsAll && !tasksAll ? '' : 'primary ') + 'lg" href="#/lesson/' + cont.id + '"><span>' + (cardsAll && !tasksAll ? 'По темам' : started ? 'Продолжить' : 'Начать обучение') + '</span>' + icon('arrowRight', 18) + '</a>' +
        '<div class="hero-next"><span class="muted">' + (started ? 'Следующий урок' : 'Первый урок') + '</span><b>' + esc(cont.title) + '</b></div>'
        : '<p class="done-note">🏆 Курс пройден полностью!' + (tasksAll ? ' Загляните в <a href="#/interview">задачи с собеседований</a>.' : '') + '</p>') +
      '</div>' +
      (!started && afterOptional ? '<p class="hero-skip">' + icon('info', 16) + '<span>Уже программировали на другом языке? Вводный модуль можно пропустить и ' +
        '<a href="#/lesson/' + afterOptional.lessons[0].id + '">начать с модуля «' + esc(afterOptional.title) + '»</a>.</span></p>' : '') +
      '</div>' +
      '<div class="hero-side"><div class="ring-wrap">' + ring(pct, 'big', 148) +
      '<div class="ring-label"><b>' + pct + '%</b><span>курса</span></div></div>' +
      '<div class="hero-side-text">' + (minLeft > 0 ? 'Осталось примерно <b>' + fmtMinutes(minLeft) + '</b>' : 'Все уроки пройдены') + '</div></div>' +
      '</section>' +

      '<section class="stats">' +
      stat('book', lessonsDone, S.flat.length, cardsAll && !tasksAll ? 'тем закрыто' : 'уроков пройдено') +
      (tasksAll ? stat('code', tasksDone, tasksAll, 'задач решено') : '') +
      (qAll ? stat('help', qOk, qAll, 'верных ответов') : '') +
      (cardsAll ? stat('target', cardsKnown, cardsAll, 'вопросов знаю уверенно') : '') +
      stat('zap', xp, r.max, 'XP набрано') +
      '</section>' +

      '<section class="card ranks-card"><div class="ranks-head"><div><div class="eyebrow">Ваш ранг</div>' +
      '<div class="rank-big">' + r.cur.icon + ' ' + r.cur.name + '</div></div>' +
      '<div class="muted">' + (r.next ? 'До ранга <b>' + r.next.name + '</b> — ' + r.toNext + ' XP' : 'Вы достигли вершины!') + '</div></div>' +
      '<ol class="ladder">' + RANKS.map(function (x, i) {
        var cls = i < r.idx ? 'past' : i === r.idx ? 'cur' : '';
        var fill = i < r.idx ? 100 : i === r.idx ? r.pct * 100 : 0;
        return '<li class="' + cls + '"><span class="ladder-dot">' + x.icon + '</span><span class="ladder-name">' + x.name + '</span>' +
          (i < RANKS.length - 1 ? '<span class="ladder-bar"><span style="width:' + fill.toFixed(1) + '%"></span></span>' : '') + '</li>';
      }).join('') + '</ol></section>' +

      '<h2 class="section-title">Все курсы</h2><div class="tracks-grid">' + S.tracks.map(function (t) {
        var p = trackPct(t);
        return '<a class="card track-card' + (t === S.track ? ' on' : '') + '" href="#/track/' + t.id + '"><span class="track-card-top"><span class="mod-emoji">' + t.icon + '</span>' +
          '<span class="track-card-title"><b>' + esc(t.title) + '</b><small>' + t.modules.length + ' ' + plural(t.modules.length, ['модуль', 'модуля', 'модулей']) + ' · ' + t.flat.length + ' ' + plural(t.flat.length, ['урок', 'урока', 'уроков']) + '</small></span>' +
          (t === S.track ? '<span class="badge soft">открыт</span>' : '') + '</span>' +
          '<span class="mod-desc">' + esc(t.description) + '</span>' +
          '<span class="mod-meta"><span class="bar"><span style="width:' + p + '%"></span></span><span class="mod-count">' + p + '%</span></span></a>';
      }).join('') + '</div>' +

      '<h2 class="section-title">' + (cardsAll && !tasksAll ? 'Темы' : 'Карта курса') + '</h2><ol class="path">';

    S.course.modules.forEach(function (m, mi) {
      var ms = moduleStatus(m);
      var done = m.lessons.filter(function (l) { return isDone(l.id); }).length;
      var first = m.lessons.filter(function (l) { return !isDone(l.id) && isUnlocked(l.id); })[0] || m.lessons[0];
      var minutes = m.lessons.reduce(function (a, l) { return a + (l.minutes || 0); }, 0);
      var tasks = m.lessons.reduce(function (a, l) { return a + l.tasks.length; }, 0);
      var inner = '<span class="mod-emoji">' + (m.icon || '📘') + '</span>' +
        '<span class="mod-body"><span class="mod-top"><span class="mod-num">Модуль ' + (mi + 1) + '</span>' +
        (m.optional ? '<span class="badge soft">для новичков · можно пропустить</span>' : '') +
        (ms === 'done' ? '<span class="badge done">пройден</span>' : '') + '</span>' +
        '<span class="mod-name">' + esc(m.title) + '</span><span class="mod-desc">' + esc(m.description) + '</span>' +
        '<span class="mod-meta"><span class="bar"><span style="width:' + (done / m.lessons.length * 100) + '%"></span></span>' +
        '<span class="mod-count">' + done + ' из ' + m.lessons.length + ' ' + plural(m.lessons.length, ['урока', 'уроков', 'уроков']) + ' · ' + (tasks ? tasks + ' ' + plural(tasks, ['задача', 'задачи', 'задач']) + ' · ' : '') + '≈ ' + fmtMinutes(minutes) + '</span></span></span>' +
        '<span class="mod-go">' + (ms === 'locked' ? icon('lock', 18) : icon('chevron', 20)) + '</span>';
      h += '<li class="path-item ' + ms + '"><span class="path-node">' + (ms === 'done' ? icon('check', 16) : ms === 'locked' ? icon('lock', 14) : (mi + 1)) + '</span>' +
        (ms === 'locked'
          ? '<div class="card path-card" title="Откроется после предыдущего модуля">' + inner + '</div>'
          : '<a class="card path-card" href="#/lesson/' + first.id + '">' + inner + '</a>') + '</li>';
    });
    h += '</ol>';
    $('#main').innerHTML = h;
    renderSidebar(null);
  }
  function stat(ic, val, total, label) {
    return '<div class="stat"><span class="stat-ic">' + icon(ic, 18) + '</span><div><b>' + val + '<small> / ' + total + '</small></b><span>' + label + '</span></div></div>';
  }

  // ------------------------------------------------------------------ Настройки
  function viewSettings() {
    setView(null);
    S.refreshers.view.push(viewSettings);
    var t = S.p.settings.theme;
    var seg = function (v, label) { return '<button data-theme-set="' + v + '" class="' + (t === v ? 'on' : '') + '" aria-pressed="' + (t === v) + '">' + label + '</button>'; };
    var syncText = {
      ok: '<span class="ok-text">синхронизировано</span>', saving: 'сохраняется…', init: 'синхронизация…',
      offline: '<span class="warn-text">сервер недоступен, изменения ждут в браузере</span>'
    }[sync.state];
    var file = S.health && S.health.progressFile ? esc(S.health.progressFile) : 'data/progress.json';
    $('#main').innerHTML = '<h1>Настройки</h1><div class="card settings">' +
      '<div class="settings-row"><div><b>Тема</b><div class="muted">«Авто» следует настройке системы</div></div><div class="seg">' + seg('auto', 'Авто') + seg('dark', 'Тёмная') + seg('light', 'Светлая') + '</div></div>' +
      '<div class="settings-row"><div><b>Свободный режим</b><div class="muted">Открыть все уроки сразу, без последовательной разблокировки</div></div>' +
      '<label class="switch"><input type="checkbox" id="freeMode"' + (S.p.settings.freeMode ? ' checked' : '') + '><span></span><em>Включить</em></label></div>' +
      '<div class="settings-row"><div><b>Где хранится прогресс</b>' +
      '<div class="muted">В этом браузере и в файле на компьютере: <code>' + file + '</code> (' + syncText + '). ' +
      'Очистка кэша или данных сайта прогресс не сбрасывает — он восстановится из файла. Раз в день и перед каждым сбросом сервер сохраняет резервную копию в папку <code>backups</code> рядом с файлом.</div></div></div>' +
      '<div class="settings-row"><div><b>Резервная копия вручную</b><div class="muted">Сохранить прогресс в файл или загрузить его из файла (заменит текущий)</div></div>' +
      '<div class="row-actions"><button class="btn" id="exportBtn">' + icon('download', 16) + 'Экспорт</button><label class="btn">' + icon('upload', 16) + 'Импорт<input type="file" id="importFile" accept="application/json,.json" hidden></label></div></div>' +
      '<div class="settings-row"><div><b>Сбросить прогресс</b><div class="muted">Удалит XP, решённые задачи, ответы и сохранённый код. Копия останется в папке <code>backups</code></div></div>' +
      '<button class="btn danger" id="resetBtn">' + icon('trash', 16) + 'Сбросить всё</button></div>' +
      '</div>';
    $$('[data-theme-set]').forEach(function (b) {
      b.addEventListener('click', function () { S.p.settings.theme = b.dataset.themeSet; S.p.settings.t = Date.now(); applyTheme(); save(); viewSettings(); });
    });
    $('#freeMode').addEventListener('change', function (e) {
      S.p.settings.freeMode = e.target.checked; S.p.settings.t = Date.now();
      save(); renderSidebar(null); toast(e.target.checked ? 'Все уроки открыты' : 'Последовательный режим');
    });
    $('#exportBtn').addEventListener('click', function () {
      writeLocal();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S.p, null, 2)], { type: 'application/json' }));
      a.download = 'go-academy-progress.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    $('#importFile').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var data;
        try { data = JSON.parse(txt); } catch (e) { throw new Error('файл повреждён или это не JSON'); }
        if (!isObj(data) || !isObj(data.tasks) && !isObj(data.lessons)) throw new Error('это не файл прогресса Go Academy');
        if (!confirm('Заменить текущий прогресс содержимым файла?')) return;
        S.p = normalize(data);
        S.p.epoch = Date.now(); // импорт заменяет прогресс целиком, во всех вкладках и на сервере
        sync.snapshot = true;
        lastRank = null;
        save(true); applyTheme(); renderRank(); toast('Прогресс импортирован', 'ok'); viewSettings();
      }).catch(function (err) { toast('Ошибка импорта: ' + esc(err.message), 'bad', 5000); });
    });
    $('#resetBtn').addEventListener('click', function () {
      if (!confirm('Точно сбросить весь прогресс?')) return;
      var settings = S.p.settings;
      S.p = emptyProgress();
      S.p.settings = settings;
      S.p.epoch = Date.now(); // сброс должен победить старые копии в других вкладках и на сервере
      sync.snapshot = true;   // сервер сохранит прежний прогресс в backups
      lastRank = null;
      save(true); renderRank(); toast('Прогресс сброшен');
      location.hash = '#/';
    });
    renderSidebar(null);
    if (!S.health) api('/api/health').then(function (hh) { S.health = hh; if (location.hash.indexOf('settings') >= 0) viewSettings(); }).catch(function () {});
  }

  // ------------------------------------------------------------------ Задачи с собеседований
  function viewInterview() {
    setView(null);
    S.refreshers.view.push(viewInterview);
    var total = 0, solved = 0, groups = '';
    S.course.modules.forEach(function (m) {
      var rows = '';
      m.lessons.forEach(function (l) {
        l.tasks.forEach(function (t) {
          if (!t.interview) return;
          total++;
          var st = S.p.tasks[t.id] || {};
          if (st.solved) solved++;
          var locked = !isUnlocked(l.id);
          var mark = st.solved ? '<span class="st done">' + icon('check', 14) + '</span>' : locked ? '<span class="st locked">' + icon('lock', 13) + '</span>' : '<span class="st open"></span>';
          var inner = mark + '<span class="iv-title"><b>' + esc(t.title) + '</b><small>' + esc(l.title) + '</small></span><span class="badge xp">' + t.xp + ' XP</span>';
          rows += locked ? '<div class="iv-row locked" title="Урок пока закрыт">' + inner + '</div>'
            : '<a class="iv-row" href="#/lesson/' + l.id + '/practice">' + inner + '</a>';
        });
      });
      if (rows) groups += '<h3 class="iv-group">' + (m.icon ? m.icon + ' ' : '') + esc(m.title) + '</h3><div class="card iv-list">' + rows + '</div>';
    });
    $('#main').innerHTML = '<h1>Задачи с собеседований</h1>' +
      '<p class="lead">Типичные задачи с интервью (курс «' + esc(S.track.title) + '»). Они находятся внутри уроков и открываются по мере прохождения курса. Решено <b>' + solved + ' из ' + total + '</b>.</p>' + groups;
    renderSidebar(null);
  }

  // ------------------------------------------------------------------ Урок
  function viewLesson(id, tab) {
    var meta = S.byId[id];
    if (!meta) {
      setView(null);
      $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('help', 40) + '</div><h2>Урок не найден</h2><a class="btn" href="#/">На главную</a></div>';
      renderSidebar(null);
      return;
    }
    setTrack(meta.track.id);
    setView(id);
    renderSidebar(id);
    if (!isUnlocked(id)) {
      var prev = S.flat[meta.index - 1];
      S.refreshers.view.push(function () { if (isUnlocked(id)) route(); });
      $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('lock', 40) + '</div><h2>Урок пока закрыт</h2>' +
        '<p class="muted">Сначала пройдите урок «' + esc(prev.title) + '»: ответьте на вопросы теста и решите задачи.</p>' +
        '<div class="row-actions center"><a class="btn primary" href="#/lesson/' + prev.id + '">К предыдущему уроку</a><a class="btn" href="#/settings">Открыть все уроки</a></div></div>';
      return;
    }
    if (S.p.lastLesson !== id) { S.p.lastLesson = id; S.p.lastAt = Date.now(); save(); }
    var p = S.lessons[id] ? Promise.resolve(S.lessons[id]) : api('/api/lessons/' + encodeURIComponent(id)).then(function (l) { S.lessons[id] = l; return l; });
    if (!S.lessons[id]) $('#main').innerHTML = '<div class="loading">Загрузка урока…</div>';
    p.then(function (lesson) { if (S.active === id) renderLesson(lesson, meta, tab); })
      .catch(function (e) {
        if (S.active !== id) return;
        $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('alert', 40) + '</div><h2>Не удалось загрузить урок</h2><p class="muted">' + esc(e.message) + '</p>' +
          '<button class="btn primary" id="retryLoad">Повторить</button></div>';
        $('#retryLoad').addEventListener('click', route);
      });
  }

  function countCorrect(lesson, qs) {
    var n = 0;
    lesson.quiz.forEach(function (q, i) { if (qs.answers[i] === q.answer) n++; });
    return n;
  }
  // Тест пройден, когда на все вопросы дан верный ответ (ошибки можно исправлять).
  function quizDone(lesson) {
    if (!lesson.quiz.length) return true;
    var q = S.p.quiz[lesson.id];
    return !!q && countCorrect(lesson, q) === lesson.quiz.length;
  }
  function cardsDone(lesson) {
    return (lesson.cards || []).filter(function (c) { return (S.p.cards[c.id] || {}).g === 3; }).length;
  }
  function tasksDone(lesson) {
    return lesson.tasks.filter(function (t) { return (S.p.tasks[t.id] || {}).solved; }).length;
  }

  function renderSteps(lesson) {
    var q = S.p.quiz[lesson.id], qc = q ? countCorrect(lesson, q) : 0, td = tasksDone(lesson);
    var set = function (tab, done, text) {
      var b = $('[data-tab="' + tab + '"]');
      if (!b) return;
      b.classList.toggle('done', done);
      $('.step-st', b).innerHTML = done ? icon('check', 14) : text;
    };
    set('quiz', quizDone(lesson), lesson.quiz.length ? qc + '/' + lesson.quiz.length : '');
    set('practice', td === lesson.tasks.length, lesson.tasks.length ? td + '/' + lesson.tasks.length : '');
    var cn = (lesson.cards || []).length;
    set('cards', cardsDone(lesson) === cn, cn ? cardsDone(lesson) + '/' + cn : '');
    var done = $('#lessonDone');
    if (done) done.hidden = !isDone(lesson.id);
    var nx = $('#nextBtns');
    if (nx) nx.innerHTML = nextButtons(lesson);
  }

  function nextButtons(lesson) {
    var meta = S.byId[lesson.id];
    var prev = S.flat[meta.index - 1], next = S.flat[meta.index + 1];
    var h = prev ? '<a class="nav-card prev" href="#/lesson/' + prev.id + '">' + icon('arrowLeft', 18) + '<span><small>Предыдущий урок</small><b>' + esc(prev.title) + '</b></span></a>' : '<span></span>';
    if (!next) return h + '<a class="nav-card next" href="#/"><span><small>Курс пройден</small><b>На главную</b></span>' + icon('flag', 18) + '</a>';
    if (isUnlocked(next.id)) return h + '<a class="nav-card next' + (isDone(lesson.id) ? ' ready' : '') + '" href="#/lesson/' + next.id + '"><span><small>Следующий урок</small><b>' + esc(next.title) + '</b></span>' + icon('arrowRight', 18) + '</a>';
    var need = [];
    if (!quizDone(lesson)) need.push('ответьте верно на все вопросы теста');
    if (tasksDone(lesson) < lesson.tasks.length) need.push('решите ' + (lesson.tasks.length > 1 ? 'все задачи' : 'задачу'));
    if (cardsDone(lesson) < (lesson.cards || []).length) need.push('доведите все вопросы до оценки «знаю»');
    return h + '<div class="nav-card next locked">' + '<span><small>Чтобы открыть следующий урок, ' + need.join(' и ') + '</small><b>' + esc(next.title) + '</b></span>' + icon('lock', 18) + '</div>';
  }

  function maybeCompleteLesson(lesson) {
    if (isDone(lesson.id)) return;
    if (!quizDone(lesson) || tasksDone(lesson) < lesson.tasks.length || cardsDone(lesson) < (lesson.cards || []).length) return;
    S.p.lessons[lesson.id] = { completed: true, completedAt: Date.now() };
    save(true);
    toast('🏁 Урок «' + esc(lesson.title) + '» пройден! <b>+' + lesson.xp + ' XP</b>', 'xp', 4500);
    var meta = S.byId[lesson.id];
    if (meta.module.lessons.every(function (l) { return isDone(l.id); })) {
      toast('🎓 Модуль «' + esc(meta.module.title) + '» завершён!', 'ok', 6000);
    }
    renderSidebar(lesson.id);
  }
  // Общая реакция на любое изменение прогресса внутри урока.
  function afterProgress(lesson) {
    maybeCompleteLesson(lesson);
    renderRank();
    renderSteps(lesson);
  }

  function renderLesson(lesson, meta, tab) {
    lesson.cards = lesson.cards || [];
    var tabs = [];
    if (lesson.theory) tabs.push(['theory', 'book', 'Теория']);
    if (lesson.quiz.length) tabs.push(['quiz', 'help', 'Тест']);
    if (lesson.tasks.length) tabs.push(['practice', 'code', 'Практика']);
    if (lesson.cards.length) tabs.push(['cards', 'target', 'Вопросы']);
    var first = tabs[0][0];
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = first;
    var mi = S.course.modules.indexOf(meta.module);
    var maxLessonXP = lesson.xp + lesson.quiz.length * QUIZ_XP + lesson.cards.length * CARD_XP + lesson.tasks.reduce(function (a, t) { return a + t.xp; }, 0);
    var h = '<div class="crumbs"><a href="#/">' + esc(S.track.title) + '</a>' + icon('chevron', 12) + '<span>Модуль ' + (mi + 1) + '. ' + esc(meta.module.title) + '</span>' + icon('chevron', 12) + '<span>Урок ' + (meta.module.lessons.indexOf(meta) + 1) + ' из ' + meta.module.lessons.length + '</span></div>' +
      '<header class="lesson-head"><h1>' + esc(lesson.title) + '</h1>' + (lesson.summary ? '<p class="lead">' + esc(lesson.summary) + '</p>' : '') +
      '<div class="chips"><span class="chip">' + icon('clock', 14) + '≈ ' + fmtMinutes(meta.minutes || 30) + '</span>' +
      '<span class="chip xp">' + icon('zap', 14) + 'до ' + maxLessonXP + ' XP</span>' +
      '<span class="chip ok" id="lessonDone" hidden>' + icon('check', 14) + 'Урок пройден</span></div></header>' +
      '<div class="steps" role="tablist"' + (tabs.length < 2 ? ' hidden' : '') + '>' + tabs.map(function (t) {
        return '<button class="step" role="tab" data-tab="' + t[0] + '"><span class="step-ic">' + icon(t[1], 16) + '</span><span class="step-t">' + t[2] + '</span><span class="step-st"></span></button>';
      }).join('') + '</div>' +
      '<div id="tabBody"></div><nav class="next-row" id="nextBtns" aria-label="Соседние уроки"></nav>';
    $('#main').innerHTML = h;
    S.refreshers.view.push(function () { renderSteps(lesson); });
    var show = function (name) {
      $$('.step').forEach(function (x) { var on = x.dataset.tab === name; x.classList.toggle('active', on); x.setAttribute('aria-selected', String(on)); });
      renderTab(lesson, name);
    };
    $$('.step').forEach(function (b) {
      b.addEventListener('click', function () {
        history.replaceState(null, '', '#/lesson/' + lesson.id + (b.dataset.tab === first ? '' : '/' + b.dataset.tab));
        show(b.dataset.tab);
      });
    });
    show(tab);
    renderSteps(lesson);
    window.scrollTo(0, 0);
  }

  function goTab(name) {
    var b = $('[data-tab="' + name + '"]');
    if (b) b.click();
    // прокручиваем к началу содержимого вкладки (под шапкой и «липкими» вкладками)
    var body = $('#tabBody'), steps = $('.steps'), bar = $('.topbar');
    if (body) window.scrollTo(0, Math.max(0, body.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - (steps ? steps.offsetHeight : 0) - 20));
  }

  function renderTab(lesson, tab) {
    S.refreshers.tab = [];
    var body = $('#tabBody');
    if (tab === 'quiz') {
      renderQuiz(lesson, body);
      S.refreshers.tab.push(function () { renderQuiz(lesson, body); }); // ответы могли измениться в другой вкладке
    } else if (tab === 'practice') renderPractice(lesson, body);
    else if (tab === 'cards') renderCards(lesson, body);
    else {
      var nextTab = lesson.quiz.length ? 'quiz' : lesson.tasks.length ? 'practice' : lesson.cards.length ? 'cards' : null;
      var cta = { quiz: ['Закрепите её коротким тестом — ' + lesson.quiz.length + ' ' + plural(lesson.quiz.length, ['вопрос', 'вопроса', 'вопросов']) + '.', 'Перейти к тесту'],
        practice: ['Закрепите её на практике.', 'К практике'], cards: ['Проверьте, сможете ли ответить на вопросы.', 'К вопросам'] }[nextTab];
      body.innerHTML = '<article class="prose">' + MD.render(lesson.theory) + '</article>' +
        (cta ? '<div class="card cta-card"><div><b>Прочитали теорию?</b><div class="muted">' + cta[0] + '</div></div>' +
        '<button class="btn primary" id="toQuiz"><span>' + cta[1] + '</span>' + icon('arrowRight', 16) + '</button></div>' : '');
      if (cta) $('#toQuiz').addEventListener('click', function () { goTab(nextTab); });
    }
  }

  // ------------------------------------------------------------------ Вопросы собеседований
  var GRADES = { 1: ['Не знал', 'bad'], 2: ['Частично', 'warn'], 3: ['Знаю', 'ok'] };
  function gradeBadge(g) {
    return g ? '<span class="badge grade ' + GRADES[g][1] + '">' + GRADES[g][0] + '</span>' : '<span class="badge soft">нет оценки</span>';
  }
  // cardBox рисует один вопрос: поле для своего ответа → эталонный ответ → самооценка.
  function cardBox(el, card, opts) {
    opts = opts || {};
    var st = cardState(card.id), revealed = false, timer;
    function draw() {
      el.innerHTML = '<div class="iq-q prose">' + MD.render(card.question) + '</div>' +
        '<textarea class="iq-input" rows="4" placeholder="Сформулируйте ответ своими словами: напишите здесь или проговорите вслух, как на собеседовании. Потом сравните с эталоном."></textarea>' +
        (revealed
          ? '<div class="iq-answer"><div class="iq-answer-head">' + icon('eye', 16) + '<b>Эталонный ответ</b></div><div class="prose">' + MD.render(card.answer) + '</div></div>' +
            '<div class="iq-grade"><span class="muted">Сравните со своим ответом и оцените честно:</span><div class="row-actions">' +
            '<button class="btn grade-btn bad" data-g="1">Не знал</button><button class="btn grade-btn warn" data-g="2">Частично</button><button class="btn grade-btn ok" data-g="3">Знаю уверенно</button></div></div>'
          : '<div class="row-actions"><button class="btn primary" data-act="reveal">' + icon('eye', 16) + 'Показать эталонный ответ</button></div>');
      var ta = $('.iq-input', el);
      ta.value = st.a || '';
      ta.addEventListener('input', function () {
        st.a = ta.value.slice(0, 4000); st.t = Date.now();
        clearTimeout(timer);
        timer = setTimeout(function () { save(); }, 800);
      });
      var rv = $('[data-act="reveal"]', el);
      if (rv) rv.addEventListener('click', function () { revealed = true; var keep = ta.value; draw(); $('.iq-input', el).value = keep; });
      $$('[data-g]', el).forEach(function (b) {
        if (st.g === +b.dataset.g) b.classList.add('on');
        b.addEventListener('click', function () {
          var before = st.g;
          st.g = +b.dataset.g; st.n++; st.t = Date.now();
          save(true);
          if (st.g === 3 && before !== 3) toast('+' + (before === 2 ? CARD_XP / 2 : CARD_XP) + ' XP', 'xp', 1500);
          else if (st.g === 2 && !before) toast('+' + CARD_XP / 2 + ' XP', 'xp', 1500);
          $$('[data-g]', el).forEach(function (x) { x.classList.toggle('on', x === b); });
          if (opts.onGrade) opts.onGrade(st.g);
        });
      });
    }
    draw();
  }

  function renderCards(lesson, body) {
    var h = '<div class="card iq-summary" id="iqSummary"></div>';
    lesson.cards.forEach(function (c, i) {
      h += '<details class="card iq-item" data-card="' + i + '"><summary><span class="iq-num">' + (i + 1) + '</span><span class="iq-title">' + MD.inline(c.question.split('\n')[0]) + '</span><span class="iq-state"></span>' + icon('chevron', 16) + '</summary><div class="iq-body"></div></details>';
    });
    body.innerHTML = h;
    function summary() {
      var known = cardsDone(lesson), n = lesson.cards.length;
      $('#iqSummary').innerHTML = '<div><b>Знаю уверенно: ' + known + ' из ' + n + '</b><div class="muted">Откройте вопрос, ответьте своими словами, сравните с эталоном и поставьте себе оценку. Тема закрыта, когда все вопросы имеют оценку «знаю».</div></div>' +
        '<div class="row-actions"><a class="btn primary" href="#/drill/' + lesson.id + '">Тренировать тему' + icon('arrowRight', 16) + '</a></div>';
      lesson.cards.forEach(function (c, i) { $('[data-card="' + i + '"] .iq-state', body).innerHTML = gradeBadge((S.p.cards[c.id] || {}).g); });
    }
    $$('.iq-item', body).forEach(function (d) {
      var c = lesson.cards[+d.dataset.card];
      d.addEventListener('toggle', function () {
        var box = $('.iq-body', d);
        if (d.open && !box.innerHTML) cardBox(box, c, { onGrade: function () { summary(); afterProgress(lesson); } });
      });
    });
    S.refreshers.tab.push(summary);
    summary();
  }

  // Тренировка: вопросы по одному, сначала те, что знаю хуже всего и давно не повторял.
  function viewDrill(lessonId) {
    setView(null);
    renderSidebar(null);
    var track = lessonId && S.byId[lessonId] ? S.byId[lessonId].track : S.track;
    if (!track.cardsCache) {
      $('#main').innerHTML = '<div class="loading">Загрузка вопросов…</div>';
      api('/api/tracks/' + encodeURIComponent(track.id) + '/cards').then(function (r) {
        track.cardsCache = r.cards;
        if (/^#\/drill/.test(location.hash)) viewDrill(lessonId);
      }).catch(function (e) { $('#main').innerHTML = '<div class="empty"><h2>Не удалось загрузить вопросы</h2><p class="muted">' + esc(e.message) + '</p></div>'; });
      return;
    }
    var pool = track.cardsCache.filter(function (c) { return !lessonId || c.lessonId === lessonId; });
    if (!pool.length) {
      $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('target', 40) + '</div><h2>В этом курсе нет вопросов для тренировки</h2>' +
        '<p class="muted">Вопросы с собеседований собраны в курсе «Собеседование».</p><a class="btn primary" href="#/track/interview">Открыть</a></div>';
      return;
    }
    var now = Date.now();
    var queue = pool.map(function (c) {
      var st = S.p.cards[c.id] || { g: 0, t: 0 };
      // чем меньше вес, тем раньше вопрос: не знал → новый → частично → знаю (самые давние раньше)
      var w = st.g === 1 ? 0 : !st.g ? 1 : st.g === 2 ? 2 : 3;
      return { c: c, k: w * 1e6 + Math.random() * 1e5 - Math.min(9e5, (now - st.t) / 1000) * (st.g ? 1 : 0) };
    }).sort(function (a, b) { return a.k - b.k; }).slice(0, 10).map(function (x) { return x.c; });
    var pos = 0, marks = [];
    function step() {
      if (pos >= queue.length) {
        var k = marks.filter(function (g) { return g === 3; }).length, pt = marks.filter(function (g) { return g === 2; }).length;
        $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('flag', 40) + '</div><h2>Тренировка окончена</h2>' +
          '<p class="lead">Знаю уверенно: <b>' + k + '</b>, частично: <b>' + pt + '</b>, не знал: <b>' + (marks.length - k - pt) + '</b>.</p>' +
          '<p class="muted">Вопросы с оценками «не знал» и «частично» вернутся в следующих тренировках первыми.</p>' +
          '<div class="row-actions center"><button class="btn primary" id="again">Ещё 10 вопросов</button><a class="btn" href="#/">К курсу</a></div></div>';
        $('#again').addEventListener('click', function () { viewDrill(lessonId); });
        renderRank();
        return;
      }
      var c = queue[pos];
      $('#main').innerHTML = '<div class="crumbs"><a href="#/">' + esc(track.title) + '</a>' + icon('chevron', 12) + '<span>Тренировка</span>' + icon('chevron', 12) + '<span>' + esc(c.topic) + '</span></div>' +
        '<div class="drill-head"><h1>Вопрос ' + (pos + 1) + ' из ' + queue.length + '</h1>' + gradeBadge((S.p.cards[c.id] || {}).g) + '</div>' +
        '<div class="bar drill-bar"><span style="width:' + (pos / queue.length * 100) + '%"></span></div>' +
        '<section class="card iq-drill"><div id="drillCard"></div></section><div class="row-actions drill-next"><button class="btn ghost" id="skip">Пропустить</button><button class="btn primary" id="next" hidden>Следующий вопрос' + icon('arrowRight', 16) + '</button></div>';
      var graded = false;
      cardBox($('#drillCard'), c, { onGrade: function (g) { if (!graded) marks.push(g); else marks[marks.length - 1] = g; graded = true; $('#next').hidden = false; $('#skip').hidden = true; renderRank(); } });
      $('#next').addEventListener('click', function () { pos++; step(); window.scrollTo(0, 0); });
      $('#skip').addEventListener('click', function () { pos++; step(); window.scrollTo(0, 0); });
    }
    step();
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ Тест
  function renderQuiz(lesson, body) {
    var qs = quizState(lesson.id);
    qs.correct = countCorrect(lesson, qs);
    var total = lesson.quiz.length;
    var h = '';
    lesson.quiz.forEach(function (q, qi) {
      h += '<div class="card quiz-item" data-q="' + qi + '"><div class="quiz-num">Вопрос ' + (qi + 1) + ' из ' + total + '</div>' +
        '<div class="quiz-q prose">' + MD.render(q.question) + '</div><div class="options">' +
        q.options.map(function (o, oi) {
          return '<button class="option" data-o="' + oi + '"><span class="letter">' + String.fromCharCode(65 + oi) + '</span><span class="option-text">' + MD.inline(o) + '</span></button>';
        }).join('') + '</div><div class="explain-box"></div></div>';
    });
    h += '<div class="card quiz-summary" id="quizSummary"></div>';
    body.innerHTML = h;

    function paint(qi) {
      var q = lesson.quiz[qi], box = $('[data-q="' + qi + '"]', body);
      var a = qs.answers[qi];
      if (a === undefined) return;
      var ok = a === q.answer;
      box.classList.add(ok ? 'is-ok' : 'is-bad');
      $$('.option', box).forEach(function (b, oi) {
        b.disabled = true;
        if (oi === q.answer) b.classList.add('correct');
        else if (oi === a) b.classList.add('wrong');
      });
      $('.explain-box', box).innerHTML = '<div class="explain ' + (ok ? 'ok' : 'bad') + '"><div class="explain-head">' + icon(ok ? 'checkCircle' : 'xCircle', 18) +
        '<b>' + (ok ? 'Верно!' : 'Неверно.') + '</b></div>' + MD.render(q.explain) + '</div>';
    }
    function summary() {
      var n = answered(qs), wrong = n - qs.correct;
      var el = $('#quizSummary');
      var retry = n > 0 ? '<button class="btn ghost" id="retryQuiz">' + icon('undo', 16) + 'Пройти заново</button>' : '';
      if (n < total) {
        el.className = 'card quiz-summary';
        el.innerHTML = '<div><b>Отвечено ' + n + ' из ' + total + '</b><div class="muted">За каждый верный ответ — ' + QUIZ_XP + ' XP. Тест засчитывается, когда все ответы верны.</div></div><div class="row-actions">' + retry + '</div>';
      } else if (wrong > 0) {
        el.className = 'card quiz-summary warn';
        el.innerHTML = '<div><b>Верно ' + qs.correct + ' из ' + total + '</b><div class="muted">Прочитайте объяснения к ошибкам и ответьте на эти вопросы ещё раз — так материал закрепится.</div></div>' +
          '<div class="row-actions">' + retry + '<button class="btn primary" id="fixQuiz">Исправить ' + (wrong === 1 ? 'ошибку' : 'ошибки') + ' (' + wrong + ')</button></div>';
      } else {
        el.className = 'card quiz-summary ok';
        el.innerHTML = '<div><b>Все ответы верны — тест пройден 🎉</b><div class="muted">' + (lesson.tasks.length ? 'Теперь закрепите тему на практике.' : '') + '</div></div>' +
          '<div class="row-actions">' + retry + (lesson.tasks.length ? '<button class="btn primary" id="toPractice"><span>К практике</span>' + icon('arrowRight', 16) + '</button>' : '') + '</div>';
      }
      var rb = $('#retryQuiz');
      if (rb) rb.addEventListener('click', function () {
        qs.answers = {}; qs.correct = 0; qs.t = Date.now();
        save(); renderQuiz(lesson, body); afterProgress(lesson); goTab('quiz');
      });
      var fb = $('#fixQuiz');
      if (fb) fb.addEventListener('click', function () {
        lesson.quiz.forEach(function (q, i) { if (qs.answers[i] !== q.answer) delete qs.answers[i]; });
        qs.correct = countCorrect(lesson, qs); qs.t = Date.now();
        save(); renderQuiz(lesson, body); afterProgress(lesson);
        var firstOpen = $('.quiz-item:not(.is-ok):not(.is-bad)', body);
        if (firstOpen) firstOpen.scrollIntoView({ block: 'center' });
      });
      var tp = $('#toPractice');
      if (tp) tp.addEventListener('click', function () { goTab('practice'); });
    }

    lesson.quiz.forEach(function (q, qi) {
      paint(qi);
      $$('[data-q="' + qi + '"] .option', body).forEach(function (b) {
        b.addEventListener('click', function () {
          if (qs.answers[qi] !== undefined) return;
          var oi = +b.dataset.o;
          qs.answers[qi] = oi;
          qs.correct = countCorrect(lesson, qs);
          qs.t = Date.now();
          if (oi === q.answer) toast('+' + QUIZ_XP + ' XP', 'xp', 1500);
          save();
          paint(qi); summary(); afterProgress(lesson);
        });
      });
    });
    summary();
  }

  // ------------------------------------------------------------------ Практика
  function renderPractice(lesson, body) {
    if (!lesson.tasks.length) { body.innerHTML = '<p class="muted">В этом уроке нет практических задач.</p>'; return; }
    body.innerHTML = '';
    lesson.tasks.forEach(function (task, ti) {
      var el = document.createElement('section');
      el.className = 'card task';
      el.id = 'task-' + ti;
      body.appendChild(el);
      renderTask(lesson, task, el, ti);
    });
  }

  function renderTask(lesson, task, el, ti) {
    var st = taskState(task.id);
    var L = LANGS[task.lang] || LANGS.go;
    var codeOf = function () { return st.code === null ? task.starter : st.code; };
    el.innerHTML =
      '<header class="task-head"><span class="task-n">Задача ' + (ti + 1) + (lesson.tasks.length > 1 ? ' из ' + lesson.tasks.length : '') + '</span>' +
      '<h3>' + esc(task.title) + '</h3><span class="task-badges">' +
      (task.interview ? '<span class="badge interview">' + icon('target', 12) + 'Собеседование</span>' : '') +
      '<span class="badge xp" data-role="xp"></span><span data-role="solved"></span></span></header>' +
      '<div class="task-desc prose">' + MD.render(task.description) + '</div>' +
      '<div class="hints" data-role="hints"></div>' +
      '<div class="ide"><div class="ide-bar"><span class="ide-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="ide-file">' + L.file + '</span>' +
      '<span class="kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> запуск · <kbd>Ctrl</kbd>+<kbd>S</kbd> проверка</span>' +
      '<button class="bar-btn" data-act="reset" title="Вернуть исходный код задачи">' + icon('undo', 14) + '<span>Сброс</span></button></div>' +
      '<div data-role="editor"></div></div>' +
      '<div class="toolbar">' +
      '<button class="btn" data-act="run" title="' + L.runTitle + '">' + icon('play', 16) + L.run + '</button>' +
      '<button class="btn primary" data-act="check">' + icon('checkCircle', 16) + 'Проверить</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn ghost" data-act="hint"></button>' +
      '<button class="btn ghost" data-act="solution"></button>' +
      '</div><div data-role="output" aria-live="polite"></div><div data-role="solution" class="solution-box"></div>';

    var outEl = $('[data-role="output"]', el);
    var busy = false;
    var saveTimer;
    var ed = new Editor($('[data-role="editor"]', el), {
      value: codeOf(),
      lang: task.lang,
      onChange: function (v) {
        st.code = v === task.starter ? null : v;
        st.ct = Date.now();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { save(); }, 600);
      },
      onRun: function () { run('run'); },
      onCheck: function () { run('check'); }
    });

    function canSeeSolution() { return st.solved || st.solutionShown || st.attempts >= SOLUTION_AFTER; }
    function refreshMeta() {
      var earned = earnedXP(task, st);
      $('[data-role="xp"]', el).innerHTML = icon('zap', 12) + (st.solved ? ('+' + (st.xp || 0) + ' XP') : (earned + (earned < task.xp ? ' из ' + task.xp : '') + ' XP'));
      $('[data-role="solved"]', el).innerHTML = st.solved ? '<span class="badge done">' + icon('check', 12) + 'Решено</span>' : '';
      el.classList.toggle('solved', !!st.solved);
      var shown = Math.min(st.hintsUsed, task.hints.length);
      $('[data-role="hints"]', el).innerHTML = task.hints.slice(0, shown).map(function (hh, i) {
        return '<div class="hint"><div class="hint-head">' + icon('bulb', 16) + '<b>Подсказка ' + (i + 1) + '</b></div>' + MD.render(hh) + '</div>';
      }).join('');
      var hb = $('[data-act="hint"]', el);
      if (shown >= task.hints.length) { hb.disabled = true; hb.innerHTML = icon('bulb', 16) + 'Подсказок больше нет'; }
      else {
        hb.disabled = false;
        hb.innerHTML = icon('bulb', 16) + 'Подсказка ' + (shown + 1) + ' из ' + task.hints.length + (st.solved ? '' : ' <small>−' + Math.round(task.xp * HINT_PENALTY) + ' XP</small>');
      }
      var sb = $('[data-act="solution"]', el);
      sb.innerHTML = icon(canSeeSolution() ? 'eye' : 'lock', 16) + 'Решение';
      sb.classList.toggle('is-locked', !canSeeSolution());
      sb.title = canSeeSolution() ? 'Показать эталонное решение' : 'Откроется после ' + SOLUTION_AFTER + ' неудачных проверок (сейчас: ' + st.attempts + ')';
    }
    refreshMeta();
    S.refreshers.tab.push(function () {
      refreshMeta();
      if (!ed.hasFocus() && ed.getValue() !== codeOf()) ed.setValue(codeOf()); // код изменили в другой вкладке
    });

    $('[data-act="hint"]', el).addEventListener('click', function () {
      if (st.hintsUsed >= task.hints.length) return;
      st.hintsUsed++;
      save(); refreshMeta();
    });
    $('[data-act="reset"]', el).addEventListener('click', function () {
      if (ed.getValue() === task.starter) return;
      if (!confirm('Вернуть исходный код задачи? Ваш текущий код будет потерян.')) return;
      ed.setValue(task.starter); st.code = null; st.ct = Date.now(); save();
    });
    $('[data-act="solution"]', el).addEventListener('click', function () {
      var box = $('[data-role="solution"]', el);
      if (box.innerHTML) { box.innerHTML = ''; return; }
      if (!canSeeSolution()) {
        var left = SOLUTION_AFTER - st.attempts;
        toast('Решение откроется после ещё ' + left + ' ' + plural(left, ['неудачной проверки', 'неудачных проверок', 'неудачных проверок']) + '. Сначала попробуйте сами — и загляните в подсказки.', '', 4500);
        return;
      }
      if (!st.solved && !st.solutionShown && !confirm('Если посмотреть решение до самостоятельного решения, за задачу будет начислено только ' + Math.round(SOLUTION_FACTOR * 100) + '% XP. Показать?')) return;
      api('/api/tasks/' + encodeURIComponent(task.id) + '/solution').then(function (r) {
        if (!st.solved && !st.solutionShown) { st.solutionShown = true; save(); }
        refreshMeta();
        box.innerHTML = '<div class="solution"><div class="solution-head"><b>' + icon('eye', 16) + 'Эталонное решение</b><button class="btn small" data-act="paste">Вставить в редактор</button></div>' +
          MD.codeBlock(r.solution, L.md) +
          '<div class="muted small">Разберитесь, почему оно работает, затем лучше напишите решение сами и нажмите «Проверить».</div></div>';
        $('[data-act="paste"]', box).addEventListener('click', function () { ed.setValue(r.solution); st.code = r.solution; st.ct = Date.now(); save(); });
      }).catch(function (e) { toast(esc(e.message), 'bad'); });
    });
    $('[data-act="run"]', el).addEventListener('click', function () { run('run'); });
    $('[data-act="check"]', el).addEventListener('click', function () { run('check'); });

    function run(mode) {
      if (busy) return;
      busy = true;
      $$('[data-act="run"],[data-act="check"]', el).forEach(function (b) { b.disabled = true; });
      outEl.innerHTML = '<div class="output run"><div class="output-head"><span class="spinner"></span><span>' + (mode === 'run' ? L.running : 'Проверка…') + '</span></div></div>';
      ed.setErrorLines([]);
      var code = ed.getValue();
      api(mode === 'run' ? '/api/run' : '/api/check', { taskId: task.id, code: code }).then(function (res) {
        renderOutput(outEl, res, mode, L);
        ed.setErrorLines(errorLines((res.stdout || '') + '\n' + (res.stderr || ''), L));
        if (mode !== 'check') return;
        if (res.passed) {
          if (!st.solved) {
            st.solved = true; st.solvedAt = Date.now(); st.xp = earnedXP(task, st);
            toast('✅ Задача «' + esc(task.title) + '» решена! <b>+' + st.xp + ' XP</b>', 'xp', 4000);
          } else toast('Тесты пройдены', 'ok');
          save(true);
        } else {
          if (!st.solved) st.attempts++;
          save();
          if (!st.solved && st.attempts === SOLUTION_AFTER) toast('Не получается? Теперь можно посмотреть эталонное решение.', '', 4500);
        }
        refreshMeta();
        afterProgress(lesson);
      }).catch(function (e) {
        outEl.innerHTML = '<div class="output bad"><div class="output-head">' + icon('alert', 16) + '<span>Не удалось выполнить запрос</span></div><pre>' + esc(e.message) + '</pre></div>';
      }).then(function () {
        busy = false;
        $$('[data-act="run"],[data-act="check"]', el).forEach(function (b) { b.disabled = false; });
      });
    }
  }

  // ---- языки задач
  var LANGS = {
    go: { file: 'main.go', md: 'go', run: 'Запустить', runTitle: 'Собрать и запустить программу', running: 'Сборка и запуск…', lineRe: /(?:^|[\s./])main\.go:(\d+)/g, buildFail: 'Программа не компилируется', outHead: 'Вывод программы' },
    java: { file: 'Main.java', md: 'java', run: 'Запустить', runTitle: 'Скомпилировать и запустить программу', running: 'Компиляция и запуск…', lineRe: /(?:^|[\s(])Main\.java:(\d+)/g, buildFail: 'Программа не компилируется', outHead: 'Вывод программы' },
    sql: { file: 'запрос.sql · SQLite', md: 'sql', run: 'Выполнить', runTitle: 'Выполнить запрос на учебной базе', running: 'Выполняю запрос…', lineRe: null, buildFail: 'Запрос не выполнен', outHead: 'Результат запроса' },
    git: { file: 'терминал · bash', md: 'bash', run: 'Выполнить', runTitle: 'Выполнить команды в учебном репозитории', running: 'Выполняю команды…', lineRe: null, buildFail: 'Команды не выполнены', outHead: 'Вывод терминала' }
  };

  // ---- вывод программы и расшифровка типичных ошибок
  var ERR_HINTS = [
    // Java
    [/class (\w+) is public, should be declared in a file named/, function (m) { return 'Публичный класс должен называться так же, как файл. Файл здесь один — <code>Main.java</code>, поэтому оставьте <code>public</code> только у класса <code>Main</code>, а у <code>' + esc(m[1]) + '</code> уберите слово <code>public</code>.'; }],
    [/error: ';' expected/, 'Пропущена точка с запятой <code>;</code> в конце команды (посмотрите на отмеченную строку и строку выше).'],
    [/error: cannot find symbol[\s\S]*?symbol:\s+(?:variable|method|class) (\w+)/, function (m) { return 'Имя <code>' + esc(m[1]) + '</code> не найдено: опечатка, неверный регистр букв, переменная объявлена в другом блоке или забыт <code>import</code>.'; }],
    [/error: incompatible types: (?:possible lossy conversion from (\w+) to (\w+)|(\S+) cannot be converted to (\S+))/, function (m) { return m[1] ? 'Значение типа <code>' + esc(m[1]) + '</code> не помещается в <code>' + esc(m[2]) + '</code> без потерь. Если это намеренно, приведите явно: <code>(' + esc(m[2]) + ') x</code>.' : 'Несовпадение типов: получено <code>' + esc(m[3]) + '</code>, а нужно <code>' + esc(m[4]) + '</code>.'; }],
    [/error: missing return statement/, 'Метод обещает вернуть значение, но не на всех путях есть <code>return</code>.'],
    [/error: variable (\w+) might not have been initialized/, function (m) { return 'Локальная переменная <code>' + esc(m[1]) + '</code> используется до того, как ей присвоено значение.'; }],
    [/error: variable (\w+) is already defined/, function (m) { return 'Переменная <code>' + esc(m[1]) + '</code> уже объявлена в этом методе — уберите тип перед вторым присваиванием.'; }],
    [/error: unreported exception (\S+); must be caught or declared to be thrown/, function (m) { return 'Проверяемое исключение <code>' + esc(m[1]) + '</code> нужно либо поймать в <code>try/catch</code>, либо объявить в сигнатуре метода: <code>throws ' + esc(m[1].replace(/^.*\./, '')) + '</code>.'; }],
    [/error: non-static (?:method|variable) (\w+)[^\n]* cannot be referenced from a static context/, function (m) { return '<code>' + esc(m[1]) + '</code> принадлежит объекту, а вызывается из статического метода без объекта. Создайте объект через <code>new</code> или сделайте <code>' + esc(m[1]) + '</code> статическим.'; }],
    [/error: (\w+) is not abstract and does not override abstract method (\w+)/, function (m) { return 'Класс <code>' + esc(m[1]) + '</code> реализует интерфейс, но в нём нет метода <code>' + esc(m[2]) + '</code> (или у метода другая сигнатура).'; }],
    [/error: reached end of file while parsing|error: class, interface, enum, or record expected/, 'Не сходятся фигурные скобки: какая-то <code>{</code> не закрыта или есть лишняя <code>}</code>.'],
    [/java\.lang\.NullPointerException/, '<code>NullPointerException</code>: вызов метода или обращение к полю у переменной, в которой лежит <code>null</code>.'],
    [/java\.lang\.ArrayIndexOutOfBoundsException: Index (-?\d+) out of bounds for length (\d+)/, function (m) { return 'Обращение к элементу массива с индексом <code>' + m[1] + '</code>, а элементов всего ' + m[2] + '. Индексы идут от 0 до длина − 1.'; }],
    [/java\.lang\.(?:StringIndexOutOfBoundsException|IndexOutOfBoundsException)/, 'Индекс за пределами строки или списка: допустимы индексы от 0 до размер − 1.'],
    [/java\.lang\.ArithmeticException: \/ by zero/, 'Деление целого числа на ноль.'],
    [/java\.lang\.ClassCastException/, '<code>ClassCastException</code>: объект приводится к типу, которым он не является. Проверяйте через <code>instanceof</code>.'],
    [/java\.lang\.NumberFormatException/, 'Строку не удалось превратить в число — в ней есть лишние символы или она пустая.'],
    [/java\.util\.ConcurrentModificationException/, 'Коллекцию изменили во время обхода циклом for-each. Удаляйте через <code>Iterator.remove()</code> или <code>removeIf</code>.'],
    [/java\.lang\.StackOverflowError/, 'Переполнение стека: рекурсия без условия выхода.'],
    [/java\.lang\.OutOfMemoryError/, 'Программе не хватило памяти: обычно это бесконечный цикл, в котором растёт список или строка.'],
    [/java\.util\.NoSuchElementException/, 'Запрошен элемент, которого нет: пустой <code>Optional</code>, пустая коллекция или итератор дошёл до конца.'],
    // SQL
    [/no such table: (\S+)/, function (m) { return 'Таблицы <code>' + esc(m[1]) + '</code> нет в учебной базе — проверьте название в условии задачи.'; }],
    [/no such column: (\S+)/, function (m) { return 'Столбца <code>' + esc(m[1]) + '</code> нет. Проверьте имя и то, что нужная таблица указана во <code>FROM</code>/<code>JOIN</code>. Текст пишут в одинарных кавычках: <code>\'текст\'</code>.'; }],
    [/ambiguous column name: (\S+)/, function (m) { return 'Столбец <code>' + esc(m[1]) + '</code> есть в нескольких таблицах запроса — уточните: <code>таблица.' + esc(m[1]) + '</code>.'; }],
    [/near "([^"]*)": syntax error/, function (m) { return 'Синтаксическая ошибка рядом с <code>' + esc(m[1]) + '</code>: проверьте порядок частей запроса (SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT), запятые и скобки.'; }],
    [/misuse of aggregate/, 'Агрегатная функция использована там, где нельзя — например в <code>WHERE</code>. Условия на результат агрегата пишут в <code>HAVING</code>.'],
    [/(UNIQUE|NOT NULL|FOREIGN KEY|CHECK) constraint failed/, function (m) { return 'Нарушено ограничение <code>' + m[1] + '</code>: база не даёт записать данные, которые противоречат правилам таблицы.'; }],
    // Git
    [/fatal: not a git repository/, 'В этой папке нет репозитория. Сначала создайте его командой <code>git init</code>.'],
    [/nothing to commit|nothing added to commit/, 'Коммитить нечего: изменения не добавлены в индекс. Сначала <code>git add файл</code>.'],
    [/pathspec '([^']+)' did not match/, function (m) { return 'Git не нашёл файл или ветку <code>' + esc(m[1]) + '</code> — проверьте имя.'; }],
    [/CONFLICT \(/, 'Конфликт слияния: один и тот же участок изменён в обеих ветках. Откройте файл, оставьте нужный вариант, уберите маркеры <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code>, затем <code>git add</code> и завершите слияние.'],
    [/is not a git command/, 'Такой команды git нет — проверьте написание.'],
    // Go
    [/declared and not used: ([\w.]+)|([\w.]+) declared and not used/, function (m) { return 'Переменная <code>' + esc(m[1] || m[2]) + '</code> объявлена, но нигде не используется. В Go это ошибка: используйте её или удалите.'; }],
    [/"([^"]+)" imported and not used/, function (m) { return 'Пакет <code>"' + esc(m[1]) + '"</code> импортирован, но не используется — уберите его из <code>import</code>.'; }],
    [/undefined: ([\w.]+)/, function (m) { return 'Имя <code>' + esc(m[1]) + '</code> не найдено. Проверьте опечатки и регистр букв; возможно, переменная не объявлена или забыт <code>import</code>.'; }],
    [/missing return/, 'Функция обещает вернуть значение, но не на всех путях есть <code>return</code>. Добавьте <code>return</code> в конце функции.'],
    [/non-declaration statement outside function body/, 'Команды можно писать только внутри функций — между <code>{</code> и <code>}</code> после <code>func …</code>.'],
    [/no new variables on left side of :=/, 'Слева от <code>:=</code> нет новых переменных. Для уже объявленной переменной пишите обычное <code>=</code>.'],
    [/([\w.]+) redeclared in this block/, function (m) { return 'Имя <code>' + esc(m[1]) + '</code> уже объявлено в этом блоке. Чтобы изменить значение, пишите <code>=</code> вместо <code>:=</code>.'; }],
    [/string literal not terminated|newline in string/, 'Не закрыта кавычка: текст строки должен целиком стоять в двойных кавычках <code>"вот так"</code>.'],
    [/syntax error: unexpected ([^,\n]+?)(?:,| in | at |$)/m, function (m) {
      var tok = { newline: 'конец строки', EOF: 'конец файла', 'name': 'имя' }[m[1]] || '<code>' + esc(m[1].replace(/^(name|keyword|literal) /, '')) + '</code>';
      return 'Синтаксическая ошибка: компилятор не ожидал здесь ' + tok + '. Обычно рядом не закрыта скобка или кавычка, пропущена запятая или фигурная скобка стоит не на той строке — посмотрите на отмеченную строку и строку выше.';
    }],
    [/cannot use .+? \(.*?of type ([^)]+)\) as (\S+) value/, function (m) { return 'Несовпадение типов: нужно значение типа <code>' + esc(m[2]) + '</code>, а получено <code>' + esc(m[1]) + '</code>. Go не преобразует типы сам — приведите явно, например <code>' + esc(m[2]) + '(x)</code>.'; }],
    [/mismatched types (\S+) and (\S+)/, function (m) { return 'В одной операции смешаны разные типы: <code>' + esc(m[1]) + '</code> и <code>' + esc(m[2].replace(/\)$/, '')) + '</code>. Приведите их к одному типу явно, например <code>float64(x)</code>.'; }],
    [/not enough arguments in call|too many arguments in call/, 'Функция вызвана с неверным количеством аргументов — сверьтесь с её объявлением.'],
    [/not enough return values|too many return values/, 'В <code>return</code> не столько значений, сколько обещано в объявлении функции.'],
    [/assignment mismatch/, 'Слева и справа от <code>=</code> разное количество значений (например, функция возвращает два значения, а принимается одно).'],
    [/has no field or method (\w+)/, function (m) { return 'У этого типа нет поля или метода <code>' + esc(m[1]) + '</code> — проверьте имя и регистр букв.'; }],
    [/missing method (\w+)/, function (m) { return 'Тип не реализует интерфейс: не хватает метода <code>' + esc(m[1]) + '</code> (либо у него другая сигнатура или получатель-указатель).'; }],
    [/(is|evaluated but) not used/, 'Выражение вычислено, но результат никуда не использован — присвойте его переменной или уберите.'],
    [/index out of range \[(-?\d+)\] with length (\d+)/, function (m) { return 'Обращение к элементу с индексом <code>' + m[1] + '</code>, а элементов всего ' + m[2] + '. Индексы идут от 0 до длина − 1.'; }],
    [/slice bounds out of range/, 'Границы среза выходят за его длину: в <code>s[a:b]</code> должно быть 0 ≤ a ≤ b ≤ len(s).'],
    [/nil pointer dereference/, 'Обращение через <code>nil</code>-указатель: значение не было создано (забыт <code>&amp;T{}</code> или конструктор) либо функция вернула <code>nil</code>.'],
    [/assignment to entry in nil map/, 'Запись в несозданную map. Сначала создайте её: <code>m := make(map[K]V)</code>.'],
    [/integer divide by zero/, 'Деление целого числа на ноль — проверьте делитель перед делением.'],
    [/all goroutines are asleep - deadlock/, 'Deadlock: все горутины ждут друг друга. Обычно это чтение из канала, в который никто не пишет, запись в небуферизованный канал без читателя или забытый <code>wg.Done()</code>.'],
    [/test timed out after/, 'Тест не завершился вовремя: в коде бесконечный цикл или горутины заблокировали друг друга. Ниже видно, на какой строке <code>main.go</code> программа «застряла».'],
    [/concurrent map (read and map write|writes)/, 'Гонка данных: map используется из нескольких горутин без синхронизации. Защитите её <code>sync.Mutex</code>.'],
    [/send on closed channel/, 'Запись в закрытый канал. Закрывать канал должен отправитель — и только когда отправок больше не будет.'],
    [/close of closed channel/, 'Канал закрывается дважды.'],
    [/stack overflow|goroutine stack exceeds/, 'Переполнение стека: рекурсия без условия выхода.'],
    [/function main is undeclared|main redeclared/, 'В программе должна быть ровно одна функция <code>func main()</code> в <code>package main</code>.']
  ];
  function explainErrors(text) {
    var out = [];
    ERR_HINTS.forEach(function (h) {
      if (out.length >= 3) return;
      var m = h[0].exec(text);
      if (m) out.push(typeof h[1] === 'function' ? h[1](m) : h[1]);
    });
    return out;
  }
  function errorLines(text, L) {
    var re = (L || LANGS.go).lineRe, m, lines = [];
    if (!re) return lines;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) if (lines.indexOf(+m[1]) < 0) lines.push(+m[1]);
    return lines.slice(0, 20);
  }

  function colorizeTest(text) {
    return text.split('\n').map(function (line) {
      var e = esc(line);
      if (/^\s*--- PASS|^PASS$|^ok\s/.test(line)) return '<span class="out-pass">' + e + '</span>';
      if (/^\s*--- FAIL|^FAIL|panic:|fatal error:|^\s*\S+_test\.go:\d+:|^\s*main\.go:\d+|^\s*at Main\.|исключение:|ошибка SQL/.test(line)) return '<span class="out-fail">' + e + '</span>';
      if (/^=== RUN|^goroutine \d+|^\$ /.test(line)) return '<span class="out-dim">' + e + '</span>';
      return e;
    }).join('\n');
  }

  function renderOutput(el, res, mode, L) {
    L = L || LANGS.go;
    var head, cls, ic, body = '';
    var all = (res.stdout || '') + (res.stderr ? '\n' + res.stderr : '');
    if (res.phase === 'build') {
      cls = 'bad'; ic = 'xCircle'; head = res.timedOut ? 'Превышено время сборки' : L.buildFail;
      body = '<pre class="out-err">' + esc(res.stderr || '') + '</pre>';
    } else if (res.memExceeded) {
      cls = 'bad'; ic = 'alert'; head = 'Программа заняла слишком много памяти';
      body = '<pre>' + colorizeTest(all) + '</pre>';
    } else if (mode === 'check') {
      if (res.passed) { cls = 'ok'; ic = 'checkCircle'; head = 'Все проверки пройдены' + (res.testsPass ? ' (' + res.testsPass + ')' : ''); }
      else { cls = 'bad'; ic = res.timedOut ? 'clock' : 'xCircle'; head = res.timedOut ? 'Превышено время выполнения' : 'Проверка не пройдена' + (res.testsFail ? ': провалено ' + res.testsFail + ', пройдено ' + res.testsPass : ''); }
      body = '<pre>' + colorizeTest(all) + '</pre>';
    } else {
      cls = res.ok ? 'run' : 'bad'; ic = res.timedOut ? 'clock' : res.ok ? 'terminal' : 'xCircle';
      head = res.timedOut ? 'Превышено время выполнения' : res.ok ? L.outHead : 'Завершилось с ошибкой (код ' + res.exitCode + ')';
      var out = esc(res.stdout || '');
      if (res.stderr) out += (out ? '\n' : '') + '<span class="out-err">' + esc(res.stderr) + '</span>';
      body = '<pre>' + (out || '<span class="out-dim">(ничего не напечатано)</span>') + '</pre>';
    }
    var hints = cls === 'bad' ? explainErrors(all) : [];
    var explain = hints.length ? '<div class="explain-err">' + icon('bulb', 16) + '<div><b>Что это значит</b><ul>' + hints.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div></div>' : '';
    el.innerHTML = '<div class="output ' + cls + '"><div class="output-head">' + icon(ic, 16) + '<span>' + head + '</span><span class="time">' + (res.durationMs / 1000).toFixed(2) + ' с</span></div>' + explain + body + '</div>';
  }

  // ------------------------------------------------------------------ Роутер
  function route() {
    document.body.classList.remove('menu-open');
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/');
    $$('.top-actions [data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === parts[0]); });
    if (parts[0] === 'lesson' && parts[1]) viewLesson(decodeURIComponent(parts[1]), parts[2]);
    else if (parts[0] === 'settings') viewSettings();
    else if (parts[0] === 'interview') viewInterview();
    else if (parts[0] === 'drill') viewDrill(parts[1] ? decodeURIComponent(parts[1]) : null);
    else if (parts[0] === 'track' && parts[1]) { setTrack(decodeURIComponent(parts[1])); history.replaceState(null, '', '#/'); viewDashboard(); }
    else viewDashboard();
    if (parts[0] !== 'lesson') window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------ Запуск
  $$('[data-icon]').forEach(function (n) { n.innerHTML = icon(n.dataset.icon, +n.dataset.size || 20); });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.copy-btn');
    if (!b) return;
    var code = $('pre', b.parentElement).textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { toast('Скопировано', 'ok', 1200); }, function () { toast('Не удалось скопировать', 'bad', 1500); });
  });
  $('#menuBtn').addEventListener('click', function () { document.body.classList.toggle('menu-open'); });
  $('#backdrop').addEventListener('click', function () { document.body.classList.remove('menu-open'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.body.classList.remove('menu-open'); });
  $('#themeBtn').addEventListener('click', function () {
    if (!S.p) return;
    var cur = document.documentElement.dataset.theme;
    S.p.settings.theme = cur === 'dark' ? 'light' : 'dark';
    S.p.settings.t = Date.now();
    applyTheme();
    if (S.course) save();
  });

  if (location.protocol === 'file:') {
    $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('terminal', 40) + '</div><h2>Сайт нужно открывать через сервер</h2>' +
      '<p class="muted">Вы открыли файл напрямую с диска — так задачи проверяться не могут. Запустите сервер в папке <code>go-academy</code>:</p>' +
      '<pre class="plain-pre">go run .</pre><p class="muted">и откройте в браузере адрес <a href="http://127.0.0.1:8080">http://127.0.0.1:8080</a>.</p></div>';
    return;
  }

  S.p = normalize(readLocal());
  var localAt = S.p.updatedAt;
  applyTheme();
  renderSync();
  Promise.all([
    api('/api/course'),
    pull().catch(function () { return undefined; })
  ]).then(function (res) {
    S.tracks = res[0].tracks;
    S.tracks.forEach(function (t) {
      t.flat = [];
      t.modules.forEach(function (m) {
        m.lessons.forEach(function (l) { l.module = m; l.track = t; l.index = t.flat.length; t.flat.push(l); S.byId[l.id] = l; });
      });
    });
    var wanted = null;
    try { wanted = localStorage.getItem(TRACK_KEY); } catch (e) { /* нет доступа к хранилищу */ }
    setTrack(wanted || 'go', true);
    var srv = res[1];
    if (srv !== undefined) {
      var srvAt = num(srv && srv.updatedAt);
      mergeInto(S.p, srv);
      writeLocal();
      // отправляем на сервер, только если в браузере было что-то, чего сервер мог не видеть
      if (localAt > 0 && localAt !== srvAt) { sync.dirty = true; push(); } else setSync('ok');
    } else {
      // сервер не отдал прогресс: ничего не отправляем, пока не прочитаем его состояние
      sync.dirty = localAt > 0;
      setSync('offline');
      schedulePush(3000);
    }
    applyTheme();
    renderRank();
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) {
    $('#main').innerHTML = '<div class="empty"><div class="empty-ic">' + icon('alert', 40) + '</div><h2>Не удалось загрузить курс</h2><p class="muted">' + esc(e.message) + '</p>' +
      '<p class="muted">Запустите сервер в папке <code>go-academy</code> командой <code>go run .</code> и обновите страницу.</p></div>';
  });
})();
