// ── Helpers ────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function progColor(p){return p>=100?'var(--danger)':p>=75?'var(--warn)':'var(--success)'}
function tagHTML(t){const m={ins:['ins','Insured'],rec:['rec','Recurring'],rei:['rei','Reimbursable']};if(!t||!m[t])return '';const[c,l]=m[t];return `<span class="tx-tag ${c}">${l}</span>`}
function txItemHTML(e){
  return `<div class="tx-item" onclick="App.openEditExpense(${e.id})">
    <div class="tx-icon-wrap">${e.cat_emoji||e.catEmoji||'📦'}</div>
    <div class="tx-body">
      <div class="tx-desc">${esc(e.description||e.desc)}${tagHTML(e.tag)}</div>
      <div class="tx-meta"><span>${esc(e.cat_name||e.catName||'')}</span>${e.paid_by||e.paidBy?`<span>· ${e.paid_by||e.paidBy}</span>`:''} ${e.phase?`<span>· ${e.phase}</span>`:''} ${e.notes?`<span>· ${esc(e.notes)}</span>`:''}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amount">${fmt(e.amount)}</div>
      ${(e.paid_by||e.paidBy)&&(e.paid_by||e.paidBy)!=='Me'?`<div class="tx-paid-by">${e.paid_by||e.paidBy}</div>`:''}
    </div>
  </div>`}
function groupByDate(exps){const g={};exps.forEach(e=>{const d=e.date||e.expense_date;if(!g[d])g[d]=[];g[d].push(e)});return Object.entries(g).sort((a,b)=>b[0]<a[0]?-1:1)}
function txGroupsHTML(exps){
  if(!exps.length) return `<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-title">No expenses yet</div><div class="empty-body">Tap + to add your first one.</div></div>`;
  return groupByDate(exps).map(([date,items])=>{
    const tot=items.reduce((s,e)=>s+Number(e.amount),0);
    return `<div class="tx-group"><div class="tx-date-row"><div class="tx-date-label">${fmtDateLong(date)}</div><div class="tx-date-total">${fmt(tot)}</div></div>${items.map(txItemHTML).join('')}</div>`;
  }).join('')}

// ── Auth screens ──────────────────────────────────────────────────
function renderWelcome(){
  return `<div class="welcome-screen">
    <div class="welcome-hero">
      <div class="welcome-logo">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 12C8 9.79 9.79 8 12 8h16c2.21 0 4 1.79 4 4v16c0 2.21-1.79 4-4 4H12c-2.21 0-4-1.79-4-4V12z" fill="rgba(255,255,255,.15)"/>
          <path d="M13 20h14M13 15h9M13 25h6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="28" cy="25" r="4" fill="white" opacity=".9"/>
          <path d="M27 25l1 1 2-2" stroke="#1a1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="welcome-title">LifeTrak</div>
      <div class="welcome-tagline">Track every rupee across life's biggest moments — pregnancies, trips, weddings, and more.</div>
      <div class="welcome-inspiration">
        <div class="wi-icon">🤰</div>
        <div class="wi-text">
          <div class="wi-label">Inspiration</div>
          <div class="wi-quote">"Every big journey deserves to be remembered — including what it cost."</div>
          <div class="wi-names">— Tara &amp; Rahul</div>
        </div>
      </div>
    </div>
    <div class="welcome-actions">
      <button class="btn-primary" onclick="App.showScreen('signup')">Create account</button>
      <button class="btn-secondary" onclick="App.showScreen('login')">Sign in</button>
    </div>
  </div>`}

function renderLogin(){
  return `<div class="auth-screen">
    <div class="auth-topbar">
      <button class="auth-back" onclick="App.showScreen('welcome')" aria-label="Back">←</button>
      <div class="auth-screen-title">Sign in</div>
    </div>
    <div class="auth-body">
      <div class="auth-headline">Welcome back</div>
      <div class="auth-sub">Sign in to your LifeTrak account.</div>
      <div class="field"><label class="field-label">Email</label>
        <input class="field-input" id="loginEmail" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="field"><label class="field-label">Password</label>
        <input class="field-input" id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn-primary" id="loginBtn" onclick="App.login()">Sign in</button>
    </div>
    <div class="auth-footer">Don't have an account? <a href="#" onclick="App.showScreen('signup');return false">Create one</a></div>
  </div>`}

