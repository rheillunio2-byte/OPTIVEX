/* JARVIX — intent understanding: classify messages, route plain-English requests to local tools, tolerate typos. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});

  /** Optimal-string-alignment distance (adjacent transposition = 1). Substitutions cost 2 for short words so "rate" never becomes "date". */
  function dist(a, b) {
    const sub = Math.max(a.length, b.length) <= 5 ? 2 : 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : sub));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  }

  const VOCAB = 'what whats tell time date day today current the please help commands capabilities add create make new task tasks todo note remember remind calculate compute evaluate solve calc show list open view clear delete remove completed done document file write generate convert that how much is my board save take quick me times plus minus over squared cubed halved doubled then and now also okay it by'.split(' ');
  const TYPOS = { teh: 'the', hte: 'the', waht: 'what', wat: 'what', whta: 'what', wut: 'what', tiem: 'time', taks: 'task', tsak: 'task', calc: 'calculate', calcualte: 'calculate', calcluate: 'calculate' };

  function fixWord(w) {
    if (!/^[a-z]+$/.test(w) || VOCAB.includes(w)) return w;
    if (TYPOS[w]) return TYPOS[w];
    if (w.length < 4) return w;
    const max = w.length <= 6 ? 1 : 2; let best = w, bd = max + 1;
    for (const v of VOCAB) {
      if (Math.abs(v.length - w.length) > max || v[0] !== w[0] && v.length < 6) continue;
      const d = dist(w, v); if (d < bd) { bd = d; best = v; }
    }
    return bd <= max ? best : w;
  }

  const norm = (t) => String(t).toLowerCase().replace(/[’‘]/g, "'").replace(/[?!.…]+$/g, '').replace(/\s+/g, ' ').trim();

  /** Lowercased text with the first few words typo-corrected (1:1 token mapping, so payload can be taken from the original). */
  function corrected(text) {
    const toks = String(text).trim().split(/\s+/);
    const lower = norm(text).split(' ');
    return { orig: toks, fixed: lower.map((w, i) => (i < 6 ? fixWord(w) : w)) };
  }
  /** Original-cased text following a matched prefix. */
  function payloadAfter(fixed, orig, m1) {
    const joined = fixed.join(' ');
    const prefix = joined.slice(0, joined.length - (m1 || '').length).trim();
    const n = prefix ? prefix.split(' ').length : 0;
    return orig.slice(n).join(' ').replace(/^(?:to|that|:|-)\s+/i, (x) => x).trim();
  }

  const MATHY = /^[\d\s()+\-*/^%.,×÷x°!=]+$/;
  const MATH_WORDS = /\b(?:plus|minus|times|multiplied by|divided by|squared|cubed|to the power of|square root of|% of|percent of)\b/;

  /**
   * Route plain English to a local command, or null (→ AI / demo responder).
   * Returns {command, args, note}.
   */
  function route(text, ctx) {
    const raw = String(text || '').trim();
    if (!raw || raw.startsWith('/') || raw.length > 400 || raw.includes('\n')) return null;
    const { orig, fixed } = corrected(raw);
    const fl = fixed.join(' ');
    let m;

    if (/^(?:(?:what(?:'s| is|s)?|tell me|show me|got)\s+)?(?:the\s+)?(?:current\s+|local\s+)?time(?:\s+(?:is it|now|right now|please|today|it is))?$/.test(fl) || /^what time is it(?: now| right now)?$/.test(fl)) return { command: 'time', args: '' };
    if (/^(?:(?:what(?:'s| is|s)?|tell me|show me)\s+)?(?:the\s+)?(?:today'?s?\s+)?(?:date|day)(?:\s+(?:is it|today|is today|now))?$/.test(fl) || /^what day is it(?: today)?$/.test(fl) || /^what(?:'s| is|s) today'?s date$/.test(fl)) return { command: 'date', args: '' };
    if (/^(?:help(?: me)?|what can you do(?: for me)?|what are your (?:commands|capabilities|features)|commands|capabilities|show (?:me )?(?:the )?commands)$/.test(fl)) return { command: 'help', args: '' };

    if ((m = /^(?:please\s+)?(?:clear|delete|remove)\s+(?:all\s+)?(?:completed|done|finished)\s+(?:tasks?|todos?)$/.exec(fl))) return { command: 'todo', args: 'clear' };
    if (/^(?:(?:show|list|open|view|see)\s+(?:me\s+)?|what(?:'s| are|s| is)\s+)?(?:my\s+|the\s+|all\s+)?(?:open\s+)?(?:tasks?|todos?|to-?dos?|task board)(?:\s+list)?$/.test(fl) && /task|todo|to-do/.test(fl)) return { command: 'todo', args: 'list' };

    if ((m = /^(?:please\s+)?(?:(?:add|create|make|new)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:task|todo|to-do|to do)(?:\s+(?:to|for|called|named))?|add to (?:my )?(?:todo|tasks?)(?: list)?|remind me to|todo:?)\s*(.*)$/.exec(fl))) {
      const p = payloadAfter(fixed, orig, m[1]); if (p) return { command: 'todo', args: 'add ' + p.replace(/^to\s+/i, ''), note: true };
    }
    if ((m = /^(?:please\s+)?(?:(?:make|take|add|save|write|create)\s+(?:a\s+)?(?:quick\s+|new\s+)?note(?:\s+(?:that|to self|saying))?|note(?:\s+that)?|remember(?:\s+that)?)\s*:?\s*(.+)$/.exec(fl)) && !/^(?:make|create|write) (?:a )?note(?:s)?(?: file| document)?$/.test(fl)) {
      const p = payloadAfter(fixed, orig, m[1]); if (p) return { command: 'note', args: 'add ' + p, note: true };
    }
    if (/^(?:please\s+)?(?:create|make|write|generate)\s+(?:me\s+)?(?:a\s+|an\s+|a new\s+)?(?:text\s+|markdown\s+|new\s+)?(?:document|doc|file)\b/.test(fl)) {
      const title = (/(?:titled|title|named|called)\s+["“']?(.+?)["”']?(?=\s+(?:and\s+)?(?:save|as|filename|file name|with content|containing|that says)\b|$)/i.exec(raw) || [])[1];
      const file = (/(?:save (?:it )?as|filename|file name)\s+["“']?([^\s"”']+\.[a-z0-9]+)["”']?/i.exec(raw) || [])[1];
      const content = (/(?:with content|containing|that says)\s+["“']?([\s\S]+?)["”']?$/i.exec(raw) || [])[1];
      return { command: 'document', args: [title || 'JARVIX Document', content || '', file || ''].join(' | '), note: true };
    }
    if ((m = /^convert\s+(.+)$/.exec(fl))) return { command: 'convert', args: payloadAfter(fixed, orig, m[1]), note: true };

    // follow-ups on the previous calculation: "times 3", "and then plus 5", "squared"
    if (ctx && ctx.lastCalc != null) {
      if ((m = /^(?:and\s+|then\s+|now\s+|okay\s+|ok\s+)*(plus|minus|times|multiplied by|divided by|over|\+|-|\*|x|\/)\s*(?:it\s+|that\s+)?(?:by\s+)?(-?[\d.]+)$/.exec(fl))) return { command: 'calculate', args: `ans ${m[1]} ${m[2]}`, note: true };
      if ((m = /^(?:and\s+)?(squared|cubed|halved|doubled)$/.exec(fl))) return { command: 'calculate', args: { squared: 'ans^2', cubed: 'ans^3', halved: 'ans/2', doubled: 'ans*2' }[m[1]], note: true };
    }
    // calculations
    let expr = null;
    if ((m = /^(?:please\s+)?(?:calculate|compute|calc|evaluate|solve|what(?:'s| is|s)|how much is)\s+(.+)$/.exec(fl))) expr = payloadAfter(fixed, orig, m[1]);
    else if (/\d/.test(fl) && (MATHY.test(fl) && /[+\-*/^×÷x%!]/.test(fl.replace(/^-/, '')) || MATH_WORDS.test(fl))) expr = raw;
    if (expr) {
      expr = expr.replace(/[=?]+$/, '').trim();
      if (/^[\d\s.,]+$/.test(expr)) expr = null;
    }
    if (expr) {
      try { JX.calc.evaluate(expr, { ans: ctx && ctx.lastCalc != null ? ctx.lastCalc : 0 }); return { command: 'calculate', args: expr, note: /^(what|how|calc|compute|solve|evaluate)/.test(fl) ? false : true }; } catch { /* not maths → fall through */ }
    }
    return null;
  }

  /* ---------- classification (used to shape AI replies and demo behaviour) ---------- */
  const GREET = /^(?:hi+|hello+|hell?o|hey+|heya|hiya|yo|sup|howdy|hola|greetings|good (?:morning|afternoon|evening|day)|morning|evening|what'?s up|wassup|ola)\b/;
  const BYE = /^(?:bye|goodbye|see you|see ya|cya|good night|goodnight|later|take care|ttyl)\b/;
  const THANKS = /^(?:thanks|thank you|thx|ty|cheers|much appreciated|appreciate it|nice one|great job|well done|awesome|perfect)\b/;
  const QUESTION = /^(?:what|why|how|when|where|who|whom|whose|which|is|are|am|was|were|can|could|does|do|did|will|would|should|shall|may|might|has|have)\b/;
  const IMPERATIVE = /^(?:write|create|make|explain|summari[sz]e|translate|give|list|show|tell|generate|draft|fix|rewrite|convert|calculate|compare|define|describe|outline|suggest|recommend|help|find|build|design|plan|teach|solve|review|debug|analy[sz]e|brainstorm|compose|prepare|produce|simplify|improve|edit|proofread)\b/;
  const FOLLOW = /^(?:and|but|so|then|also|what about|how about|why|why not|how so|really|tell me more|more|go on|continue|elaborate|expand|can you|could you|shorter|longer|simpler|again|another|next|ok(?:ay)?|that|this|it|those|them)\b/;

  function classify(text) {
    const t = norm(text);
    const w = t.split(' ').filter(Boolean);
    const first = fixWordGeneric(w[0] || '');
    const head = [first, ...w.slice(1)].join(' ');
    if (!t) return 'empty';
    if (w.length <= 6 && (GREET.test(head) || GREET.test(t))) return 'greeting';
    if (w.length <= 6 && BYE.test(t)) return 'farewell';
    if (w.length <= 6 && THANKS.test(t)) return 'thanks';
    if (/\?\s*$/.test(String(text).trim()) || QUESTION.test(t)) return 'question';
    if (IMPERATIVE.test(t)) return 'instruction';
    return 'statement';
  }
  function fixWordGeneric(w) {
    for (const g of ['hello', 'hey', 'howdy', 'hiya', 'greetings', 'morning', 'evening']) if (w.length >= 4 && dist(w, g) <= 1) return g;
    return w;
  }
  const isFollowUp = (text) => { const t = norm(text); return t.split(' ').length <= 3 || FOLLOW.test(t); };

  function hint(text, hasHistory) {
    const k = classify(text); const out = [];
    if (k === 'greeting' || k === 'thanks' || k === 'farewell') out.push('The user\'s latest message is casual social talk. Reply briefly and naturally (one or two sentences), then optionally offer help.');
    else if (k === 'question') out.push('The user asked a question: answer directly first, then add detail only as the question deserves.');
    else if (k === 'instruction') out.push('The user gave an instruction: carry it out, then offer at most one short follow-up.');
    if (hasHistory && isFollowUp(text)) out.push('This is probably a follow-up to the earlier conversation: resolve pronouns and references using the history.');
    return out.join(' ');
  }

  /** Fuzzy command lookup helper: nearest names within a distance, for /sumarize etc. */
  function nearest(word, names) {
    word = word.toLowerCase(); const max = word.length <= 4 ? 1 : 2;
    const scored = names.map((n) => ({ n, d: dist(word, n) })).filter((x) => x.d <= max).sort((a, b) => a.d - b.d);
    return scored;
  }

  JX.intent = { route, classify, hint, isFollowUp, nearest, dist, norm };
})();
