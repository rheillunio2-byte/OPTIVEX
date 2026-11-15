/* JARVIX — application state & persistence (localStorage). Single source of truth + tiny event bus. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { uid, storage, emitter } = JX.util;

  const K = {
    settings: 'jarvix.v2.settings', convos: 'jarvix.v2.conversations', active: 'jarvix.v2.active',
    tasks: 'jarvix.v2.tasks', notes: 'jarvix.v2.notes', files: 'jarvix.v2.files', activity: 'jarvix.v2.activity', migrated: 'jarvix.v2.migrated',
  };

  const DEFAULT_SETTINGS = {
    theme: 'dark', accent: 'cyan', fontSize: 15, animations: 'medium', sounds: false, soundVolume: 0.4,
    name: '', personality: 'balanced', responseLength: 'auto', customInstructions: '',
    voice: { enabled: true, autoSpeak: false, voiceURI: '', rate: 1, pitch: 1, lang: 'en-US' },
    ai: { provider: '', model: '', temperature: 0.7, maxTokens: 2048, streaming: true, contextMessages: 20 },
    sidebarOpen: true,
  };

  const bus = emitter();
  const S = {
    settings: structuredCloneSafe(DEFAULT_SETTINGS),
    conversations: [], activeId: null,
    tasks: [], notes: [], files: [], activity: [],
    on: bus.on, emit: bus.emit,
    defaults: DEFAULT_SETTINGS,
  };
  function structuredCloneSafe(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, over) {
    const out = Array.isArray(base) ? [...base] : { ...base };
    if (!over || typeof over !== 'object') return out;
    for (const k of Object.keys(base)) {
      if (k in over) out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], over[k]) : (typeof over[k] === typeof base[k] ? over[k] : base[k]);
    }
    return out;
  }

  /* ---------- persistence ---------- */
  let storageFailed = false;
  function persist(key, value) {
    const ok = storage.set(key, value);
    if (!ok && !storageFailed) { storageFailed = true; S.emit('storage-error'); }
  }
  const savers = {
    settings: JX.util.debounce(() => persist(K.settings, S.settings), 150),
    convos: JX.util.debounce(() => {
      const clean = S.conversations.map((c) => ({ ...c, messages: c.messages.filter((m) => !m.ephemeral).map(({ pending, ...m }) => m) }));
      persist(K.convos, clean); persist(K.active, S.activeId);
    }, 250),
    tasks: JX.util.debounce(() => persist(K.tasks, S.tasks), 150),
    notes: JX.util.debounce(() => persist(K.notes, S.notes), 150),
    files: JX.util.debounce(() => persist(K.files, S.files), 150),
    activity: JX.util.debounce(() => persist(K.activity, S.activity), 300),
  };
  S.flush = () => Object.values(savers).forEach((s) => s.flush());

  S.load = function () {
    S.settings = merge(DEFAULT_SETTINGS, storage.get(K.settings, {}));
    S.conversations = storage.get(K.convos, []).filter((c) => c && c.id && Array.isArray(c.messages));
    S.activeId = storage.get(K.active, null);
    S.tasks = storage.get(K.tasks, []); S.notes = storage.get(K.notes, []);
    S.files = storage.get(K.files, []); S.activity = storage.get(K.activity, []);
    migrateV1();
    if (!S.conversations.find((c) => c.id === S.activeId)) S.activeId = S.conversations[0] ? S.conversations[0].id : null;
  };

  /** Import data written by the original JARVIX (keys jx_tasks / jx_files / jx_history). */
  function migrateV1() {
    if (storage.get(K.migrated, false)) return;
    try {
      const old = (k) => JSON.parse(localStorage.getItem(k) || '[]');
      const tasks = old('jx_tasks'), files = old('jx_files'), hist = old('jx_history');
      tasks.forEach((t) => S.tasks.push({ id: uid('t'), text: t.name, done: !!t.done, created: Date.parse(t.created) || Date.now() }));
      files.forEach((f) => S.files.push({ id: uid('f'), title: f.title, filename: f.filename, content: f.content, created: Date.parse(f.created) || Date.now() }));
      hist.forEach((h) => S.activity.push({ id: uid('a'), text: h.command, result: h.result, ts: Date.parse(h.time) || Date.now() }));
      if (tasks.length || files.length || hist.length) { savers.tasks(); savers.files(); savers.activity(); }
    } catch { /* ignore corrupt legacy data */ }
    storage.set(K.migrated, true);
  }

  /* ---------- settings ---------- */
  S.set = function (path, value) {
    const keys = path.split('.'); let o = S.settings;
    while (keys.length > 1) o = o[keys.shift()];
    o[keys[0]] = value;
    savers.settings(); S.emit('settings', path);
  };
  S.get = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), S.settings);
  S.resetSettings = function () { S.settings = structuredCloneSafe(DEFAULT_SETTINGS); savers.settings(); S.emit('settings', '*'); };
  S.importSettings = function (obj) { S.settings = merge(DEFAULT_SETTINGS, obj); savers.settings(); S.emit('settings', '*'); };

  /* ---------- conversations ---------- */
  S.active = () => S.conversations.find((c) => c.id === S.activeId) || null;
  S.createConversation = function (title) {
    const c = { id: uid('c'), title: title || 'New conversation', auto: !title, created: Date.now(), updated: Date.now(), messages: [] };
    S.conversations.unshift(c); S.activeId = c.id;
    savers.convos(); S.emit('conversations'); S.emit('active');
    return c;
  };
  S.setActive = function (id) {
    if (!S.conversations.find((c) => c.id === id)) return;
    S.activeId = id; savers.convos(); S.emit('active');
  };
  S.ensureActive = () => S.active() || S.createConversation();
  S.renameConversation = function (id, title) {
    const c = S.conversations.find((x) => x.id === id); if (!c) return;
    c.title = (title || '').trim().slice(0, 80) || 'Untitled'; c.auto = false;
    savers.convos(); S.emit('conversations');
  };
  S.deleteConversation = function (id) {
    const i = S.conversations.findIndex((c) => c.id === id); if (i < 0) return;
    S.conversations.splice(i, 1);
    if (S.activeId === id) S.activeId = S.conversations[0] ? S.conversations[0].id : null;
    savers.convos(); S.emit('conversations'); S.emit('active');
  };
  S.clearMessages = function (id) {
    const c = S.conversations.find((x) => x.id === id); if (!c) return;
    c.messages = []; c.updated = Date.now(); if (c.auto) c.title = 'New conversation';
    savers.convos(); S.emit('conversations'); S.emit('active');
  };
  S.addMessage = function (conv, msg) {
    const m = { id: uid('m'), ts: Date.now(), ...msg };
    conv.messages.push(m); conv.updated = Date.now();
    if (conv.auto && msg.role === 'user' && conv.messages.filter((x) => x.role === 'user').length === 1) {
      conv.title = autoTitle(msg.content); S.emit('conversations');
    }
    savers.convos();
    return m;
  };
  S.touch = function (conv) { conv.updated = Date.now(); savers.convos(); S.emit('conversations'); };
  S.removeMessagesFrom = function (conv, messageId) {
    const i = conv.messages.findIndex((m) => m.id === messageId); if (i < 0) return;
    conv.messages.splice(i); savers.convos();
  };
  S.search = function (q) {
    q = q.trim().toLowerCase(); if (!q) return S.conversations.map((c) => ({ conv: c, snippet: '' }));
    const out = [];
    for (const c of S.conversations) {
      const inTitle = c.title.toLowerCase().includes(q);
      let snippet = '';
      for (const m of c.messages) {
        const i = m.content.toLowerCase().indexOf(q);
        if (i >= 0) { snippet = (i > 30 ? '…' : '') + m.content.slice(Math.max(0, i - 30), i + 70).replace(/\s+/g, ' '); break; }
      }
      if (inTitle || snippet) out.push({ conv: c, snippet });
    }
    return out;
  };

  function autoTitle(text) {
    let t = String(text).trim();
    const cm = /^\/([a-z]+)\s*(.*)$/i.exec(t);
    if (cm) t = (cm[1][0].toUpperCase() + cm[1].slice(1)) + (cm[2] ? ': ' + cm[2] : '');
    t = t.replace(/\s+/g, ' ');
    if (t.length > 44) t = t.slice(0, 44).replace(/\s+\S*$/, '') + '…';
    return t || 'New conversation';
  }

  /* ---------- tasks / notes / files / activity ---------- */
  S.addTask = function (text) {
    text = String(text || '').trim(); if (!text) return null;
    const t = { id: uid('t'), text: text.slice(0, 300), done: false, created: Date.now() };
    S.tasks.unshift(t); savers.tasks(); S.emit('tasks'); return t;
  };
  S.updateTask = function (id, patch) { const t = S.tasks.find((x) => x.id === id); if (t) { Object.assign(t, patch); savers.tasks(); S.emit('tasks'); } return t; };
  S.removeTask = function (id) { S.tasks = S.tasks.filter((t) => t.id !== id); savers.tasks(); S.emit('tasks'); };
  S.clearDoneTasks = function () { const n = S.tasks.filter((t) => t.done).length; S.tasks = S.tasks.filter((t) => !t.done); savers.tasks(); S.emit('tasks'); return n; };

  S.addNote = function (body, title) {
    body = String(body || '').trim(); if (!body && !title) return null;
    const n = { id: uid('n'), title: (title || '').trim().slice(0, 80), body: body.slice(0, 20000), created: Date.now(), updated: Date.now() };
    S.notes.unshift(n); savers.notes(); S.emit('notes'); return n;
  };
  S.updateNote = function (id, patch) { const n = S.notes.find((x) => x.id === id); if (n) { Object.assign(n, patch, { updated: Date.now() }); savers.notes(); S.emit('notes'); } return n; };
  S.removeNote = function (id) { S.notes = S.notes.filter((n) => n.id !== id); savers.notes(); S.emit('notes'); };

  S.addFile = function (title, filename, content) {
    const f = { id: uid('f'), title, filename, content, created: Date.now() };
    S.files.unshift(f); S.files = S.files.slice(0, 200); savers.files(); S.emit('files'); return f;
  };
  S.removeFile = function (id) { S.files = S.files.filter((f) => f.id !== id); savers.files(); S.emit('files'); };

  S.logActivity = function (text, result) {
    S.activity.unshift({ id: uid('a'), text: String(text).slice(0, 200), result: String(result || '').slice(0, 200), ts: Date.now() });
    S.activity = S.activity.slice(0, 200); savers.activity(); S.emit('activity');
  };
  S.clearActivity = function () { S.activity = []; savers.activity(); S.emit('activity'); };

  /* ---------- export / import ---------- */
  S.exportAll = () => ({ app: 'JARVIX', version: 2, exported: new Date().toISOString(), settings: S.settings, conversations: S.conversations.map((c) => ({ ...c, messages: c.messages.filter((m) => !m.ephemeral) })), tasks: S.tasks, notes: S.notes, files: S.files, activity: S.activity });
  S.importAll = function (obj) {
    if (!obj || obj.app !== 'JARVIX') throw new Error('That file is not a JARVIX backup.');
    if (obj.settings) S.settings = merge(DEFAULT_SETTINGS, obj.settings);
    const have = new Set(S.conversations.map((c) => c.id));
    let added = 0;
    for (const c of obj.conversations || []) if (c && c.id && Array.isArray(c.messages) && !have.has(c.id)) { S.conversations.push(c); added++; }
    S.conversations.sort((a, b) => b.updated - a.updated);
    const mergeList = (list, inc) => { const ids = new Set(list.map((x) => x.id)); (inc || []).forEach((x) => x && x.id && !ids.has(x.id) && list.push(x)); };
    mergeList(S.tasks, obj.tasks); mergeList(S.notes, obj.notes); mergeList(S.files, obj.files); mergeList(S.activity, obj.activity);
    if (!S.active()) S.activeId = S.conversations[0] ? S.conversations[0].id : null;
    S.flush();
    savers.settings(); savers.convos(); savers.tasks(); savers.notes(); savers.files(); savers.activity();
    ['settings', 'conversations', 'active', 'tasks', 'notes', 'files', 'activity'].forEach((e) => S.emit(e, '*'));
    return added;
  };
  S.eraseConversations = function () { S.conversations = []; S.activeId = null; savers.convos(); S.emit('conversations'); S.emit('active'); };
  S.eraseEverything = function () {
    Object.values(K).forEach((k) => storage.remove(k)); ['jx_tasks', 'jx_files', 'jx_history'].forEach((k) => storage.remove(k));
    S.settings = structuredCloneSafe(DEFAULT_SETTINGS); S.conversations = []; S.activeId = null; S.tasks = []; S.notes = []; S.files = []; S.activity = [];
    storage.set(K.migrated, true);
    ['settings', 'conversations', 'active', 'tasks', 'notes', 'files', 'activity'].forEach((e) => S.emit(e, '*'));
  };
  S.storageUsage = function () {
    try { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('jarvix.')) n += (localStorage.getItem(k) || '').length * 2; } return n; } catch { return 0; }
  };

  S.toMarkdown = function (conv) {
    const lines = [`# ${conv.title}`, '', `_Exported from JARVIX on ${new Date().toLocaleString()}_`, ''];
    for (const m of conv.messages) {
      if (m.ephemeral) continue;
      lines.push(`### ${m.role === 'user' ? 'You' : 'JARVIX'} · ${new Date(m.ts).toLocaleString()}`, '', m.content, '');
    }
    return lines.join('\n');
  };

  JX.store = S;
})();