function renderSignup(){
  return `<div class="auth-screen">
    <div class="auth-topbar">
      <button class="auth-back" onclick="App.showScreen('welcome')" aria-label="Back">←</button>
      <div class="auth-screen-title">Create account</div>
    </div>
    <div class="auth-body">
      <div class="auth-headline">Get started</div>
      <div class="auth-sub">Your data stays private and secure.</div>
      <div class="field"><label class="field-label">Your name</label>
        <input class="field-input" id="regName" type="text" placeholder="Rahul Sharma" autocomplete="name">
      </div>
      <div class="field"><label class="field-label">Email</label>
        <input class="field-input" id="regEmail" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="field"><label class="field-label">Password</label>
        <input class="field-input" id="regPass" type="password" placeholder="Min. 8 characters" autocomplete="new-password">
      </div>
      <button class="btn-primary" id="signupBtn" onclick="App.signup()">Create account</button>
    </div>
    <div class="auth-footer">Already have an account? <a href="#" onclick="App.showScreen('login');return false">Sign in</a></div>
  </div>`}

function renderLoading(){
  return `<div class="loading-screen">
    <div class="loading-logo">LifeTrak</div>
    <div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>
  </div>`}

// ── App shell ─────────────────────────────────────────────────────
function renderShell(content, viewToggle=true){
  const s=Store.get(), ev=Store.activeEvent();
  if(!ev) return renderLoading();
  return `
  <div class="topbar">
    <div class="topbar-left">
      <div class="topbar-eyebrow">LifeTrak</div>
      <div class="event-switcher" onclick="App.openEventPicker()">
        <span>${ev.emoji}</span>
        <span class="ev-name">${esc(ev.name)}</span>
        <span class="ev-chevron">⌄</span>
      </div>
    </div>
    <div class="topbar-actions">
      <button class="icon-btn" onclick="App.openSettings()" aria-label="Settings">⚙</button>
      <button class="icon-btn" onclick="App.logout()" aria-label="Sign out" title="Sign out">⎋</button>
    </div>
  </div>
  ${renderHero()}
  ${viewToggle?`<div class="view-toggle-wrap"><div class="view-toggle">
    <button class="vt-btn${s.currentView==='monthly'?' active':''}" onclick="App.setView('monthly')">Monthly</button>
    <button class="vt-btn${s.currentView==='lifetime'?' active':''}" onclick="App.setView('lifetime')">Lifetime</button>
    <button class="vt-btn${s.currentView==='transactions'?' active':''}" onclick="App.setView('transactions')">All</button>
  </div></div>`:''}
  <div class="content" id="mainContent">${content}</div>
  <div class="fab-wrap"><button class="fab" onclick="App.openAddExpense()" aria-label="Add expense">＋</button></div>`}

// ── Hero ──────────────────────────────────────────────────────────
function renderHero(){
  const ev=Store.activeEvent(),all=Store.activeExpenses();
  const total=all.reduce((s,e)=>s+Number(e.amount),0);
  const budget=ev.budget||0;
  const now=new Date();
  const thisMo=all.filter(e=>{const d=new Date((e.date||e.expense_date)+'T00:00:00');return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}).reduce((s,e)=>s+Number(e.amount),0);
  const left=budget?budget-total:null;
  const pct=budget?Math.min(100,Math.round(total/budget*100)):0;
  const bar=budget?`<div class="budget-bar-wrap"><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div><div class="budget-bar-meta"><span>${pct}% used</span><span>${fmt(budget)} budget</span></div></div>`:'';
  let lc='ok',lv='—';
  if(left!==null){lc=left<0?'danger':left<budget*.2?'warn':'ok';lv=left<0?`-${fmt(Math.abs(left))}`:fmt(left)}
  return `<div class="hero">
    <div class="hero-amount-row"><span class="hero-amount">${fmt(total).slice(1)}</span><span class="hero-currency">${ev.currency||'₹'}</span></div>
    <div class="hero-label">Total spent · ${all.length} expense${all.length!==1?'s':''}</div>
    ${bar}
    <div class="hero-stats">
      <div class="hstat"><div class="hstat-label">This month</div><div class="hstat-value">${fmt(thisMo)}</div></div>
      <div class="hstat"><div class="hstat-label">${left!==null?'Budget left':'Budget'}</div><div class="hstat-value ${lc}">${lv}</div></div>
      <div class="hstat"><div class="hstat-label">Expenses</div><div class="hstat-value">${all.length}</div></div>
    </div>
  </div>`}

