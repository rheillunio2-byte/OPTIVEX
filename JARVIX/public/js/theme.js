/* JARVIX — applies appearance settings (theme, accent, font size, animation level) to the document. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const S = JX.store;

  const ACCENTS = {
    cyan: { a1: '#22d3ee', a2: '#3b82f6', a3: '#8b5cf6', ink: '#0e7490', label: 'Cyan' },
    blue: { a1: '#60a5fa', a2: '#6366f1', a3: '#22d3ee', ink: '#1d4ed8', label: 'Blue' },
    violet: { a1: '#a78bfa', a2: '#7c3aed', a3: '#22d3ee', ink: '#6d28d9', label: 'Violet' },
    emerald: { a1: '#34d399', a2: '#22d3ee', a3: '#3b82f6', ink: '#047857', label: 'Emerald' },
    amber: { a1: '#fbbf24', a2: '#fb923c', a3: '#f472b6', ink: '#b45309', label: 'Amber' },
    rose: { a1: '#fb7185', a2: '#f472b6', a3: '#a78bfa', ink: '#be123c', label: 'Rose' },
  };
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`; };
  const mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const mqMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const effectiveTheme = () => (S.settings.theme === 'system' ? (mqDark && !mqDark.matches ? 'light' : 'dark') : S.settings.theme);
  const reducedMotion = () => !!(mqMotion && mqMotion.matches);
  const effectiveAnim = () => (reducedMotion() ? 'off' : S.settings.animations);

  let first = true;
  function apply(path) {
    const root = document.documentElement;
    const theme = effectiveTheme();
    if (!first && (path === 'theme' || path === '*')) { root.classList.add('theme-fade'); clearTimeout(apply.t); apply.t = setTimeout(() => root.classList.remove('theme-fade'), 600); }
    root.dataset.theme = theme;
    const ac = ACCENTS[S.settings.accent] || ACCENTS.cyan;
    root.style.setProperty('--a1', ac.a1); root.style.setProperty('--a2', ac.a2); root.style.setProperty('--a3', ac.a3);
    root.style.setProperty('--a1-rgb', rgb(ac.a1)); root.style.setProperty('--a2-rgb', rgb(ac.a2)); root.style.setProperty('--a3-rgb', rgb(ac.a3));
    root.style.setProperty('--accent-ink', theme === 'light' ? ac.ink : ac.a1);
    root.style.setProperty('--fs', JX.util.clamp(S.settings.fontSize, 12, 20) + 'px');
    root.dataset.anim = effectiveAnim();
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = theme === 'light' ? '#eef2fa' : '#05070d';
    first = false;
    JX.ui && JX.ui.bus && JX.ui.bus.emit('appearance');
  }
  S.on('settings', apply);
  if (mqDark) mqDark.addEventListener && mqDark.addEventListener('change', () => S.settings.theme === 'system' && apply('theme'));
  if (mqMotion) mqMotion.addEventListener && mqMotion.addEventListener('change', () => apply('*'));

  JX.theme = { apply, ACCENTS, effectiveTheme, reducedMotion, effectiveAnim };
})();
