/*! class-html engine v1.0.0-dev | MIT | https://github.com/N-lifescience/class-html */
(function () {
'use strict';
const VERSION = '1.0.0-dev';
/* ---- 00-core.js ---- */
// 공통 상수, 작은 DOM 도우미, 이벤트 훅, 공개 객체 ClassHTML.
const STAGE_W = 1280;
const STAGE_H = 720;
const SVG_NS = 'http://www.w3.org/2000/svg';

const hooks = {};
function on(name, fn) { (hooks[name] = hooks[name] || []).push(fn); }
function emit(name, ...args) {
  for (const fn of hooks[name] || []) {
    try { fn(...args); } catch (err) { console.error('[class-html]', name, err); }
  }
}

// h('button', { class: 'x', text: '다음', onclick: fn }, 자식...) — innerHTML 없이 요소를 만든다.
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 단축키 이름. 한글 입력 상태(key가 'Process'나 'ㅅ')에서도 같은 자리의 영문 글자로 읽는다.
function keyName(e) {
  if (/^Key[A-Z]$/.test(e.code || '')) return e.code.slice(3).toLowerCase();
  if (e.code === 'Slash' && e.shiftKey) return '?';
  return String(e.key || '').toLowerCase();
}

const ClassHTML = {
  version: typeof VERSION === 'string' ? VERSION : 'dev',
  onShow(fn) { on('show', fn); },
  onHide(fn) { on('hide', fn); },
};

/* ---- 10-steps.js ---- */
// 순수 단계 로직. 슬라이드 안 .step 요소를 묶음 단위로 하나씩 연다.
// keys: 문서 순서대로 각 .step의 data-step 값(숫자) 또는 null.
// data-step이 없는 단계는 바로 앞 단계 다음에 열린다.
const Steps = {
  groups(keys) {
    const byKey = new Map();
    let base = 0;
    let n = 0;
    keys.forEach((v, i) => {
      let key;
      if (typeof v === 'number' && Number.isFinite(v)) { key = v; base = v; n = 0; } else { n += 1; key = base + n * 1e-6; }
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(i);
    });
    return Array.from(byKey.entries()).sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  },

  next(state, counts) {
    if (state.shown < counts[state.slide]) return { slide: state.slide, shown: state.shown + 1 };
    if (state.slide < counts.length - 1) return { slide: state.slide + 1, shown: 0 };
    return state;
  },

  prev(state, counts) {
    if (state.shown > 0) return { slide: state.slide, shown: state.shown - 1 };
    if (state.slide > 0) return { slide: state.slide - 1, shown: counts[state.slide - 1] };
    return state;
  },

  go(index, counts, allShown) {
    const slide = clamp(index, 0, counts.length - 1);
    return { slide, shown: allShown ? counts[slide] : 0 };
  },
};

/* ---- 11-stage.js ---- */
// 1280×720 고정 무대를 만들고 슬라이드를 옮겨 담아 창 크기에 맞춘다.
const Stage = {
  viewport: null,
  deck: null,
  slides: [],
  scale: 1,

  init() {
    this.slides = qsa('section.slide');
    if (!this.slides.length) {
      const empty = h('section', { class: 'slide' }, h('h2', { text: '슬라이드가 없어요' }),
        h('p', { text: '<section class="slide"> 요소를 넣어 주세요.' }));
      document.body.append(empty);
      this.slides = [empty];
    }
    this.viewport = h('div', { class: 'ch-viewport' });
    this.deck = h('div', { class: 'ch-deck' });
    this.viewport.append(this.deck);
    document.body.prepend(this.viewport);
    this.slides.forEach((s, i) => {
      this.deck.append(s);
      s.dataset.key = s.id || `s${i + 1}`;
      s.dataset.page = `${i + 1} / ${this.slides.length}`;
    });
    if (!document.body.dataset.tool) document.body.dataset.tool = 'hand';
    window.addEventListener('resize', () => this.fit());
    this.fit();
  },

  fit() {
    const w = this.viewport.clientWidth || window.innerWidth;
    const hgt = this.viewport.clientHeight || window.innerHeight;
    this.scale = Math.min(w / STAGE_W, hgt / STAGE_H);
    this.deck.style.transform = `scale(${this.scale})`;
    emit('resize', this.scale);
  },

  // 화면 좌표(clientX/Y) → 무대 좌표(0~1280, 0~720)
  toStage(clientX, clientY) {
    const r = this.deck.getBoundingClientRect();
    return [(clientX - r.left) * STAGE_W / r.width, (clientY - r.top) * STAGE_H / r.height];
  },
};

/* ---- 12-nav.js ---- */
// 넘기기: 단계 공개, 키보드, 손 모드 스와이프, 주소 #쪽, 진행 막대.
const Nav = {
  state: { slide: 0, shown: 0 },
  groups: [],
  counts: [],
  override: null,   // 칠판 모드처럼 넘기기를 가로채는 대상 { next(), prev(), close() }
  digits: '',
  digitTimer: 0,
  progress: null,

  init() {
    this.groups = Stage.slides.map((slide) => {
      const steps = qsa('.step', slide);
      const keys = steps.map((el) => (el.dataset.step != null && el.dataset.step !== '' ? Number(el.dataset.step) : null));
      return Steps.groups(keys).map((g) => g.map((i) => steps[i]));
    });
    this.counts = this.groups.map((g) => g.length);
    const fromHash = parseInt(location.hash.slice(1), 10);
    this.state = Steps.go(Number.isFinite(fromHash) ? fromHash - 1 : 0, this.counts, false);
    this.progress = h('div', { class: 'ch-progress', 'aria-hidden': 'true' }, h('i'));
    document.body.append(this.progress);
    document.addEventListener('keydown', (e) => this.onKey(e));
    this.bindSwipe();
    this.render(-1);
  },

  set(next) {
    const before = this.state.slide;
    this.state = next;
    this.render(before);
  },

  next() {
    if (this.override) return this.override.next();
    this.set(Steps.next(this.state, this.counts));
  },

  prev() {
    if (this.override) return this.override.prev();
    this.set(Steps.prev(this.state, this.counts));
  },

  // index는 0부터 센다(화면의 쪽 번호·#주소·숫자+Enter는 1부터). 숫자가 아니면 무시한다.
  go(index, allShown) {
    if (!Number.isFinite(index)) return;
    if (this.override) this.override.close();
    this.set(Steps.go(Math.round(index), this.counts, !!allShown));
  },

  render(before) {
    const { slide, shown } = this.state;
    Stage.slides.forEach((s, i) => s.classList.toggle('is-active', i === slide));
    this.groups[slide].forEach((g, gi) => g.forEach((el) => el.classList.toggle('is-shown', gi < shown)));
    this.progress.firstChild.style.transform = `scaleX(${(slide + 1) / Stage.slides.length})`;
    if (before !== slide) {
      if (before >= 0) emit('hide', Stage.slides[before], before);
      emit('show', Stage.slides[slide], slide);
      try { history.replaceState(null, '', `#${slide + 1}`); } catch (err) { /* 잦은 호출을 막는 브라우저가 있다 */ }
    }
  },

  onKey(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) { emit('key', e); return; }
    const k = e.key;
    if (/^[0-9]$/.test(k)) {
      this.digits += k;
      clearTimeout(this.digitTimer);
      this.digitTimer = setTimeout(() => { this.digits = ''; }, 1500);
      return;
    }
    if (k === 'Enter' && this.digits) {
      e.preventDefault();
      const n = parseInt(this.digits, 10);
      this.digits = '';
      this.go(n - 1);
      return;
    }
    this.digits = '';   // 쪽 번호를 치다가 다른 키를 누르면 번호는 버린다
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
      e.preventDefault();
      this.next();
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
      e.preventDefault();
      this.prev();
    } else if (k === 'Home') {
      e.preventDefault();
      this.go(0);
    } else if (k === 'End') {
      e.preventDefault();
      this.go(this.counts.length - 1);
    } else {
      emit('key', e);   // 나머지 글자 키는 각 모듈(목차, 툴바, 칠판, 점검)이 처리
    }
  },

  // 손 모드에서 손가락으로 좌우로 밀면 넘긴다.
  bindSwipe() {
    let start = null;
    Stage.deck.addEventListener('pointerdown', (e) => {
      // 두 번째 손가락이 닿으면(isPrimary 아님) 스와이프를 취소한다.
      const ok = e.isPrimary && e.pointerType === 'touch' && document.body.dataset.tool === 'hand'
        && !(e.target.closest && e.target.closest('input, textarea, select, [data-no-ink]'));
      start = ok ? [e.clientX, e.clientY] : null;
    });
    Stage.deck.addEventListener('pointercancel', () => { start = null; });
    Stage.deck.addEventListener('pointerup', (e) => {
      if (!start || !e.isPrimary) return;
      const dx = e.clientX - start[0];
      const dy = e.clientY - start[1];
      start = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) { if (dx < 0) this.next(); else this.prev(); }
    });
  },
};

