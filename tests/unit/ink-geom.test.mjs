import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { InkGeom } = load(['00-core.js', '20-ink-geom.js'], ['InkGeom']);

test('선분까지 거리', () => {
  assert.equal(InkGeom.distToSeg(5, 5, 0, 0, 10, 0), 5);
  assert.equal(InkGeom.distToSeg(-3, 4, 0, 0, 10, 0), 5);
  assert.equal(InkGeom.distToSeg(3, 4, 0, 0, 0, 0), 5);
});

test('bbox', () => {
  assert.deepStrictEqual(plain(InkGeom.bbox([3, 9, -1, 2, 5, 4])), [-1, 2, 5, 9]);
});

test('hit는 지우개 반지름 + 획 굵기 절반까지 닿으면 참', () => {
  const s = { w: 4, p: [0, 0, 100, 0] };
  assert.equal(InkGeom.hit(s, 50, 10, 8), true);
  assert.equal(InkGeom.hit(s, 50, 11, 8), false);
  assert.equal(InkGeom.hit(s, 200, 0, 8), false);
});

test('점 하나짜리 획은 점으로 판정', () => {
  assert.equal(InkGeom.hit({ w: 6, p: [10, 10] }, 14, 10, 1), true);
  assert.equal(InkGeom.hit({ w: 6, p: [10, 10] }, 15, 10, 1), false);
});

test('keep은 너무 가까운 점을 거른다', () => {
  assert.equal(InkGeom.keep([0, 0], 0.5, 0, 0.8), false);
  assert.equal(InkGeom.keep([0, 0], 1, 0, 0.8), true);
  assert.equal(InkGeom.keep([], 1, 0, 0.8), true);
});

test('round는 소수 첫째 자리', () => {
  assert.equal(InkGeom.round(1.26), 1.3);
  assert.equal(InkGeom.round(-0.04), -0);
});

test('여러 구간 획, 끝점 너머, 경계값', () => {
  const L = { w: 4, p: [0, 0, 100, 0, 100, 100] };
  assert.equal(InkGeom.hit(L, 100, 50, 8), true);           // 2번째 선분
  assert.equal(InkGeom.hit(L, 50, 50, 8), false);
  assert.equal(InkGeom.distToSeg(13, 4, 0, 0, 10, 0), 5);   // 끝점 너머(t>1)
  assert.equal(InkGeom.keep([0, 0], 0.8, 0, 0.8), true);    // 정확히 minDist
});
