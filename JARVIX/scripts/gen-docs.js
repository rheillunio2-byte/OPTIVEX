'use strict';
/* Regenerates docs/commands.md from the command registry. Usage: node scripts/gen-docs.js */
const fs = require('fs'); const path = require('path');
const { loadJX } = require('../tests/helpers/load');
const C = loadJX(['commands']).commands;
const fallback = { summarize: 'extractive local summary', rewrite: 'basic spacing/capitalisation clean-up', quiz: 'builds a quiz from "term: definition" lines you provide', flashcards: 'builds cards from "term: definition" lines you provide' };
let md = '# Command reference\n\n> Generated from the command registry (`public/js/commands.js`) — run `node scripts/gen-docs.js` to refresh.\n\nType `/` in the message box for animated autocomplete. **AI** commands are sent to your configured provider through the server proxy; **Local** commands run entirely in your browser. In demo mode, AI commands tell you they need a provider rather than inventing an answer (a few have clearly-labelled local fallbacks, noted below).\n\n';
for (const g of C.groups) {
  const cs = C.list.filter((c) => c.group === g); if (!cs.length) continue;
  md += `## ${g}\n\n| Command | Type | What it does | Usage |\n|---|---|---|---|\n` + cs.map((c) => `| \`/${c.name}\`${c.aliases.length ? `<br><small>aliases: ${c.aliases.map((a) => '/' + a).join(', ')}</small>` : ''} | ${c.ai ? 'AI' : 'Local'}${fallback[c.name] ? `<br><small>demo fallback: ${fallback[c.name]}</small>` : ''} | ${c.summary} | \`${c.usage.replace(/\|/g, '\\|')}\` |`).join('\n') + '\n\n';
}
md += '## Plain-English routing\n\nBefore a message goes to the AI, JARVIX checks whether it is really a local task (typo-tolerant): *what time is it*, *whats the date*, *add a task to call Sam*, *make a note that…*, *calculate 18% of 240*, *times 3* (continues the previous calculation), *convert 72 f to c*, *create a document titled …*, *help*. Routed messages show a small “Interpreted as /command” line so nothing happens invisibly.\n';
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'commands.md'), md);
console.log(C.list.length + ' commands documented');