/* ---- 13-panels.js ---- */
// 목차, 단축키 도움말, 화면 가리기(검정·흰색), 전체 화면.
const Panels = {
  toc: null,
  help: null,
  shade: null,

  HELP: [
    ['→ · ↓ · Space · PageDown · Enter', '다음 (단계 → 다음 장)'],
    ['← · ↑ · PageUp · Backspace', '이전'],
    ['Home · End', '처음 · 끝'],
    ['숫자 + Enter', '그 쪽으로 이동'],
    ['T', '목차'],
    ['F', '전체 화면'],
    ['B · W', '화면 가리기 (검정 · 흰색)'],
    ['P · H · E · L', '펜 · 형광펜 · 지우개 · 레이저'],
    ['Esc', '손(조작) 모드 · 창 닫기'],
    ['C', '칠판 ↔ 슬라이드'],
    ['Ctrl + Z', '판서 되돌리기'],
    ['D', '자동 점검'],
    ['?', '이 도움말'],
  ],

  init() {
    this.toc = h('nav', { class: 'ch-panel ch-toc', 'aria-label': '목차' }, h('h2', { text: '목차' }), this.buildToc());
    // 목차 버튼을 키보드(Enter·Space)로 누를 때 넘기기 키로 가로채이지 않게 한다.
    this.toc.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    this.help = h('div', { class: 'ch-panel ch-help', role: 'dialog', 'aria-label': '도움말' },
      h('h2', { text: '단축키' }),
      h('dl', null, ...this.HELP.flatMap(([k, d]) => [h('dt', { text: k }), h('dd', { text: d })])));
    this.shade = h('div', { class: 'ch-shade', 'data-mode': '', 'aria-hidden': 'true', onclick: () => { this.shade.dataset.mode = ''; } });
    document.body.append(this.toc, this.help, this.shade);
    on('show', (_, i) => this.markToc(i));
    on('key', (e) => this.onKey(e));
  },

  buildToc() {
    const list = h('ol');
    Stage.slides.forEach((s, i) => {
      const heading = s.querySelector('h1, h2, h3');
      const title = s.dataset.title || (heading && heading.textContent.trim()) || `${i + 1}쪽`;
      list.append(h('li', null, h('button', { type: 'button', onclick: () => { Nav.go(i); this.close(); } },
        h('b', { text: String(i + 1) }), h('span', { text: title }), s.dataset.sec ? h('small', { text: s.dataset.sec }) : null)));
    });
    return list;
  },

  markToc(i) {
    qsa('button', this.toc).forEach((b, k) => {
      b.classList.toggle('is-current', k === i);
      if (k === i) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  },

  toggle(panel) {
    const open = !panel.classList.contains('is-open');
    this.close();
    panel.classList.toggle('is-open', open);
  },

  close() {
    this.toc.classList.remove('is-open');
    this.help.classList.remove('is-open');
    emit('panels-close');
  },

  shadeTo(mode) { this.shade.dataset.mode = this.shade.dataset.mode === mode ? '' : mode; },

  fullscreen() {
    const warn = (err) => console.warn('[class-html] 전체 화면', err);
    const p = document.fullscreenElement
      ? document.exitFullscreen && document.exitFullscreen()
      : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(warn);
  },

  onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const k = keyName(e);
    if (k === 't') this.toggle(this.toc);
    else if (k === '?') this.toggle(this.help);
    else if (k === 'f') this.fullscreen();
    else if (k === 'b') this.shadeTo('black');
    else if (k === 'w') this.shadeTo('white');
    else if (k === 'escape') { this.close(); this.shade.dataset.mode = ''; }
  },
};

/* ---- 20-ink-geom.js ---- */
// 순수 획 기하. 점 배열은 [x0, y0, x1, y1, ...] (무대 px).
const InkGeom = {
  round(v) { return Math.round(v * 10) / 10; },

  distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  },

  bbox(p) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      x0 = Math.min(x0, p[i]);
      x1 = Math.max(x1, p[i]);
      y0 = Math.min(y0, p[i + 1]);
      y1 = Math.max(y1, p[i + 1]);
    }
    return [x0, y0, x1, y1];
  },

  // (x, y)에 놓인 반지름 r의 지우개가 획에 닿는가
  hit(stroke, x, y, r) {
    const p = stroke.p;
    const reach = r + stroke.w / 2;
    const [x0, y0, x1, y1] = InkGeom.bbox(p);
    if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) return false;
    if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach;
    for (let i = 0; i + 3 < p.length; i += 2) {
      if (InkGeom.distToSeg(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true;
    }
    return false;
  },

  // 마지막 점과 minDist보다 가까우면 버린다(획 데이터를 작게)
  keep(p, x, y, minDist) {
    const n = p.length;
    return n < 2 || Math.hypot(x - p[n - 2], y - p[n - 1]) >= minDist;
  },
};

