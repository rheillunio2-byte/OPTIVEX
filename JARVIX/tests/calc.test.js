'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(); const ev = (s, o) => JX.calc.evaluate(s, o);

test('arithmetic & precedence', () => {
  assert.equal(ev('2+3*4'), 14); assert.equal(ev('(2+3)*4'), 20); assert.equal(ev('2^3^2'), 512); assert.equal(ev('-2^2'), -4);
  assert.equal(ev('10/4'), 2.5); assert.equal(ev('7%3'), 1); assert.equal(ev('2×3÷6'), 1);
});
test('percent semantics', () => {
  assert.equal(ev('200+10%'), 220); assert.equal(ev('200-10%'), 180); assert.equal(JX.calc.format(ev('18% of 240')), '43.2'); assert.equal(ev('50%'), 0.5);
});
test('functions & constants', () => {
  assert.equal(ev('sqrt(144)'), 12); assert.equal(ev('abs(-5)'), 5); assert.equal(ev('max(1,9,3)'), 9); assert.equal(ev('5!'), 120);
  assert.ok(Math.abs(ev('pi') - Math.PI) < 1e-12); assert.ok(Math.abs(ev('sin(30°)') - 0.5) < 1e-9);
});
test('ans and implicit values', () => { assert.equal(ev('ans*3', { ans: 42 }), 126); });
test('errors are reported, never thrown as non-Errors', () => {
  for (const bad of ['1/0', '2+', '(1+2', 'foo(1)', '', '1..2', '"x"']) assert.throws(() => ev(bad), Error, bad);
});
test('no code execution surface (no eval / Function)', () => {
  for (const evil of ['process.exit()', 'constructor.constructor("return 1")()', 'globalThis', '__proto__', 'require("fs")', 'alert(1)']) assert.throws(() => ev(evil), Error, evil);
  const src = require('fs').readFileSync(require('path').resolve(__dirname, '../public/js/calc.js'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/\beval\s*\(|new Function|Function\s*\(/.test(src));
});
test('formatting', () => { assert.equal(JX.calc.format(1012), '1,012'); assert.equal(JX.calc.format(0.1 + 0.2), '0.3'); });
