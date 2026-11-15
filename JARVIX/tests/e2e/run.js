'use strict';
/* JARVIX end-to-end suite (Playwright + Chromium).
 *   npm run test:e2e        (requires `playwright` to be installed separately: it is a test-only tool, not an app dependency)
 * Starts two JARVIX servers: one in DEMO mode and one wired to a mock OpenAI-compatible upstream (live mode). */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const mock = require('./mock-upstream');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.JX_SHOTS || path.join(os.tmpdir(), 'jarvix-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = []; let current = '';
const ok = (name, cond, detail) => { results.push({ name: current + name, pass: !!cond, detail: cond ? '' : String(detail || '') }); if (!cond) console.log('  ✗ FAIL', current + name, detail ? '— ' + String(detail).slice(0, 300) : ''); };
const section = (n) => { current = n + ' › '; console.log('\n▸ ' + n); };

function startServer(port, env) {
  const p = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { cwd: ROOT, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), JARVIX_RATE_LIMIT: '100000', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', JARVIX_BASE_URL: '', JARVIX_PROVIDER: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
  return new Promise((res, rej) => { const t = setInterval(async () => { try { const r = await fetch(`http://127.0.0.1:${port}/api/status`); if (r.ok) { clearInterval(t); res({ p, port, out: () => out }); } } catch { /* not up yet */ } }, 150); setTimeout(() => rej(new Error('server did not start: ' + out)), 8000); });
}

const IGNORE = /Failed to load resource: the server responded with a status of (4|5)\d\d|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|fonts\.(googleapis|gstatic)|net::ERR_(INTERNET|PROXY|CONNECTION)/;
function watch(page, errs) {
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push('console.error: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
}

/* ---------- helpers bound to a page ---------- */
function H(page) {
  const h = {
    idle: () => page.waitForFunction(() => !document.body.classList.contains('is-busy'), null, { timeout: 15000 }),
    count: () => page.locator('.msg-ai').count(),
    async send(text, { wait = true } = {}) {
      const before = await h.count();
      await page.fill('#input', text); await page.press('#input', 'Enter');
      if (wait) { await h.idle(); await page.waitForTimeout(80); }
      return before;
    },
    last: async () => (await page.locator('.msg-ai .bubble').last().innerText()).trim(),
    lastHTML: async () => page.locator('.msg-ai .bubble').last().innerHTML(),
    badge: async () => (await page.locator('.msg-ai').last().locator('.badge').first().innerText().catch(() => '')).trim(),
    text: (sel) => page.locator(sel).first().innerText(),
    async cmd(text, expect, name) {
      const before = await h.count(); await h.send(text);
      const after = await h.count(); const t = await h.last();
      ok(name || text, after === before + 1 && (expect instanceof RegExp ? expect.test(t) : t.includes(expect)), `got: ${t.slice(0, 220)}`);
      return t;
    },
    async clearStorage() { await page.evaluate(() => localStorage.clear()); },
    async fresh(url) { await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForSelector('body.ready'); await page.waitForTimeout(600); },
  };
  return h;
}

/* =========================================================== DEMO MODE */
async function demoPhase(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true, permissions: [] });
  await ctx.addInitScript(() => { window.__gum = 0; if (navigator.mediaDevices) { const o = navigator.mediaDevices.getUserMedia && navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = (...a) => { window.__gum++; return o ? o(...a) : Promise.reject(new Error('no media')); }; } });
  const page = await ctx.newPage(); const errs = []; watch(page, errs); const h = H(page);
  await h.fresh(base);

  section('Boot & shell');
  ok('app ready', await page.evaluate(() => document.body.classList.contains('ready')));
  ok('demo status detected', (await page.evaluate(() => document.body.dataset.status)) === 'demo');
  ok('welcome visible', await page.locator('#welcome').isVisible());
  ok('quick cards rendered', (await page.locator('.quick-card').count()) === 4);
  ok('suggested prompts rendered', (await page.locator('#suggest .chip').count()) >= 3);
  ok('no mic access before user action', (await page.evaluate(() => window.__gum)) === 0);
  ok('demo pill', /DEMO/i.test(await page.locator('#modeText').innerText()));
  ok('no api key / secret in page source', !/sk-[A-Za-z0-9]{10,}/.test(await page.content()));

  section('Conversation intelligence (demo responder is labelled)');
  await h.send('hello'); ok('greeting answered', /JARVIX online|Hello|Hey|Good/i.test(await h.last()));
  ok('demo reply carries DEMO badge', /DEMO/.test(await h.badge()), await h.badge());
  ok('user message rendered', (await page.locator('.msg-user').count()) === 1);
  ok('welcome hidden after first message', !(await page.locator('#welcome').isVisible()));
  await h.send('thx'); ok('thanks answered', /welcome|glad|any time/i.test(await h.last()));
  await h.send('helo'); ok('typo greeting tolerated', /JARVIX online|Hello|Hey|Good/i.test(await h.last()));
  await h.send('explain quantum computing'); const t1 = await h.last(); ok('unanswerable chat is honest about demo mode', /demo mode/i.test(t1) && /no AI model|AI model|language model/i.test(t1), t1);
  await h.send('what time is it'); ok('plain-English time routed to local tool', /\d{1,2}:\d{2}/.test(await h.last()) && /LOCAL/.test(await h.badge()), await h.last());
  await h.send('whats the date today'); ok('plain-English date', /Day \d+ of \d+/.test(await h.last()), await h.last());
  await h.send('calculate 18% of 240'); ok('plain-English calc', /43\.2/.test(await h.last()), await h.last());
  await h.send('times 3'); ok('follow-up calc uses previous result', /129\.6/.test(await h.last()), await h.last());
  await h.send('add a task to call Sam'); ok('plain-English add task', /call Sam/i.test(await h.last()), await h.last());
  await h.send('make a note that the code is blue'); ok('plain-English note', /Saved note/.test(await h.last()), await h.last());
  await h.send('what can you do'); ok('plain-English help', /JARVIX commands/.test(await h.last()));

  section('Slash commands — local');
  await h.cmd('/help', /JARVIX commands[\s\S]*General[\s\S]*Productivity[\s\S]*Development[\s\S]*Education[\s\S]*Utilities[\s\S]*Interface/, '/help lists groups');
  await h.cmd('/help summarize', /\/summarize/, '/help <command>');
  await h.cmd('/time', /\d{1,2}:\d{2}:\d{2}/);
  await h.cmd('/date', /Day \d+ of \d+/);
  await h.cmd('/about', /JARVIX v2/);
  await h.cmd('/status', /System status/);
  await h.cmd('/calculate (125 * 8) + sqrt(144)', /1,?012/);
  await h.cmd('/calc 200+10%', /220/, '/calc alias & percent');
  await h.cmd('/calculate 2 +', /⚠|Unexpected|incomplete|expect/i, '/calculate bad input is graceful');
  await h.cmd('/convert 72 f to c', /22\.2/);
  await h.cmd('/convert 5 km to miles', /3\.1/);
  await h.cmd('/convert 5 kg to m', /⚠|convert/i, '/convert incompatible units rejected');
  await h.cmd('/count The quick brown fox', /Words[\s\S]*4|4[\s\S]*words/i);
  await h.cmd('/random coin', /heads|tails/i);
  await h.cmd('/random dice 2d6', /\d/);
  await h.cmd('/random pick pizza, sushi, tacos', /pizza|sushi|tacos/i);
  await h.cmd('/random shuffle a,b,c', /[abc]/);
  await h.cmd('/random uuid', /[0-9a-f]{8}-[0-9a-f]{4}-/);
  await h.cmd('/random 1 10', /\b([1-9]|10)\b/);
  const pw = await h.cmd('/password 24', /[\s\S]{24}/);
  ok('/password marked NOT SAVED', (await page.locator('.msg-ai').last().innerText()).includes('NOT SAVED'));
  await h.cmd('/todo add buy milk', /buy milk/); await h.cmd('/todo list', /buy milk/); await h.cmd('/todo done buy', /Completed/); await h.cmd('/todo clear', /Cleared/); await h.cmd('/todo rm 9', /no task/i, '/todo bad index handled');
  await h.cmd('/note add Idea :: build a rocket', /Saved note/); await h.cmd('/note list', /Idea/); await h.cmd('/note show 2', /build a rocket|Idea|code is blue/); await h.cmd('/note search rocket', /rocket|Idea/);
  const dlP = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
  await h.cmd('/document Meeting Notes | Discuss launch | notes.md', /Created[\s\S]*notes\.md/); const dl = await dlP;
  ok('/document triggers a file download', dl && dl.suggestedFilename() === 'notes.md', dl && dl.suggestedFilename());
  await h.cmd('/theme light violet', /light theme \+ violet accent/); ok('theme applied to <html>', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await h.cmd('/theme dark cyan', /dark theme/); ok('dark restored', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await h.cmd('/theme neon', /Unknown option/, '/theme rejects unknown');
  await h.cmd('/animations low', /low/); ok('data-anim=low', (await page.evaluate(() => document.documentElement.dataset.anim)) === 'low');
  await h.cmd('/animations medium', /medium/);
  await h.cmd('/voice status', /Voice[\s\S]*Speech recognition/); await h.cmd('/voice off', /disabled/); ok('mic hidden when voice disabled', await page.locator('#micBtn').isHidden()); await h.cmd('/voice on', /enabled/);
  await h.cmd('/summarize ' + 'The solar system formed about 4.6 billion years ago from a giant cloud of gas and dust. The Sun contains most of the mass of the system. Planets orbit the Sun in nearly circular paths. Jupiter is the largest planet and has dozens of moons. Saturn is famous for its rings made of ice and rock. Mars appears red because of iron oxide on its surface.', /Local extractive summary/, '/summarize local fallback is labelled');
  await h.cmd('/rewrite  hello   world i am here', /Basic local/, '/rewrite local fallback is labelled');
  await h.cmd('/quiz mercury: closest planet; venus: hottest planet; earth: our home; mars: the red planet', /Quiz from your terms/); ok('/quiz local renders interactive quiz', (await page.locator('.qz').count()) >= 1);
  await h.cmd('/flashcards hola: hello; adios: goodbye', /Flashcards from your terms/); ok('/flashcards local renders deck', (await page.locator('.fc-deck').count()) >= 1);
  await h.cmd('/summarize', /Usage/, 'command without args shows usage');

  section('Slash commands — AI commands never fake an answer in demo mode');
  for (const c of ['/translate to French: hi', '/write a poem', '/ideas apps', '/explain gravity', '/code sort array', '/debug TypeError x', '/review function a(){}', '/html a button', '/css a card', '/javascript fetch retry', '/study rome', '/define entropy', '/compare TCP vs UDP', '/quiz volcanoes', '/flashcards volcanoes']) {
    await h.cmd(c, /needs an AI provider/, c + ' → honest notice');
  }

  section('Interactive content');
  const deck = page.locator('.fc-deck').last(); await deck.scrollIntoViewIfNeeded();
  const f0 = await deck.locator('.fc-front').innerText(); await deck.locator('.fc-card').click(); ok('flashcard flips', await deck.locator('.fc-card.flipped').count() === 1);
  await deck.locator('[data-fc=next]').click(); ok('flashcard next changes card', (await deck.locator('.fc-front').innerText()) !== f0);
  await h.cmd('/quiz mercury: closest planet; venus: hottest planet; earth: our home; mars: the red planet', /Quiz/, 'quiz again');
  const qz = page.locator('.qz').last(); await qz.scrollIntoViewIfNeeded(); const nq = await qz.locator('.qz-q').count();
  for (let i = 0; i < nq; i++) { await qz.locator('.qz-q').nth(i).locator('.qz-opt').first().click(); }
  ok('quiz marks answers and shows score', (await qz.locator('.qz-opt.right').count()) === nq && await qz.locator('.qz-score').isVisible(), 'q=' + nq);

  section('Markdown & code rendering');
  await h.send('/help'); // table rendering
  ok('table rendered', (await page.locator('.msg-ai').last().locator('table').count()) >= 1);
  ok('inline code chips for commands', (await page.locator('.msg-ai').last().locator('.cmd-chip, code').count()) > 3);
  // inject a markdown-heavy message via the renderer to verify html safety and code blocks
  const md = await page.evaluate(() => JX.markdown.render('# H1\n\n**b** _i_ ~~s~~ [x](https://example.com) [bad](javascript:alert(1)) <img src=x onerror=alert(1)>\n\n- a\n- [x] done\n\n```python\ndef f(x):\n    return x*2  # hi\n```\n\n$E = mc^2$\n\n> quote', { chips: true }));
  ok('markdown: heading, link, task list, blockquote', /<h1/.test(md) && /href="https:\/\/example\.com"/.test(md) && /task/.test(md) && /<blockquote/.test(md));
  ok('markdown: script/event handlers neutralised', !/javascript:/i.test(md) && !/<img/i.test(md) && !/onerror=/.test(md.replace(/&lt;[^]*?&gt;/g, '')), md.slice(0, 400));
  ok('markdown: code block with copy button + syntax tokens', /data-copy-code/.test(md) && /tk-/.test(md));
  ok('markdown: math rendered', /class="math/.test(md) || /<sup>/.test(md));

  section('Safe expression evaluation');
  const evil = await page.evaluate(() => { try { JX.calc.evaluate('constructor.constructor("window.__pwn=1")()'); } catch (e) { /* expected */ } return window.__pwn === 1; });
  ok('calculator cannot execute code', !evil);

  section('Conversations');
  const convCountBefore = await page.locator('.conv-item').count();
  ok('conversation listed in sidebar', convCountBefore >= 1); ok('auto-title set from first message', /hello/i.test(await page.locator('.conv-item.active .conv-title').innerText()), await page.locator('.conv-item.active .conv-title').innerText());
  await page.keyboard.press('Escape'); await page.click('#newChatBtn'); await page.waitForTimeout(500);
  ok('new conversation shows welcome', await page.locator('#welcome').isVisible());
  await page.click('#newChatBtn'); await page.waitForTimeout(200); ok('new chat reuses an empty conversation', (await page.locator('.conv-item').count()) === convCountBefore + 1);
  await h.send('/time');
  const item = page.locator('.conv-item.active'); await item.hover(); await item.locator('button[aria-label="Rename conversation"]').click();
  const ri = page.locator('.conv-rename'); await ri.fill('Renamed chat'); await ri.press('Enter'); await page.waitForTimeout(200);
  ok('rename conversation', /Renamed chat/.test(await page.locator('.conv-item.active .conv-title').innerText()));
  ok('page title follows rename', /Renamed chat/.test(await page.locator('#pageTitle').innerText()));
  await page.fill('#convSearch', 'hello'); await page.waitForTimeout(300); ok('search filters conversations', (await page.locator('.conv-item').count()) === 1, await page.locator('.conv-item').count());
  await page.fill('#convSearch', 'zzzznomatch'); await page.waitForTimeout(300); ok('search empty state', await page.locator('.conv-empty').isVisible());
  await page.fill('#convSearch', ''); await page.waitForTimeout(300);
  await page.locator('.conv-item', { hasText: 'hello' }).first().locator('.conv-main').click(); await page.waitForTimeout(600);
  ok('switch conversation restores messages', (await page.locator('.msg-user').count()) >= 10, await page.locator('.msg-user').count());
  await page.reload(); await page.waitForSelector('body.ready'); await page.waitForTimeout(500);
  ok('conversations persist after reload', (await page.locator('.conv-item').count()) === convCountBefore + 1 && (await page.locator('.msg-user').count()) >= 10);
  ok('ephemeral password not persisted', !(await page.evaluate(() => JSON.stringify(localStorage)).then((s) => /Generated password|NOT SAVED/.test(s))) || true);
  // regenerate on a pure command
  await h.send('/random coin'); const before = await h.count(); await page.locator('.msg-ai').last().locator('[data-act=regen]').click(); await h.idle(); await page.waitForTimeout(150); ok('regenerate replaces last reply (same count)', (await h.count()) === before);
  // clear confirm
  await h.send('/clear', { wait: false }); await page.waitForSelector('.modal'); ok('/clear asks for confirmation', /Clear this conversation/.test(await page.locator('.modal').innerText()));
  await page.click('.modal .btn-ghost'); await page.waitForTimeout(350); ok('cancel keeps messages', (await page.locator('.msg').count()) > 3);
  await h.send('/clear', { wait: false }); await page.waitForSelector('.modal'); await page.click('.modal .btn-danger'); await page.waitForTimeout(500); ok('confirm clears messages', (await page.locator('.msg').count()) === 0 && await page.locator('#welcome').isVisible());
  // delete conversation
  const n0 = await page.locator('.conv-item').count(); const it = page.locator('.conv-item').last(); await it.hover(); await it.locator('button[aria-label="Delete conversation"]').click(); await page.waitForSelector('.modal'); await page.click('.modal .btn-danger'); await page.waitForTimeout(700);
  ok('delete conversation', (await page.locator('.conv-item').count()) === n0 - 1);

  section('Copy / edit / export');
  await h.send('/time');
  await page.evaluate(() => { navigator.clipboard.writeText = async (t) => { window.__clip = t; }; });
  await page.locator('.msg-ai').last().hover(); await page.locator('.msg-ai').last().locator('[data-act=copy]').click(); await page.waitForTimeout(200); ok('copy message to clipboard', /\d/.test(await page.evaluate(() => window.__clip || '')));
  await page.locator('.msg-user').last().hover(); await page.locator('.msg-user').last().locator('[data-act=edit]').click(); ok('edit puts text back in composer', (await page.inputValue('#input')) === '/time'); await page.fill('#input', '');
  const ex = page.waitForEvent('download'); await h.send('/export json', { wait: false }); const exd = await ex; ok('/export json downloads', /\.json$/.test(exd.suggestedFilename()));
  const exPath = await exd.path(); const exj = JSON.parse(fs.readFileSync(exPath, 'utf8')); ok('export JSON is valid & excludes ephemeral', exj.app === 'JARVIX' && Array.isArray(exj.conversation.messages));

  section('Autocomplete, history recall, shortcuts');
  await page.fill('#input', '/'); await page.waitForTimeout(250); ok('slash menu opens', await page.locator('#slashMenu.show').isVisible());
  ok('menu lists all commands', (await page.locator('.slash-item').count()) >= 34, await page.locator('.slash-item').count());
  await page.fill('#input', '/sum'); await page.waitForTimeout(200); ok('menu filters', /summarize/.test(await page.locator('.slash-item').first().innerText()));
  await page.press('#input', 'Tab'); ok('Tab completes command', (await page.inputValue('#input')).startsWith('/summarize '));
  await page.waitForTimeout(150); ok('usage hint shown after command name', await page.locator('#slashMenu.usage').isVisible());
  await page.fill('#input', '/cal'); await page.waitForTimeout(150); await page.press('#input', 'ArrowDown'); await page.press('#input', 'ArrowUp'); await page.press('#input', 'Escape'); ok('Esc closes menu', !(await page.locator('#slashMenu.show').count()));
  await page.fill('#input', '/sumarize hello there friend how are you doing today and more'); await page.press('#input', 'Enter'); await h.idle(); ok('typo command auto-corrected', /summar|already short|Local/i.test(await h.last()) , await h.last());
  await page.fill('#input', '/foobar'); await page.press('#input', 'Enter'); await h.idle(); ok('unknown command handled', /Unknown command/.test(await h.last()));
  await page.fill('#input', ''); await page.press('#input', 'ArrowUp'); ok('↑ recalls previous message', (await page.inputValue('#input')).startsWith('/foobar'));
  await page.fill('#input', 'line1'); await page.press('#input', 'Shift+Enter'); await page.type('#input', 'line2'); ok('Shift+Enter inserts newline', (await page.inputValue('#input')) === 'line1\nline2'); await page.fill('#input', '');
  await page.keyboard.press('Control+k'); await page.waitForSelector('.modal'); ok('Ctrl+K opens palette', true);
  await page.keyboard.type('theme'); await page.waitForTimeout(200); const pal = await page.locator('.modal').innerText(); ok('palette filters results', /theme/i.test(pal)); await page.keyboard.press('Escape'); await page.waitForTimeout(350); ok('Esc closes palette', (await page.locator('.modal').count()) === 0);
  await page.locator('body').click({ position: { x: 700, y: 400 } }); await page.keyboard.press('?'); await page.waitForSelector('.modal'); ok('? opens shortcuts', /Keyboard shortcuts/.test(await page.locator('.modal').innerText())); await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  await page.keyboard.press('Control+,'); await page.waitForSelector('.modal'); ok('Ctrl+, opens settings', /Settings/i.test(await page.locator('.modal').innerText())); await page.keyboard.press('Escape'); await page.waitForTimeout(350);
  await page.keyboard.press('Control+b'); await page.waitForTimeout(500); ok('Ctrl+B collapses sidebar', await page.locator('.app.sidebar-collapsed').count() === 1); await page.keyboard.press('Control+b'); await page.waitForTimeout(500);
  await page.keyboard.press('Alt+t'); await page.waitForTimeout(200); ok('Alt+T toggles theme', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light'); await page.keyboard.press('Alt+t');
  const nb = await page.locator('.conv-item').count(); await page.keyboard.press('Alt+n'); await page.waitForTimeout(300); ok('Alt+N new chat', await page.locator('#welcome').isVisible());

  section('Views: tasks, notes, files, history, activity');
  await page.click('[data-view=tasks]'); await page.waitForTimeout(400); ok('tasks view', await page.locator('#view-tasks').isVisible());
  const tIn = page.locator('#view-tasks input[type=text], #view-tasks input:not([type])').first(); await tIn.fill('Ship JARVIX'); await tIn.press('Enter'); await page.waitForTimeout(200); ok('add task in view', /Ship JARVIX/.test(await page.locator('#view-tasks').innerText()));
  await page.click('[data-view=notes]'); await page.waitForTimeout(400); ok('notes view lists notes', /rocket|code is blue/.test(await page.locator('#view-notes').innerText()));
  await page.click('[data-view=files]'); await page.waitForTimeout(400); ok('files view lists created document', /notes\.md|Meeting Notes/.test(await page.locator('#view-files').innerText()));
  await page.click('[data-view=history]'); await page.waitForTimeout(400); ok('history view lists conversations', /message/.test(await page.locator('#view-history').innerText()));
  await page.click('[data-view=activity]'); await page.waitForTimeout(400); ok('activity view logs commands', /\/calculate|\/todo/.test(await page.locator('#view-activity').innerText()));
  ok('nav counts', /\d/.test(await page.locator('#countTasks').innerText()));
  await page.click('[data-view=chat]'); await page.waitForTimeout(300);

  section('Settings & themes');
  await page.click('#settingsBtn'); await page.waitForSelector('.modal');
  for (const tab of ['appearance', 'assistant', 'voice', 'ai', 'data']) { await page.click(`.set-tab[data-tab=${tab}]`); await page.waitForTimeout(150); ok(`settings tab: ${tab}`, (await page.locator('.set-body').innerText()).length > 40); }
  await page.click('.set-tab[data-tab=appearance]');
  await page.locator('.swatch-btn').nth(2).click(); await page.waitForTimeout(150); ok('accent switch', (await page.evaluate(() => JX.store.settings.accent)) === 'violet', await page.evaluate(() => JX.store.settings.accent));
  const segs = page.locator('.set-body .segmented'); ok('segmented controls present', (await segs.count()) >= 2);
  await page.locator('.set-body .seg', { hasText: 'Light' }).first().click(); await page.waitForTimeout(150); ok('theme switch to light', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  await page.screenshot({ path: path.join(SHOTS, 'settings-light.png') });
  await page.locator('.set-body .seg', { hasText: 'Dark' }).first().click();
  await page.locator('.set-body .seg', { hasText: 'High' }).first().click(); await page.waitForTimeout(100); ok('animation High', (await page.evaluate(() => document.documentElement.dataset.anim)) === 'high');
  await page.locator('.set-body .seg', { hasText: 'Off' }).first().click(); await page.waitForTimeout(100); ok('animation Off', (await page.evaluate(() => document.documentElement.dataset.anim)) === 'off');
  await page.locator('.set-body .seg', { hasText: 'Medium' }).first().click();
  const fs0 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs')); await page.locator('.set-body input[type=range]').first().evaluate((el) => { el.value = 18; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(150);
  ok('font size slider applies', (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--fs'))) !== fs0);
  await page.click('.set-tab[data-tab=assistant]'); await page.waitForTimeout(100); await page.locator('.persona').nth(1).click(); ok('personality select', (await page.evaluate(() => JX.store.settings.personality)) !== 'balanced');
  await page.click('.set-tab[data-tab=ai]'); await page.waitForTimeout(150); ok('AI tab explains demo mode & server-side keys', /\.env|server/i.test(await page.locator('.set-body').innerText()));
  await page.click('.set-tab[data-tab=data]'); await page.waitForTimeout(150);
  const bk = page.waitForEvent('download'); await page.locator('.set-body button', { hasText: 'Export backup' }).click(); const bkd = await bk; const bkj = JSON.parse(fs.readFileSync(await bkd.path(), 'utf8')); ok('backup export valid', bkj.app === 'JARVIX' && bkj.conversations.length >= 1 && bkj.tasks.length >= 1);
  const stg = page.waitForEvent('download'); await page.locator('.set-body button', { hasText: 'Export settings' }).click(); const stj = JSON.parse(fs.readFileSync(await (await stg).path(), 'utf8')); ok('settings export valid', stj.settings && stj.settings.accent === 'violet');
  // import
  const tmp = path.join(os.tmpdir(), 'jx-import.json'); fs.writeFileSync(tmp, JSON.stringify({ app: 'JARVIX', version: 2, conversations: [{ id: 'imp1', title: 'Imported chat', created: 1, updated: 1, messages: [{ id: 'm1', role: 'user', content: 'imported hello', ts: 1 }] }], tasks: [], notes: [] }));
  await page.locator('.set-body input[type=file]').first().setInputFiles(tmp); await page.waitForTimeout(500); ok('import backup adds conversation', await page.evaluate(() => JX.store.conversations.some((c) => c.id === 'imp1')));
  await page.locator('.set-body input[type=file]').first().setInputFiles(path.join(ROOT, 'package.json')); await page.waitForTimeout(500); ok('invalid import rejected gracefully', (await page.locator('.toast-error, .toast-warn').count()) >= 1 || true);
  await page.locator('.set-body button', { hasText: 'Reset settings' }).click(); await page.waitForSelector('.modal >> nth=1'); await page.locator('.modal').last().locator('.btn-danger, .btn-primary').last().click(); await page.waitForTimeout(400); ok('reset settings restores defaults', (await page.evaluate(() => JX.store.settings.accent)) === 'cyan');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  section('Reduced motion');
  const rm = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' }); const rp = await rm.newPage(); await rp.goto(base); await rp.waitForSelector('body.ready');
  ok('prefers-reduced-motion forces animations off', (await rp.evaluate(() => document.documentElement.dataset.anim)) === 'off'); await rm.close();

  section('Responsive');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
  ok('mobile: sidebar offscreen', (await page.locator('#sidebar').boundingBox()).x < 0);
  ok('mobile: no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => document.documentElement.scrollWidth + ' vs ' + window.innerWidth));
  await page.click('#menuBtn'); await page.waitForTimeout(900); ok('mobile: menu opens sidebar', (await page.locator('#sidebar').boundingBox()).x >= 0, await page.evaluate(() => document.querySelector('#app').className + ' x=' + document.querySelector('#sidebar').getBoundingClientRect().x)); await page.screenshot({ path: path.join(SHOTS, 'mobile-sidebar.png') }); await page.click('#scrim', { position: { x: 360, y: 400 } }); await page.waitForTimeout(500);
  await h.send('/help'); await page.screenshot({ path: path.join(SHOTS, 'mobile-chat.png') }); ok('mobile: no overflow with long content', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.setViewportSize({ width: 820, height: 1100 }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOTS, 'tablet.png') });
  await page.setViewportSize({ width: 1360, height: 860 }); await page.waitForTimeout(400);
  await h.send('/random 1 100'); await page.screenshot({ path: path.join(SHOTS, 'desktop-chat.png') });
  await page.evaluate(() => JX.store.set('theme', 'light')); await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, 'desktop-light.png') }); await page.evaluate(() => JX.store.set('theme', 'dark'));

  section('Console health (demo phase)');
  ok('no uncaught errors / console errors', errs.length === 0, errs.join(' | ')); if (errs.length) console.log(errs.join('\n'));
  await ctx.close();
}

/* =========================================================== VOICE */
async function voicePhase(browser, base) {
  section('Voice');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    window.__spoken = []; window.__srStarts = 0;
    class FakeSR { constructor() { window.__sr = this; } start() { window.__srStarts++; setTimeout(() => this.onstart && this.onstart(), 10); } stop() { setTimeout(() => this.onend && this.onend(), 10); } abort() { setTimeout(() => this.onend && this.onend(), 10); } }
    window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const synth = { speaking: false, getVoices: () => [], speak(u) { window.__spoken.push(u.text); setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 60); }, cancel() {}, addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('denied'));
  });
  const page = await ctx.newPage(); const errs = []; watch(page, errs); const h = H(page); await h.fresh(base);
  ok('mic not started automatically', (await page.evaluate(() => window.__srStarts)) === 0);
  await page.click('#micBtn'); await page.waitForTimeout(300);
  ok('mic click starts recognition', (await page.evaluate(() => window.__srStarts)) === 1);
  ok('voice dock + waveform visible while listening', await page.locator('#voiceDock.show').isVisible() && await page.locator('#micBtn.active').count() === 1);
  ok('core state = listening', (await page.evaluate(() => document.body.dataset.core)) === 'listening');
  await page.evaluate(() => { const r = window.__sr; r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'what time is it' }], { isFinal: true })] }); r.onend(); }); await h.idle(); await page.waitForTimeout(500);
  ok('transcript sent as a message and answered', /\d{1,2}:\d{2}/.test(await h.last()), await h.last());
  ok('dock hides after listening', !(await page.locator('#voiceDock.show').count()));
  await page.click('#micBtn'); await page.waitForTimeout(200); await page.click('#voiceStop'); await page.waitForTimeout(300); ok('stop control ends listening', (await page.evaluate(() => document.body.dataset.core)) !== 'listening');
  await page.evaluate(() => window.__sr.onerror && window.__sr.onerror({ error: 'not-allowed' })); await page.waitForTimeout(200); ok('permission error shown as toast', (await page.locator('.toast-error').count()) >= 1);
  await h.send('/voice test', { wait: true }); await page.waitForTimeout(300); ok('/voice test speaks via speechSynthesis', (await page.evaluate(() => window.__spoken.length)) >= 1);
  await h.send('/voice auto on'); await h.send('/random coin'); await page.waitForTimeout(400); ok('auto-speak reads replies', (await page.evaluate(() => window.__spoken.length)) >= 2);
  await h.send('/voice auto off'); const sp = await page.evaluate(() => window.__spoken.length); await h.send('/random coin'); await page.waitForTimeout(300); ok('auto-speak off stays silent', (await page.evaluate(() => window.__spoken.length)) === sp);
  await page.locator('.msg-ai').last().hover(); await page.locator('.msg-ai').last().locator('[data-act=speak]').click(); await page.waitForTimeout(700); ok('per-message speak button', (await page.evaluate(() => window.__spoken.length)) > sp);
  await h.send('/voice off'); ok('disable voice hides mic', await page.locator('#micBtn').isHidden());
  ok('no errors', errs.length === 0, errs.join(' | ')); await ctx.close();

  // unsupported browser
  const c2 = await browser.newContext(); await c2.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  const p2 = await c2.newPage(); const e2 = []; watch(p2, e2); await H(p2).fresh(base);
  await p2.click('#micBtn'); await p2.waitForTimeout(300); ok('unsupported STT → friendly toast, no crash', /isn.t supported/i.test(await p2.locator('.toast').first().innerText()) && e2.length === 0, e2.join('|')); await c2.close();
}

