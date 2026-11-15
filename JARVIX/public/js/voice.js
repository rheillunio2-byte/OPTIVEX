/* JARVIX — voice engine: speech-to-text (Web Speech API), text-to-speech (speechSynthesis) and live mic level.
 * The microphone is only ever opened after an explicit user action (the mic button / Alt+M). */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { emitter, plainText } = JX.util;
  const bus = emitter();
  const S = JX.store;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasTTS = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const V = { on: bus.on, listening: false, speaking: false, interim: '' };
  let rec = null, stream = null, actx = null, analyser = null, levelRaf = 0, speakTimer = 0, speakQueue = 0;

  V.support = () => ({ stt: !!SR, tts: hasTTS, mic: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) });

  const ERR = {
    'not-allowed': 'Microphone permission was denied. Allow it in your browser\'s site settings to use voice input.',
    'service-not-allowed': 'Speech recognition is blocked for this page.',
    'no-speech': 'I didn\'t hear anything. Press the mic and try again.',
    'audio-capture': 'No microphone was found.',
    network: 'Speech recognition needs an internet connection in this browser (it uses an online service).',
    aborted: '', 'language-not-supported': 'That recognition language is not supported.',
  };

  /* ---- mic level meter ---- */
  async function openMeter() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      actx = new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!analyser) return; analyser.getByteTimeDomainData(buf); let s = 0; for (const b of buf) { const v = (b - 128) / 128; s += v * v; }
        const rms = Math.sqrt(s / buf.length); JX.core.level = JX.util.lerp(JX.core.level, Math.min(1, rms * 4.5), 0.35); levelRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* meter is optional: recognition may still work, waveform falls back to a gentle idle pulse */ analyser = null; levelRaf = requestAnimationFrame(function fake() { if (!V.listening) return; JX.core.level = 0.15 + 0.12 * Math.sin(performance.now() / 180); levelRaf = requestAnimationFrame(fake); }); }
  }
  function closeMeter() {
    cancelAnimationFrame(levelRaf); analyser = null;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (actx) { actx.close().catch(() => {}); actx = null; }
    JX.core.level = 0;
  }

  /* ---- speech to text ---- */
  V.startListening = async function ({ onInterim, onFinal, onError } = {}) {
    if (!SR) { onError && onError('Speech recognition isn\'t supported in this browser. Try Chrome, Edge or Safari — or keep typing.'); return false; }
    if (V.listening) return true;
    V.stopSpeaking();
    rec = new SR(); rec.lang = S.settings.voice.lang || 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    let finalText = '', failed = false, startTimer = 0;
    rec.onstart = () => { clearTimeout(startTimer); V.listening = true; V.interim = ''; JX.core.set('listening'); bus.emit('listening', true); };
    rec.onresult = (e) => {
      let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
      V.interim = (finalText + interim).trim(); onInterim && onInterim(V.interim);
    };
    rec.onerror = (e) => { failed = true; clearTimeout(startTimer); const m = ERR[e.error]; if (m !== '') onError && onError(m || `Speech recognition error: ${e.error}`); };
    rec.onend = () => {
      clearTimeout(startTimer); V.listening = false; closeMeter(); bus.emit('listening', false);
      if (JX.core.state === 'listening') JX.core.set('idle');
      const text = (finalText || V.interim).trim(); V.interim = '';
      if (text && !failed) onFinal && onFinal(text);
    };
    try {
      rec.start(); openMeter();
      startTimer = setTimeout(() => { // never started (permission prompt ignored, no audio service, headless...) → don't fail silently
        if (V.listening) return; failed = true; try { rec.abort(); } catch { /* ignore */ } closeMeter();
        onError && onError('Voice input didn\'t start. Check that the microphone is allowed for this site and that you\'re online — or just keep typing.');
      }, 6000);
      return true;
    } catch { onError && onError('Could not start the microphone.'); return false; }
  };
  V.stopListening = function (abort) { if (rec && V.listening) { try { abort ? rec.abort() : rec.stop(); } catch { /* ignore */ } } };

  /* ---- text to speech ---- */
  V.getVoices = () => new Promise((res) => {
    if (!hasTTS) return res([]);
    const v = speechSynthesis.getVoices(); if (v.length) return res(v);
    const t = setTimeout(() => res(speechSynthesis.getVoices()), 350); // don't make speech wait long if the list never loads
    speechSynthesis.addEventListener('voiceschanged', () => { clearTimeout(t); res(speechSynthesis.getVoices()); }, { once: true });
  });
  function chunks(text) {
    const out = []; let cur = '';
    for (const s of text.replace(/\s+/g, ' ').match(/[^.!?;:\n]+[.!?;:]*\s*/g) || [text]) { if ((cur + s).length > 180 && cur) { out.push(cur); cur = s; } else cur += s; }
    if (cur.trim()) out.push(cur); return out.map((x) => x.trim()).filter(Boolean);
  }
  function setSpeaking(on) {
    if (V.speaking === on) return; V.speaking = on; bus.emit('speaking', on);
    clearInterval(speakTimer);
    if (on) { // speechSynthesis exposes no audio tap, so the waveform is a gentle synthetic envelope while speaking
      if (JX.core.state !== 'thinking') JX.core.set('responding');
      let ph = 0; speakTimer = setInterval(() => { ph += 0.5; JX.core.level = 0.25 + 0.25 * Math.abs(Math.sin(ph)) + Math.random() * 0.2; }, 70);
    } else { JX.core.level = 0; if (JX.core.state === 'responding' && !(JX.chat && JX.chat.busy)) JX.core.set('idle'); }
  }
  V.speak = async function (md, { force } = {}) {
    if (!hasTTS) return false; const vs = S.settings.voice;
    if (!force && !vs.enabled) return false;
    const text = plainText(md).replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 4000); if (!text) return false;
    speechSynthesis.cancel(); const id = ++speakQueue; const parts = chunks(text);
    const voices = await V.getVoices(); const chosen = voices.find((v) => v.voiceURI === vs.voiceURI) || voices.find((v) => v.lang === vs.lang && v.default) || null;
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p); u.rate = vs.rate; u.pitch = vs.pitch; if (chosen) { u.voice = chosen; u.lang = chosen.lang; } else u.lang = vs.lang;
      if (i === 0) u.onstart = () => id === speakQueue && setSpeaking(true);
      u.onend = () => { if (i === parts.length - 1 && id === speakQueue) setSpeaking(false); };
      u.onerror = (ev) => { if (ev.error !== 'canceled' && ev.error !== 'interrupted' && id === speakQueue) setSpeaking(false); };
      speechSynthesis.speak(u);
    });
    return true;
  };
  V.stopSpeaking = function () { speakQueue++; if (hasTTS) speechSynthesis.cancel(); setSpeaking(false); };
  V.stopAll = function () { V.stopListening(true); V.stopSpeaking(); };

  window.addEventListener('beforeunload', () => { if (hasTTS) speechSynthesis.cancel(); closeMeter(); });
  JX.voice = V;
})();
