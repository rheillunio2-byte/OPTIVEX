/* JARVIX — chat controller: routes input to slash commands / local intents / the AI provider (or the labelled demo responder), streams replies. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, esc, sleep } = JX.util;
  const S = JX.store;

  const chat = { busy: false, ctl: null, run: null };

  const ERROR_TITLES = {
    auth: 'The AI provider rejected the API key', rate_limit: 'Rate limit reached', network: 'Connection problem', timeout: 'The AI provider timed out',
    not_configured: 'No AI provider connected', upstream: 'The AI provider returned an error', bad_request: 'The request was rejected', overloaded: 'The AI provider is overloaded',
    too_large: 'Message too large',
  };

  function setBusy(on) {
    chat.busy = on; document.body.classList.toggle('is-busy', on);
    $('#sendBtn').hidden = on; $('#stopGenBtn').hidden = !on;
    $('#composer').setAttribute('aria-busy', on ? 'true' : 'false');
  }

  /** Decide what a line of input means. */
  function plan(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('/')) {
      const p = JX.commands.parse(trimmed);
      if (!p) return { type: 'unknown', name: trimmed.slice(1).split(/\s/)[0], suggestions: [] };
      const r = JX.commands.resolve(p.name);
      if (!r.cmd) return { type: 'unknown', name: p.name, suggestions: r.suggestions || [] };
      return { type: 'command', cmd: r.cmd, args: p.args, corrected: r.corrected ? p.name : null };
    }
    const route = JX.intent.route(trimmed, { lastCalc: JX.commands.session.lastCalc });
    if (route) { const cmd = JX.commands.find(route.command); if (cmd) return { type: 'command', cmd, args: route.args, routed: route }; }
    return { type: 'chat' };
  }

  /** Messages for the model: real conversation only (no system notices, errors, demo replies or ephemeral output), merged to alternate roles. */
  function contextMessages(conv, upto) {
    const limit = Math.max(2, S.settings.ai.contextMessages || 20);
    const src = (upto ? conv.messages.slice(0, upto) : conv.messages).filter((m) => !m.pending && !m.ephemeral && m.content && !['system', 'error', 'demo'].includes(m.source));
    const out = [];
    for (const m of src.slice(-limit)) {
      const role = m.role === 'user' ? 'user' : 'assistant';
      if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += '\n\n' + m.content;
      else out.push({ role, content: m.content });
    }
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  function finishSpeak(msg) {
    const v = S.settings.voice;
    if (v.enabled && v.autoSpeak && msg && msg.content && !msg.ephemeral && msg.source !== 'error') JX.voice.speak(msg.content);
  }

  function say(conv, content, extra = {}) {
    const msg = S.addMessage(conv, { role: 'assistant', content, source: 'system', ...extra });
    JX.messages.append(conv, msg); JX.sound.play('receive'); return msg;
  }

  /* ---------- AI streaming ---------- */
  async function streamAI(conv, { messages, system, meta = {} }) {
    const eff = JX.ai.effective(S.settings);
    const msg = S.addMessage(conv, { role: 'assistant', content: '', source: 'ai', pending: true, meta: { provider: eff.provider, model: eff.model, ...meta } });
    JX.messages.append(conv, msg);
    JX.core.set('thinking');
    const ctl = (chat.ctl = new AbortController());
    let first = true;
    try {
      const res = await JX.ai.stream({
        messages, system, settings: S.settings, signal: ctl.signal,
        onDelta: (d, full) => {
          if (first) { first = false; JX.core.set('responding'); }
          msg.content = full; JX.messages.update(msg, { streaming: true });
        },
      });
      msg.content = res.text; msg.pending = false; msg.meta = { ...msg.meta, provider: res.provider, model: res.model };
      if (!msg.content.trim()) { msg.content = '_The model returned an empty reply. Try rephrasing, or press Regenerate._'; msg.source = 'system'; }
      JX.messages.update(msg); S.touch(conv); JX.sound.play('receive'); finishSpeak(msg);
    } catch (e) {
      msg.pending = false;
      if (e.code === 'aborted') {
        if (msg.content.trim()) { msg.meta = { ...msg.meta, stopped: true }; JX.messages.update(msg); S.touch(conv); }
        else { S.removeMessagesFrom(conv, msg.id); JX.messages.remove(msg.id); S.touch(conv); }
      } else {
        const partial = (e.partial || msg.content || '').trim();
        const title = ERROR_TITLES[e.code] || 'Something went wrong';
        msg.source = 'error';
        msg.content = (partial ? partial + '\n\n---\n' : '') + `**${title}.**\n\n${esc(e.message || 'Unknown error.')}\n\n_You can retry, or check **Settings → AI**._`;
        JX.messages.update(msg); S.touch(conv); JX.sound.play('error');
        console.warn('[JARVIX] AI error:', e.code, e.message);
      }
    } finally { chat.ctl = null; }
  }

  /* ---------- the main pipeline ---------- */
  async function process(conv, text, p, { speakReply } = {}) {
    if (p.type === 'unknown') {
      const sug = p.suggestions && p.suggestions.length ? ` Did you mean ${p.suggestions.map((s) => '`/' + s + '`').join(' or ')}?` : '';
      say(conv, `**Unknown command \`/${esc(p.name)}\`.**${sug}\n\nType \`/help\` to see all commands.`);
      return;
    }
    if (p.type === 'command') return runCommand(conv, text, p);
    // free conversation
    const hist = contextMessages(conv);
    if (JX.ai.isLive()) {
      const system = JX.ai.buildSystem({ settings: S.settings, hint: JX.intent.hint(text, hist.length > 1) });
      await streamAI(conv, { messages: hist, system });
    } else {
      JX.core.set('thinking'); await sleep(JX.theme.effectiveAnim() === 'off' ? 0 : 420);
      if (!chat.busy) return;
      const r = JX.demo.reply(text, S.settings);
      const msg = S.addMessage(conv, { role: 'assistant', content: r.md, source: 'demo' });
      JX.messages.append(conv, msg); JX.sound.play('receive'); JX.core.set('idle'); finishSpeak(msg);
    }
  }

  async function runCommand(conv, text, p) {
    const { cmd, args } = p; const meta = { cmd: cmd.name };
    if (p.corrected) meta.routed = `/${cmd.name} (you typed /${p.corrected})`;
    else if (p.routed) meta.routed = `/${cmd.name} ${args}`.trim();
    let r;
    try { r = await cmd.run(args, { conv, text }); } catch (e) { console.error('[JARVIX] command failed', cmd.name, e); r = { md: `⚠ \`/${cmd.name}\` failed: ${esc(e.message || String(e))}`, source: 'system' }; }
    r = r || { silent: true };
    S.logActivity(`/${cmd.name}${args ? ' ' + args : ''}`, r.ai ? (JX.ai.isLive() ? 'sent to AI' : 'needs AI') : r.silent ? 'done' : 'ok');
    if (r.silent) return;
    if (r.ai) {
      if (JX.ai.isLive()) {
        const system = JX.ai.buildSystem({ settings: S.settings, extra: r.ai.system });
        return streamAI(conv, { messages: [{ role: 'user', content: r.ai.prompt }], system, meta });
      }
      r = (r.fallback && r.fallback()) || JX.commands.demoNotice(cmd);
      if (r.ai) r = JX.commands.demoNotice(cmd);
    }
    if (r.toast && !r.keep) { JX.ui.toast(r.md.replace(/[*`_]/g, ''), 'info'); return; }
    const msg = S.addMessage(conv, { role: 'assistant', content: r.md, source: r.source || 'local', ephemeral: !!r.ephemeral, meta: { ...meta, ...(r.meta || {}), pure: !r.ephemeral && cmd.group === 'Utilities' } });
    JX.messages.append(conv, msg); JX.sound.play('receive'); finishSpeak(msg);
  }

  /* ---------- public API ---------- */
  chat.submit = async function (text, { fromVoice } = {}) {
    text = String(text || '').trim(); if (!text) return false;
    if (chat.busy) { JX.ui.toast('Still working — press Stop (Esc) first.', 'info', { duration: 1800 }); return false; }
    if (text.length > 20000) { JX.ui.toast('That message is too long (20,000 character limit).', 'error'); return false; }
    JX.voice.stopSpeaking();
    if (JX.ui.currentView() !== 'chat') JX.ui.showView('chat');
    const p = plan(text);
    const silentCmd = p.type === 'command' && p.cmd.noEcho;
    let conv = silentCmd ? S.active() : S.ensureActive();
    if (silentCmd && !conv) conv = S.ensureActive();
    setBusy(true);
    const done = (chat.run = (async () => {
      try {
        if (!silentCmd) {
          const um = S.addMessage(conv, { role: 'user', content: text, source: fromVoice ? 'voice' : 'user' });
          JX.messages.append(conv, um); JX.sound.play('send'); JX.core.set('thinking');
        }
        await process(conv, text, p);
      } catch (e) {
        console.error('[JARVIX] submit failed', e);
        say(S.ensureActive(), `⚠ Something unexpected went wrong: ${esc(e.message || String(e))}`, { source: 'error' });
      } finally {
        if (JX.core.state !== 'listening') JX.core.set(JX.voice.speaking ? 'responding' : 'idle');
        setBusy(false); chat.run = null; S.touch(S.active() || conv);
        JX.ui.updateTitle();
      }
    })());
    await done; return true;
  };

  chat.regenerate = async function (msgId) {
    if (chat.busy) return;
    const conv = S.active(); if (!conv) return;
    const i = conv.messages.findIndex((m) => m.id === msgId); if (i < 1) return;
    let u = i - 1; while (u >= 0 && conv.messages[u].role !== 'user') u--;
    if (u < 0) return;
    const text = conv.messages[u].content;
    const removed = conv.messages.slice(i).map((m) => m.id);
    S.removeMessagesFrom(conv, msgId); removed.forEach((id) => JX.messages.remove(id));
    setBusy(true);
    chat.run = (async () => {
      try { await process(conv, text, plan(text)); }
      catch (e) { console.error('[JARVIX] regenerate failed', e); say(conv, `⚠ Could not regenerate: ${esc(e.message || String(e))}`, { source: 'error' }); }
      finally { JX.core.set(JX.voice.speaking ? 'responding' : 'idle'); setBusy(false); chat.run = null; S.touch(conv); }
    })();
    await chat.run;
  };

  /** Stops generation, speech and listening. Resolves when any running request has fully unwound. */
  chat.stop = function () {
    JX.voice.stopSpeaking(); JX.voice.stopListening(true);
    if (chat.ctl) chat.ctl.abort();
    else if (chat.busy) chat.busy = true; // demo/local replies are awaiting a short timer: let it finish
    return chat.run || Promise.resolve();
  };

  JX.chat = chat;
})();
