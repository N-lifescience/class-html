// D 또는 ?audit로 열며, ClassHTML.audit()은 화면 상태를 보존하고 보고서만 반환한다.
const Audit = {
  panel: null,

  init() {
    this.panel = h('div', { class: 'ch-panel ch-audit', role: 'dialog', 'aria-label': '자동 점검' });
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
    });
    document.body.append(this.panel);
    on('key', (e) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && keyName(e) === 'd') this.toggle();
    });
    on('panels-close', () => this.close());
    if (new URLSearchParams(location.search).has('audit')) this.toggle();
  },

  describe(el) {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    const text = (el.textContent || '').replace(/\u2060/g, '').trim().slice(0, 14);
    return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}>${text ? ` 「${text}」` : ''}`;
  },

  run() {
    const errors = [];
    const warnings = [];
    const err = (slide, code, msg) => errors.push({ level: 'error', slide, code, msg });
    const warn = (slide, code, msg) => warnings.push({ level: 'warn', slide, code, msg });
    const ids = new Map();
    for (const el of qsa('[id]')) ids.set(el.id, (ids.get(el.id) || 0) + 1);
    for (const [id, count] of ids) if (count > 1) err(null, 'dup-id', `id "${id}"가 ${count}번 쓰였어요`);

    // Nav.set()으로 점검하면 수업의 onShow/onHide 훅과 판서 입력도 바뀐다.
    // DOM의 표시 상태만 잠깐 바꾸고, 예외가 나도 원래 클래스 상태를 복구한다.
    const snapshots = Stage.slides.map((slide) => ({
      slide, active: slide.classList.contains('is-active'),
      steps: qsa('.step', slide).map((el) => ({ el, shown: el.classList.contains('is-shown') })),
    }));
    const root = document.documentElement;
    const wasAuditing = root.classList.contains('ch-auditing');
    root.classList.add('ch-auditing');
    try {
      Stage.slides.forEach((slide, i) => {
        Stage.slides.forEach((other) => other.classList.toggle('is-active', other === slide));
        qsa('.step', slide).forEach((el) => el.classList.add('is-shown'));
        const box = slide.getBoundingClientRect();
        const scale = box.width / STAGE_W;
        const reported = [];
        const textBlocks = new Map();
        // 허용 영역은 요소 검사에서도 제외한다. 전체 scroll 값에는 그 영역도 포함된다.
        if (!slide.closest('[data-allow-overflow]') && !slide.querySelector('[data-allow-overflow]')
          && (slide.scrollHeight > slide.clientHeight + 1 || slide.scrollWidth > slide.clientWidth + 1)) {
          err(i, 'slide-overflow', '내용이 슬라이드보다 커요 (장을 나누세요)');
        }
        for (const el of qsa('*', slide)) {
          const allowOverflow = !!el.closest('[data-allow-overflow]');
          // KaTeX의 스크린리더용 MathML 복제는 의도적으로 1px 안에 숨긴다.
          if (el.closest('.katex-mathml')) continue;
          if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
          // 크기가 0인 빈 그림 자리도 경고한다.
          if (el.matches('img[data-ppt]') && !el.getAttribute('src')) warn(i, 'empty-image', `빈 그림 자리: 원본 PPT ${el.dataset.ppt}`);
          if (el.matches('img:not([alt])')) warn(i, 'no-alt', `${this.describe(el)}에 alt 설명이 없어요`);
          if (el.matches('.katex-error')) err(i, 'math-error', `수식 오류: ${this.describe(el)}`);
          if (el.matches('.katex') && el.getClientRects().length > 1) err(i, 'math-wrap', `수식이 두 줄로 갈렸어요: ${this.describe(el)}`);
          if (reported.some((parent) => parent.contains(el))) continue;
          const rect = el.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          if (!allowOverflow && (rect.right > box.right + scale || rect.bottom > box.bottom + scale
            || rect.left < box.left - scale || rect.top < box.top - scale)) {
            err(i, 'out', `${this.describe(el)}이(가) 슬라이드 밖으로 나가요`);
            reported.push(el);
            continue;
          }
          const cs = getComputedStyle(el);
          if (!allowOverflow && /(hidden|clip|auto|scroll)/.test(`${cs.overflowX} ${cs.overflowY}`)
            && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
            err(i, 'clip', `${this.describe(el)} 안의 내용이 잘려요`);
            reported.push(el);
            continue;
          }
          // 수식의 첨자 등 라이브러리가 그린 내부 글자는 본문 최소 크기에서 제외한다.
          if (el.closest('.katex, math')) continue;
          const hasText = Array.from(el.childNodes).some((node) =>
            node.nodeType === 3 && /\S/.test(node.nodeValue.replace(/\u2060/g, '')));
          if (!hasText) continue;
          const block = el.closest('p, li, td, th, h1, h2, h3, h4, figcaption, small, .caption, label') || el;
          const size = parseFloat(cs.fontSize);
          if (!textBlocks.has(block) || size < textBlocks.get(block)) textBlocks.set(block, size);
        }
        for (const [block, size] of textBlocks) {
          if (size < 18) err(i, 'tiny-text', `${this.describe(block)} 글자가 ${size}px로 너무 작아요 (최소 18px)`);
          else if (size < 20 && block.matches('p, li, td, th') && !block.closest('small, .caption, figcaption, .kicker')) {
            warn(i, 'small-text', `${this.describe(block)} 본문이 ${size}px예요 (권장 20px 이상)`);
          }
        }
      });
    } finally {
      for (const snapshot of snapshots) {
        snapshot.slide.classList.toggle('is-active', snapshot.active);
        for (const step of snapshot.steps) step.el.classList.toggle('is-shown', step.shown);
      }
      root.classList.toggle('ch-auditing', wasAuditing);
    }
    return { ok: !errors.length, errors, warnings,
      info: { slides: Stage.slides.length, aiAdded: qsa('[data-ai]', Stage.deck).length } };
  },

  toggle() {
    if (this.panel.classList.contains('is-open')) { this.close(); return; }
    Panels.close();
    Toolbar.closePop();
    this.render(this.run());
    this.panel.classList.add('is-open');
    document.documentElement.classList.add('ch-audit-on');
  },

  close() {
    this.panel.classList.remove('is-open');
    document.documentElement.classList.remove('ch-audit-on');
  },

  render(report) {
    const items = report.errors.concat(report.warnings);
    const title = report.ok ? `자동 점검: 오류 없음 · 경고 ${report.warnings.length}`
      : `자동 점검: 오류 ${report.errors.length} · 경고 ${report.warnings.length}`;
    this.panel.replaceChildren(h('h2', { text: title }),
      items.length ? h('ul', null, ...items.map((item) => h('li', { class: `is-${item.level}` },
        item.slide == null ? h('span', { text: item.msg })
          : h('button', { type: 'button', text: `${item.slide + 1}쪽 · ${item.msg}`,
            onclick: () => Nav.go(item.slide, true) })))) : h('p', { text: '고칠 것이 없어요.' }),
      h('p', { class: 'ch-audit-info', text: `슬라이드 ${report.info.slides}장 · AI 추가 표시 ${report.info.aiAdded}곳 (점선으로 보임)` }));
  },
};