// ── Monthly view ──────────────────────────────────────────────────
function renderMonthlyView(){
  const{y,m}=Store.get().viewMonth,ev=Store.activeEvent(),all=Store.activeExpenses();
  const mo=all.filter(e=>{const d=new Date((e.date||e.expense_date)+'T00:00:00');return d.getFullYear()===y&&d.getMonth()===m});
  const moTotal=mo.reduce((s,e)=>s+Number(e.amount),0);
  const cm={};mo.forEach(e=>cm[e.cat_id||e.catId]=(cm[e.cat_id||e.catId]||0)+Number(e.amount));
  const catHTML=(ev.categories||[]).filter(c=>cm[c.id]).map(c=>{
    const sp=cm[c.id]||0,pct=c.budget?Math.min(100,Math.round(sp/c.budget*100)):0;
    return `<div class="cat-card" onclick="App.openDrill('${c.id}')">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-body"><div class="cat-name">${esc(c.name)}</div>
        <div class="cat-prog-track"><div class="cat-prog-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div>
      </div>
      <div class="cat-right"><div class="cat-spent">${fmt(sp)}</div><div class="cat-of-budget">${c.budget?'of '+fmt(c.budget):''}</div></div>
    </div>`}).join('')||`<div class="empty-state" style="padding:20px 0"><div class="empty-body">No spending this month.</div></div>`;
  return `
  <div class="month-nav">
    <button class="month-nav-btn" onclick="App.shiftMonth(-1)">‹</button>
    <div class="month-nav-title">${MONTH_NAMES[m]} ${y}</div>
    <button class="month-nav-btn" onclick="App.shiftMonth(1)">›</button>
  </div>
  <div class="section-header"><div class="section-title">By category</div><div class="section-value">${fmt(moTotal)}</div></div>
  <div class="cat-list">${catHTML}</div>
  <div class="section-header" style="margin-top:8px"><div class="section-title">Transactions</div></div>
  ${txGroupsHTML([...mo].sort((a,b)=>(b.date||b.expense_date)<(a.date||a.expense_date)?-1:1))}
  <div class="spacer"></div>`}

// ── Lifetime view ─────────────────────────────────────────────────
function renderLifetimeView(){
  const ev=Store.activeEvent(),all=Store.activeExpenses();
  const total=all.reduce((s,e)=>s+Number(e.amount),0),budget=ev.budget||0;
  const cm={};all.forEach(e=>cm[e.cat_id||e.catId]=(cm[e.cat_id||e.catId]||0)+Number(e.amount));
  const maxC=Math.max(1,...Object.values(cm));
  const catCards=(ev.categories||[]).map(c=>{
    const sp=cm[c.id]||0,pct=c.budget?Math.min(100,Math.round(sp/c.budget*100)):Math.round(sp/maxC*100);
    return `<div class="lt-card" onclick="App.openDrill('${c.id}')">
      <div class="lt-emoji">${c.emoji}</div><div class="lt-name">${esc(c.name)}</div>
      <div class="lt-amount">${fmt(sp)}</div><div class="lt-sub">${c.budget?'of '+fmt(c.budget):sp===0?'no spend':''}</div>
      <div class="lt-prog-track"><div class="lt-prog-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div>
    </div>`}).join('');
  const mm={};all.forEach(e=>{const d=new Date((e.date||e.expense_date)+'T00:00:00');const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;mm[k]=(mm[k]||0)+Number(e.amount)});
  const months=Object.entries(mm).sort();const maxM=Math.max(1,...Object.values(mm));
  const barsHTML=months.map(([k,v])=>{const[yr,mo]=k.split('-');const pct=Math.round(v/maxM*100);const showIn=pct>28;
    return `<div class="mbar-row"><div class="mbar-label">${MONTH_SHORT[parseInt(mo)-1]} '${yr.slice(2)}</div>
      <div class="mbar-track" onclick="App.jumpToMonth(${yr},${parseInt(mo)-1})"><div class="mbar-fill${pct<=40?' light':''}" style="width:${pct}%">${showIn?`<span class="mbar-fill-lbl">${fmt(v)}</span>`:''}</div></div>
      <div class="mbar-val">${!showIn?fmt(v):''}</div></div>`}).join('');
  const ins=[];
  if(budget&&total>0){const p=Math.round(total/budget*100);if(p>=100)ins.push({t:'danger',i:'🚨',m:`Over budget by ${fmt(total-budget)}.`});else if(p>=90)ins.push({t:'warn',i:'⚠️',m:`${p}% of budget used — ${fmt(budget-total)} left.`});else ins.push({t:'ok',i:'✅',m:`${p}% used. ${fmt(budget-total)} remaining.`})}
  const topE=Object.entries(cm).sort((a,b)=>b[1]-a[1])[0];
  if(topE){const c=(ev.categories||[]).find(x=>x.id===topE[0]);if(c)ins.push({t:'info',i:'📊',m:`Biggest: ${c.emoji} ${c.name} at ${fmt(topE[1])}.`})}
  return `
  <div class="section-header"><div class="section-title">All-time by category</div><div class="section-value">${fmt(total)}</div></div>
  <div class="lifetime-grid">${catCards}</div>
  <div class="section-header" style="margin-top:14px"><div class="section-title">Month by month</div></div>
  <div class="monthly-bars">${months.length?barsHTML:`<div class="empty-state" style="padding:12px 0"><div class="empty-body">No data yet.</div></div>`}</div>
  ${ins.length?`<div class="section-header" style="margin-top:14px"><div class="section-title">Insights</div></div>${ins.map(i=>`<div class="insight-card ${i.t==='warn'?'warn-card':i.t==='danger'?'danger-card':i.t==='ok'?'ok-card':''}"><span class="insight-icon">${i.i}</span><span>${i.m}</span></div>`).join('')}`:''}
  <div class="spacer"></div>`}

