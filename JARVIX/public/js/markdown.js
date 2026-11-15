/* JARVIX — Markdown renderer. Escapes all HTML; only emits tags it generates itself. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- LaTeX-lite: enough for everyday maths, rendered with plain HTML/CSS ---------- */
  const SYM = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Pi: 'Π', Phi: 'Φ', Gamma: 'Γ', Theta: 'Θ', Lambda: 'Λ',
    times: '×', div: '÷', pm: '±', mp: '∓', cdot: '·', leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
    to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftrightarrow: '⇔', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃', degree: '°', ldots: '…', cdots: '⋯', sqrt: '√', angle: '∠', propto: '∝', circ: '∘',
  };
  function tex(src) {
    let i = 0;
    function group() { // {...} or single token
      if (src[i] === '{') { i++; const h = seq('}'); if (src[i] === '}') i++; return h; }
      if (src[i] === '\\') return cmd();
      return esc(src[i++] || '');
    }
    function cmd() {
      i++; let name = '';
      while (/[A-Za-z]/.test(src[i] || '')) name += src[i++];
      if (!name) return esc(src[i++] || '');
      if (name === 'frac' || name === 'dfrac') { const a = group(), b = group(); return `<span class="tex-frac"><span>${a}</span><span>${b}</span></span>`; }
      if (name === 'sqrt') { const a = group(); return `<span class="tex-sqrt">√<span class="tex-rad">${a}</span></span>`; }
      if (name === 'text' || name === 'mathrm' || name === 'mathbf' || name === 'operatorname') { const a = group(); return `<span class="tex-text">${a}</span>`; }
      if (name === 'left' || name === 'right' || name === 'displaystyle' || name === 'quad' || name === 'qquad') return name.startsWith('q') ? '&emsp;' : '';
      if (name === 'sin' || name === 'cos' || name === 'tan' || name === 'log' || name === 'ln' || name === 'lim' || name === 'max' || name === 'min' || name === 'exp') return `<span class="tex-text">${name}</span>`;
      return SYM[name] || esc('\\' + name);
    }
    function seq(stop) {
      let out = '';
      while (i < src.length && src[i] !== stop) {
        const c = src[i];
        if (c === '^' || c === '_') { i++; const g = group(); out += c === '^' ? `<sup>${g}</sup>` : `<sub>${g}</sub>`; }
        else if (c === '{') out += group();
        else if (c === '\\') out += cmd();
        else if (c === '*') { out += '∗'; i++; }
        else { out += esc(c); i++; }
      }
      return out;
    }
    return seq(null);
  }
  const mathInline = (s) => `<span class="math">${tex(s.trim())}</span>`;
  const mathBlock = (s) => `<div class="math math-block">${tex(s.trim())}</div>`;

  /* ---------- Inline ---------- */
  const SAFE_URL = /^(https?:\/\/|mailto:)/i;

  function inline(text, opts) {
    const stash = [];
    const put = (html) => '\u0000' + (stash.push(html) - 1) + '\u0001';
    let s = text;
    // inline code
    s = s.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (m, t, c) => {
      const code = c.trim();
      if (opts.chips && /^\/[a-z]+(?:\s[^`]*)?$/i.test(code)) return put(`<button type="button" class="cmd-chip" data-cmd="${esc(code)}">${esc(code)}</button>`);
      if (/^#[0-9a-f]{6}$/i.test(code)) return put(`<code class="color-code"><i class="swatch" style="background:${code}"></i>${esc(code)}</code>`);
      return put(`<code>${esc(code)}</code>`);
    });
    // math
    s = s.replace(/\$\$([^$]+?)\$\$|\\\(([\s\S]+?)\\\)|(?<![\\$\w])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?![\w$])/g, (m, a, b, c) => put(mathInline(a || b || c)));
    // escape remaining text
    s = esc(s);
    // markdown links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*?&quot;)?\)/g, (m, t, u) => {
      const raw = u.replace(/&amp;/g, '&');
      if (!SAFE_URL.test(raw)) return put(t);
      return put(`<a href="${u}" target="_blank" rel="noopener noreferrer">${emph(t)}</a>`);
    });
    // bare URLs
    s = s.replace(/(^|[\s(>])((?:https?:\/\/)[^\s<>&]+(?:&amp;[^\s<>&]+)*[^\s<>.,;:!?)'"&])/g, (m, pre, u) => `${pre}${put(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`)}`);
    s = emph(s);
    s = s.replace(/ {2,}\n|\\\n/g, '<br>');
    for (let n = 0; n < 4 && /\u0000\d+\u0001/.test(s); n++) s = s.replace(/\u0000(\d+)\u0001/g, (m, i) => stash[+i]);
    return s;
  }
  function emph(s) {
    return s
      .replace(/\*\*\*(?!\s)(.+?)(?<!\s)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(?!\s)(.+?)(?<!\s)\*\*|__(?!\s)(.+?)(?<!\s)__/g, (m, a, b) => `<strong>${a || b}</strong>`)
      .replace(/(^|[^*\w])\*(?![\s*])(.+?)(?<![\s*])\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_(?![\s_])(.+?)(?<![\s_])_(?![_\w])/g, '$1<em>$2</em>')
      .replace(/~~(?!\s)(.+?)(?<!\s)~~/g, '<del>$1</del>');
  }

  /* ---------- Interactive blocks: flashcards & quiz ---------- */
  function flashcards(body) {
    const cards = body.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.replace(/^[-*\d.)\s]+/, '').split(/\s*(?:::|\|\|)\s*/);
      return m.length >= 2 ? [m[0], m.slice(1).join(' :: ')] : null;
    }).filter(Boolean);
    if (!cards.length) return null;
    const data = esc(JSON.stringify(cards));
    return `<div class="fc-deck" data-cards="${data}" data-i="0"><div class="fc-card" tabindex="0" role="button" aria-label="Flashcard, press to flip"><div class="fc-face fc-front"></div><div class="fc-face fc-back"></div></div>` +
      `<div class="fc-bar"><button type="button" data-fc="prev" aria-label="Previous card">←</button><span class="fc-count"></span><button type="button" data-fc="shuffle" aria-label="Shuffle">⤮</button><button type="button" data-fc="next" aria-label="Next card">→</button></div></div>`;
  }
  function quiz(body) {
    const qs = [];
    let cur = null;
    for (const raw of body.split('\n')) {
      const l = raw.trim(); let m;
      if (!l) continue;
      if ((m = /^(?:Q(?:uestion)?\s*\d*\s*[:.)]|\d+[.)])\s*(.+)$/i.exec(l))) { cur = { q: m[1], opts: [], ans: null, why: '' }; qs.push(cur); }
      else if (cur && (m = /^\(?([A-F])[).:]\s*(.+)$/.exec(l))) cur.opts.push([m[1], m[2]]);
      else if (cur && (m = /^(?:Answer|Correct)\s*[:=]\s*\(?([A-F])/i.exec(l))) cur.ans = m[1].toUpperCase();
      else if (cur && (m = /^(?:Why|Explanation|Reason)\s*:\s*(.+)$/i.exec(l))) cur.why = m[1];
    }
    const ok = qs.filter((q) => q.opts.length >= 2 && q.ans && q.opts.some((o) => o[0] === q.ans));
    if (!ok.length) return null;
    const html = ok.map((q, n) => `<div class="qz-q" data-ans="${q.ans}"><div class="qz-title"><span class="qz-n">${n + 1}</span>${inline(q.q, {})}</div><div class="qz-opts">` +
      q.opts.map((o) => `<button type="button" class="qz-opt" data-k="${o[0]}"><b>${o[0]}</b><span>${inline(o[1], {})}</span></button>`).join('') +
      `</div><div class="qz-why" hidden>${inline(q.why || '', {})}</div></div>`).join('');
    return `<div class="qz" data-total="${ok.length}">${html}<div class="qz-score" hidden></div></div>`;
  }

  /* ---------- Blocks ---------- */
  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-');
  const splitRow = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

  function codeBlock(code, lang, o) {
    const { html, lang: known } = JX.highlight ? JX.highlight(code, lang) : { html: esc(code), lang: null };
    const lines = code.split('\n');
    const n = lines.length;
    const wrapped = html.split('\n').map((l, i) => `<span class="ln" style="--i:${Math.min(i, 24)}">${l || ' '}</span>`).join('');
    const label = lang ? esc(lang) : 'text';
    const fold = n > 24;
    return `<div class="codeblock${fold ? ' foldable folded' : ''}${o.streaming ? ' streaming' : ''}" data-lines="${n}"><div class="code-head"><span class="code-lang${known ? '' : ' plain'}">${label}</span><span class="code-meta">${n} line${n === 1 ? '' : 's'}</span>` +
      `<button type="button" class="code-btn" data-copy-code aria-label="Copy code">Copy</button>${fold ? '<button type="button" class="code-btn" data-fold aria-label="Expand or collapse code">Expand</button>' : ''}</div>` +
      `<pre><code>${wrapped}</code></pre></div>`;
  }

  function blocks(src, o) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    const startsBlock = (l, nxt) => /^\s*(`{3,}|~{3,})/.test(l) || /^#{1,6}\s/.test(l) || /^\s*>/.test(l) || LIST_RE.test(l) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(l) || /^\s*\$\$/.test(l) || (l.includes('|') && nxt != null && isTableSep(nxt));
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) { i++; continue; }
      let m;
      // fenced code
      if ((m = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/.exec(l))) {
        const fence = m[2], lang = m[3].toLowerCase(), body = []; i++;
        let closed = false;
        while (i < lines.length) {
          if (new RegExp('^\\s*' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[i])) { closed = true; i++; break; }
          body.push(lines[i].replace(new RegExp('^ {0,' + m[1].length + '}'), '')); i++;
        }
        const code = body.join('\n');
        if (closed && lang === 'flashcards') { const f = flashcards(code); if (f) { out.push(f); continue; } }
        if (closed && lang === 'quiz') { const q = quiz(code); if (q) { out.push(q); continue; } }
        out.push(codeBlock(code, lang, { streaming: !closed && o.streaming }));
        continue;
      }
      // math block
      if (/^\s*\$\$/.test(l)) {
        const one = /^\s*\$\$([\s\S]+?)\$\$\s*$/.exec(l);
        if (one) { out.push(mathBlock(one[1])); i++; continue; }
        const body = []; i++;
        while (i < lines.length && !/\$\$\s*$/.test(lines[i])) body.push(lines[i++]);
        if (i < lines.length) body.push(lines[i++].replace(/\$\$\s*$/, ''));
        out.push(mathBlock(body.join(' '))); continue;
      }
      if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l))) { const n = m[1].length; out.push(`<h${n}>${inline(m[2], o)}</h${n}>`); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(l)) {
        const q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
        out.push(`<blockquote>${blocks(q.join('\n'), o)}</blockquote>`); continue;
      }
      if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = splitRow(l);
        const aligns = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : /^:-+/.test(c) ? 'left' : ''));
        i += 2; const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
        const cell = (t, c, a) => `<${t}${a ? ` style="text-align:${a}"` : ''}>${inline(c || '', o)}</${t}>`;
        out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, k) => cell('th', c, aligns[k])).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => cell('td', r[k], aligns[k])).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if ((m = LIST_RE.exec(l))) {
        const base = m[1].length, ordered = /\d/.test(m[2]), start = ordered ? parseInt(m[2], 10) : 1, items = [];
        while (i < lines.length) {
          const mm = LIST_RE.exec(lines[i]);
          if (mm && mm[1].length === base && /\d/.test(mm[2]) === ordered) {
            const item = { first: mm[3], rest: [] }; items.push(item); i++;
            while (i < lines.length) {
              const nx = lines[i];
              if (!nx.trim()) {
                const after = lines.slice(i + 1).find((x) => x.trim());
                if (after && (/^\s{2,}\S/.test(after) && !LIST_RE.test(after) ? true : (LIST_RE.exec(after) || [])[1] !== undefined && LIST_RE.exec(after)[1].length > base)) { item.rest.push(''); i++; continue; }
                break;
              }
              const ind = nx.match(/^\s*/)[0].length;
              if (ind > base) { item.rest.push(nx.slice(Math.min(ind, base + 2))); i++; continue; }
              break;
            }
          } else break;
        }
        const tag = ordered ? 'ol' : 'ul';
        const html = items.map((it) => {
          let first = it.first, cls = '', box = '';
          const t = /^\[( |x|X)\]\s+(.*)$/.exec(first);
          if (t) { first = t[2]; cls = ' class="task"'; box = `<input type="checkbox" disabled ${t[1] !== ' ' ? 'checked' : ''} aria-hidden="true"> `; }
          const rest = it.rest.length ? blocks(it.rest.join('\n'), o) : '';
          return `<li${cls}>${box}${inline(first, o)}${rest}</li>`;
        }).join('');
        out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${html}</${tag}>`);
        continue;
      }
      // paragraph
      const para = [l]; i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) para.push(lines[i++]);
      out.push(`<p>${inline(para.join('\n').replace(/\n/g, '  \n'), o)}</p>`);
    }
    return out.join('');
  }

  /** render(markdown, {chips, streaming}) → HTML string */
  function render(src, opts) {
    const o = Object.assign({ chips: false, streaming: false }, opts);
    return blocks(String(src == null ? '' : src), o);
  }

  JX.markdown = { render, inline: (s) => inline(String(s), {}), tex };
})();
