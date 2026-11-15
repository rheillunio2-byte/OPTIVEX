/* JARVIX — UI core: event bus, toasts, accessible modals, confirm dialog, icon hydration. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, el, emitter } = JX.util;

  const ui = (JX.ui = JX.ui || {});
  ui.bus = emitter();
  ui.reducedMotion = () => JX.theme.reducedMotion();
  ui.effectiveTheme = () => JX.theme.effectiveTheme();
  const animOff = () => JX.theme.effectiveAnim() === 'off';

  /** Replace <span class="ic-slot" data-icon="x"> placeholders with SVG icons. */
  ui.fillIcons = function (root = document) {
    root.querySelectorAll('.ic-slot[data-icon]').forEach((s) => { if (!s.firstChild) s.innerHTML = JX.icon(s.dataset.icon, +s.dataset.size || 18); });
  };
  ui.iconButton = (name, label, onclick, cls = 'icon-btn') => el('button', { type: 'button', class: cls, 'aria-label': label, title: label, html: JX.icon(name), onclick });

  /* ---------- toasts ---------- */
  ui.toast = function (message, type = 'info', opts = {}) {
    const host = $('#toasts'); if (!host) return;
    const icon = { success: 'check', error: 'alert', info: 'info', warn: 'alert' }[type] || 'info';
    const dur = opts.duration || (type === 'error' ? 6500 : 3400);
    const t = el('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status', style: `--dur:${dur}ms` },
      el('span', { class: 'toast-ic', html: JX.icon(icon, 18) }),
      el('span', { class: 'toast-msg' }, message),
      opts.action ? el('button', { type: 'button', class: 'toast-act', onclick: () => { opts.action.run(); remove(); } }, opts.action.label) : null,
      el('button', { type: 'button', class: 'toast-x', 'aria-label': 'Dismiss', html: JX.icon('x', 14), onclick: () => remove() }),
      el('i', { class: 'toast-bar' }));
    host.append(t);
    while (host.children.length > 4) host.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('in'));
    let timer = setTimeout(remove, dur);
    t.addEventListener('mouseenter', () => { clearTimeout(timer); t.classList.add('paused'); });
    t.addEventListener('mouseleave', () => { t.classList.remove('paused'); timer = setTimeout(remove, 1500); });
    function remove() { clearTimeout(timer); if (!t.isConnected) return; t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), animOff() ? 0 : 260); }
    JX.sound && JX.sound.play(type === 'error' ? 'error' : 'notify');
    return { remove };
  };

  /* ---------- modals ---------- */
  ui.modals = [];
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  /**
   * ui.modal({title, content, footer, size, className, onClose}) → {el, close(result), closed:Promise}
   */
  ui.modal = function ({ title, content, footer, size = 'md', className = '', onClose, hideHeader } = {}) {
    const host = $('#modalHost'); const prevFocus = document.activeElement; const titleId = JX.util.uid('mt');
    let resolve; const closed = new Promise((r) => (resolve = r));
    const closeBtn = el('button', { type: 'button', class: 'icon-btn modal-x', 'aria-label': 'Close dialog', html: JX.icon('x') });
    const dialog = el('div', { class: `modal modal-${size} ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title ? titleId : null, tabindex: '-1' },
      hideHeader ? null : el('header', { class: 'modal-head' }, el('h2', { id: titleId }, title || ''), closeBtn),
      el('div', { class: 'modal-body' }, content),
      footer && footer.length ? el('footer', { class: 'modal-foot' }, footer) : null);
    const backdrop = el('div', { class: 'modal-backdrop' }, dialog);
    host.append(backdrop);
    const api = { el: dialog, closed, close };
    ui.modals.push(api);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => backdrop.classList.add('open'));
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    closeBtn.addEventListener('click', () => close());
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const f = [...dialog.querySelectorAll(FOCUSABLE)].filter((x) => x.offsetParent !== null); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    setTimeout(() => { const auto = dialog.querySelector('[data-autofocus]') || dialog.querySelector('.modal-body input,.modal-body textarea,.modal-body button') || dialog; auto.focus({ preventScroll: true }); }, 30);
    function close(result) {
      if (!backdrop.isConnected) return;
      ui.modals = ui.modals.filter((m) => m !== api);
      if (!ui.modals.length) document.body.classList.remove('modal-open');
      backdrop.classList.remove('open'); backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), animOff() ? 0 : 240);
      onClose && onClose(result); resolve(result);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    }
    return api;
  };

  ui.confirm = function ({ title, body, confirm = 'Confirm', cancel = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const ok = el('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, 'data-autofocus': '' }, confirm);
      const no = el('button', { type: 'button', class: 'btn btn-ghost' }, cancel);
      const m = ui.modal({ title, size: 'sm', content: el('p', { class: 'confirm-body' }, body), footer: [no, ok], onClose: (r) => resolve(r === true) });
      ok.addEventListener('click', () => m.close(true)); no.addEventListener('click', () => m.close(false));
    });
  };

  /** Segmented control helper → element */
  ui.segmented = function (options, value, onChange, label) {
    const wrap = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label || null });
    options.forEach(([v, text]) => {
      const b = el('button', { type: 'button', class: 'seg' + (v === value ? ' on' : ''), role: 'radio', 'aria-checked': v === value ? 'true' : 'false', onclick: () => { wrap.querySelectorAll('.seg').forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('on'); b.setAttribute('aria-checked', 'true'); onChange(v); } }, text);
      wrap.append(b);
    });
    return wrap;
  };
  ui.toggle = function (checked, onChange, label) {
    const i = el('input', { type: 'checkbox', role: 'switch', 'aria-label': label || null }); i.checked = !!checked;
    i.addEventListener('change', () => onChange(i.checked));
    return el('label', { class: 'switch' }, i, el('span', { class: 'switch-track' }, el('i', { class: 'switch-knob' })));
  };

  ui.fmtBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB');

  ui.exportConversation = function (conv, fmt) {
    fmt = ['md', 'txt', 'json'].includes(fmt) ? fmt : 'md';
    const base = JX.util.slug(conv.title) + '-' + new Date().toISOString().slice(0, 10);
    if (fmt === 'json') JX.util.download(base + '.json', JSON.stringify({ app: 'JARVIX', version: 2, conversation: { ...conv, messages: conv.messages.filter((m) => !m.ephemeral) } }, null, 2), 'application/json');
    else if (fmt === 'txt') JX.util.download(base + '.txt', conv.messages.filter((m) => !m.ephemeral).map((m) => `[${new Date(m.ts).toLocaleString()}] ${m.role === 'user' ? 'You' : 'JARVIX'}:\n${m.content}\n`).join('\n'), 'text/plain');
    else JX.util.download(base + '.md', JX.store.toMarkdown(conv), 'text/markdown');
    ui.toast(`Exported “${conv.title}” as .${fmt}`, 'success');
  };

  ui.openShortcuts = function () {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform); const mod = mac ? '⌘' : 'Ctrl'; const alt = mac ? '⌥' : 'Alt';
    const rows = [[`${mod} K`, 'Command palette'], [`${alt} N`, 'New conversation'], [`${mod} B`, 'Toggle sidebar'], [`${mod} ,`, 'Open settings'], [`${alt} M`, 'Start / stop voice input'], [`${alt} T`, 'Toggle light / dark theme'], ['/', 'Focus the message box (or open commands)'], ['Tab', 'Complete the selected command'], ['↑ / ↓', 'Navigate menus · recall earlier messages in an empty box'], ['Esc', 'Stop generating or speaking · close menus & dialogs'], ['?', 'Show this list']];
    ui.modal({ title: 'Keyboard shortcuts', size: 'sm', content: el('table', { class: 'kbd-table' }, el('tbody', {}, rows.map(([k, d]) => el('tr', {}, el('td', {}, k.split(' ').map((x) => el('kbd', {}, x))), el('td', {}, d))))) });
  };
})();
