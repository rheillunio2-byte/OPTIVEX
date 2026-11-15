'use strict';
const { ProviderError, upstreamError, sseEvents, normalizeMessages, guardedFetch } = require('./shared');

module.exports = {
  id: 'anthropic',
  label: 'Anthropic Claude',

  async *stream({ cfg, key, messages, system, model, temperature, maxTokens, signal, timeoutMs }) {
    const url = cfg.baseUrl.replace(/\/$/, '') + '/v1/messages';
    const body = {
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: normalizeMessages(messages),
    };
    if (system) body.system = system;
    if (temperature != null) body.temperature = Math.min(1, Math.max(0, temperature));
    const { res, done } = await guardedFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    }, 'Anthropic', timeoutMs, signal);
    try {
      if (!res.ok) throw await upstreamError(res, 'Anthropic');
      for await (const ev of sseEvents(res.body)) {
        let j;
        try { j = JSON.parse(ev.data); } catch { continue; }
        if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') yield j.delta.text;
        else if (j.type === 'error') throw new ProviderError('upstream', (j.error && j.error.message) || 'Anthropic stream error', 502);
      }
    } finally { done(); }
  },
};
