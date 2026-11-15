/* JARVIX — shared utilities. Classic script (works from file:// too); attaches to the JX namespace. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});

  const hasDOM = typeof document !== 'undefined';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /** Tiny hyperscript helper: el('div', {class:'x', onclick:fn, dataset:{a:1}}, 'text', childEl) */
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
    return n;
  }

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function debounce(fn, ms) {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    return d;
  }

  /** Levenshtein distance (used for forgiving command / intent matching). */
  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /** Subsequence fuzzy score: higher is better, 0 = no match. */
  function fuzzy(query, text) {
    query = query.toLowerCase(); text = text.toLowerCase();
    if (!query) return 1;
    const idx = text.indexOf(query);
    if (idx !== -1) return 100 - idx + (idx === 0 ? 50 : 0);
    let qi = 0, score = 0, last = -2;
    for (let i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) { score += last === i - 1 ? 3 : 1; last = i; qi++; }
    }
    return qi === query.length ? score : 0;
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch { /* fall through */ }
    try {
      const ta = el('textarea', { style: 'position:fixed;opacity:0;top:0;left:0' });
      ta.value = text; document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }

  function download(filename, content, mime = 'text/plain') {
    const url = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
    const a = el('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  const slug = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'jarvix';
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtDateTime = (ts) => new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function relDay(ts) {
    const d = new Date(ts), now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return 'This week';
    if (diff < 31) return 'This month';
    return 'Older';
  }

  /** Strip markdown to speakable plain text. */
  function plainText(md) {
    return String(md)
      .replace(/```[\s\S]*?```/g, ' (code block omitted) ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/\|/g, ' ')
      .replace(/^[-: |]+$/gm, '')
      .replace(/[*_~]{1,3}/g, '')
      .replace(/\$\$?([^$]+)\$\$?/g, '$1')
      .replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ').trim();
  }

  /** Safe localStorage wrappers (storage can be blocked or full). */
  const storage = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
  };

  function emitter() {
    const map = {};
    return {
      on(evt, fn) { (map[evt] = map[evt] || new Set()).add(fn); return () => map[evt].delete(fn); },
      emit(evt, data) { (map[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error('[JARVIX] listener error', evt, e); } }); },
    };
  }

  JX.util = { hasDOM, $, $$, el, esc, uid, clamp, lerp, sleep, debounce, lev, fuzzy, copyText, download, slug, pad, fmtTime, fmtDateTime, relDay, plainText, storage, emitter };
})();
