// 공통 부품의 시작점과 정답 상자·그림 확대. 부품은 Nav가 단계를 모으기 전에 만든다(99-boot).
const Parts = {
  init() {
    Answer.init();
    Zoom.init();
    Stepper.init();
    MapReveal.init();
    Yearline.init();
    Stepper.sort();   // 모든 단계 막대를 만든 뒤 문서 순서로 정렬하고 0단계로 둔다
  },
};

// 정답 상자: <div class="answer">…</div>. 안에 .step이 없으면 내용 전체를 한 단계로 묶고 가운데 ✓ 단추를 단다.
const Answer = {
  init() {
    for (const box of qsa('.answer', Stage.deck)) {
      if (!box.querySelector('.step')) {
        const wrap = h('div', { class: 'step' });
        wrap.append(...box.childNodes);
        box.append(wrap);
      }
      box.append(h('button', { type: 'button', class: 'ch-check', 'aria-label': '정답 보기',
        onclick: (e) => { this.reveal(box); e.currentTarget.blur(); } }, icon('check')));
    }
  },

  // 상자 안 첫 단계까지 연다. 다른 장의 상자는 무시한다.
  reveal(box) { Nav.revealTo(box.querySelector('.step')); },
};

// 그림 확대: figure.fig 안 그림. 확대 단추나 손 모드에서 그림을 누르면 크게 본다.
const Zoom = {
  el: null,

  init() {
    this.el = h('div', { class: 'ch-zoom', role: 'dialog', 'aria-label': '그림 크게 보기',
      onclick: () => this.close() }, h('img', { alt: '' }), h('p'));
    document.body.append(this.el);
    for (const fig of qsa('figure.fig', Stage.deck)) {
      const img = fig.querySelector('img');
      if (!img) continue;
      const open = () => this.open(img, fig.querySelector('figcaption'));
      img.addEventListener('click', () => { if (Tools.current === 'hand') open(); });
      fig.append(h('button', { type: 'button', class: 'ch-zoom-btn', 'aria-label': '그림 크게 보기',
        onclick: (e) => { open(); e.currentTarget.blur(); } }, icon('zoom')));
    }
    on('panels-close', () => this.close());
    on('show', () => this.close());
    on('key', (e) => { if (keyName(e) === 'escape') this.close(); });
  },

  get isOpen() { return !!this.el && this.el.classList.contains('is-open'); },

  open(img, caption) {
    if (!img.getAttribute('src')) return;   // 비어 있는 그림 자리
    const [big, text] = this.el.children;
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    text.textContent = caption ? caption.textContent.replace(/⁠/g, '').trim() : img.alt;
    this.el.classList.add('is-open');
  },

  close() { if (this.el) this.el.classList.remove('is-open'); },
};
