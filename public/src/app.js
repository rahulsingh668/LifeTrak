// ── App ────────────────────────────────────────────────────────────
const App = (() => {
  let _screen = 'loading';  // loading | welcome | login | signup | app
  let _sheet = null;
  let _search = '', _catFilter = '';

  // ── Boot ──────────────────────────────────────────────────────
  async function init() {
    Store.loadCache();
    paint();
    try {
      const user = await API.me();
      Store.setUser(user);
      await loadAppData();
      _screen = 'app';
    } catch (_) {
      _screen = 'welcome';
    }
    paint();
  }

  async function loadAppData() {
    const events = await API.getEvents();
    Store.setEvents(events);
    if (!events.length) return;
    const activeId = Store.get().activeId || events[0].id;
    Store.switchEvent(activeId);
    const expenses = await API.getExpenses(activeId);
    Store.setExpenses(activeId, expenses);
  }

  // ── Paint ──────────────────────────────────────────────────────
  function paint() {
    const el = document.getElementById('app');
    if (_screen === 'loading')  { el.innerHTML = renderLoading(); return; }
    if (_screen === 'welcome')  { el.innerHTML = renderWelcome(); return; }
    if (_screen === 'login')    { el.innerHTML = renderLogin();   return; }
    if (_screen === 'signup')   { el.innerHTML = renderSignup();  return; }
    paintApp();
  }

  function paintApp() {
    const s = Store.get();
    let content;
    if (s.drillCat) {
      document.getElementById('app').innerHTML = renderShell(renderDrillView(s.drillCat), false);
    } else {
      const v = s.currentView;
      if (v === 'monthly')      content = renderMonthlyView();
      else if (v === 'lifetime')content = renderLifetimeView();
      else                      content = renderTransactionsView(_search, _catFilter);
      document.getElementById('app').innerHTML = renderShell(content, true);
    }
  }

  function refreshContent() {
    const el = document.getElementById('mainContent');
    if (!el) return;
    const s = Store.get();
    if (s.drillCat) { el.innerHTML = renderDrillView(s.drillCat); return; }
    const v = s.currentView;
    if (v === 'monthly')       el.innerHTML = renderMonthlyView();
    else if (v === 'lifetime') el.innerHTML = renderLifetimeView();
    else                       el.innerHTML = renderTransactionsView(_search, _catFilter);
    const hero = document.querySelector('.hero');
    if (hero) hero.outerHTML = renderHero();
  }

  // ── Screen nav ────────────────────────────────────────────────
  function showScreen(s) { _screen = s; paint(); }

  // ── Auth ──────────────────────────────────────────────────────
  async function login() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPass')?.value;
    if (!email || !password) { toast('Enter your email and password.', 'warn'); return; }
    setBtnLoading('loginBtn', true);
    try {
      const user = await API.login({ email, password });
      Store.setUser(user);
      await loadAppData();
      _screen = 'app';
      paint();
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBtnLoading('loginBtn', false);
    }
  }

  async function signup() {
    const name     = document.getElementById('regName')?.value.trim();
    const email    = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPass')?.value;
    if (!name || !email || !password) { toast('Fill in all fields.', 'warn'); return; }
    setBtnLoading('signupBtn', true);
    try {
      const user = await API.register({ name, email, password });
      Store.setUser(user);
      await loadAppData();
      _screen = 'app';
      paint();
      toast(`Welcome, ${user.name}! 🎉`, 'ok');
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBtnLoading('signupBtn', false);
    }
  }

  async function logout() {
    if (!confirm('Sign out?')) return;
    try { await API.logout(); } catch (_) {}
    Store.clearUser();
    _screen = 'welcome';
    paint();
  }

  // ── View ──────────────────────────────────────────────────────
  function setView(v) { Store.setView(v); _search = ''; _catFilter = ''; paintApp(); }
  function shiftMonth(d) { Store.shiftMonth(d); refreshContent(); }
  function jumpToMonth(y, m) { Store.setMonth(parseInt(y), parseInt(m)); setView('monthly'); }
  function onSearch(v) { _search = v; document.getElementById('mainContent').innerHTML = renderTransactionsView(_search, _catFilter); }
  function onCatFilter(v) { _catFilter = v; document.getElementById('mainContent').innerHTML = renderTransactionsView(_search, _catFilter); }
  function openDrill(catId) { Store.setDrill(catId); paintApp(); }
  function closeDrill() { Store.clearDrill(); paintApp(); }

  // ── Sheets ────────────────────────────────────────────────────
  function openSheet(html) {
    closeSheet();
    const m = document.createElement('div');
    m.id = 'sheetMount'; m.innerHTML = html;
    document.body.appendChild(m); _sheet = m;
    const ov = m.querySelector('.sheet-overlay');
    if (ov) ov.addEventListener('click', e => { if (e.target === ov) closeSheet(); });
  }
  function closeSheet() {
    if (_sheet) { _sheet.remove(); _sheet = null; }
    document.getElementById('sheetMount')?.remove();
  }

  function openAddExpense() { openSheet(expenseSheetHTML()); setTimeout(() => document.getElementById('inDesc')?.focus(), 80); }
  function openEventPicker() { openSheet(eventPickerSheetHTML()); }
  function openSettings() { openSheet(settingsSheetHTML()); }

  // ── Edit expense ──────────────────────────────────────────────
  function openEditExpense(id) {
    const exp = Store.activeExpenses().find(e => e.id === id);
    if (exp) openSheet(expenseSheetHTML(exp));
  }

  // ── Expense CRUD ──────────────────────────────────────────────
  async function saveExpense(editId = null) {
    const ev     = Store.activeEvent();
    const desc   = document.getElementById('inDesc')?.value.trim();
    const amount = parseFloat(document.getElementById('inAmount')?.value);
    const date   = document.getElementById('inDate')?.value;
    const catId  = document.getElementById('inCat')?.value;
    const paidBy = document.getElementById('inPaidBy')?.value || 'Me';
    const tag    = document.getElementById('inTag')?.value || '';
    const phase  = document.getElementById('inPhase')?.value || '';
    const notes  = document.getElementById('inNotes')?.value.trim() || '';
    if (!desc || isNaN(amount) || amount <= 0) { toast('Enter description and amount.', 'warn'); return; }
    if (!date) { toast('Pick a date.', 'warn'); return; }
    const cat = (ev.categories || []).find(c => c.id === catId) || {};
    const payload = { event_id: ev.id, description: desc, amount, date, cat_id: catId, cat_name: cat.name || '', cat_emoji: cat.emoji || '📦', paid_by: paidBy, tag, phase, notes };
    setBtnLoading('expSaveBtn', true);
    try {
      if (editId) {
        await API.updateExpense(editId, payload);
        // Update local cache
        const list = Store.activeExpenses();
        const idx = list.findIndex(e => e.id === editId);
        if (idx >= 0) Store.upsertExpense(ev.id, { ...list[idx], ...payload, id: editId });
        toast('Expense updated ✓');
      } else {
        const result = await API.createExpense(payload);
        Store.upsertExpense(ev.id, { ...payload, id: result.id });
        toast('Expense saved ✓');
      }
      closeSheet(); refreshContent();
    } catch (e) {
      toast(e.message, 'warn');
    } finally {
      setBtnLoading('expSaveBtn', false);
    }
  }

  async function deleteExpense(id) {
    if (!confirm('Remove this expense?')) return;
    try {
      await API.deleteExpense(id);
      Store.removeExpense(Store.get().activeId, id);
      closeSheet(); refreshContent(); toast('Expense removed');
    } catch (e) { toast(e.message, 'warn'); }
  }

  // ── Event CRUD ────────────────────────────────────────────────
  async function switchEvent(id) {
    Store.switchEvent(id); closeSheet();
    if (!Store.get().expenses[id]) {
      try {
        const exps = await API.getExpenses(id);
        Store.setExpenses(id, exps);
      } catch (_) {}
    }
    _search = ''; _catFilter = '';
    paintApp();
  }

  async function createEvent() {
    const name = document.getElementById('newEvName')?.value.trim();
    const emoji = document.getElementById('newEvEmoji')?.value.trim() || '📋';
    const catsRaw = document.getElementById('newEvCats')?.value || '';
    const phasesRaw = document.getElementById('newEvPhases')?.value || '';
    const budget = parseFloat(document.getElementById('newEvBudget')?.value) || 0;
    const currency = document.getElementById('newEvCurr')?.value || '₹';
    if (!name) { toast('Enter an event name.', 'warn'); return; }
    const categories = catsRaw.split(',').map(s => s.trim()).filter(Boolean)
      .map(s => ({ id: s.toLowerCase().replace(/\s+/g,'_'), name: s, emoji: '📦', budget: 0 }));
    if (!categories.length) categories.push({ id: 'misc', name: 'General', emoji: '📦', budget: 0 });
    const phases = phasesRaw.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const ev = await API.createEvent({ name, emoji, currency, budget, categories, phases });
      Store.upsertEvent(ev);
      Store.setExpenses(ev.id, []);
      Store.switchEvent(ev.id);
      closeSheet(); paintApp(); toast(`"${name}" created ✓`);
    } catch (e) { toast(e.message, 'warn'); }
  }

  async function deleteEvent(id) {
    const ev = Store.get().events.find(e => e.id === id);
    if (!ev || !confirm(`Delete "${ev.name}" and all expenses? This cannot be undone.`)) return;
    try {
      await API.deleteEvent(id);
      Store.removeEvent(id);
      closeSheet(); paintApp(); toast('Event deleted');
    } catch (e) { toast(e.message, 'warn'); }
  }

  // ── Settings ──────────────────────────────────────────────────
  async function saveSettings() {
    const ev = Store.activeEvent();
    const currency = document.getElementById('setCurrency')?.value || '₹';
    const budget = parseFloat(document.getElementById('setBudget')?.value) || 0;
    try {
      await API.updateEvent(ev.id, { currency, budget, categories: ev.categories });
      Store.upsertEvent({ ...ev, currency, budget });
      closeSheet(); paintApp(); toast('Settings saved ✓');
    } catch (e) { toast(e.message, 'warn'); }
  }

  function updateCatBudget(catId, val) {
    const ev = Store.activeEvent();
    const cats = (ev.categories || []).map(c => c.id === catId ? { ...c, budget: parseFloat(val) || 0 } : c);
    Store.upsertEvent({ ...ev, categories: cats });
    // Debounced save to API
    clearTimeout(App._catBudgetTimer);
    App._catBudgetTimer = setTimeout(() => API.updateEvent(ev.id, { categories: cats }).catch(() => {}), 800);
  }

  // ── Export ────────────────────────────────────────────────────
  function exportCSV() {
    const ev = Store.activeEvent(), exps = Store.activeExpenses();
    const rows = [['Date','Description','Category','Amount','Currency','Paid By','Tag','Phase','Notes']];
    exps.forEach(e => rows.push([e.date||e.expense_date, e.description||e.desc, e.cat_name||e.catName, e.amount, ev.currency, e.paid_by||e.paidBy, e.tag||'', e.phase||'', e.notes||'']));
    const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${ev.name.replace(/\s+/g,'_')}_expenses.csv`; a.click();
    toast('CSV downloaded ✓');
  }

  // ── Utils ─────────────────────────────────────────────────────
  function setBtnLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (loading) {
      btn._origText = btn.innerHTML;
      btn.innerHTML = '<div class="spinner"></div>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn._origText || btn.innerHTML;
      btn.disabled = false;
    }
  }

  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'warn' ? ' warn-toast' : type === 'ok' ? '' : '');
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2600);
  }

  return {
    init, showScreen, login, signup, logout,
    setView, shiftMonth, jumpToMonth, onSearch, onCatFilter, openDrill, closeDrill,
    openAddExpense, openEditExpense, saveExpense, deleteExpense,
    openEventPicker, switchEvent, createEvent, deleteEvent,
    openSettings, saveSettings, updateCatBudget,
    exportCSV, closeSheet, toast,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
