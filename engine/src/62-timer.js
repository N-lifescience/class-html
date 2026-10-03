// 타이머: 활동 시간을 잰다. <div class="timer" data-sec="300" data-label="모둠 활동"></div>
// 「시작」·「멈춤」·「다시」 단추, 끝나면 '끝'과 함께 세 번 깜빡인다(1초에 세 번 넘게 번쩍이지 않는다).
const Timer = {
  list: [],

  init() {
    this.list = [];
    for (const el of qsa('.timer', Stage.deck)) {
      const total = clamp(Math.round(Number(el.dataset.sec) || 60), 1, 24 * 3600);
      const face = h('output', { class: 'ch-timer-face', 'aria-live': 'off' });
      const run = h('button', { type: 'button', class: 'ch-timer-run' });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시' });
      const t = { el, total, left: total, face, run, reset, timer: 0, end: 0 };
      el.replaceChildren(
        el.dataset.label ? h('span', { class: 'ch-timer-label', text: el.dataset.label }) : null,
        face, h('span', { class: 'ch-timer-btns' }, run, reset));
      run.addEventListener('click', (e) => { this.toggle(t); e.currentTarget.blur(); });
      reset.addEventListener('click', (e) => { this.reset(t); e.currentTarget.blur(); });
      this.list.push(t);
      this.render(t);
    }
  },

  fmt(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  },

  render(t) {
    t.face.textContent = t.left <= 0 ? '끝' : this.fmt(t.left);
    t.run.textContent = t.timer ? '멈춤' : t.left < t.total && t.left > 0 ? '이어서' : '시작';
    t.el.classList.toggle('is-running', !!t.timer);
    t.el.classList.toggle('is-done', t.left <= 0);
  },

  toggle(t) {
    if (t.timer) { this.pause(t); return; }
    if (t.left <= 0) t.left = t.total;
    t.end = performance.now() + t.left * 1000;
    t.timer = setInterval(() => this.tick(t), 250);
    this.render(t);
  },

  tick(t) {
    t.left = (t.end - performance.now()) / 1000;
    if (t.left <= 0) {
      t.left = 0;
      clearInterval(t.timer);
      t.timer = 0;
      t.face.setAttribute('aria-live', 'assertive');
    }
    this.render(t);
  },

  pause(t) {
    clearInterval(t.timer);
    t.timer = 0;
    t.left = Math.max(0, (t.end - performance.now()) / 1000);
    this.render(t);
  },

  reset(t) {
    clearInterval(t.timer);
    t.timer = 0;
    t.left = t.total;
    t.face.setAttribute('aria-live', 'off');
    this.render(t);
  },
};
