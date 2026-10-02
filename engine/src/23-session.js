// 현재 반과 그 반의 판서 문서. 저장은 0.5초 늦춰서 하고, 반을 바꿀 때는 먼저 저장한다.
const Session = {
  deck: 'deck',
  classes: ['기본'],
  current: '기본',
  doc: null,
  hist: null,
  timer: 0,

  deckKey() {
    const raw = document.documentElement.dataset.deck || document.title || location.pathname;
    return String(raw).trim().slice(0, 120) || 'deck';
  },

  async init() {
    this.deck = this.deckKey();
    const saved = await Store.get('classes');
    if (saved && Array.isArray(saved.list)) {
      const list = saved.list.filter((c) => typeof c === 'string' && c.trim()).slice(0, 50);
      if (list.length) {
        this.classes = list;
        this.current = list.includes(saved.current) ? saved.current : list[0];
      }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flush(); });
    window.addEventListener('pagehide', () => this.flush());
    await this.loadCurrent();
  },

  key(cls) { return `ink:${this.deck}:${cls}`; },

  async load(cls) { return InkModel.sanitizeDoc(await Store.get(this.key(cls))) || InkModel.emptyDoc(); },

  async loadCurrent() {
    this.doc = await this.load(this.current);
    this.hist = InkModel.history();
    emit('session');
  },

  changed() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 500);
  },

  async flush() {
    clearTimeout(this.timer);
    if (this.doc) await Store.set(this.key(this.current), this.doc);
  },

  async saveClasses() { await Store.set('classes', { list: this.classes, current: this.current }); },

  async switchTo(cls) {
    if (!this.classes.includes(cls) || cls === this.current) return;
    await this.flush();
    this.current = cls;
    await this.saveClasses();
    await this.loadCurrent();
  },

  async addClass(name) {
    const n = String(name || '').trim().slice(0, 20);
    if (!n || this.classes.includes(n) || BAD_KEYS.includes(n)) return false;
    this.classes.push(n);
    await this.saveClasses();
    return true;
  },

  async removeClass(cls) {
    if (this.classes.length <= 1 || !this.classes.includes(cls)) return false;
    if (cls === this.current) clearTimeout(this.timer);   // 지울 반의 대기 중 저장은 버린다
    else await this.flush();
    this.classes = this.classes.filter((c) => c !== cls);
    await Store.del(this.key(cls));
    if (cls === this.current) {
      this.current = this.classes[0];
      await this.saveClasses();
      await this.loadCurrent();
    } else {
      await this.saveClasses();
    }
    return true;
  },

  async clearCurrent() {
    this.doc = InkModel.emptyDoc();
    this.hist = InkModel.history();
    await this.flush();
    emit('session');
  },

  async exportBackup() {
    await this.flush();
    const all = {};
    for (const c of this.classes) all[c] = await this.load(c);
    return InkModel.backup(this.deck, all);
  },

  async importBackup(text) {
    const r = InkModel.parseBackup(text);
    if (!r.ok) return r;
    await this.flush();
    for (const [c, d] of Object.entries(r.classes)) {
      if (!this.classes.includes(c)) this.classes.push(c);
      await Store.set(this.key(c), d);
    }
    await this.saveClasses();
    await this.loadCurrent();
    return r;
  },
};
