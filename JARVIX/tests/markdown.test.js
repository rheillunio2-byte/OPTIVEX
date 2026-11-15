'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { loadJX } = require('./helpers/load'); const JX = loadJX(); const md = (s, o) => JX.markdown.render(s, o);

test('escapes raw HTML (XSS)', () => {
  for (const x of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', '<iframe src="javascript:alert(1)">', '**<b onclick=x>**']) {
    const h = md(x); assert.ok(!/<script|<img|<svg|<iframe|onerror=|onload=|onclick=/i.test(h.replace(/&lt;[^&]*&gt;/g, '')), x + ' → ' + h);
  }
});
test('only safe URL schemes become links', () => {
  assert.ok(/href="https:\/\/example\.com"/.test(md('[a](https://example.com)')));
  for (const u of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', ' JaVaScRiPt:alert(1)']) assert.ok(!/href="\s*(javascript|data|vbscript)/i.test(md(`[x](${u})`)), u);
  assert.ok(/rel="[^"]*noopener/.test(md('[a](https://example.com)')));
});
test('block structures render', () => {
  const h = md('# T\n\n- a\n- b\n\n1. x\n2. y\n\n> q\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n---');
  for (const re of [/<h1/, /<ul/, /<ol/, /<blockquote/, /<table/, /<hr/, /type="checkbox"|class="task/]) assert.match(h, re);
});
test('inline formatting', () => { const h = md('**b** *i* ~~s~~ `c`'); for (const re of [/<strong>b/, /<em>i/, /<del>s|<s>s/, /<code[^>]*>c/]) assert.match(h, re); });
test('code blocks: highlight, copy, escaping, no blank-line gaps', () => {
  const h = md('```js\nconst a = "<b>";\nreturn a;\n```');
  assert.match(h, /data-copy-code/); assert.match(h, /tk-/); assert.ok(!h.includes('<b>')); assert.equal((h.match(/class="ln"/g) || []).length, 2);
  assert.ok(!/<\/span>\n<span class="ln"/.test(h), 'lines must not be separated by newlines inside <pre>');
});
test('math (LaTeX-lite) renders and escapes', () => { assert.match(md('$E=mc^2$'), /<sup>/); assert.ok(!/<script/.test(md('$<script>$'))); });
test('quiz and flashcards blocks become interactive widgets', () => {
  const q = md('```quiz\nQ1: 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B\nWhy: math\n```'); assert.match(q, /class="qz/); assert.match(q, /data-ans="B"/);
  const f = md('```flashcards\nhola :: hello\nadios :: bye\n```'); assert.match(f, /fc-deck/);
});
test('slash commands become chips only when asked', () => { assert.match(md('try `/help` now', { chips: true }), /cmd-chip/); assert.ok(!/cmd-chip/.test(md('try `/help` now', { chips: false }))); });
test('streaming (unclosed fence) does not throw and shows partial code', () => { assert.doesNotThrow(() => md('```py\nprint(1)', { streaming: true })); assert.match(md('```py\nprint(1)', { streaming: true }), /print/); });
test('pathological input stays fast', () => { const t = Date.now(); md('*'.repeat(20000) + '`'.repeat(5000) + '['.repeat(5000)); md(('| a '.repeat(500) + '|\n').repeat(50)); assert.ok(Date.now() - t < 2000); });
