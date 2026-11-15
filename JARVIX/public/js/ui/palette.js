/* JARVIX — command palette (Ctrl/⌘ K): fuzzy search over commands, conversations and actions. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, el, fuzzy } = JX.util;
  const S = JX.store;
  const ui = JX.ui;

  function entries() {
    const out = [];
    const act = (label, hint, icon, run, kw = '') => out.push({ label, hint, icon, run, kw, kind: 'Action' });
    act('New conversation', 'Alt N', '+', () => ui.newChat());
    act('Open settings', 'Ctrl ,', '⚙', () => ui.openSettings());
    act('Toggle light / dark theme', 'Alt T', '◐', () => S.set('theme', ui.effectiveTheme() === 'dark' ? 'light' : 'dark'), 'theme appearance');
    act('Toggle sidebar', 'Ctrl B', '▤', () => ui.toggleSidebar());
    act('Start voice input', 'Alt M', '🎙', () => { ui.showView('chat'); JX.composer.toggleMic(); }, 'microphone speak');
    act('Stop speaking / generating', 'Esc', '■', () => JX.chat.stop());
    act('Keyboard shortcuts', '?', '⌨', () => ui.openShortcuts());
    ['tasks', 'notes', 'files', 'history', 'activity'].forEach((v) => act('Go to ' + v[0].toUpperCase() + v.slice(1), '', '→', () => ui.showView(v), 'open view'));
    act('Export current conversation (Markdown)', '', '↓', () => { const c = S.active(); c && c.messages.length ? ui.exportConversation(c, 'md') : ui.toast('Nothing to export yet.', 'warn'); });
    JX.commands.list.forEach((c) => out.push({ label: '/' + c.name, hint: c.summary, icon: c.icon, kind: c.ai ? 'AI command' : 'Command', kw: c.aliases.join(' ') + ' ' + c.group, run: () => { ui.showView('chat'); if (c.args === 'none') JX.chat.submit('/' + c.name); else JX.composer.setText('/' + c.name + ' ', true); } }));
    S.conversations.slice(0, 40).forEach((c) => out.push({ label: c.title, hint: `${c.messages.length} messages`, icon: '💬', kind: 'Conversation', kw: '', run: () => { S.setActive(c.id); ui.showView('chat'); } }));
    return out;
  }

  ui.openPalette = function () {
    if (ui.modals.some((m) => m.el.classList.contains('palette'))) return;
    const all = entries(); let shown = [], sel = 0;
    const input = el('input', { class: 'pal-input', placeholder: 'Search commands, conversations and actions…', 'aria-label': 'Search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palList', 'aria-autocomplete': 'list', 'data-autofocus': '', autocomplete: 'off', spellcheck: 'false' });
    const list = el('div', { class: 'pal-list', id: 'palList', role: 'listbox' });
    const m = ui.modal({ hideHeader: true, size: 'palette', className: 'palette', content: el('div', {}, el('div', { class: 'pal-top' }, el('span', { html: JX.icon('search', 18) }), input, el('kbd', {}, 'Esc')), list) });
    function draw() {
      const q = input.value.trim();
      shown = (q ? all.map((e) => ({ e, s: Math.max(fuzzy(q, e.label) * 2, fuzzy(q, e.kw || ''), fuzzy(q, e.hint || '') * 0.4) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.e) : all).slice(0, 60);
      sel = 0; list.innerHTML = '';
      if (!shown.length) return list.append(el('div', { class: 'pal-empty' }, `No results for “${q}”`));
      let kind = null;
      shown.forEach((e, i) => {
        if (!q && e.kind !== kind) { kind = e.kind; list.append(el('div', { class: 'slash-group' }, kind + 's')); }
        list.append(el('button', { type: 'button', class: 'pal-item' + (i === 0 ? ' sel' : ''), role: 'option', id: 'pal-' + i, 'data-i': i, onclick: () => run(i), onmousemove: () => { if (sel !== i) { sel = i; mark(); } } }, el('span', { class: 'si-ic' }, e.icon), el('span', { class: 'si-main' }, el('b', {}, e.label), e.hint ? el('small', {}, e.hint) : null), el('span', { class: 'si-tag ' + (e.kind === 'AI command' ? 'ai' : 'loc') }, e.kind)));
      });
    }
    function mark() { list.querySelectorAll('.pal-item').forEach((n) => { const on = +n.dataset.i === sel; n.classList.toggle('sel', on); if (on) { n.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', n.id); } }); }
    function run(i) { const e = shown[i]; if (!e) return; m.close(); setTimeout(() => e.run(), 60); }
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    draw();
  };
  $('#paletteBtn') && $('#paletteBtn').addEventListener('click', () => ui.openPalette());
})();
