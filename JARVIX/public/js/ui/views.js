/* JARVIX — view router and secondary views: Tasks, Notes, Files, History, Activity, plus the chat welcome screen. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, $$, el, fmtDateTime, relDay, debounce } = JX.util;
  const S = JX.store;
  const ui = JX.ui;

  const TITLES = { chat: null, tasks: 'Tasks', notes: 'Notes', files: 'Files', history: 'History', activity: 'Activity' };
  let current = 'chat';

  /* ---------- router ---------- */
  ui.showView = function (name, arg) {
    if (!TITLES.hasOwnProperty(name)) name = 'chat';
    const prev = current; current = name;
    $$('.view').forEach((v) => { const on = v.id === 'view-' + name; if (on && v.hidden) { v.hidden = false; v.classList.remove('view-in'); void v.offsetWidth; v.classList.add('view-in'); } else if (!on) v.hidden = true; });
    $$('.nav-item').forEach((b) => { const on = b.dataset.view === name; b.classList.toggle('active', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    if (name !== 'chat') { renderers[name] && renderers[name](arg); }
    updateTitle(); ui.positionIndicator && ui.positionIndicator(); ui.bus.emit('view', name);
    ui.closeSidebarIfMobile && ui.closeSidebarIfMobile();
    if (name === 'chat' && prev !== 'chat') setTimeout(() => JX.messages.scroll(true), 0);
  };
  ui.currentView = () => current;

  function updateTitle() {
    const conv = S.active();
    $('#pageTitle').textContent = current === 'chat' ? (conv ? conv.title : 'New conversation') : TITLES[current];
    document.title = (current === 'chat' ? (conv && conv.messages.length ? conv.title : 'AI Command Center') : TITLES[current]) + ' — JARVIX';
  }
  ui.updateTitle = updateTitle;

  const head = (title, sub, ...actions) => el('div', { class: 'view-head' }, el('div', {}, el('h2', {}, title), el('p', {}, sub)), el('div', { class: 'view-actions' }, actions));
  const empty = (icon, title, sub, action) => el('div', { class: 'empty-state' }, el('div', { class: 'es-ic', html: JX.icon(icon, 30) }), el('h3', {}, title), el('p', {}, sub), action || null);
  const btn = (label, onclick, cls = 'btn', icon) => {
    const b = el('button', { type: 'button', class: cls, onclick });
    if (icon) b.innerHTML = JX.icon(icon, 16);
    b.append(el('span', {}, label));
    return b;
  };

  const renderers = {};
  const root = (n) => $('#view-' + n);

  /* ---------- Tasks ---------- */
  let taskFilter = 'all';
  renderers.tasks = function () {
    const host = root('tasks'); host.innerHTML = '';
    const open = S.tasks.filter((t) => !t.done).length;
    const input = el('input', { class: 'inline-input', placeholder: 'Add a task and press Enter…', maxlength: 300, 'aria-label': 'New task' });
    const add = () => { if (input.value.trim()) { S.addTask(input.value); S.logActivity('Task added', input.value.trim()); input.value = ''; } input.focus(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    host.append(head('Tasks', `${open} open · ${S.tasks.length - open} done`, S.tasks.some((t) => t.done) ? btn('Clear completed', async () => { const n = S.clearDoneTasks(); ui.toast(`Cleared ${n} completed task${n === 1 ? '' : 's'}`, 'success'); }, 'btn btn-ghost', 'trash') : null));
    host.append(el('div', { class: 'add-row' }, input, btn('Add', add, 'btn btn-primary', 'plus')));
    host.append(ui.segmented([['all', 'All'], ['open', 'Open'], ['done', 'Done']], taskFilter, (v) => { taskFilter = v; renderers.tasks(); }, 'Filter tasks'));
    const shown = S.tasks.filter((t) => taskFilter === 'all' || (taskFilter === 'open' ? !t.done : t.done));
    if (!shown.length) { host.append(empty('tasks', S.tasks.length ? 'Nothing here' : 'No tasks yet', S.tasks.length ? 'No tasks match this filter.' : 'Add one above, or tell JARVIX: “add a task to call Sam”.')); return; }
    const list = el('ul', { class: 'card-list' });
    shown.forEach((t) => {
      const cb = el('input', { type: 'checkbox', 'aria-label': `Mark “${t.text}” ${t.done ? 'not done' : 'done'}` }); cb.checked = t.done;
      cb.addEventListener('change', () => S.updateTask(t.id, { done: cb.checked }));
      const text = el('span', { class: 'row-text' }, t.text);
      text.addEventListener('dblclick', () => editInline(text, t.text, (v) => S.updateTask(t.id, { text: v })));
      list.append(el('li', { class: 'row' + (t.done ? ' done' : ''), 'data-id': t.id }, el('label', { class: 'check' }, cb, el('i', {})), text, el('time', { class: 'row-time' }, fmtDateTime(t.created)),
        el('button', { type: 'button', class: 'mini-btn', 'aria-label': 'Edit task', title: 'Edit (or double-click)', html: JX.icon('edit', 15), onclick: () => editInline(text, t.text, (v) => S.updateTask(t.id, { text: v })) }),
        el('button', { type: 'button', class: 'mini-btn danger', 'aria-label': 'Delete task', title: 'Delete', html: JX.icon('trash', 15), onclick: () => S.removeTask(t.id) })));
    });
    host.append(list); host.append(el('p', { class: 'hint' }, 'Tip: double-click a task to edit it.'));
  };
  function editInline(node, value, save) {
    const inp = el('input', { class: 'inline-input row-edit', value, maxlength: 300, 'aria-label': 'Edit text' }); node.replaceWith(inp); inp.focus(); inp.select();
    let done = false; const fin = (ok) => { if (done) return; done = true; if (ok && inp.value.trim()) save(inp.value.trim()); else inp.replaceWith(node); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') { e.stopPropagation(); fin(false); } }); inp.addEventListener('blur', () => fin(true));
  }

  /* ---------- Notes ---------- */
  let noteQuery = '';
  renderers.notes = function () {
    const host = root('notes'); host.innerHTML = '';
    const search = el('input', { class: 'inline-input', type: 'search', placeholder: 'Search notes…', value: noteQuery, 'aria-label': 'Search notes' });
    search.addEventListener('input', debounce(() => { noteQuery = search.value; renderNoteGrid(grid); }, 100));
    host.append(head('Notes', `${S.notes.length} saved in this browser`, btn('New note', () => openNote(null), 'btn btn-primary', 'plus')));
    host.append(el('div', { class: 'add-row' }, search));
    const grid = el('div', { class: 'note-grid' }); host.append(grid); renderNoteGrid(grid);
  };
  function renderNoteGrid(grid) {
    grid.innerHTML = ''; const q = noteQuery.trim().toLowerCase();
    const notes = S.notes.filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().includes(q));
    if (!notes.length) { grid.replaceWith(Object.assign(empty('note', S.notes.length ? 'No matching notes' : 'No notes yet', S.notes.length ? 'Try a different search.' : 'Create one here, or say: “make a note that the deadline is Friday”.'), { className: 'empty-state' })); return; }
    notes.forEach((n) => grid.append(el('article', { class: 'note-card', tabindex: '0', role: 'button', 'aria-label': `Open note ${n.title || 'untitled'}`, onclick: () => openNote(n), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNote(n); } } },
      el('h3', {}, n.title || n.body.split('\n')[0].slice(0, 50) || 'Untitled'), el('p', {}, n.body.slice(0, 220) + (n.body.length > 220 ? '…' : '')), el('time', {}, fmtDateTime(n.updated)))));
  }
  function openNote(note) {
    const title = el('input', { class: 'inline-input', placeholder: 'Title (optional)', value: note ? note.title : '', maxlength: 80, 'aria-label': 'Note title' });
    const body = el('textarea', { class: 'note-edit', rows: 10, placeholder: 'Write your note…', 'aria-label': 'Note body', 'data-autofocus': '' }); body.value = note ? note.body : '';
    const save = el('button', { type: 'button', class: 'btn btn-primary' }, note ? 'Save changes' : 'Save note');
    const del = note ? el('button', { type: 'button', class: 'btn btn-danger-ghost' }, 'Delete') : null;
    const m = ui.modal({ title: note ? 'Edit note' : 'New note', size: 'lg', content: el('div', { class: 'stack' }, title, body), footer: [del, save] });
    save.addEventListener('click', () => { if (!body.value.trim() && !title.value.trim()) return ui.toast('The note is empty.', 'warn'); note ? S.updateNote(note.id, { title: title.value.trim(), body: body.value }) : S.addNote(body.value, title.value); ui.toast('Note saved', 'success', { duration: 1600 }); m.close(); });
    if (del) del.addEventListener('click', async () => { m.close(); if (await ui.confirm({ title: 'Delete this note?', body: 'This cannot be undone.', confirm: 'Delete', danger: true })) { S.removeNote(note.id); ui.toast('Note deleted', 'info'); } });
  }

  /* ---------- Files ---------- */
  renderers.files = function () {
    const host = root('files'); host.innerHTML = '';
    host.append(head('Files', 'Documents created with /document — stored in this browser', btn('Create document', () => { ui.showView('chat'); JX.composer.setText('/document ', true); }, 'btn btn-primary', 'plus')));
    if (!S.files.length) { host.append(empty('file', 'No files yet', 'Try: “create a document titled Project Brief and save it as brief.md”.')); return; }
    const list = el('ul', { class: 'card-list' });
    S.files.forEach((f) => list.append(el('li', { class: 'row file-row' }, el('span', { class: 'row-ic', html: JX.icon('file', 20) }),
      el('div', { class: 'row-main' }, el('b', {}, f.title), el('small', {}, `${f.filename} · ${JX.ui.fmtBytes(new Blob([f.content]).size)} · ${fmtDateTime(f.created)}`)),
      el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => preview(f) }, 'Preview'),
      el('button', { type: 'button', class: 'btn btn-small', onclick: () => JX.util.download(f.filename, f.content, /\.md$/i.test(f.filename) ? 'text/markdown' : 'text/plain') }, 'Download'),
      el('button', { type: 'button', class: 'mini-btn danger', 'aria-label': `Delete ${f.filename}`, html: JX.icon('trash', 15), onclick: () => { S.removeFile(f.id); ui.toast('File removed', 'info'); } }))));
    host.append(list);
  };
  function preview(f) { ui.modal({ title: f.filename, size: 'lg', content: el('div', { class: 'md preview', html: /\.md$/i.test(f.filename) ? JX.markdown.render(f.content) : `<pre class="plain-pre">${JX.util.esc(f.content)}</pre>` }) }); }

  /* ---------- History (conversation search) ---------- */
  renderers.history = function (query) {
    const host = root('history'); host.innerHTML = '';
    const q0 = typeof query === 'string' ? query : (host._q || ''); host._q = q0;
    const search = el('input', { class: 'inline-input', type: 'search', placeholder: 'Search every conversation…', value: q0, 'aria-label': 'Search conversation history', 'data-autofocus': '' });
    host.append(head('History', `${S.conversations.length} conversation${S.conversations.length === 1 ? '' : 's'}`, S.conversations.length ? btn('Delete all', async () => { if (await ui.confirm({ title: 'Delete all conversations?', body: `All ${S.conversations.length} conversations will be permanently removed.`, confirm: 'Delete all', danger: true })) { S.eraseConversations(); ui.toast('All conversations deleted', 'info'); } }, 'btn btn-danger-ghost', 'trash') : null));
    host.append(el('div', { class: 'add-row' }, search));
    const out = el('div', {}); host.append(out);
    const draw = () => {
      host._q = search.value; out.innerHTML = ''; const res = S.search(search.value);
      if (!S.conversations.length) return out.append(empty('history', 'No history yet', 'Your conversations will appear here, searchable.'));
      if (!res.length) return out.append(empty('search', 'No matches', `Nothing found for “${search.value}”.`));
      const list = el('ul', { class: 'card-list' });
      res.forEach(({ conv, snippet }) => list.append(el('li', { class: 'row hist-row', tabindex: '0', role: 'button', onclick: () => { S.setActive(conv.id); ui.showView('chat'); }, onkeydown: (e) => { if (e.key === 'Enter') { S.setActive(conv.id); ui.showView('chat'); } } },
        el('span', { class: 'row-ic', html: JX.icon('chat', 20) }), el('div', { class: 'row-main' }, el('b', {}, conv.title), el('small', {}, snippet || `${conv.messages.length} messages`)), el('time', { class: 'row-time' }, relDay(conv.updated) + ' · ' + fmtDateTime(conv.updated)),
        el('button', { type: 'button', class: 'mini-btn', 'aria-label': 'Export conversation', title: 'Export as Markdown', html: JX.icon('download', 15), onclick: (e) => { e.stopPropagation(); ui.exportConversation(conv, 'md'); } }))));
      out.append(list);
    };
    search.addEventListener('input', debounce(draw, 100)); draw(); if (q0) setTimeout(() => search.focus(), 50);
  };

  /* ---------- Activity ---------- */
  renderers.activity = function () {
    const host = root('activity'); host.innerHTML = '';
    host.append(head('Activity', 'A log of commands and actions (kept only in this browser)', S.activity.length ? btn('Clear log', () => { S.clearActivity(); ui.toast('Activity log cleared', 'info'); }, 'btn btn-ghost', 'trash') : null));
    const stats = el('div', { class: 'stat-grid' });
    [['Actions', S.activity.length], ['Conversations', S.conversations.length], ['Open tasks', S.tasks.filter((t) => !t.done).length], ['Notes', S.notes.length], ['Files', S.files.length]].forEach(([k, v]) => stats.append(el('div', { class: 'stat' }, el('b', {}, String(v)), el('small', {}, k))));
    host.append(stats);
    if (!S.activity.length) { host.append(empty('activity', 'No activity yet', 'Commands you run will be logged here.')); return; }
    const list = el('ul', { class: 'card-list' });
    S.activity.slice(0, 100).forEach((a) => list.append(el('li', { class: 'row' }, el('span', { class: 'row-ic', html: JX.icon('check', 18) }), el('div', { class: 'row-main' }, el('b', {}, a.text), el('small', {}, a.result)), el('time', { class: 'row-time' }, fmtDateTime(a.ts)))));
    host.append(list);
  };

  /* ---------- Welcome screen ---------- */
  const QUICK = [
    ['sparkle', 'Explain something', 'Understand any concept simply', '/explain '], ['note', 'Write content', 'Emails, posts, drafts', '/write '],
    ['command', 'Write code', 'Generate or debug code', '/code '], ['tasks', 'Plan my tasks', 'Manage your to-do list', '/todo '],
  ];
  const PROMPTS = ['What can you do?', 'Explain how neural networks learn', 'calculate 18% of 240', '/quiz the solar system 5', '/flashcards Spanish greetings 8', 'convert 72 f to c', '/password 24'];
  function greeting() {
    const h = new Date().getHours(); const part = h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return S.settings.name ? `${part}, ${S.settings.name}.` : `${part}.`;
  }
  function renderWelcome() {
    $('#welcomeTitle').textContent = greeting();
    const st = JX.ai.status;
    $('#welcomeSub').textContent = st.state === 'live' ? 'Connected and ready. Ask anything, or type / for commands.' : st.state === 'checking' ? 'Connecting to the core…' : 'Demo mode: local tools are ready. Connect an AI provider for full conversation.';
    $('#nameAsk').hidden = !!S.settings.name;
    const q = $('#quickCards'); q.innerHTML = '';
    QUICK.forEach(([ic, t, s, cmd]) => q.append(el('button', { type: 'button', class: 'quick-card', onclick: () => { JX.composer.setText(cmd, true); } }, el('span', { class: 'qc-ic', html: JX.icon(ic, 20) }), el('b', {}, t), el('small', {}, s))));
    const sg = $('#suggest'); sg.innerHTML = '';
    JX.tools.shuffle(PROMPTS).slice(0, 4).forEach((p) => sg.append(el('button', { type: 'button', class: 'chip', onclick: () => JX.chat.submit(p) }, p)));
  }
  ui.renderWelcome = renderWelcome;

  JX.views = {
    init() {
      $('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) ui.showView(b.dataset.view); });
      $('#nameAsk').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#nameInput').value.trim(); if (v) { S.set('name', v.slice(0, 30)); ui.toast(`Nice to meet you, ${v}.`, 'success'); } });
      const refresh = (v) => () => { if (current === v) renderers[v](); };
      S.on('tasks', refresh('tasks')); S.on('notes', () => current === 'notes' && renderers.notes()); S.on('files', refresh('files')); S.on('activity', refresh('activity'));
      S.on('conversations', () => { updateTitle(); if (current === 'history') renderers.history(root('history')._q || ''); });
      S.on('settings', () => { renderWelcome(); updateTitle(); });
      JX.ai.on('status', renderWelcome);
      renderWelcome();
    },
    renderWelcome,
  };
})();