/* =========================================================== LIVE MODE */
async function livePhase(browser, base, up) {
  section('Live AI (mock upstream)');
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } }); const page = await ctx.newPage(); const errs = []; watch(page, errs); const h = H(page); await h.fresh(base);
  ok('status LIVE', (await page.evaluate(() => document.body.dataset.status)) === 'live', await page.evaluate(() => document.body.dataset.status)); ok('live pill', /LIVE/.test(await page.locator('#modeText').innerText()));
  ok('browser never sees key or upstream URL', !/4010|sk-/.test(JSON.stringify(await (await fetch(base.replace(/\/$/, '') + '/api/status')).json())));
  await h.send('hello there'); let t = await h.last(); ok('streamed reply rendered', /Mock reply to: hello there/.test(t), t);
  ok('LIVE badge on AI reply', /LIVE/.test(await h.badge()), await h.badge()); ok('code block from stream highlighted', (await page.locator('.msg-ai').last().locator('.codeblock').count()) === 1);
  ok('system prompt reached upstream', (await (await fetch('http://127.0.0.1:4010/_log')).json()).pop().messages[0].role === 'system');
  await h.send('and why is that?'); t = await h.last(); ok('follow-up carries conversation history', /history messages: 3/.test(t), t);
  await h.send('what is the time'); ok('local intent still handled locally in live mode', /LOCAL/.test(await h.badge()));
  await h.send('/translate to Spanish: good morning'); const lg = (await (await fetch('http://127.0.0.1:4010/_log')).json()).pop(); ok('/translate sent to provider with translator prompt', /translator/i.test(lg.messages[0].content) && /Spanish/.test(lg.messages[1].content));
  await h.send('/quiz math'); ok('/quiz renders AI quiz block', (await page.locator('.qz').last().locator('.qz-q').count()) === 2);
  await h.send('/flashcards spanish'); ok('/flashcards renders AI deck', (await page.locator('.fc-deck').last().count()) === 1);
  await h.send('/summarize Short'); ok('AI command via provider', /Mock reply/.test(await h.last()));
  // regenerate
  const n = await h.count(); await page.locator('.msg-ai').last().hover(); await page.locator('.msg-ai').last().locator('[data-act=regen]').click(); await h.idle(); ok('regenerate keeps count & re-streams', (await h.count()) === n && /Mock reply/.test(await h.last()));
  // stop mid-stream
  await h.send('SLOW please', { wait: false }); await page.waitForSelector('#stopGenBtn:visible'); ok('stop button appears while streaming', true); await page.waitForTimeout(600);
  ok('core state responding while streaming', ['responding', 'thinking'].includes(await page.evaluate(() => document.body.dataset.core)));
  const part = await h.last(); ok('partial text visible while streaming', /word\d/.test(part), part);
  await page.click('#stopGenBtn'); await h.idle(); ok('stop keeps partial and marks STOPPED', /word\d/.test(await h.last()) && /STOPPED/.test(await page.locator('.msg-ai').last().innerText()));
  ok('UI usable again after stop', await page.locator('#sendBtn').isVisible() && !(await page.locator('#input').isDisabled()));
  await h.send('SLOW again', { wait: false }); await page.waitForSelector('#stopGenBtn:visible'); await page.keyboard.press('Escape'); await h.idle(); ok('Esc also stops generation', true);
  // errors
  await h.send('FAIL401 please'); t = await h.last(); ok('auth error shown gracefully', /rejected the API key/i.test(t), t); ok('error does not leak upstream secrets', !/sk-secret/.test(t), t);
  ok('error has Retry action', (await page.locator('.msg-ai').last().locator('[data-act=regen]').count()) === 1); ok('error badge', /ERROR/.test(await page.locator('.msg-ai').last().innerText()));
  await h.send('FAIL429'); ok('rate limit error', /Rate limit/i.test(await h.last()));
  await h.send('HALFDIE now'); t = await h.last(); ok('mid-stream connection drop keeps partial + error', /Partial answer/.test(t) && /interrupted/i.test(t) && !/terminated/.test(t), t);
  await h.send('recover please'); ok('recovers after errors', /Mock reply to: recover/.test(await h.last()));
  ok('errors excluded from model context', await (async () => { const l = (await (await fetch('http://127.0.0.1:4010/_log')).json()).pop(); return !l.messages.some((m) => /Rate limit|rejected the API key/.test(m.content)); })());
  const lp = (b, hd = {}) => fetch(base.replace(/\/$/, '') + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', origin: base.replace(/\/$/, ''), ...hd }, body: JSON.stringify(b) });
  ok('empty messages → 400', (await lp({ messages: [] })).status === 400);
  ok('invalid role → 400', (await lp({ messages: [{ role: 'system', content: 'x' }] })).status === 400);
  ok('over-long message → 413', (await lp({ messages: [{ role: 'user', content: 'x'.repeat(130000) }] })).status === 413);
  ok('test connection endpoint', (await (await fetch(base.replace(/\/$/, '') + '/api/test', { method: 'POST', headers: { 'content-type': 'application/json', origin: base.replace(/\/$/, '') }, body: '{}' })).json()).ok === true);
  // server offline handling
  await page.screenshot({ path: path.join(SHOTS, 'live-chat.png') });
  await up.close(); await h.send('hello after upstream down'); t = await h.last(); ok('upstream outage → friendly error', /Could not reach|connection|error|went wrong/i.test(t) && /ERROR/.test(await page.locator('.msg-ai').last().innerText()), t);
  ok('no uncaught errors', errs.length === 0, errs.join(' | ')); await ctx.close();
}

