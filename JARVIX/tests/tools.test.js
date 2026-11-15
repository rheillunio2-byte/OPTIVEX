'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(); const T = JX.tools;

test('count', () => { const c = T.count('Hello world. Second one!\n\nNew para'); assert.equal(c.words, 6); assert.equal(c.paragraphs, 2); assert.equal(c.sentences, 3); assert.equal(T.count('').words, 0); });
test('random: ranges, dice, coin, pick, shuffle, uuid', () => {
  for (let i = 0; i < 200; i++) { const m = /(\d+)/.exec(T.random('5 10')); const n = +m[1]; assert.ok(n >= 5 && n <= 10 || /5 to 10/.test(T.random('5 10'))); }
  assert.match(T.random('dice 3d6'), /3d6/); assert.match(T.random('coin'), /Heads|Tails/); assert.match(T.random('pick a, b, c'), /picked from 3/);
  const sh = T.random('shuffle a,b,c,d'); assert.ok(['a', 'b', 'c', 'd'].every((x) => sh.includes(x)));
  assert.match(T.random('uuid'), /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/);
  assert.throws(() => T.random('dice 0d6')); assert.match(T.random('10 1'), /between 1 and 10/); assert.throws(() => T.random('abc'));
});
test('password: length, classes, options, bounds, uniqueness', () => {
  const body = (r) => /```[^\n]*\n([^\n]+)\n```/.exec(r.md)[1];
  const p = body(T.password('32')); assert.equal(p.length, 32); assert.match(p, /[a-z]/); assert.match(p, /[A-Z]/); assert.match(p, /[0-9]/); assert.match(p, /[^A-Za-z0-9]/);
  assert.match(body(T.password('40 nosymbols')), /^[A-Za-z0-9]+$/); assert.match(body(T.password('40 nonumbers nosymbols noupper')), /^[a-z]+$/);
  assert.equal(new Set(Array.from({ length: 50 }, () => body(T.password('24')))).size, 50);
  assert.throws(() => T.password('24 nolower noupper nonumbers nosymbols'));
  assert.ok(body(T.password('9999')).length <= 128);
});
test('summarize picks sentences from the text', () => { const t = 'Cats sleep a lot. Dogs bark. Cats are small mammals that sleep many hours. The weather is fine. Cats purr when happy.'; const s = T.summarize(t); assert.ok(s.length < t.length && /Cats/.test(s)); });
test('tidy fixes spacing/capitals/typos', () => { assert.equal(T.tidy('hello   i am  teh best'), 'Hello I am the best.'); });
test('quiz/flashcards builders need valid pairs', () => {
  const ps = T.pairs('France: Paris\nGermany: Berlin\nItaly: Rome\nSpain: Madrid'); assert.equal(ps.length, 4);
  const q = T.quizFromPairs(ps); assert.match(q, /```quiz/); assert.equal((q.match(/Answer: [A-D]/g) || []).length, 4); assert.match(T.flashFromPairs(ps), /France :: Paris/);
  for (const m of q.matchAll(/Q\d+:[^\n]+\nA\) ([^\n]+)\nB\) ([^\n]+)\nC\) ([^\n]+)\nD\) ([^\n]+)\nAnswer: ([A-D])/g)) assert.equal(new Set([m[1], m[2], m[3], m[4]]).size, 4);
});
