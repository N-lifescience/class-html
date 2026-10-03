// 순서 배열: 작성자는 정답 순서로 쓰고, 엔진이 섞어 내놓는다. 차례로 눌러 '내가 만든 순서'를 쌓고, 다 쌓으면 자리마다 채점한다.
// 작성 모양: <ol class="order"><li data-why="이유">첫 사건</li><li>둘째 사건</li>…</ol>
const Order = {
  list: [],

  init() {
    this.list = [];
    qsa('ol.order', Stage.deck).forEach((ol, n) => {
      const items = qsa(':scope > li', ol).map((li, i) => ({ li, i }));
      if (items.length < 2) return;
      const slide = ol.closest('section.slide');
      let mixed = shuffled(items, `${slide ? slide.dataset.key : ''}#order${n}`);
      if (mixed.every((x, k) => x.i === k)) mixed = mixed.slice(1).concat(mixed[0]);   // 처음부터 정답이면 한 칸 돌린다
      const wrap = h('div', { class: 'ch-order' });
      ol.before(wrap);
      const bank = h('div', { class: 'ch-order-bank' });
      const slots = h('ol', { class: 'ch-order-slots' });
      const fb = h('p', { class: 'ch-fb', 'aria-live': 'polite' });
      const item = { ol, wrap, items, mixed, bank, slots, fb, seq: [], slide, solved: false };
      for (const x of mixed) {
        x.btn = h('button', { type: 'button', class: 'ch-order-item' }, ...Array.from(x.li.childNodes).map((c) => c.cloneNode(true)));
        x.btn.addEventListener('click', (e) => { this.push(item, x); e.currentTarget.blur(); });
        bank.append(x.btn);
      }
      const undo = h('button', { type: 'button', class: 'ch-reset', text: '한 칸 되돌리기', onclick: (e) => { this.pop(item); e.currentTarget.blur(); } });
      const reset = h('button', { type: 'button', class: 'ch-reset', text: '다시', onclick: (e) => { this.reset(item); e.currentTarget.blur(); } });
      wrap.append(bank, h('div', { class: 'ch-order-out' }, h('h3', { text: '내가 만든 순서' }), slots, h('div', { class: 'ch-row' }, undo, reset)), fb);
      wrap.append(ol);
      this.reset(item);
      this.list.push(item);
    });
    // 점검: 다 쌓아 채점한 상태(칸마다 이유)로 재고 되돌린다
    on('audit-expand', () => {
      for (const item of this.list) {
        item.auditSnap = { seq: item.seq.slice(), solved: item.solved };
        item.solved = true;   // 점검 중에는 뒤 단계를 열지 않는다
        item.seq = item.items.slice();
        this.render(item);
      }
    });
    on('audit-restore', () => {
      for (const item of this.list) {
        if (!item.auditSnap) continue;
        item.seq = item.auditSnap.seq;
        item.solved = item.auditSnap.solved;
        this.render(item);
        item.auditSnap = null;
      }
    });
  },

  render(item) {
    const n = item.items.length;
    item.slots.replaceChildren(...Array.from({ length: n }, (_, k) => {
      const x = item.seq[k];
      return x ? h('li', { class: 'is-filled' }, h('span', null, ...Array.from(x.li.childNodes).map((c) => c.cloneNode(true))))
        : h('li', { class: 'is-empty', 'aria-label': '빈칸' });
    }));
    for (const x of item.items) x.btn.disabled = item.seq.includes(x);
    if (item.seq.length === n) this.grade(item);
    else { item.wrap.classList.remove('is-done'); item.fb.textContent = ''; item.fb.className = 'ch-fb'; }
  },

  push(item, x) {
    if (item.seq.includes(x) || item.seq.length >= item.items.length) return;
    item.seq.push(x);
    this.render(item);
  },

  pop(item) { item.seq.pop(); this.render(item); },
  reset(item) { item.seq = []; this.render(item); },

  grade(item) {
    let right = 0;
    Array.from(item.slots.children).forEach((li, k) => {
      const ok = item.seq[k].i === k;
      li.classList.add(ok ? 'is-right' : 'is-wrong');
      if (ok) {
        right += 1;
        if (item.seq[k].li.dataset.why) li.append(h('small', { class: 'ch-order-why', text: item.seq[k].li.dataset.why }));
      }
    });
    const all = right === item.items.length;
    item.wrap.classList.toggle('is-done', true);   // 다 쌓으면 섞인 항목 칸을 접고 결과를 넓게
    item.fb.textContent = all ? '맞다. 순서가 모두 맞다.' : `${item.items.length}개 가운데 ${right}개가 제자리다. 빨간 칸부터 다시 생각해 보자.`;
    item.fb.className = `ch-fb ${all ? 'is-ok' : 'is-bad'}`;
    if (all && !item.solved) {
      item.solved = true;
      const next = item.slide && qsa('.step', item.slide).find((s) => item.wrap.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING && !item.wrap.contains(s));
      if (next) setTimeout(() => Nav.revealTo(next), 600);
    }
  },
};
