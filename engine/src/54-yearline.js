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
  copy(li) { return Array.from(li.childNodes).map((n) => bare(n.cloneNode(true))); },

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
