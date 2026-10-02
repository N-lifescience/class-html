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

/* ---- 99-boot.js ---- */
// 시작 순서. 엔진이 두 번 포함돼도 한 번만 실행한다.
let readyResolve;
ClassHTML.ready = new Promise((resolve) => { readyResolve = resolve; });

async function start() {
  Stage.init();
  Panels.init();   // Nav보다 먼저: 첫 show 이벤트로 목차 현재 위치를 표시
  Nav.init();
}

function boot() {
  if (window.ClassHTML && window.ClassHTML !== ClassHTML) return;
  window.ClassHTML = ClassHTML;
  ClassHTML.go = (n) => Nav.go(n);
  ClassHTML.next = () => Nav.next();
  ClassHTML.prev = () => Nav.prev();
  ClassHTML._internal = { on, emit, Stage, Nav, Steps, Panels };
  start().then(() => readyResolve(ClassHTML), (err) => {
    console.error('[class-html]', err);
    readyResolve(ClassHTML);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
