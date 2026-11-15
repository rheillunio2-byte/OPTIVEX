'use strict';

class ProviderError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ProviderError';
    this.code = code; // not_configured | auth | rate_limit | bad_request | upstream | network | timeout | aborted
    this.status = status || 500;
  }
}

/** Map an upstream HTTP failure to a safe, user-presentable error (never echoes credentials). */
async function upstreamError(res, label) {
  let detail = '';
  try {
    const text = (await res.text()).slice(0, 2000);
    try {
      const j = JSON.parse(text);
      detail = (j.error && (j.error.message || j.error)) || j.message || '';
      if (typeof detail !== 'string') detail = JSON.stringify(detail);
    } catch { detail = text; }
  } catch { /* ignore */ }
  detail = String(detail).replace(/(sk-|key[-_ ]?)[A-Za-z0-9_\-]{8,}/gi, '$1***').slice(0, 300);
  const s = res.status;
  if (s === 401 || s === 403) return new ProviderError('auth', `${label} rejected the API key (HTTP ${s}). Check the key in your .env file.`, 401);
  if (s === 429) return new ProviderError('rate_limit', `${label} rate limit or quota reached. Try again shortly.`, 429);
  if (s === 400 || s === 404 || s === 422) return new ProviderError('bad_request', `${label} could not process the request${detail ? ': ' + detail : ''}`, 400);
  return new ProviderError('upstream', `${label} is having trouble (HTTP ${s}).${detail ? ' ' + detail : ''}`, 502);
}

/** Parse a Server-Sent-Events byte stream into {event, data} objects. */
async function* sseEvents(body) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let idx;
    while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
      const ev = { event: 'message', data: '' };
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) ev.data += (ev.data ? '\n' : '') + line.slice(5).replace(/^ /, '');
      }
      if (ev.data) yield ev;
    }
  }
}

/** Make sure the message list is valid for strict APIs: starts with user, roles alternate. */
function normalizeMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (!m.content || !String(m.content).trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content;
    else out.push({ role: m.role, content: String(m.content) });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/** fetch wrapper converting network/timeouts into ProviderErrors. */
async function guardedFetch(url, opts, label, timeoutMs, outerSignal) {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (outerSignal) {
    if (outerSignal.aborted) ctl.abort();
    else outerSignal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => ctl.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    return { res, done: () => { clearTimeout(timer); outerSignal && outerSignal.removeEventListener('abort', onAbort); } };
  } catch (err) {
    clearTimeout(timer);
    if (outerSignal && outerSignal.aborted) throw new ProviderError('aborted', 'Request cancelled.', 499);
    if (ctl.signal.aborted) throw new ProviderError('timeout', `${label} did not respond in time.`, 504);
    throw new ProviderError('network', `Could not reach ${label}. Check the network connection and base URL.`, 502);
  }
}

module.exports = { ProviderError, upstreamError, sseEvents, normalizeMessages, guardedFetch };
