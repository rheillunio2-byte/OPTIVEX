'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const http = require('node:http'); const os = require('node:os'); const fs = require('node:fs'); const path = require('node:path');
const config = require('../server/config'); const { createServer } = require('../server/server');

/* ---- fake upstream that speaks both Anthropic and OpenAI dialects ---- */
function upstream() {
  const seen = []; let aborted = 0;
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const j = b ? JSON.parse(b) : {}; seen.push({ url: req.url, headers: req.headers, body: j });
      const last = (j.messages || []).slice(-1)[0]?.content || '';
      if (/BAD401/.test(last)) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":{"message":"invalid key sk-LEAKEDSECRET1234567890"}}'); }
      if (/BAD429/.test(last)) { res.writeHead(429); return res.end('{}'); }
      if (/BAD500/.test(last)) { res.writeHead(500); return res.end('boom'); }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const parts = /LONG/.test(last) ? Array.from({ length: 400 }, (_, i) => `w${i} `) : ['Hel', 'lo ', 'there'];
      const anth = req.url.startsWith('/v1/messages'); let i = 0;
      const t = setInterval(() => {
        if (i >= parts.length) { clearInterval(t); res.write(anth ? 'event: message_stop\ndata: {"type":"message_stop"}\n\n' : 'data: [DONE]\n\n'); return res.end(); }
        const d = parts[i++];
        res.write(anth ? `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: d } })}\n\n` : `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`);
      }, 10);
      res.on('close', () => { clearInterval(t); if (i < parts.length) aborted++; });
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, seen, aborted: () => aborted })));
}
function app(env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jx-'));
  const old = { ...process.env }; for (const k of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'JARVIX_BASE_URL', 'JARVIX_API_KEY', 'JARVIX_PROVIDER']) delete process.env[k];
  Object.assign(process.env, env); const cfg = config.load(root); cfg.port = 0; Object.keys(process.env).forEach((k) => { if (!(k in old)) delete process.env[k]; }); Object.assign(process.env, old);
  const server = createServer(cfg);
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((x) => { server.closeAllConnections?.(); server.close(x); }) })));
}
const post = (base, p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
async function readSSE(res) { const out = []; const txt = await res.text(); for (const blk of txt.split('\n\n')) if (blk.startsWith('data:')) out.push(JSON.parse(blk.slice(5))); return out; }
const chat = (content, extra = {}) => ({ messages: [{ role: 'user', content }], ...extra });

test('demo mode: status reports no secrets, chat refuses cleanly', async () => {
  const a = await app({}); try {
    const s = await (await fetch(a.base + '/api/status')).json(); assert.equal(s.mode, 'demo'); assert.equal(s.provider, null);
    const r = await post(a.base, '/api/chat', chat('hi')); assert.equal(r.status, 503); assert.equal((await r.json()).error.code, 'not_configured');
  } finally { await a.close(); }
});

test('anthropic: streams meta → deltas → done, sends key only upstream', async () => {
  const u = await upstream(); const a = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: `http://127.0.0.1:${u.port}` }); try {
    const st = await (await fetch(a.base + '/api/status')).json(); assert.equal(st.mode, 'live'); assert.equal(st.provider, 'anthropic'); assert.ok(!JSON.stringify(st).includes('sk-test'));
    const res = await post(a.base, '/api/chat', chat('hi', { system: 'SYS', temperature: 0.2, maxTokens: 100 })); assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const ev = await readSSE(res); assert.ok(ev[0].meta && ev[0].meta.provider === 'anthropic'); assert.equal(ev.filter((e) => e.delta).map((e) => e.delta).join(''), 'Hello there'); assert.ok(ev.at(-1).done);
    const up = u.seen[0]; assert.equal(up.headers['x-api-key'], 'sk-test-123456'); assert.equal(up.body.system, 'SYS'); assert.equal(up.body.stream, true); assert.equal(up.body.max_tokens, 100);
  } finally { await a.close(); u.srv.close(); }
});

