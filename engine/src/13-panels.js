// 목차, 단축키 도움말, 화면 가리기(검정·흰색), 전체 화면.
const Panels = {
  toc: null,
  help: null,
  shade: null,

  HELP: [
    ['→ · Space · PageDown', '다음 (단계 → 다음 장)'],
    ['← · PageUp', '이전'],
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

  markToc(i) { qsa('button', this.toc).forEach((b, k) => b.classList.toggle('is-current', k === i)); },

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
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); return; }
    const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  },

  onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 't') this.toggle(this.toc);
    else if (k === '?') this.toggle(this.help);
    else if (k === 'f') this.fullscreen();
    else if (k === 'b') this.shadeTo('black');
    else if (k === 'w') this.shadeTo('white');
    else if (k === 'escape') { this.close(); this.shade.dataset.mode = ''; }
  },
};
