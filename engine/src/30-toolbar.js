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
    const size = collapsed ? '0px' : '76px';
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
