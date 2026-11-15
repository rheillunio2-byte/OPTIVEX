/* JARVIX — sidebar: conversation list (search, rename, delete), nav indicator, status card, theme button. */
(function () {
  'use strict';
  const JX = (globalThis.JX = globalThis.JX || {});
  const { $, $$, el, relDay, debounce } = JX.util;
  const S = JX.store, ui = JX.ui;
  let app, list, q = '';
  const mobile = () => window.matchMedia('(max-width: 860px)').matches;

  ui.toggleSidebar = function (force) {
    if (mobile()) { const open = force == null ? !app.classList.contains('sidebar-open') : force; app.classList.toggle('sidebar-open', open); $('#menuBtn').setAttribute('aria-expanded', String(open)); return; }
    const collapsed = force == null ? !app.classList.contains('sidebar-collapsed') : !force;
    app.classList.toggle('sidebar-collapsed', collapsed); $('#menuBtn').setAttribute('aria-expanded', String(!collapsed)); S.set('sidebarOpen', !collapsed);
    setTimeout(positionIndicator, 420);
  };
  ui.closeSidebarIfMobile = () => { if (mobile()) app.classList.remove('sidebar-open'); };

  async function settle() { if (JX.chat.busy) await JX.chat.stop(); }
  ui.newChat = async function () {
    await settle(); ui.showView('chat');
    const c = S.active();
    if (c && c.messages.length === 0) { JX.messages.renderAll(c); JX.composer.focus(); return c; } // reuse the empty one
    const n = S.createConversation(); JX.composer.focus(); ui.closeSidebarIfMobile(); return n;
  };

  function positionIndicator() {
    const ind = $('.nav-ind'); const on = $('.nav-item.active'); if (!ind || !on) return;
    ind.style.height = on.offsetHeight + 'px'; ind.style.transform = `translateY(${on.offsetTop}px)`; ind.style.opacity = on.offsetHeight ? '1' : '0';
  }
  ui.positionIndicator = positionIndicator;

  /* ---------- conversation list ---------- */
  function render() {
    const res = S.search(q); list.innerHTML = '';
    if (!res.length) { list.append(el('div', { class: 'conv-empty' }, q ? 'No matching conversations.' : 'No conversations yet.', el('small', {}, q ? 'Try a different word.' : 'Start one with the box below.'))); return; }
    let group = null;
    [...res].sort((a, b) => b.conv.updated - a.conv.updated).forEach(({ conv, snippet }) => {
      const g = relDay(conv.updated);
      if (g !== group && !q) { group = g; list.append(el('div', { class: 'conv-group' }, g)); }
      list.append(item(conv, snippet));
    });
  }

  function item(conv, snippet) {
    const n = conv.messages.length;
    const li = el('div', { class: 'conv-item' + (conv.id === S.activeId && ui.currentView() === 'chat' ? ' active' : ''), 'data-id': conv.id },
      el('button', { type: 'button', class: 'conv-main', title: conv.title, onclick: async () => { if (conv.id === S.activeId && ui.currentView() === 'chat') { ui.closeSidebarIfMobile(); return; } await settle(); ui.showView('chat'); S.setActive(conv.id); ui.closeSidebarIfMobile(); } },
        el('span', { class: 'conv-title' }, conv.title), el('span', { class: 'conv-sub' }, snippet || `${n} message${n === 1 ? '' : 's'}`)),
      el('div', { class: 'conv-actions' },
        ui.iconButton('edit', 'Rename conversation', (e) => { e.stopPropagation(); rename(li, conv); }, 'icon-btn sm'),
        ui.iconButton('trash', 'Delete conversation', (e) => { e.stopPropagation(); remove(li, conv); }, 'icon-btn sm danger')));
    return li;
  }

  function rename(li, conv) {
    li.classList.add('editing');
    const main = li.querySelector('.conv-main');
    const inp = el('input', { class: 'conv-rename', type: 'text', value: conv.title, maxlength: 80, 'aria-label': 'Conversation name' });
    main.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = (save) => { if (done) return; done = true; if (save && inp.value.trim()) S.renameConversation(conv.id, inp.value); else render(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
    inp.addEventListener('blur', () => finish(true));
  }

  async function remove(li, conv) {
    const ok = await ui.confirm({ title: 'Delete conversation?', body: `“${conv.title}” and its ${conv.messages.length} message${conv.messages.length === 1 ? '' : 's'} will be permanently deleted.`, confirm: 'Delete', danger: true });
    if (!ok) return;
    if (conv.id === S.activeId) await settle();
    li.classList.add('removing');
    setTimeout(() => { S.deleteConversation(conv.id); ui.toast('Conversation deleted', 'success', { duration: 1800 }); }, JX.theme.effectiveAnim() === 'off' ? 0 : 220);
  }

  /* ---------- status card ---------- */
  function renderStatus() {
    const st = JX.ai.status; const dot = $('#sysDot'), pill = $('#modePill');
    const map = {
      live: ['Live', `${st.provider || 'AI'} · ${JX.ai.effective(S.settings).model || ''}`, 'LIVE'], demo: ['Demo mode', 'No AI provider connected', 'DEMO'],
      checking: ['Connecting…', 'Contacting server', '…'], offline: ['Offline', 'No network connection', 'OFFLINE'], error: ['Connection error', st.reason || 'Check settings', 'ERROR'],
    };
    const [t, sub, short] = map[st.state] || map.demo;
    dot.dataset.state = st.state; pill.dataset.state = st.state; $('#sysTitle').textContent = t; $('#sysSub').textContent = sub; $('#modeText').textContent = short;
    pill.title = `${t} — ${sub}`;
    document.body.dataset.status = st.state;
  }
  function renderCounts() {
    $('#countTasks').textContent = S.tasks.filter((t) => !t.done).length; $('#countNotes').textContent = S.notes.length; $('#countFiles').textContent = S.files.length;
    ['countTasks', 'countNotes', 'countFiles'].forEach((id) => { const e = $('#' + id); e.hidden = e.textContent === '0'; });
  }
  function renderTheme() { const dark = ui.effectiveTheme() === 'dark'; $('#themeBtn').innerHTML = JX.icon(dark ? 'sun' : 'moon'); $('#themeBtn').setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); }

  JX.sidebar = {
    render,
    init() {
      app = $('#app'); list = $('#convList');
      if (S.settings.sidebarOpen === false && !mobile()) app.classList.add('sidebar-collapsed');
      $('#menuBtn').setAttribute('aria-expanded', String(!app.classList.contains('sidebar-collapsed')));
      $('#menuBtn').addEventListener('click', () => ui.toggleSidebar());
      $('#sidebarClose').addEventListener('click', () => ui.toggleSidebar(false));
      $('#scrim').addEventListener('click', () => ui.toggleSidebar(false));
      $('#newChatBtn').addEventListener('click', () => ui.newChat());
      $('#settingsBtn').addEventListener('click', () => ui.openSettings());
      $('#sysStatus').addEventListener('click', () => ui.openSettings('ai'));
      $('#paletteBtn').addEventListener('click', () => ui.openPalette());
      $('#themeBtn').addEventListener('click', () => S.set('theme', ui.effectiveTheme() === 'dark' ? 'light' : 'dark'));
      $('#convSearch').addEventListener('input', debounce((e) => { q = e.target.value; render(); }, 120));
      S.on('conversations', render); S.on('active', render); ui.bus.on('view', render);
      S.on('tasks', renderCounts); S.on('notes', renderCounts); S.on('files', renderCounts);
      S.on('settings', renderTheme); ui.bus.on('appearance', renderTheme);
      JX.ai.on('status', renderStatus);
      window.addEventListener('resize', debounce(positionIndicator, 100));
      window.addEventListener('online', renderStatus);
      render(); renderStatus(); renderCounts(); renderTheme();
      setTimeout(positionIndicator, 60); if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionIndicator);
    },
  };
})();
