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
