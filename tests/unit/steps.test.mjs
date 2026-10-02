import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { Steps } = load(['00-core.js', '10-steps.js'], ['Steps']);

test('data-step이 없으면 문서 순서대로 하나씩', () => {
  assert.deepStrictEqual(plain(Steps.groups([null, null, null])), [[0], [1], [2]]);
});

test('같은 data-step은 함께, 숫자 순서로', () => {
  assert.deepStrictEqual(plain(Steps.groups([2, 1, 2])), [[1], [0, 2]]);
});

test('번호 없는 단계는 바로 앞 번호 다음', () => {
  assert.deepStrictEqual(plain(Steps.groups([1, null, 2])), [[0], [1], [2]]);
});

test('next: 단계를 열고, 다 열리면 다음 장, 끝에서는 그대로', () => {
  const counts = [2, 0];
  let s = { slide: 0, shown: 0 };
  s = Steps.next(s, counts); assert.deepStrictEqual(plain(s), { slide: 0, shown: 1 });
  s = Steps.next(s, counts); assert.deepStrictEqual(plain(s), { slide: 0, shown: 2 });
  s = Steps.next(s, counts); assert.deepStrictEqual(plain(s), { slide: 1, shown: 0 });
  assert.deepStrictEqual(plain(Steps.next(s, counts)), { slide: 1, shown: 0 });
});

test('prev: 단계를 닫고, 없으면 이전 장을 다 펼친 채로', () => {
  const counts = [2, 1];
  let s = { slide: 1, shown: 1 };
  s = Steps.prev(s, counts); assert.deepStrictEqual(plain(s), { slide: 1, shown: 0 });
  s = Steps.prev(s, counts); assert.deepStrictEqual(plain(s), { slide: 0, shown: 2 });
  assert.deepStrictEqual(plain(Steps.prev({ slide: 0, shown: 0 }, counts)), { slide: 0, shown: 0 });
});

test('go: 범위를 벗어나면 끝으로 맞춘다', () => {
  assert.deepStrictEqual(plain(Steps.go(9, [1, 3], false)), { slide: 1, shown: 0 });
  assert.deepStrictEqual(plain(Steps.go(-2, [1, 3], true)), { slide: 0, shown: 1 });
});
