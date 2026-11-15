/* JARVIX — settings dialog: Appearance, Assistant, Voice, AI connection, Data. Every control writes through JX.store and applies live. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, el, esc } = JX.util;
  const S = JX.store;
  const ui = JX.ui;

  const TABS = [['appearance', 'Appearance', 'palette'], ['assistant', 'Assistant', 'user'], ['voice', 'Voice', 'mic'], ['ai', 'AI connection', 'globe'], ['data', 'Data', 'database']];

  const row = (label, help, control, id) => el('div', { class: 'set-row' }, el('div', { class: 'set-label' }, el('label', { for: id || null }, label), help ? el('small', {}, help) : null), el('div', { class: 'set-ctl' }, control));
  const section = (title, ...rows) => el('section', { class: 'set-sec' }, el('h3', {}, title), ...rows);
  function slider({ min, max, step, value, onInput, fmt, id, label }) {
    const out = el('output', {}, fmt ? fmt(value) : String(value));
    const i = el('input', { type: 'range', min, max, step, value, id, 'aria-label': label || null });
    i.addEventListener('input', () => { out.textContent = fmt ? fmt(+i.value) : i.value; onInput(+i.value); });
    return el('div', { class: 'range-wrap' }, i, out);
  }

  /* ---------- tabs ---------- */
  const panes = {};

  panes.appearance = () => {
    const accents = el('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Accent colour' });
    Object.entries(JX.theme.ACCENTS).forEach(([k, a]) => accents.append(el('button', { type: 'button', class: 'swatch-btn' + (S.settings.accent === k ? ' on' : ''), role: 'radio', 'aria-checked': S.settings.accent === k, 'aria-label': a.label, title: a.label, style: `--c1:${a.a1};--c2:${a.a2}`, onclick: (e) => { S.set('accent', k); accents.querySelectorAll('.swatch-btn').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-checked', 'true'); } })));
    const preview = el('div', { class: 'fs-preview' }, 'The quick brown fox jumps over the lazy dog.');
    return [
      section('Theme',
        row('Colour theme', 'System follows your device setting.', ui.segmented([['dark', 'Dark'], ['light', 'Light'], ['system', 'System']], S.settings.theme, (v) => S.set('theme', v), 'Theme')),
        row('Accent colour', 'Used for highlights, the AI core and focus rings.', accents)),
      section('Text', row('Font size', 'Scales the whole interface.', slider({ min: 12, max: 20, step: 1, value: S.settings.fontSize, fmt: (v) => v + ' px', onInput: (v) => S.set('fontSize', v), id: 'set-fs', label: 'Font size' })), preview),
      section('Motion & sound',
        row('Animation intensity', JX.theme.reducedMotion() ? 'Your system requests reduced motion, so animation is limited regardless of this setting.' : 'Off disables all motion. Low keeps essential transitions.', ui.segmented([['off', 'Off'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], S.settings.animations, (v) => S.set('animations', v), 'Animation intensity')),
        row('Sound effects', 'Soft synthesised tones for send, receive and alerts. Off by default.', ui.toggle(S.settings.sounds, (v) => { S.set('sounds', v); if (v) JX.sound.play('toggle'); }, 'Sound effects')),
        row('Volume', null, slider({ min: 0, max: 1, step: 0.05, value: S.settings.soundVolume, fmt: (v) => Math.round(v * 100) + '%', onInput: (v) => S.set('soundVolume', v), id: 'set-vol', label: 'Sound volume' }))),
    ];
  };

  panes.assistant = () => {
    const P = JX.ai.PERSONALITIES; const cards = el('div', { class: 'persona-grid', role: 'radiogroup', 'aria-label': 'Personality' });
    Object.entries(P).forEach(([k, p]) => cards.append(el('button', { type: 'button', class: 'persona' + (S.settings.personality === k ? ' on' : ''), role: 'radio', 'aria-checked': S.settings.personality === k, onclick: (e) => { S.set('personality', k); cards.querySelectorAll('.persona').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); }); e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-checked', 'true'); } }, el('b', {}, p.label), el('small', {}, p.blurb))));
    const name = el('input', { class: 'inline-input', id: 'set-name', value: S.settings.name, maxlength: 30, placeholder: 'Your name' }); name.addEventListener('change', () => S.set('name', name.value.trim()));
    const ci = el('textarea', { class: 'note-edit', id: 'set-ci', rows: 4, maxlength: 1500, placeholder: 'e.g. I\'m a beginner programmer. Prefer Python examples. Keep answers under 200 words.' }); ci.value = S.settings.customInstructions; ci.addEventListener('change', () => S.set('customInstructions', ci.value));
    return [
      section('About you', row('Your name', 'Used in greetings and given to the AI so it can address you.', name, 'set-name')),
      section('Personality', el('p', { class: 'set-note' }, 'Shapes the tone of AI replies. It has no effect on local tools, and demo mode only uses your name.'), cards),
      section('Replies', row('Response length', 'Auto adjusts to the question.', ui.segmented([['auto', 'Auto'], ['concise', 'Concise'], ['balanced', 'Balanced'], ['detailed', 'Detailed']], S.settings.responseLength, (v) => { S.set('responseLength', v); const s = $('#lenSelect'); if (s) s.value = v; }, 'Response length')),
        row('Custom instructions', 'Always sent to the AI. Don\'t include secrets.', ci, 'set-ci')),
    ];
  };

  panes.voice = () => {
    const sup = JX.voice.support();
    const sel = el('select', { class: 'select', id: 'set-voice', 'aria-label': 'Voice' }, el('option', { value: '' }, 'Browser default')); sel.disabled = !sup.tts;
    JX.voice.getVoices().then((vs) => { vs.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name)).forEach((v) => sel.append(el('option', { value: v.voiceURI }, `${v.name} (${v.lang})`))); sel.value = S.settings.voice.voiceURI; });
    sel.addEventListener('change', () => S.set('voice.voiceURI', sel.value));
    const langs = [['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['en-AU', 'English (AU)'], ['en-IN', 'English (India)'], ['es-ES', 'Español'], ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['it-IT', 'Italiano'], ['pt-BR', 'Português (BR)'], ['ja-JP', '日本語'], ['ko-KR', '한국어'], ['zh-CN', '中文 (普通话)'], ['hi-IN', 'हिन्दी']];
    const lang = el('select', { class: 'select', id: 'set-lang', 'aria-label': 'Recognition language' }, langs.map(([v, t]) => el('option', { value: v }, t))); lang.value = S.settings.voice.lang; lang.addEventListener('change', () => S.set('voice.lang', lang.value));
    const test = el('button', { type: 'button', class: 'btn btn-small', onclick: () => sup.tts ? JX.voice.speak('Hello. This is how I will sound.', { force: true }) : ui.toast('Speech synthesis is not supported in this browser.', 'warn') }, 'Test voice');
    return [
      !sup.stt || !sup.tts ? el('div', { class: 'callout warn' }, el('b', {}, 'Limited browser support. '), `${!sup.stt ? 'Speech recognition (microphone input) isn\'t available in this browser. ' : ''}${!sup.tts ? 'Speech synthesis (spoken replies) isn\'t available. ' : ''}Chrome, Edge and Safari support the most.`) : null,
      section('Voice features',
        row('Enable voice', 'Shows the microphone button and allows spoken replies. The mic never turns on by itself.', ui.toggle(S.settings.voice.enabled, (v) => { S.set('voice.enabled', v); if (!v) JX.voice.stopAll(); }, 'Enable voice')),
        row('Speak replies automatically', 'Reads each reply aloud. Replies to voice questions are always spoken while voice is enabled.', ui.toggle(S.settings.voice.autoSpeak, (v) => S.set('voice.autoSpeak', v), 'Speak replies automatically'))),
      section('Speech recognition', row('Recognition language', 'Chrome sends audio to an online service for recognition.', lang, 'set-lang')),
      section('Speech output',
        row('Voice', 'Voices come from your device.', sel, 'set-voice'),
        row('Speed', null, slider({ min: 0.6, max: 1.6, step: 0.05, value: S.settings.voice.rate, fmt: (v) => v.toFixed(2) + '×', onInput: (v) => S.set('voice.rate', v), id: 'set-rate', label: 'Speech speed' })),
        row('Pitch', null, slider({ min: 0.5, max: 1.5, step: 0.05, value: S.settings.voice.pitch, fmt: (v) => v.toFixed(2), onInput: (v) => S.set('voice.pitch', v), id: 'set-pitch', label: 'Speech pitch' })),
        row('Preview', null, test)),
    ];
  };

  panes.ai = () => {
    const st = JX.ai.status; const wrap = el('div', {});
    const stateText = { live: ['ok', 'Live', 'Connected through the server proxy.'], demo: ['warn', 'Demo mode', st.hasServer === false ? 'The JARVIX server isn\'t reachable (or the page was opened as a file). Run `npm start` and open the address it prints.' : 'The server is running but has no API key configured.'], offline: ['bad', 'Offline', 'You appear to be offline.'], error: ['bad', 'Error', st.reason || 'The last request failed.'], checking: ['warn', 'Checking…', ''] }[st.state] || ['warn', st.state, ''];
    wrap.append(el('div', { class: `callout ${stateText[0]}` }, el('b', {}, stateText[1] + '. '), stateText[2].replace(/`([^`]+)`/g, '$1')));
    const provRows = st.providers.map((p) => el('li', {}, el('span', { class: 'dot', 'data-state': p.configured ? 'live' : 'demo' }), el('b', {}, p.label), el('small', {}, p.configured ? (p.fromSession ? 'key set for this session' : 'configured on server') : 'not configured')));
    const prov = el('select', { class: 'select', id: 'set-prov', 'aria-label': 'Provider' }, el('option', { value: '' }, 'Server default' + (st.provider ? ` (${st.provider})` : '')), st.providers.map((p) => el('option', { value: p.id }, p.label + (p.configured ? '' : ' — not configured')))); prov.value = S.settings.ai.provider;
    const model = el('input', { class: 'inline-input', id: 'set-model', placeholder: 'Provider default', value: S.settings.ai.model, maxlength: 120, spellcheck: 'false', autocomplete: 'off' });
    const hintModel = () => { const e = JX.ai.effective({ ai: { provider: prov.value, model: '' } }); model.placeholder = e.model ? `Default: ${e.model}` : 'Enter a model name'; }; hintModel();
    prov.addEventListener('change', () => { S.set('ai.provider', prov.value); hintModel(); sessionBox(); });
    model.addEventListener('change', () => S.set('ai.model', model.value.trim()));
    const result = el('div', { class: 'test-result', role: 'status' });
    const testBtn = el('button', { type: 'button', class: 'btn btn-primary' }, 'Test connection');
    testBtn.addEventListener('click', async () => {
      testBtn.disabled = true; testBtn.textContent = 'Testing…'; result.className = 'test-result'; result.textContent = '';
      try { await JX.ai.refresh(); const r = await JX.ai.testConnection(S.settings); result.className = 'test-result ok'; result.textContent = `✓ ${r.provider} · ${r.model} replied in ${r.latencyMs} ms`; ui.toast('Connection works', 'success'); }
      catch (e) { result.className = 'test-result bad'; result.textContent = '✗ ' + e.message; }
      finally { testBtn.disabled = false; testBtn.textContent = 'Test connection'; }
    });
    // optional session key (in-memory on the server; never stored in the browser)
    const keyHost = el('div', {});
    const sessionBox = () => {
      keyHost.innerHTML = ''; const p = prov.value || st.provider || (st.providers[0] && st.providers[0].id); if (!p) return;
      if (!st.sessionKeyAllowed) { keyHost.append(el('p', { class: 'set-note' }, st.hasServer ? 'Session keys can only be set from the machine running the server. Put your key in the server\'s .env file instead.' : '')); return; }
      const info = st.providers.find((x) => x.id === p); const input = el('input', { class: 'inline-input', type: 'password', id: 'set-key', placeholder: p === 'compatible' ? 'API key (optional for local servers)' : 'Paste API key', autocomplete: 'off', spellcheck: 'false' });
      const set = el('button', { type: 'button', class: 'btn btn-small' }, 'Use for this session'); const clear = info && info.fromSession ? el('button', { type: 'button', class: 'btn btn-small btn-ghost' }, 'Forget key') : null;
      set.addEventListener('click', async () => { try { await JX.ai.setSessionKey(p, input.value.trim()); input.value = ''; ui.toast('Key set for this server session', 'success'); ui.openSettings('ai', true); } catch (e) { ui.toast(e.message, 'error'); } });
      if (clear) clear.addEventListener('click', async () => { await JX.ai.clearSessionKey(p); ui.toast('Key forgotten', 'info'); ui.openSettings('ai', true); });
      keyHost.append(row('Session API key', 'Held in the server\'s memory only — never saved to disk or to your browser, and gone when the server restarts. For permanent setup use .env.', el('div', { class: 'key-row' }, input, set, clear)));
    };
    sessionBox();
    const temp = slider({ min: 0, max: 1.5, step: 0.05, value: S.settings.ai.temperature, fmt: (v) => v.toFixed(2), onInput: (v) => S.set('ai.temperature', v), id: 'set-temp', label: 'Temperature' });
    const maxT = el('input', { class: 'inline-input narrow', type: 'number', id: 'set-max', min: 64, max: 16000, step: 64, value: S.settings.ai.maxTokens }); maxT.addEventListener('change', () => { const v = JX.util.clamp(parseInt(maxT.value, 10) || 2048, 64, 16000); maxT.value = v; S.set('ai.maxTokens', v); });
    const ctx = el('input', { class: 'inline-input narrow', type: 'number', id: 'set-ctx', min: 2, max: 100, step: 2, value: S.settings.ai.contextMessages }); ctx.addEventListener('change', () => { const v = JX.util.clamp(parseInt(ctx.value, 10) || 20, 2, 100); ctx.value = v; S.set('ai.contextMessages', v); });
    return [
      wrap,
      section('Provider', el('ul', { class: 'prov-list' }, provRows), row('Active provider', 'Switch between configured providers at any time.', prov, 'set-prov'), row('Model', 'Leave empty to use the provider\'s default.', model, 'set-model'), keyHost,
        row('Connection', 'Sends one tiny request to verify the key and model.', el('div', { class: 'stack-sm' }, testBtn, result))),
      section('Generation',
        row('Temperature', 'Lower is more focused; higher is more creative.', temp),
        row('Max reply length', 'Upper limit for tokens in a reply.', maxT, 'set-max'),
        row('Context messages', 'How many earlier messages are sent for follow-ups.', ctx, 'set-ctx'),
        row('Stream replies', 'Show text as it is generated.', ui.toggle(S.settings.ai.streaming, (v) => S.set('ai.streaming', v), 'Stream replies'))),
      section('Setup', el('div', { class: 'howto' }, el('p', {}, el('b', {}, 'API keys never touch the browser.'), ' JARVIX talks to a small server which holds your key and forwards requests.'), el('ol', {}, el('li', {}, 'Copy ', el('code', {}, '.env.example'), ' to ', el('code', {}, '.env')), el('li', {}, 'Add ', el('code', {}, 'ANTHROPIC_API_KEY'), ', ', el('code', {}, 'OPENAI_API_KEY'), ' or a local ', el('code', {}, 'JARVIX_BASE_URL')), el('li', {}, 'Run ', el('code', {}, 'npm start'), ' and reopen the page'))))
    ];
  };

  panes.data = () => {
    const usage = S.storageUsage();
    const imp = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    imp.addEventListener('change', async () => {
      const f = imp.files[0]; imp.value = ''; if (!f) return;
      if (f.size > 20 * 1024 * 1024) return ui.toast('That file is too large to be a JARVIX backup.', 'error');
      try { const obj = JSON.parse(await f.text()); const n = S.importAll(obj); ui.toast(`Imported backup: ${n} new conversation${n === 1 ? '' : 's'} added; tasks, notes and files merged.`, 'success', { duration: 5000 }); ui.openSettings('data', true); }
      catch (e) { ui.toast(e instanceof SyntaxError ? 'That file isn\'t valid JSON.' : e.message, 'error'); }
    });
    const impSet = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    impSet.addEventListener('change', async () => { const f = impSet.files[0]; impSet.value = ''; if (!f) return; try { const o = JSON.parse(await f.text()); S.importSettings(o.settings || o); ui.toast('Settings imported', 'success'); ui.openSettings('data', true); } catch { ui.toast('Could not read that settings file.', 'error'); } });
    const b = (label, fn, cls = 'btn btn-small') => el('button', { type: 'button', class: cls, onclick: fn }, label);
    return [
      section('Storage', el('div', { class: 'meter' }, el('div', { class: 'meter-bar' }, el('i', { style: `width:${Math.min(100, usage / (5 * 1024 * 1024) * 100).toFixed(1)}%` })), el('small', {}, `${ui.fmtBytes(usage)} used of roughly 5 MB available in this browser`)),
        el('p', { class: 'set-note' }, 'Everything is stored locally in your browser. Nothing is uploaded except the messages you send to your AI provider.')),
      section('Backup',
        row('Export everything', 'Conversations, tasks, notes, files and settings as one JSON file.', b('Export backup', () => { JX.util.download(`jarvix-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.exportAll(), null, 2), 'application/json'); ui.toast('Backup downloaded', 'success'); })),
        row('Import a backup', 'Merges with what you have; existing items are kept.', el('div', {}, b('Import backup…', () => imp.click()), imp)),
        row('Export settings only', null, b('Export settings', () => { JX.util.download('jarvix-settings.json', JSON.stringify({ app: 'JARVIX', settings: S.settings }, null, 2), 'application/json'); ui.toast('Settings exported', 'success'); })),
        row('Import settings', null, el('div', {}, b('Import settings…', () => impSet.click()), impSet)),
        row('Export this conversation', 'As Markdown, plain text or JSON.', el('div', { class: 'btn-row' }, ['md', 'txt', 'json'].map((f) => b(f.toUpperCase(), () => { const c = S.active(); if (!c || !c.messages.length) return ui.toast('The current conversation is empty.', 'warn'); ui.exportConversation(c, f); }))))),
      section('Reset & erase',
        row('Reset settings', 'Restore appearance, voice and AI preferences to defaults. Your data is kept.', b('Reset settings', async () => { if (await ui.confirm({ title: 'Reset all settings?', body: 'Appearance, assistant, voice and AI preferences return to their defaults. Conversations, tasks and notes are not affected.', confirm: 'Reset settings' })) { S.resetSettings(); ui.toast('Settings reset', 'success'); ui.openSettings('data', true); } })),
        row('Delete all conversations', null, b('Delete conversations', async () => { if (await ui.confirm({ title: 'Delete all conversations?', body: `This permanently removes ${S.conversations.length} conversation${S.conversations.length === 1 ? '' : 's'}.`, confirm: 'Delete all', danger: true })) { S.eraseConversations(); ui.toast('Conversations deleted', 'info'); ui.openSettings('data', true); } }, 'btn btn-small btn-danger-ghost')),
        row('Erase everything', 'Removes all JARVIX data from this browser, including settings.', b('Erase all data', async () => { if (await ui.confirm({ title: 'Erase ALL JARVIX data?', body: 'Conversations, tasks, notes, files, activity and settings will be permanently deleted from this browser. Consider exporting a backup first.', confirm: 'Erase everything', danger: true })) { S.eraseEverything(); ui.toast('All data erased', 'info'); ui.openSettings('data', true); ui.updateTitle(); } }, 'btn btn-small btn-danger-ghost'))),
    ];
  };

  /* ---------- dialog ---------- */
  let active = null;
  ui.openSettings = function (tab = 'appearance', rerender) {
    if (!TABS.some((t) => t[0] === tab)) tab = 'appearance';
    if (active && active.el.isConnected) { return show(tab); }
    const nav = el('div', { class: 'set-tabs', role: 'tablist', 'aria-label': 'Settings sections' });
    const body = el('div', { class: 'set-body', role: 'tabpanel', tabindex: '0' });
    TABS.forEach(([k, label, ic]) => nav.append(el('button', { type: 'button', class: 'set-tab', role: 'tab', 'data-tab': k, id: 'tab-' + k, onclick: () => show(k), html: JX.icon(ic, 16) + `<span>${label}</span>` })));
    nav.addEventListener('keydown', (e) => { if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const i = TABS.findIndex((t) => t[0] === active.tab); const n = TABS[(i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length][0]; show(n); $('#tab-' + n).focus(); });
    active = ui.modal({ title: 'Settings', size: 'xl', className: 'settings-modal', content: el('div', { class: 'set-layout' }, nav, body), onClose: () => { active = null; } });
    active.nav = nav; active.body = body;
    show(tab);
  };
  function show(tab) {
    active.tab = tab;
    active.nav.querySelectorAll('.set-tab').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    active.body.setAttribute('aria-labelledby', 'tab-' + tab); const keep = active.body.scrollTop;
    active.body.innerHTML = ''; panes[tab]().filter(Boolean).forEach((n) => active.body.append(n)); active.body.scrollTop = keep;
    active.body.classList.remove('pane-in'); void active.body.offsetWidth; active.body.classList.add('pane-in');
  }
  JX.ai.on('status', () => { if (active && active.tab === 'ai' && !active.body.contains(document.activeElement)) show('ai'); });
})();
