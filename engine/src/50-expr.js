// 순수 식 해석기: 계산 상자(.calc)와 그래프(.plot)가 쓴다. eval 없이 재귀 하강으로 읽어 함수로 바꾼다.
// 문법: 수, '글자', + - * / % ^, 비교, && || !, 조건 ? 가 : 나, 함수, 상수 pi e.
const EXPR_DEPTH = 200;

// 반올림은 절댓값 기준(-2.5 → -3). 1.005 같은 이진수 오차는 지수 표기로 피한다.
function exprRound(x, n) {
  const d = Math.trunc(Number(n) || 0);
  if (!Number.isFinite(x)) return x;
  const a = Math.abs(x);
  const r = Math.sign(x) * (/e/.test(String(a)) ? Math.round(a * 10 ** d) / 10 ** d
    : Number(`${Math.round(Number(`${a}e${d}`))}e${-d}`));
  return Object.is(r, -0) ? 0 : r;
}

const EXPR_FUNCS = Object.assign(Object.create(null), {
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, exp: Math.exp, sign: Math.sign,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  pow: Math.pow, ln: Math.log, log: (x, b) => (b == null ? Math.log10(x) : Math.log(x) / Math.log(b)),
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a),
  round: (x, n) => exprRound(x, n),
  rad: (d) => (d * Math.PI) / 180, deg: (r) => (r * 180) / Math.PI,
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  if: (c, a, b) => (c ? a : b),
  len: (s) => Array.from(String(s == null ? '' : s)).length,   // 글자 수
  fix: (x, n) => Expr.format(Number(x), Math.max(0, Math.min(10, Math.trunc(Number(n) || 0)))),
});
const EXPR_CONSTS = Object.assign(Object.create(null), { pi: Math.PI, e: Math.E, true: true, false: false });
// 객체 기본 속성 이름은 변수로 쓰지 못하게 막는다(엔진은 hasOwnProperty로만 찾지만 실수를 일찍 알린다).
const EXPR_BAD = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__']);
const EXPR_OPS = { '×': '*', '÷': '/', '−': '-', '≤': '<=', '≥': '>=', '≠': '!=' };