// ── All transactions ──────────────────────────────────────────────
function renderTransactionsView(q='',cf=''){
  const ev=Store.activeEvent(),cats=ev.categories||[];
  let filtered=[...Store.activeExpenses()];
  if(q){const ql=q.toLowerCase();filtered=filtered.filter(e=>(e.description||e.desc||'').toLowerCase().includes(ql)||(e.cat_name||e.catName||'').toLowerCase().includes(ql)||(e.notes||'').toLowerCase().includes(ql))}
  if(cf) filtered=filtered.filter(e=>(e.cat_id||e.catId)===cf);
  filtered.sort((a,b)=>(b.date||b.expense_date)<(a.date||a.expense_date)?-1:1);
  const opts=cats.map(c=>`<option value="${c.id}"${cf===c.id?' selected':''}>${esc(c.name)}</option>`).join('');
  const tot=filtered.reduce((s,e)=>s+Number(e.amount),0);
  const stats=filtered.length?`<div class="summary-stats">
    <div class="sum-stat"><div class="sum-stat-label">Total</div><div class="sum-stat-value">${fmt(tot)}</div><div class="sum-stat-sub">${filtered.length} expenses</div></div>
    <div class="sum-stat"><div class="sum-stat-label">Average</div><div class="sum-stat-value">${fmt(tot/filtered.length)}</div><div class="sum-stat-sub">per expense</div></div>
  </div>`:'';
  return `<div class="search-bar-wrap"><div class="search-row">
    <input class="search-input" type="search" placeholder="Search…" value="${esc(q)}" oninput="App.onSearch(this.value)">
    <select class="cat-filter" onchange="App.onCatFilter(this.value)"><option value="">All</option>${opts}</select>
  </div></div>${stats}${txGroupsHTML(filtered)}<div class="spacer"></div>`}

