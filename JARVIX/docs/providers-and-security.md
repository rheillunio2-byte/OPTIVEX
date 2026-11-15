# AI providers & security

## Why a proxy?
Browsers cannot hold secrets. JARVIX's front end only ever calls its own `/api/*`; keys are read from `.env` by the Node process. `GET /api/status` reports *whether* a provider is configured, never the key or the upstream URL.

## Adding a provider
Create `server/providers/myprovider.js`:

```js
module.exports = {
  id: 'myprovider', label: 'My Provider',
  async *stream({ cfg, key, messages, system, model, temperature, maxTokens, signal, timeoutMs }) {
    // call the API, parse its stream, then:  yield 'some text';
  },
};
```
Register it in `server/providers/index.js`, add its settings block in `server/config.js`, and document the variables in `.env.example`. Helpers in `providers/shared.js` (`guardedFetch`, `sseEvents`, `normalizeMessages`, `upstreamError`) handle timeouts, abort propagation, SSE parsing and error mapping.

## Hardening in place
- Strict CSP (`default-src 'self'`, `frame-ancestors 'none'`), `nosniff`, no-referrer.
- Same-origin check on all non-GET API calls (plus an allow-list env var).
- Per-client rate limiting, 2 MB body cap (clean `413`), message-length caps, role/shape validation.
- Static serving is confined to `public/` (no `.env`, no `server/`).
- Upstream errors are mapped to friendly codes; mid-stream failures never leak library internals.
- Session keys are loopback-only, in memory, never logged or persisted.
- Front end: all Markdown is escaped, links are scheme-whitelisted, calculator never uses `eval`.

## Deploying beyond localhost
JARVIX has **no user authentication**. If you bind to a non-loopback address, put it behind a reverse proxy that authenticates users (and TLS), otherwise anyone who can reach it can spend your API quota.
