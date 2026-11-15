/* JARVIX — composer: auto-grow textarea, slash-command autocomplete, history recall, tray, voice dock. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, el, esc } = JX.util;
  const S = JX.store;

  let input, menu, wrap, sendBtn, micBtn, dock, wave, tray, trayBtn;
  let items = [], sel = 0, menuOpen = false;
  const hist = []; let hIdx = -1, draft = '';

  const C = {
    init() {
      input = $('#input'); menu = $('#slashMenu'); wrap = $('#composerWrap'); sendBtn = $('#sendBtn'); micBtn = $('#micBtn'); dock = $('#voiceDock'); tray = $('#tray'); trayBtn = $('#trayBtn');
      wave = new JX.Wave($('#waveCanvas'));
      tray.hidden = true;

      input.addEventListener('input', () => { grow(); updateMenu(); });
      input.addEventListener('keydown', onKey);
      input.addEventListener('paste', () => setTimeout(grow, 0));
      $('#composer').addEventListener('submit', (e) => { e.preventDefault(); send(); });
      $('#stopGenBtn').addEventListener('click', () => JX.chat.stop());
      micBtn.addEventListener('click', () => C.toggleMic());
      $('#voiceStop').addEventListener('click', () => JX.voice.stopListening(true));
      trayBtn.addEventListener('click', () => { tray.hidden = !tray.hidden; trayBtn.classList.toggle('on', !tray.hidden); trayBtn.setAttribute('aria-expanded', String(!tray.hidden)); });
      tray.addEventListener('click', onTray);
      $('#fileInput').addEventListener('change', onFile);
      const len = $('#lenSelect'); len.value = S.settings.responseLength; len.addEventListener('change', () => S.set('responseLength', len.value));
      S.on('settings', () => { len.value = S.settings.responseLength; updateMic(); updateNote(); });
      document.addEventListener('click', (e) => { if (menuOpen && !e.target.closest('#composerWrap')) closeMenu(); });
      menu.addEventListener('mousedown', (e) => e.preventDefault());
      menu.addEventListener('click', (e) => { const b = e.target.closest('.slash-item'); if (b) pick(+b.dataset.i); });
      document.addEventListener('keydown', (e) => { // "/" focuses the composer from anywhere
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !JX.ui.modals.length && JX.ui.currentView() === 'chat') { e.preventDefault(); C.focus(); if (!input.value) { input.value = '/'; grow(); updateMenu(); } }
      });
      JX.voice.on('listening', (on) => setListening(on));
      JX.voice.on('speaking', () => updateMic());
      JX.ai.on('status', updateNote);
      JX.ai.on('status', (s) => { document.body.dataset.status = s.state; });
      document.body.dataset.status = JX.ai.status.state;
      const mq = window.matchMedia('(max-width: 560px)'); const ph = () => { input.placeholder = window.innerWidth <= 360 ? 'Message…' : mq.matches ? 'Message JARVIX…' : 'Message JARVIX… or type / for commands'; };
      mq.addEventListener && mq.addEventListener('change', ph); window.addEventListener('resize', ph); ph();
      updateMic(); updateNote(); grow();
    },
    setText(text, focus) { input.value = text; grow(); updateMenu(); if (focus) { C.focus(); input.setSelectionRange(text.length, text.length); } },
    focus() { if (JX.ui.currentView() !== 'chat') JX.ui.showView('chat'); input.focus({ preventScroll: true }); },
    remember(t) { if (hist[hist.length - 1] !== t) hist.push(t); if (hist.length > 60) hist.shift(); hIdx = -1; },
    insertCommand(cmd) { C.setText(cmd.replace(/^\/?/, '/') + (/\s$/.test(cmd) ? '' : ' '), true); },
    async toggleMic() {
      if (JX.voice.listening) { JX.voice.stopListening(false); return; }
      if (!S.settings.voice.enabled) { JX.ui.toast('Voice is turned off. Enable it with /voice on or in Settings → Voice.', 'warn'); return; }
      if (JX.chat.busy) { JX.ui.toast('Wait for the current response to finish (or press Stop).', 'info', { duration: 2000 }); return; }
      const ok = await JX.voice.startListening({
        onInterim: (t) => { $('#voiceInterim').textContent = t || 'Listening…'; },
        onFinal: (t) => { $('#voiceInterim').textContent = ''; C.setText(t, true); JX.sound.play('done'); if (S.settings.voice.autoSend !== false && t) send(true); },
        onError: (m) => { if (m) JX.ui.toast(m, 'error', { duration: 6000 }); },
      });
      if (ok) JX.sound.play('listen');
    },
  };

  function setListening(on) {
    micBtn.classList.toggle('active', on); micBtn.setAttribute('aria-pressed', String(on)); micBtn.setAttribute('aria-label', on ? 'Stop listening' : 'Start voice input');
    dock.hidden = false; wave.active = on;
    if (on) { $('#voiceLabel').textContent = 'Listening…'; $('#voiceInterim').textContent = 'Speak now'; requestAnimationFrame(() => dock.classList.add('show')); }
    else { dock.classList.remove('show'); setTimeout(() => { if (!JX.voice.listening) dock.hidden = true; }, 260); }
  }
  function updateMic() {
    const sup = JX.voice.support(); const on = S.settings.voice.enabled;
    micBtn.hidden = !on; micBtn.classList.toggle('unsupported', !sup.stt);
    micBtn.title = !sup.stt ? 'Voice input is not supported in this browser' : 'Voice input (Alt+M)';
  }
  function updateNote() {
    const st = JX.ai.status; const n = $('#modeNote');
    n.textContent = st.state === 'live' ? `Live · ${JX.ai.effective(S.settings).model || st.provider}` : st.state === 'checking' ? 'Connecting…' : st.state === 'offline' ? 'Offline — local tools only' : st.state === 'error' ? 'AI error — ' + (st.reason || 'check Settings → AI') : 'Demo mode — local tools & rules, no AI model';
  }

  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 200) + 'px'; sendBtn.disabled = !input.value.trim(); }

  async function send(fromVoice) {
    const t = input.value.trim(); if (!t || JX.chat.busy) return;
    C.remember(t); input.value = ''; grow(); closeMenu();
    await JX.chat.submit(t, { fromVoice: fromVoice === true });
    if (document.activeElement === document.body) input.focus({ preventScroll: true });
  }

  /* ---------- slash menu ---------- */
  function updateMenu() {
    const v = input.value;
    const m = /^\/([\w-]*)$/.exec(v);
    if (m) { // choosing a command
      items = JX.commands.suggest(m[1]).slice(0, 40); sel = 0;
      if (!items.length) { closeMenu(); return; }
      renderMenu();
    } else if (/^\/[\w-]+\s/.test(v)) { // typed a command: show usage
      const p = JX.commands.parse(v); const c = p && JX.commands.find(p.name);
      if (c && !p.args) { menu.className = 'slash-menu usage show'; menu.innerHTML = `<div class="slash-usage"><code>${esc(c.usage)}</code><span>${esc(c.summary)}</span>${c.example ? `<small>e.g. ${esc(c.example)}</small>` : ''}</div>`; menuOpen = true; input.setAttribute('aria-expanded', 'true'); }
      else closeMenu();
    } else closeMenu();
  }
  function renderMenu() {
    menu.className = 'slash-menu show'; menu.innerHTML = ''; menuOpen = true; input.setAttribute('aria-expanded', 'true');
    let group = null;
    items.forEach((c, i) => {
      if (input.value === '/' && c.group !== group) { group = c.group; menu.append(el('div', { class: 'slash-group', role: 'presentation' }, group)); }
      menu.append(el('button', { type: 'button', class: 'slash-item' + (i === sel ? ' sel' : ''), role: 'option', id: 'si' + i, 'data-i': i, 'aria-selected': i === sel ? 'true' : 'false' },
        el('span', { class: 'si-ic', 'aria-hidden': 'true' }, c.icon), el('span', { class: 'si-main' }, el('b', {}, '/' + c.name), el('small', {}, c.summary)),
        el('span', { class: 'si-tag ' + (c.ai ? 'ai' : 'loc') }, c.ai ? 'AI' : 'local')));
    });
    setSel(sel);
  }
  function setSel(i) {
    sel = (i + items.length) % items.length;
    menu.querySelectorAll('.slash-item').forEach((b) => { const on = +b.dataset.i === sel; b.classList.toggle('sel', on); b.setAttribute('aria-selected', String(on)); if (on) { b.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', b.id); } });
  }
  function closeMenu() { if (!menuOpen) return; menuOpen = false; menu.classList.remove('show'); input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); items = []; }
  function pick(i) { const c = items[i]; if (!c) return; closeMenu(); C.setText('/' + c.name + (c.args === 'none' ? '' : ' '), true); }

  function onKey(e) {
    if (menuOpen && items.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(sel + 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel(sel - 1); return; }
      const q = input.value.slice(1).toLowerCase(), top = items[sel];
      const nameHit = top && (top.name.startsWith(q) || top.aliases.some((a) => a.startsWith(q)) || JX.util.fuzzy(q, top.name) > 0);
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && nameHit)) {
        e.preventDefault(); const c = items[sel];
        const exact = input.value.trim().toLowerCase() === '/' + c.name;
        if (e.key === 'Enter' && exact) { send(); return; }
        pick(sel); return;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); return; }
    if (e.key === 'ArrowUp' && !input.value && hist.length) { e.preventDefault(); if (hIdx === -1) { hIdx = hist.length - 1; } else hIdx = Math.max(0, hIdx - 1); C.setText(hist[hIdx]); return; }
    if (e.key === 'ArrowDown' && hIdx !== -1) { e.preventDefault(); hIdx++; if (hIdx >= hist.length) { hIdx = -1; C.setText(''); } else C.setText(hist[hIdx]); }
  }

  /* ---------- tray actions ---------- */
  async function onTray(e) {
    const b = e.target.closest('[data-tray]'); if (!b) return;
    if (b.dataset.tray === 'cmd') { C.setText('/', true); }
    else if (b.dataset.tray === 'paste') {
      try { const t = await navigator.clipboard.readText(); if (!t) { JX.ui.toast('The clipboard is empty.', 'info'); return; } C.setText((input.value ? input.value + '\n' : '') + t, true); }
      catch { JX.ui.toast('Clipboard access was blocked. Paste with Ctrl/⌘+V instead.', 'warn'); }
    } else if (b.dataset.tray === 'file') $('#fileInput').click();
  }
  async function onFile(e) {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 200 * 1024) { JX.ui.toast('That file is over 200 KB. Please choose a smaller text file.', 'error'); return; }
    if (f.type && !/^text\/|json|xml|javascript|csv|markdown/.test(f.type) && !/\.(txt|md|csv|json|js|ts|py|html|css|log|xml|yml|yaml|java|c|cpp|go|rs|sh|sql)$/i.test(f.name)) { JX.ui.toast('Only text files can be inserted.', 'error'); return; }
    try { const t = await f.text(); if (/\u0000/.test(t.slice(0, 2000))) throw new Error('binary'); C.setText((input.value ? input.value + '\n\n' : '') + t, true); JX.ui.toast(`Inserted “${f.name}” (${JX.ui.fmtBytes(f.size)})`, 'success'); }
    catch { JX.ui.toast('Could not read that file as text.', 'error'); }
  }

  JX.composer = C;
})();
