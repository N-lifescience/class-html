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
  enterAll: false,
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

  // all: 장에 들어올 때 단계 막대를 끝 칸으로 둘지(이전 장으로 돌아올 때)
  set(next, all) {
    const before = this.state.slide;
    this.state = next;
    this.enterAll = !!all;
    this.render(before);
  },

  // 지금 장에서 다음에 열릴 단계의 첫 요소, 마지막으로 열린 단계의 첫 요소
  nextStepEl() { const g = this.groups[this.state.slide][this.state.shown]; return g ? g[0] : null; },
  lastStepEl() { const g = this.groups[this.state.slide][this.state.shown - 1]; return g ? g[0] : null; },

  next() {
    if (this.override) return this.override.next();
    if (Stepper.advance(this.state.slide, this.nextStepEl())) return;   // 단계 막대가 먼저면 한 칸 연다
    this.set(Steps.next(this.state, this.counts), false);
  },

  prev() {
    if (this.override) return this.override.prev();
    if (Stepper.retreat(this.state.slide, this.lastStepEl())) return;
    const next = Steps.prev(this.state, this.counts);
    this.set(next, next.slide !== this.state.slide);
  },

  // el이 든 단계까지 연다(지금 장일 때만). 정답 상자 ✓, 분류 완료 등이 쓴다.
  revealTo(el) {
    if (!el) return false;
    const { slide, shown } = this.state;
    const gi = this.groups[slide].findIndex((g) => g.some((s) => s === el || s.contains(el) || el.contains(s)));
    if (gi < 0 || shown > gi) return false;
    this.set({ slide, shown: gi + 1 }, false);
    return true;
  },

  // index는 0부터 센다(화면의 쪽 번호·#주소·숫자+Enter는 1부터). 숫자가 아니면 무시한다.
  go(index, allShown) {
    if (!Number.isFinite(index)) return;
    if (this.override) this.override.close();
    const before = this.state.slide;
    this.set(Steps.go(Math.round(index), this.counts, !!allShown), !!allShown);
    if (this.state.slide === before) Stepper.enter(before, !!allShown);   // 같은 장으로 가도 단계처럼 처음 상태로
  },

  render(before) {
    const { slide, shown } = this.state;
    Stage.slides.forEach((s, i) => s.classList.toggle('is-active', i === slide));
    this.groups[slide].forEach((g, gi) => g.forEach((el) => el.classList.toggle('is-shown', gi < shown)));
    this.progress.firstChild.style.transform = `scaleX(${(slide + 1) / Stage.slides.length})`;
    if (before !== slide) {
      Stepper.enter(slide, this.enterAll);
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
  unsaved: new Map(),   // 저장에 실패한 반 문서: 창을 닫기 전까지는 반을 오가도, 백업에도 남는다

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

  async load(cls) {
    if (this.unsaved.has(cls)) return this.unsaved.get(cls);
    return InkModel.sanitizeDoc(await Store.get(this.key(cls))) || InkModel.emptyDoc();
  },

  async save(cls, doc) {
    if (await Store.set(this.key(cls), doc)) this.unsaved.delete(cls);
    else this.unsaved.set(cls, doc);
  },

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
    if (this.doc) await this.save(this.current, this.doc);
  },

  async saveClasses() { await Store.set('classes', { list: this.classes, current: this.current }); },

  switchTo(cls) {
    return this.run(async () => {
      if (!this.classes.includes(cls) || cls === this.current) return;
      const doc = await this.load(cls);
      const prev = this.current;
      const prevDoc = this.doc;
      this.swap(cls, doc);
      await this.save(prev, prevDoc);   // 읽는 동안 그린 획까지 옛 반에 저장
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
      this.unsaved.delete(cls);
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
        await this.save(c, d);
      }
      await this.saveClasses();
      return r;
    });
  },
};

/* ---- 24-ink.js ---- */
// 판서층: 화면 실제 픽셀 크기의 캔버스에 획을 그리고, 포인터 입력을 판서로 바꾼다.
const PEN_COLORS = ['#1F2328', '#D7263D', '#1F6FD1', '#2E9E6A', '#E8701A'];
const PEN_WHITE = '#FFFFFF';
const HL_COLORS = ['#FFE45C', '#B6F09C', '#FFB3D1', '#9FD8FF'];
const PEN_WIDTHS = [3, 6, 12];
const HL_WIDTH = 24;
const ERASER_R = 16;
const DRAG_PX = 8;
// 도구와 상관없이 늘 조작되는 요소
const ALWAYS_LIVE = 'input, select, textarea, [contenteditable=""], [contenteditable="true"], [data-no-ink]';
// 톡 누르면 작동하고 끌면 판서가 되는 요소
const TAPPABLE = 'button, a[href], label, summary, [role="button"], [data-tap], .blank';

const Tools = {
  current: 'hand',
  penColor: PEN_COLORS[0],
  penWidth: PEN_WIDTHS[1],
  hlColor: HL_COLORS[0],
  set(tool) {
    this.current = tool;
    document.body.dataset.tool = tool;
    emit('tool', tool);
  },
};

