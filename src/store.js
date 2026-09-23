// ── Store ─────────────────────────────────────────────────────────
const Store = (() => {
  const CACHE_KEY  = 'lifetrak_cache_v2';
  const AUTH_KEY   = 'lifetrak_auth';        // persisted login
  const QUEUE_KEY  = 'lifetrak_queue';
  const BLOB_DB    = 'lifetrak_offline_v1';

  let state = {
    user: null, events: [], expenses: {}, analytics: {},
    activeId: null, viewMonth: null, currentView: 'monthly',
    drillCat: null, loading: false,
  };

  // ── Persistent auth ───────────────────────────────────────────
  function saveAuth(user) {
    try { localStorage.setItem(AUTH_KEY, JSON.stringify({ user, savedAt: Date.now() })); } catch(_){}
  }
  function loadAuth() {
    try {
      const raw = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      // Valid for 30 days
      if (raw && raw.user && Date.now() - raw.savedAt < 30 * 86400000) return raw.user;
    } catch(_){}
    return null;
  }
  function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
  }

  // ── Data cache ────────────────────────────────────────────────
  function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({
      events: state.events, expenses: state.expenses, activeId: state.activeId,
    })); } catch(_){}
  }
  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c) { state.events=c.events||[]; state.expenses=c.expenses||{}; state.activeId=c.activeId||null; }
    } catch(_){}
  }
  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(QUEUE_KEY);
    try { indexedDB.deleteDatabase(BLOB_DB); } catch(_) {}
  }
  function initMonth() { const n=new Date(); state.viewMonth={y:n.getFullYear(),m:n.getMonth()}; }

  // ── Offline queue ─────────────────────────────────────────────
  function loadQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]'); } catch(_){ return []; } }
  function saveQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch(_){} }
  function newId(prefix='q') {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return `${prefix}_${id.replace(/[^A-Za-z0-9_-]/g,'')}`;
  }
  function enqueue(action) {
    const q=loadQueue();
    const queued={...action,queueId:action.queueId||newId(),ts:action.ts||Date.now(),status:'pending',error:null};
    q.push(queued); saveQueue(q); return queued;
  }
  function dequeue(id) {
    saveQueue(loadQueue().filter(a=>(a.queueId||a.ts)!==id));
  }
  function updateQueueAction(id, changes) {
    saveQueue(loadQueue().map(a=>(a.queueId||a.ts)===id?{...a,...changes}:a));
  }
  function remapQueueTarget(tempId, realId) {
    saveQueue(loadQueue().map(a=>a.id===tempId?{...a,id:realId}:a));
  }
  function retryFailedQueue() {
    saveQueue(loadQueue().map(a=>a.status==='failed'?{...a,status:'pending',error:null}:a));
  }
  function getQueue() { return loadQueue(); }
  function hasQueue() { return loadQueue().length > 0; }

  // Receipt blobs cannot be represented safely in localStorage. Keep them in
  // IndexedDB and reference them from the small JSON mutation queue.
  function blobDb() {
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(BLOB_DB,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('receipts');
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function putReceiptBlob(file) {
    const id=newId('receipt'), db=await blobDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('receipts','readwrite');
      tx.objectStore('receipts').put(file,id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
    db.close(); return id;
  }
  async function getReceiptBlob(id) {
    if(!id) return null;
    const db=await blobDb();
    const value=await new Promise((resolve,reject)=>{
      const req=db.transaction('receipts').objectStore('receipts').get(id);
      req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error);
    });
    db.close(); return value;
  }
  async function deleteReceiptBlob(id) {
    if(!id) return;
    const db=await blobDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('receipts','readwrite');
      tx.objectStore('receipts').delete(id); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }

  // ── Getters ───────────────────────────────────────────────────
  const get            = () => state;
  const activeEvent    = () => state.events.find(e=>e.id===state.activeId)||state.events[0]||null;
  const activeExpenses = () => state.expenses[state.activeId]||[];

  // ── Auth ──────────────────────────────────────────────────────
  function setUser(user) { state.user=user; saveAuth(user); }
  function clearUser()   { state.user=null; clearAuth(); clearCache(); }
  // Session expired (401): drop credentials but PRESERVE cached data and
  // the offline queue — they sync after the user logs back in.
  function softLogout()  { state.user=null; clearAuth(); }

  // ── Events ────────────────────────────────────────────────────
  function setEvents(evs) { state.events=evs; if(!state.activeId&&evs.length) state.activeId=evs[0].id; saveCache(); }
  function upsertEvent(ev){ const i=state.events.findIndex(e=>e.id===ev.id); if(i>=0) state.events[i]=ev; else state.events.push(ev); saveCache(); }
  function removeEvent(id){ state.events=state.events.filter(e=>e.id!==id); delete state.expenses[id]; if(state.activeId===id) state.activeId=state.events[0]?.id||null; saveCache(); }
  function switchEvent(id){ state.activeId=id; state.currentView='monthly'; state.drillCat=null; initMonth(); saveCache(); }

  // ── Expenses ──────────────────────────────────────────────────
  function setExpenses(eid,list)  { state.expenses[eid]=list; saveCache(); }
  function upsertExpense(eid,exp) { if(!state.expenses[eid]) state.expenses[eid]=[]; const i=state.expenses[eid].findIndex(e=>e.id===exp.id); if(i>=0) state.expenses[eid][i]=exp; else state.expenses[eid].unshift(exp); saveCache(); }
  function removeExpense(eid,id)  { if(state.expenses[eid]) state.expenses[eid]=state.expenses[eid].filter(e=>e.id!==id); saveCache(); }
  function replaceTempExpense(eid,tempId,realExp){ if(!state.expenses[eid]) return; const i=state.expenses[eid].findIndex(e=>e.id===tempId); if(i>=0) state.expenses[eid][i]=realExp; else state.expenses[eid].unshift(realExp); saveCache(); }

  // ── Analytics cache ───────────────────────────────────────────
  function setAnalytics(eid,data) { state.analytics[eid]=data; }
  function getAnalytics(eid)      { return state.analytics[eid]||null; }

  // ── View ──────────────────────────────────────────────────────
  function setView(v)    { state.currentView=v; state.drillCat=null; }
  function setMonth(y,m) { state.viewMonth={y,m}; }
  function shiftMonth(d) { let{y,m}=state.viewMonth; m+=d; if(m>11){m=0;y++;}if(m<0){m=11;y--;} state.viewMonth={y,m}; }
  function setDrill(c)   { state.drillCat=c; }
  function clearDrill()  { state.drillCat=null; }

  initMonth();

  return {
    get, activeEvent, activeExpenses,
    loadAuth, saveAuth, clearAuth,
    loadCache, saveCache, clearCache,
    setUser, clearUser, softLogout,
    setEvents, upsertEvent, removeEvent, switchEvent,
    setExpenses, upsertExpense, removeExpense, replaceTempExpense,
    setAnalytics, getAnalytics,
    enqueue, dequeue, updateQueueAction, remapQueueTarget, retryFailedQueue, getQueue, hasQueue, newId,
    putReceiptBlob, getReceiptBlob, deleteReceiptBlob,
    setView, setMonth, shiftMonth, setDrill, clearDrill,
  };
})();

// ── Formatting ────────────────────────────────────────────────────
function fmt(n, ev) {
  const cur = (ev || Store.activeEvent())?.currency || '₹';
  const v = Number(n)||0;
  return (v < 0 ? '−' : '') + cur + Math.abs(v).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function fmtShort(n, ev) {
  const cur = (ev || Store.activeEvent())?.currency || '₹';
  const v = Number(n)||0;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 100000) return sign + cur + (a/100000).toFixed(1) + 'L';
  if (a >= 1000)   return sign + cur + (a/1000).toFixed(0) + 'k';
  return sign + cur + a.toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:2});
}
function fmtDateLong(d) {
  return new Date(d+'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
