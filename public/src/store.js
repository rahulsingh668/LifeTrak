// ── Store ─────────────────────────────────────────────────────────
// Events and expenses live in MySQL (via API).
// We cache them in localStorage for instant loads & offline reads.

const Store = (() => {
  const CACHE_KEY = 'lifetrak_cache_v1';

  let state = {
    user:         null,      // { id, name, email }
    events:       [],        // array from API
    expenses:     {},        // { eventId: [...] }
    activeId:     null,      // active event DB id (int)
    viewMonth:    null,
    currentView:  'monthly',
    drillCat:     null,
    loading:      false,
  };

  // ── Cache ──
  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        events: state.events,
        expenses: state.expenses,
        activeId: state.activeId,
      }));
    } catch (_) {}
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const c = JSON.parse(raw);
      state.events   = c.events   || [];
      state.expenses = c.expenses || {};
      state.activeId = c.activeId || null;
    } catch (_) {}
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }

  // ── Init month ──
  function initMonth() {
    const now = new Date();
    state.viewMonth = { y: now.getFullYear(), m: now.getMonth() };
  }

  // ── Getters ──
  const get          = () => state;
  const activeEvent  = () => state.events.find(e => e.id === state.activeId) || state.events[0] || null;
  const activeExpenses = () => state.expenses[state.activeId] || [];

  // ── Auth ──
  function setUser(user) { state.user = user; }
  function clearUser()   { state.user = null; clearCache(); }

  // ── Events ──
  function setEvents(events) {
    state.events = events;
    if (!state.activeId && events.length) state.activeId = events[0].id;
    saveCache();
  }

  function upsertEvent(ev) {
    const idx = state.events.findIndex(e => e.id === ev.id);
    if (idx >= 0) state.events[idx] = ev; else state.events.push(ev);
    saveCache();
  }

  function removeEvent(id) {
    state.events = state.events.filter(e => e.id !== id);
    delete state.expenses[id];
    if (state.activeId === id) state.activeId = state.events[0]?.id || null;
    saveCache();
  }

  function switchEvent(id) {
    state.activeId = id;
    state.currentView = 'monthly';
    state.drillCat = null;
    initMonth();
    saveCache();
  }

  // ── Expenses ──
  function setExpenses(eventId, list) {
    state.expenses[eventId] = list;
    saveCache();
  }

  function upsertExpense(eventId, exp) {
    if (!state.expenses[eventId]) state.expenses[eventId] = [];
    const idx = state.expenses[eventId].findIndex(e => e.id === exp.id);
    if (idx >= 0) state.expenses[eventId][idx] = exp;
    else state.expenses[eventId].unshift(exp);
    saveCache();
  }

  function removeExpense(eventId, id) {
    if (state.expenses[eventId])
      state.expenses[eventId] = state.expenses[eventId].filter(e => e.id !== id);
    saveCache();
  }

  // ── View state ──
  function setView(v)        { state.currentView = v; state.drillCat = null; }
  function setMonth(y, m)    { state.viewMonth = { y, m }; }
  function shiftMonth(delta) {
    let { y, m } = state.viewMonth;
    m += delta;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    state.viewMonth = { y, m };
  }
  function setDrill(catId)   { state.drillCat = catId; }
  function clearDrill()      { state.drillCat = null; }
  function setLoading(v)     { state.loading = v; }

  initMonth();

  return {
    get, activeEvent, activeExpenses,
    loadCache, saveCache, clearCache,
    setUser, clearUser,
    setEvents, upsertEvent, removeEvent, switchEvent,
    setExpenses, upsertExpense, removeExpense,
    setView, setMonth, shiftMonth, setDrill, clearDrill, setLoading,
  };
})();

// ── Formatting ────────────────────────────────────────────────────
function fmt(n, ev) {
  const cur = (ev || Store.activeEvent())?.currency || '₹';
  return cur + Math.round(Number(n)).toLocaleString('en-IN');
}
function fmtShort(n, ev) {
  const cur = (ev || Store.activeEvent())?.currency || '₹';
  const v = Math.round(Number(n));
  if (v >= 100000) return cur + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)   return cur + (v / 1000).toFixed(0) + 'k';
  return cur + v.toLocaleString('en-IN');
}
function fmtDateLong(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