const Expr = {
  tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (num) { out.push({ t: 'num', v: Number(num[0]), at: i }); i += num[0].length; continue; }
      if (c === '"' || c === "'") {
        const end = src.indexOf(c, i + 1);
        if (end < 0) throw this.fail('글자를 닫는 따옴표가 없어요', i);
        out.push({ t: 'str', v: src.slice(i + 1, end), at: i });
        i = end + 1;
        continue;
      }
      const id = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
      if (id) { out.push({ t: 'id', v: id[0], at: i }); i += id[0].length; continue; }
      const two = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) { out.push({ t: 'op', v: two, at: i }); i += 2; continue; }
      if (EXPR_OPS[c]) { out.push({ t: 'op', v: EXPR_OPS[c], at: i }); i++; continue; }
      if ('+-*/%^!?:(),<>'.includes(c)) { out.push({ t: 'op', v: c, at: i }); i++; continue; }
      throw this.fail(`'${c}'는 식에 쓸 수 없어요`, i);
    }
    out.push({ t: 'end', v: '', at: src.length });
    return out;
  },

  fail(msg, at) {
    const err = new Error(msg);
    err.at = at;
    return err;
  },

  // src → { ok, fn(scope), vars, error, at }
  compile(src) {
    const vars = new Set();
    try {
      const toks = this.tokenize(String(src == null ? '' : src));
      let p = 0;
      let depth = 0;
      const peek = () => toks[p];
      const isOp = (v) => toks[p].t === 'op' && toks[p].v === v;
      const take = (v) => {
        if (!isOp(v)) throw this.fail(v === ')' ? '괄호가 닫히지 않았어요' : `'${v}'가 필요해요`, peek().at);
        p++;
      };
      const deeper = () => { if (++depth > EXPR_DEPTH) throw this.fail('식이 너무 깊어요', peek().at); };
      const binary = (next, ops, make) => () => {
        let left = next();
        while (peek().t === 'op' && ops.includes(peek().v)) {
          const op = toks[p++].v;
          const right = next();
          left = make(op, left, right);
        }
        return left;
      };
      const num = (v) => (typeof v === 'number' ? v : Number(v));
      const loose = (a, b) => {
        if (typeof a === 'string' && typeof b === 'string') return a === b;
        const x = num(a);
        const y = num(b);
        return Number.isNaN(x) || Number.isNaN(y) ? String(a) === String(b) : x === y;
      };
      const expr = () => {
        deeper();
        const cond = or();
        let out = cond;
        if (isOp('?')) {
          p++;
          const a = expr();
          take(':');
          const b = expr();
          out = (s) => (cond(s) ? a(s) : b(s));
        }
        depth--;
        return out;
      };
      const unary = () => {
        deeper();
        let out;
        if (isOp('-') || isOp('+') || isOp('!')) {
          const op = toks[p++].v;
          const arg = unary();
          out = op === '-' ? (s) => -num(arg(s)) : op === '+' ? (s) => num(arg(s)) : (s) => !arg(s);
        } else {
          const base = primary();
          if (isOp('^')) {
            p++;
            const ex = unary();
            out = (s) => Math.pow(num(base(s)), num(ex(s)));
          } else out = base;
        }
        depth--;
        return out;
      };
      const mul = binary(unary, ['*', '/', '%'], (op, l, r) => (op === '*' ? (s) => num(l(s)) * num(r(s))
        : op === '/' ? (s) => num(l(s)) / num(r(s)) : (s) => num(l(s)) % num(r(s))));
      const add = binary(mul, ['+', '-'], (op, l, r) => (op === '-' ? (s) => num(l(s)) - num(r(s)) : (s) => {
        const a = l(s);
        const b = r(s);
        if (typeof a === 'string' || typeof b === 'string') {
          return (typeof a === 'string' ? a : this.format(a)) + (typeof b === 'string' ? b : this.format(b));
        }
        return num(a) + num(b);
      }));
      const cmp = binary(add, ['<', '<=', '>', '>='], (op, l, r) => (s) => {
        const a = num(l(s));
        const b = num(r(s));
        return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
      });
      const eq = binary(cmp, ['==', '!='], (op, l, r) => (op === '==' ? (s) => loose(l(s), r(s)) : (s) => !loose(l(s), r(s))));
      const and = binary(eq, ['&&'], (op, l, r) => (s) => !!(l(s) && r(s)));
      const or = binary(and, ['||'], (op, l, r) => (s) => !!(l(s) || r(s)));
      const primary = () => {
        const tk = peek();
        if (tk.t === 'num' || tk.t === 'str') { p++; const v = tk.v; return () => v; }
        if (isOp('(')) { p++; const inner = expr(); take(')'); return inner; }
        if (tk.t === 'id') {
          p++;
          const name = tk.v;
          if (isOp('(')) {
            p++;
            const fn = EXPR_FUNCS[name];
            if (!fn) throw this.fail(`모르는 함수예요: ${name}`, tk.at);
            const args = [];
            if (!isOp(')')) {
              args.push(expr());
              while (isOp(',')) { p++; args.push(expr()); }
            }
            take(')');
            return (s) => fn(...args.map((a) => a(s)));
          }
          if (EXPR_BAD.has(name)) throw this.fail(`${name}은(는) 이름으로 쓸 수 없어요`, tk.at);
          if (name in EXPR_CONSTS) { const v = EXPR_CONSTS[name]; return () => v; }
          if (EXPR_FUNCS[name]) throw this.fail(`${name}은(는) 함수예요. ${name}( )처럼 써 주세요`, tk.at);
          vars.add(name);
          return (s) => {
            if (!Object.prototype.hasOwnProperty.call(s, name)) throw new Error(`모르는 이름이에요: ${name}`);
            return s[name];
          };
        }
        throw this.fail(tk.t === 'end' ? '식이 덜 끝났어요' : `여기에 '${tk.v}'가 올 수 없어요`, tk.at);
      };
      const root = expr();
      if (peek().t !== 'end') throw this.fail(`'${peek().v}' 앞에서 식이 끝나야 해요`, peek().at);
      return { ok: true, fn: root, vars: Array.from(vars), error: '', at: -1 };
    } catch (err) {
      return { ok: false, fn: null, vars: Array.from(vars), error: err.message, at: Number.isInteger(err.at) ? err.at : -1 };
    }
  },

  // 'a = 식; b = 식' → { ok, list: [{ name, fn, src }], error }. 따옴표 안의 ;는 나누지 않는다.
  lets(src) {
    const parts = [];
    let cur = '';
    let quote = '';
    for (const c of String(src || '')) {
      if (quote) { if (c === quote) quote = ''; cur += c; continue; }
      if (c === '"' || c === "'") quote = c;
      if (c === ';') { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    const list = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      const m = /^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)([\s\S]*)$/u.exec(part);
      if (!m) return { ok: false, list, error: `'이름 = 식' 꼴이 아니에요: ${part.trim()}` };
      const name = m[1];
      if (EXPR_BAD.has(name) || name in EXPR_CONSTS || EXPR_FUNCS[name]) return { ok: false, list, error: `${name}은(는) 이름으로 쓸 수 없어요` };
      const c = this.compile(m[2]);
      if (!c.ok) return { ok: false, list, error: `${name}: ${c.error}` };
      list.push({ name, fn: c.fn, src: m[2].trim(), vars: c.vars });
    }
    return { ok: true, list, error: '' };
  },

  // 화면 표시: digits가 있으면 그 자리까지, 없으면 소수 셋째 자리까지 쓰고 끝의 0을 지운다.
  format(v, digits) {
    if (typeof v === 'boolean') return v ? '참' : '거짓';
    if (typeof v === 'string') return v;
    const x = Number(v);
    if (!Number.isFinite(x)) return '?';
    if (Number.isInteger(digits) && digits >= 0) {
      const s = exprRound(x, digits).toFixed(digits);
      return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
    }
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e9 || a < 1e-3)) {
      const [m, ex] = x.toExponential(2).split('e');
      const sup = { '-': '⁻', '+': '', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
      return `${m.replace(/\.?0+$/, '')}×10${Array.from(ex).map((c) => sup[c]).join('')}`;
    }
    const r = exprRound(x, 3);
    return String(Object.is(r, -0) ? 0 : r);
  },
};

// 천 단위 쉼표(정수 부분만, ×10ⁿ 꼴은 그대로)
function groupDigits(text) {
  return /×/.test(text) ? text : text.replace(/^(-?)(\d{4,})/, (m, sign, int) => sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}
