/* JARVIX — subtle UI sound effects synthesised with the Web Audio API (no audio files). Off by default. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  let ctx = null;
  const TONES = {
    send: [[520, 0, 0.07], [780, 0.06, 0.09]], receive: [[660, 0, 0.08], [990, 0.07, 0.12]], notify: [[880, 0, 0.1], [660, 0.1, 0.12]],
    toggle: [[600, 0, 0.05]], error: [[220, 0, 0.14], [165, 0.12, 0.18]], listen: [[500, 0, 0.06], [750, 0.06, 0.08]], done: [[740, 0, 0.07], [560, 0.07, 0.1]],
  };
  function play(name) {
    const s = JX.store.settings; if (!s.sounds) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const vol = Math.min(1, Math.max(0, s.soundVolume)) * 0.12; const now = ctx.currentTime;
      for (const [f, off, dur] of TONES[name] || []) {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + off); g.gain.exponentialRampToValueAtTime(vol, now + off + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + off + dur);
        o.connect(g).connect(ctx.destination); o.start(now + off); o.stop(now + off + dur + 0.02);
      }
    } catch { /* audio unavailable */ }
  }
  JX.sound = { play };
})();
