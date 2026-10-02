import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

const quiet = { warn() {}, log() {}, error() {} };
const fakeLocal = () => {
  const m = new Map();
  return { setItem: (k, v) => m.set(k, String(v)), getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k) };
};

test('IndexedDB가 응답하지 않으면 localStorage로 읽고 쓴다', async () => {
  const { Store } = load(['22-store.js'], ['Store'], {
    console: quiet,
    indexedDB: { open: () => ({}) },          // 성공도 실패도 오지 않는다
    setTimeout: (fn) => { fn(); return 0; },   // 3초 기다림을 바로 끝낸다
    localStorage: fakeLocal(),
  });
  await Store.init();
  assert.equal(Store.backend, 'local');
  assert.equal(await Store.set('k', { a: 1 }), true);
  assert.equal((await Store.get('k')).a, 1);
  assert.equal(await Store.del('k'), true);
  assert.equal(await Store.get('k'), undefined);
});

test('IndexedDB도 localStorage도 안 되면 메모리, 경고는 한 번', async () => {
  let warned = 0;
  const { Store } = load(['22-store.js'], ['Store'], {
    console: { ...quiet, warn() { warned += 1; } },
    localStorage: { setItem() { throw new Error('막힘'); } },
  });
  await Store.init();
  assert.equal(Store.backend, 'memory');
  assert.equal(warned, 1);
  assert.equal(await Store.set('k', 1), true);
  assert.equal(await Store.get('k'), 1);
});

test('트랜잭션이 중단돼도 멈추지 않고 실패를 돌려준다', { timeout: 2000 }, async () => {   // 멈추면 2초 뒤 실패
  const { Store } = load(['22-store.js'], ['Store'], { console: quiet });
  Store.backend = 'idb';
  Store.db = {
    transaction() {
      const t = { error: null, objectStore: () => ({ get: () => ({}), put: () => ({}), delete: () => ({}) }) };
      queueMicrotask(() => t.onabort && t.onabort());   // 용량 초과처럼 요청 오류 없이 abort만 온다
      return t;
    },
  };
  assert.equal(await Store.set('k', 1), false);
  assert.equal(await Store.get('k'), undefined);
  assert.equal(await Store.del('k'), false);
});
