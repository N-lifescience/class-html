// 키-값 저장소. IndexedDB가 안 되면 localStorage, 그것도 안 되면 메모리(창을 닫으면 사라짐).
const Store = {
  backend: 'memory',
  db: null,
  mem: new Map(),

  async init() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('class-html', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        setTimeout(() => reject(new Error('indexedDB timeout')), 3000);
      });
      this.backend = 'idb';
      return;
    } catch (err) { /* localStorage로 */ }
    try {
      localStorage.setItem('class-html:probe', '1');
      localStorage.removeItem('class-html:probe');
      this.backend = 'local';
    } catch (err) {
      this.backend = 'memory';
      console.warn('[class-html] 브라우저 저장소를 쓸 수 없어 판서가 창을 닫으면 사라집니다.');
    }
  },

  tx(mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
    });
  },

  async get(key) {
    if (this.backend === 'idb') return this.tx('readonly', (s) => s.get(key));
    if (this.backend === 'local') {
      try {
        const v = localStorage.getItem(`class-html:${key}`);
        return v == null ? undefined : JSON.parse(v);
      } catch (err) { return undefined; }
    }
    return this.mem.get(key);
  },

  async set(key, value) {
    if (this.backend === 'idb') { await this.tx('readwrite', (s) => s.put(value, key)); return; }
    if (this.backend === 'local') { localStorage.setItem(`class-html:${key}`, JSON.stringify(value)); return; }
    this.mem.set(key, value);
  },

  async del(key) {
    if (this.backend === 'idb') { await this.tx('readwrite', (s) => s.delete(key)); return; }
    if (this.backend === 'local') { localStorage.removeItem(`class-html:${key}`); return; }
    this.mem.delete(key);
  },
};
