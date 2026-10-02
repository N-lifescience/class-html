import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './load.mjs';

test('core는 clamp와 버전 문자열을 내놓는다', () => {
  const { clamp, ClassHTML } = load(['00-core.js'], ['clamp', 'ClassHTML']);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(ClassHTML.version, 'dev');
});
