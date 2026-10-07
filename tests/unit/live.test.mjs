import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { LiveCore } = load(['00-core.js', '68-live.js'], ['LiveCore']);

test('reach: 간 장만 열리고, 같은 장은 큰 값을 남긴다', () => {
  let r = LiveCore.reach([], 3, 1, 2, [1]);
  assert.deepStrictEqual(plain(r), [null, { shown: 2, steps: [1] }, null]);
  r = LiveCore.reach(r, 3, 1, 1, [0]);
  assert.deepStrictEqual(plain(r[1]), { shown: 2, steps: [1] });
  r = LiveCore.reach(r, 3, 2, 0, []);
  assert.deepStrictEqual(plain(r[2]), { shown: 0, steps: [] });
});

test('step: 열린 장만 건너 다니고 끝에서는 -1', () => {
  const r = [{ shown: 0, steps: [] }, null, { shown: 1, steps: [] }];
  assert.equal(LiveCore.step(r, 0, 1), 2);
  assert.equal(LiveCore.step(r, 2, -1), 0);
  assert.equal(LiveCore.step(r, 2, 1), -1);
  assert.equal(LiveCore.step(r, 0, -1), -1);
});

test('bins: 값이 적으면 값마다 한 칸, 최빈값을 고른다', () => {
  const b = LiveCore.bins([3, 3, 7, 99, NaN, -5], 0, 10, 1);
  assert.equal(b.length, 11);
  assert.equal(b[3].n, 2);
  assert.equal(b[3].pick, 3);
  assert.equal(b[10].n, 1);   // 범위 밖은 끝 칸(값은 교사가 받을 때 자른다)
  assert.equal(b[0].n, 1);
  assert.equal(b[5].pick, null);
});

test('bins: 값이 많으면 20칸, 같은 수면 작은 값', () => {
  const b = LiveCore.bins([0, 1, 1, 0, 999], 0, 1000, 1);
  assert.equal(b.length, 20);
  assert.equal(b[0].n, 4);
  assert.equal(b[0].pick, 0);
  assert.equal(b[19].n, 1);
});

test('clean: 모양이 맞는 메시지만 받는다', () => {
  assert.deepStrictEqual(plain(LiveCore.clean('val', { sid: 'abcd1234', slide: 1, key: 'ik-t', v: 3, x: 1 }, 3)),
    { sid: 'abcd1234', slide: 1, key: 'ik-t', v: 3 });
  assert.equal(LiveCore.clean('val', { sid: 'ABC', slide: 1, key: 'k', v: 3 }, 3), null);
  assert.equal(LiveCore.clean('val', { sid: 'abcd1234', slide: 3, key: 'k', v: 3 }, 3), null);
  assert.equal(LiveCore.clean('val', { sid: 'abcd1234', slide: 0, key: 'k'.repeat(61), v: 3 }, 3), null);
  assert.equal(LiveCore.clean('val', { sid: 'abcd1234', slide: 0, key: 'k', v: Infinity }, 3), null);
  assert.deepStrictEqual(plain(LiveCore.clean('hi', { sid: 'abcd1234' }, 3)), { sid: 'abcd1234' });
  assert.equal(LiveCore.clean('nope', {}, 3), null);
  assert.equal(LiveCore.clean('hi', null, 3), null);
  const s = LiveCore.clean('state', {
    slide: 1, shown: 0, steps: [2], reach: [null, { shown: 1, steps: [2, 'x'] }], lesson: { key: 'd', n: 2, title: 't' }, site: '../x',
  }, 2);
  assert.deepStrictEqual(plain(s), {
    slide: 1, shown: 0, steps: [2], reach: [null, { shown: 1, steps: [] }], lesson: { key: 'd', n: 2, title: 't' }, site: null,
  });
  assert.equal(LiveCore.clean('state', { slide: -1, shown: 0, reach: [] }, 2), null);
});

test('code·sid 모양', () => {
  for (let i = 0; i < 50; i++) {
    assert.match(LiveCore.code(), /^[1-9]\d{5}$/);
    assert.match(LiveCore.sid(), /^[a-z0-9]{8}$/);
  }
});
