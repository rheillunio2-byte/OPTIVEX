/* JARVIX — AI core orb, ambient particle background and audio waveform.
 * One shared requestAnimationFrame loop; pauses when the tab is hidden; honours animation level & reduced motion. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { lerp, clamp } = JX.util;
  const S = JX.store;

  /* ---------- core state (what the assistant is "doing") ---------- */
  const core = {
    state: 'idle', level: 0, listeners: new Set(),
    set(s) { if (core.state === s) return; core.state = s; document.body.dataset.core = s; core.listeners.forEach((f) => f(s)); },
    on(f) { core.listeners.add(f); },
  };
  document.body && (document.body.dataset.core = 'idle');

  const TARGET = {
    idle: { energy: 0.35, spin: 0.25, pulse: 0.7, swirl: 0, pull: 0 },
    listening: { energy: 0.75, spin: 0.55, pulse: 1.5, swirl: 0.15, pull: 1 },
    thinking: { energy: 0.95, spin: 2.4, pulse: 2.6, swirl: 1, pull: 0.25 },
    responding: { energy: 0.85, spin: 0.9, pulse: 3.2, swirl: 0.1, pull: -1 },
  };
  const COUNT = { off: 0, low: 14, medium: 30, high: 56 };

  /* colours from CSS accent variables */
  let palette = null;
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const p = (v) => { const [r, g, b] = cs.getPropertyValue(v).trim().split(/\s+/).map(Number); return [r || 34, g || 211, b || 238]; };
    palette = { a1: p('--a1-rgb'), a2: p('--a2-rgb'), a3: p('--a3-rgb'), light: document.documentElement.dataset.theme === 'light' };
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* ---------- Orb ---------- */
  class Orb {
    constructor(canvas, { mini = false } = {}) {
      this.c = canvas; this.ctx = canvas.getContext('2d'); this.mini = mini; this.t = Math.random() * 100;
      this.p = { ...TARGET.idle }; this.parts = []; this.dpr = 1; this.w = 0; this.h = 0;
      this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null; this.ro && this.ro.observe(canvas);
      this.resize(); loop.add(this);
    }
    resize() {
      const r = this.c.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
      this.draw(0);
    }
    target() { return this.mini ? Math.max(0, Math.round(COUNT[JX.theme.effectiveAnim()] * 0.45)) : COUNT[JX.theme.effectiveAnim()]; }
    spawn(init) {
      const R = Math.min(this.w, this.h) / 2;
      const a = Math.random() * Math.PI * 2, r = R * (init ? 0.45 + Math.random() * 0.55 : this.p.pull < -0.3 ? 0.33 : 0.95);
      return { a, r, v: (0.2 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1), s: 0.6 + Math.random() * 1.6, life: init ? Math.random() : 0, hue: Math.floor(Math.random() * 3) };
    }
    update(dt) {
      const tgt = TARGET[core.state] || TARGET.idle; const k = 1 - Math.exp(-dt * 4);
      for (const key of Object.keys(tgt)) this.p[key] = lerp(this.p[key], tgt[key], k);
      this.t += dt * (0.4 + this.p.spin);
      const want = this.target();
      while (this.parts.length < want) this.parts.push(this.spawn(true));
      if (this.parts.length > want) this.parts.length = want;
      const R = Math.min(this.w, this.h) / 2;
      for (const q of this.parts) {
        q.life += dt * (0.15 + this.p.energy * 0.25);
        q.a += (q.v * (0.25 + this.p.spin * 0.5) + this.p.swirl * 1.8) * dt;
        q.r += -this.p.pull * R * 0.22 * dt * (0.4 + core.level);
        if (this.p.pull === 0) q.r += Math.sin(this.t + q.a * 3) * 0.1;
        if (q.r < R * 0.3 || q.r > R * 1.02 || q.life > 1) Object.assign(q, this.spawn(false), { life: 0 });
      }
    }
    draw(dt) {
      const { ctx, w, h, dpr, p } = this; if (!palette) readPalette();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2;
      const still = JX.theme.effectiveAnim() === 'off';
      const beat = still ? 0 : (Math.sin(this.t * p.pulse * 1.6) * 0.5 + 0.5) * 0.045 * p.energy + core.level * 0.1;
      const coreR = R * (0.42 + beat);
      // outer glow
      let g = ctx.createRadialGradient(cx, cy, coreR * 0.6, cx, cy, R);
      g.addColorStop(0, rgba(palette.a1, 0.30 * p.energy + 0.08)); g.addColorStop(0.55, rgba(palette.a2, 0.10 + 0.08 * p.energy)); g.addColorStop(1, rgba(palette.a3, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // rings
      const rings = this.mini ? 1 : 3;
      for (let i = 0; i < rings; i++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.t * (0.5 + i * 0.35) * (i % 2 ? -1 : 1) + i);
        ctx.scale(1, 0.34 + i * 0.22);
        ctx.beginPath(); ctx.arc(0, 0, R * (0.72 + i * 0.1), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(palette[['a1', 'a2', 'a3'][i]], 0.28 + 0.3 * p.energy); ctx.lineWidth = this.mini ? 1.2 : 1.4;
        ctx.setLineDash(i === 1 ? [3, 7] : i === 2 ? [18, 10] : []); ctx.stroke(); ctx.restore();
      }
      // particles
      for (const q of this.parts) {
        const x = cx + Math.cos(q.a) * q.r, y = cy + Math.sin(q.a) * q.r * 0.92;
        const alpha = Math.sin(clamp(q.life, 0, 1) * Math.PI) * (0.35 + p.energy * 0.6);
        ctx.beginPath(); ctx.arc(x, y, q.s * (this.mini ? 0.7 : 1) * (1 + core.level), 0, Math.PI * 2);
        ctx.fillStyle = rgba(palette[['a1', 'a2', 'a3'][q.hue]], alpha); ctx.fill();
      }
      // core sphere
      g = ctx.createRadialGradient(cx - coreR * 0.35, cy - coreR * 0.4, coreR * 0.05, cx, cy, coreR);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.25, rgba(palette.a1, 0.95)); g.addColorStop(0.7, rgba(palette.a2, 0.9)); g.addColorStop(1, rgba(palette.a3, 0.85));
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      // energy ripple (responding / listening)
      if (!still && (core.state === 'responding' || core.state === 'listening')) {
        const ph = (this.t * 0.9) % 1; ctx.beginPath(); ctx.arc(cx, cy, coreR * (1 + ph * 0.8), 0, Math.PI * 2);
        ctx.strokeStyle = rgba(palette.a1, (1 - ph) * 0.5); ctx.lineWidth = 2; ctx.stroke();
      }
      if (core.state === 'thinking' && !still) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.t * 3);
        ctx.beginPath(); ctx.arc(0, 0, coreR * 1.22, 0, Math.PI * 0.55); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = this.mini ? 1.6 : 2.4; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
      }
    }
    destroy() { loop.remove(this); this.ro && this.ro.disconnect(); }
  }

  /* ---------- ambient background ---------- */
  class Ambient {
    constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.pts = []; this.resize(); window.addEventListener('resize', () => this.resize()); loop.add(this, 30); }
    resize() { this.dpr = Math.min(1.5, window.devicePixelRatio || 1); this.w = innerWidth; this.h = innerHeight; this.c.width = this.w * this.dpr; this.c.height = this.h * this.dpr; this.c.style.width = this.w + 'px'; this.c.style.height = this.h + 'px'; this.pts = []; }
    update(dt) {
      const want = { off: 0, low: 0, medium: Math.round(this.w * this.h / 32000), high: Math.round(this.w * this.h / 16000) }[JX.theme.effectiveAnim()];
      const n = Math.min(90, want);
      while (this.pts.length < n) this.pts.push({ x: Math.random() * this.w, y: Math.random() * this.h, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, r: 0.6 + Math.random() * 1.4 });
      if (this.pts.length > n) this.pts.length = n;
      for (const p of this.pts) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 0) p.x = this.w; if (p.x > this.w) p.x = 0; if (p.y < 0) p.y = this.h; if (p.y > this.h) p.y = 0; }
    }
    draw() {
      const { ctx } = this; if (!palette) readPalette(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
      const base = palette.light ? 0.5 : 1; const pts = this.pts;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = dx * dx + dy * dy;
          if (d < 14000) { ctx.strokeStyle = rgba(palette.a2, (1 - d / 14000) * 0.16 * base); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
        }
        ctx.fillStyle = rgba(palette.a1, 0.45 * base); ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, pts[i].r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* ---------- waveform (mic level / speech level) ---------- */
  class Wave {
    constructor(canvas) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.hist = new Array(56).fill(0); this.acc = 0; this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.resize()) : null; this.ro && this.ro.observe(canvas); this.resize(); this.active = false; loop.add(this, 40); }
    resize() { const r = this.c.getBoundingClientRect(); this.dpr = Math.min(2, devicePixelRatio || 1); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.c.width = this.w * this.dpr; this.c.height = this.h * this.dpr; }
    update(dt) { this.acc += dt; if (this.acc > 0.04) { this.acc = 0; this.hist.shift(); this.hist.push(this.active ? core.level : 0); } }
    draw() {
      const { ctx, w, h } = this; if (!palette) readPalette(); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const n = this.hist.length, bw = w / n; const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, rgba(palette.a1, 0.95)); g.addColorStop(1, rgba(palette.a3, 0.95)); ctx.fillStyle = g;
      for (let i = 0; i < n; i++) {
        const v = Math.max(0.06, this.hist[i]); const bh = Math.max(2, v * h * 0.95);
        const x = i * bw + bw * 0.2, y = (h - bh) / 2; const r = Math.min(bw * 0.3, 2);
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, bw * 0.6, bh, r) : ctx.rect(x, y, bw * 0.6, bh); ctx.fill();
      }
    }
  }

  /* ---------- shared loop ---------- */
  const loop = {
    items: new Map(), last: 0, raf: 0, running: false,
    add(it, fps) { this.items.set(it, { fps: fps || 60, acc: 0 }); this.start(); },
    remove(it) { this.items.delete(it); },
    start() { if (this.running) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.tick(t)); },
    tick(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      const anim = JX.theme.effectiveAnim(); const frozen = anim === 'off' || document.hidden;
      if (!frozen) {
        for (const [it, st] of this.items) {
          st.acc += dt; if (st.acc < 1 / st.fps - 0.001) continue; const d = st.acc; st.acc = 0;
          if (it.c && !it.c.isConnected) { this.items.delete(it); continue; }
          if (it.c && it.c.offsetParent === null && !it.c.closest('[data-keep-alive]')) continue; // hidden → skip work
          it.update(d); it.draw(d);
        }
      }
      this.raf = requestAnimationFrame((t) => this.tick(t));
    },
    /** redraw once (used when animations are off and something changed) */
    refresh() { for (const [it] of this.items) { try { it.update(0.016); it.draw(0.016); } catch { /* ignore */ } } },
  };
  S.on('settings', () => { palette = null; setTimeout(() => { readPalette(); loop.refresh(); }, 30); });

  JX.core = core; JX.Orb = Orb; JX.Ambient = Ambient; JX.Wave = Wave; JX.motion = loop; JX.refreshPalette = () => { palette = null; };
})();