// ── Category drill ────────────────────────────────────────────────
function renderDrillView(catId){
  const ev=Store.activeEvent();
  const cat=(ev.categories||[]).find(c=>c.id===catId)||{name:'Category',emoji:'📦',budget:0};
  const all=Store.activeExpenses().filter(e=>(e.cat_id||e.catId)===catId);
  all.sort((a,b)=>(b.date||b.expense_date)<(a.date||a.expense_date)?-1:1);
  const total=all.reduce((s,e)=>s+Number(e.amount),0);
  const pct=cat.budget?Math.min(100,Math.round(total/cat.budget*100)):0;
  return `<div class="month-nav">
    <button class="month-nav-btn" onclick="App.closeDrill()">‹</button>
    <div class="month-nav-title">${cat.emoji} ${esc(cat.name)}</div>
    <div style="width:34px"></div>
  </div>
  <div style="padding:14px 16px 0">
    <div style="font-size:28px;font-weight:700">${fmt(total)}</div>
    <div style="font-size:13px;color:var(--text-2);margin-top:2px">${all.length} expense${all.length!==1?'s':''}</div>
    ${cat.budget?`<div class="budget-bar-wrap" style="margin-top:12px"><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div><div class="budget-bar-meta"><span>${pct}% of ${fmt(cat.budget)}</span><span>${fmt(total)} spent</span></div></div>`:''}
  </div>
  <div class="section-header"><div class="section-title">All transactions</div></div>
  ${txGroupsHTML(all)}<div class="spacer"></div>`}

// ── Sheets ────────────────────────────────────────────────────────
function expenseSheetHTML(editing=null){
  const ev=Store.activeEvent(),cats=ev.categories||[],today=new Date().toISOString().split('T')[0];
  const e=editing||{},isEdit=!!editing;
  const curCat=e.cat_id||e.catId||cats[0]?.id;
  const catOpts=cats.map(c=>`<option value="${c.id}"${curCat===c.id?' selected':''}>${c.emoji} ${esc(c.name)}</option>`).join('');
  const phaseOpts=(ev.phases||[]).map(p=>`<option value="${p}"${(e.phase)===p?' selected':''}>${p}</option>`).join('');
  return `<div class="sheet-overlay open"><div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">${isEdit?'Edit expense':'Add expense'}</div>
    <div class="field"><label class="field-label">Description</label>
      <input class="field-input" id="inDesc" type="text" placeholder="e.g. OB-GYN checkup" value="${esc(e.description||e.desc||'')}">
    </div>
    <div class="field-row">
      <div class="field"><label class="field-label">Amount</label>
        <input class="field-input" id="inAmount" type="number" inputmode="decimal" placeholder="0" min="0" value="${e.amount||''}">
      </div>
      <div class="field"><label class="field-label">Date</label>
        <input class="field-input" id="inDate" type="date" value="${e.date||e.expense_date||today}">
      </div>
    </div>
    <div class="field"><label class="field-label">Category</label><select class="field-input" id="inCat">${catOpts}</select></div>
    <div class="field-row">
      <div class="field"><label class="field-label">Paid by</label>
        <select class="field-input" id="inPaidBy">
          <option value="Me"${(e.paid_by||e.paidBy||'Me')==='Me'?' selected':''}>Me</option>
          <option value="Partner"${(e.paid_by||e.paidBy)==='Partner'?' selected':''}>Partner</option>
          <option value="Shared"${(e.paid_by||e.paidBy)==='Shared'?' selected':''}>Shared</option>
        </select>
      </div>
      <div class="field"><label class="field-label">Tag</label>
        <select class="field-input" id="inTag">
          <option value=""${!e.tag?' selected':''}>No tag</option>
          <option value="ins"${e.tag==='ins'?' selected':''}>Insured</option>
          <option value="rec"${e.tag==='rec'?' selected':''}>Recurring</option>
          <option value="rei"${e.tag==='rei'?' selected':''}>Reimbursable</option>
        </select>
      </div>
    </div>
    ${phaseOpts?`<div class="field"><label class="field-label">Phase</label><select class="field-input" id="inPhase"><option value="">No phase</option>${phaseOpts}</select></div>`:''}
    <div class="field"><label class="field-label">Notes</label>
      <input class="field-input" id="inNotes" type="text" placeholder="Optional…" value="${esc(e.notes||'')}">
    </div>
    <button class="btn-primary" id="expSaveBtn" onclick="App.saveExpense(${isEdit?e.id:'null'})">${isEdit?'Save changes':'Save expense'}</button>
    ${isEdit?`<button class="btn-danger" onclick="App.deleteExpense(${e.id})">Delete expense</button>`:''}
    <button class="btn-secondary" onclick="App.closeSheet()">Cancel</button>
  </div></div>`}

