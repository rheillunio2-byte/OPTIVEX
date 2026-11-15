/* JARVIX — command registry. Every command either runs real local code or is built into an AI prompt sent through the provider proxy. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { esc } = JX.util;

  const GROUPS = ['General', 'Productivity', 'Development', 'Education', 'Utilities', 'Interface'];
  const list = [];
  const session = { lastCalc: null }; // short-term memory shared with the intent router ("times 3" after a calculation)

  const sys = (md, extra) => ({ md, source: 'system', ...extra });
  const local = (md, extra) => ({ md, source: 'local', ...extra });

  function def(c) { list.push({ aliases: [], ai: false, noEcho: false, args: 'text', ...c }); }
  const U = (c) => `**\`/${c.name}\`** — ${c.summary}\n\n**Usage:** \`${c.usage}\`${c.example ? `\n\n**Example:** \`${c.example}\`` : ''}`;
  const find = (name) => { name = name.toLowerCase(); return list.find((c) => c.name === name || c.aliases.includes(name)) || null; };
  const needText = (c, args) => (args.trim() ? null : sys(U(c)));

  /** Define a command that is answered by the AI provider. */
  function aiCmd(c, system, prompt, fallback) {
    def({ ...c, ai: true, run(args) {
      const miss = needText(c, args); if (miss) return miss;
      const p = prompt(args.trim());
      return { ai: { system: typeof system === 'function' ? system(args.trim()) : system, prompt: p.prompt || p, label: c.name }, fallback: fallback ? () => fallback(args.trim()) : null };
    } });
  }
  const demoNotice = (c) => sys(`**\`/${c.name}\` needs an AI provider.**\n\nJARVIX is in demo mode, so I won't fake an answer. Local commands still work — try \`/help\`.\n\n**Connect an AI provider:** copy \`.env.example\` to \`.env\`, add your key, and restart the server. Details are in **Settings → AI** (\`/settings ai\`).`);

  /* ================= GENERAL ================= */
  def({ name: 'help', group: 'General', icon: '?', summary: 'Show available commands', usage: '/help [command]', example: '/help summarize', args: 'optional', run(args) {
    const a = args.trim().replace(/^\//, '');
    if (a) { const c = find(a); if (!c) return sys(`No command called \`/${esc(a)}\`. Try \`/help\`.`); return sys(U(c) + (c.aliases.length ? `\n\n**Aliases:** ${c.aliases.map((x) => '`/' + x + '`').join(', ')}` : '') + `\n\n_${c.ai ? 'Uses the AI provider (needs a live connection).' : 'Runs locally in your browser.'}_`); }
    let md = `## JARVIX commands\nType \`/\` in the message box for autocomplete (**Tab** or **Enter** to pick). Commands marked ✦ use the AI provider; the rest run locally.\n\n`;
    for (const g of GROUPS) {
      const cs = list.filter((c) => c.group === g); if (!cs.length) continue;
      md += `### ${g}\n| Command | What it does |\n|---|---|\n` + cs.map((c) => `| \`/${c.name}\` ${c.ai ? '✦' : ''} | ${c.summary} |`).join('\n') + '\n\n';
    }
    md += `💡 Plain English works too: _“what time is it”_, _“add a task to call Sam”_, _“calculate 18% of 240”_.\nOpen the command palette with **Ctrl/⌘ K**, see shortcuts with \`/shortcuts\`.`;
    return sys(md);
  } });

  def({ name: 'clear', group: 'General', icon: '⌫', summary: 'Clear the current conversation', usage: '/clear', args: 'none', noEcho: true, async run(a, ctx) {
    const conv = ctx.conv;
    if (!conv || !conv.messages.length) return sys('This conversation is already empty.', { toast: true });
    const ok = await JX.ui.confirm({ title: 'Clear this conversation?', body: `This permanently removes all ${conv.messages.length} messages in “${conv.title}”. This can't be undone.`, confirm: 'Clear conversation', danger: true });
    if (!ok) return { silent: true };
    JX.store.clearMessages(conv.id); JX.messages.renderAll(JX.store.active()); JX.ui.toast('Conversation cleared', 'success');
    return { silent: true };
  } });

  def({ name: 'time', group: 'General', icon: '◷', summary: 'Display the current time', usage: '/time', args: 'none', run() {
    const d = new Date();
    return local(`## 🕒 ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\n${Intl.DateTimeFormat().resolvedOptions().timeZone} · UTC${(-d.getTimezoneOffset() / 60 >= 0 ? '+' : '') + (-d.getTimezoneOffset() / 60)}`);
  } });

  def({ name: 'date', group: 'General', icon: '▦', summary: 'Display the current date', usage: '/date', args: 'none', run() {
    const d = new Date(); const start = new Date(d.getFullYear(), 0, 0); const doy = Math.floor((d - start) / 86400000);
    const days = ((d.getFullYear() % 4 === 0 && d.getFullYear() % 100 !== 0) || d.getFullYear() % 400 === 0) ? 366 : 365;
    return local(`## 📅 ${d.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\nDay **${doy}** of ${days} · **${days - doy}** days left in the year.`);
  } });

  def({ name: 'about', group: 'General', icon: 'ℹ', summary: 'Information about JARVIX', usage: '/about', args: 'none', run() {
    const st = JX.ai.status, S = JX.store;
    const mode = st.state === 'live' ? `**Live** — ${st.provider} · \`${JX.ai.effective(S.settings).model}\`` : st.state === 'demo' ? '**Demo mode** — no AI provider connected' : `**${st.state}**`;
    return local(`## JARVIX v2\nA personal AI command center: streaming chat through a **server-side proxy** (your API key never reaches the browser), 30+ slash commands, local utilities, voice, and saved conversations.\n\n| | |\n|---|---|\n| Connection | ${mode} |\n| Conversations | ${S.conversations.length} |\n| Tasks open | ${S.tasks.filter((t) => !t.done).length} |\n| Notes | ${S.notes.length} |\n| Storage | your browser (localStorage), ~${Math.round(S.storageUsage() / 1024)} KB |\n\nRun \`/help\` for commands or \`/settings\` to personalise.`);
  } });

  def({ name: 'settings', group: 'General', icon: '⚙', summary: 'Open settings', usage: '/settings [appearance|assistant|voice|ai|data]', example: '/settings ai', args: 'optional', noEcho: true, run(args) {
    const tab = ['appearance', 'assistant', 'voice', 'ai', 'data'].find((t) => t.startsWith(args.trim().toLowerCase()) && args.trim()) || 'appearance';
    JX.ui.openSettings(tab); return { silent: true };
  } });

  def({ name: 'history', group: 'General', icon: '◴', summary: 'View & search conversation history', usage: '/history [search]', example: '/history budget', args: 'optional', noEcho: true, run(args) {
    JX.ui.showView('history', args.trim()); return { silent: true };
  } });

  /* extras */
  def({ name: 'new', group: 'General', icon: '+', summary: 'Start a new conversation', usage: '/new', args: 'none', noEcho: true, run() { JX.ui.newChat(); return { silent: true }; } });
  def({ name: 'export', group: 'General', icon: '↓', summary: 'Export this conversation (md, txt or json)', usage: '/export [md|txt|json]', example: '/export json', args: 'optional', noEcho: true, run(args, ctx) {
    const conv = ctx.conv; if (!conv || !conv.messages.length) return sys('Nothing to export yet.', { toast: true });
    JX.ui.exportConversation(conv, (args.trim().toLowerCase() || 'md')); return { silent: true };
  } });
  def({ name: 'status', group: 'General', icon: '◉', summary: 'Show connection & system status', usage: '/status', args: 'none', async run() {
    await JX.ai.refresh(); const st = JX.ai.status; const v = JX.voice ? JX.voice.support() : { stt: false, tts: false };
    const rows = [['AI connection', st.state === 'live' ? `🟢 live (${st.provider}, \`${JX.ai.effective(JX.store.settings).model}\`)` : st.state === 'demo' ? '🟡 demo mode' : st.state === 'offline' ? '🔴 offline' : '🔴 ' + st.state], ['Server', st.hasServer ? 'reachable' : 'not reachable'], ['Detail', st.reason || '—'], ['Speech recognition', v.stt ? 'supported' : 'not supported in this browser'], ['Speech synthesis', v.tts ? 'supported' : 'not supported'], ['Network', navigator.onLine === false ? 'offline' : 'online']];
    return local('## System status\n| | |\n|---|---|\n' + rows.map((r) => `| ${r[0]} | ${r[1]} |`).join('\n'));
  } });
  def({ name: 'shortcuts', group: 'Interface', icon: '⌨', summary: 'Show keyboard shortcuts', usage: '/shortcuts', args: 'none', noEcho: true, run() { JX.ui.openShortcuts(); return { silent: true }; } });

  /* ================= PRODUCTIVITY ================= */
  const localSummary = (t) => {
    if (t.length < 80) return sys('That text is already short — nothing to summarize.');
    const s = JX.tools.summarize(t); const c = JX.tools.count(t);
    return local(`**Local extractive summary** _(demo mode: key sentences selected by word frequency — not an AI summary)_\n\n> ${s}\n\n${c.words} words → ${JX.tools.count(s).words} words.`);
  };
  aiCmd({ name: 'summarize', aliases: ['summarise', 'tldr'], group: 'Productivity', icon: '≡', summary: 'Summarize provided text', usage: '/summarize <text>', example: '/summarize Paste a long article here…' },
    'Summarize the user\'s text faithfully. Start with a one-sentence **TL;DR**, then 3–6 bullet points of the key points. Keep facts and numbers accurate and add nothing that is not in the text. If the text is very short, say so and give a one-line summary.',
    (a) => `Text to summarize:\n\n${a}`, (a) => localSummary(a));
  aiCmd({ name: 'rewrite', aliases: ['improve', 'rephrase'], group: 'Productivity', icon: '✎', summary: 'Rewrite and improve text', usage: '/rewrite [instructions:] <text>', example: '/rewrite make it friendlier: send me the report asap' },
    'Rewrite the text to improve clarity, grammar, flow and tone while preserving meaning and voice. If the user included instructions (such as "make it formal:"), follow them. Output the improved text first, then a short bullet list of the main changes.',
    (a) => `Rewrite this:\n\n${a}`, (a) => local(`**Basic local clean-up** _(demo mode: spacing, capitalisation and common typos only — not an AI rewrite)_\n\n> ${JX.tools.tidy(a).replace(/\n/g, '\n> ')}`));
  def({ name: 'translate', group: 'Productivity', icon: '文', summary: 'Translate text', usage: '/translate to <language>: <text>', example: '/translate to Spanish: Where is the train station?', ai: true, run(args) {
    const a = args.trim(); if (!a) return sys(U(find('translate')));
    const m = /^(?:to|into|->)\s+([A-Za-zÀ-ÿ ()-]{2,30}?)\s*[:\-–]\s*([\s\S]+)$/i.exec(a) || /^([A-Za-z]{2,12})\s*:\s*([\s\S]+)$/.exec(a);
    if (!m) return sys('Which language should I translate into? Use `/translate to French: Good morning`.');
    return { ai: { system: 'You are a professional translator. Translate faithfully, preserving tone, meaning and formatting. Output the translation first. If helpful, add one short note about nuance, formality or alternatives. Detect the source language automatically.', prompt: `Translate the following text into ${m[1].trim()}:\n\n${m[2].trim()}`, label: 'translate' }, fallback: null };
  } });
  aiCmd({ name: 'write', group: 'Productivity', icon: '✍', summary: 'Generate written content', usage: '/write <what to write>', example: '/write a polite email declining a meeting invitation' },
    'Write the requested content so it is ready to use: well structured, in a natural voice, with an appropriate format and length. If the format is unspecified, choose a sensible one. Only ask a question if something essential is missing.', (a) => a);
  aiCmd({ name: 'ideas', aliases: ['brainstorm'], group: 'Productivity', icon: '✧', summary: 'Generate creative ideas', usage: '/ideas <topic>', example: '/ideas weekend projects for learning electronics' },
    'Generate 8–10 creative, distinct and specific ideas as a numbered list. Each idea: a **bold title** and one sentence explaining it. Finish with the 1–2 most promising ideas and why.', (a) => `Give me ideas for: ${a}`);
  aiCmd({ name: 'explain', aliases: ['eli5'], group: 'Productivity', icon: '💡', summary: 'Explain concepts', usage: '/explain <concept>', example: '/explain how public-key encryption works' },
    'Explain the concept clearly for an intelligent beginner: a one-sentence plain-English definition, then an analogy, then the key details, then a tiny worked example. Match depth to the question and avoid jargon unless defined.', (a) => `Explain: ${a}`);

  def({ name: 'todo', aliases: ['task', 'tasks'], group: 'Productivity', icon: '☑', summary: 'Create and manage tasks', usage: '/todo [add <task> | list | done <n> | undo <n> | rm <n> | clear]', example: '/todo add finish the quarterly report', args: 'optional', run(args) {
    const S = JX.store; const m = /^(add|list|ls|done|complete|check|undo|uncheck|rm|remove|delete|del|clear)\b\s*([\s\S]*)$/i.exec(args.trim());
    const show = (head) => {
      if (!S.tasks.length) return local(`${head ? head + '\n\n' : ''}**No tasks yet.** Add one with \`/todo add <task>\`.`);
      const open = S.tasks.filter((t) => !t.done).length;
      return local(`${head ? head + '\n\n' : ''}**Tasks** — ${open} open, ${S.tasks.length - open} done\n\n` + S.tasks.map((t, i) => `${i + 1}. [${t.done ? 'x' : ' '}] ${t.done ? '~~' + t.text + '~~' : t.text}`).join('\n') + '\n\n_Use `/todo done <n>`, `/todo rm <n>`, `/todo clear` — or open the **Tasks** view._');
    };
    const idxs = (txt) => {
      const nums = (txt.match(/\d+/g) || []).map(Number);
      if (nums.length) { const bad = nums.find((n) => n < 1 || n > S.tasks.length); if (bad) throw new Error(`There is no task #${bad}. You have ${S.tasks.length}.`); return nums.map((n) => S.tasks[n - 1]); }
      const t = S.tasks.find((x) => x.text.toLowerCase().includes(txt.trim().toLowerCase())); if (!txt.trim() || !t) throw new Error('Which task? Give its number from `/todo list`.'); return [t];
    };
    try {
      if (!args.trim()) return show('');
      if (!m) { const t = S.addTask(args); return show(`✅ Added: **${esc(t.text)}**`); }
      const sub = m[1].toLowerCase(), rest = m[2];
      if (sub === 'add') { if (!rest.trim()) return sys('What should the task say? `/todo add <task>`'); const t = S.addTask(rest); return show(`✅ Added: **${esc(t.text)}**`); }
      if (sub === 'list' || sub === 'ls') return show('');
      if (['done', 'complete', 'check'].includes(sub)) { const ts = idxs(rest); ts.forEach((t) => S.updateTask(t.id, { done: true })); return show(`✔ Completed ${ts.length} task${ts.length > 1 ? 's' : ''}.`); }
      if (['undo', 'uncheck'].includes(sub)) { const ts = idxs(rest); ts.forEach((t) => S.updateTask(t.id, { done: false })); return show('↩ Reopened.'); }
      if (['rm', 'remove', 'delete', 'del'].includes(sub)) { const ts = idxs(rest); ts.forEach((t) => S.removeTask(t.id)); return show(`🗑 Removed ${ts.length} task${ts.length > 1 ? 's' : ''}.`); }
      if (sub === 'clear') { const n = S.clearDoneTasks(); return show(n ? `🧹 Cleared ${n} completed task${n > 1 ? 's' : ''}.` : 'No completed tasks to clear.'); }
    } catch (e) { return sys(e.message); }
  } });

  def({ name: 'note', aliases: ['notes'], group: 'Productivity', icon: '🗒', summary: 'Create and manage notes', usage: '/note [add <text> | list | show <n> | rm <n> | search <word>]', example: '/note add Title :: remember the Friday deadline', args: 'optional', run(args) {
    const S = JX.store; const m = /^(add|list|ls|show|view|rm|remove|delete|del|search|find)\b\s*([\s\S]*)$/i.exec(args.trim());
    const label = (n) => n.title || n.body.split('\n')[0].slice(0, 60);
    const show = (head, notes = S.notes) => {
      if (!notes.length) return local(`${head ? head + '\n\n' : ''}**No notes${notes === S.notes ? ' yet' : ' found'}.** Add one with \`/note add <text>\`.`);
      return local(`${head ? head + '\n\n' : ''}**Notes** (${notes.length})\n\n` + notes.map((n) => `${S.notes.indexOf(n) + 1}. **${esc(label(n))}** — ${esc(n.body.replace(/\s+/g, ' ').slice(0, 80))}${n.body.length > 80 ? '…' : ''}`).join('\n') + '\n\n_`/note show <n>` opens a note · the **Notes** view lets you edit._');
    };
    const get = (txt) => { const n = Number(txt.trim()); const note = S.notes[n - 1]; if (!n || !note) throw new Error(`There is no note #${esc(txt.trim() || '?')}. Use \`/note list\`.`); return note; };
    try {
      if (!args.trim()) return show('');
      if (!m) { const n = S.addNote(args); return show('📝 Saved.', [n]); }
      const sub = m[1].toLowerCase(), rest = m[2];
      if (sub === 'add') {
        if (!rest.trim()) return sys('What should the note say? `/note add <text>`');
        const parts = rest.split('::'); const n = parts.length > 1 ? S.addNote(parts.slice(1).join('::'), parts[0]) : S.addNote(rest);
        return local(`📝 Saved note **#1**: ${esc(label(n))}\n\n_You now have ${S.notes.length} note${S.notes.length > 1 ? 's' : ''}. See them with \`/note list\`._`);
      }
      if (sub === 'list' || sub === 'ls') return show('');
      if (sub === 'show' || sub === 'view') { const n = get(rest); return local(`### ${esc(label(n))}\n\n${n.body}\n\n_Saved ${new Date(n.created).toLocaleString()}_`); }
      if (sub === 'search' || sub === 'find') { const q = rest.trim().toLowerCase(); if (!q) return sys('Search for what? `/note search <word>`'); return show(`🔎 Notes matching “${esc(q)}”`, S.notes.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(q))); }
      const n = get(rest); S.removeNote(n.id); return show('🗑 Deleted.');
    } catch (e) { return sys(e.message); }
  } });

  def({ name: 'document', aliases: ['doc', 'file'], group: 'Productivity', icon: '▤', summary: 'Create a downloadable text/Markdown file', usage: '/document <title> | <content> | <filename.txt>', example: '/document Meeting Notes | Discuss the launch timeline | notes.md', run(args) {
    const [title0, content0, file0] = args.split('|').map((s) => s.trim());
    const title = title0 || 'JARVIX Document'; const content = content0 || `# ${title}\n\nCreated with JARVIX.\n`;
    let filename = file0 || JX.util.slug(title) + '.txt'; if (!/\.[a-z0-9]{1,8}$/i.test(filename)) filename += '.txt';
    filename = filename.replace(/[\\/:*?"<>|]/g, '-');
    JX.util.download(filename, content.endsWith('\n') ? content : content + '\n', /\.md$/i.test(filename) ? 'text/markdown' : 'text/plain');
    JX.store.addFile(title, filename, content);
    return local(`📄 Created **${esc(title)}** and downloaded it as \`${esc(filename)}\`.\n\nIt's also listed in the **Files** view.`);
  } });

  /* ================= DEVELOPMENT ================= */
  aiCmd({ name: 'code', group: 'Development', icon: '</>', summary: 'Generate code', usage: '/code <what to build> [in <language>]', example: '/code debounce function in TypeScript' },
    'You are a senior software engineer. Write correct, idiomatic, readable code. Briefly explain the approach first, then give the code in a fenced block with a language tag, then a short usage example and notable edge cases. If no language is given, choose the most suitable one and say so.', (a) => a);
  aiCmd({ name: 'debug', group: 'Development', icon: '🐞', summary: 'Analyze and troubleshoot code', usage: '/debug <code and/or error message>', example: '/debug TypeError: Cannot read properties of undefined (reading \'map\')' },
    'You are an expert debugger. Identify the most likely root cause(s), explain why it happens, provide a corrected version in a fenced code block, and say how to prevent similar bugs. If key information is missing, state your assumptions and what to check next.', (a) => `Help me debug this:\n\n${a}`);
  aiCmd({ name: 'review', group: 'Development', icon: '✔', summary: 'Review code', usage: '/review <code>', example: '/review function add(a,b){return a+b}' },
    'You are a meticulous senior code reviewer. Provide: a one-line overall assessment; issues grouped as Bugs, Security, Performance, Readability (with specifics, not generic advice); and concrete improved code for the most important fixes. Be direct and constructive.', (a) => `Review this code:\n\n${a}`);
  aiCmd({ name: 'html', group: 'Development', icon: '‹›', summary: 'Generate HTML', usage: '/html <what to build>', example: '/html a responsive pricing table with three tiers' },
    'Generate clean, semantic, accessible HTML5. Output one complete fenced ```html block (add minimal inline <style> only if needed to make it presentable), then 2–3 bullets on notable decisions.', (a) => a);
  aiCmd({ name: 'css', group: 'Development', icon: '{ }', summary: 'Generate CSS', usage: '/css <what to style>', example: '/css glassmorphism card with hover lift' },
    'Generate modern, clean, responsive CSS (custom properties, flexbox/grid where suitable, accessible contrast, respect prefers-reduced-motion for animation). Output a fenced ```css block, plus a minimal ```html block if needed to understand it, then brief notes.', (a) => a);
  aiCmd({ name: 'javascript', aliases: ['js'], group: 'Development', icon: 'JS', summary: 'Generate JavaScript', usage: '/javascript <what to build>', example: '/javascript fetch with retry and timeout' },
    'Generate modern, dependency-free JavaScript (ES2022+). Output a fenced ```javascript block with helpful comments, then a short usage example and notes on edge cases and error handling.', (a) => a);

  /* ================= EDUCATION ================= */
  const QUIZ_SYS = 'Create a multiple-choice quiz. Write one short intro line, then ONE fenced code block whose language tag is `quiz`, and nothing after it. Format each question exactly like this, separated by a blank line:\nQ1: question text\nA) option\nB) option\nC) option\nD) option\nAnswer: B\nWhy: one-sentence explanation\nUse exactly four options (A–D), exactly one correct, plausible distractors, and vary which letter is correct. Default to 5 questions unless a number is requested.';
  aiCmd({ name: 'quiz', group: 'Education', icon: '❓', summary: 'Generate an interactive quiz', usage: '/quiz <topic> [number of questions]', example: '/quiz photosynthesis 5' }, QUIZ_SYS, (a) => `Create a quiz about: ${a}`,
    (a) => { const ps = JX.tools.pairs(a); return ps.length >= 4 ? local(`**Quiz from your terms** _(demo mode: built locally from your “term: definition” lines)_\n\n${JX.tools.quizFromPairs(ps)}`) : demoNotice(find('quiz')); });
  aiCmd({ name: 'flashcards', aliases: ['flashcard', 'cards'], group: 'Education', icon: '🗂', summary: 'Generate flip-card flashcards', usage: '/flashcards <topic> [count]', example: '/flashcards Spanish food vocabulary 10' },
    'Create flashcards. Write one short intro line, then ONE fenced code block whose language tag is `flashcards`, and nothing after it. One card per line in the form `front :: back`. Keep fronts short and backs concise (under 25 words). Default to 10 cards unless a number is requested.', (a) => `Create flashcards for: ${a}`,
    (a) => { const ps = JX.tools.pairs(a); return ps.length ? local(`**Flashcards from your terms** _(demo mode: built locally from your “term: definition” lines)_\n\n${JX.tools.flashFromPairs(ps)}`) : demoNotice(find('flashcards')); });
  aiCmd({ name: 'study', group: 'Education', icon: '🎓', summary: 'Create study materials', usage: '/study <topic>', example: '/study the French Revolution' },
    'Create a compact study guide with these sections (Markdown headings): Overview (3–4 sentences), Key concepts (bullets with short definitions), Worked example or timeline, Common mistakes, Memory aids (a mnemonic or analogy), and Practice questions (5, with brief answers). Close by suggesting `/quiz` or `/flashcards` on the topic.', (a) => `Create study materials for: ${a}`);
  aiCmd({ name: 'define', group: 'Education', icon: '📖', summary: 'Define terms', usage: '/define <term>', example: '/define entropy' },
    'Define the term: **term** (part of speech) followed by a concise definition; an example sentence; origin/etymology if known; related terms. If the term has several distinct senses (for example in different fields), list the main ones briefly.', (a) => `Define: ${a}`);
  aiCmd({ name: 'compare', aliases: ['vs'], group: 'Education', icon: '⇄', summary: 'Compare concepts', usage: '/compare <A> vs <B>', example: '/compare TCP vs UDP' },
    'Compare the concepts: a one-sentence intro, a Markdown table across the most relevant dimensions, then "When to choose each" and a one-line verdict. Be balanced and accurate; point out where the answer depends on context.', (a) => `Compare: ${a}`);

  /* ================= UTILITIES ================= */
  def({ name: 'calculate', aliases: ['calc', 'math'], group: 'Utilities', icon: '∑', summary: 'Perform mathematical calculations', usage: '/calculate <expression>', example: '/calculate (125 * 8) + sqrt(144) — or: 18% of 240', run(args) {
    if (!args.trim()) return sys(U(find('calculate')) + '\n\nSupports + − × ÷ ^ % !, parentheses, `pi`, `e`, `ans` (previous result) and functions like `sqrt() sin() cos() ln() log() abs() round() min() max()`. Trig uses radians; use `30°` for degrees.');
    try {
      const v = JX.calc.evaluate(args, { ans: session.lastCalc == null ? 0 : session.lastCalc });
      session.lastCalc = v;
      return local(`\`${esc(args.trim())}\`\n\n## = ${JX.calc.format(v)}\n_Say “times 3” or “squared” to continue from this result._`, { meta: { value: v } });
    } catch (e) { return sys(`⚠ ${e.message}`); }
  } });

  def({ name: 'convert', aliases: ['unit', 'units'], group: 'Utilities', icon: '⇌', summary: 'Convert units', usage: '/convert <value> <unit> to <unit>', example: '/convert 72 f to c', args: 'text', run(args) {
    if (!args.trim()) return sys(U(find('convert')) + '\n\n' + JX.units.categories().map((c) => `**${c.cat}:** ${c.units.join(', ')}`).join('\n\n'));
    try { const r = JX.units.convert(args); return local(`### ${JX.units.fmt(r.value)} ${r.from} = **${JX.units.fmt(r.result)} ${r.to}**\n_${r.category}_`); } catch (e) { return sys(`⚠ ${e.message}`); }
  } });

  def({ name: 'count', aliases: ['wc'], group: 'Utilities', icon: '#', summary: 'Count words and characters', usage: '/count <text>', example: '/count The quick brown fox', run(args) {
    return args.trim() ? local(JX.tools.countMd(args)) : sys(U(find('count')));
  } });

  def({ name: 'random', aliases: ['rand', 'roll'], group: 'Utilities', icon: '⚄', summary: 'Generate random values', usage: '/random [max | min max | coin | dice 2d6 | pick a, b, c | uuid | hex n | color]', example: '/random pick pizza, sushi, tacos', args: 'optional', run(args) {
    try { return local(JX.tools.random(args)); } catch (e) { return sys(`⚠ ${e.message}`); }
  } });

  def({ name: 'password', aliases: ['pass', 'pw'], group: 'Utilities', icon: '🔑', summary: 'Generate a secure random password locally', usage: '/password [length] [nosymbols] [nonumbers] [noupper] [nolower]', example: '/password 32 nosymbols', args: 'optional', run(args) {
    try { const p = JX.tools.password(args); return local(p.md, { ephemeral: true }); } catch (e) { return sys(`⚠ ${e.message}`); }
  } });

  /* ================= INTERFACE ================= */
  const ACCENTS = ['cyan', 'blue', 'violet', 'emerald', 'amber', 'rose'];
  def({ name: 'theme', group: 'Interface', icon: '◐', summary: 'Change the theme', usage: '/theme [dark|light|system|toggle] [accent]', example: '/theme light violet', args: 'optional', run(args) {
    const S = JX.store; const w = args.toLowerCase().split(/\s+/).filter(Boolean); const done = [];
    for (const x of w) {
      if (['dark', 'light', 'system'].includes(x)) { S.set('theme', x); done.push(x + ' theme'); }
      else if (x === 'toggle') { const cur = JX.ui.effectiveTheme(); S.set('theme', cur === 'dark' ? 'light' : 'dark'); done.push((cur === 'dark' ? 'light' : 'dark') + ' theme'); }
      else if (ACCENTS.includes(x)) { S.set('accent', x); done.push(x + ' accent'); }
      else return sys(`Unknown option “${esc(x)}”. Themes: dark, light, system, toggle. Accents: ${ACCENTS.join(', ')}.`);
    }
    if (!w.length) { const cur = JX.ui.effectiveTheme(); S.set('theme', cur === 'dark' ? 'light' : 'dark'); done.push((cur === 'dark' ? 'light' : 'dark') + ' theme'); }
    return local(`🎨 Switched to ${done.join(' + ')}.\n\nCurrent: **${S.settings.theme}** theme, **${S.settings.accent}** accent. More in \`/settings appearance\`.`);
  } });

  def({ name: 'voice', group: 'Interface', icon: '🎙', summary: 'Toggle voice features', usage: '/voice [on | off | auto on|off | stop | test | status]', example: '/voice auto on', args: 'optional', run(args) {
    const S = JX.store, V = JX.voice, sup = V.support(); const a = args.trim().toLowerCase();
    const status = () => local(`## Voice\n| | |\n|---|---|\n| Voice features | ${S.settings.voice.enabled ? '**on**' : 'off'} |\n| Speak replies automatically | ${S.settings.voice.autoSpeak ? '**on**' : 'off'} |\n| Speech recognition (mic) | ${sup.stt ? 'supported' : '✗ not supported in this browser'} |\n| Speech synthesis | ${sup.tts ? 'supported' : '✗ not supported'} |\n\nThe microphone only turns on when you press the mic button. Options: \`/voice on\`, \`/voice off\`, \`/voice auto on\`, \`/voice test\`.`);
    if (!a || a === 'status') { if (!a) { S.set('voice.enabled', !S.settings.voice.enabled); return local(`🎙 Voice features **${S.settings.voice.enabled ? 'enabled' : 'disabled'}**.\n\n${sup.stt || sup.tts ? '' : '⚠ This browser has no speech support, so voice features are limited. Try Chrome or Edge.\n\n'}`); } return status(); }
    if (a === 'on' || a === 'off') { S.set('voice.enabled', a === 'on'); if (a === 'off') V.stopAll(); return local(`🎙 Voice features **${a === 'on' ? 'enabled' : 'disabled'}**.`); }
    const au = /^auto(?:speak)?\s*(on|off)?$/.exec(a); if (au) { const v = au[1] ? au[1] === 'on' : !S.settings.voice.autoSpeak; S.set('voice.autoSpeak', v); if (v && !sup.tts) return sys('Auto-speak is on, but this browser has no speech synthesis.'); return local(`🔊 Automatic spoken replies **${v ? 'on' : 'off'}**.`); }
    if (a === 'stop') { V.stopAll(); return local('🔇 Stopped.'); }
    if (a === 'test') { if (!sup.tts) return sys('This browser does not support speech synthesis.'); V.speak('JARVIX voice check. All systems are operational.', { force: true }); return local('🔊 Speaking a test phrase…'); }
    return sys('Unknown voice option. Try `/voice on|off|auto on|stop|test|status`.');
  } });

  def({ name: 'animations', aliases: ['motion', 'anim'], group: 'Interface', icon: '✦', summary: 'Configure animation settings', usage: '/animations [off | low | medium | high | status]', example: '/animations low', args: 'optional', run(args) {
    const S = JX.store; const a = args.trim().toLowerCase(); const levels = ['off', 'low', 'medium', 'high'];
    const sys2 = JX.ui.reducedMotion() ? '\n\n_Your system requests reduced motion, so JARVIX is limiting animation regardless of this setting._' : '';
    if (!a || a === 'status') return local(`✦ Animation level: **${S.settings.animations}**. Options: ${levels.map((l) => '`/animations ' + l + '`').join(', ')}.${sys2}`);
    if (!levels.includes(a)) return sys('Choose one of: off, low, medium, high.');
    S.set('animations', a); return local(`✦ Animations set to **${a}**.${sys2}`);
  } });

  JX.commands = {
    list, groups: GROUPS, find, session, demoNotice, ACCENTS,
    /** Parse "/name args" → {name, args} or null */
    parse(line) { const m = /^\/([A-Za-z][\w-]*)(?:\s+([\s\S]*))?$/.exec(line.trim()); return m ? { name: m[1].toLowerCase(), args: (m[2] || '').trim() } : null; },
    /** Resolve exact name/alias, or a unique near-miss (typo tolerance). */
    resolve(name) {
      const exact = find(name); if (exact) return { cmd: exact, corrected: false };
      const names = list.flatMap((c) => [c.name, ...c.aliases]);
      const near = JX.intent.nearest(name, names);
      if (near.length && (near.length === 1 || near[0].d < near[1].d)) return { cmd: find(near[0].n), corrected: near[0].n };
      return { cmd: null, suggestions: near.slice(0, 3).map((x) => x.n) };
    },
    /** Autocomplete matches for the slash menu. */
    suggest(query) {
      const q = query.toLowerCase();
      if (!q) return list.slice();
      return list.map((c) => ({ c, s: Math.max(JX.util.fuzzy(q, c.name) * 2, ...c.aliases.map((a) => JX.util.fuzzy(q, a) * 1.5), q.length >= 3 && c.summary.toLowerCase().includes(q) ? 0.3 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.c);
    },
  };
})();
