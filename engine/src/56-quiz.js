// 즉시 확인 문제. 하나 고르기: 누르면 바로 맞음·틀림과 그 보기의 이유. 여러 개 고르기(data-multi): 고른 뒤 「확인」.
// 작성 모양: <div class="quiz"><p>물음</p><button class="opt" data-why="…">보기</button><button class="opt" data-ok data-why="…">보기</button></div>
// 번호(①②…)는 엔진이 붙인다(data-num="off"로 끔). data-cols="2"면 보기를 두 줄로 놓는다.
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';

const Quiz = {
  list: [],

  init() {
    this.list = [];
    for (const box of qsa('.quiz', Stage.deck)) {
      const opts = qsa(':scope .opt', box);
      if (!opts.length) continue;
      const slide = box.closest('section.slide');
      const multi = box.hasAttribute('data-multi');
      // 바로 아래 보기들을 한 상자에 모아 줄을 맞춘다
      const direct = opts.filter((o) => o.parentElement === box);
      if (direct.length) {
        const wrap = h('div', { class: 'ch-opts', style: `--cols:${clamp(Number(box.dataset.cols) || 1, 1, 4)}` });
        direct[0].before(wrap);
        wrap.append(...direct);
      }
      opts.forEach((o, i) => {
        if (o.tagName !== 'BUTTON') { o.setAttribute('role', 'button'); o.setAttribute('data-tap', ''); o.tabIndex = 0; }
        else o.type = 'button';
        if (box.dataset.num !== 'off') o.prepend(h('i', { class: 'ch-opt-n', 'aria-hidden': 'true', text: CIRCLED[i] || String(i + 1) }));
        if (multi) o.setAttribute('aria-pressed', 'false');
      });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { box, opts, multi, fb, slide, solved: false };
      if (multi) {
        const check = h('button', { type: 'button', class: 'ch-check-btn', text: '확인', onclick: (e) => { this.check(item); e.currentTarget.blur(); } });
        box.append(h('div', { class: 'ch-row' }, check, fb));
        item.check = check;
      } else box.append(fb);
      for (const o of opts) {
        o.addEventListener('click', () => (multi ? this.toggle(item, o) : this.pick(item, o)));
        if (o.tagName !== 'BUTTON') {
          o.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            o.click();
          });
        }
      }
      this.list.push(item);
    }
    // 점검: 가장 긴 이유 줄, 여러 개 고르기는 모든 보기의 이유까지 보인 상태로 잰다
    on('audit-expand', () => {
      for (const item of this.list) {
        item.fbSnap = [item.fb.textContent, item.fb.className];
        const texts = item.opts.map((o) => o.dataset.why || '').concat(item.box.dataset.why || '', item.multi ? `${item.opts.length}개 가운데 ${Math.max(0, item.opts.length - 1)}개를 맞게 판단했다. 점선은 골라야 하는데 고르지 않은 것이다.` : '');
        item.fb.textContent = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
        if (item.multi) for (const o of item.opts) if (!o.querySelector(':scope > .ch-opt-why')) { this.why(o, true); o.dataset.auditWhy = '1'; }
      }
    });
    on('audit-restore', () => {
      for (const item of this.list) {
        if (item.fbSnap) [item.fb.textContent, item.fb.className] = item.fbSnap;
        for (const o of item.opts) if (o.dataset.auditWhy) { this.why(o, false); delete o.dataset.auditWhy; }
      }
    });
  },

  pick(item, o) {
    const ok = o.hasAttribute('data-ok');
    o.classList.add(ok ? 'is-right' : 'is-wrong');
    item.fb.textContent = o.dataset.why || (ok ? '맞다.' : '다시 생각해 보자.');
    item.fb.className = `ch-fb ${ok ? 'is-ok' : 'is-bad'}`;
    if (!ok) shake(o);
    else this.solve(item);
    if (o.tagName === 'BUTTON') o.blur();
  },

  toggle(item, o) {
    for (const x of item.opts) { x.classList.remove('is-right', 'is-wrong', 'is-miss'); this.why(x, false); }
    const on = o.getAttribute('aria-pressed') !== 'true';
    o.setAttribute('aria-pressed', String(on));
    o.classList.toggle('is-pick', on);
    item.fb.textContent = '';
    item.fb.className = 'ch-fb';
    if (o.tagName === 'BUTTON') o.blur();
  },

  // 여러 개 고르기에서 잘못 고른 것·놓친 것 아래에 그 보기의 이유(data-why)를 보인다
  why(o, show) {
    let w = o.querySelector(':scope > .ch-opt-why');
    if (!show || !o.dataset.why) { if (w) w.remove(); return; }
    if (!w) { w = h('small', { class: 'ch-opt-why' }); o.append(w); }
    w.textContent = o.dataset.why;
  },

  check(item) {
    let right = 0;
    for (const o of item.opts) {
      const ok = o.hasAttribute('data-ok');
      const pick = o.classList.contains('is-pick');
      o.classList.toggle('is-right', pick && ok);
      o.classList.toggle('is-wrong', pick && !ok);
      o.classList.toggle('is-miss', !pick && ok);
      this.why(o, pick !== ok);
      if (pick === ok) right += 1;
    }
    const all = right === item.opts.length;
    item.fb.textContent = all ? (item.box.dataset.why || '맞다. 모두 바르게 골랐다.')
      : `${item.opts.length}개 가운데 ${right}개를 맞게 판단했다. 점선은 골라야 하는데 고르지 않은 것이다.`;
    item.fb.className = `ch-fb ${all ? 'is-ok' : 'is-bad'}`;
    if (all) this.solve(item);
  },

  // 처음 맞혔을 때 같은 장에서 문제 뒤의 첫 단계를 연다(조금 뒤에).
  solve(item) {
    if (item.solved) return;
    item.solved = true;
    const next = item.slide && qsa('.step', item.slide).find((s) => item.box.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.box.contains(s));
    if (next) setTimeout(() => Nav.revealTo(next), 600);
  },
};
