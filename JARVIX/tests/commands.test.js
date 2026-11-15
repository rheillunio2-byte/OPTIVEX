'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(['commands']); const C = JX.commands;

const SPEC = ['help', 'clear', 'time', 'date', 'about', 'settings', 'history', 'summarize', 'rewrite', 'translate', 'write', 'ideas', 'explain', 'todo', 'note', 'document', 'code', 'debug', 'review', 'html', 'css', 'javascript', 'quiz', 'flashcards', 'study', 'define', 'compare', 'calculate', 'convert', 'count', 'random', 'password', 'theme', 'voice', 'animations'];
test('every advertised command exists with complete metadata', () => {
  for (const n of SPEC) { const c = C.find(n); assert.ok(c, n); for (const k of ['group', 'icon', 'summary', 'usage', 'run']) assert.ok(c[k], `${n}.${k}`); assert.ok(C.groups.includes(c.group), `${n} group`); }
});
test('names and aliases are unique', () => { const all = C.list.flatMap((c) => [c.name, ...c.aliases]); assert.equal(new Set(all).size, all.length); });
test('every AI command returns an AI request with its own system prompt', () => {
  for (const c of C.list.filter((x) => x.ai)) { const r = c.run('to French: test topic 3', {}); assert.ok(r.ai && r.ai.system && r.ai.prompt, c.name); assert.ok(!('md' in r) || r.ai, c.name); }
});
test('AI commands refuse empty input with usage (no empty provider call)', () => {
  for (const c of C.list.filter((x) => x.ai)) { const r = c.run('', {}); assert.ok(!r.ai && /Usage/i.test(r.md), c.name); }
});
test('quiz/flashcards prompts demand the exact fenced formats', () => { assert.match(C.find('quiz').run('x', {}).ai.system, /`quiz`/); assert.match(C.find('flashcards').run('x', {}).ai.system, /`flashcards`/); assert.match(C.find('flashcards').run('x', {}).ai.system, /::/); });
test('parse & resolve (typo tolerant)', () => {
  assert.deepEqual(C.parse('/Todo add x'), { name: 'todo', args: 'add x' }); assert.equal(C.parse('hello'), null); assert.equal(C.parse('/ x'), null);
  assert.equal(C.resolve('sumarize').cmd.name, 'summarize'); assert.equal(C.resolve('summarize').corrected, false); assert.equal(C.resolve('zzzzqq').cmd, null);
});
test('suggest ranks name matches first and handles empty query', () => { assert.equal(C.suggest('sum')[0].name, 'summarize'); assert.equal(C.suggest('').length, C.list.length); assert.equal(C.suggest('zzzzzz').length, 0); });
test('local commands that need no DOM behave', () => {
  assert.match(C.find('calculate').run('2+2', {}).md, /= 4/); assert.match(C.find('convert').run('1 km to m', {}).md, /1,?000/); assert.match(C.find('count').run('a b c', {}).md, /\| Words \| 3 \|/);
  assert.match(C.find('time').run('', {}).md, /UTC/); assert.match(C.find('date').run('', {}).md, /Day \*\*\d+\*\*/);
  assert.equal(C.session.lastCalc, 4);
});
test('/help lists every command', () => { const md = C.find('help').run('', {}).md; for (const c of C.list) assert.ok(md.includes('/' + c.name), c.name); });
