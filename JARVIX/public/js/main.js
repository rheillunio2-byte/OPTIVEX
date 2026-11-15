/* JARVIX — bootstrap: load state, wire modules, global shortcuts. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $ } = JX.util;
  const S = JX.store, ui = JX.ui;

  function boot() {
    S.load();
    JX.theme.apply('*');
    $('#brandLogo').innerHTML = JX.logo(36);
    ui.fillIcons();

    JX.messages.init();
    JX.composer.init();
    JX.sidebar.init();
    JX.views.init();

    // animated visuals
    new JX.Orb($('#orbBig'));
    new JX.Orb($('#orbMini'), { mini: true });
    new JX.Ambient($('#bgCanvas'));

    // core state label next to the title
    const LABEL = { idle: 'Ready', listening: 'Listening…', thinking: 'Thinking…', responding: 'Responding…' };
    JX.core.on((s) => { $('#coreLabel').textContent = LABEL[s] || 'Ready'; });

    // active conversation changes
    S.on('active', () => {
      const c = S.active();
      if (JX.chat.busy) return; // never rebuild the list mid-response
      c && c.messages.length ? JX.messages.switchTo(c) : JX.messages.renderAll(c);
      ui.updateTitle();
    });
    S.on('storage-error', () => ui.toast('Browser storage is full or blocked — new data may not be saved. Export a backup from Settings → Data.', 'error', { duration: 9000 }));

    JX.messages.renderAll(S.active());
    ui.showView('chat');
    JX.ai.refresh().then(() => { ui.renderWelcome(); });

    bindShortcuts();
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest && e.target.closest('.btn'); if (!b || b.disabled || JX.theme.effectiveAnim() === 'off') return;
      const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height);
      const s = JX.util.el('span', { class: 'ripple', style: `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px` });
      b.append(s); setTimeout(() => s.remove(), 600);
    });
    window.addEventListener('beforeunload', () => S.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) S.flush(); });
    window.addEventListener('error', (e) => console.error('[JARVIX] uncaught', e.message));
    window.addEventListener('unhandledrejection', (e) => console.error('[JARVIX] unhandled rejection', e.reason));
    document.body.classList.add('ready');
  }

  function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (mod && k === 'k') { e.preventDefault(); ui.openPalette(); return; }
      if (mod && e.key === ',') { e.preventDefault(); ui.openSettings(); return; }
      if (mod && k === 'b') { e.preventDefault(); ui.toggleSidebar(); return; }
      if (e.altKey && !mod && k === 'n') { e.preventDefault(); ui.newChat(); return; }
      if (e.altKey && !mod && k === 'm') { e.preventDefault(); ui.showView('chat'); JX.composer.toggleMic(); return; }
      if (e.altKey && !mod && k === 't') { e.preventDefault(); S.set('theme', ui.effectiveTheme() === 'dark' ? 'light' : 'dark'); return; }
      if (e.key === '?' && !typing && !mod && !ui.modals.length) { e.preventDefault(); ui.openShortcuts(); return; }
      if (e.key === 'Escape') {
        if (ui.modals.length) { ui.modals[ui.modals.length - 1].close(); return; }
        if (document.querySelector('.app.sidebar-open')) { ui.toggleSidebar(false); return; }
        if (JX.chat.busy || JX.voice.speaking || JX.voice.listening) { JX.chat.stop(); return; }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