test('openai-compatible: parses chat-completions SSE and [DONE]', async () => {
  const u = await upstream(); const a = await app({ JARVIX_BASE_URL: `http://127.0.0.1:${u.port}/v1`, JARVIX_MODEL: 'local-model' }); try {
    const ev = await readSSE(await post(a.base, '/api/chat', chat('hi'))); assert.equal(ev.filter((e) => e.delta).map((e) => e.delta).join(''), 'Hello there'); assert.ok(ev.at(-1).done);
    assert.equal(u.seen[0].body.model, 'local-model'); assert.ok(u.seen[0].url.includes('/chat/completions'));
  } finally { await a.close(); u.srv.close(); }
});

test('upstream failures map to safe, non-leaky errors', async () => {
  const u = await upstream(); const a = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: `http://127.0.0.1:${u.port}` }); try {
    for (const [word, status, code] of [['BAD401', 401, 'auth'], ['BAD429', 429, 'rate_limit'], ['BAD500', 502, 'upstream']]) {
      const r = await post(a.base, '/api/chat', chat(word)); const body = await r.text(); assert.equal(r.status, status, word); assert.ok(body.includes(`"${code}"`), body); assert.ok(!/LEAKEDSECRET|sk-test-123456/.test(body), 'secret leaked: ' + body);
    }
  } finally { await a.close(); u.srv.close(); }
});

test('client disconnect aborts the upstream request', async () => {
  const u = await upstream(); const a = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: `http://127.0.0.1:${u.port}` }); try {
    const ctl = new AbortController(); const r = await post(a.base, '/api/chat', chat('LONG'), {}).catch(() => null);
    const res = await fetch(a.base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chat('LONG')), signal: ctl.signal });
    const reader = res.body.getReader(); await reader.read(); await reader.read(); ctl.abort(); await new Promise((x) => setTimeout(x, 400));
    assert.ok(u.aborted() >= 1, 'upstream stream should have been cut');
  } finally { await a.close(); u.srv.close(); }
});

test('input validation', async () => {
  const u = await upstream(); const a = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: `http://127.0.0.1:${u.port}` }); try {
    for (const [body, st] of [['{nope', 400], [{ messages: [] }, 400], [{ messages: [{ role: 'system', content: 'x' }] }, 400], [{ messages: [{ role: 'user', content: 5 }] }, 400], [{ messages: [{ role: 'user', content: 'x'.repeat(130000) }] }, 413], [{ messages: Array(201).fill({ role: 'user', content: 'x' }) }, 400], [{ messages: [{ role: 'user', content: 'x' }], provider: 'nope' }, 503]]) assert.equal((await post(a.base, '/api/chat', body)).status, st, JSON.stringify(body).slice(0, 60));
    assert.equal((await post(a.base, '/api/chat', 'x'.repeat(3 * 1024 * 1024)).catch(() => ({ status: 413 }))).status, 413);
    const r = await post(a.base, '/api/chat', chat('hi', { model: 'bad model; rm -rf' })); await r.text(); assert.ok(!/rm -rf/.test(JSON.stringify(u.seen.at(-1)?.body?.model))); // model name is sanitised
  } finally { await a.close(); u.srv.close(); }
});

test('same-origin policy and security headers', async () => {
  const a = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: 'http://127.0.0.1:1' }); try {
    assert.equal((await post(a.base, '/api/chat', chat('hi'), { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(a.base, '/api/session-key', { provider: 'openai', key: 'sk-x1234567890' }, { Origin: 'https://evil.example' })).status, 403);
    const r = await fetch(a.base + '/'); for (const h of ['content-security-policy', 'x-content-type-options', 'referrer-policy']) assert.ok(r.headers.get(h), h); assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  } finally { await a.close(); }
});

