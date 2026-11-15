'use strict';
/**
 * JARVIX server — zero dependencies.
 *  - serves the static frontend from /public
 *  - POST /api/chat        streaming (SSE) proxy to the configured AI provider
 *  - POST /api/test        one-shot connection test
 *  - GET  /api/status      what is configured (never returns secrets)
 *  - POST/DELETE /api/session-key   optional in-memory key (localhost only, never written to disk)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { registry } = require('./providers');
const { ProviderError } = require('./providers/shared');

const VERSION = require('../package.json').version;
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

function createServer(cfg = config.load(ROOT)) {
  /** keys pasted in the UI live here, in memory only */
  const sessionKeys = {};
  const buckets = new Map();

  const keyFor = (id) => sessionKeys[id] || cfg.providers[id].apiKey;
  const isConfigured = (id) => {
    const p = cfg.providers[id];
    if (!p) return false;
    if (id === 'compatible') return !!p.baseUrl;
    return !!keyFor(id);
  };
  const defaultProvider = () => {
    if (cfg.defaultProvider && registry[cfg.defaultProvider] && isConfigured(cfg.defaultProvider)) return cfg.defaultProvider;
    return Object.keys(registry).find(isConfigured) || null;
  };

  function json(res, status, obj, extra = {}) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
    res.end(body);
  }
  const fail = (res, err) => {
    const e = err instanceof ProviderError ? err : new ProviderError('upstream', 'Unexpected server error.', 500);
    if (e.status === 413 && !res.headersSent) res.setHeader('Connection', 'close');
    json(res, e.status || 500, { error: { code: e.code, message: e.message } });
  };

  function readBody(req, limit = 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0, over = false; const chunks = [];
      req.on('data', (c) => {
        if (over) return; // keep draining (without buffering) so the 413 response can be delivered cleanly
        size += c.length;
        if (size > limit) { over = true; chunks.length = 0; reject(new ProviderError('bad_request', 'Request body too large.', 413)); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (over) return;
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch { reject(new ProviderError('bad_request', 'Invalid JSON body.', 400)); }
      });
      req.on('error', reject);
    });
  }

  function sameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      const u = new URL(origin);
      return u.host === req.headers.host || cfg.allowedOrigins.includes(origin);
    } catch { return false; }
  }
  const isLoopback = (req) => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '');

  function rateLimited(req) {
    const ip = req.socket.remoteAddress || 'x';
    const now = Date.now();
    const b = buckets.get(ip) || { start: now, n: 0 };
    if (now - b.start > 60000) { b.start = now; b.n = 0; }
    b.n++; buckets.set(ip, b);
    return b.n > cfg.rateLimitPerMinute;
  }

  /** Validate + normalise a chat payload from the browser. */
  function parseChat(body) {
    const providerId = body.provider || defaultProvider();
    if (!providerId || !registry[providerId]) throw new ProviderError('not_configured', 'No AI provider is configured on the server.', 503);
    if (!isConfigured(providerId)) throw new ProviderError('not_configured', `Provider "${providerId}" is not configured on the server.`, 503);
    if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 200) throw new ProviderError('bad_request', 'messages must be a non-empty array.', 400);
    const messages = body.messages.map((m) => {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') throw new ProviderError('bad_request', 'Invalid message.', 400);
      if (m.content.length > 120000) throw new ProviderError('too_large', 'A message is too long (limit 120,000 characters). Shorten it and try again.', 413);
      return { role: m.role, content: m.content };
    });
    const pcfg = cfg.providers[providerId];
    let model = typeof body.model === 'string' && /^[\w.:\-/@]{1,120}$/.test(body.model) ? body.model : pcfg.model;
    if (!model) throw new ProviderError('bad_request', `No model set for "${providerId}". Set a model in Settings or in .env.`, 400);
    const num = (v, d, lo, hi) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, Number(v))) : d);
    return {
      providerId, model, messages,
      system: typeof body.system === 'string' ? body.system.slice(0, 30000) : '',
      temperature: num(body.temperature, 0.7, 0, 2),
      maxTokens: Math.round(num(body.maxTokens, 2048, 16, 16000)),
    };
  }

  const run = (p, signal) => registry[p.providerId].stream({
    cfg: cfg.providers[p.providerId], key: keyFor(p.providerId), messages: p.messages, system: p.system,
    model: p.model, temperature: p.temperature, maxTokens: p.maxTokens, signal, timeoutMs: cfg.timeoutMs,
  });

  async function handleChat(req, res) {
    const p = parseChat(await readBody(req));
    const ctl = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
    const it = run(p, ctl.signal)[Symbol.asyncIterator]();
    let first;
    try { first = await it.next(); } catch (err) { return fail(res, err); }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    const send = (o) => res.write('data: ' + JSON.stringify(o) + '\n\n');
    send({ meta: { provider: p.providerId, model: p.model } });
    const beat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
    try {
      let r = first;
      while (!r.done) { send({ delta: r.value }); r = await it.next(); }
      send({ done: true });
    } catch (err) {
      if (!ctl.signal.aborted) {
        // Only ProviderError messages are written for users; anything else (e.g. undici's "terminated") is an internal detail.
        const known = err instanceof ProviderError;
        send({ error: known ? { code: err.code, message: err.message } : { code: 'network', message: 'The connection to the AI provider was interrupted mid-reply.' } });
      }
    } finally { clearInterval(beat); res.end(); }
  }

  async function handleTest(req, res) {
    const body = await readBody(req);
    const p = parseChat({ ...body, messages: [{ role: 'user', content: 'Reply with the single word: ready' }], system: 'You are a connectivity test.', maxTokens: 24, temperature: 0 });
    const t0 = Date.now(); let text = '';
    for await (const d of run(p, undefined)) { text += d; if (text.length > 200) break; }
    json(res, 200, { ok: true, provider: p.providerId, model: p.model, latencyMs: Date.now() - t0, sample: text.trim().slice(0, 80) });
  }

  function status() {
    const def = defaultProvider();
    return {
      ok: true, version: VERSION,
      mode: def ? 'live' : 'demo',
      provider: def,
      model: def ? cfg.providers[def].model : null,
      providers: Object.keys(registry).map((id) => ({
        id, label: registry[id].label, configured: isConfigured(id),
        defaultModel: cfg.providers[id].model || '', fromSession: !!sessionKeys[id],
      })),
    };
  }

  async function handleApi(req, res, url) {
    if (req.method !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: { code: 'forbidden', message: 'Cross-origin request blocked.' } });
    if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, { ...status(), sessionKeyAllowed: isLoopback(req) });
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      if (rateLimited(req)) return json(res, 429, { error: { code: 'rate_limit', message: 'Too many requests. Slow down a moment.' } });
      return handleChat(req, res);
    }
    if (url.pathname === '/api/test' && req.method === 'POST') {
      if (rateLimited(req)) return json(res, 429, { error: { code: 'rate_limit', message: 'Too many requests.' } });
      return handleTest(req, res);
    }
    if (url.pathname === '/api/session-key') {
      if (!isLoopback(req)) return json(res, 403, { error: { code: 'forbidden', message: 'Session keys can only be set from the machine running JARVIX.' } });
      const body = req.method === 'DELETE' ? await readBody(req) : await readBody(req, 16 * 1024);
      const id = body.provider;
      if (!registry[id]) return json(res, 400, { error: { code: 'bad_request', message: 'Unknown provider.' } });
      if (req.method === 'POST') {
        if (typeof body.key !== 'string' || body.key.length < 8 || body.key.length > 400 || /\s/.test(body.key)) return json(res, 400, { error: { code: 'bad_request', message: 'That does not look like an API key.' } });
        sessionKeys[id] = body.key;
      } else if (req.method === 'DELETE') delete sessionKeys[id];
      else return json(res, 405, { error: { code: 'bad_request', message: 'Method not allowed.' } });
      return json(res, 200, status());
    }
    return json(res, 404, { error: { code: 'not_found', message: 'Unknown API route.' } });
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    if (rel.includes('\0')) { res.writeHead(400); return res.end(); }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(PUBLIC, rel));
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
        'Cache-Control': 'no-cache', 'Content-Security-Policy': CSP,
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
        'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      return serveStatic(req, res, url);
    } catch (err) {
      if (!res.headersSent) fail(res, err); else res.end();
    }
  });
  server.sessionKeys = sessionKeys;
  return server;
}

if (require.main === module) {
  const cfg = config.load(ROOT);
  const server = createServer(cfg);
  server.listen(cfg.port, cfg.host, () => {
    const configured = Object.keys(registry).filter((id) => (id === 'compatible' ? cfg.providers[id].baseUrl : cfg.providers[id].apiKey));
    console.log(`\n  JARVIX v${VERSION}  →  http://${cfg.host === '0.0.0.0' ? 'localhost' : cfg.host}:${cfg.port}`);
    console.log(configured.length
      ? `  AI provider(s) configured: ${configured.join(', ')}  (keys stay on the server)\n`
      : '  No AI provider configured → running in DEMO mode. Copy .env.example to .env to connect one.\n');
    if (cfg.host !== '127.0.0.1' && cfg.host !== 'localhost') console.log('  ⚠ Listening on a non-loopback address: anyone who can reach this port can use your API key.\n');
  });
}

module.exports = { createServer };
