/* JARVIX — DEMO mode responder. Rule-based and always labelled as such in the UI: it is NOT an AI model. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const lastUsed = {};
  const pick = (key, arr) => {
    let i = Math.floor(Math.random() * arr.length);
    if (arr.length > 1 && lastUsed[key] === i) i = (i + 1) % arr.length;
    lastUsed[key] = i; return arr[i];
  };
  const part = () => { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const nm = (s) => (s.name ? `, ${s.name}` : '');

  const JOKES = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'There are 10 kinds of people: those who understand binary and those who don\'t.',
    'A SQL query walks into a bar, walks up to two tables and asks: “Can I join you?”',
    'I would tell you a UDP joke, but you might not get it.',
    'It works on my machine — so we\'re shipping my machine.',
  ];

  /** Returns {md} — never claims to be an AI answer. */
  function reply(text, settings) {
    const kind = JX.intent.classify(text);
    const t = JX.intent.norm(text);
    const hasNum = /\d/.test(t);
    if (kind === 'greeting') {
      return { md: pick('greet', [`${part()}${nm(settings)}. JARVIX online.`, `Hello${nm(settings)}! Systems are up. What shall we work on?`, `Hey${nm(settings)} — good to see you. Try \`/help\` to see everything I can do locally.`]) + '\n\n_Demo mode: I answer greetings and run local tools. Connect an AI provider in Settings for open-ended conversation._' };
    }
    if (kind === 'thanks') return { md: pick('thx', ['You\'re welcome.', 'Any time.', 'Glad to help.']) };
    if (kind === 'farewell') return { md: pick('bye', ['Goodbye for now. Your conversations are saved in this browser.', 'Signing off — see you soon.']) };
    if (/^(?:how are you|how'?s it going|how do you do|are you ok)/.test(t)) return { md: pick('how', ['All systems nominal. Though in demo mode I\'m running on rules rather than a language model, so I\'m a fairly simple fellow today.', 'Running smoothly. How can I help?']) };
    if (/^(?:who|what) are you|your name|^who is jarvix|^what is jarvix/.test(t)) return { md: '**I\'m JARVIX**, a command-center style assistant. Right now I\'m in **demo mode**: I\'m not connected to an AI model, so I use simple rules for chat and run real local tools (calculator, converter, tasks, notes, password generator and more). Connect a provider in **Settings → AI** and I become a full conversational assistant.' };
    if (/\b(joke|funny)\b/.test(t)) return { md: pick('joke', JOKES) + '\n\n_(A canned joke from a short built-in list — demo mode.)_' };
    if (/^(?:ok|okay|cool|nice|great|got it|alright|sure|yes|yeah|no|nope)$/.test(t)) return { md: pick('ack', ['👍', 'Understood.', 'Noted.']) };
    if (/\b(weather|news|stock|score)\b/.test(t)) return { md: 'I don\'t have live web or weather data — even with an AI provider connected I can\'t browse the internet. I can help with calculations, conversions, tasks, notes and writing.' };
    const tips = [];
    if (hasNum) tips.push('`/calculate` for maths, `/convert` for units');
    if (/summar|tl;?dr/.test(t)) tips.push('`/summarize <text>` (a basic local summary works in demo mode)');
    if (/translat/.test(t)) tips.push('`/translate` (needs an AI provider)');
    if (/code|function|bug|html|css|javascript|python/.test(t)) tips.push('`/code`, `/debug`, `/review` (need an AI provider)');
    if (/task|todo|remind/.test(t)) tips.push('`/todo add <task>`');
    if (/note|remember/.test(t)) tips.push('`/note add <text>`');
    if (!tips.length) tips.push('`/help` for the full command list', '`/todo`, `/note`, `/calculate`, `/convert`, `/password`');
    return { md: `${pick('fallback', ['I can\'t answer that properly yet.', 'That one needs a real language model.', 'I\'m not able to handle that in demo mode.'])} **JARVIX is in demo mode**, so I only run local rules and tools — no AI model is behind this reply.\n\nTry: ${tips.join(' · ')}.\n\nTo enable full conversation, add an API key to the server's \`.env\` file (see the README) — then this status badge turns to **Live**.` };
  }

  JX.demo = { reply };
})();
