// Mock Anthropic Messages API used ONLY by the e2e tests (no real network, no real key).
// Behaviour is chosen by magic words in the last user message: FAIL429, SLOW, MARKDOWN; valid key is "sk-mock".
const http = require('http');
let log = [];
http.createServer((req, res) => {
  if (req.url === '/__log') { res.end(JSON.stringify(log)); return; }
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    const j = JSON.parse(b || '{}'); const last = (j.messages || []).slice(-1)[0] || { content: '' };
    log.push({ key: req.headers['x-api-key'], n: j.messages.length, system: (j.system || '').slice(0, 4000), last: last.content, roles: j.messages.map((m) => m.role) });
    if (req.headers['x-api-key'] !== 'sk-mock') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'invalid x-api-key' } })); }
    if (last.content.trim() === 'FAIL429 now') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'rate limited' } })); }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    let text = /SLOW/.test(last.content) ? Array.from({ length: 200 }, (_, i) => `word${i} `) : null;
    if (!text) {
      if (/```quiz|quiz/i.test(j.system || '') && /quiz/i.test(last.content)) text = ['Here is your quiz:\n\n```quiz\nQ1: 2+2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B\nWhy: basic maths\n\nQ2: Capital of France?\nA) Rome\nB) Paris\nC) Madrid\nD) Berlin\nAnswer: B\nWhy: it is Paris\n```'];
      else if (/flashcards/i.test(j.system || '')) text = ['Cards:\n\n```flashcards\nhola :: hello\nadios :: goodbye\n```'];
      else if (/MARKDOWN/.test(last.content)) text = ['# Title\n\nSome **bold** and `code`.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```python\ndef f(x):\n    return x * 2  # double\n```\n\nMath: $E=mc^2$\n'];
      else text = [`Echo(${j.messages.length} msgs): `, ...String(last.content).split(' ').map((w) => w + ' ')];
    }
    let i = 0; const t = setInterval(() => {
      if (i >= text.length) { clearInterval(t); res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n'); return res.end(); }
      res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: text[i++] } })}\n\n`);
    }, /SLOW/.test(last.content) ? 60 : 15);
    res.on('close', () => clearInterval(t));
  });
}).listen(process.env.MOCK_PORT || 4010, '127.0.0.1', () => console.log('mock up'));