const Ink = {
  layer: null,
  cv: {},
  ctx: {},
  ref: null,
  gesture: null,
  suppressClick: false,
  palmErase: false,
  laser: [],
  laserRAF: 0,

  init() {
    this.layer = h('div', { class: 'ch-ink', 'aria-hidden': 'true' });
    for (const name of ['hl', 'pen', 'laser']) {
      this.cv[name] = h('canvas', { class: `ch-ink-${name}` });
      this.ctx[name] = this.cv[name].getContext('2d');
      this.layer.append(this.cv[name]);
    }
    Stage.deck.append(this.layer);
    const d = Stage.deck;
    d.addEventListener('pointerdown', (e) => this.down(e), true);
    d.addEventListener('pointermove', (e) => this.move(e), true);
    // 덱 밖에서 손을 떼도 획이 끝나도록 창에서 듣는다
    window.addEventListener('pointerup', (e) => this.up(e), true);
    window.addEventListener('pointercancel', (e) => this.up(e), true);
    // 펜을 든 채로 링크·그림을 끌면 브라우저 끌어 놓기가 포인터를 가로채 획이 끊긴다
    d.addEventListener('dragstart', (e) => {
      if (Tools.current !== 'hand' && !(e.target.closest && e.target.closest(ALWAYS_LIVE))) e.preventDefault();
    }, true);
    d.addEventListener('click', (e) => {
      if (!this.suppressClick) return;
      this.suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    on('resize', () => this.resize());
    on('show', (slide) => { if (!Nav.override) this.setPage({ kind: 'slide', key: slide.dataset.key }); });
    on('session', () => { this.cancelGesture(); this.redraw(); });
    this.resize();
    this.setPage({ kind: 'slide', key: Stage.slides[Nav.state.slide].dataset.key });
  },

  resize() {
    const ratio = Stage.scale * (window.devicePixelRatio || 1);
    for (const name of ['hl', 'pen', 'laser']) {
      this.cv[name].width = Math.max(1, Math.round(STAGE_W * ratio));
      this.cv[name].height = Math.max(1, Math.round(STAGE_H * ratio));
      this.ctx[name].setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    this.redraw();
  },

  get page() { return this.ref && Session.doc ? InkModel.page(Session.doc, this.ref) : null; },

  setPage(ref) {
    this.cancelGesture();
    this.ref = ref;
    this.redraw();
  },

  cancelGesture() {
    const g = this.gesture;
    this.gesture = null;
    // 지우개는 입력 도중 원래 배열을 바꾼다. 중간에 장·반을 바꾸면 되돌려 취소한다.
    if (g) {
      for (let i = g.removed.length - 1; i >= 0; i--) {
        const removed = g.removed[i];
        g.page.splice(removed.i, 0, removed.s);
      }
      // 입력 중 지연 저장이 실행됐어도 취소하여 복구한 문서를 다시 저장한다.
      if (g.removed.length && Session.doc === g.doc) Session.changed();
      try { Stage.deck.releasePointerCapture(g.id); } catch (err) { /* 합성 이벤트 */ }
    }
    this.suppressClick = false;
    if (this.laserRAF) cancelAnimationFrame(this.laserRAF);
    this.laserRAF = 0;
    this.laser = [];
    this.ctx.laser.clearRect(0, 0, STAGE_W, STAGE_H);
  },

  redraw() {
    this.ctx.hl.clearRect(0, 0, STAGE_W, STAGE_H);
    this.ctx.pen.clearRect(0, 0, STAGE_W, STAGE_H);
    const page = this.page;
    if (page) for (const s of page) this.drawStrokeOn(this.ctx[s.t === 'hl' ? 'hl' : 'pen'], s);
  },

  drawStrokeOn(ctx, s) {
    const p = s.p;
    ctx.strokeStyle = s.c;
    ctx.fillStyle = s.c;
    ctx.lineWidth = s.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (p.length === 2) {
      ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  },

  toolFor(e) {
    if (Tools.current === 'hand') return null;
    if (this.palmErase && e.pointerType === 'touch' && e.width * e.height > 3600) return 'eraser';
    return Tools.current;
  },

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this.gesture) {
      if (e.pointerId !== this.gesture.id) {              // 두 번째 손가락·손바닥은 무시
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.up(e);                                         // 같은 포인터가 다시 눌렸다: 놓친 pointerup 대신 지금 끝낸다
    }
    this.suppressClick = false;
    const tool = this.toolFor(e);
    if (!tool || !this.page) return;
    const target = e.target && e.target.closest ? e.target : null;
    if (target && target.closest(ALWAYS_LIVE)) return;   // 슬라이더·입력칸은 늘 조작
    const [x, y] = Stage.toStage(e.clientX, e.clientY);
    this.gesture = { id: e.pointerId, tool, x0: x, y0: y, started: false, stroke: null, removed: [], page: this.page, doc: Session.doc };
    if (!(target && target.closest(TAPPABLE))) this.begin(e); // 누를 수 있는 요소 위면 끌 때까지 기다린다
  },

  begin(e) {
    const g = this.gesture;
    g.started = true;
    e.preventDefault();
    try { Stage.deck.setPointerCapture(g.id); } catch (err) { /* 합성 이벤트에는 캡처가 없다 */ }
    const start = [InkGeom.round(g.x0), InkGeom.round(g.y0)];
    if (g.tool === 'pen') g.stroke = { t: 'pen', c: Tools.penColor, w: Tools.penWidth, p: start };
    else if (g.tool === 'hl') g.stroke = { t: 'hl', c: Tools.hlColor, w: HL_WIDTH, p: start };
    this.extend(g.x0, g.y0);
  },

  move(e) {
    const g = this.gesture;
    if (!g || e.pointerId !== g.id) return;
    if (!g.started) {
      const [x, y] = Stage.toStage(e.clientX, e.clientY);
      if (Math.hypot(x - g.x0, y - g.y0) < DRAG_PX) return;
      this.suppressClick = true;                          // 끌었으니 뒤따르는 클릭은 취소
      this.begin(e);
    }
    e.preventDefault();
    const list = e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
    for (const ev of list) {
      const [x, y] = Stage.toStage(ev.clientX, ev.clientY);
      this.extend(x, y);
    }
  },

  extend(x, y) {
    const g = this.gesture;
    if (g.stroke) {
      const p = g.stroke.p;
      if (!InkGeom.keep(p, x, y, 0.8)) return;
      const ctx = this.ctx[g.stroke.t === 'hl' ? 'hl' : 'pen'];
      ctx.strokeStyle = g.stroke.c;
      ctx.lineWidth = g.stroke.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p[p.length - 2], p[p.length - 1]);
      ctx.lineTo(x, y);
      ctx.stroke();
      p.push(InkGeom.round(x), InkGeom.round(y));
    } else if (g.tool === 'eraser') {
      // 빠르게 문질러 표본 사이가 벌어져도 빠짐없이 지우도록 반지름의 절반 간격으로 채운다
      const [x0, y0] = g.last || [x, y];
      const n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / (ERASER_R / 2)));
      const before = g.removed.length;
      for (let i = 1; i <= n; i++) g.removed.push(...InkModel.eraseAt(g.page, x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n, ERASER_R));
      if (g.removed.length > before) this.redraw();
      g.last = [x, y];
      this.ring(x, y);
    } else if (g.tool === 'laser') {
      this.laser.push({ x, y, t: performance.now() });
      this.animateLaser();
    }
  },

  up(e) {
    const g = this.gesture;
    if (!g || e.pointerId !== g.id) return;
    this.gesture = null;
    // 뒤따르는 클릭은 같은 차례에 온다. 클릭이 없으면(취소, 덱 밖에서 뗌) 다음 클릭을 막지 않게 풀어 둔다.
    if (this.suppressClick) setTimeout(() => { this.suppressClick = false; });
    if (!g.started) return;                               // 톡 누름: 클릭을 그대로 보낸다
    if (g.stroke) {
      InkModel.add(Session.hist, this.page, g.stroke);
      this.redraw();
      Session.changed();
    } else if (g.tool === 'eraser') {
      InkModel.commitErase(Session.hist, this.page, g.removed);
      if (!this.laser.length) this.ctx.laser.clearRect(0, 0, STAGE_W, STAGE_H);
      if (g.removed.length) Session.changed();
    }
  },

  // 지우개 위치를 점선 원으로 보여 준다(레이저층 사용).
  ring(x, y) {
    if (this.laser.length) return;
    const c = this.ctx.laser;
    c.clearRect(0, 0, STAGE_W, STAGE_H);
    c.save();
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    // 흰 점선과 어두운 점선을 엇갈려 그려 흰 화면과 초록 칠판 어디서나 보인다
    for (const [color, offset] of [['rgba(255, 255, 255, .85)', 4], ['rgba(31, 35, 40, .75)', 0]]) {
      c.strokeStyle = color;
      c.lineDashOffset = offset;
      c.beginPath();
      c.arc(x, y, ERASER_R, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  },

  animateLaser() {
    if (this.laserRAF) return;
    const tick = () => {
      const now = performance.now();
      this.laser = this.laser.filter((pt) => now - pt.t < 1000);
      const c = this.ctx.laser;
      c.clearRect(0, 0, STAGE_W, STAGE_H);
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.lineWidth = 6;
      for (let i = 1; i < this.laser.length; i++) {
        const a = this.laser[i - 1];
        const b = this.laser[i];
        if (b.t - a.t > 120) continue;                    // 시간 간격이 크면 다른 레이저 획
        c.strokeStyle = `rgba(255, 45, 45, ${Math.max(0, 1 - (now - b.t) / 1000)})`;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      this.laserRAF = this.laser.length ? requestAnimationFrame(tick) : 0;
    };
    this.laserRAF = requestAnimationFrame(tick);
  },

  undo() {
    this.cancelGesture();
    const p = this.page;
    const changed = !!p && InkModel.undo(Session.hist, p);
    this.redraw();
    if (!changed) return false;
    Session.changed();
    return true;
  },

  clear() {
    this.cancelGesture();
    const p = this.page;
    const changed = !!p && InkModel.clear(Session.hist, p);
    this.redraw();
    if (!changed) return false;
    Session.changed();
    return true;
  },
};

/* ---- 25-board.js ---- */
// 칠판 모드: 슬라이드와 단계는 그대로 두고, 반별 칠판 쪽으로 판서·넘기기 대상을 바꾼다.
const BOARD_LABELS = { white: '흰색', grid: '모눈', lines: '줄', green: '초록 칠판', coord: '좌표평면' };

const Board = {
  active: false,
  el: null,
  label: null,
  toggleBtn: null,

  init() {
    this.label = h('div', { class: 'ch-board-label', role: 'status', 'aria-live': 'polite' });
    this.el = h('div', { class: 'ch-board', 'data-bg': 'white', 'aria-label': '칠판', hidden: true }, this.label);
    Stage.deck.append(this.el);
    this.toggleBtn = Toolbar.btn('board', '칠판', () => this.toggle());
    const add = Toolbar.btn('boardAdd', '칠판 추가', () => this.add());
    const del = Toolbar.btn('boardDel', '칠판 삭제', () => this.remove());
    const bg = Toolbar.btn('bg', '바탕', (e) => {
      if (this.active) Toolbar.togglePop(e.currentTarget, () => this.bgPanel());
    });
    for (const b of [add, del, bg]) b.classList.add('ch-board-only');
    Toolbar.slots.board.append(this.toggleBtn, add, del, bg);
    on('session', () => {
      Toolbar.closePop();
      if (this.active) this.render();
    });
    on('key', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || keyName(e) !== 'c') return;
      e.preventDefault();
      this.toggle();
    });
    this.setToggle();
    if (document.body.dataset.theme === 'chalk') this.setDark(true);   // 흰 펜, 밝게 겹치는 형광펜
  },

  get doc() { return Session.doc; },

  toggle() { if (this.active) this.close(); else this.open(); },

  open() {
    if (this.active) return;
    this.active = true;
    Nav.override = this;
    document.body.classList.add('ch-board-on');
    this.render();
    emit('board', true);
  },

  close() {
    if (!this.active) return;
    Toolbar.closePop();
    this.active = false;
    if (Nav.override === this) Nav.override = null;
    document.body.classList.remove('ch-board-on');
    this.el.hidden = true;
    this.setDark(document.body.dataset.theme === 'chalk');   // 칠판 테마의 슬라이드는 어둡다
    this.setToggle();
    Ink.setPage({ kind: 'slide', key: Stage.slides[Nav.state.slide].dataset.key });
    emit('board', false);
  },

  render() {
    if (!this.active) return;
    Toolbar.closePop();
    const doc = this.doc;
    doc.board = clamp(doc.board, 0, doc.boards.length - 1);
    const b = doc.boards[doc.board];
    this.el.hidden = false;
    this.el.dataset.bg = b.bg;
    this.label.textContent = `칠판 ${doc.board + 1} / ${doc.boards.length}`;
    this.setDark(b.bg === 'green');
    this.setToggle();
    // 새 반의 문서에서는 그 반의 번호를 쓰고, 미완성 획이 다른 쪽에 기록되지 않도록 취소한다.
    Ink.setPage({ kind: 'board', index: doc.board });
  },

  setDark(dark) {
    document.body.classList.toggle('ch-dark-page', dark);
    if (dark && Tools.penColor === PEN_COLORS[0]) {
      Tools.penColor = PEN_WHITE;
      emit('tool', Tools.current);
    } else if (!dark && Tools.penColor === PEN_WHITE) {
      Tools.penColor = PEN_COLORS[0];
      emit('tool', Tools.current);
    }
  },

  next() {
    if (!this.active || this.doc.board >= this.doc.boards.length - 1) return;
    this.doc.board += 1;
    this.render();
    Session.changed();
  },

  prev() {
    if (!this.active || this.doc.board <= 0) return;
    this.doc.board -= 1;
    this.render();
    Session.changed();
  },

  add() {
    if (!this.active) return;
    InkModel.addBoard(this.doc, this.doc.boards[this.doc.board].bg);
    this.render();
    Session.changed();
  },

  remove() {
    if (!this.active) return;
    const b = this.doc.boards[this.doc.board];
    if (b.strokes.length && !confirm('이 칠판을 지울까요? 판서도 함께 사라져요.')) return;
    InkModel.deleteBoard(this.doc);
    this.render();
    Session.changed();
  },

  setBg(bg) {
    if (!this.active || !BOARD_BGS.includes(bg)) return;
    this.doc.boards[this.doc.board].bg = bg;
    this.render();
    Session.changed();
  },

  setToggle() {
    const label = this.active ? '슬라이드' : '칠판';
    this.toggleBtn.replaceChildren(icon(this.active ? 'slides' : 'board'), h('span', { text: label }));
    this.toggleBtn.title = this.active ? '슬라이드로 돌아가기' : '칠판 열기';
    this.toggleBtn.setAttribute('aria-label', this.toggleBtn.title);
    this.toggleBtn.setAttribute('aria-pressed', String(this.active));
  },

  bgPanel() {
    const cur = this.doc.boards[this.doc.board].bg;
    return h('div', { class: 'ch-pop-bg' }, h('h3', { text: '칠판 바탕' }),
      h('div', { class: 'ch-bg-list' }, ...BOARD_BGS.map((bg) => h('button', {
        type: 'button', class: 'ch-bg', 'data-bg': bg, 'aria-pressed': String(bg === cur),
        onclick: () => { this.setBg(bg); Toolbar.closePop(); },
      }, h('i', { 'aria-hidden': 'true' }), h('span', { text: BOARD_LABELS[bg] })))));
  },
};

/* ---- 30-toolbar.js ---- */
// 툴바: 넘기기, 도구, 색·굵기, 되돌리기, 칠판(25-board가 채움), 반 메뉴, 목차·전체 화면·위치·접기.
// 아이콘은 24×24 선 그림(직접 그린 단순 도형).
const ICONS = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  hand: 'M5 3l13 7.5-5.5 1.5L10 18z',
  pen: 'M4 20l4.5-1L19 8.5 15.5 5 5 15.5zM13.5 7l3.5 3.5',
  hl: 'M4 21h8M7 17l-2 2M7 17l9.5-9.5 3 3L10 20zM14 5l5 5',
  eraser: 'M8 20h12M4.5 15.5l9-9 6 6-7.5 7.5H9z',
  laser: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6M12 2v3M12 19v3M2 12h3M19 12h3',
  style: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  clear: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  board: 'M3 4h18v12H3zM8 20l4-4 4 4',
  slides: 'M3 5h18v14H3zM7 9h10M7 13h6',
  boardAdd: 'M3 4h18v12H3zM12 7v6M9 10h6M8 20l4-4 4 4',
  boardDel: 'M3 4h18v12H3zM9.5 7.5l5 5M14.5 7.5l-5 5M8 20l4-4 4 4',
  bg: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  class: 'M9 5a3 3 0 1 1 0 6a3 3 0 1 1 0-6M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.5a3 3 0 0 1 0 5.5M18 14.5c2 .6 3 2.6 3 5.5',
  toc: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  dock: 'M3 3h18v18H3zM3 15h18',
  collapse: 'M6 9l6 6 6-6',
  tools: 'M4 20l4.5-1L19 8.5 15.5 5 5 15.5z',
  gear: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1',
  zoom: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6',
  check: 'M5 12.5l4.5 4.5L19 7',
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ch-icon ch-icon-${name}`);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] || '');
  svg.append(path);
  return svg;
}

// 텍스트 파일 내려받기(판서 백업, M2의 저장 기능에서도 쓴다).
function saveText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
  const a = h('a', { href: url, download: filename.replace(/[\\/:*?"<>|]+/g, '-') });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const Toolbar = {
  el: null,
  handle: null,
  slots: {},
  pop: null,
  popAnchor: null,
  styleBtn: null,
  classBtn: null,
  prefs: { dock: 'bottom', collapsed: false },

  async init() {
    const saved = await Store.get('toolbar');
    if (saved && typeof saved === 'object') {
      if (['bottom', 'left', 'right'].includes(saved.dock)) this.prefs.dock = saved.dock;
      this.prefs.collapsed = !!saved.collapsed;
      if (PEN_COLORS.includes(saved.penColor)) Tools.penColor = saved.penColor;
      if (PEN_WIDTHS.includes(saved.penWidth)) Tools.penWidth = saved.penWidth;
      if (HL_COLORS.includes(saved.hlColor)) Tools.hlColor = saved.hlColor;
    }
    this.el = h('div', { class: 'ch-toolbar', role: 'toolbar', 'aria-label': '수업 도구' });
    for (const name of ['nav', 'tools', 'style', 'edit', 'board', 'class', 'misc']) {
      this.slots[name] = h('div', { class: `ch-tb-group ch-tb-${name}` });
      this.el.append(this.slots[name]);
    }
    this.handle = h('button', {
      type: 'button', class: 'ch-tb-handle', title: '도구 펼치기', 'aria-label': '도구 펼치기',
      onclick: () => this.setCollapsed(false),
    }, icon('tools'), h('span', { text: '도구' }));
    this.build();
    this.el.addEventListener('keydown', (e) => this.buttonKeys(e));
    this.handle.addEventListener('keydown', (e) => this.buttonKeys(e));
    document.body.append(this.el, this.handle);
    on('tool', () => this.sync());
    on('session', () => this.sync());
    on('key', (e) => this.onKey(e));
    on('panels-close', () => this.closePop());
    document.addEventListener('pointerdown', (e) => {
      if (!this.pop || this.pop.contains(e.target)) return;
      if (this.popAnchor && this.popAnchor.contains(e.target)) return;
      this.closePop();
    }, true);
    this.applyDock();
    Tools.set('hand');
  },

  btn(name, label, onclick, attrs) {
    const b = h('button', Object.assign({ type: 'button', class: 'ch-tb-btn', 'data-name': name, title: label, 'aria-label': label }, attrs || {}),
      icon(name), h('span', { text: label }));
    b.addEventListener('click', (e) => { onclick(e); b.blur(); });
    return b;
  },

  menuItem(label, onclick) { return h('button', { type: 'button', class: 'ch-menu-item', text: label, onclick }); },

  // 버튼의 기본 Enter·Space 클릭은 유지하고, 장 넘기기 단축키까지 전달하지 않는다.
  buttonKeys(e) {
    if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
  },

  build() {
    const S = this.slots;
    S.nav.append(this.btn('prev', '이전', () => Nav.prev()), this.btn('next', '다음', () => Nav.next()));
    for (const [tool, label] of [['hand', '손'], ['pen', '펜'], ['hl', '형광펜'], ['eraser', '지우개'], ['laser', '레이저']]) {
      S.tools.append(this.btn(tool, label, () => Tools.set(tool), { 'data-tool': tool, 'aria-pressed': 'false' }));
    }
    this.styleBtn = this.btn('style', '색', (e) => this.togglePop(e.currentTarget, () => this.stylePanel()));
    S.style.append(this.styleBtn);
    S.edit.append(
      this.btn('undo', '되돌리기', () => Ink.undo()),
      this.btn('clear', '이 장 지우기', () => {
        if (Ink.page && Ink.page.length && confirm('이 장의 판서를 모두 지울까요?')) Ink.clear();
      }),
    );
    this.classBtn = this.btn('class', '반', (e) => this.togglePop(e.currentTarget, () => this.classPanel()));
    S.class.append(this.classBtn);
    S.misc.append(
      this.btn('toc', '목차', () => Panels.toggle(Panels.toc)),
      this.btn('full', '전체 화면', () => Panels.fullscreen()),
      this.btn('dock', '위치', () => this.cycleDock()),
      this.btn('collapse', '접기', () => this.setCollapsed(true)),
    );
  },

  sync() {
    for (const b of qsa('[data-tool]', this.slots.tools)) b.setAttribute('aria-pressed', String(b.dataset.tool === Tools.current));
    this.styleBtn.style.setProperty('--swatch', Tools.current === 'hl' ? Tools.hlColor : Tools.penColor);
    this.classBtn.querySelector('span').textContent = Session.current;
  },

  togglePop(anchor, makeContent) {
    if (this.pop && this.popAnchor === anchor) { this.closePop(); return; }
    this.closePop();
    this.pop = h('div', { class: 'ch-pop', role: 'dialog' }, makeContent());
    this.pop.addEventListener('keydown', (e) => this.buttonKeys(e));
    this.popAnchor = anchor;
    document.body.append(this.pop);
    const a = anchor.getBoundingClientRect();
    const p = this.pop.getBoundingClientRect();
    // 툴바가 아래면 버튼 위로, 왼쪽이면 오른편으로, 오른쪽이면 왼편으로 띄운다.
    let x = a.left + a.width / 2 - p.width / 2;
    let y = a.top - p.height - 10;
    if (this.prefs.dock === 'left') {
      x = a.right + 10;
      y = a.top + a.height / 2 - p.height / 2;
    } else if (this.prefs.dock === 'right') {
      x = a.left - p.width - 10;
      y = a.top + a.height / 2 - p.height / 2;
    }
    this.pop.style.left = `${clamp(x, 8, window.innerWidth - p.width - 8)}px`;
    this.pop.style.top = `${clamp(y, 8, window.innerHeight - p.height - 8)}px`;
  },

  closePop() {
    if (this.pop) this.pop.remove();
    this.pop = null;
    this.popAnchor = null;
  },

  stylePanel() {
    const isHl = Tools.current === 'hl';
    const dark = document.body.classList.contains('ch-dark-page');
    const colors = isHl ? HL_COLORS : PEN_COLORS.concat(dark ? [PEN_WHITE] : []);
    const cur = isHl ? Tools.hlColor : Tools.penColor;
    const pick = (c) => {
      if (isHl) Tools.hlColor = c; else Tools.penColor = c;
      if (!isHl && Tools.current !== 'pen') Tools.set('pen');
      this.savePrefs();
      this.closePop();
      this.sync();
    };
    const wrap = h('div', { class: 'ch-pop-style' },
      h('div', { class: 'ch-swatches' }, ...colors.map((c) => h('button', {
        type: 'button', class: 'ch-swatch', 'aria-label': c, 'aria-pressed': String(c === cur), style: `--c:${c}`, onclick: () => pick(c),
      }))));
    if (!isHl) {
      wrap.append(h('div', { class: 'ch-widths' }, ...PEN_WIDTHS.map((w, i) => h('button', {
        type: 'button', class: 'ch-width', 'aria-label': ['가늘게', '보통', '굵게'][i], 'aria-pressed': String(w === Tools.penWidth), style: `--w:${w}px`,
        onclick: () => {
          Tools.penWidth = w;
          if (Tools.current !== 'pen') Tools.set('pen');
          this.savePrefs();
          this.closePop();
          this.sync();
        },
      }))));
    }
    return wrap;
  },

  classPanel() {
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      const text = await f.text();
      const parsed = InkModel.parseBackup(text);
      if (!parsed.ok) { alert(parsed.error); return; }
      if (parsed.deck && parsed.deck !== Session.deck && !confirm('다른 수업의 백업이에요. 그래도 불러올까요?')) return;
      await Session.importBackup(text);
      this.closePop();
      alert('판서 백업을 불러왔어요.');
    });
    return h('div', { class: 'ch-pop-class' },
      h('h3', { text: '반 고르기' }),
      h('div', { class: 'ch-class-list' }, ...Session.classes.map((c) => h('button', {
        type: 'button', class: 'ch-class', 'aria-pressed': String(c === Session.current), text: c,
        onclick: async () => { this.closePop(); await Session.switchTo(c); },
      }))),
      this.menuItem('＋ 반 추가', async () => {
        const name = prompt('반 이름 (예: 2반)');
        this.closePop();
        if (name && await Session.addClass(name)) await Session.switchTo(name.trim().slice(0, 20));
      }),
      this.menuItem('이 반 판서 모두 지우기', async () => {
        this.closePop();
        if (confirm(`${Session.current}: 이 수업의 판서를 모두 지울까요?`)) await Session.clearCurrent();
      }),
      this.menuItem('이 반 삭제', async () => {
        this.closePop();
        if (Session.classes.length <= 1) { alert('반이 하나뿐이라 지울 수 없어요.'); return; }
        if (confirm(`${Session.current}을(를) 반 목록에서 지울까요? 이 수업의 그 반 판서도 지워져요.`)) await Session.removeClass(Session.current);
      }),
      this.menuItem('판서 백업 파일로 저장', async () => {
        this.closePop();
        saveText(`${Session.deck}-판서백업-${new Date().toISOString().slice(0, 10)}.json`, await Session.exportBackup(), 'application/json');
      }),
      this.menuItem('백업 파일 불러오기', () => file.click()),
      file);
  },

  cycleDock() {
    const order = ['bottom', 'left', 'right'];
    this.prefs.dock = order[(order.indexOf(this.prefs.dock) + 1) % order.length];
    this.applyDock();
    this.savePrefs();
  },

  setCollapsed(v) {
    this.prefs.collapsed = !!v;
    this.applyDock();
    this.savePrefs();
  },

  applyDock() {
    const { dock, collapsed } = this.prefs;
    this.el.dataset.dock = dock;
    this.handle.dataset.dock = dock;
    this.el.hidden = collapsed;
    this.handle.hidden = !collapsed;
    const size = collapsed ? '0px' : '80px';   // 툴바 두께 72 + 화면 끝 띄움 8
    const root = document.documentElement.style;
    root.setProperty('--ch-reserve-bottom', dock === 'bottom' ? size : '0px');
    root.setProperty('--ch-reserve-left', dock === 'left' ? size : '0px');
    root.setProperty('--ch-reserve-right', dock === 'right' ? size : '0px');
    this.closePop();
    Stage.fit();
  },

  savePrefs() {
    Store.set('toolbar', { dock: this.prefs.dock, collapsed: this.prefs.collapsed, penColor: Tools.penColor, penWidth: Tools.penWidth, hlColor: Tools.hlColor });
  },

  onKey(e) {
    const k = keyName(e);
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); Ink.undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const map = { p: 'pen', h: 'hl', e: 'eraser', l: 'laser', escape: 'hand' };
    if (map[k]) Tools.set(map[k]);
  },
};

/* ---- 31-settings.js ---- */
// ⚙ 설정: 이 PC의 저장소에 저장하고 수업 화면에 즉시 적용한다.
const Settings = {
  values: { motionOff: false, printInk: false, palmErase: false },
  button: null,
  extras: [],   // 다른 모듈이 설정 창 아래에 붙이는 묶음(그림 채우기·저장 등)
  ITEMS: [
    ['motionOff', '움직임 끄기', '슬라이드 전환과 단계 효과를 끕니다'],
    ['printInk', '인쇄에 판서 포함', '지금 반의 판서와 칠판을 함께 인쇄합니다'],
    ['palmErase', '손바닥으로 지우기 (실험)', '넓게 닿는 터치를 지우개로 씁니다'],
  ],

  async init() {
    const saved = await Store.get('settings');
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(this.values)) {
        if (typeof saved[key] === 'boolean') this.values[key] = saved[key];
      }
    }
    this.apply();
    if (!this.button || !this.button.isConnected) {
      this.button = Toolbar.btn('gear', '설정', (e) => Toolbar.togglePop(e.currentTarget, () => this.panel()));
      Toolbar.slots.misc.append(this.button);
    }
  },

  panel() {
    return h('div', { class: 'ch-pop-settings' }, h('h3', { text: '설정' }),
      ...this.ITEMS.map(([key, label, desc]) => h('label', { class: 'ch-switch' },
        h('input', {
          type: 'checkbox', 'data-key': key, checked: this.values[key],
          onchange: (e) => this.set(key, e.target.checked),
        }),
        h('span', null, h('b', { text: label }), h('small', { text: desc })))),
      ...this.extras.map((fn) => fn()));
  },

  set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.values, key)) return;
    this.values[key] = !!value;
    this.apply();
    return Store.set('settings', { ...this.values });
  },

  apply() {
    document.documentElement.classList.toggle('ch-motion-off', this.values.motionOff);
    Ink.palmErase = this.values.palmErase;
    for (const input of qsa('.ch-pop-settings input[data-key]')) input.checked = this.values[input.dataset.key];
  },
};

/* ---- 40-keepwords.js ---- */
// 어절을 nowrap span으로 감싸고 인라인 요소 사이에 WORD JOINER(U+2060)를 넣는다.
// 원래 요소와 이벤트는 보존하며, .w 내부를 건너뛰어 다시 적용해도 중첩하지 않는다.
const KeepWords = {
  SKIP: 'svg, math, script, style, pre, code, textarea, select, button, canvas, .katex, .w, [data-no-keep], [contenteditable=""], [contenteditable="true"]',

  apply(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.closest(KeepWords.SKIP)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => this.wrap(node));
  },

  inline(el) {
    if (/^(BR|WBR)$/.test(el.tagName)) return false;
    const display = getComputedStyle(el).display;
    if (display) return /^(inline|inline-block|inline-flex|inline-grid|inline-table|contents|ruby.*)$/.test(display);
    // 분리된 요소도 보정할 수 있도록 브라우저 기본 인라인 태그를 사용한다.
    return /^(A|ABBR|B|BDI|BDO|CITE|CODE|DATA|DEL|DFN|EM|I|INS|KBD|LABEL|MARK|Q|RP|RT|RUBY|S|SAMP|SMALL|SPAN|STRONG|SUB|SUP|TIME|U|VAR)$/.test(el.tagName);
  },

  // 경계 쪽 첫 문자가 공백이면 끊고, 빈 요소·주석은 건너뛴다.
  edge(node, before) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue) return null;
      return before ? /\S$/.test(node.nodeValue) : /^\S/.test(node.nodeValue);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    if (!this.inline(node)) return false;
    let child = before ? node.lastChild : node.firstChild;
    while (child) {
      const result = this.edge(child, before);
      if (result !== null) return result;
      child = before ? child.previousSibling : child.nextSibling;
    }
    return null;
  },

  joined(node, before) {
    let current = node;
    while (current) {
      let sibling = before ? current.previousSibling : current.nextSibling;
      while (sibling) {
        const result = this.edge(sibling, before);
        if (result !== null) return result;
        sibling = before ? sibling.previousSibling : sibling.nextSibling;
      }
      const parent = current.parentElement;
      if (!parent || !this.inline(parent)) return false;
      current = parent;
    }
    return false;
  },

  wrap(node) {
    let text = node.nodeValue;
    if (/^\S/.test(text) && !text.startsWith('\u2060') && this.joined(node, true)) text = `\u2060${text}`;
    if (/\S$/.test(text) && !text.endsWith('\u2060') && this.joined(node, false)) text = `${text}\u2060`;
    const frag = document.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) frag.append(part);
      else frag.append(h('span', { class: 'w', text: part }));
    }
    // flex·grid 상자 안에서는 낱말 span 하나하나가 따로 놓여 사이 공백이 사라진다. 한 덩어리로 감싼다.
    const parent = node.parentElement;
    if (parent && /flex|grid/.test(getComputedStyle(parent).display) && frag.childNodes.length > 1) {
      node.replaceWith(h('span', { class: 'ch-wrun' }, frag));
    } else node.replaceWith(frag);
  },
};

/* ---- 41-print.js ---- */
// 모든 슬라이드의 단계를 펼쳐 인쇄한다. 판서는 현재 반의 문서에서 가져온다.
const Print = {
  added: [],
  opened: false,

  init() {
    window.addEventListener('beforeprint', () => this.before());
    window.addEventListener('afterprint', () => this.after());
  },

  inkImage(strokes) {
    const canvas = document.createElement('canvas');
    canvas.width = STAGE_W * 2;
    canvas.height = STAGE_H * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    // 화면과 같게: 형광펜 획은 불투명하게 그리고 그림 전체의 투명도는 CSS(.ch-print-hl)가 정한다
    for (const pass of ['hl', 'pen']) {
      for (const stroke of strokes) if (stroke.t === pass) Ink.drawStrokeOn(ctx, stroke);
    }
    return h('img', { class: 'ch-print-ink', alt: '', src: canvas.toDataURL('image/png') });
  },

  add(parent, el) {
    parent.append(el);
    this.added.push(el);
  },

  appendInk(parent, strokes) {
    // 형광펜은 별도 그림으로 합성하여 인쇄에서도 본문 글자가 비치게 한다.
    for (const pass of ['hl', 'pen']) {
      const selected = strokes.filter((s) => s.t === pass);
      if (!selected.length) continue;
      const img = this.inkImage(selected);
      img.classList.add(`ch-print-${pass}`);
      this.add(parent, img);
    }
  },

  before() {
    this.after();
    this.opened = true;
    emit('print-before');   // 부품: 단계 막대 끝 칸, 문제 정답 표시 등
    if (!Settings.values.printInk || !Session.doc) return;
    for (const slide of Stage.slides) {
      const strokes = Session.doc.slides[slide.dataset.key];
      if (Array.isArray(strokes) && strokes.length) this.appendInk(slide, strokes);
    }
    Session.doc.boards.forEach((board, i) => {
      if (!board.strokes.length) return;
      const page = h('section', {
        class: 'slide ch-print-board', 'data-page': `칠판 ${i + 1}`, 'data-bg': board.bg,
      }, h('div', { class: 'ch-board', 'data-bg': board.bg }));
      this.add(Stage.deck, page);
      this.appendInk(page, board.strokes);
    });
  },

  after() {
    for (const el of this.added) el.remove();
    this.added = [];
    if (this.opened) emit('print-after');
    this.opened = false;
  },
};

/* ---- 42-audit.js ---- */
// D 또는 ?audit로 열며, ClassHTML.audit()은 화면 상태를 보존하고 보고서만 반환한다.
const Audit = {
  panel: null,

  init() {
    this.panel = h('div', { class: 'ch-panel ch-audit', role: 'dialog', 'aria-label': '자동 점검' });
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });
    document.body.append(this.panel);
    on('key', (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && keyName(e) === 'd') this.toggle();
    });
    on('panels-close', () => this.close());
    if (new URLSearchParams(location.search).has('audit')) this.toggle();
  },

  describe(el) {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    const text = (el.textContent || '').replace(/\u2060/g, '').trim().slice(0, 14);
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}>${text ? ` 「${text}」` : ''}`;
  },

  run() {
    const errors = [];
    const warnings = [];
    // 단계 막대 칸마다 다시 재므로 같은 장·같은 내용의 알림은 한 번만 적는다
    const seen = new Set();
    const add = (list, level) => (slide, code, msg) => {
      const k = `${slide}|${code}|${msg}`;
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ level, slide, code, msg });
    };
    const err = add(errors, 'error');
    const warn = add(warnings, 'warn');
    const ids = new Map();
    for (const el of qsa('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, count] of ids) if (count > 1) err(null, 'dup-id', `id "${id}"가 ${count}번 쓰였어요`);

    // Nav.set()으로 점검하면 수업의 onShow/onHide 훅과 판서 입력도 바뀐다.
    // DOM의 표시 상태만 잠깐 바꾸고, 예외가 나도 원래 클래스 상태를 복구한다.
    const snapshots = Stage.slides.map((slide) => ({
      slide, active: slide.classList.contains('is-active'),
      steps: qsa('.step', slide).map((el) => ({ el, shown: el.classList.contains('is-shown') })),
    }));
    const root = document.documentElement;
    const wasAuditing = root.classList.contains('ch-auditing');
    const stepperSnap = Stepper.snapshot();
    root.classList.add('ch-auditing');
    try {
      const measure = (slide, i) => {
        Stage.slides.forEach((other) => other.classList.toggle('is-active', other === slide));
        qsa('.step', slide).forEach((el) => el.classList.add('is-shown'));
        const box = slide.getBoundingClientRect();
        const scale = box.width / STAGE_W;
        const reported = [];
        const textBlocks = new Map();
        // 허용 영역은 요소 검사에서도 제외한다. 전체 scroll 값에는 그 영역도 포함된다.
        if (!slide.closest('[data-allow-overflow]') && !slide.querySelector('[data-allow-overflow]')
          && (slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1)) {
          err(i, 'slide-overflow', '내용이 슬라이드보다 커요 (장을 나누세요)');
        }
        for (const el of qsa('*', slide)) {
          const allowOverflow = !!el.closest('[data-allow-overflow]');
          // KaTeX의 스크린리더용 MathML 복제는 의도적으로 1px 안에 숨긴다.
          if (el.closest('.katex-mathml')) continue;
          if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
          // 크기가 0인 빈 그림 자리도 경고한다.
          if (el.matches('img[data-ppt]') && !el.getAttribute('src')) warn(i, 'empty-image', `빈 그림 자리: 원본 PPT ${el.dataset.ppt}`);
          if (el.matches('img:not([alt])')) warn(i, 'no-alt', `${this.describe(el)}에 alt 설명이 없어요`);
          if (el.matches('.katex-error')) err(i, 'math-error', `수식 오류: ${this.describe(el)}`);
          if (el.matches('.katex') && el.getClientRects().length > 1) err(i, 'math-wrap', `수식이 두 줄로 갈렸어요: ${this.describe(el)}`);
          if (reported.some((parent) => parent.contains(el))) continue;
          const rect = el.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          if (!allowOverflow && (rect.right > box.right + scale || rect.bottom > box.bottom + scale
            || rect.left < box.left - scale || rect.top < box.top - scale)) {
            err(i, 'out', `${this.describe(el)}이(가) 슬라이드 밖으로 나가요`);
            reported.push(el);
            continue;
          }
          const cs = getComputedStyle(el);
          if (!allowOverflow && /(hidden|clip|auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`)
            && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
            err(i, 'clip', `${this.describe(el)} 안의 내용이 잘려요`);
            reported.push(el);
            continue;
          }
          // 수식의 첨자 등 라이브러리가 그린 내부 글자는 본문 최소 크기에서 제외한다.
          if (el.closest('.katex, math')) continue;
          const hasText = Array.from(el.childNodes).some((node) =>
            node.nodeType === 3 && /\S/.test(node.nodeValue.replace(/\u2060/g, '')));
          if (!hasText) continue;
          // 어절 보정이 감싼 span.w는 낱말 하나이므로 그 부모를 글 덩어리로 본다
          const base = el.classList.contains('w') && el.parentElement ? el.parentElement : el;
          const block = base.closest('p, li, td, th, h1, h2, h3, h4, figcaption, small, .caption, label') || base;
          const size = parseFloat(cs.fontSize);
          if (!textBlocks.has(block) || size < textBlocks.get(block)) textBlocks.set(block, size);
        }
        for (const [block, size] of textBlocks) {
          if (size < 18) err(i, 'tiny-text', `${this.describe(block)} 글자가 ${size}px로 너무 작아요 (최소 18px)`);
          else if (size < 20 && block.matches('p, li, td, th') && !block.closest('small, .caption, figcaption, .kicker')) {
            warn(i, 'small-text', `${this.describe(block)} 본문이 ${size}px예요 (권장 20px 이상)`);
          }
        }
      };
      Stepper.openAll('audit');
      Stage.slides.forEach((slide, i) => measure(slide, i));
      // data-only 내용은 칸마다 다르므로 단계 막대의 칸마다 다시 잰다
      for (const st of Stepper.all) {
        if (!st.targets.some((t) => t.hasAttribute('data-only'))) continue;
        for (let k = 0; k < st.max; k++) { st.set(k, 'audit'); measure(st.slide, st.index); }
        st.set(st.max, 'audit');
      }
    } finally {
      Stepper.restore(stepperSnap, 'audit');
      for (const snapshot of snapshots) {
        snapshot.slide.classList.toggle('is-active', snapshot.active);
        for (const step of snapshot.steps) step.el.classList.toggle('is-shown', step.shown);
      }
      root.classList.toggle('ch-auditing', wasAuditing);
      // 표시 상태를 되돌릴 때 다시 시작된 슬라이드 등장·단계 전환 효과는 바로 끝낸다(점검할 때마다 깜박이지 않게)
      if (!wasAuditing && Stage.deck.getAnimations) {
        void Stage.deck.offsetWidth;
        for (const a of Stage.deck.getAnimations({ subtree: true })) a.finish();
      }
    }
    const info = this.checkParts(err, warn);
    return { ok: !errors.length, errors, warnings,
      info: Object.assign({ slides: Stage.slides.length, aiAdded: qsa('[data-ai]', Stage.deck).length }, info) };
  },

  // 부품 작성 실수, 단계형 슬라이더의 시작 값, 활동 장 비율(설계서 7.2-5: 3분의 1 이상)
  checkParts(err, warn) {
    const at = (el) => { const i = Stage.slides.indexOf(el.closest('section.slide')); return i < 0 ? null : i; };
    const part = (el, msg) => err(at(el), 'part', `${this.describe(el)}: ${msg}`);
    for (const el of Stepper.orphans || []) part(el, '어느 단계 막대에 딸린 것인지 몰라요(data-for="단계 막대 id")');
    for (const st of Stepper.all) {
      for (const t of st.targets) {
        const nums = (t.dataset.only != null ? String(t.dataset.only).split(/[\s,]+/) : [t.dataset.at]).map(Number);
        if (nums.some((v) => !Number.isInteger(v) || v < 0 || v > st.max)) part(t, `단계 번호는 0~${st.max}이어야 해요`);
      }
    }
    for (const item of Calc.list.concat(Plot.list)) for (const e of item.errors) part(e.el, e.msg);
    for (const box of qsa('.sort', Stage.deck)) {
      const bins = qsa('.bin[data-bin]', box).map((b) => b.dataset.bin);
      const cards = qsa('[data-bin]:not(.bin)', box);
      if (!bins.length || !cards.length) part(box, '칸(.bin[data-bin])과 카드([data-bin])가 모두 있어야 해요');
      for (const c of cards) if (!bins.includes(c.dataset.bin)) part(c, `data-bin="${c.dataset.bin}"인 칸이 없어요`);
    }
    for (const box of qsa('.quiz', Stage.deck)) {
      if (!box.querySelector('.opt')) part(box, '보기(.opt)가 없어요');
      else if (!box.querySelector('.opt[data-ok]')) part(box, '정답 보기(data-ok)가 없어요');
    }
    for (const fig of qsa('figure.map-reveal', Stage.deck)) {
      const st = Stepper.all.find((s) => s.el === fig);
      const froms = qsa('[data-from]', fig).map((p) => Number(p.dataset.from));
      if (!froms.length) part(fig, '열릴 땅(svg 안 [data-from] 다각형)이 없어요');
      if (st && froms.some((v) => !Number.isInteger(v) || v < 1 || v > st.max)) part(fig, `data-from은 1~${st.max}이어야 해요`);
    }
    for (const ol of qsa('ol.yearline', Stage.deck)) if (!ol.querySelector('li[data-year]')) part(ol, '연도(li[data-year])가 없어요');
    for (const ol of qsa('ol.order', Stage.deck)) if (ol.querySelectorAll(':scope > li').length < 2) part(ol, '항목이 2개 이상이어야 해요');
    // 엔진 부품 밖의 슬라이더가 최솟값이 아닌 곳에서 시작하면 단계형인지 확인하게 한다(7.2-9)
    for (const r of qsa('input[type="range"]', Stage.deck)) {
      if (r.closest('.calc, .ch-stops, .ch-yearline')) continue;
      if (Number(r.defaultValue || r.getAttribute('value') || r.min || 0) !== Number(r.min || 0)) {
        warn(at(r), 'not-veiled', `${this.describe(r)}: 단계를 여는 막대라면 '시작'(최솟값)에서 시작하세요`);
      }
    }
    const ACT = '.reveal, .switch, .map-reveal, .ch-yearline, .sort, .quiz, .ch-order, .calc, .plot, input[type="range"], [data-activity]';
    const activities = Stage.slides.filter((s) => s.querySelector(ACT)).length;
    const total = Stage.slides.length;
    if (total >= 3 && activities * 3 < total) warn(null, 'few-activities', `활동 장이 ${activities}/${total}장이에요. 3분의 1(${Math.ceil(total / 3)}장) 이상이 되게 하세요`);
    const imgs = qsa('img[data-ppt]', Stage.deck);
    return { activities, images: imgs.length, emptyImages: imgs.filter((i) => !i.getAttribute('src')).length };
  },

  toggle() {
    if (this.panel.classList.contains('is-open')) { this.close(); return; }
    Panels.close();
    Toolbar.closePop();
    this.render(this.run());
    this.panel.classList.add('is-open');
    document.documentElement.classList.add('ch-audit-on');
  },

  close() {
    this.panel.classList.remove('is-open');
    document.documentElement.classList.remove('ch-audit-on');
  },

  render(report) {
    const items = report.errors.concat(report.warnings);
    const title = report.ok ? `자동 점검: 오류 없음 · 경고 ${report.warnings.length}`
      : `자동 점검: 오류 ${report.errors.length} · 경고 ${report.warnings.length}`;
    this.panel.replaceChildren(h('h2', { text: title }),
      items.length ? h('ul', null, ...items.map((item) => h('li', { class: `is-${item.level}` },
        item.slide == null ? h('span', { text: item.msg })
          : h('button', { type: 'button', text: `${item.slide + 1}쪽 · ${item.msg}`,
            onclick: () => Nav.go(item.slide, true) })))) : h('p', { text: '고칠 것이 없어요.' }),
      h('p', { class: 'ch-audit-info', text: `슬라이드 ${report.info.slides}장 · 활동 장 ${report.info.activities}장 · AI 추가 표시 ${report.info.aiAdded}곳 (점선으로 보임)` }));
  },
};

/* ---- 43-parts.js ---- */
// 공통 부품의 시작점과 정답 상자·그림 확대. 부품은 Nav가 단계를 모으기 전에 만든다(99-boot).
const Parts = {
  init() {
    Answer.init();
    Zoom.init();
    Stepper.init();
    MapReveal.init();
    Yearline.init();
    Sort.init();
    Quiz.init();
    Order.init();
    Calc.init();
    Plot.init();
    PptFill.init();
    Stepper.sort();   // 모든 단계 막대를 만든 뒤 문서 순서로 정렬하고 0단계로 둔다(계산 상자는 ch-stepper 이벤트로 다시 계산)
  },
};

// 정답 상자: <div class="answer">…</div>. 안에 .step이 없으면 내용 전체를 한 단계로 묶고 가운데 ✓ 단추를 단다.
const Answer = {
  init() {
    for (const box of qsa('.answer', Stage.deck)) {
      if (!box.querySelector('.step')) {
        const wrap = h('div', { class: 'step' });
        wrap.append(...box.childNodes);
        box.append(wrap);
      }
      box.append(h('button', { type: 'button', class: 'ch-check', 'aria-label': '정답 보기',
        onclick: (e) => { this.reveal(box); e.currentTarget.blur(); } }, icon('check')));
    }
  },

  // 상자 안 첫 단계까지 연다. 다른 장의 상자는 무시한다.
  reveal(box) { Nav.revealTo(box.querySelector('.step')); },
};

// 그림 확대: figure.fig 안 그림. 확대 단추나 손 모드에서 그림을 누르면 크게 본다.
const Zoom = {
  el: null,

  init() {
    this.el = h('div', { class: 'ch-zoom', role: 'dialog', 'aria-label': '그림 크게 보기',
      onclick: () => this.close() }, h('img', { alt: '' }), h('p'));
    document.body.append(this.el);
    for (const fig of qsa('figure.fig', Stage.deck)) {
      const img = fig.querySelector('img');
      if (!img) continue;
      const open = () => this.open(img, fig.querySelector('figcaption'));
      img.addEventListener('click', () => { if (Tools.current === 'hand') open(); });
      fig.append(h('button', { type: 'button', class: 'ch-zoom-btn', 'aria-label': '그림 크게 보기',
        onclick: (e) => { open(); e.currentTarget.blur(); } }, icon('zoom')));
    }
    on('panels-close', () => this.close());
    on('show', () => this.close());
    on('key', (e) => { if (keyName(e) === 'escape') this.close(); });
  },

  get isOpen() { return !!this.el && this.el.classList.contains('is-open'); },

  open(img, caption) {
    if (!img.getAttribute('src')) return;   // 비어 있는 그림 자리
    const [big, text] = this.el.children;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    text.textContent = caption ? caption.textContent.replace(/⁠/g, '').trim() : img.alt;
    this.el.classList.add('is-open');
  },

  close() { if (this.el) this.el.classList.remove('is-open'); },
};

/* ---- 50-expr.js ---- */
// 순수 식 해석기: 계산 상자(.calc)와 그래프(.plot)가 쓴다. eval 없이 재귀 하강으로 읽어 함수로 바꾼다.
// 문법: 수, '글자', + - * / % ^, 비교, && || !, 조건 ? 가 : 나, 함수, 상수 pi e.
const EXPR_DEPTH = 200;

// 반올림은 절댓값 기준(-2.5 → -3). 1.005 같은 이진수 오차는 지수 표기로 피한다.
function exprRound(x, n) {
  const d = Math.trunc(Number(n) || 0);
  if (!Number.isFinite(x)) return x;
  const a = Math.abs(x);
  const r = Math.sign(x) * (/e/.test(String(a)) ? Math.round(a * 10 ** d) / 10 ** d
    : Number(`${Math.round(Number(`${a}e${d}`))}e${-d}`));
  return Object.is(r, -0) ? 0 : r;
}

const EXPR_FUNCS = Object.assign(Object.create(null), {
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, exp: Math.exp, sign: Math.sign,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  pow: Math.pow, ln: Math.log, log: (x, b) => (b == null ? Math.log10(x) : Math.log(x) / Math.log(b)),
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
  round: (x, n) => exprRound(x, n),
  rad: (d) => (d * Math.PI) / 180, deg: (r) => (r * 180) / Math.PI,
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  if: (c, a, b) => (c ? a : b),
  len: (s) => Array.from(String(s == null ? '' : s)).length,   // 글자 수
  fix: (x, n) => Expr.format(Number(x), Math.max(0, Math.min(10, Math.trunc(Number(n) || 0)))),
});
const EXPR_CONSTS = Object.assign(Object.create(null), { pi: Math.PI, e: Math.E, true: true, false: false });
// 객체 기본 속성 이름은 변수로 쓰지 못하게 막는다(엔진은 hasOwnProperty로만 찾지만 실수를 일찍 알린다).
const EXPR_BAD = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__']);
const EXPR_OPS = { '×': '*', '÷': '/', '−': '-', '≤': '<=', '≥': '>=', '≠': '!=' };

const Expr = {
  tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (num) { out.push({ t: 'num', v: Number(num[0]), at: i }); i += num[0].length; continue; }
      if (c === '"' || c === "'") {
        const end = src.indexOf(c, i + 1);
        if (end < 0) throw this.fail('글자를 닫는 따옴표가 없어요', i);
        out.push({ t: 'str', v: src.slice(i + 1, end), at: i });
        i = end + 1;
        continue;
      }
      const id = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
      if (id) { out.push({ t: 'id', v: id[0], at: i }); i += id[0].length; continue; }
      const two = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two, at: i }); i += 2; continue; }
      if (EXPR_OPS[c]) { out.push({ t: 'op', v: EXPR_OPS[c], at: i }); i++; continue; }
      if ('+-*/%^!?:(),<>'.includes(c)) { out.push({ t: 'op', v: c, at: i }); i++; continue; }
      throw this.fail(`'${c}'는 식에 쓸 수 없어요`, i);
    }
    out.push({ t: 'end', v: '', at: src.length });
    return out;
  },

  fail(msg, at) {
    const err = new Error(msg);
    err.at = at;
    return err;
  },

  // src → { ok, fn(scope), vars, error, at }
  compile(src) {
    const vars = new Set();
    try {
      const toks = this.tokenize(String(src == null ? '' : src));
      let p = 0;
      let depth = 0;
      const peek = () => toks[p];
      const isOp = (v) => toks[p].t === 'op' && toks[p].v === v;
      const take = (v) => {
        if (!isOp(v)) throw this.fail(v === ')' ? '괄호가 닫히지 않았어요' : `'${v}'가 필요해요`, peek().at);
        p++;
      };
      const deeper = () => { if (++depth > EXPR_DEPTH) throw this.fail('식이 너무 깊어요', peek().at); };
      const binary = (next, ops, make) => () => {
        let left = next();
        while (peek().t === 'op' && ops.includes(peek().v)) {
          const op = toks[p++].v;
          const right = next();
          left = make(op, left, right);
        }
        return left;
      };
      const num = (v) => (typeof v === 'number' ? v : Number(v));
      const loose = (a, b) => {
        if (typeof a === 'string' && typeof b === 'string') return a === b;
        const x = num(a);
        const y = num(b);
        return Number.isNaN(x) || Number.isNaN(y) ? String(a) === String(b) : x === y;
      };
      const expr = () => {
        deeper();
        const cond = or();
        let out = cond;
        if (isOp('?')) {
          p++;
          const a = expr();
          take(':');
          const b = expr();
          out = (s) => (cond(s) ? a(s) : b(s));
        }
        depth--;
        return out;
      };
      const unary = () => {
        deeper();
        let out;
        if (isOp('-') || isOp('+') || isOp('!')) {
          const op = toks[p++].v;
          const arg = unary();
          out = op === '-' ? (s) => -num(arg(s)) : op === '+' ? (s) => num(arg(s)) : (s) => !arg(s);
        } else {
          const base = primary();
          if (isOp('^')) {
            p++;
            const ex = unary();
            out = (s) => Math.pow(num(base(s)), num(ex(s)));
          } else out = base;
        }
        depth--;
        return out;
      };
      const mul = binary(unary, ['*', '/', '%'], (op, l, r) => (op === '*' ? (s) => num(l(s)) * num(r(s))
        : op === '/' ? (s) => num(l(s)) / num(r(s)) : (s) => num(l(s)) % num(r(s))));
      const add = binary(mul, ['+', '-'], (op, l, r) => (op === '-' ? (s) => num(l(s)) - num(r(s)) : (s) => {
        const a = l(s);
        const b = r(s);
        if (typeof a === 'string' || typeof b === 'string') {
          return (typeof a === 'string' ? a : this.format(a)) + (typeof b === 'string' ? b : this.format(b));
        }
        return num(a) + num(b);
      }));
      const cmp = binary(add, ['<', '<=', '>', '>='], (op, l, r) => (s) => {
        const a = num(l(s));
        const b = num(r(s));
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      });
      const eq = binary(cmp, ['==', '!='], (op, l, r) => (op === '==' ? (s) => loose(l(s), r(s)) : (s) => !loose(l(s), r(s))));
      const and = binary(eq, ['&&'], (op, l, r) => (s) => !!(l(s) && r(s)));
      const or = binary(and, ['||'], (op, l, r) => (s) => !!(l(s) || r(s)));
      const primary = () => {
        const tk = peek();
        if (tk.t === 'num' || tk.t === 'str') { p++; const v = tk.v; return () => v; }
        if (isOp('(')) { p++; const inner = expr(); take(')'); return inner; }
        if (tk.t === 'id') {
          p++;
          const name = tk.v;
          if (isOp('(')) {
            p++;
            const fn = EXPR_FUNCS[name];
            if (!fn) throw this.fail(`모르는 함수예요: ${name}`, tk.at);
            const args = [];
            if (!isOp(')')) {
              args.push(expr());
              while (isOp(',')) { p++; args.push(expr()); }
            }
            take(')');
            return (s) => fn(...args.map((a) => a(s)));
          }
          if (EXPR_BAD.has(name)) throw this.fail(`${name}은(는) 이름으로 쓸 수 없어요`, tk.at);
          if (name in EXPR_CONSTS) { const v = EXPR_CONSTS[name]; return () => v; }
          if (EXPR_FUNCS[name]) throw this.fail(`${name}은(는) 함수예요. ${name}( )처럼 써 주세요`, tk.at);
          vars.add(name);
          return (s) => {
            if (!Object.prototype.hasOwnProperty.call(s, name)) throw new Error(`모르는 이름이에요: ${name}`);
            return s[name];
          };
        }
        throw this.fail(tk.t === 'end' ? '식이 덜 끝났어요' : `여기에 '${tk.v}'가 올 수 없어요`, tk.at);
      };
      const root = expr();
      if (peek().t !== 'end') throw this.fail(`'${peek().v}' 앞에서 식이 끝나야 해요`, peek().at);
      return { ok: true, fn: root, vars: Array.from(vars), error: '', at: -1 };
    } catch (err) {
      return { ok: false, fn: null, vars: Array.from(vars), error: err.message, at: Number.isInteger(err.at) ? err.at : -1 };
    }
  },

  // 'a = 식; b = 식' → { ok, list: [{ name, fn, src }], error }. 따옴표 안의 ;는 나누지 않는다.
  lets(src) {
    const parts = [];
    let cur = '';
    let quote = '';
    for (const c of String(src || '')) {
      if (quote) { if (c === quote) quote = ''; cur += c; continue; }
      if (c === '"' || c === "'") quote = c;
      if (c === ';') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    const list = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      const m = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)([\s\S]*)$/u.exec(part);
      if (!m) return { ok: false, list, error: `'이름 = 식' 꼴이 아니에요: ${part.trim()}` };
      const name = m[1];
      if (EXPR_BAD.has(name) || name in EXPR_CONSTS || EXPR_FUNCS[name]) return { ok: false, list, error: `${name}은(는) 이름으로 쓸 수 없어요` };
      const c = this.compile(m[2]);
      if (!c.ok) return { ok: false, list, error: `${name}: ${c.error}` };
      list.push({ name, fn: c.fn, src: m[2].trim(), vars: c.vars });
    }
    return { ok: true, list, error: '' };
  },

  // 화면 표시: digits가 있으면 그 자리까지, 없으면 소수 셋째 자리까지 쓰고 끝의 0을 지운다.
  format(v, digits) {
    if (typeof v === 'boolean') return v ? '참' : '거짓';
    if (typeof v === 'string') return v;
    const x = Number(v);
    if (!Number.isFinite(x)) return '?';
    if (Number.isInteger(digits) && digits >= 0) {
      const s = exprRound(x, digits).toFixed(digits);
      return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
    }
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e9 || a < 1e-3)) {
      const [m, ex] = x.toExponential(2).split('e');
      const sup = { '-': '⁻', '+': '', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
      return `${m.replace(/\.?0+$/, '')}×10${Array.from(ex).map((c) => sup[c]).join('')}`;
    }
    const r = exprRound(x, 3);
    return String(Object.is(r, -0) ? 0 : r);
  },
};

/* ---- 51-stepper.js ---- */
// 단계 막대 공통: 0단계(전부 가림)에서 시작해 한 칸씩 연다. 슬라이더나 단추로 움직이고, → ←로도 움직인다.
// 작성 모양: <div class="reveal" data-stops="시작|1단계|2단계"> … [data-at="1"] … [data-only="2"] … .veil … </div>
//           <div class="switch" data-stops="시작|가|나"> … </div> (단추형)
const Stepper = {
  all: [],
  bySlide: [],

  init() {
    this.all = [];
    this.bySlide = Stage.slides.map(() => []);
    for (const el of qsa('.reveal[data-stops]', Stage.deck)) this.create(el, { ui: 'range' });
    for (const el of qsa('.switch[data-stops]', Stage.deck)) this.create(el, { ui: 'buttons' });
  },

  // 다른 부품(지도, 연표)도 이 함수로 단계 막대를 만든다. 부품 init이 모두 끝나면 Parts가 sort()를 부른다.
  create(el, opts) {
    const o = opts || {};
    const slide = el.closest('section.slide');
    const index = Stage.slides.indexOf(slide);
    if (index < 0) return null;
    const stops = this.parseStops(o.stops || el.dataset.stops);
    const st = {
      el, slide, index, stops, pos: -1, max: stops.length - 1, ui: o.ui || 'range',
      nav: el.dataset.nav !== 'off', listeners: [], input: null, labels: [], buttons: [], hint: null,
      set: (pos, src) => this.set(st, pos, src),
      onChange: (fn) => st.listeners.push(fn),
    };
    el.classList.add('ch-stepper');
    if (!el.dataset.veil) el.dataset.veil = st.ui === 'buttons' ? '단추를 눌러 보자' : '막대를 움직여 하나씩 열어 보자';
    // 가림막 글은 CSS attr()로 띄우므로 .veil 요소마다 옮겨 적는다
    for (const v of qsa('.veil', el)) if (!v.dataset.veil) v.dataset.veil = el.dataset.veil;
    if (st.ui === 'range') this.buildRange(st, o.mount);
    else if (st.ui === 'buttons') this.buildButtons(st, o.mount);
    st.targets = [];
    this.all.push(st);
    this.bySlide[index].push(st);
    if (o.onChange) st.listeners.push(o.onChange);
    return st;
  },

  // '시작|가|나'(또는 배열) → ['시작', '가', '나']. <br>과 줄바꿈은 눈금 이름 안의 줄바꿈. 첫 칸이 '시작'이 아니면 붙인다.
  parseStops(text) {
    const raw = Array.isArray(text) ? text.map(String) : String(text || '').split('|');
    const list = raw.map((s) => s.replace(/<br\s*\/?>/gi, '\n').trim()).filter((s) => s);
    if (list[0] !== '시작') list.unshift('시작');
    return list;
  },

  // 작성자가 둔 막대 자리(.ch-stops) 가운데 이 단계 막대의 것만(안에 든 다른 단계 막대의 것은 빼고)
  ownPlace(el) {
    const hosts = '.reveal[data-stops], .switch[data-stops], figure.map-reveal, .ch-yearline';
    return qsa('.ch-stops', el).find((p) => p.parentElement.closest(hosts) === el && !p.querySelector('input')) || null;
  },

  buildRange(st, mount) {
    const wrap = this.ownPlace(st.el) || h('div', { class: 'ch-stops' });
    st.input = h('input', { type: 'range', min: 0, max: st.max, step: 1, value: 0, 'aria-label': st.el.getAttribute('aria-label') || '단계' });
    const labels = h('div', { class: `ch-stop-labels${st.stops.length > 7 ? ' is-dense' : ''}`, 'aria-hidden': 'true' });
    st.labels = st.stops.map((t, i) => h('span', { text: t, style: `left:${st.max ? (i / st.max) * 100 : 0}%` }));
    labels.append(...st.labels);
    wrap.replaceChildren(st.input, labels);
    if (!wrap.isConnected) {
      if (mount) mount.after(wrap);
      else st.el.append(wrap);
    }
    st.input.addEventListener('input', () => this.set(st, Number(st.input.value), 'input'));
    // 손을 뗀 뒤에는 Space·→가 다시 넘기기로 가도록 포커스를 놓는다
    st.input.addEventListener('change', () => st.input.blur());
  },

  buildButtons(st, mount) {
    const row = h('div', { class: 'ch-switch-btns', role: 'group', 'aria-label': st.el.getAttribute('aria-label') || '고르기' });
    st.buttons = st.stops.slice(1).map((t, i) => h('button', {
      type: 'button', class: 'ch-switch-btn', text: t, 'aria-pressed': 'false',
      onclick: (e) => { this.set(st, i + 1, 'input'); e.currentTarget.blur(); },
    }));
    row.append(...st.buttons);
    st.hint = h('p', { class: 'ch-switch-hint', text: st.el.dataset.veil });
    const place = this.ownPlace(st.el);
    if (place) place.replaceWith(row);
    else if (mount) mount.before(row);
    else st.el.prepend(row);
    row.after(st.hint);
  },

  // data-at·data-only 요소를 단계 막대에 묶는다: data-for → 가장 가까운 단계 막대 → 그 장의 유일한 단계 막대.
  bindTargets() {
    for (const st of this.all) st.targets = [];
    this.orphans = [];
    for (const el of qsa('[data-at], [data-only]', Stage.deck)) {
      const slide = el.closest('section.slide');
      const index = Stage.slides.indexOf(slide);
      if (index < 0) continue;
      const list = this.bySlide[index];
      let st = null;
      if (el.dataset.for) st = list.find((s) => s.el.id === el.dataset.for) || null;
      else {
        const host = el.closest('.ch-stepper');
        st = host ? list.find((s) => s.el === host) : null;
        if (!st && list.length === 1) st = list[0];
      }
      if (!st) { this.orphans.push(el); continue; }
      el.classList.add(el.hasAttribute('data-only') ? 'ch-only' : 'ch-at');
      st.targets.push(el);
    }
  },

  // 문서 순서로 정렬하고 처음 상태(0단계)를 그린다.
  sort() {
    const order = (a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    for (const list of this.bySlide) list.sort(order);
    this.bindTargets();
    for (const st of this.all) this.set(st, 0, 'init');
  },

  set(st, pos, src) {
    const next = clamp(Math.round(Number(pos) || 0), 0, st.max);
    if (next === st.pos && src !== 'init') return;
    const prev = st.pos;
    st.pos = next;
    st.el.dataset.pos = String(next);
    st.el.classList.toggle('is-veiled', next === 0);
    if (st.input) {
      st.input.value = String(next);
      st.input.style.setProperty('--p', `${st.max ? (next / st.max) * 100 : 0}%`);
      st.input.setAttribute('aria-valuetext', st.stops[next].replace(/\n/g, ' '));
    }
    st.labels.forEach((s, i) => s.classList.toggle('is-on', i === next));
    st.buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === next)));
    if (st.hint) st.hint.hidden = next !== 0;
    for (const el of st.targets) {
      const off = el.hasAttribute('data-only')
        ? !String(el.dataset.only).split(/[\s,]+/).map(Number).includes(next)
        : next < Number(el.dataset.at);
      el.classList.toggle('ch-off', off);
    }
    for (const fn of st.listeners) {
      try { fn(next, prev, src); } catch (err) { console.error('[class-html] stepper', err); }
    }
    st.el.dispatchEvent(new CustomEvent('ch-stepper', { bubbles: true, detail: { pos: next, prev, label: st.stops[next], src } }));
  },

  shown(st) { return !st.el.closest('.step:not(.is-shown)'); },

  // → : 같은 장에서 다음 미공개 단계(beforeEl)보다 앞에 있는 단계 막대를 한 칸 연다. 열었으면 true.
  advance(index, beforeEl) {
    for (const st of this.bySlide[index] || []) {
      if (!st.nav || !this.shown(st)) continue;
      if (beforeEl && !(st.el.compareDocumentPosition(beforeEl) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
      if (st.pos < st.max) { this.set(st, st.pos + 1, 'nav'); return true; }
    }
    return false;
  },

  // ← : 마지막으로 연 단계(afterEl)보다 뒤에 있는 단계 막대부터 한 칸 닫는다. 닫았으면 true.
  retreat(index, afterEl) {
    const list = (this.bySlide[index] || []).slice().reverse();
    for (const st of list) {
      if (!st.nav || st.pos === 0) continue;
      if (afterEl && !(afterEl.compareDocumentPosition(st.el) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      this.set(st, st.pos - 1, 'nav');
      return true;
    }
    return false;
  },

  // 장에 들어올 때: 이전 장에서 돌아오면 끝 칸, 그 밖에는 0단계.
  enter(index, all) {
    for (const st of this.bySlide[index] || []) this.set(st, all ? st.max : 0, 'enter');
  },

  // 인쇄·점검처럼 잠깐 모두 펼쳤다가 되돌릴 때 쓴다.
  snapshot() { return this.all.map((st) => [st, st.pos]); },
  openAll(src) { for (const st of this.all) this.set(st, st.max, src); },
  restore(snap, src) { for (const [st, pos] of snap) this.set(st, pos, src); },
};

on('print-before', () => { Stepper.printSnap = Stepper.snapshot(); Stepper.openAll('print'); });
on('print-after', () => {
  if (Stepper.printSnap) Stepper.restore(Stepper.printSnap, 'print');
  Stepper.printSnap = null;
});

/* ---- 53-map-reveal.js ---- */
// 그림 지도 단계 공개: 교과서 지도 그림 위에 근사 다각형을 겹쳐, 아직 아닌 땅을 회색으로 가렸다가 한 칸씩 연다.
// 작성 모양: <figure class="map-reveal" data-stops="시작|…"><img …><svg viewBox="…">
//             <polygon data-from="1" points="…"/> <polygon data-lost="2" points="…"/></svg><figcaption>…</figcaption></figure>
const MapReveal = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.map-reveal', Stage.deck).forEach((fig, n) => {
      // 지도와 막대를 한 덩어리로 묶어 바깥 칸 배치(grid 등)에서 함께 움직이게 한다
      const holder = h('div', { class: 'ch-map-holder' });
      fig.before(holder);
      holder.append(fig);
      const img = fig.querySelector(':scope > img');
      const svg = fig.querySelector(':scope > svg');
      // 그림과 다각형만 상자로 묶어 그림 설명(figcaption)과 겹치지 않게 한다. 상자가 0단계 가림막이 된다.
      const box = h('div', { class: 'ch-map-box veil' });
      fig.insertBefore(box, img || svg || fig.firstChild);
      if (img) box.append(img);
      if (svg) {
        box.append(svg);
        if (!svg.hasAttribute('preserveAspectRatio')) svg.setAttribute('preserveAspectRatio', 'none');
      }
      if (!fig.querySelector('.approx, .ch-approx')) {
        box.append(h('span', { class: 'ch-approx', text: fig.dataset.approx || '근사 · 회색은 아직 열리지 않은 곳' }));
      }
      const masks = [];
      const lost = [];
      if (svg) {
        const hatch = `ch-hatch-${n + 1}`;
        const defs = document.createElementNS(SVG_NS, 'defs');
        const pat = document.createElementNS(SVG_NS, 'pattern');
        for (const [k, v] of Object.entries({ id: hatch, width: 22, height: 22, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' })) pat.setAttribute(k, v);
        for (const [w, fill, op] of [[22, '#fff', '.55'], [9, '#C8352B', '.55']]) {
          const r = document.createElementNS(SVG_NS, 'rect');
          for (const [k, v] of Object.entries({ width: w, height: 22, fill, 'fill-opacity': op })) r.setAttribute(k, v);
          pat.append(r);
        }
        defs.append(pat);
        svg.prepend(defs);
        for (const shape of qsa('[data-from]', svg)) {
          shape.classList.add('ch-m');
          const ring = shape.cloneNode(false);
          ring.removeAttribute('data-from');
          ring.removeAttribute('id');   // 복제본이 같은 id를 갖지 않게
          ring.setAttribute('class', 'ch-o');
          svg.append(ring);   // 테두리는 가림 다각형들보다 위에 그린다
          masks.push({ shape, ring, from: Number(shape.dataset.from) });
        }
        for (const shape of qsa('[data-lost]', svg)) {
          shape.classList.add('ch-lost');
          shape.setAttribute('fill', `url(#${hatch})`);
          lost.push({ shape, at: Number(shape.dataset.lost) });
        }
      }
      const item = { fig, masks, lost, st: null };
      item.st = Stepper.create(fig, { ui: 'range', mount: fig, onChange: (pos) => this.render(item, pos) });
      this.list.push(item);
    });
  },

  render(item, pos) {
    for (const { shape, ring, from } of item.masks) {
      shape.classList.toggle('is-open', from <= pos);
      ring.classList.remove('is-new');
      if (from === pos) {
        ring.getBoundingClientRect();   // 같은 칸을 다시 열면 깜빡임을 처음부터
        ring.classList.add('is-new');
      }
    }
    for (const { shape, at } of item.lost) shape.classList.toggle('is-on', at <= pos);
  },
};

/* ---- 54-yearline.js ---- */
// 연표 막대: 연도에 비례한 축 위에 사건 점을 찍고, 막대로 연도를 옮기면 그해까지의 사건이 켜진다.
// 작성 모양: <ol class="yearline" data-from="1815" data-to="1871"><li data-year="1830" data-tag="프랑스" data-flag>7월 혁명</li>…</ol>
// 단계(→)는 사건이 있는 해마다 한 칸. 막대는 한 해씩 움직일 수 있고, 그사이 연도는 바로 앞 사건 칸으로 센다.
const YL_COLORS = ['#2F5FBF', '#C8352B', '#1E8E4E', '#C04F15', '#7A4FBF', '#1E8EB0', '#3A3F47', '#B8860B'];

const Yearline = {
  list: [],

  init() {
    this.list = [];
    for (const ol of qsa('ol.yearline', Stage.deck)) {
      const events = qsa(':scope > li[data-year]', ol)
        .map((li) => ({ li, year: Number(li.dataset.year), tag: li.dataset.tag || '', flag: li.hasAttribute('data-flag') }))
        .filter((e) => Number.isFinite(e.year))
        .sort((a, b) => a.year - b.year);
      if (!events.length) continue;
      const years = [...new Set(events.map((e) => e.year))];
      const num = (v) => (v != null && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
      const from = Math.min(num(ol.dataset.from) ?? years[0], years[0]);
      const to = Math.max(num(ol.dataset.to) ?? years[years.length - 1], years[years.length - 1]);
      const min = from - 1;   // 맨 왼쪽은 '시작'
      const span = Math.max(1, to - min);
      const x = (y) => `${((y - min) / span) * 100}%`;
      const colors = new Map();
      for (const li of qsa(':scope > li[data-color]', ol)) colors.set(li.dataset.tag || '', li.dataset.color);
      for (const e of events) if (!colors.has(e.tag)) colors.set(e.tag, YL_COLORS[colors.size % YL_COLORS.length]);

      const wrap = h('div', { class: 'ch-yearline' });
      ol.before(wrap);
      const now = h('div', { class: 'ch-yl-now', 'aria-live': 'polite', text: '시작' });
      const recent = h('ul', { class: 'ch-yl-list' });
      const axis = h('div', { class: 'ch-yl-axis', 'aria-hidden': 'true' });
      const sameYear = new Map();
      for (const e of events) {
        const n = sameYear.get(e.year) || 0;
        sameYear.set(e.year, n + 1);
        e.color = colors.get(e.tag);
        e.dot = h('i', { class: 'ch-yl-dot', style: `left:${x(e.year)};--c:${e.color};--n:${n}` });
        axis.append(e.dot);
        if (e.flag) {
          e.flagEl = h('div', { class: 'ch-yl-flag', style: `left:${x(e.year)}` }, h('b', { text: String(e.year) }), h('span', null, ...this.copy(e.li)));
          axis.append(e.flagEl);
        }
      }
      const range = h('input', { type: 'range', min, max: to, step: 1, value: min, 'aria-label': ol.getAttribute('aria-label') || '연도' });
      const ticks = h('div', { class: 'ch-stop-labels ch-yl-ticks', 'aria-hidden': 'true' });
      const tickYears = [...new Set([years[0], ...events.filter((e) => e.flag).map((e) => e.year), to])];
      const pct = (y) => ((y - min) / span) * 100;
      const kept = [];
      for (const y of tickYears) {
        const last = kept.length ? pct(kept[kept.length - 1]) : 0;
        if (pct(y) - last < 7 && y !== to) continue;
        if (y === to && kept.length && pct(y) - pct(kept[kept.length - 1]) < 7) kept.pop();
        kept.push(y);
      }
      ticks.append(h('span', { text: '시작', style: 'left:0%' }), ...kept.map((y) => h('span', { text: String(y), style: `left:${x(y)}` })));
      wrap.append(h('div', { class: 'ch-yl-head' }, now, recent), axis, h('div', { class: 'ch-stops ch-yl-stops' }, range, ticks), ol);

      const item = { ol, wrap, events, years, min, to, range, now, recent, year: min, st: null };
      item.st = Stepper.create(wrap, { ui: 'none', stops: ['시작', ...years.map(String)], onChange: (pos, prev, src) => this.render(item, pos, src) });
      range.addEventListener('input', () => {
        item.year = Number(range.value);
        const pos = years.filter((y) => y <= item.year).length;
        if (pos === item.st.pos) this.render(item, pos, 'input');
        else item.st.set(pos, 'input');
      });
      range.addEventListener('change', () => range.blur());
      this.list.push(item);
    }
  },

  // li 안의 글(줄바꿈·굵게 포함)을 복제한다. 어절 span(.w)은 그대로 둔다.
  copy(li) { return Array.from(li.childNodes).map((n) => n.cloneNode(true)); },

  render(item, pos, src) {
    // 막대로 고른 연도는 그대로 두고, → ←나 처음·인쇄로 바뀐 칸은 그 칸의 연도로 맞춘다
    if (src !== 'input') item.year = pos === 0 ? item.min : item.years[pos - 1];
    const y = item.year;
    item.range.value = String(y);
    item.range.style.setProperty('--p', `${((y - item.min) / Math.max(1, item.to - item.min)) * 100}%`);
    item.range.setAttribute('aria-valuetext', y === item.min ? '시작' : `${y}년`);
    item.now.textContent = y === item.min ? '시작' : `${y}년`;
    for (const e of item.events) {
      e.dot.classList.toggle('is-on', e.year <= y);
      if (e.flagEl) e.flagEl.classList.toggle('is-on', e.year <= y);
    }
    const past = item.events.filter((e) => e.year <= y).slice(-4).reverse();
    item.recent.replaceChildren(...(y === item.min
      ? [h('li', { class: 'ch-yl-hint', text: '막대를 오른쪽으로 움직여 보자.' })]
      : past.map((e) => h('li', { class: e.year === y ? 'is-now' : '' },
        e.tag ? h('span', { class: 'ch-yl-tag', style: `--c:${e.color}`, text: e.tag }) : null,
        h('b', { text: String(e.year) }), h('span', null, ...this.copy(e.li))))));
  },
};

/* ---- 55-sort.js ---- */
// 분류 카드: 카드를 끌어 칸에 놓거나, 카드를 누른 뒤 칸을 누른다. 맞으면 칸에 붙고 이유, 틀리면 흔들림과 실마리.
// 작성 모양: <div class="sort"><div class="bin" data-bin="a"><h3>칸 이름</h3></div> …
//            <span data-bin="a" data-why="맞을 때 이유" data-hint="틀릴 때 실마리">카드</span> …</div>
// 펜을 든 채로 끌어도 카드가 움직인다(data-no-ink). 칸은 톡 누르기(data-tap).

// 장 열쇠로 정해지는 난수: 같은 덱은 열 때마다 같은 순서로 섞인다.
function seededRandom(text) {
  let a = 2166136261;
  for (const c of String(text)) a = Math.imul(a ^ c.codePointAt(0), 16777619);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, seed) {
  const rnd = seededRandom(seed);
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// 틀렸을 때 흔들기(transform 애니메이션). 같은 요소를 연달아 흔들어도 처음부터 다시 한다.
function shake(el) {
  el.classList.remove('ch-shake');
  void el.offsetWidth;
  el.classList.add('ch-shake');
}

const Sort = {
  list: [],

  init() {
    this.list = [];
    qsa('.sort', Stage.deck).forEach((box, n) => {
      const bins = qsa(':scope .bin[data-bin]', box);
      const cards = qsa(':scope [data-bin]:not(.bin)', box);
      if (!bins.length || !cards.length) return;
      const slide = box.closest('section.slide');
      const order = shuffled(cards, `${slide ? slide.dataset.key : ''}#sort${n}`);
      const pool = h('div', { class: 'ch-pool' });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } });
      const item = { box, bins, cards, order, pool, fb, reset, sel: null, slide };
      box.prepend(pool);
      box.append(h('div', { class: 'ch-row' }, fb, reset));
      if (bins.every((b) => b.parentElement === box)) box.style.setProperty('--cols', String(Math.min(bins.length, 4)));
      for (const b of bins) {
        b.setAttribute('data-tap', '');
        b.addEventListener('click', (e) => { if (item.sel && !e.target.closest('.ch-card')) this.drop(item, item.sel, b); });
      }
      for (const c of cards) {
        c.classList.add('ch-card');
        c.setAttribute('data-no-ink', '');
        c.setAttribute('role', 'button');
        c.tabIndex = 0;
        this.bindDrag(item, c);
        c.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();   // 장 넘기기로 가지 않게
          this.select(item, c);
        });
      }
      this.reset(item);
      this.list.push(item);
    });
    on('print-before', () => this.printOpen());
    on('print-after', () => this.printClose());
  },

  reset(item) {
    item.sel = null;
    for (const c of item.order) {
      c.classList.remove('is-done', 'is-sel', 'is-drag', 'ch-shake');
      c.style.transform = '';
      item.pool.append(c);
    }
    item.pool.hidden = false;
    item.fb.textContent = '';
    item.fb.className = 'ch-fb';
  },

  select(item, card) {
    if (card.classList.contains('is-done')) return;
    const on = !card.classList.contains('is-sel');
    for (const c of item.cards) c.classList.remove('is-sel');
    card.classList.toggle('is-sel', on);
    item.sel = on ? card : null;
  },

  drop(item, card, bin) {
    card.classList.remove('is-sel', 'is-drag');
    card.style.transform = '';
    item.sel = null;
    if (card.dataset.bin === bin.dataset.bin) {
      bin.append(card);
      card.classList.add('is-done');
      item.fb.textContent = card.dataset.why || '맞다.';
      item.fb.className = 'ch-fb is-ok';
      if (item.cards.every((c) => c.classList.contains('is-done'))) this.finish(item, card);
    } else {
      item.fb.textContent = `다시 생각해 보자. ${card.dataset.hint || ''}`.trim();
      item.fb.className = 'ch-fb is-bad';
      shake(card);
    }
  },

  // 다 맞히면 같은 장에서 이 부품 뒤의 첫 단계를 연다(조금 뒤에).
  finish(item, last) {
    item.fb.textContent = `모두 맞혔다! ${last.dataset.why || ''}`.trim();
    item.pool.hidden = true;
    const next = item.slide && qsa('.step', item.slide).find((s) => item.box.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.box.contains(s));
    if (next) setTimeout(() => Nav.revealTo(next), 600);
  },

  binAt(item, x, y, card) {
    card.style.visibility = 'hidden';
    const under = document.elementFromPoint(x, y);
    card.style.visibility = '';
    const bin = under && under.closest('.bin[data-bin]');
    return bin && item.bins.includes(bin) ? bin : null;
  },

  bindDrag(item, card) {
    let d = null;
    card.addEventListener('pointerdown', (e) => {
      if (card.classList.contains('is-done') || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      d = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* 합성 이벤트 */ }
    });
    card.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      const dx = (e.clientX - d.x) / Stage.scale;
      const dy = (e.clientY - d.y) / Stage.scale;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
      d.moved = true;
      card.classList.add('is-drag');
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      const bin = this.binAt(item, e.clientX, e.clientY, card);
      for (const b of item.bins) b.classList.toggle('is-hover', b === bin);
    });
    const end = (e, cancel) => {
      if (!d || e.pointerId !== d.id) return;
      const moved = d.moved;
      d = null;
      for (const b of item.bins) b.classList.remove('is-hover');
      if (!moved) { card.classList.remove('is-drag'); if (!cancel) this.select(item, card); return; }
      const bin = cancel ? null : this.binAt(item, e.clientX, e.clientY, card);
      if (bin) this.drop(item, card, bin);
      else { card.style.transform = ''; card.classList.remove('is-drag'); }
    };
    card.addEventListener('pointerup', (e) => end(e, false));
    card.addEventListener('pointercancel', (e) => end(e, true));
  },

  // 인쇄: 카드를 모두 정답 칸에 넣었다가 되돌린다.
  printOpen() {
    this.printSnap = [];
    for (const item of this.list) {
      this.printSnap.push({ item, places: item.cards.map((c) => [c, c.parentNode, c.nextSibling, c.className]), poolHidden: item.pool.hidden });
      for (const c of item.cards) {
        const bin = item.bins.find((b) => b.dataset.bin === c.dataset.bin);
        if (bin && c.parentNode !== bin) bin.append(c);
        c.classList.add('is-done');
      }
      item.pool.hidden = true;
    }
  },

  printClose() {
    for (const { item, places, poolHidden } of (this.printSnap || []).reverse()) {
      for (const [c, parent, next, cls] of places.slice().reverse()) {
        parent.insertBefore(c, next && next.parentNode === parent ? next : null);
        c.className = cls;
      }
      item.pool.hidden = poolHidden;
    }
    this.printSnap = null;
  },
};

