// 모션 어휘(설계서 5.5): <h2 data-anim="fade-up">, <ul data-stagger><li data-anim="pop">…, <b data-anim="count">86</b>
// 슬라이드가 보일 때마다 다시 재생한다. ⚙ 「움직임 끄기」면 재생하지 않고 끝 상태로 둔다.
// fade-up·fade·pop·wipe·type·highlight는 transform·opacity만, draw는 SVG 선 그리기(stroke-dashoffset), count는 숫자 세어 올리기.
const ANIM_KINDS = ['fade-up', 'fade', 'pop', 'wipe', 'draw', 'count', 'highlight', 'type'];
const ANIM_STAGGER = 0.06;

const Anim = {
  els: [],

  init() {
    this.els = qsa('[data-anim]', Stage.deck).filter((el) => ANIM_KINDS.includes(el.dataset.anim));
    for (const box of qsa('[data-stagger]', Stage.deck)) {
      const step = Number(box.dataset.stagger) || ANIM_STAGGER;
      qsa('[data-anim]', box).forEach((el, i) => { if (!el.dataset.delay) el.style.setProperty('--ch-delay', `${(i * step).toFixed(2)}s`); });
    }
    for (const el of this.els) {
      if (el.dataset.delay) el.style.setProperty('--ch-delay', `${Number(el.dataset.delay) || 0}s`);
      if (el.dataset.anim === 'draw') {
        // 선의 길이를 1로 맞춰 길이와 상관없이 같은 시간에 그린다
        for (const p of [el, ...qsa('path, line, polyline, polygon, circle, ellipse, rect', el)]) if (p.matches('path, line, polyline, polygon, circle, ellipse, rect')) p.setAttribute('pathLength', '1');
      }
      if (el.dataset.anim === 'count') {
        const m = /^(\D*?)(-?[\d,]*\.?\d+)(.*)$/s.exec(el.textContent.replace(/⁠/g, '').trim());
        if (m) el.chCount = { pre: m[1], to: Number(m[2].replace(/,/g, '')), digits: (m[2].split('.')[1] || '').length, comma: m[2].includes(','), post: m[3] };
      }
    }
    on('show', (slide) => this.play(slide));
    this.play(Stage.slides[Nav.state.slide]);
  },

  off() { return document.documentElement.classList.contains('ch-motion-off'); },

  play(slide) {
    if (!slide) return;
    const list = this.els.filter((el) => slide.contains(el));
    for (const el of list) el.classList.remove('ch-anim-on');
    if (this.off()) { for (const el of list) if (el.chCount) this.setCount(el, 1); return; }
    void slide.offsetWidth;   // 같은 장을 다시 보여 줄 때도 처음부터
    for (const el of list) {
      el.classList.add('ch-anim-on');
      if (el.chCount) this.count(el);
    }
  },

  setCount(el, f) {
    const c = el.chCount;
    let v = (c.to * f).toFixed(c.digits);
    if (c.comma) v = Number(v).toLocaleString('ko-KR', { minimumFractionDigits: c.digits, maximumFractionDigits: c.digits });
    el.textContent = `${c.pre}${v}${c.post}`;
  },

  // 0.8초 동안 이즈 아웃으로 세어 올린다(글자만 바뀐다).
  count(el) {
    cancelAnimationFrame(el.chRaf);
    const delay = parseFloat(getComputedStyle(el).getPropertyValue('--ch-delay')) || 0;
    const t0 = performance.now() + delay * 1000;
    const tick = (now) => {
      if (this.off()) { this.setCount(el, 1); return; }
      const f = clamp((now - t0) / 800, 0, 1);
      this.setCount(el, 1 - (1 - f) ** 3);
      if (f < 1) el.chRaf = requestAnimationFrame(tick);
    };
    this.setCount(el, 0);
    el.chRaf = requestAnimationFrame(tick);
  },
};