test('static files: SPA assets served, traversal and dotfiles blocked', async () => {
  const a = await app({}); try {
    assert.equal((await fetch(a.base + '/index.html')).status, 200); assert.equal((await fetch(a.base + '/js/util.js')).status, 200);
    for (const p of ['/../package.json', '/%2e%2e/package.json', '/..%2fserver/config.js', '/js/../../.env', '/.env', '/.git/config', '/server/config.js', '/%00']) { const r = await fetch(a.base + p); const t = await r.text(); assert.ok(r.status !== 200 || !/"scripts"|ANTHROPIC_API_KEY|JARVIX_TIMEOUT/.test(t), p); }
    assert.equal((await fetch(a.base + '/api/nope')).status, 404);
  } finally { await a.close(); }
});

test('session key: memory only, validated, usable, clearable, never echoed', async () => {
  const u = await upstream(); const a = await app({ ANTHROPIC_BASE_URL: `http://127.0.0.1:${u.port}` }); try {
    assert.equal((await post(a.base, '/api/chat', chat('hi'))).status, 503);
    assert.equal((await post(a.base, '/api/session-key', { provider: 'anthropic', key: 'short' })).status, 400);
    assert.equal((await post(a.base, '/api/session-key', { provider: 'anthropic', key: 'sk-session-abcdef123456' })).status, 200);
    const st = await (await fetch(a.base + '/api/status')).json(); assert.equal(st.mode, 'live'); assert.ok(!JSON.stringify(st).includes('sk-session'));
    await (await post(a.base, '/api/chat', chat('hi'))).text(); assert.equal(u.seen.at(-1).headers['x-api-key'], 'sk-session-abcdef123456');
    const del = await fetch(a.base + '/api/session-key', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'anthropic' }) }); assert.equal(del.status, 200);
    assert.equal((await post(a.base, '/api/chat', chat('hi'))).status, 503);
  } finally { await a.close(); u.srv.close(); }
});

test('/api/test verifies the connection and reports failures safely', async () => {
  const u = await upstream(); const a = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: `http://127.0.0.1:${u.port}` }); try {
    const ok = await post(a.base, '/api/test', {}); assert.equal(ok.status, 200); const j = await ok.json(); assert.ok(j.ok);
  } finally { await a.close(); u.srv.close(); }
  const a2 = await app({ ANTHROPIC_API_KEY: 'sk-test-123456', ANTHROPIC_BASE_URL: 'http://127.0.0.1:1' }); try { const r = await post(a2.base, '/api/test', {}); assert.ok(r.status >= 400); assert.ok(!(await r.text()).includes('sk-test')); } finally { await a2.close(); }
});

test('rate limiting kicks in', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jx-')); process.env.JARVIX_RATE_LIMIT = '5'; const cfg = config.load(root); delete process.env.JARVIX_RATE_LIMIT; const s = createServer(cfg);
  await new Promise((r) => s.listen(0, '127.0.0.1', r)); const base = `http://127.0.0.1:${s.address().port}`;
  try { const codes = []; for (let i = 0; i < 9; i++) codes.push((await post(base, '/api/chat', chat('x'))).status); assert.ok(codes.includes(429), codes.join()); } finally { s.closeAllConnections?.(); s.close(); }
});

test('config: .env parsing, quotes, comments, defaults; env wins over file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jx-')); fs.writeFileSync(path.join(root, '.env'), '# c\nANTHROPIC_API_KEY="sk-from-file-1234"\nPORT=4567\nJARVIX_TIMEOUT_MS = 1234\nBROKEN LINE\n');
  const keep = { ...process.env }; delete process.env.ANTHROPIC_API_KEY; delete process.env.PORT; delete process.env.JARVIX_TIMEOUT_MS;
  const c = config.load(root); assert.equal(c.providers.anthropic.apiKey, 'sk-from-file-1234'); assert.equal(c.port, 4567); assert.equal(c.timeoutMs, 1234); assert.equal(c.host, '127.0.0.1');
  process.env.PORT = '9999'; assert.equal(config.load(root).port, 9999); Object.keys(process.env).forEach((k) => { if (!(k in keep)) delete process.env[k]; }); Object.assign(process.env, keep);
});
