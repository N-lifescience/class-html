// 히어로: 살아 있는 익스플로라그램 세 개(과학 확산 · 사회 수요와 공급 · 초등 그림자)를 돌아가며 보여 준다.
// 보통: GSAP로 「PPT 세 장 → Exploragram」 변신 한 번, 그 뒤 가짜 손이 막대를 끌며 시연한다. 사용자가 건드리면 조작권을 넘긴다.
// 가볍게: GSAP를 못 받았거나 화면이 느리거나 「가볍게 보기」를 켜면 막대만 천천히 움직인다.
// 정지: 운영체제의 「동작 줄이기」면 움직이지 않는다. 막대는 그대로 만질 수 있다.
(function () {
  const GSAP = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
  const SCROLL = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js';
  const KEY = 'xg-lite';         // '1' 가볍게 고정 · '0' 보통 고정 · 없음: 자동
  const FPS_MIN = 30;            // 소개 연출 2초 동안의 평균이 이보다 낮으면 가볍게로 바꾼다
  const IDLE_MS = 12000;         // 사용자가 손을 뗀 뒤 이만큼 지나면 시연을 다시 시작한다
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const hero = $('.hero');
  if (!hero) return;
  const board = $('.xg-board', hero);
  const svg = $('#xg-svg');
  const range = $('#xg-range');
  const rangeLabel = $('#xg-range-label');
  const out = $('#xg-out');
  const cap = $('#xg-cap');
  const hand = $('#xg-hand');
  const handIn = $('.xg-hand-i', hand);
  const ppt = $('.xg-ppt', hero);
  const chips = $$('.xg-chip', hero);
  const liteBtn = $('#xg-lite');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 저장 못 해도 이번 화면에는 적용된다 */ } },
  };

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  }
  const won = (n) => n.toLocaleString('ko-KR');
  // 매번 같은 그림이 나오게 씨앗이 있는 난수
  function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  // ---------- 익스플로라그램 세 개: build(g) 한 번, draw(v, t) 여러 번, text(v) ----------
  const BOX = { x: 105, y: 15, s: 270 };   // 확산 상자(3×3칸)
  const dots = (() => {
    const r = rng(7), list = [];
    for (let i = 0; i < 54; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 28;
      list.push({
        sx: 240 + Math.cos(a) * d, sy: 150 + Math.sin(a) * d,
        tx: BOX.x + 10 + r() * (BOX.s - 20), ty: BOX.y + 10 + r() * (BOX.s - 20),
        ph: r() * 6.28,
      });
    }
    return list;
  })();
  const spread = (v) => 1 - (1 - v) * (1 - v);
  function dotAt(p, v) { const e = spread(v); return [p.sx + (p.tx - p.sx) * e, p.sy + (p.ty - p.sy) * e]; }

  const SUBJECTS = [
    {
      title: '과학 · 잉크는 어떻게 퍼질까?',
      label: '시간',
      href: 'lessons/sci-diffusion.html',
      build(g) {
        el('rect', { x: BOX.x, y: BOX.y, width: BOX.s, height: BOX.s, rx: 10, class: 'xg-box' }, g);
        for (let i = 1; i < 3; i++) {
          el('line', { x1: BOX.x + i * 90, y1: BOX.y, x2: BOX.x + i * 90, y2: BOX.y + BOX.s, class: 'xg-grid' }, g);
          el('line', { x1: BOX.x, y1: BOX.y + i * 90, x2: BOX.x + BOX.s, y2: BOX.y + i * 90, class: 'xg-grid' }, g);
        }
        this.cells = [];
        for (let i = 0; i < 9; i++) this.cells.push(el('rect', { x: BOX.x + (i % 3) * 90 + 3, y: BOX.y + Math.floor(i / 3) * 90 + 3, width: 84, height: 84, rx: 6, class: 'xg-cell' }, g));
        this.c = dots.map(() => el('circle', { r: 4.2, class: 'xg-dot' }, g));
      },
      draw(v, t) {
        const hit = new Set();
        dots.forEach((p, i) => {
          let [x, y] = dotAt(p, v);
          if (t) { x += Math.sin(t * 2.1 + p.ph) * 2.2; y += Math.cos(t * 1.7 + p.ph) * 2.2; }
          this.c[i].setAttribute('cx', x.toFixed(1));
          this.c[i].setAttribute('cy', y.toFixed(1));
          hit.add(Math.min(2, Math.floor((x - BOX.x) / 90)) + 3 * Math.min(2, Math.floor((y - BOX.y) / 90)));
        });
        this.cells.forEach((c, i) => c.classList.toggle('on', hit.has(i)));
        this.k = hit.size;
      },
      text(v) { return `시간 ${(Math.round(v * 10) / 2).toFixed(1)}분 · 잉크가 있는 칸 ${this.k}/9`; },
      live: true,
    },
    {
      title: '사회 · 떡볶이 값은 누가 정할까?',
      label: '가격',
      href: 'lessons/soc-supply-demand.html',
      // 수요량 = 900 − 0.2×가격, 공급량 = 0.2×가격 − 300 → 균형 3,000원 · 300인분
      px: (q) => 60 + (q / 600) * 380,
      py: (p) => 270 - ((p - 1500) / 3000) * 240,
      price: (v) => Math.round((1500 + v * 3000) / 100) * 100,
      build(g) {
        const { px, py } = this;
        el('line', { x1: 60, y1: 20, x2: 60, y2: 270, class: 'xg-axis' }, g);
        el('line', { x1: 60, y1: 270, x2: 450, y2: 270, class: 'xg-axis' }, g);
        el('text', { x: 66, y: 28, class: 'xg-t' }, g).textContent = '가격';
        el('text', { x: 446, y: 290, class: 'xg-t', 'text-anchor': 'end' }, g).textContent = '양(인분)';
        el('line', { x1: px(600), y1: py(1500), x2: px(0), y2: py(4500), class: 'xg-demand' }, g);
        el('line', { x1: px(0), y1: py(1500), x2: px(600), y2: py(4500), class: 'xg-supply' }, g);
        el('text', { x: px(600) - 6, y: py(1500) - 12, class: 'xg-t xg-t-d', 'text-anchor': 'end' }, g).textContent = '수요';
        el('text', { x: px(560), y: py(4500) + 22, class: 'xg-t xg-t-s', 'text-anchor': 'end' }, g).textContent = '공급';
        el('circle', { cx: px(300), cy: py(3000), r: 5, class: 'xg-eq' }, g);
        el('text', { x: px(300) + 10, y: py(3000) + 18, class: 'xg-t' }, g).textContent = 'E';
        this.pl = el('line', { x1: 60, x2: 450, class: 'xg-price' }, g);
        this.gap = el('line', { class: 'xg-gap' }, g);
        this.dd = el('circle', { r: 6, class: 'xg-pt-d' }, g);
        this.ss = el('circle', { r: 6, class: 'xg-pt-s' }, g);
        this.gl = el('text', { class: 'xg-t xg-gap-t', 'text-anchor': 'middle' }, g);
      },
      draw(v) {
        const { px, py } = this, p = this.price(v), y = py(p);
        const qd = Math.max(0, 900 - 0.2 * p), qs = Math.max(0, 0.2 * p - 300);
        this.pl.setAttribute('y1', y); this.pl.setAttribute('y2', y);
        this.dd.setAttribute('cx', px(qd)); this.dd.setAttribute('cy', y);
        this.ss.setAttribute('cx', px(qs)); this.ss.setAttribute('cy', y);
        for (const [k, val] of [['x1', px(qd)], ['x2', px(qs)], ['y1', y], ['y2', y]]) this.gap.setAttribute(k, val);
        this.gap.classList.toggle('short', qs < qd);
        this.gl.setAttribute('x', (px(qd) + px(qs)) / 2);
        this.gl.setAttribute('y', y - 12);
        const d = Math.round(qs - qd);
        this.gl.textContent = d === 0 ? '균형' : d > 0 ? `초과 공급 ${d}` : `초과 수요 ${-d}`;
        this.d = d;
      },
      text(v) {
        const p = this.price(v);
        return this.d === 0 ? `가격 ${won(p)}원 · 균형, 300인분이 팔려요` : `가격 ${won(p)}원 · ${this.d > 0 ? '초과 공급' : '초과 수요'} ${won(Math.abs(this.d))}인분`;
      },
    },
    {
      title: '초등 과학 · 그림자는 왜 커질까?',
      label: '손전등 위치',
      href: 'lessons/elem-shadow.html',
      // 손전등(Lx, 150) · 물체(x 260, 높이 60) · 스크린(x 430). 닮은 삼각형으로 그림자 크기를 구한다.
      lx: (v) => 40 + v * 160,
      build(g) {
        this.cone = el('polygon', { class: 'xg-cone' }, g);
        el('rect', { x: 430, y: 16, width: 16, height: 268, rx: 3, class: 'xg-screen' }, g);
        this.sh = el('rect', { x: 430, width: 16, rx: 2, class: 'xg-shadow' }, g);
        el('rect', { x: 255, y: 120, width: 10, height: 60, rx: 3, class: 'xg-obj' }, g);
        el('text', { x: 260, y: 205, class: 'xg-t', 'text-anchor': 'middle' }, g).textContent = '물체';
        el('text', { x: 422, y: 296, class: 'xg-t', 'text-anchor': 'end' }, g).textContent = '스크린';
        this.torch = el('g', { class: 'xg-torch' }, g);
        el('rect', { x: -34, y: -9, width: 30, height: 18, rx: 4 }, this.torch);
        el('circle', { cx: 0, cy: 0, r: 8, class: 'xg-bulb' }, this.torch);
      },
      draw(v) {
        const lx = this.lx(v), half = Math.min(125, 30 * (430 - lx) / (260 - lx));
        this.torch.setAttribute('transform', `translate(${lx.toFixed(1)} 150)`);
        this.cone.setAttribute('points', `${lx},150 430,${150 - half} 430,${150 + half}`);
        this.sh.setAttribute('y', 150 - half);
        this.sh.setAttribute('height', 2 * half);
        this.dist = Math.round((260 - lx) / 10);
        this.size = Math.round(2 * half / 10);
      },
      text() { return `손전등과 물체 사이 ${this.dist}cm · 그림자 길이 ${this.size}cm`; },
    },
  ];

  // ---------- 화면 상태 ----------
  const S = { i: 0, v: 0.15, mode: 'still', gsap: null, tl: null, amb: [], idle: 0, raf: 0, visible: true, user: false, intro: false, switching: false };
  let cur = SUBJECTS[0];
  let layer = null;

  function mount(i) {
    S.i = i;
    cur = SUBJECTS[i];
    if (layer) layer.remove();
    layer = el('g', { class: 'xg-layer' }, svg);
    cur.build(layer);
    cap.textContent = cur.title;
    rangeLabel.textContent = cur.label;
    range.setAttribute('aria-label', cur.label);
    board.dataset.href = cur.href;
    chips.forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
    apply(S.v);
  }

  function apply(v, t) {
    S.v = Math.max(0, Math.min(1, v));
    range.value = String(Math.round(S.v * 1000));
    cur.draw(S.v, t);
    out.textContent = cur.text(S.v);
    if (S.mode === 'full' && !S.user) placeHand();
  }

  function placeHand() {
    const b = board.getBoundingClientRect(), r = range.getBoundingClientRect();
    const x = r.left - b.left + 11 + S.v * (r.width - 22), y = r.top - b.top + r.height / 2;
    hand.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  // ---------- 사용자 조작 ----------
  function takeOver() {
    S.user = true;
    out.setAttribute('aria-live', 'polite');
    if (S.intro && S.tl) S.tl.progress(1);   // 글자·단추·그림이 반쯤 숨은 채로 남지 않게 끝 장면으로 넘긴다
    if (S.tl) { S.tl.kill(); S.tl = null; }
    hand.style.opacity = '0';
    clearTimeout(S.idle);
    if (S.mode !== 'still') S.idle = setTimeout(() => { S.user = false; out.removeAttribute('aria-live'); run(); }, IDLE_MS);
  }
  range.addEventListener('input', (e) => { if (e.isTrusted) { takeOver(); apply(Number(range.value) / 1000); } });
  range.addEventListener('pointerdown', takeOver);
  chips.forEach((c, k) => c.addEventListener('click', () => { takeOver(); mount(k); }));

  // ---------- 보통(GSAP) ----------
  function demo() {
    const g = S.gsap;
    if (!g || S.user || !S.visible || S.tl || S.switching) return;
    const p = { v: S.v };
    const tl = g.timeline({ onComplete: () => { S.tl = null; next(); } });
    S.tl = tl;
    tl.set(hand, { opacity: 0 })
      .add(placeHand)
      .to(hand, { opacity: 1, duration: 0.35 })
      .to(handIn, { scale: 0.86, duration: 0.15, transformOrigin: '6px 4px' })
      .to(p, { v: 0.92, duration: 2.8, ease: 'sine.inOut', onUpdate: () => apply(p.v, cur.live ? performance.now() / 1000 : 0) })
      .to(p, { v: 0.4, duration: 1.8, ease: 'sine.inOut', onUpdate: () => apply(p.v, cur.live ? performance.now() / 1000 : 0) })
      .to(handIn, { scale: 1, duration: 0.15 })
      .to(hand, { opacity: 0, duration: 0.4 }, '+=0.6')
      .to({}, { duration: 1.2 });
  }

  function next() {
    const g = S.gsap;
    if (S.user) return;
    S.switching = true;
    g.to(svg, {
      opacity: 0, scale: 0.94, duration: 0.35, ease: 'power2.in', transformOrigin: '50% 50%',
      onComplete: () => {
        if (S.user) { S.switching = false; g.set(svg, { opacity: 1, scale: 1 }); return; }
        S.v = 0.12;
        mount((S.i + 1) % SUBJECTS.length);
        g.fromTo(svg, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', onComplete: () => { S.switching = false; demo(); } });
      },
    });
  }

  // 확산 입자는 막대가 멈춰 있어도 조금씩 떤다(브라운 운동)
  function jitter() {
    if (S.mode === 'full' && S.visible && cur.live) cur.draw(S.v, performance.now() / 1000);
  }

  function intro() {
    const g = S.gsap;
    S.intro = true;
    const letters = $$('.hero h1 .ch');
    const frames = $$('.xg-frame', ppt);
    const tl = g.timeline({ onComplete: () => { S.tl = null; S.intro = false; ppt.hidden = true; demo(); } });
    S.tl = tl;
    tl.from(letters, { yPercent: 110, rotate: 8, opacity: 0, duration: 0.8, ease: 'power4.out', stagger: 0.045 })
      .from('.hero .def, .hero .origin, .hero .cta > *', { y: 16, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07 }, '-=0.4')
      .from('.hero .feats li', { y: 24, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, '<0.1')
      .set(svg, { opacity: 0 }, 0)
      .set('.xg-ctrl', { opacity: 0, y: 14 }, 0)
      .add(() => { cap.textContent = 'PPT · 멈춘 그림 세 장'; }, 0)
      .from(frames, { y: 30, opacity: 0, duration: 0.55, ease: 'back.out(1.6)', stagger: 0.12 }, 0.3)
      .add(() => {
        // 세 장을 가운데로 모은다
        const b = ppt.getBoundingClientRect(), mid = b.left + b.width / 2;
        frames.forEach((f) => { const r = f.getBoundingClientRect(); f.dataset.dx = String(mid - (r.left + r.width / 2)); });
      }, '+=0.9')
      .to(frames, { x: (k, f) => Number(f.dataset.dx), scale: 0.82, rotate: (k) => (k - 1) * 4, duration: 0.7, ease: 'power3.inOut' })
      .add(() => { cap.textContent = 'Exploragram · 막대 하나로 움직이는 그림'; })
      .to(ppt, { opacity: 0, scale: 1.08, duration: 0.45, ease: 'power2.in' }, '+=0.15')
      .fromTo(svg, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out', transformOrigin: '50% 50%' }, '<0.2')
      .to('.xg-ctrl', { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, '<0.15')
      .add(() => { cap.textContent = cur.title; });
  }

  function ambient() {
    const g = S.gsap;
    $$('.hero .amb > *').forEach((n, k) => {
      S.amb.push(g.to(n, { x: `random(-40, 40)`, y: `random(-30, 30)`, rotate: `random(-90, 90)`, duration: `random(6, 11)`, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: k * 0.2 }));
    });
  }

  function reveal() {
    const g = S.gsap;
    if (!window.ScrollTrigger) return;
    g.registerPlugin(window.ScrollTrigger);
    $$('main > section').forEach((s) => {
      g.from(s, { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
    });
  }

  // 처음 2초의 평균 프레임을 재서 느리면 가볍게로 바꾼다(사용자가 고른 적이 없을 때만)
  function watchFps() {
    if (store.get() != null || document.hidden) return;
    let n = 0, hid = false;
    const t0 = performance.now();
    const onHide = () => { hid = true; };
    document.addEventListener('visibilitychange', onHide, { once: true });
    const count = () => {
      n++;
      const dt = performance.now() - t0;
      if (dt < 2000) { requestAnimationFrame(count); return; }
      document.removeEventListener('visibilitychange', onHide);
      if (!hid && store.get() == null && S.mode === 'full' && S.visible && (n * 1000) / dt < FPS_MIN) setMode('lite', '화면이 느려 가볍게 보여 줘요');
    };
    requestAnimationFrame(count);
  }

  // ---------- 가볍게(GSAP 없이) ----------
  function liteLoop() {
    let last = 0, since = performance.now();
    const step = (now) => {
      if (S.mode !== 'lite') return;
      S.raf = requestAnimationFrame(step);
      if (S.user) since = now;   // 손을 뗀 뒤 다시 시작할 때 고른 과목을 바로 넘기지 않는다
      if (!S.visible || S.user || now - last < 66) return;   // 초당 15번이면 충분하다
      last = now;
      const t = (now - since) / 1000;
      apply(0.5 - 0.42 * Math.cos(t * 0.8));
      if (t > 8) { since = now; mount((S.i + 1) % SUBJECTS.length); }
    };
    S.raf = requestAnimationFrame(step);
  }

  // ---------- 모드 바꾸기 ----------
  function stopAll() {
    if (S.tl) { S.tl.kill(); S.tl = null; }
    cancelAnimationFrame(S.raf);
    if (S.gsap) {
      S.gsap.killTweensOf([svg, hand, handIn, ppt, '.xg-frame', '.xg-ctrl', '.hero .amb > *']);
      S.amb = [];
      S.switching = false;
      S.gsap.set([svg, ppt, '.xg-frame', '.xg-ctrl'], { clearProps: 'opacity,transform' });
      S.gsap.ticker.remove(jitter);
      // 소개 연출이 중간에 끊겨도 글자와 단추가 숨은 채로 남지 않게 한다
      S.gsap.set('.hero h1 .ch, .hero .def, .hero .origin, .hero .cta > *, .hero .feats li', { clearProps: 'all' });
    }
    ppt.hidden = true;
    S.intro = false;
    cap.textContent = cur.title;
    hand.style.opacity = '0';
  }

  function setMode(mode, note) {
    stopAll();
    S.mode = mode;
    hero.dataset.mode = mode;
    liteBtn.setAttribute('aria-pressed', String(mode !== 'full'));
    liteBtn.title = note || '';
    if (mode === 'full') { S.gsap.ticker.add(jitter); S.user = false; demo(); }
    else if (mode === 'lite') { S.user = false; liteLoop(); }
    else apply(0.6);
  }

  function run() {
    if (S.mode === 'full') demo();
  }

  function load(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      s.src = src;
      s.onload = () => { clearTimeout(timer); resolve(); };
      s.onerror = () => { clearTimeout(timer); reject(new Error(src)); };
      document.head.append(s);
    });
  }

  async function full(first) {
    try {
      if (!window.gsap) await load(GSAP);
      S.gsap = window.gsap;
    } catch (e) {
      setMode('lite', 'GSAP를 받지 못해 가볍게 보여 줘요');
      return false;
    }
    if (S.mode !== 'loading') return false;   // 받는 사이에 가볍게로 바꿨다
    S.mode = 'full';
    hero.dataset.mode = 'full';
    liteBtn.setAttribute('aria-pressed', 'false');
    S.gsap.ticker.add(jitter);
    ambient();
    if (first) {
      ppt.hidden = false;
      intro();
      watchFps();
      load(SCROLL).then(reveal, () => {});
    } else demo();
    return true;
  }

  liteBtn.addEventListener('click', () => {
    if (S.mode === 'full' || S.mode === 'loading') { store.set('1'); setMode('lite'); }
    else if (!reduce) { store.set('0'); stopAll(); S.mode = 'loading'; full(false); }
  });

  // 화면 밖이면 멈춘다
  new IntersectionObserver(([e]) => {
    S.visible = e.isIntersecting;
    if (!S.gsap) return;
    const own = S.amb.concat(S.tl ? [S.tl] : []);
    if (S.visible) { own.forEach((t) => t.resume()); if (S.mode === 'full' && !S.user && !S.intro) demo(); }
    else own.forEach((t) => t.pause());
  }).observe(hero);

  // 보드를 누르면(막대 말고) 그 수업을 연다
  svg.addEventListener('click', () => { location.href = board.dataset.href; });

  // ---------- 시작 ----------
  // 소개 연출 첫 장: 확산 상자를 처음 · 1분 뒤 · 5분 뒤로 멈춰 찍은 PPT 세 장
  $$('.xg-frame svg', ppt).forEach((m, k) => {
    const v = [0, 0.35, 1][k];
    el('rect', { x: BOX.x, y: BOX.y, width: BOX.s, height: BOX.s, rx: 10, class: 'xg-box' }, m);
    dots.forEach((p) => { const [x, y] = dotAt(p, v); el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 6, class: 'xg-dot' }, m); });
  });
  mount(0);
  const pref = store.get();
  if (reduce) setMode('still');
  else if (pref === '1') setMode('lite');
  else { S.mode = 'loading'; hero.dataset.mode = 'loading'; full(true); }
}());