/* ---- 21-ink-model.js ---- */
// 순수 판서 문서 모델: 슬라이드별 획, 칠판 쪽, 되돌리기, 정화, 백업 파일.
// Doc    = { v: 1, slides: { [slideKey]: Stroke[] }, boards: [{ bg, strokes: Stroke[] }], board: number }
// Stroke = { t: 'pen' | 'hl', c: '#rrggbb', w: number, p: number[] }
const BOARD_BGS = ['white', 'grid', 'lines', 'green', 'coord'];
const BAD_KEYS = ['__proto__', 'constructor', 'prototype'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const InkModel = {
  emptyDoc() { return { v: 1, slides: {}, boards: [{ bg: 'white', strokes: [] }], board: 0 }; },

  page(doc, ref) {
    if (ref.kind === 'board') return doc.boards[ref.index] ? doc.boards[ref.index].strokes : null;
    if (BAD_KEYS.includes(ref.key)) return null;
    if (!own(doc.slides, ref.key)) doc.slides[ref.key] = [];
    return doc.slides[ref.key];
  },

  // 쪽(획 배열)마다 되돌리기 기록. 쪽이 사라지면 기록도 함께 사라진다.
  history() { return new WeakMap(); },

  stack(hist, page) {
    if (!hist.has(page)) hist.set(page, []);
    return hist.get(page);
  },

  add(hist, page, stroke) {
    page.push(stroke);
    InkModel.stack(hist, page).push({ op: 'add', stroke });
  },

  // 지우개 원에 닿은 획을 모두 빼고, 뺀 순서대로 [{ i, s }]를 돌려준다.
  eraseAt(page, x, y, r) {
    const removed = [];
    for (let i = page.length - 1; i >= 0; i--) {
      if (InkGeom.hit(page[i], x, y, r)) removed.push({ i, s: page.splice(i, 1)[0] });
    }
    return removed;
  },

  // 지우개로 한 번 문지른 동작 전체를 되돌리기 한 칸으로.
  commitErase(hist, page, removed) {
    if (removed.length) InkModel.stack(hist, page).push({ op: 'erase', removed });
  },

  clear(hist, page) {
    if (!page.length) return false;
    const strokes = page.splice(0, page.length);
    InkModel.stack(hist, page).push({ op: 'clear', strokes });
    return true;
  },

  undo(hist, page) {
    const entry = InkModel.stack(hist, page).pop();
    if (!entry) return false;
    if (entry.op === 'add') {
      const i = page.lastIndexOf(entry.stroke);
      if (i >= 0) page.splice(i, 1);
    } else if (entry.op === 'erase') {
      for (let k = entry.removed.length - 1; k >= 0; k--) page.splice(entry.removed[k].i, 0, entry.removed[k].s);
    } else if (entry.op === 'clear') {
      for (const s of entry.strokes) page.push(s);   // 펼치기(...)는 획이 아주 많으면 RangeError
    }
    return true;
  },

  addBoard(doc, bg) {
    doc.boards.splice(doc.board + 1, 0, { bg: BOARD_BGS.includes(bg) ? bg : 'white', strokes: [] });
    doc.board += 1;
    return doc.board;
  },

  deleteBoard(doc) {
    if (doc.boards.length <= 1) {
      doc.boards[0].strokes = [];   // 새 배열: 지운 칠판의 되돌리기 기록이 따라오지 않는다
      doc.board = 0;
      return 0;
    }
    doc.boards.splice(doc.board, 1);
    doc.board = Math.min(doc.board, doc.boards.length - 1);
    return doc.board;
  },

  sanitizeStroke(s) {
    if (!s || (s.t !== 'pen' && s.t !== 'hl')) return null;
    if (typeof s.c !== 'string' || !/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s.c)) return null;
    if (typeof s.w !== 'number' || !(s.w > 0 && s.w <= 80)) return null;
    if (!Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2 || s.p.length > 40000) return null;
    if (!s.p.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    return { t: s.t, c: s.c, w: s.w, p: s.p.slice() };
  },

  sanitizeDoc(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const clean = (arr) => (Array.isArray(arr) ? arr.map(InkModel.sanitizeStroke).filter(Boolean) : []);
    const doc = InkModel.emptyDoc();
    if (d.slides && typeof d.slides === 'object' && !Array.isArray(d.slides)) {
      for (const [k, v] of Object.entries(d.slides)) {
        if (BAD_KEYS.includes(k) || k.length > 200) continue;
        const strokes = clean(v);
        if (strokes.length) doc.slides[k] = strokes;
      }
    }
    if (Array.isArray(d.boards) && d.boards.length) {
      doc.boards = d.boards.slice(0, 200).map((b) => ({
        bg: b && BOARD_BGS.includes(b.bg) ? b.bg : 'white',
        strokes: clean(b && b.strokes),
      }));
    }
    const b = d.board;
    doc.board = Number.isInteger(b) && b >= 0 && b < doc.boards.length ? b : 0;
    return doc;
  },

  backup(deck, docsByClass) {
    return JSON.stringify({ app: 'class-html', kind: 'ink-backup', v: 1, deck, savedAt: new Date().toISOString(), classes: docsByClass });
  },

  parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch (err) { return { ok: false, error: '파일을 읽을 수 없어요 (JSON 형식이 아님)' }; }
    if (!data || data.app !== 'class-html' || data.kind !== 'ink-backup' || !data.classes || typeof data.classes !== 'object' || Array.isArray(data.classes)) {
      return { ok: false, error: 'class-html 판서 백업 파일이 아니에요' };
    }
    const classes = {};
    for (const [name, d] of Object.entries(data.classes)) {
      if (BAD_KEYS.includes(name) || !name.trim() || name.length > 20) continue;
      const doc = InkModel.sanitizeDoc(d);
      if (doc) classes[name] = doc;
    }
    return { ok: true, deck: typeof data.deck === 'string' ? data.deck : '', classes };
  },
};