/* ---- 56-quiz.js ---- */
// 즉시 확인 문제. 하나 고르기: 누르면 바로 맞음·틀림과 그 보기의 이유. 여러 개 고르기(data-multi): 고른 뒤 「확인」.
// 작성 모양: <div class="quiz"><p>물음</p><button class="opt" data-why="…">보기</button><button class="opt" data-ok data-why="…">보기</button></div>
// 번호(①②…)는 엔진이 붙인다(data-num="off"로 끔). data-cols="2"면 보기를 두 줄로 놓는다.
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

const Quiz = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.quiz', Stage.deck)) {
      const opts = qsa(':scope .opt', box);
      if (!opts.length) continue;
      const slide = box.closest('section.slide');
      const multi = box.hasAttribute('data-multi');
      // 바로 아래 보기들을 한 상자에 모아 줄을 맞춘다
      const direct = opts.filter((o) => o.parentElement === box);
      if (direct.length) {
        const wrap = h('div', { class: 'ch-opts', style: `--cols:${clamp(Number(box.dataset.cols) || 1, 1, 4)}` });
        direct[0].before(wrap);
        wrap.append(...direct);
      }
      opts.forEach((o, i) => {
        if (o.tagName !== 'BUTTON') { o.setAttribute('role', 'button'); o.setAttribute('data-tap', ''); o.tabIndex = 0; }
        else o.type = 'button';
        if (box.dataset.num !== 'off') o.prepend(h('i', { class: 'ch-opt-n', 'aria-hidden': 'true', text: CIRCLED[i] || String(i + 1) }));
        if (multi) o.setAttribute('aria-pressed', 'false');
      });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { box, opts, multi, fb, slide, solved: false };
      if (multi) {
        const check = h('button', { type: 'button', class: 'ch-check-btn', text: '확인', onclick: (e) => { this.check(item); e.currentTarget.blur(); } });
        box.append(h('div', { class: 'ch-row' }, check, fb));
        item.check = check;
      } else box.append(fb);
      for (const o of opts) {
        o.addEventListener('click', () => (multi ? this.toggle(item, o) : this.pick(item, o)));
        if (o.tagName !== 'BUTTON') {
          o.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            o.click();
          });
        }
      }
      this.list.push(item);
    }
  },

  pick(item, o) {
    const ok = o.hasAttribute('data-ok');
    o.classList.add(ok ? 'is-right' : 'is-wrong');
    item.fb.textContent = o.dataset.why || (ok ? '맞다.' : '다시 생각해 보자.');
    item.fb.className = `ch-fb ${ok ? 'is-ok' : 'is-bad'}`;
    if (!ok) shake(o);
    else this.solve(item);
    if (o.tagName === 'BUTTON') o.blur();
  },

  toggle(item, o) {
    for (const x of item.opts) x.classList.remove('is-right', 'is-wrong', 'is-miss');
    const on = o.getAttribute('aria-pressed') !== 'true';
    o.setAttribute('aria-pressed', String(on));
    o.classList.toggle('is-pick', on);
    item.fb.textContent = '';
    item.fb.className = 'ch-fb';
    if (o.tagName === 'BUTTON') o.blur();
  },

  check(item) {
    let right = 0;
    for (const o of item.opts) {
      const ok = o.hasAttribute('data-ok');
      const pick = o.classList.contains('is-pick');
      o.classList.toggle('is-right', pick && ok);
      o.classList.toggle('is-wrong', pick && !ok);
      o.classList.toggle('is-miss', !pick && ok);
      if (pick === ok) right += 1;
    }
    const all = right === item.opts.length;
    item.fb.textContent = all ? (item.box.dataset.why || '맞다. 모두 바르게 골랐다.')
      : `${item.opts.length}개 가운데 ${right}개를 맞게 판단했다. 점선은 골라야 하는데 고르지 않은 것이다.`;
    item.fb.className = `ch-fb ${all ? 'is-ok' : 'is-bad'}`;
    if (all) this.solve(item);
  },

  // 처음 맞혔을 때 같은 장에서 문제 뒤의 첫 단계를 연다(조금 뒤에).
  solve(item) {
    if (item.solved) return;
    item.solved = true;
    const next = item.slide && qsa('.step', item.slide).find((s) => item.box.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.box.contains(s));
    if (next) setTimeout(() => Nav.revealTo(next), 600);
  },
};

