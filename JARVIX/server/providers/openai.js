'use strict';
const { ProviderError, upstreamError, sseEvents, normalizeMessages, guardedFetch } = require('./shared');

/** Factory: works for OpenAI proper and any OpenAI-compatible endpoint (Ollama, LM Studio, OpenRouter...). */
function make(id, label, { tokenParam }) {
  return {
    id,
    label,
    async *stream({ cfg, key, messages, system, model, temperature, maxTokens, signal, timeoutMs }) {
      const url = cfg.baseUrl.replace(/\/$/, '') + '/chat/completions';
      const msgs = normalizeMessages(messages);
      if (system) msgs.unshift({ role: 'system', content: system });
      const body = { model, messages: msgs, stream: true, [tokenParam]: maxTokens };
      if (temperature != null) body.temperature = Math.min(2, Math.max(0, temperature));
      const headers = { 'content-type': 'application/json' };
      if (key) headers.authorization = 'Bearer ' + key;
      const { res, done } = await guardedFetch(url, { method: 'POST', headers, body: JSON.stringify(body) }, label, timeoutMs, signal);
      try {
        if (!res.ok) throw await upstreamError(res, label);
        for await (const ev of sseEvents(res.body)) {
          if (ev.data.trim() === '[DONE]') return;
          let j;
          try { j = JSON.parse(ev.data); } catch { continue; }
          if (j.error) throw new ProviderError('upstream', j.error.message || `${label} stream error`, 502);
          const t = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (t) yield t;
        }
      } finally { done(); }
    },
  };
}

module.exports = {
  openai: make('openai', 'OpenAI', { tokenParam: 'max_completion_tokens' }),
  compatible: make('compatible', 'OpenAI-compatible', { tokenParam: 'max_tokens' }),
};