/* ---- 22-store.js ---- */
// 키-값 저장소. IndexedDB가 안 되면 localStorage, 그것도 안 되면 메모리(창을 닫으면 사라짐).
const Store = {
  backend: 'memory',
  db: null,
  mem: new Map(),

  async init() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('class-html', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error('indexedDB timeout')), 3000);
      });
      this.backend = 'idb';
      return;
    } catch (err) { /* localStorage로 */ }
    try {
      localStorage.setItem('class-html:probe', '1');
      localStorage.removeItem('class-html:probe');
      this.backend = 'local';
    } catch (err) {
      this.backend = 'memory';
      console.warn('[class-html] 브라우저 저장소를 쓸 수 없어 판서가 창을 닫으면 사라집니다.');
    }
  },

  tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(req.result);
      // 용량 초과 같은 커밋 실패는 요청 오류 없이 abort만 온다
      t.onerror = t.onabort = () => reject(t.error || req.error || new Error('indexedDB transaction failed'));
    });
  },

  // 수업 중에 멈추거나 예외를 던지지 않도록, 실패하면 경고만 남기고 fallback을 돌려준다.
  async guard(what, key, fallback, fn) {
    try { return await fn(); } catch (err) {
      console.warn(`[class-html] 저장소 ${what} 실패:`, key, err);
      return fallback;
    }
  },

  get(key) {
    return this.guard('읽기', key, undefined, () => {
      if (this.backend === 'idb') return this.tx('readonly', (s) => s.get(key));
      if (this.backend === 'local') {
        const v = localStorage.getItem(`class-html:${key}`);
        return v == null ? undefined : JSON.parse(v);
      }
      return this.mem.get(key);
    });
  },

  set(key, value) {
    return this.guard('쓰기', key, false, async () => {
      if (this.backend === 'idb') await this.tx('readwrite', (s) => s.put(value, key));
      else if (this.backend === 'local') localStorage.setItem(`class-html:${key}`, JSON.stringify(value));
      else this.mem.set(key, value);
      return true;
    });
  },

  del(key) {
    return this.guard('지우기', key, false, async () => {
      if (this.backend === 'idb') await this.tx('readwrite', (s) => s.delete(key));
      else if (this.backend === 'local') localStorage.removeItem(`class-html:${key}`);
      else this.mem.delete(key);
      return true;
    });
  },
};