/* ---- 57-order.js ---- */
// 순서 배열: 작성자는 정답 순서로 쓰고, 엔진이 섞어 내놓는다. 차례로 눌러 '내가 만든 순서'를 쌓고, 다 쌓으면 자리마다 채점한다.
// 작성 모양: <ol class="order"><li data-why="이유">첫 사건</li><li>둘째 사건</li>…</ol>
const Order = {
  list: [],

  init() {
    this.list = [];
    qsa('ol.order', Stage.deck).forEach((ol, n) => {
      const items = qsa(':scope > li', ol).map((li, i) => ({ li, i }));
      if (items.length < 2) return;
      const slide = ol.closest('section.slide');
      let mixed = shuffled(items, `${slide ? slide.dataset.key : ''}#order${n}`);
      if (mixed.every((x, k) => x.i === k)) mixed = mixed.slice(1).concat(mixed[0]);   // 처음부터 정답이면 한 칸 돌린다
      const wrap = h('div', { class: 'ch-order' });
      ol.before(wrap);
      const bank = h('div', { class: 'ch-order-bank' });
      const slots = h('ol', { class: 'ch-order-slots' });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { ol, wrap, items, mixed, bank, slots, fb, seq: [], slide, solved: false };
      for (const x of mixed) {
        x.btn = h('button', { type: 'button', class: 'ch-order-item' }, ...Array.from(x.li.childNodes).map((c) => c.cloneNode(true)));
        x.btn.addEventListener('click', (e) => { this.push(item, x); e.currentTarget.blur(); });
        bank.append(x.btn);
      }
      const undo = h('button', { type: 'button', class: 'ch-reset', text: '한 칸 되돌리기', onclick: (e) => { this.pop(item); e.currentTarget.blur(); } });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } });
      wrap.append(bank, h('div', { class: 'ch-order-out' }, h('h3', { text: '내가 만든 순서' }), slots, h('div', { class: 'ch-row' }, undo, reset)), fb);
      wrap.append(ol);
      this.reset(item);
      this.list.push(item);
    });
  },

  render(item) {
    const n = item.items.length;
    item.slots.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const x = item.seq[k];
      return x ? h('li', { class: 'is-filled' }, h('span', null, ...Array.from(x.li.childNodes).map((c) => c.cloneNode(true))))
        : h('li', { class: 'is-empty', 'aria-label': '빈칸' });
    }));
    for (const x of item.items) x.btn.disabled = item.seq.includes(x);
    if (item.seq.length === n) this.grade(item);
    else { item.fb.textContent = ''; item.fb.className = 'ch-fb'; }
  },

  push(item, x) {
    if (item.seq.includes(x) || item.seq.length >= item.items.length) return;
    item.seq.push(x);
    this.render(item);
  },

  pop(item) { item.seq.pop(); this.render(item); },
  reset(item) { item.seq = []; this.render(item); },

  grade(item) {
    let right = 0;
    Array.from(item.slots.children).forEach((li, k) => {
      const ok = item.seq[k].i === k;
      li.classList.add(ok ? 'is-right' : 'is-wrong');
      if (ok) {
        right += 1;
        if (item.seq[k].li.dataset.why) li.append(h('small', { class: 'ch-order-why', text: item.seq[k].li.dataset.why }));
      }
    });
    const all = right === item.items.length;
    item.fb.textContent = all ? '맞다. 순서가 모두 맞다.' : `${item.items.length}개 가운데 ${right}개가 제자리다. 빨간 칸부터 다시 생각해 보자.`;
    item.fb.className = `ch-fb ${all ? 'is-ok' : 'is-bad'}`;
    if (all && !item.solved) {
      item.solved = true;
      const next = item.slide && qsa('.step', item.slide).find((s) => item.wrap.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.wrap.contains(s));
      if (next) setTimeout(() => Nav.revealTo(next), 600);
    }
  },
};

