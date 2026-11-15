'use strict';
/* A tiny OpenAI-compatible streaming server used ONLY by the tests. It records every request so tests can assert what JARVIX sent. */
const http = require('http');

function start(port = 4010) {
  const log = [];
  const sse = (res, obj) => res.write('data: ' + JSON.stringify(obj) + '\n\n');
  const chunk = (t) => ({ choices: [{ delta: { content: t } }] });
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/_log') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(log)); }
    if (req.method === 'POST' && req.url === '/_reset') { log.length = 0; return res.end('ok'); }
    if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) { res.statusCode = 404; return res.end('nope'); }
    let raw = ''; req.on('data', (d) => (raw += d));
    req.on('end', () => {
      const body = JSON.parse(raw || '{}'); log.push(body);
      const msgs = body.messages || []; const sys = (msgs.find((m) => m.role === 'system') || {}).content || '';
      const last = msgs.filter((m) => m.role === 'user').pop() || { content: '' }; const text = String(last.content).split('\n\n').pop(); // errored turns are merged into the next user message; only the newest paragraph drives behaviour
      if (/FAIL401/.test(text)) { res.statusCode = 401; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ error: { message: 'Incorrect API key provided: sk-secret-should-not-leak' } })); }
      if (/FAIL429/.test(text)) { res.statusCode = 429; res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ error: { message: 'Rate limit' } })); }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      let parts;
      if (/language tag is `quiz`/.test(sys)) parts = ['Here is a quick quiz:\n\n```quiz\nQ1: What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 22\nAnswer: B\nWhy: Basic addition.\n\nQ2: Capital of France?\nA) Paris\nB) Rome\nC) Madrid\nD) Berlin\nAnswer: A\nWhy: Paris is the capital.\n```\n'];
      else if (/language tag is `flashcards`/.test(sys)) parts = ['Cards:\n\n```flashcards\nhola :: hello\nadiós :: goodbye\ngracias :: thank you\n```\n'];
      else if (/HALFDIE/.test(text)) parts = ['Partial answer that '];
      else if (/SLOW/.test(text)) parts = Array.from({ length: 80 }, (_, i) => `word${i} `);
      else parts = (`**Mock reply** to: ${text.slice(0, 60)}\n\n- history messages: ${msgs.filter((m) => m.role !== 'system').length}\n- system: ${sys.includes('JARVIX') ? 'yes' : 'no'}\n\n\`\`\`js\nconsole.log("hi");\n\`\`\`\n`).match(/[\s\S]{1,14}/g);
      let i = 0; const delay = /SLOW/.test(text) ? 120 : 8;
      const timer = setInterval(() => {
        if (res.destroyed) return clearInterval(timer);
        if (i < parts.length) return sse(res, chunk(parts[i++]));
        clearInterval(timer);
        if (/HALFDIE/.test(text)) return res.destroy();
        res.write('data: [DONE]\n\n'); res.end();
      }, delay);
      res.on('close', () => clearInterval(timer));
    });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r({ server, log, port })));
}
module.exports = { start };
if (require.main === module) start().then((m) => console.log('mock upstream on', m.port));