/* ---- 23-session.js ---- */
// 현재 반과 그 반의 판서 문서. 저장은 0.5초 늦춰서 한다.
// 반 바꾸기·추가·삭제·비우기·백업은 run으로 하나씩 차례로 하고, 현재 반과 문서는 swap으로 한 번에 바꾼다.
// 그래서 flush(지연 저장, 창 숨김, 창 닫기)가 언제 불려도 문서는 자기 반 키에만 써진다.
const Session = {
  deck: 'deck',
  classes: ['기본'],
  current: '기본',
  doc: null,
  hist: null,
  timer: 0,
  queue: Promise.resolve(),

  deckKey() {
    const raw = document.documentElement.dataset.deck || document.title || location.pathname;
    return String(raw).trim().slice(0, 120) || 'deck';
  },

  async init() {
    this.deck = this.deckKey();
    const saved = await Store.get('classes');
    if (saved && Array.isArray(saved.list)) {
      // 저장소 값은 믿지 않는다: 문자열, 20자 이하, 위험 키 아님, 중복 없음
      const ok = (c) => typeof c === 'string' && c.trim() && c.length <= 20 && !BAD_KEYS.includes(c);
      const list = [...new Set(saved.list.filter(ok))].slice(0, 50);
      if (list.length) {
        this.classes = list;
        this.current = list.includes(saved.current) ? saved.current : list[0];
      }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    window.addEventListener('pagehide', () => this.flush());
    await this.loadCurrent();
  },

  key(cls) { return `ink:${this.deck}:${cls}`; },

  async load(cls) { return InkModel.sanitizeDoc(await Store.get(this.key(cls))) || InkModel.emptyDoc(); },

  run(fn) {
    const p = this.queue.then(fn);
    this.queue = p.catch(() => {});
    return p;
  },

  swap(cls, doc) {
    clearTimeout(this.timer);
    this.current = cls;
    this.doc = doc;
    this.hist = InkModel.history();
    emit('session');
  },

  async loadCurrent() { this.swap(this.current, await this.load(this.current)); },

  changed() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  },

  async flush() {
    clearTimeout(this.timer);
    if (this.doc) await Store.set(this.key(this.current), this.doc);
  },

  async saveClasses() { await Store.set('classes', { list: this.classes, current: this.current }); },

  switchTo(cls) {
    return this.run(async () => {
      if (!this.classes.includes(cls) || cls === this.current) return;
      const doc = await this.load(cls);
      const prevKey = this.key(this.current);
      const prevDoc = this.doc;
      this.swap(cls, doc);
      await Store.set(prevKey, prevDoc);   // 읽는 동안 그린 획까지 옛 반에 저장
      await this.saveClasses();
    });
  },

  addClass(name) {
    return this.run(async () => {
      const n = String(name || '').trim().slice(0, 20);
      if (!n || this.classes.includes(n) || BAD_KEYS.includes(n)) return false;
      this.classes.push(n);
      await this.saveClasses();
      return true;
    });
  },

  removeClass(cls) {
    return this.run(async () => {
      if (this.classes.length <= 1 || !this.classes.includes(cls)) return false;
      this.classes = this.classes.filter((c) => c !== cls);
      // 현재 반이면 먼저 다른 반으로 옮긴 뒤 지운다(대기 중 저장은 swap이 버린다). 그래야 flush가 지운 키를 되살리지 못한다.
      if (cls === this.current) this.swap(this.classes[0], await this.load(this.classes[0]));
      await Store.del(this.key(cls));
      await this.saveClasses();
      return true;
    });
  },

  clearCurrent() {
    return this.run(async () => {
      this.swap(this.current, InkModel.emptyDoc());
      await this.flush();
    });
  },

  exportBackup() {
    return this.run(async () => {
      const all = {};
      // 현재 반은 메모리의 문서를 쓴다: 저장이 실패하고 있어도 백업은 된다
      for (const c of this.classes) all[c] = c === this.current ? this.doc : await this.load(c);
      return InkModel.backup(this.deck, all);
    });
  },

  async importBackup(text) {
    const r = InkModel.parseBackup(text);
    if (!r.ok) return r;
    return this.run(async () => {
      for (const [c, d] of Object.entries(r.classes)) {
        if (!this.classes.includes(c)) this.classes.push(c);
        if (c === this.current) this.swap(c, d);
        await Store.set(this.key(c), d);
      }
      await this.saveClasses();
      return r;
    });
  },
};

/* ---- 99-boot.js ---- */
// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Stage.init();
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
  await Store.init();
  await Session.init();
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML._internal = { on, emit, Stage, Nav, Steps, Panels, InkGeom, InkModel, Store, Session };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