/* ---- 58-calc.js ---- */
// 계산 상자: 입력(슬라이더·숫자·고르기·단추)이 바뀌면 식을 다시 계산해 글자·보이기·클래스·모양·SVG 속성을 바꾼다.
// 작성 모양: <div class="calc" data-const="k = 8.7" data-let="o = k / v; s = o - t">
//   <input type="range" name="v" …> <output data-expr="s" data-digits="1" data-unit="기압"></output>
//   <p data-show="v < 1">…</p> <p data-class="is-ok: s > 0"> <div class="bar" data-value="s" data-max="10"></div>
//   <button data-set="sex" data-value="여">여</button> <rect data-attr="width: 200 * v"/> </div>
// 식은 50-expr.js(eval 없음). 식 오류는 그 자리에 '?'를 쓰고 자동 점검에 알린다.
const CALC_BIND = '[data-expr], [data-show], [data-class], [data-style], [data-attr], .bar[data-value]';
const CALC_UNITLESS = /^(opacity|z-index|flex|flex-grow|flex-shrink|order|font-weight|line-height|scale)$/;

const Calc = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.calc', Stage.deck)) {
      const item = { box, consts: {}, lets: [], binds: [], errors: [], listeners: [], scope: {} };
      const own = (el) => el.closest('.calc') === box;
      const fail = (el, msg) => item.errors.push({ el, msg });
      const consts = Expr.lets(box.dataset.const || '');
      if (!consts.ok) fail(box, `data-const: ${consts.error}`);
      for (const { name, fn } of consts.list) {
        try { item.consts[name] = fn(item.consts); } catch (err) { fail(box, `data-const ${name}: ${err.message}`); }
      }
      const lets = Expr.lets(box.dataset.let || '');
      if (!lets.ok) fail(box, `data-let: ${lets.error}`);
      item.lets = lets.list;
      const targets = qsa(CALC_BIND, box).filter(own);
      if (box.matches(CALC_BIND)) targets.unshift(box);
      for (const el of targets) this.bind(item, el, fail);
      // 단추 고르기: 같은 이름 단추 가운데 하나만 눌린다. 처음에는 aria-pressed="true"인 것, 없으면 첫 단추.
      const sets = qsa('[data-set][data-value]', box).filter(own);
      for (const name of new Set(sets.map((b) => b.dataset.set))) {
        const group = sets.filter((b) => b.dataset.set === name);
        const first = group.find((b) => b.getAttribute('aria-pressed') === 'true') || group[0];
        for (const b of group) {
          if (b.tagName === 'BUTTON') b.type = 'button';
          else { b.setAttribute('role', 'button'); b.setAttribute('data-tap', ''); }
          b.setAttribute('aria-pressed', String(b === first));
          b.addEventListener('click', () => {
            for (const x of group) x.setAttribute('aria-pressed', String(x === b));
            if (b.blur) b.blur();
            this.update(item);
          });
        }
      }
      item.inputs = qsa('input[name], select[name], textarea[name]', box).filter((el) => own(el) && !el.closest('.ch-stops'));
      // 단계 막대(.reveal 등)에 data-name이 있으면 지금 칸 번호를 그 이름의 변수로 쓴다
      item.steppers = qsa('.ch-stepper[data-name]', box).filter(own);
      box.addEventListener('ch-stepper', (e) => { if (item.steppers.includes(e.target)) this.update(item); });
      item.sets = sets;
      box.addEventListener('input', (e) => { if (own(e.target)) this.update(item); });
      box.addEventListener('change', (e) => {
        if (!own(e.target)) return;
        this.update(item);
        if (e.target.type === 'range') e.target.blur();   // 손을 떼면 Space·→가 다시 넘기기로
      });
      this.list.push(item);
      this.update(item);
    }
  },

  // 'a: 식; b: 식' → [[a, 식]]. 따옴표 안의 ;는 나누지 않고, 이름 뒤 첫 :에서 자른다(식 안의 ? :는 그대로).
  pairs(src) {
    const out = [];
    let cur = '';
    let quote = '';
    for (const c of `${src};`) {
      if (quote) { if (c === quote) quote = ''; cur += c; continue; }
      if (c === '"' || c === "'") quote = c;
      if (c === ';') {
        const m = /^\s*([\w-]+)\s*:([\s\S]*)$/.exec(cur);
        if (m) out.push([m[1], m[2].trim()]);
        else if (cur.trim()) out.push([null, cur.trim()]);
        cur = '';
        continue;
      }
      cur += c;
    }
    return out;
  },

  compileOne(src, el, fail, label) {
    const c = Expr.compile(src);
    if (!c.ok) { fail(el, `${label}: ${c.error}`); return null; }
    return c.fn;
  },

  bind(item, el, fail) {
    const b = { el, expr: null, show: null, cls: [], style: [], attr: [], bar: null, max: null, warned: false };
    const ds = el.dataset;
    if (ds.expr != null) b.expr = this.compileOne(ds.expr, el, fail, 'data-expr') || 'bad';
    if (ds.show != null) b.show = this.compileOne(ds.show, el, fail, 'data-show') || 'bad';
    for (const [key, list] of [['class', b.cls], ['style', b.style], ['attr', b.attr]]) {
      if (ds[key] == null) continue;
      for (const [name, src] of this.pairs(ds[key])) {
        if (!name) { fail(el, `data-${key}: '이름: 식' 꼴이 아니에요 (${src})`); continue; }
        const fn = this.compileOne(src, el, fail, `data-${key} ${name}`);
        if (fn) list.push([name, fn]);
      }
    }
    if (el.matches('.bar[data-value]')) {
      b.bar = this.compileOne(ds.value, el, fail, 'data-value');
      b.max = this.compileOne(ds.max || '100', el, fail, 'data-max');
    }
    item.binds.push(b);
  },

  read(item) {
    const scope = Object.assign(Object.create(null), item.consts);
    const num = (v) => (/^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(v) ? Number(v) : v);
    for (const el of item.inputs) {
      const name = el.getAttribute('name');
      if (el.type === 'radio') { if (el.checked) scope[name] = num(el.value); else if (!(name in scope)) scope[name] = ''; continue; }
      if (el.type === 'checkbox') { scope[name] = el.checked; continue; }
      if (el.type === 'range' || el.type === 'number') {
        scope[name] = el.value === '' ? NaN : Number(el.value);
        if (el.type === 'range') {
          const lo = Number(el.min || 0);
          const hi = Number(el.max || 100);
          el.style.setProperty('--p', `${hi > lo ? ((Number(el.value) - lo) / (hi - lo)) * 100 : 0}%`);
        }
        continue;
      }
      scope[name] = num(el.value);
    }
    for (const b of item.sets) if (b.getAttribute('aria-pressed') === 'true') scope[b.dataset.set] = num(b.dataset.value);
    for (const el of item.steppers) scope[el.dataset.name] = Number(el.dataset.pos || 0);
    return scope;
  },

  update(item) {
    const scope = this.read(item);
    for (const { name, fn } of item.lets) {
      try { scope[name] = fn(scope); } catch (err) { scope[name] = NaN; this.runtime(item, item.box, `data-let ${name}: ${err.message}`); }
    }
    item.scope = scope;
    const val = (b, fn) => {
      try { return fn(scope); } catch (err) { this.runtime(item, b.el, err.message); return NaN; }
    };
    for (const b of item.binds) {
      const el = b.el;
      if (b.expr) {
        const unit = el.dataset.unit ? ` ${el.dataset.unit}` : '';
        const digits = el.dataset.digits != null && el.dataset.digits !== '' ? Number(el.dataset.digits) : undefined;
        const v = b.expr === 'bad' ? NaN : val(b, b.expr);
        const text = Expr.format(v, Number.isInteger(digits) ? digits : undefined);
        el.textContent = text === '?' ? '?' : text + unit;
      }
      if (b.show) el.classList.toggle('ch-hide', b.show === 'bad' || !val(b, b.show));
      for (const [name, fn] of b.cls) el.classList.toggle(name, !!val(b, fn));
      for (const [name, fn] of b.style) {
        const v = val(b, fn);
        const ok = typeof v === 'string' || Number.isFinite(v);
        el.style.setProperty(name, !ok ? '' : typeof v === 'number' && !name.startsWith('--') && !CALC_UNITLESS.test(name) ? `${v}px` : String(v));
      }
      for (const [name, fn] of b.attr) {
        const v = val(b, fn);
        if (typeof v === 'number') { if (Number.isFinite(v)) el.setAttribute(name, String(Math.round(v * 1000) / 1000)); }
        else el.setAttribute(name, String(v));
      }
      if (b.bar && b.max) {
        const v = Number(val(b, b.bar));
        const max = Number(val(b, b.max));
        el.style.setProperty('--f', String(Number.isFinite(v) && max > 0 ? clamp(v / max, 0, 1) : 0));
      }
    }
    for (const fn of item.listeners) {
      try { fn(scope); } catch (err) { console.error('[class-html] calc', err); }
    }
  },

  // 실행 중 오류(모르는 이름 등)는 처음 한 번만 적는다.
  runtime(item, el, msg) {
    if (item.errors.some((e) => e.el === el && e.msg === msg)) return;
    item.errors.push({ el, msg });
  },

  of(el) { const box = el.closest('.calc'); return box ? this.list.find((x) => x.box === box) || null : null; },
};

