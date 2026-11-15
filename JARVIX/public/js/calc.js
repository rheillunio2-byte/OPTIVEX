/* JARVIX — safe calculator. A real recursive-descent parser: no eval(), no Function(). */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});

  const CONST = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2 };
  const fact = (n) => {
    if (!Number.isInteger(n) || n < 0) throw new Error('Factorial needs a whole number ≥ 0.');
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const FUNCS = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc, sign: Math.sign,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp,
    fact, deg: (x) => (x * 180) / Math.PI, rad: (x) => (x * Math.PI) / 180,
    min: Math.min, max: Math.max, pow: Math.pow, mod: (a, b) => a % b, gcd,
    lcm: (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0),
    avg: (...a) => a.reduce((s, x) => s + x, 0) / a.length,
    root: (x, n) => Math.pow(x, 1 / n),
  };

  /** Turn friendly wording into symbols: "15% of 80", "6 times 7", "2 to the power of 8", "squared". */
  function normalize(src) {
    return String(src).toLowerCase()
      .replace(/[×✕·]/g, '*').replace(/[÷]/g, '/').replace(/[−–—]/g, '-').replace(/,(?=\d{3}(\D|$))/g, '')
      .replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*/g, '($1/100)*')
      .replace(/\bto the power of\b|\braised to\b|\bpower\b/g, '^')
      .replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3')
      .replace(/\bsquare root of\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)')
      .replace(/\b(multiplied by|times)\b/g, '*').replace(/\b(divided by|over)\b/g, '/')
      .replace(/\bplus\b/g, '+').replace(/\b(minus|less)\b/g, '-').replace(/\bmod(?:ulo)?\b(?!\()/g, '%%')
      .replace(/\bx\b(?=\s*\d|\s*\()/g, '*').replace(/(?<=\d)\s*x\s*(?=\d)/g, '*')
      .replace(/\s+/g, ' ').trim();
  }

  function tokenize(s) {
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (c === ' ') { i++; continue; }
      let m;
      if ((m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(s.slice(i)))) { i += m[0].length; if (s[i] === '.') throw new Error('Malformed number near "' + m[0] + '."'); t.push({ k: 'n', v: parseFloat(m[0]) }); continue; }
      if ((m = /^[a-z_][a-z0-9_]*/.exec(s.slice(i)))) { t.push({ k: 'id', v: m[0] }); i += m[0].length; continue; }
      if (s.startsWith('%%', i)) { t.push({ k: 'op', v: 'mod' }); i += 2; continue; }
      if (s.startsWith('**', i)) { t.push({ k: 'op', v: '^' }); i += 2; continue; }
      if ('+-*/^%!(),°'.includes(c)) { t.push({ k: 'op', v: c }); i++; continue; }
      throw new Error(`I don't understand “${c}” in that expression.`);
    }
    return t;
  }

  /**
   * Grammar:
   *  expr   := term (('+'|'-') term)*        (a trailing "10%" after + / - means 10% of the left side)
   *  term   := unary (('*'|'/'|'mod'|implicit) unary)*
   *  unary  := ('-'|'+') unary | power
   *  power  := postfix ('^' unary)?          (right-associative, binds tighter than unary minus: -2^2 = -4)
   *  postfix:= primary ('!'|'%'|'°')*
   */
  function evaluate(input, vars = {}) {
    const src = normalize(input);
    if (!src) throw new Error('Nothing to calculate.');
    const toks = tokenize(src); let p = 0;
    const peek = () => toks[p];
    const isOp = (v) => peek() && peek().k === 'op' && peek().v === v;
    let lastWasPercent = false;

    function expr() {
      let v = term();
      while (isOp('+') || isOp('-')) {
        const op = toks[p++].v;
        const start = p;
        let r = term();
        // "200 + 10%" => 220
        if (p - start === 2 && toks[p - 1].v === '%' && lastWasPercent) r = v * r;
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        if (isOp('*')) { p++; v *= unary(); }
        else if (isOp('/')) { p++; const d = unary(); if (d === 0) throw new Error('Division by zero is undefined.'); v /= d; }
        else if (isOp('mod') || isOp('%')) { p++; const d = unary(); if (d === 0) throw new Error('Modulo by zero is undefined.'); v %= d; }
        else if (peek() && (peek().k === 'n' || peek().k === 'id' || isOp('('))) v *= unary(); // implicit: 2pi, 3(4)
        else return v;
      }
    }
    function unary() {
      if (isOp('-')) { p++; return -unary(); }
      if (isOp('+')) { p++; return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (isOp('^')) { p++; return Math.pow(b, unary()); }
      return b;
    }
    function postfix() {
      let v = primary(); lastWasPercent = false;
      for (;;) {
        if (isOp('!')) { p++; v = fact(v); }
        else if (isOp('°')) { p++; v = (v * Math.PI) / 180; }
        else if (isOp('%') && !startsOperand(toks[p + 1])) { p++; v /= 100; lastWasPercent = true; }
        else return v;
      }
    }
    function startsOperand(t) { return t && (t.k === 'n' || t.k === 'id' || (t.k === 'op' && (t.v === '(' || t.v === '-'))); }
    function primary() {
      const t = toks[p++];
      if (!t) throw new Error('That expression looks incomplete.');
      if (t.k === 'n') return t.v;
      if (t.k === 'op' && t.v === '(') { const v = expr(); if (!isOp(')')) throw new Error('Missing closing parenthesis.'); p++; return v; }
      if (t.k === 'id') {
        if (Object.prototype.hasOwnProperty.call(vars, t.v)) return vars[t.v];
        if (Object.prototype.hasOwnProperty.call(CONST, t.v)) return CONST[t.v];
        if (Object.prototype.hasOwnProperty.call(FUNCS, t.v)) {
          if (!isOp('(')) throw new Error(`${t.v} needs parentheses, e.g. ${t.v}(9).`);
          p++; const args = [];
          if (!isOp(')')) { do { args.push(expr()); if (isOp(',')) p++; else break; } while (true); }
          if (!isOp(')')) throw new Error('Missing closing parenthesis.');
          p++;
          if (!args.length) throw new Error(`${t.v}() needs a value.`);
          return FUNCS[t.v](...args);
        }
        throw new Error(`I don't know “${t.v}”. Try numbers, + − × ÷ ^, %, and functions like sqrt() or sin().`);
      }
      throw new Error(`Unexpected “${t.v}”.`);
    }

    const result = expr();
    if (p < toks.length) throw new Error(`Unexpected “${toks[p].v}” — check the expression.`);
    if (Number.isNaN(result)) throw new Error('That has no real-number result.');
    return result;
  }

  function format(v) {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : 'undefined';
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toLocaleString('en-US');
    const a = Math.abs(v);
    if (a >= 1e15 || a < 1e-6) return Number(v.toPrecision(10)).toExponential().replace('e+', ' × 10^').replace('e-', ' × 10^-');
    return Number(v.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 10 });
  }

  JX.calc = { evaluate, format, normalize };
})();
