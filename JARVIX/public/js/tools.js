/* JARVIX — local utilities (no AI involved): count, random, password, text helpers. All results are computed for real. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const cryptoObj = globalThis.crypto;

  /** Uniform random integer in [0, n) using rejection sampling over crypto.getRandomValues. */
  function randInt(n) {
    if (n <= 0) throw new Error('Range must be positive.');
    const max = 0x100000000, limit = max - (max % n); const buf = new Uint32Array(1);
    do { cryptoObj.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }
  const pick = (arr) => arr[randInt(arr.length)];
  function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- /count ---------- */
  const STOP = new Set('the a an and or but if of to in on at for with is are was were be been it this that as by from not no so do does did have has had i you he she we they my your his her our their its will would can could should may might just than then there here what which who whom how when where why also into about over under more most some any all'.split(' '));
  function count(text) {
    const t = String(text);
    const words = t.match(/[\p{L}\p{N}'’-]+/gu) || [];
    const sentences = (t.match(/[^.!?…]+[.!?…]+(?=\s|$)|[^.!?…]+$/g) || []).filter((s) => /\p{L}|\p{N}/u.test(s));
    const paragraphs = t.split(/\n\s*\n/).filter((p) => p.trim());
    const freq = {};
    for (const w of words) { const k = w.toLowerCase().replace(/^['’-]+|['’-]+$/g, ''); if (k.length > 2 && !STOP.has(k)) freq[k] = (freq[k] || 0) + 1; }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    const mins = (n) => (words.length ? (words.length / n < 1 ? '< 1 min' : Math.round(words.length / n) + ' min') : '0 min');
    return {
      words: words.length, characters: [...t].length, charactersNoSpaces: [...t.replace(/\s/g, '')].length,
      sentences: sentences.length, paragraphs: paragraphs.length, lines: t.split('\n').length,
      avgWord: words.length ? (words.reduce((s, w) => s + w.length, 0) / words.length) : 0,
      reading: mins(238), speaking: mins(150), top,
    };
  }
  function countMd(text) {
    const c = count(text);
    const rows = [['Words', c.words], ['Characters', c.characters], ['Characters (no spaces)', c.charactersNoSpaces], ['Sentences', c.sentences], ['Paragraphs', c.paragraphs], ['Lines', c.lines], ['Average word length', c.avgWord.toFixed(1)], ['Reading time', c.reading], ['Speaking time', c.speaking]];
    let md = '| Metric | Value |\n|---|--:|\n' + rows.map((r) => `| ${r[0]} | ${typeof r[1] === 'number' ? r[1].toLocaleString() : r[1]} |`).join('\n');
    if (c.top.length) md += '\n\n**Most frequent words:** ' + c.top.map(([w, n]) => `\`${w}\` ×${n}`).join(', ');
    return md;
  }

  /* ---------- /random ---------- */
  const hex = (n) => Array.from(cryptoObj.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
  function uuid() {
    if (cryptoObj.randomUUID) return cryptoObj.randomUUID();
    const b = cryptoObj.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  function random(args) {
    const a = String(args || '').trim(); const low = a.toLowerCase(); let m;
    if (!a) return `🎲 **${1 + randInt(100)}** _(random number from 1 to 100)_`;
    if (/^(coin|flip|toss)/.test(low)) return `🪙 **${randInt(2) ? 'Heads' : 'Tails'}**`;
    if ((m = /^(?:dice|die|roll)\s*(?:(\d{1,2})?\s*d\s*(\d{1,4}))?$/.exec(low))) {
      const n = m[1] ? +m[1] : 1, s = m[2] ? +m[2] : 6; if (s < 2 || n < 1) throw new Error('Dice need at least 1 die with 2+ sides.');
      const rolls = Array.from({ length: n }, () => 1 + randInt(s)); const sum = rolls.reduce((x, y) => x + y, 0);
      return `🎲 **${n}d${s}** → ${rolls.join(' + ')}${n > 1 ? ` = **${sum}**` : ''}`;
    }
    if (/^uuid/.test(low)) return '```\n' + uuid() + '\n```\n_UUID v4_';
    if ((m = /^hex\s*(\d+)?$/.exec(low))) { const n = Math.min(64, Math.max(1, m[1] ? +m[1] : 8)); return '```\n' + hex(n) + '\n```\n_' + n + ' random bytes, hex-encoded_'; }
    if (/^colou?r/.test(low)) { const c = '#' + hex(3); return `🎨 \`${c}\``; }
    if ((m = /^shuffle\s+(.+)$/i.exec(a))) { const items = m[1].split(/\s*,\s*/).filter(Boolean); return shuffle(items).map((x, i) => `${i + 1}. ${x}`).join('\n'); }
    if ((m = /^(?:pick|choose|choice)\s+(.+)$/.exec(a)) || (m = /^(.+[,|].+)$/.exec(a) && ['', a])) {
      const items = m[1].split(/\s*[,|]\s*|\s+or\s+/i).map((s) => s.trim()).filter(Boolean);
      if (items.length < 2) throw new Error('Give me at least two options, separated by commas.');
      return `🎯 **${pick(items)}**  _(picked from ${items.length} options)_`;
    }
    const nums = a.match(/-?\d+(?:\.\d+)?/g);
    if (nums && nums.length <= 2 && /^[\s\d.,\-–to]+$/i.test(a.replace(/\bto\b/gi, ' '))) {
      let lo = 1, hi; if (nums.length === 1) hi = +nums[0]; else { lo = +nums[0]; hi = +nums[1]; }
      if (lo > hi) [lo, hi] = [hi, lo];
      if (![lo, hi].every(Number.isFinite) || hi - lo > 2 ** 32 - 2) throw new Error('That range is too large.');
      if (nums.some((n) => n.includes('.'))) { const v = lo + (randInt(1e9) / 1e9) * (hi - lo); return `🎲 **${Number(v.toFixed(6))}** _(between ${lo} and ${hi})_`; }
      return `🎲 **${lo + randInt(hi - lo + 1)}** _(between ${lo} and ${hi})_`;
    }
    throw new Error('Try `/random`, `/random 1 50`, `/random coin`, `/random dice 2d6`, `/random pick pizza, sushi, tacos`, `/random uuid`, `/random hex 16` or `/random color`.');
  }

  /* ---------- /password ---------- */
  function password(args) {
    const a = String(args || '').toLowerCase();
    let len = 20; const mLen = /\b(\d{1,3})\b/.exec(a); if (mLen) len = Math.min(128, Math.max(8, +mLen[1]));
    const sets = { lower: 'abcdefghijkmnopqrstuvwxyz', upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digit: '23456789', symbol: '!@#$%^&*()-_=+[]{};:,.?' };
    const use = { lower: !/\bnolower\b/.test(a), upper: !/\bnoupper\b/.test(a), digit: !/\b(nonumbers?|nodigits?)\b/.test(a), symbol: !/\b(nosymbols?|alnum)\b/.test(a) };
    const active = Object.keys(use).filter((k) => use[k]);
    if (!active.length) throw new Error('At least one character type must be enabled.');
    const pool = active.map((k) => sets[k]).join('');
    const chars = active.map((k) => pick([...sets[k]]));
    while (chars.length < len) chars.push(pick([...pool]));
    const pw = shuffle(chars).join('');
    const bits = Math.round(len * Math.log2(pool.length));
    const rating = bits >= 128 ? 'excellent' : bits >= 80 ? 'very strong' : bits >= 60 ? 'strong' : bits >= 40 ? 'fair' : 'weak';
    return { password: pw, bits, rating, md: '```\n' + pw + '\n```\n' + `**${len} characters** · ~${bits} bits of entropy (${rating}) · generated locally with the browser's cryptographic random number generator.\n\n_This message is not saved to history and is never sent to an AI provider. Options: \`/password 32 nosymbols\`._` };
  }

  /* ---------- demo-mode local text helpers ---------- */
  function sentences(text) { return (String(text).replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || []).map((s) => s.trim()).filter((s) => s.length > 3); }
  /** Extractive summary: picks the highest-scoring sentences (word-frequency scoring), in original order. */
  function summarize(text, n) {
    const ss = sentences(text);
    if (ss.length <= 2) return ss.join(' ');
    const freq = {};
    (text.toLowerCase().match(/[\p{L}']+/gu) || []).forEach((w) => { if (w.length > 2 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1; });
    const scored = ss.map((s, i) => ({ s, i, score: ((s.toLowerCase().match(/[\p{L}']+/gu) || []).reduce((t, w) => t + (freq[w] || 0), 0)) / Math.sqrt((s.match(/\s/g) || []).length + 3) }));
    const k = n || Math.max(2, Math.min(4, Math.round(ss.length / 4)));
    return scored.sort((a, b) => b.score - a.score).slice(0, k).sort((a, b) => a.i - b.i).map((x) => x.s).join(' ');
  }
  const CONTRACT = { dont: "don't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't", doesnt: "doesn't", didnt: "didn't", im: "I'm", ive: "I've", youre: "you're", thats: "that's", theres: "there's", wasnt: "wasn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", teh: 'the', recieve: 'receive', definately: 'definitely', seperate: 'separate', occured: 'occurred', alot: 'a lot', adress: 'address', untill: 'until', wich: 'which', thier: 'their', becuase: 'because', beleive: 'believe' };
  /** Light, rule-based clean-up (NOT an AI rewrite): spacing, capitalisation, common typos, ending punctuation. */
  function tidy(text) {
    let t = String(text).replace(/[ \t]+/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/([,;:!?])(?=[^\s\d"')\]])/g, '$1 ').replace(/\bi\b/g, 'I');
    t = t.replace(/\b[a-z]+\b/gi, (w) => (CONTRACT[w.toLowerCase()] ? (w[0] === w[0].toUpperCase() && CONTRACT[w.toLowerCase()][0] !== 'I' ? CONTRACT[w.toLowerCase()][0].toUpperCase() + CONTRACT[w.toLowerCase()].slice(1) : CONTRACT[w.toLowerCase()]) : w));
    t = t.replace(/(^|[.!?]\s+|\n)([a-z])/g, (m, p, c) => p + c.toUpperCase());
    return t.trim().split('\n').map((l) => (l && /[\p{L}\p{N}]$/u.test(l) ? l + '.' : l)).join('\n');
  }
  /** Parse "term: definition" lines → [[term, def]] */
  function pairs(text) {
    return String(text).split(/\n|;/).map((l) => l.trim().replace(/^[-*•\d.)\s]+/, '')).map((l) => {
      const m = /^(.{1,80}?)\s*(?::{1,2}|\s[-–—=]\s|\t)\s*(.+)$/.exec(l); return m ? [m[1].trim(), m[2].trim()] : null;
    }).filter(Boolean);
  }
  /** Multiple-choice quiz built from term/definition pairs (needs ≥ 4). Returns markdown with a ```quiz block. */
  function quizFromPairs(ps, n) {
    const items = shuffle(ps).slice(0, n || Math.min(10, ps.length)); const L = ['A', 'B', 'C', 'D'];
    const out = items.map((p, i) => {
      const wrong = shuffle(ps.filter((x) => x !== p)).slice(0, 3).map((x) => x[1]);
      const opts = shuffle([p[1], ...wrong]); const ans = L[opts.indexOf(p[1])];
      return `Q${i + 1}: Which definition matches “${p[0]}”?\n` + opts.map((o, k) => `${L[k]}) ${o}`).join('\n') + `\nAnswer: ${ans}\nWhy: ${p[0]} — ${p[1]}`;
    });
    return '```quiz\n' + out.join('\n\n') + '\n```';
  }
  const flashFromPairs = (ps) => '```flashcards\n' + ps.map((p) => `${p[0]} :: ${p[1]}`).join('\n') + '\n```';

  JX.tools = { randInt, pick, shuffle, count, countMd, random, password, uuid, summarize, tidy, pairs, quizFromPairs, flashFromPairs };
})();