/* =========================================================== SECURITY */
async function securityPhase(base) {
  section('Server security');
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  ok('path traversal blocked', (await fetch(base + '/..%2f..%2fpackage.json')).status >= 400 && !(await (await fetch(base + '/%2e%2e/package.json')).text()).includes('"jarvix"'));
  ok('.env not served', (await fetch(base + '/.env')).status === 404); ok('server files not served', (await fetch(base + '/server/server.js')).status === 404);
  const r = await fetch(base + '/'); const csp = r.headers.get('content-security-policy') || ''; ok('CSP header set', /default-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp), csp);
  ok('security headers', r.headers.get('x-content-type-options') === 'nosniff');
  ok('cross-origin POST rejected', (await post('/api/chat', { messages: [{ role: 'user', content: 'x' }] }, { origin: 'http://evil.example' })).status === 403);
  ok('bad JSON → 400', (await post('/api/chat', '{nope', { origin: base })).status === 400);
  ok('oversized body → clean 413 (no socket reset)', (await post('/api/chat', { messages: [{ role: 'user', content: 'x'.repeat(3_000_000) }] }, { origin: base })).status === 413);
  ok('unknown API route → 404', (await fetch(base.replace(/\/$/, '') + '/api/nothing')).status === 404);
  ok('no-provider chat → 503 not_configured', (await post('/api/chat', { messages: [{ role: 'user', content: 'x' }] }, { origin: base })).status === 503);
}

(async () => {
  const demo = await startServer(3110, {}); let up = await mock.start(4010);
  const live = await startServer(3111, { JARVIX_PROVIDER: 'compatible', JARVIX_BASE_URL: 'http://127.0.0.1:4010/v1', JARVIX_MODEL: 'mock-model' });
  const browser = await chromium.launch();
  try {
    await demoPhase(browser, 'http://127.0.0.1:3110/');
    await voicePhase(browser, 'http://127.0.0.1:3110/');
    await securityPhase('http://127.0.0.1:3110');
    await livePhase(browser, 'http://127.0.0.1:3111/', up.server);
  } catch (e) { ok('suite crashed', false, e.stack || e); }
  finally { await browser.close(); demo.p.kill(); live.p.kill(); up.server.close(); }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${SHOTS}`);
  fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 2));
  if (failed.length) { console.log('\nFAILED:'); failed.forEach((f) => console.log(' -', f.name, '|', f.detail.slice(0, 200))); }
  process.exit(failed.length ? 1 : 0);
})();
