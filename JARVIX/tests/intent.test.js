'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(); const I = JX.intent;

test('classify', () => {
  for (const [t, k] of [['hi', 'greeting'], ['hello there!', 'greeting'], ['helo', 'greeting'], ['good morning', 'greeting'], ['thanks!', 'thanks'], ['bye', 'farewell'], ['why is the sky blue', 'question'], ['can you help me', 'question'], ['write a poem', 'instruction'], ['the sky is blue', 'statement']]) assert.equal(I.classify(t), k, t);
});
test('routes plain English to local tools', () => {
  const r = (t, c) => I.route(t, c);
  assert.equal(r('what time is it').command, 'time'); assert.equal(r('whats the date').command, 'date'); assert.equal(r('help').command, 'help');
  assert.deepEqual([r('add a task to buy milk').command, r('add a task to buy milk').args], ['todo', 'add buy milk']);
  assert.equal(r('show my tasks').args, 'list'); assert.equal(r('note that the wifi is down').command, 'note');
  assert.equal(r('calculate 7*6').command, 'calculate'); assert.equal(r('what is 12 times 12').command, 'calculate'); assert.equal(r('convert 10 miles to km').command, 'convert');
});
test('typo tolerance', () => { assert.equal(I.route('wat time is it').command, 'time'); assert.equal(I.route('calcualte 2+2').command, 'calculate'); });
test('does NOT hijack ordinary questions', () => {
  for (const t of ['what is 2024', 'what is the time complexity of quicksort', 'explain quantum computing', 'tell me about the time machine', 'how many times does 3 go into 12 and why', 'write me a note about my day', 'what is a task queue', 'hello']) assert.equal(I.route(t), null, t);
});
test('follow-up arithmetic uses the previous result', () => {
  assert.equal(I.route('times 3', { lastCalc: 42 }).args, 'ans times 3'); assert.equal(I.route('squared', { lastCalc: 5 }).args, 'ans^2'); assert.equal(I.route('times 3'), null);
});
test('slash input and long/multiline text are never routed', () => { assert.equal(I.route('/time'), null); assert.equal(I.route('a\nb'), null); assert.equal(I.route('x '.repeat(300)), null); });
test('hint is adaptive', () => { assert.match(I.hint('hi', false), /casual/); assert.match(I.hint('why is that?', true), /question/); assert.match(I.hint('and then?', true), /follow-up/); });
test('edit distance & nearest', () => { assert.equal(I.dist('kitten', 'sitting'), 3); assert.equal(I.nearest('sumarize', ['summarize', 'time'])[0].n, 'summarize'); assert.deepEqual(I.nearest('zzzzzz', ['summarize']), []); });