/* ---- 59-plot.js ---- */
// 그래프: 식 곡선, 세로 표시선, 점. .calc 안에 있으면 그 변수를 쓰고 값이 바뀔 때마다 다시 그린다. 곡선의 가로 변수는 x.
// 작성 모양: <figure class="plot" data-x="0.85, 1.35" data-y="0, 11" data-xlabel="부피" data-ylabel="압력(기압)">
//   <i data-line="8.7 / x" data-label="삼투압"></i> <i data-vline="v"></i> <i data-point="v, s" data-label="지금"></i></figure>
const PLOT_COLORS = ['var(--accent)', '#2563EB', '#2E9E6A', '#7A4FBF', '#C8352B', '#B8860B'];
const PLOT_PAD = { l: 76, r: 18, t: 18, b: 64 };

function svgEl(tag, attrs, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, String(v));
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}

// 1·2·5 × 10ⁿ 간격 눈금
function niceTicks(lo, hi, count) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / Math.max(1, count);
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw * 0.999) || 10 * p;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const Plot = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.plot', Stage.deck).forEach((fig, n) => {
      const item = { fig, n, errors: [], lines: [], vlines: [], points: [], svg: null, legend: null, w: 0, h: 0, calc: Calc.of(fig) };
      const fail = (msg) => item.errors.push({ el: fig, msg });
      const range = (src, name) => {
        const parts = String(src || '').split(',').map((s) => Expr.compile(s.trim()));
        if (parts.length !== 2 || parts.some((c) => !c.ok)) { fail(`${name}: '작은 값, 큰 값' 꼴로 써 주세요`); return [0, 1]; }
        try {
          const [a, b] = parts.map((c) => Number(c.fn(item.calc ? item.calc.consts : {})));
          if (!(b > a)) { fail(`${name}: 큰 값이 작은 값보다 커야 해요`); return [0, 1]; }
          return [a, b];
        } catch (err) { fail(`${name}: ${err.message}`); return [0, 1]; }
      };
      item.x = range(fig.dataset.x, 'data-x');
      item.y = range(fig.dataset.y, 'data-y');
      let color = 0;
      for (const el of qsa(':scope > [data-line], :scope > [data-vline], :scope > [data-point]', fig)) {
        el.hidden = true;
        const c = (src, label) => {
          const r = Expr.compile(src);
          if (!r.ok) { fail(`${label}: ${r.error}`); return null; }
          return r.fn;
        };
        if (el.dataset.line != null) {
          const fn = c(el.dataset.line, 'data-line');
          if (fn) item.lines.push({ fn, label: el.dataset.label || '', dash: el.hasAttribute('data-dash'), color: el.dataset.color || PLOT_COLORS[color++ % PLOT_COLORS.length] });
        } else if (el.dataset.vline != null) {
          const fn = c(el.dataset.vline, 'data-vline');
          if (fn) item.vlines.push({ fn, label: el.dataset.label || '' });
        } else {
          const [xs, ys] = this.split(el.dataset.point);
          const fx = c(xs, 'data-point x');
          const fy = c(ys, 'data-point y');
          if (fx && fy) item.points.push({ fx, fy, label: el.dataset.label || '', color: el.dataset.color || 'var(--ch-ink)' });
        }
      }
      if (item.lines.some((l) => l.label)) {
        item.legend = h('div', { class: 'ch-plot-legend' }, ...item.lines.filter((l) => l.label).map((l) => h('span', {
          class: l.dash ? 'is-dash' : '', style: `--c:${l.color}`, text: l.label,
        })));
        fig.prepend(item.legend);
      }
      item.svg = svgEl('svg', { class: 'ch-plot-svg', role: 'img', 'aria-label': fig.getAttribute('aria-label') || fig.dataset.ylabel || '그래프' });
      fig.append(item.svg);
      if (item.calc) item.calc.listeners.push(() => this.draw(item));
      this.list.push(item);
      this.layout(item);
    });
    on('show', (slide) => { for (const item of this.list) if (slide.contains(item.fig)) this.layout(item); });
    on('print-before', () => { for (const item of this.list) this.layout(item); });
  },

  // 'v, s' → ['v', 's'] (괄호 안의 쉼표는 나누지 않는다)
  split(src) {
    let depth = 0;
    const s = String(src || '');
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      else if (s[i] === ',' && depth === 0) return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }
    return [s, ''];
  },

  // 보이지 않는 장에 있어도 크기를 재도록 잠깐 펼쳐 잰다(화면에 그리지는 않는다).
  layout(item) {
    const slide = item.fig.closest('section.slide');
    const hidden = slide && getComputedStyle(slide).display === 'none';
    if (hidden) slide.classList.add('ch-measure');
    const w = Math.round(item.fig.clientWidth);
    const h = Math.round(Number(item.fig.dataset.height) || 340);
    if (hidden) slide.classList.remove('ch-measure');
    if (!w) return;
    if (w === item.w && h === item.h && item.svg.firstChild) { this.draw(item); return; }
    item.w = w;
    item.h = h;
    this.axes(item);
    this.draw(item);
  },

  sx(item, v) { return PLOT_PAD.l + ((v - item.x[0]) / (item.x[1] - item.x[0])) * (item.w - PLOT_PAD.l - PLOT_PAD.r); },
  sy(item, v) { return item.h - PLOT_PAD.b - ((v - item.y[0]) / (item.y[1] - item.y[0])) * (item.h - PLOT_PAD.t - PLOT_PAD.b); },

  axes(item) {
    const { w, h } = item;
    const svg = item.svg;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    const clip = `ch-plot-clip-${item.n + 1}`;
    const x0 = PLOT_PAD.l;
    const x1 = w - PLOT_PAD.r;
    const y0 = h - PLOT_PAD.b;
    const y1 = PLOT_PAD.t;
    const grid = svgEl('g', { class: 'ch-plot-grid' });
    const labels = svgEl('g', { class: 'ch-plot-ticks' });
    for (const v of niceTicks(item.x[0], item.x[1], Math.max(2, Math.floor((x1 - x0) / 90)))) {
      const x = this.sx(item, v);
      grid.append(svgEl('line', { x1: x, x2: x, y1, y2: y0 }));
      labels.append(svgEl('text', { x, y: y0 + 26, 'text-anchor': 'middle' }, Expr.format(v)));
    }
    for (const v of niceTicks(item.y[0], item.y[1], Math.max(2, Math.floor((y0 - y1) / 70)))) {
      const y = this.sy(item, v);
      grid.append(svgEl('line', { x1: x0, x2: x1, y1: y, y2: y }));
      labels.append(svgEl('text', { x: x0 - 10, y: y + 7, 'text-anchor': 'end' }, Expr.format(v)));
    }
    const axis = svgEl('path', { class: 'ch-plot-axis', d: `M${x0} ${y1}V${y0}H${x1}` });
    const kids = [
      svgEl('defs', null, svgEl('clipPath', { id: clip }, svgEl('rect', { x: x0, y: y1, width: x1 - x0, height: y0 - y1 }))),
      grid, axis, labels,
    ];
    if (item.fig.dataset.xlabel) kids.push(svgEl('text', { class: 'ch-plot-label', x: (x0 + x1) / 2, y: h - 8, 'text-anchor': 'middle' }, item.fig.dataset.xlabel));
    if (item.fig.dataset.ylabel) kids.push(svgEl('text', { class: 'ch-plot-label', x: 0, y: 0, 'text-anchor': 'middle', transform: `translate(22 ${(y0 + y1) / 2}) rotate(-90)` }, item.fig.dataset.ylabel));
    item.layer = svgEl('g', { 'clip-path': `url(#${clip})` });
    item.marks = svgEl('g', { class: 'ch-plot-marks' });
    kids.push(item.layer, item.marks);
    svg.replaceChildren(...kids);
  },

  // 곡선은 가로 200칸으로 나눠 계산하고, 값이 없는 곳(0으로 나누기 등)에서 끊는다.
  sample(item, fn, scope) {
    const N = 200;
    const pts = [];
    let seg = [];
    const s = Object.assign(Object.create(null), scope);
    for (let i = 0; i <= N; i++) {
      const x = item.x[0] + ((item.x[1] - item.x[0]) * i) / N;
      s.x = x;
      let y;
      try { y = Number(fn(s)); } catch (err) { y = NaN; }
      if (Number.isFinite(y)) seg.push([this.sx(item, x), clamp(this.sy(item, y), -10 * item.h, 11 * item.h)]);
      else if (seg.length) { pts.push(seg); seg = []; }
    }
    if (seg.length) pts.push(seg);
    return pts;
  },

  draw(item) {
    if (!item.layer) return;
    const scope = item.calc ? item.calc.scope : {};
    const r = (v) => Math.round(v * 10) / 10;
    item.layer.replaceChildren(...item.lines.map((l) => {
      const d = this.sample(item, l.fn, scope).map((seg) => `M${seg.map(([x, y]) => `${r(x)} ${r(y)}`).join('L')}`).join('');
      return svgEl('path', { class: `ch-plot-line${l.dash ? ' is-dash' : ''}`, d, style: `stroke:${l.color}` });
    }));
    const val = (fn) => { try { return Number(fn(scope)); } catch (err) { return NaN; } };
    const marks = [];
    for (const v of item.vlines) {
      const x = val(v.fn);
      if (!Number.isFinite(x) || x < item.x[0] || x > item.x[1]) continue;
      const px = r(this.sx(item, x));
      marks.push(svgEl('line', { class: 'ch-plot-vline', x1: px, x2: px, y1: PLOT_PAD.t, y2: item.h - PLOT_PAD.b }));
    }
    for (const p of item.points) {
      const x = val(p.fx);
      const y = val(p.fy);
      if (![x, y].every(Number.isFinite) || x < item.x[0] || x > item.x[1] || y < item.y[0] || y > item.y[1]) continue;
      const px = r(this.sx(item, x));
      const py = r(this.sy(item, y));
      marks.push(svgEl('circle', { class: 'ch-plot-point', cx: px, cy: py, r: 7, style: `fill:${p.color}` }));
      if (p.label) marks.push(svgEl('text', { class: 'ch-plot-plabel', x: px + 12, y: py - 12 }, p.label));
    }
    item.marks.replaceChildren(...marks);
  },
};

