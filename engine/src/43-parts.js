// 공통 부품의 동작: 정답 상자(✓ 단추로 공개), 그림 확대.
// 모양은 css/70-parts.css. Nav가 단계를 모으기 전에 실행한다.
const Parts = {
  zoom: null,

  init() {
    // 정답 상자: 안에 .step이 없으면 내용 전체를 한 단계로 묶는다.
    for (const box of qsa('.answer', Stage.deck)) {
      if (!box.querySelector('.step')) {
        const wrap = h('div', { class: 'step' });
        wrap.append(...box.childNodes);
        box.append(wrap);
      }
      box.append(h('button', { type: 'button', class: 'ch-check', 'aria-label': '정답 보기',
        onclick: () => this.reveal(box) }, icon('check')));
    }
    this.zoom = h('div', { class: 'ch-zoom', role: 'dialog', 'aria-label': '그림 크게 보기',
      onclick: () => this.close() }, h('img', { alt: '' }), h('p'));
    document.body.append(this.zoom);
    for (const fig of qsa('figure.fig', Stage.deck)) {
      const img = fig.querySelector('img');
      if (!img) continue;
      const open = () => this.open(img, fig.querySelector('figcaption'));
      img.addEventListener('click', open);   // 손 모드에서 그림을 눌러도 열린다
      fig.append(h('button', { type: 'button', class: 'ch-zoom-btn', 'aria-label': '그림 크게 보기', onclick: open }, icon('zoom')));
    }
    on('panels-close', () => this.close());
    on('show', () => this.close());
  },

  // 상자 안 첫 단계까지 연다. 다른 장의 상자는 무시한다.
  reveal(box) {
    const i = Stage.slides.indexOf(box.closest('.slide'));
    if (i !== Nav.state.slide) return;
    const gi = Nav.groups[i].findIndex((g) => g.some((el) => box.contains(el)));
    if (gi >= 0 && Nav.state.shown <= gi) Nav.set({ slide: i, shown: gi + 1 });
  },

  open(img, caption) {
    const [big, text] = this.zoom.children;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    text.textContent = caption ? caption.textContent.replace(/⁠/g, '').trim() : '';
    this.zoom.classList.add('is-open');
  },

  close() { if (this.zoom) this.zoom.classList.remove('is-open'); },
};