function eventPickerSheetHTML(){
  const s=Store.get();
  const CATALOG_IDS=['pregnancy','vacation','wedding'];
  const cards=s.events.map(e=>{
    const count=(s.expenses[e.id]||[]).length;
    const isCustom=!CATALOG_IDS.includes(e.slug||'');
    return `<div class="event-option${e.id===s.activeId?' selected':''}" onclick="App.switchEvent(${e.id})">
      ${isCustom?`<span class="eo-del" onclick="event.stopPropagation();App.deleteEvent(${e.id})">✕</span>`:''}
      <div class="eo-emoji">${e.emoji}</div><div class="eo-name">${esc(e.name)}</div>
      <div class="eo-count">${count} expense${count!==1?'s':''}</div>
    </div>`}).join('');
  return `<div class="sheet-overlay open"><div class="sheet">
    <div class="sheet-handle"></div><div class="sheet-title">Your events</div>
    <div class="event-grid">${cards}</div>
    <div class="divider" style="margin:0 0 18px"></div>
    <div class="sheet-title" style="font-size:16px">New event</div>
    <div class="field-row">
      <div class="field"><label class="field-label">Name</label><input class="field-input" id="newEvName" type="text" placeholder="Home renovation"></div>
      <div class="field"><label class="field-label">Icon</label><input class="field-input" id="newEvEmoji" type="text" placeholder="🏠" maxlength="2"></div>
    </div>
    <div class="field"><label class="field-label">Categories</label><input class="field-input" id="newEvCats" type="text" placeholder="Materials, Labor, Permits"><div class="field-hint">Comma-separated</div></div>
    <div class="field"><label class="field-label">Phases (optional)</label><input class="field-input" id="newEvPhases" type="text" placeholder="Planning, In progress, Done"><div class="field-hint">Comma-separated</div></div>
    <div class="field-row">
      <div class="field"><label class="field-label">Budget</label><input class="field-input" id="newEvBudget" type="number" placeholder="500000"></div>
      <div class="field"><label class="field-label">Currency</label>
        <select class="field-input" id="newEvCurr">
          <option value="₹">₹ INR</option><option value="$">$ USD</option>
          <option value="€">€ EUR</option><option value="฿">฿ THB</option>
          <option value="£">£ GBP</option><option value="¥">¥ JPY</option>
        </select>
      </div>
    </div>
    <button class="btn-primary" onclick="App.createEvent()">Create event</button>
    <button class="btn-secondary" onclick="App.closeSheet()">Cancel</button>
  </div></div>`}

function settingsSheetHTML(){
  const ev=Store.activeEvent();
  const catRows=(ev.categories||[]).map(c=>`<div class="cat-budget-row">
    <div class="cat-budget-emoji">${c.emoji}</div>
    <div class="cat-budget-name">${esc(c.name)}</div>
    <input class="cat-budget-input" type="number" value="${c.budget||''}" placeholder="0" onchange="App.updateCatBudget('${c.id}',this.value)">
  </div>`).join('');
  return `<div class="sheet-overlay open"><div class="sheet">
    <div class="sheet-handle"></div><div class="sheet-title">Event settings</div>
    <div class="sheet-sub">${ev.emoji} ${esc(ev.name)}</div>
    <div class="field-row">
      <div class="field"><label class="field-label">Currency</label>
        <select class="field-input" id="setCurrency">
          <option value="₹"${ev.currency==='₹'?' selected':''}>₹ INR</option>
          <option value="$"${ev.currency==='$'?' selected':''}>$ USD</option>
          <option value="€"${ev.currency==='€'?' selected':''}>€ EUR</option>
          <option value="฿"${ev.currency==='฿'?' selected':''}>฿ THB</option>
          <option value="£"${ev.currency==='£'?' selected':''}>£ GBP</option>
          <option value="¥"${ev.currency==='¥'?' selected':''}>¥ JPY</option>
        </select>
      </div>
      <div class="field"><label class="field-label">Total budget</label>
        <input class="field-input" id="setBudget" type="number" value="${ev.budget||''}" placeholder="0">
      </div>
    </div>
    <div class="field"><label class="field-label">Category budgets</label>${catRows}</div>
    <button class="btn-primary" onclick="App.saveSettings()">Save settings</button>
    <div class="divider" style="margin:16px 0 8px"></div>
    <button class="btn-accent" onclick="App.exportCSV()">Export as CSV</button>
    <button class="btn-secondary" onclick="App.closeSheet()">Cancel</button>
  </div></div>`}
