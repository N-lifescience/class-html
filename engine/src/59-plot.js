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
