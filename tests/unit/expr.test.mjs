import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain } from './load.mjs';

const { Expr } = load(['00-core.js', '50-expr.js'], ['Expr']);
const run = (src, scope) => {
  const c = Expr.compile(src);
  assert.ok(c.ok, `${src}: ${c.error}`);
  return c.fn(scope || {});
};

test('사칙 우선순위와 괄호', () => {
  assert.equal(run('1 + 2 * 3'), 7);
  assert.equal(run('(1 + 2) * 3'), 9);
  assert.equal(run('10 - 4 - 3'), 3);
  assert.equal(run('7 % 4 + 8 / 2'), 7);
});

test('거듭제곱은 오른쪽부터, 단항 마이너스보다 먼저', () => {
  assert.equal(run('2^3^2'), 512);
  assert.equal(run('-2^2'), -4);
  assert.equal(run('2^-1'), 0.5);
  assert.equal(run('(-2)^2'), 4);
});

test('비교·논리·삼항', () => {
  assert.equal(run('3 > 2 && 2 >= 2'), true);
  assert.equal(run('1 == 2 || !(1 != 1)'), true);
  assert.equal(run('x < 1 ? "작다" : "크다"', { x: 0.5 }), '작다');
  assert.equal(run('a ? b ? 1 : 2 : 3', { a: 1, b: 0 }), 2);
});

test('유니코드 연산 기호(× ÷ − ≤ ≥ ≠)도 읽는다', () => {
  assert.equal(run('6 × 2 − 1'), 11);
  assert.equal(run('9 ÷ 3'), 3);
  assert.equal(run('2 ≤ 2 && 3 ≥ 4 == false && 1 ≠ 2'), true);
});

test('변수와 한글 이름', () => {
  assert.equal(run('삼투압 - 팽압', { 삼투압: 8, 팽압: 3 }), 5);
  assert.equal(run('v_2 * 2', { v_2: 1.5 }), 3);
});

test('함수와 상수', () => {
  assert.equal(run('max(1, 5, 3) + min(4, 2)'), 7);
  assert.equal(run('round(2.345, 2)'), 2.35);
  assert.equal(run('round(1.005, 2)'), 1.01);
  assert.equal(run('round(-2.5)'), -3);   // 반올림은 절댓값 기준
  assert.equal(run('sqrt(16) + abs(-2) + floor(2.7) + ceil(2.1)'), 11);
  assert.equal(run('log(1000)'), 3);
  assert.equal(run('ln(e)'), 1);
  assert.ok(Math.abs(run('sin(rad(30))') - 0.5) < 1e-12);
  assert.ok(Math.abs(run('deg(pi)') - 180) < 1e-12);
  assert.equal(run('clamp(15, 0, 10)'), 10);
  assert.equal(run('if(1 > 2, "가", "나")'), '나');
  assert.equal(run('fix(2, 1)'), '2.0');
  assert.equal(run('pow(2, 10)'), 1024);
});

test('글자와 + 하면 이어 붙인다', () => {
  assert.equal(run('"부피 " + v + "배"', { v: 1.1 }), '부피 1.1배');
  assert.equal(run("'가' == '가'"), true);
  assert.equal(run('sex == "여" && age >= 30', { sex: '여', age: 31 }), true);
});

test('숫자 글자와 숫자는 수로 비교한다', () => {
  assert.equal(run('year == 1918', { year: '1918' }), true);
});

test('0으로 나누면 무한, 표시는 ?', () => {
  assert.equal(run('1 / 0'), Infinity);
  assert.equal(Expr.format(run('1 / 0')), '?');
  assert.equal(Expr.format(run('0 / 0')), '?');
});

test('모르는 이름은 실행할 때 오류, 모르는 함수는 컴파일 오류', () => {
  const c = Expr.compile('y + 1');
  assert.ok(c.ok);
  assert.throws(() => c.fn({}), /y/);
  const bad = Expr.compile('foo(1)');
  assert.equal(bad.ok, false);
  assert.match(bad.error, /foo/);
});

test('프로토타입 이름(__proto__, constructor, toString)은 변수로 쓸 수 없다', () => {
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const c = Expr.compile(name);
    if (c.ok) assert.throws(() => c.fn({}), new RegExp(name));
    else assert.match(c.error, /쓸 수 없|모르는/);
  }
  assert.equal(Expr.compile('constructor(1)').ok, false);
});

test('문법 오류는 위치를 알려 준다', () => {
  const c = Expr.compile('1 + * 2');
  assert.equal(c.ok, false);
  assert.equal(c.at, 4);
  assert.equal(Expr.compile('(1 + 2').ok, false);
  assert.equal(Expr.compile('1 2').ok, false);
  assert.equal(Expr.compile('"닫지 않은 글자').ok, false);
  assert.equal(Expr.compile('').ok, false);
});

test('너무 깊은 식은 거부한다', () => {
  assert.equal(Expr.compile('('.repeat(300) + '1' + ')'.repeat(300)).ok, false);
  assert.equal(Expr.compile('-'.repeat(300) + '1').ok, false);
  assert.ok(Expr.compile('('.repeat(50) + '1' + ')'.repeat(50)).ok);
});

test('쓰인 변수 목록', () => {
  assert.deepStrictEqual(plain(Expr.compile('a + b * max(a, c) + pi').vars).sort(), ['a', 'b', 'c']);
});

test('lets: 이름 = 식; 을 차례로 나눈다', () => {
  const r = Expr.lets('o = 8.7 / v; t = v <= 1 ? 0 : 2; s = o - t; msg = "a;b"');
  assert.ok(r.ok, r.error);
  assert.deepStrictEqual(plain(r.list.map((x) => x.name)), ['o', 't', 's', 'msg']);
  const scope = { v: 1.2 };
  for (const { name, fn } of r.list) scope[name] = fn(scope);
  assert.equal(scope.t, 2);
  assert.equal(scope.msg, 'a;b');
  assert.equal(Expr.lets('1x = 2').ok, false);
  assert.equal(Expr.lets('a == 2').ok, false);
  assert.equal(Expr.lets('pi = 3').ok, false);
  assert.ok(Expr.lets('').ok);
});

test('format: 자릿수, -0, 큰 수와 작은 수, 참·거짓', () => {
  assert.equal(Expr.format(2.34567), '2.346');
  assert.equal(Expr.format(2.5), '2.5');
  assert.equal(Expr.format(3), '3');
  assert.equal(Expr.format(-0), '0');
  assert.equal(Expr.format(-0.0004, 2), '0.00');
  assert.equal(Expr.format(1.25, 1), '1.3');
  assert.equal(Expr.format(1830), '1830');
  assert.equal(Expr.format(6.02e23), '6.02×10²³');
  assert.equal(Expr.format(1.6e-19), '1.6×10⁻¹⁹');
  assert.equal(Expr.format(true), '참');
  assert.equal(Expr.format(1e-7, 2), '0.00');
  assert.equal(run('round(0.0000001234, 9)'), 1.23e-7);
  assert.equal(Expr.format('글자'), '글자');
});
