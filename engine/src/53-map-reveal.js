// 그림 지도 단계 공개: 교과서 지도 그림 위에 근사 다각형을 겹쳐, 아직 아닌 땅을 회색으로 가렸다가 한 칸씩 연다.
// 작성 모양: <figure class="map-reveal" data-stops="시작|…"><img …><svg viewBox="…">
//             <polygon data-from="1" points="…"/> <polygon data-lost="2" points="…"/></svg><figcaption>…</figcaption></figure>
const MapReveal = {
  list: [],

  init() {
    this.list = [];
    qsa('figure.map-reveal', Stage.deck).forEach((fig, n) => {
      // 지도와 막대를 한 덩어리로 묶어 바깥 칸 배치(grid 등)에서 함께 움직이게 한다
      const holder = h('div', { class: 'ch-map-holder' });
      fig.before(holder);
      holder.append(fig);
      const img = fig.querySelector(':scope > img');
      const svg = fig.querySelector(':scope > svg');
      // 그림과 다각형만 상자로 묶어 그림 설명(figcaption)과 겹치지 않게 한다. 상자가 0단계 가림막이 된다.
      const box = h('div', { class: 'ch-map-box veil' });
      fig.insertBefore(box, img || svg || fig.firstChild);
      if (img) box.append(img);
      if (svg) {
        box.append(svg);
        if (!svg.hasAttribute('preserveAspectRatio')) svg.setAttribute('preserveAspectRatio', 'none');
      }
      if (!fig.querySelector('.approx, .ch-approx')) {
        box.append(h('span', { class: 'ch-approx', text: fig.dataset.approx || '근사 · 회색은 아직 열리지 않은 곳' }));
      }
      const masks = [];
      const lost = [];
      if (svg) {
        const hatch = `ch-hatch-${n + 1}`;
        const defs = document.createElementNS(SVG_NS, 'defs');
        const pat = document.createElementNS(SVG_NS, 'pattern');
        for (const [k, v] of Object.entries({ id: hatch, width: 22, height: 22, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' })) pat.setAttribute(k, v);
        for (const [w, fill, op] of [[22, '#fff', '.55'], [9, '#C8352B', '.55']]) {
          const r = document.createElementNS(SVG_NS, 'rect');
          for (const [k, v] of Object.entries({ width: w, height: 22, fill, 'fill-opacity': op })) r.setAttribute(k, v);
          pat.append(r);
        }
        defs.append(pat);
        svg.prepend(defs);
        for (const shape of qsa('[data-from]', svg)) {
          shape.classList.add('ch-m');
          const ring = bare(shape.cloneNode(false));
          ring.removeAttribute('data-from');
          ring.removeAttribute('id');   // 복제본이 같은 id를 갖지 않게
          ring.setAttribute('class', 'ch-o');
          svg.append(ring);   // 테두리는 가림 다각형들보다 위에 그린다
          masks.push({ shape, ring, from: Number(shape.dataset.from) });
        }
        for (const shape of qsa('[data-lost]', svg)) {
          shape.classList.add('ch-lost');
          shape.setAttribute('fill', `url(#${hatch})`);
          lost.push({ shape, at: Number(shape.dataset.lost) });
        }
      }
      const item = { fig, masks, lost, st: null };
      item.st = Stepper.create(fig, { ui: 'range', mount: fig, onChange: (pos) => this.render(item, pos) });
      this.list.push(item);
    });
  },

  render(item, pos) {
    for (const { shape, ring, from } of item.masks) {
      shape.classList.toggle('is-open', from <= pos);
      ring.classList.remove('is-new');
      if (from === pos) {
        ring.getBoundingClientRect();   // 같은 칸을 다시 열면 깜빡임을 처음부터
        ring.classList.add('is-new');
      }
    }
    for (const { shape, at } of item.lost) shape.classList.toggle('is-on', at <= pos);
  },
};
