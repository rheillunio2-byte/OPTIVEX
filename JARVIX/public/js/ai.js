/* JARVIX — AI client. Talks ONLY to this app's own /api/* proxy; no provider keys exist in the browser. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { emitter } = JX.util;
  const bus = emitter();

  class AIError extends Error {
    constructor(code, message) { super(message); this.name = 'AIError'; this.code = code; }
  }

  const PERSONALITIES = {
    balanced: { label: 'Balanced', blurb: 'Clear, warm and capable.', prompt: 'Be clear, warm and capable. Sound like a sharp, friendly colleague.' },
    professional: { label: 'Professional', blurb: 'Precise and formal.', prompt: 'Be precise, formal and well organised. Avoid slang and humour.' },
    friendly: { label: 'Friendly', blurb: 'Casual and encouraging.', prompt: 'Be casual, upbeat and encouraging. Use an approachable tone.' },
    concise: { label: 'Concise', blurb: 'Straight to the point.', prompt: 'Be extremely economical with words. Lead with the answer; skip preamble.' },
    witty: { label: 'Witty', blurb: 'Dry humour, still helpful.', prompt: 'Add light, dry wit where it fits, but never at the expense of accuracy or clarity.' },
    mentor: { label: 'Mentor', blurb: 'Teaches step by step.', prompt: 'Teach patiently: explain the why, build intuition with examples, and check understanding with a short follow-up question when useful.' },
  };
  const LENGTHS = {
    auto: 'Adjust length to the question: one or two sentences for simple or casual messages, structured and thorough for complex ones.',
    concise: 'Keep answers short: lead with the answer and keep detail to what is essential.',
    balanced: 'Give moderately detailed answers with brief explanations.',
    detailed: 'Give thorough, well-structured answers with examples and reasoning.',
  };

  function buildSystem({ settings, extra, hint }) {
    const p = PERSONALITIES[settings.personality] || PERSONALITIES.balanced;
    const now = new Date();
    const parts = [
      'You are JARVIX, an AI assistant inside a futuristic command-center web app.',
      p.prompt,
      LENGTHS[settings.responseLength] || LENGTHS.auto,
      'Format replies in Markdown: headings only for longer answers, bullet or numbered lists for steps, tables for comparisons, fenced code blocks with a language tag for code, and LaTeX in $...$ for maths. Do not wrap the whole reply in a code block.',
      'Use the conversation history for follow-up questions. If a request is genuinely ambiguous, ask one short clarifying question; otherwise make a sensible assumption and state it. Tolerate typos and imperfect phrasing.',
      'Be honest: if you are unsure, say so. You cannot browse the web, run code, or access the user\'s files, and you must never claim to have done so.',
      'The app has slash commands (type / to see them). Local utilities such as /calculate, /convert, /todo and /note run in the browser, not through you.',
      `Current local date/time: ${now.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
    ];
    if (settings.name) parts.push(`The user's name is ${settings.name}.`);
    if (hint) parts.push(hint);
    if (extra) parts.push(extra);
    if (settings.customInstructions && settings.customInstructions.trim()) parts.push('User\'s custom instructions (follow unless unsafe):\n' + settings.customInstructions.trim().slice(0, 1500));
    return parts.join('\n\n');
  }

  const ai = {
    status: { state: 'checking', provider: null, model: null, providers: [], sessionKeyAllowed: false, reason: '' },
    on: bus.on, PERSONALITIES, LENGTHS, AIError, buildSystem,

    /** True when the server has a provider configured. Transient 'error'/'offline' states do not stop attempts, so the app recovers by itself and never silently falls back to demo replies. */
    isLive() { const st = ai.status; return !!st.provider && st.hasServer !== false && ['live', 'error', 'offline'].includes(st.state); },

    set(patch) { ai.status = { ...ai.status, ...patch }; bus.emit('status', ai.status); },

    async refresh() {
      ai.set({ state: 'checking' });
      try {
        if (location.protocol === 'file:') throw new Error('file');
        if (navigator.onLine === false) { ai.set({ state: 'offline', reason: 'You appear to be offline.' }); return ai.status; }
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
        const res = await fetch('/api/status', { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t);
        if (!res.ok) throw new Error('bad status');
        const j = await res.json();
        ai.set({
          state: j.mode === 'live' ? 'live' : 'demo', provider: j.provider, model: j.model, providers: j.providers, sessionKeyAllowed: !!j.sessionKeyAllowed,
          reason: j.mode === 'live' ? '' : 'Server is running but no AI provider is configured.', serverVersion: j.version, hasServer: true,
        });
      } catch (e) {
        ai.set({ state: 'demo', provider: null, model: null, providers: [], hasServer: false, sessionKeyAllowed: false, reason: location.protocol === 'file:' ? 'Opened as a file — start the server (npm start) for AI.' : 'Server not reachable.' });
      }
      return ai.status;
    },

    /** The provider/model that will actually be used right now. */
    effective(settings) {
      const prov = settings.ai.provider || ai.status.provider;
      const info = ai.status.providers.find((p) => p.id === prov);
      return { provider: prov, model: settings.ai.model || (info && info.defaultModel) || ai.status.model, configured: !!(info && info.configured) };
    },

    /**
     * Stream a chat completion. onDelta(textChunk) is called as text arrives.
     * Resolves {text, provider, model}. Rejects with AIError (code: aborted | auth | rate_limit | network | ...).
     */
    async stream({ messages, system, settings, signal, onDelta }) {
      if (!ai.isLive()) throw new AIError('not_configured', 'No AI provider is connected.');
      const eff = ai.effective(settings);
      const body = { messages, system, provider: settings.ai.provider || undefined, model: settings.ai.model || undefined, temperature: settings.ai.temperature, maxTokens: settings.ai.maxTokens };
      let res;
      try {
        res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
      } catch (e) {
        if (e.name === 'AbortError') throw new AIError('aborted', 'Stopped.');
        ai.set({ state: navigator.onLine === false ? 'offline' : 'error', reason: 'Lost connection to the JARVIX server.' });
        throw new AIError('network', 'Could not reach the JARVIX server. Is it still running?');
      }
      if (!res.ok) {
        let err = { code: 'upstream', message: `Server error (${res.status}).` };
        try { err = (await res.json()).error || err; } catch { /* ignore */ }
        if (err.code === 'auth') ai.set({ state: 'error', reason: err.message });
        throw new AIError(err.code, err.message);
      }
      if (ai.status.state === 'error') ai.set({ state: 'live', reason: '' });
      let text = '', meta = { provider: eff.provider, model: eff.model };
      const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const line = buf.slice(0, idx); buf = buf.slice(idx + 2);
            if (!line.startsWith('data:')) continue;
            let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
            if (j.meta) meta = j.meta;
            else if (j.delta) { text += j.delta; onDelta && onDelta(j.delta, text); }
            else if (j.error) throw new AIError(j.error.code || 'upstream', j.error.message);
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') throw new AIError('aborted', 'Stopped.');
        if (e instanceof AIError) { e.partial = text; throw e; }
        const ne = new AIError('network', 'The connection was interrupted.'); ne.partial = text; throw ne;
      }
      return { text, ...meta };
    },

    async testConnection(settings) {
      const res = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: settings.ai.provider || undefined, model: settings.ai.model || undefined }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new AIError((j.error && j.error.code) || 'upstream', (j.error && j.error.message) || `Test failed (${res.status}).`);
      return j;
    },

    async setSessionKey(provider, key) {
      const res = await fetch('/api/session-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new AIError('bad_request', (j.error && j.error.message) || 'Could not set the key.');
      await ai.refresh();
    },
    async clearSessionKey(provider) {
      await fetch('/api/session-key', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider }) });
      await ai.refresh();
    },
  };

  window.addEventListener && window.addEventListener('online', () => ai.refresh());
  window.addEventListener && window.addEventListener('offline', () => ai.set({ state: 'offline', reason: 'You appear to be offline.' }));

  JX.ai = ai;
})();
