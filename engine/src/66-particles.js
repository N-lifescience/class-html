// 입자 상자(과학): 확산·삼투·기체 운동. 입자 종류마다 왼쪽·오른쪽 처음 개수, 막 통과 확률을 정한다.
// 작성 모양: <figure class="particles" data-membrane="0.5" data-labels="세포 밖|세포 안" data-height="300">
//   <i data-kind="물" data-left="40" data-right="10" data-pass="1" data-color="#5AA9E6" data-size="4"></i>
//   <i data-kind="설탕" data-left="20" data-right="0" data-pass="0" data-color="#C04F15" data-size="8"></i></figure>
// 값은 식이다. .calc 안에 있으면 그 변수를 쓰고, 값이 바뀌면 처음부터 다시 놓는다. 입자는 모두 300개까지.
const PARTICLE_MAX = 300;

const Particles = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.particles', Stage.deck).forEach((fig, n) => {
      const calc = Calc.of(fig);
      const errors = [];
      const c = (src, def, label) => {
        const r = Expr.compile(src == null || src === '' ? String(def) : src);
        if (!r.ok) { errors.push({ el: fig, msg: `${label}: ${r.error}` }); return () => def; }
        return r.fn;
      };
      const kinds = qsa(':scope > i[data-kind]', fig).map((el, k) => {
        el.hidden = true;
        return {
          name: el.dataset.kind, color: el.dataset.color || PLOT_COLORS[k % PLOT_COLORS.length], size: clamp(Number(el.dataset.size) || 6, 2, 16),
          left: c(el.dataset.left, 20, 'data-left'), right: c(el.dataset.right, 0, 'data-right'), pass: c(el.dataset.pass, 1, 'data-pass'),
        };
      });
      const canvas = h('canvas', { class: 'ch-particles-cv', 'aria-hidden': 'true' });
      const run = h('button', { type: 'button', class: 'ch-particles-run', text: '▶ 움직이기' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시' });
      const counts = h('p', { class: 'ch-particles-counts', 'aria-live': 'off' });
      const labels = String(fig.dataset.labels || '왼쪽|오른쪽').split('|');
      const item = {
        fig, calc, kinds, errors, canvas, run, reset, counts, labels, n,
        membrane: fig.dataset.membrane != null && fig.dataset.membrane !== '' ? clamp(Number(fig.dataset.membrane), 0.05, 0.95) : null,
        speed: c(fig.dataset.speed, 1, 'data-speed'), h: Math.round(Number(fig.dataset.height) || 280), w: 0,
        parts: [], running: false, raf: 0, last: 0, rnd: seededRandom(`${fig.closest('section.slide')?.dataset.key}#particles${n}`), sig: '',
      };
      fig.append(canvas, h('div', { class: 'ch-row' }, run, reset), counts);
      run.addEventListener('click', (e) => { this.toggle(item); e.currentTarget.blur(); });
      reset.addEventListener('click', (e) => { this.place(item); this.draw(item); e.currentTarget.blur(); });
      if (calc) calc.listeners.push(() => this.changed(item));
      this.list.push(item);
      this.layout(item);
      this.place(item);
      this.draw(item);
    });
    on('show', (slide) => {
      for (const item of this.list) {
        if (!slide.contains(item.fig)) { this.stop(item); continue; }
        this.layout(item);
        this.draw(item);
        if (!document.documentElement.classList.contains('ch-motion-off')) this.start(item);   // 움직임 끄기면 「움직이기」를 눌러야 움직인다
      }
    });
    on('hide', (slide) => { for (const item of this.list) if (slide.contains(item.fig)) this.stop(item); });
  },

  scope(item) { return item.calc ? item.calc.scope : {}; },
  val(fn, item) { try { return Number(fn(this.scope(item))); } catch (err) { return NaN; } },

  layout(item) {
    const slide = item.fig.closest('section.slide');
    const hidden = slide && getComputedStyle(slide).display === 'none';
    if (hidden) slide.classList.add('ch-measure');
    const w = Math.round(item.fig.clientWidth);
    if (hidden) slide.classList.remove('ch-measure');
    if (!w || w === item.w) return;
    const sx = item.w ? w / item.w : 1;
    for (const p of item.parts) p.x *= sx;
    item.w = w;
    const ratio = Math.max(1, (window.devicePixelRatio || 1) * Stage.scale);
    item.canvas.width = Math.round(w * ratio);
    item.canvas.height = Math.round(item.h * ratio);
    item.canvas.style.width = `${w}px`;
    item.canvas.style.height = `${item.h}px`;
    item.canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
  },

  // 입자를 처음 개수대로 양쪽에 고르게 흩어 놓는다.
  place(item) {
    const w = item.w || 560;
    const mx = item.membrane == null ? w : w * item.membrane;
    const parts = [];
    let total = 0;
    for (const [k, kind] of item.kinds.entries()) {
      for (const side of ['left', 'right']) {
        let count = Math.round(this.val(kind[side], item));
        if (!Number.isFinite(count) || count < 0) count = 0;
        if (item.membrane == null && side === 'right') count = 0;
        count = Math.min(count, PARTICLE_MAX - total);
        total += count;
        const [x0, x1] = side === 'left' ? [0, mx] : [mx, w];
        for (let i = 0; i < count; i++) {
          const a = item.rnd() * Math.PI * 2;
          parts.push({ k, x: x0 + kind.size + item.rnd() * Math.max(1, x1 - x0 - kind.size * 2), y: kind.size + item.rnd() * (item.h - kind.size * 2), vx: Math.cos(a), vy: Math.sin(a) });
        }
      }
    }
    item.parts = parts;
    item.sig = this.signature(item);
    this.count(item);
  },

  signature(item) { return item.kinds.map((k) => [k.left, k.right].map((f) => this.val(f, item)).join(',')).join(';'); },

  // 계산 상자 값이 바뀌면 개수가 달라졌을 때만 다시 놓는다(통과 확률·속도는 움직이는 중에 바로 반영).
  changed(item) {
    if (this.signature(item) !== item.sig) { this.place(item); this.draw(item); }
  },

  // dt초만큼 움직인다. 벽에서 튕기고, 막에 닿으면 통과 확률(pass)만큼 지나간다.
  step(item, dt) {
    const w = item.w || 560;
    const mx = item.membrane == null ? null : w * item.membrane;
    const v = 90 * clamp(this.val(item.speed, item) || 0, 0, 5);
    const pass = item.kinds.map((k) => clamp(this.val(k.pass, item) || 0, 0, 1));
    for (const p of item.parts) {
      const r = item.kinds[p.k].size;
      // 조금씩 방향이 흔들린다(브라운 운동)
      const a = Math.atan2(p.vy, p.vx) + (item.rnd() - 0.5) * 0.8;
      p.vx = Math.cos(a);
      p.vy = Math.sin(a);
      let nx = p.x + p.vx * v * dt;
      let ny = p.y + p.vy * v * dt;
      if (nx < r) { nx = r; p.vx = Math.abs(p.vx); }
      if (nx > w - r) { nx = w - r; p.vx = -Math.abs(p.vx); }
      if (ny < r) { ny = r; p.vy = Math.abs(p.vy); }
      if (ny > item.h - r) { ny = item.h - r; p.vy = -Math.abs(p.vy); }
      if (mx != null && (p.x - mx) * (nx - mx) < 0 && item.rnd() >= pass[p.k]) {
        nx = p.x < mx ? mx - r * 0.5 : mx + r * 0.5;   // 막에 막혀 되돌아간다
        p.vx = -p.vx;
      }
      p.x = nx;
      p.y = ny;
    }
  },

  count(item) {
    const w = item.w || 560;
    const mx = item.membrane == null ? null : w * item.membrane;
    item.tally = item.kinds.map((k, i) => {
      const mine = item.parts.filter((p) => p.k === i);
      const left = mx == null ? mine.length : mine.filter((p) => p.x < mx).length;
      return { left, right: mine.length - left };
    });
    item.counts.replaceChildren(...item.kinds.map((k, i) => h('span', { class: 'ch-particles-kind', style: `--c:${k.color}` },
      h('b', { text: k.name }), mx == null ? ` ${item.tally[i].left}개` : ` ${item.labels[0]} ${item.tally[i].left} · ${item.labels[1] || ''} ${item.tally[i].right}`)));
  },

  draw(item) {
    const ctx = item.canvas.getContext('2d');
    const w = item.w || 560;
    ctx.clearRect(0, 0, w, item.h);
    if (item.membrane != null) {
      const mx = w * item.membrane;
      ctx.save();
      ctx.strokeStyle = '#8F8F8F';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, item.h);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of item.parts) {
      const k = item.kinds[p.k];
      ctx.fillStyle = k.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, k.size, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(item) {
    if (item.running) return;
    item.running = true;
    item.run.textContent = '❚❚ 멈추기';
    item.last = performance.now();
    let tally = 0;
    const tick = (now) => {
      if (!item.running) return;
      const dt = Math.min(0.05, (now - item.last) / 1000);
      item.last = now;
      this.step(item, dt);
      this.draw(item);
      if ((tally += dt) > 0.25) { tally = 0; this.count(item); }
      item.raf = requestAnimationFrame(tick);
    };
    item.raf = requestAnimationFrame(tick);
  },

  stop(item) {
    item.running = false;
    cancelAnimationFrame(item.raf);
    item.run.textContent = '▶ 움직이기';
    this.count(item);
  },

  toggle(item) { if (item.running) this.stop(item); else this.start(item); },
};
