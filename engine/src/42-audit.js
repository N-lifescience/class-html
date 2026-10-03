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
    // 단계 막대 칸마다 다시 재므로 같은 장·같은 내용의 알림은 한 번만 적는다
    const seen = new Set();
    const add = (list, level) => (slide, code, msg) => {
      const k = `${slide}|${code}|${msg}`;
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ level, slide, code, msg });
    };
    const err = add(errors, 'error');
    const warn = add(warnings, 'warn');
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
    const stepperSnap = Stepper.snapshot();
    root.classList.add('ch-auditing');
    try {
      const measure = (slide, i) => {
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
          // 어절 보정이 감싼 span.w는 낱말 하나이므로 그 부모를 글 덩어리로 본다
          const base = el.classList.contains('w') && el.parentElement ? el.parentElement : el;
          const block = base.closest('p, li, td, th, h1, h2, h3, h4, figcaption, small, .caption, label') || base;
          const size = parseFloat(cs.fontSize);
          if (!textBlocks.has(block) || size < textBlocks.get(block)) textBlocks.set(block, size);
        }
        for (const [block, size] of textBlocks) {
          if (size < 18) err(i, 'tiny-text', `${this.describe(block)} 글자가 ${size}px로 너무 작아요 (최소 18px)`);
          else if (size < 20 && block.matches('p, li, td, th') && !block.closest('small, .caption, figcaption, .kicker')) {
            warn(i, 'small-text', `${this.describe(block)} 본문이 ${size}px예요 (권장 20px 이상)`);
          }
        }
      };
      Stepper.openAll('audit');
      Stage.slides.forEach((slide, i) => measure(slide, i));
      // data-only 내용은 칸마다 다르므로 단계 막대의 칸마다 다시 잰다
      for (const st of Stepper.all) {
        if (!st.targets.some((t) => t.hasAttribute('data-only'))) continue;
        for (let k = 0; k < st.max; k++) { st.set(k, 'audit'); measure(st.slide, st.index); }
        st.set(st.max, 'audit');
      }
    } finally {
      Stepper.restore(stepperSnap, 'audit');
      for (const snapshot of snapshots) {
        snapshot.slide.classList.toggle('is-active', snapshot.active);
        for (const step of snapshot.steps) step.el.classList.toggle('is-shown', step.shown);
      }
      root.classList.toggle('ch-auditing', wasAuditing);
      // 표시 상태를 되돌릴 때 다시 시작된 슬라이드 등장·단계 전환 효과는 바로 끝낸다(점검할 때마다 깜박이지 않게)
      if (!wasAuditing && Stage.deck.getAnimations) {
        void Stage.deck.offsetWidth;
        for (const a of Stage.deck.getAnimations({ subtree: true })) a.finish();
      }
    }
    const info = this.checkParts(err, warn);
    return { ok: !errors.length, errors, warnings,
      info: Object.assign({ slides: Stage.slides.length, aiAdded: qsa('[data-ai]', Stage.deck).length }, info) };
  },

  // 부품 작성 실수, 단계형 슬라이더의 시작 값, 활동 장 비율(설계서 7.2-5: 3분의 1 이상)
  checkParts(err, warn) {
    const at = (el) => { const i = Stage.slides.indexOf(el.closest('section.slide')); return i < 0 ? null : i; };
    const part = (el, msg) => err(at(el), 'part', `${this.describe(el)}: ${msg}`);
    for (const el of Stepper.orphans || []) part(el, '어느 단계 막대에 딸린 것인지 몰라요(data-for="단계 막대 id")');
    for (const st of Stepper.all) {
      for (const t of st.targets) {
        const nums = (t.dataset.only != null ? String(t.dataset.only).split(/[\s,]+/) : [t.dataset.at]).map(Number);
        if (nums.some((v) => !Number.isInteger(v) || v < 0 || v > st.max)) part(t, `단계 번호는 0~${st.max}이어야 해요`);
      }
    }
    for (const item of Calc.list.concat(Plot.list)) for (const e of item.errors) part(e.el, e.msg);
    for (const box of qsa('.sort', Stage.deck)) {
      const bins = qsa('.bin[data-bin]', box).map((b) => b.dataset.bin);
      const cards = qsa('[data-bin]:not(.bin)', box);
      if (!bins.length || !cards.length) part(box, '칸(.bin[data-bin])과 카드([data-bin])가 모두 있어야 해요');
      for (const c of cards) if (!bins.includes(c.dataset.bin)) part(c, `data-bin="${c.dataset.bin}"인 칸이 없어요`);
    }
    for (const box of qsa('.quiz', Stage.deck)) {
      if (!box.querySelector('.opt')) part(box, '보기(.opt)가 없어요');
      else if (!box.querySelector('.opt[data-ok]')) part(box, '정답 보기(data-ok)가 없어요');
    }
    for (const fig of qsa('figure.map-reveal', Stage.deck)) {
      const st = Stepper.all.find((s) => s.el === fig);
      const froms = qsa('[data-from]', fig).map((p) => Number(p.dataset.from));
      if (!froms.length) part(fig, '열릴 땅(svg 안 [data-from] 다각형)이 없어요');
      if (st && froms.some((v) => !Number.isInteger(v) || v < 1 || v > st.max)) part(fig, `data-from은 1~${st.max}이어야 해요`);
    }
    for (const ol of qsa('ol.yearline', Stage.deck)) if (!ol.querySelector('li[data-year]')) part(ol, '연도(li[data-year])가 없어요');
    for (const ol of qsa('ol.order', Stage.deck)) if (ol.querySelectorAll(':scope > li').length < 2) part(ol, '항목이 2개 이상이어야 해요');
    // 엔진 부품 밖의 슬라이더가 최솟값이 아닌 곳에서 시작하면 단계형인지 확인하게 한다(7.2-9)
    for (const r of qsa('input[type="range"]', Stage.deck)) {
      if (r.closest('.calc, .ch-stops, .ch-yearline')) continue;
      if (Number(r.defaultValue || r.getAttribute('value') || r.min || 0) !== Number(r.min || 0)) {
        warn(at(r), 'not-veiled', `${this.describe(r)}: 단계를 여는 막대라면 '시작'(최솟값)에서 시작하세요`);
      }
    }
    const ACT = '.reveal, .switch, .map-reveal, .ch-yearline, .sort, .quiz, .ch-order, .calc, .plot, input[type="range"], [data-activity]';
    const activities = Stage.slides.filter((s) => s.querySelector(ACT)).length;
    const total = Stage.slides.length;
    if (total >= 3 && activities * 3 < total) warn(null, 'few-activities', `활동 장이 ${activities}/${total}장이에요. 3분의 1(${Math.ceil(total / 3)}장) 이상이 되게 하세요`);
    const imgs = qsa('img[data-ppt]', Stage.deck);
    return { activities, images: imgs.length, emptyImages: imgs.filter((i) => !i.getAttribute('src')).length };
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
      h('p', { class: 'ch-audit-info', text: `슬라이드 ${report.info.slides}장 · 활동 장 ${report.info.activities}장 · AI 추가 표시 ${report.info.aiAdded}곳 (점선으로 보임)` }));
  },
};
