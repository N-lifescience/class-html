// 교실 도구: 뽑기(.picker), 모둠 점수판(.score), 체크리스트(ul.checklist), 그림 핫스팟(figure.hotspots).
// 상태는 그 화면 안에만 둔다(저장하지 않는다). 펜을 든 채로 톡 누르면 작동한다.

// 뽑기: <div class="picker" data-range="1-30"></div> 또는 data-items="가|나|다". 한 번 뽑힌 것은 모두 뽑을 때까지 다시 안 나온다.
const Picker = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('.picker', Stage.deck)) {
      let items = String(el.dataset.items || '').split('|').map((s) => s.trim()).filter(Boolean);
      if (!items.length) {
        const m = /^\s*(-?\d+)\s*-\s*(-?\d+)\s*$/.exec(el.dataset.range || '1-30');
        const [a, b] = m ? [Number(m[1]), Number(m[2])].sort((x, y) => x - y) : [1, 30];
        items = Array.from({ length: Math.min(500, b - a + 1) }, (_, i) => String(a + i));
      }
      const face = h('output', { class: 'ch-picker-face', text: '?' });
      const go = h('button', { type: 'button', class: 'ch-picker-go', text: '뽑기' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시' });
      const log = h('p', { class: 'ch-picker-log' });
      const p = { el, items, left: items.slice(), face, go, reset, log, drawn: [], rolling: 0 };
      el.replaceChildren(face, h('span', { class: 'ch-row' }, go, reset), log);
      go.addEventListener('click', (e) => { this.draw(p); e.currentTarget.blur(); });
      reset.addEventListener('click', (e) => { this.reset(p); e.currentTarget.blur(); });
      this.list.push(p);
    }
  },

  // 0.6초 동안 후보를 빠르게 바꿔 보이고(글자만 바뀐다) 하나를 고른다. 결과는 바로 p.drawn에 들어간다.
  draw(p) {
    if (!p.left.length) p.left = p.items.slice();
    const pick = p.left.splice(Math.floor(Math.random() * p.left.length), 1)[0];
    p.drawn.push(pick);
    clearInterval(p.rolling);
    const motion = !document.documentElement.classList.contains('ch-motion-off');
    let n = motion ? 8 : 0;
    const show = () => {
      if (n-- > 0) { p.face.textContent = p.items[Math.floor(Math.random() * p.items.length)]; return; }
      clearInterval(p.rolling);
      p.rolling = 0;
      p.face.textContent = pick;
      p.face.classList.remove('is-new');
      void p.face.offsetWidth;
      p.face.classList.add('is-new');
      p.log.textContent = `뽑은 순서: ${p.drawn.join(', ')}`;
    };
    if (motion) p.rolling = setInterval(show, 75);
    show();
    return pick;
  },

  reset(p) {
    clearInterval(p.rolling);
    p.left = p.items.slice();
    p.drawn = [];
    p.face.textContent = '?';
    p.log.textContent = '';
  },
};

// 모둠 점수판: <div class="score" data-teams="1모둠|2모둠|3모둠"></div> (숫자만 쓰면 1모둠~N모둠)
const Score = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('.score', Stage.deck)) {
      const raw = String(el.dataset.teams || '4');
      const names = /^\d+$/.test(raw.trim()) ? Array.from({ length: clamp(Number(raw), 1, 12) }, (_, i) => `${i + 1}모둠`)
        : raw.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 12);
      const s = { el, teams: names.map((name) => ({ name, n: 0 })), cards: [] };
      const grid = h('div', { class: 'ch-score-grid', style: `--cols:${Math.min(names.length, 6)}` });
      s.teams.forEach((t) => {
        const num = h('output', { class: 'ch-score-n', text: '0' });
        const card = h('div', { class: 'ch-score-card' }, h('b', { text: t.name }), num,
          h('span', { class: 'ch-score-btns' },
            h('button', { type: 'button', 'aria-label': `${t.name} 1점 빼기`, text: '−1', onclick: (e) => { this.add(s, t, -1); e.currentTarget.blur(); } }),
            h('button', { type: 'button', 'aria-label': `${t.name} 1점 더하기`, text: '+1', onclick: (e) => { this.add(s, t, 1); e.currentTarget.blur(); } })));
        t.num = num;
        t.card = card;
        grid.append(card);
      });
      el.replaceChildren(grid, h('button', { type: 'button', class: 'ch-reset', text: '모두 0점', onclick: (e) => { this.reset(s); e.currentTarget.blur(); } }));
      this.list.push(s);
      this.render(s);
    }
  },

  add(s, t, d) { t.n = Math.max(0, t.n + d); this.render(s); },
  reset(s) { for (const t of s.teams) t.n = 0; this.render(s); },

  render(s) {
    const top = Math.max(...s.teams.map((t) => t.n));
    for (const t of s.teams) {
      t.num.textContent = String(t.n);
      t.card.classList.toggle('is-top', top > 0 && t.n === top);
    }
  },
};

// 체크리스트: <ul class="checklist"><li>보안경</li>…</ul>. 누르면 ✓, 아래에 몇 개 했는지.
const Checklist = {
  init() {
    for (const ul of qsa('ul.checklist', Stage.deck)) {
      const items = qsa(':scope > li', ul);
      const count = h('p', { class: 'ch-check-count' });
      const render = () => {
        const done = items.filter((li) => li.getAttribute('aria-pressed') === 'true').length;
        count.textContent = `${done} / ${items.length}`;
        ul.classList.toggle('is-all', done === items.length);
      };
      for (const li of items) {
        li.setAttribute('role', 'button');
        li.setAttribute('aria-pressed', 'false');
        li.setAttribute('data-tap', '');
        li.tabIndex = 0;
        const flip = () => { li.setAttribute('aria-pressed', String(li.getAttribute('aria-pressed') !== 'true')); render(); };
        li.addEventListener('click', flip);
        li.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          e.stopPropagation();
          flip();
        });
      }
      ul.after(count);
      render();
    }
  },
};

// 그림 핫스팟: <figure class="hotspots"><img …><span class="hs" style="--x:30%; --y:40%">설명</span>…</figure>
// 번호 동그라미를 누르면 그 설명이 열린다(하나만). 다시 누르거나 그림 빈 곳을 누르면 닫힌다.
const Hotspots = {
  init() {
    for (const fig of qsa('figure.hotspots', Stage.deck)) {
      const spots = qsa(':scope > .hs', fig);
      spots.forEach((hs, i) => {
        const tip = h('span', { class: 'ch-hs-tip' }, ...Array.from(hs.childNodes));
        const dot = h('button', { type: 'button', class: 'ch-hs-dot', 'aria-expanded': 'false', 'aria-label': `설명 ${hs.dataset.label || i + 1}`, text: hs.dataset.label || String(i + 1) });
        hs.replaceChildren(dot, tip);
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = dot.getAttribute('aria-expanded') !== 'true';
          for (const other of spots) other.firstChild.setAttribute('aria-expanded', 'false');
          dot.setAttribute('aria-expanded', String(open));
          dot.blur();
        });
      });
      fig.addEventListener('click', () => { for (const s of spots) s.firstChild.setAttribute('aria-expanded', 'false'); });
    }
    on('show', () => { for (const d of qsa('.ch-hs-dot[aria-expanded="true"]', Stage.deck)) d.setAttribute('aria-expanded', 'false'); });
  },
};
