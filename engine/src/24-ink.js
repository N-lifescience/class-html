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
    d.addEventListener('pointerup', (e) => this.up(e), true);
    d.addEventListener('pointercancel', (e) => this.up(e), true);
    d.addEventListener('click', (e) => {
      if (!this.suppressClick) return;
      this.suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    on('resize', () => this.resize());
    on('show', (slide) => { if (!Nav.override) this.setPage({ kind: 'slide', key: slide.dataset.key }); });
    on('session', () => this.redraw());
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
    this.ref = ref;
    this.gesture = null;
    this.redraw();
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
    if (this.gesture) {                                   // 두 번째 손가락·손바닥은 무시
      if (e.pointerId !== this.gesture.id) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    this.suppressClick = false;
    const tool = this.toolFor(e);
    if (!tool || !this.page) return;
    const target = e.target && e.target.closest ? e.target : null;
    if (target && target.closest(ALWAYS_LIVE)) return;   // 슬라이더·입력칸은 늘 조작
    const [x, y] = Stage.toStage(e.clientX, e.clientY);
    this.gesture = { id: e.pointerId, tool, x0: x, y0: y, started: false, stroke: null, removed: [] };
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
      const removed = InkModel.eraseAt(this.page, x, y, ERASER_R);
      if (removed.length) { g.removed.push(...removed); this.redraw(); }
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
    c.strokeStyle = 'rgba(31, 35, 40, .55)';
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.arc(x, y, ERASER_R, 0, Math.PI * 2);
    c.stroke();
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
    const p = this.page;
    if (!p || !InkModel.undo(Session.hist, p)) return false;
    this.redraw();
    Session.changed();
    return true;
  },

  clear() {
    const p = this.page;
    if (!p || !InkModel.clear(Session.hist, p)) return false;
    this.redraw();
    Session.changed();
    return true;
  },
};