/* ---- 60-zip.js ---- */
// PPTX(zip) 읽기: 브라우저 안에서만 푼다(외부 전송 없음). 압축 방식 0(저장)과 8(deflate)을 지원한다.
// 그림 번호 '12-2' = presentation.xml 순서로 12번째 슬라이드, 그 슬라이드 XML의 a:blip 가운데 2번째(문서 순서).
// extract_pptx.py도 같은 규칙을 쓴다. XML은 DOMParser('application/xml')로만 읽는다(HTML로 해석하지 않음).
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const Zip = {
  // ArrayBuffer → Map(이름 → { method, csize, size, offset, encrypted })
  entries(buf) {
    const v = new DataView(buf);
    const n = buf.byteLength;
    let eocd = -1;
    for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip 파일이 아니에요');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    if (p === 0xFFFFFFFF || count === 0xFFFF) throw new Error('너무 큰 파일(zip64)은 열 수 없어요');
    const dec = new TextDecoder();
    const out = new Map();
    for (let k = 0; k < count; k++) {
      if (p + 46 > n || v.getUint32(p, true) !== 0x02014b50) throw new Error('zip 목차가 깨졌어요');
      const flags = v.getUint16(p + 8, true);
      const nameLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const commentLen = v.getUint16(p + 32, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      out.set(name, {
        method: v.getUint16(p + 10, true), csize: v.getUint32(p + 20, true), size: v.getUint32(p + 24, true),
        offset: v.getUint32(p + 42, true), encrypted: !!(flags & 1),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  },

  // 항목 하나 → Uint8Array
  async read(buf, e) {
    if (!e) throw new Error('파일 안에 그 항목이 없어요');
    if (e.encrypted) throw new Error('암호가 걸린 파일은 열 수 없어요');
    const v = new DataView(buf);
    if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error('zip 항목이 깨졌어요');
    const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
    const data = new Uint8Array(buf, start, e.csize);
    if (e.method === 0) return data.slice();
    if (e.method !== 8) throw new Error(`지원하지 않는 압축 방식(${e.method})이에요`);
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  },

  async text(buf, e) { return new TextDecoder().decode(await this.read(buf, e)); },
};

const Pptx = {
  xml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('PPT 안의 XML을 읽지 못했어요');
    return doc;
  },

  // 'ppt/slides/slide1.xml' 기준 상대 경로 → zip 안의 경로
  resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = base.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  },

  async rels(buf, entries, path) {
    const relPath = path.replace(/([^/]+)$/, '_rels/$1.rels');
    const map = new Map();
    if (!entries.has(relPath)) return map;
    const doc = this.xml(await Zip.text(buf, entries.get(relPath)));
    for (const r of Array.from(doc.getElementsByTagNameNS(NS_REL, 'Relationship'))) {
      if (r.getAttribute('TargetMode') === 'External') continue;
      map.set(r.getAttribute('Id'), this.resolve(path, r.getAttribute('Target') || ''));
    }
    return map;
  },

  // ArrayBuffer → { slides: [{ n, path, images: [{ id: '12-2', path, ext }] }], entries }
  async open(buf) {
    const entries = Zip.entries(buf);
    const presPath = 'ppt/presentation.xml';
    if (!entries.has(presPath)) throw new Error('PPTX 파일이 아니에요(presentation.xml 없음)');
    const pres = this.xml(await Zip.text(buf, entries.get(presPath)));
    const presRels = await this.rels(buf, entries, presPath);
    const slides = [];
    const ids = Array.from(pres.getElementsByTagNameNS(NS_P, 'sldId'));
    for (const [i, el] of ids.entries()) {
      const path = presRels.get(el.getAttributeNS(NS_R, 'id'));
      const slide = { n: i + 1, path, images: [] };
      slides.push(slide);
      if (!path || !entries.has(path)) continue;
      const doc = this.xml(await Zip.text(buf, entries.get(path)));
      const rels = await this.rels(buf, entries, path);
      let k = 0;
      for (const blip of Array.from(doc.getElementsByTagNameNS(NS_A, 'blip'))) {
        const rid = blip.getAttributeNS(NS_R, 'embed');
        if (!rid) continue;
        k += 1;
        const media = rels.get(rid);
        slide.images.push({ id: `${slide.n}-${k}`, path: media, ext: media ? (media.split('.').pop() || '').toLowerCase() : '' });
      }
    }
    return { slides, entries, buf };
  },

  find(pptx, id) {
    const [s] = String(id).split('-');
    const slide = pptx.slides[Number(s) - 1];
    return slide ? slide.images.find((im) => im.id === id) || null : null;
  },
};

/* ---- 61-pptfill.js ---- */
// 그림 자리 채우기와 저장. 엔진이 시작하자마자 원본 HTML을 보관하고(Source), 저장할 때는 원본에 그림만 넣는다.
// <img data-ppt="12-2" alt="…">가 비어 있으면 회색 자리를 보여 준다. 원본 PPTX를 화면에 끌어다 놓거나 ⚙에서 열면 채운다.
// 손 모드에서 그림(자리)을 누르면 「그림 바꾸기」. ⚙에 「그림 넣어 저장」, 「오프라인용 저장」.
const IMG_MAX = 1600;
const IMG_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml' };

const Source = {
  html: '',
  capture() { this.html = `<!doctype html>\n${document.documentElement.outerHTML}`; },
};

function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const PptFill = {
  imgs: [],
  ph: new WeakMap(),
  pptx: null,
  cache: new Map(),
  busy: null,
  banner: null,
  zone: null,
  picker: null,
  dirty: false,

  init() {
    this.imgs = qsa('section.slide img[data-ppt]', Stage.deck);
    for (const img of this.imgs) this.prepare(img);
    this.zone = h('div', { class: 'ch-dropzone', 'aria-hidden': 'true', text: '원본 PPT를 여기에 놓으세요' });
    this.banner = h('div', { class: 'ch-banner', role: 'status', 'aria-live': 'polite', hidden: true });
    this.picker = h('div', { class: 'ch-panel ch-picker', role: 'dialog', 'aria-label': '그림 바꾸기' });
    this.picker.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    this.banner.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    document.body.append(this.zone, this.banner, this.picker);
    const files = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragover', (e) => { if (!files(e)) return; e.preventDefault(); this.zone.classList.add('is-on'); });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) this.zone.classList.remove('is-on'); });
    window.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      this.zone.classList.remove('is-on');
      const file = Array.from(e.dataTransfer.files).find((f) => /\.pptx$/i.test(f.name));
      if (!file) { this.notify('PPTX 파일만 끌어다 놓을 수 있어요.', true); return; }
      this.busy = this.openFile(file);
    });
    on('panels-close', () => this.closePicker());
    on('show', () => this.closePicker());
    on('key', (e) => { if (keyName(e) === 'escape') this.closePicker(); });
    window.addEventListener('beforeunload', (e) => {
      if (!this.dirty) return;
      e.preventDefault();
      e.returnValue = '';   // 채운 그림을 저장하지 않고 닫으려 할 때 브라우저가 묻는다
    });
    Settings.extras.push(() => this.panel());
  },

  // 그림 자리: 빈 그림은 숨기고 같은 자리에 회색 상자를 둔다.
  prepare(img) {
    const [s, k] = String(img.dataset.ppt).split('-');
    const ph = h('span', { class: 'ch-ppt-ph', role: 'img', 'aria-label': img.alt || '그림 자리', 'data-tap': '' },
      h('b', { text: '원본 PPT를 이 화면에 끌어다 놓으세요' }),
      h('small', { text: `PPT ${s}쪽 그림 ${k || '?'}${img.alt ? ` · ${img.alt}` : ''}` }));
    for (const dim of ['width', 'height']) {
      const v = img.getAttribute(dim) || img.style[dim];
      if (v) ph.style[dim] = /^\d+$/.test(v) ? `${v}px` : v;
    }
    img.after(ph);
    this.ph.set(img, ph);
    this.show(img);
    const pick = () => { if (Tools.current === 'hand') this.openPicker(img); };
    img.addEventListener('click', pick);
    ph.addEventListener('click', pick);
  },

  show(img, note, bad) {
    const ph = this.ph.get(img);
    const empty = !img.getAttribute('src');
    img.hidden = empty;
    ph.hidden = !empty;
    ph.classList.toggle('is-bad', !!bad);
    if (note) ph.firstChild.textContent = note;
  },

  async openFile(file) {
    try {
      this.notify('원본 PPT를 읽고 있어요…');
      this.pptx = await Pptx.open(await file.arrayBuffer());
      this.cache.clear();
      const r = await this.fillAll();
      const parts = [`그림 ${r.filled}개를 채웠어요.`];
      if (r.missing.length) parts.push(`PPT에 없는 번호 ${r.missing.length}개(${r.missing.slice(0, 3).join(', ')}).`);
      if (r.unsupported.length) parts.push(`열 수 없는 형식 ${r.unsupported.length}개.`);
      this.notify(parts.join(' '), r.missing.length + r.unsupported.length > 0, r.filled > 0);
      return r;
    } catch (err) {
      this.notify(`PPT를 열지 못했어요: ${err.message}`, true);
      return null;
    }
  },

  // 비어 있는 그림 자리만 채운다(이미 그림이 있는 자리는 그대로).
  async fillAll() {
    const r = { filled: 0, missing: [], unsupported: [] };
    for (const img of this.imgs) {
      if (img.getAttribute('src')) continue;
      const id = img.dataset.ppt;
      const media = this.pptx && Pptx.find(this.pptx, id);
      if (!media || !media.path) { r.missing.push(id); this.show(img, `PPT에 ${id} 그림이 없어요 · 손 모드에서 눌러 바꾸기`, true); continue; }
      const url = await this.dataUrl(media);
      if (!url) { r.unsupported.push(id); this.show(img, `브라우저가 열 수 없는 그림(${media.ext.toUpperCase()})이에요 · 눌러서 다른 그림 고르기`, true); continue; }
      this.set(img, url);
      r.filled += 1;
    }
    return r;
  },

  set(img, url) {
    img.setAttribute('src', url);
    this.show(img);
    this.dirty = true;
  },

  async dataUrl(media) {
    if (this.cache.has(media.path)) return this.cache.get(media.path);
    let url = null;
    const type = IMG_TYPES[media.ext];
    if (type) {
      try {
        const bytes = await Zip.read(this.pptx.buf, this.pptx.entries.get(media.path));
        url = await this.shrink(bytes, type);
      } catch (err) { url = null; }
    }
    this.cache.set(media.path, url);
    return url;
  },

  // 긴 변이 1600px을 넘으면 줄인다. 큰 불투명 PNG는 JPEG로, 투명이 있으면 PNG로 둔다. SVG는 그대로.
  async shrink(bytes, type) {
    if (type === 'image/svg+xml') return `data:${type};base64,${bytesToBase64(bytes)}`;
    const bmp = await createImageBitmap(new Blob([bytes], { type }));
    const scale = Math.min(1, IMG_MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && bytes.length <= 400 * 1024) { bmp.close(); return `data:${type};base64,${bytesToBase64(bytes)}`; }
    const canvas = h('canvas', { width: Math.max(1, Math.round(bmp.width * scale)), height: Math.max(1, Math.round(bmp.height * scale)) });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    let opaque = type === 'image/jpeg';
    if (!opaque) {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      opaque = true;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 255) { opaque = false; break; }
    }
    return opaque ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  },

  notify(text, bad, offerSave) {
    const b = this.banner;
    b.replaceChildren(h('span', { text }));
    if (offerSave) b.append(h('button', { type: 'button', class: 'is-main', text: '저장', onclick: () => this.save() }));
    b.append(h('button', { type: 'button', text: '닫기', onclick: () => { b.hidden = true; } }));
    b.classList.toggle('is-bad', !!bad);
    b.hidden = false;
  },

  // 「그림 바꾸기」: 그 슬라이드의 PPT 그림 가운데 고르거나 다른 그림 파일을 고른다.
  async openPicker(img) {
    const [s] = String(img.dataset.ppt).split('-');
    const slide = this.pptx && this.pptx.slides[Number(s) - 1];
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      const type = f.type || IMG_TYPES[(f.name.split('.').pop() || '').toLowerCase()] || 'image/png';
      try { this.set(img, await this.shrink(new Uint8Array(await f.arrayBuffer()), type)); } catch (err) { this.notify('그 그림 파일을 열지 못했어요.', true); }
      this.closePicker();
    });
    const pptFile = h('input', { type: 'file', accept: '.pptx', hidden: true });
    pptFile.addEventListener('change', async () => {
      if (!pptFile.files[0]) return;
      this.busy = this.openFile(pptFile.files[0]);
      await this.busy;
      this.openPicker(img);
    });
    const list = h('div', { class: 'ch-picker-list' });
    if (slide && slide.images.length) {
      for (const media of slide.images) {
        const url = await this.dataUrl(media);
        list.append(h('button', {
          type: 'button', class: 'ch-picker-item', 'aria-pressed': String(media.id === img.dataset.ppt), disabled: !url,
          onclick: () => { img.dataset.ppt = media.id; this.set(img, url); this.closePicker(); },
        }, url ? h('img', { src: url, alt: '' }) : h('span', { text: media.ext.toUpperCase() }), h('small', { text: media.id })));
      }
    }
    this.picker.replaceChildren(h('h2', { text: '그림 바꾸기' }),
      h('p', { text: slide ? `PPT ${s}쪽의 그림이에요. 맞는 그림을 고르세요.` : '원본 PPT를 열면 이 슬라이드의 그림을 고를 수 있어요.' }),
      list,
      h('div', { class: 'ch-picker-actions' },
        slide ? null : h('button', { type: 'button', text: '원본 PPT 열기', onclick: () => pptFile.click() }),
        h('button', { type: 'button', text: '다른 그림 파일 고르기', onclick: () => file.click() }),
        h('button', { type: 'button', text: '닫기', onclick: () => this.closePicker() })),
      file, pptFile);
    Panels.close();
    this.picker.classList.add('is-open');
  },

  closePicker() { if (this.picker) this.picker.classList.remove('is-open'); },

  // 원본 HTML에 지금 그림만 넣은 문서. 엔진이 덧붙인 툴바·무대 등은 들어가지 않는다.
  buildDoc() {
    const doc = new DOMParser().parseFromString(Source.html, 'text/html');
    qsa('section.slide img[data-ppt]', doc).forEach((el, i) => {
      const live = this.imgs[i];
      if (!live) return;
      if (live.getAttribute('src')) el.setAttribute('src', live.getAttribute('src'));
      el.setAttribute('data-ppt', live.dataset.ppt);
    });
    return doc;
  },

  serialize(doc) { return `<!doctype html>\n${doc.documentElement.outerHTML}`; },

  fileName(suffix) {
    let name = '';
    try { name = decodeURIComponent(location.pathname.split('/').pop() || ''); } catch (err) { name = ''; }
    if (!/\.html?$/i.test(name)) name = `${Session.deck}.html`;
    return suffix ? name.replace(/(\.html?)$/i, `${suffix}$1`) : name;
  },

  save() {
    saveText(this.fileName(), this.serialize(this.buildDoc()), 'text/html;charset=utf-8');
    this.dirty = false;
    this.notify('저장했어요. 내려받은 파일로 원래 파일을 바꾸면 다음부터 그림이 바로 보여요.');
  },

  // 오프라인용: 엔진 CSS·JS를 파일 안에 넣는다. 인터넷 주소(CDN)로 엔진을 불러온 경우에만 받을 수 있다.
  async offlineHtml() {
    const isEngine = (url, ext) => new RegExp(`class-html(\\.min)?\\.${ext}(\\?|#|$)`).test(url || '');
    const liveCss = qsa('link[rel~="stylesheet"]').find((l) => isEngine(l.getAttribute('href'), 'css'));
    const liveJs = qsa('script[src]').find((s) => isEngine(s.getAttribute('src'), 'js'));
    if (!liveCss || !liveJs) throw new Error('엔진 파일 주소를 찾지 못했어요');
    const get = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.text();
    };
    let css;
    let js;
    try { [css, js] = await Promise.all([get(liveCss.href), get(liveJs.src)]); } catch (err) {
      throw new Error('엔진 파일을 받지 못했어요. 인터넷 주소(CDN)로 엔진을 불러온 수업에서만 오프라인용 저장이 됩니다');
    }
    const doc = this.buildDoc();
    const link = qsa('link[rel~="stylesheet"]', doc).find((l) => isEngine(l.getAttribute('href'), 'css'));
    const script = qsa('script[src]', doc).find((s) => isEngine(s.getAttribute('src'), 'js'));
    const style = doc.createElement('style');
    style.textContent = css;
    link.replaceWith(style);
    const inline = doc.createElement('script');
    inline.textContent = js.replace(/<\/script/gi, '<\\/script');
    script.replaceWith(inline);
    return this.serialize(doc);
  },

  async saveOffline() {
    try {
      saveText(this.fileName('-오프라인'), await this.offlineHtml(), 'text/html;charset=utf-8');
      this.notify('오프라인용 파일을 저장했어요. 인터넷이 없어도 열립니다(글꼴은 맑은 고딕으로 바뀝니다).');
    } catch (err) { this.notify(err.message, true); }
  },

  // ⚙ 설정 창 아래쪽 '파일' 묶음
  panel() {
    const empty = this.imgs.filter((i) => !i.getAttribute('src')).length;
    const pptFile = h('input', { type: 'file', accept: '.pptx', hidden: true });
    pptFile.addEventListener('change', () => { if (pptFile.files[0]) this.busy = this.openFile(pptFile.files[0]); Toolbar.closePop(); });
    return h('div', { class: 'ch-set-file' }, h('h3', { text: '파일' }),
      this.imgs.length ? h('p', { class: 'ch-set-note', text: `그림 자리 ${this.imgs.length}개 · 빈 곳 ${empty}개` }) : null,
      this.imgs.length ? Toolbar.menuItem('원본 PPT에서 그림 채우기', () => pptFile.click()) : null,
      Toolbar.menuItem('그림 넣어 저장', () => { Toolbar.closePop(); this.save(); }),
      Toolbar.menuItem('오프라인용 저장', () => { Toolbar.closePop(); this.saveOffline(); }),
      pptFile);
  },
};

/* ---- 99-boot.js ---- */
// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Source.capture();   // 엔진이 DOM을 바꾸기 전의 원본(저장할 때 쓴다)
  Stage.init();
  Parts.init();   // Nav보다 먼저: 정답 상자 내용을 단계로 묶는다
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
  KeepWords.apply(Stage.deck);   // 목차 제목을 뽑은 뒤 어절을 감싼다
  await Store.init();
  await Session.init();
  Ink.init();      // Session.doc이 있어야 한다
  await Toolbar.init();
  Board.init();    // 툴바 자리(slots.board)에 버튼을 넣는다
  await Settings.init();
  Print.init();
  Audit.init();    // ?audit도 모든 준비가 끝난 다음 실행한다
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML.audit = () => Audit.run();
  ClassHTML._internal = { on, emit, Stage, Nav, Steps, Panels, InkGeom, InkModel, Store, Session, Tools, Ink, Toolbar, icon, Board, Settings, KeepWords, Print, Audit, Parts, Answer, Zoom, Expr, Stepper, MapReveal, Yearline, Sort, Quiz, Order, Calc, Plot, Zip, Pptx, Source, PptFill };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
