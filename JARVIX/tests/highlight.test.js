'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(); const H = globalThis.JX.markdown.render;
for (const [lang, code] of [['js', 'const a = 1; // c\nfunction f(){return "s"}'], ['python', 'def f(x):\n  return x # c'], ['json', '{"a": [1, true, null]}'], ['html', '<div class="a">x</div>'], ['css', '.a { color: #fff; }'], ['sql', 'SELECT * FROM t WHERE a = 1;'], ['bash', 'echo "hi" | grep h']]) {
  test(`highlights ${lang} and never leaks raw markup`, () => { const h = H('```' + lang + '\n' + code + '\n```'); assert.match(h, /tk-/); assert.ok(!/<div class="a">/.test(h)); });
}
test('unknown language falls back to escaped plain text', () => { const h = H('```zzz\n<b>x</b>\n```'); assert.ok(!h.includes('<b>x')); assert.match(h, /&lt;b&gt;/); });
