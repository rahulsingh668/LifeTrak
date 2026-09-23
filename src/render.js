// ── Helpers ────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function jsArg(v){return typeof v==='number'?String(v):`'${String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'`}
function progColor(p){return p>=100?'var(--danger)':p>=75?'var(--warn)':'var(--success)'}
function tagHTML(t){const m={ins:['ins','Insured'],rec:['rec','Recurring'],rei:['rei','Reimbursable']};if(!t||!m[t])return '';const[c,l]=m[t];return `<span class="tx-tag ${c}">${l}</span>`}

function txItemHTML(exp){
  const isOffline = exp._offline;
  const origCurr  = exp.orig_currency || exp.origCurrency;
  const origAmt   = exp.orig_amount   || exp.origAmount;
  const receipt   = exp.receipt_path  || exp.receiptPath;
  const origHTML  = origCurr && origAmt ? `<span style="font-size:10px;color:var(--text-3)"> (${esc(origCurr)}${Number(origAmt).toLocaleString('en-IN',{maximumFractionDigits:2})})</span>` : '';
  const offlineBadge = isOffline ? `<span class="tx-tag rec" style="margin-left:4px">Offline</span>` : '';
  const receiptBadge = receipt ? `<span class="tx-tag ins" style="cursor:pointer" onclick="event.stopPropagation();App.viewReceipt('${esc(receipt)}')">📷</span>` : '';
  const canEdit=(Store.activeEvent()?.my_role||'owner')!=='viewer';
  return `<div class="tx-item"${canEdit?` onclick="App.openEditExpense(${jsArg(exp.id)})"`:''}>
    <div class="tx-icon-wrap">${exp.cat_emoji||exp.catEmoji||'📦'}</div>
    <div class="tx-body">
      <div class="tx-desc">${esc(exp.description||exp.desc)}${tagHTML(exp.tag)}${offlineBadge}${receiptBadge}</div>
      <div class="tx-meta">
        <span>${esc(exp.cat_name||exp.catName||'')}</span>
        ${(exp.paid_by||exp.paidBy)?`<span>· ${esc(exp.paid_by||exp.paidBy)}</span>`:''}
        ${exp.phase?`<span>· ${esc(exp.phase)}</span>`:''}
      </div>
    </div>
    <div class="tx-right">
      <div class="tx-amount">${fmt(exp.amount)}${origHTML}</div>
      ${(exp.paid_by||exp.paidBy)&&(exp.paid_by||exp.paidBy)!=='Me'?`<div class="tx-paid-by">${esc(exp.paid_by||exp.paidBy)}</div>`:''}
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
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 7h14M4 11h9M4 15h6" stroke="white" stroke-width="2.2" stroke-linecap="round"/><circle cx="17" cy="15" r="4" fill="white" opacity=".9"/><path d="M15.5 15l1.2 1.2 2-2" stroke="#4f7ef8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="welcome-title">LifeTrak</div>
      <div class="welcome-tagline">Track every rupee across life's biggest moments.</div>
      <div class="welcome-inspiration">
        <div class="wi-icon">🤰</div>
        <div class="wi-text">
          <div class="wi-label">Built with love</div>
          <div class="wi-quote">"Tara started a spreadsheet. Rahul built her this app."</div>
          <div class="wi-names">— Tara &amp; Rahul</div>
        </div>
      </div>
    </div>
    <div class="welcome-actions">
      <button class="btn-primary" onclick="App.showScreen('signup')">Create account</button>
      <button class="btn-secondary" onclick="App.showScreen('login')">Sign in</button>
    </div>
  </div>`}

function renderForgot(){
  return `<div class="auth-screen">
    <div class="auth-topbar"><button class="auth-back" onclick="App.showScreen('login')">←</button><div class="auth-screen-title">Reset password</div></div>
    <div class="auth-body">
      <div class="auth-headline">Forgot your password?</div>
      <div class="auth-sub">Enter your account email and we'll send a 6-digit code to reset it.</div>
      <div class="field"><label class="field-label">Email</label><input class="field-input" id="forgotEmail" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email"></div>
      <button class="btn-primary" id="forgotBtn" onclick="App.forgotPassword()">Send reset code</button>
    </div>
    <div class="auth-footer">Remembered it? <a href="#" onclick="App.showScreen('login');return false">Sign in</a></div>
  </div>`}

function renderReset(email){
  return `<div class="auth-screen">
    <div class="auth-topbar"><button class="auth-back" onclick="App.showScreen('forgot')">←</button><div class="auth-screen-title">Reset password</div></div>
    <div class="auth-body">
      <div class="auth-headline">Check your inbox</div>
      <div class="auth-sub">We sent a code to <strong>${esc(email)}</strong>. Enter it with your new password.</div>
      <div class="field"><label class="field-label">Reset code</label>
        <input class="field-input otp-input" id="resetCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="••••••" autocomplete="one-time-code">
      </div>
      <div class="field"><label class="field-label">New password</label><input class="field-input" id="resetPass" type="password" placeholder="At least 8 characters" autocomplete="new-password"></div>
      <button class="btn-primary" id="resetBtn" onclick="App.resetPassword()">Set new password</button>
      <div class="otp-resend">Didn't get it? <a href="#" id="resendLink" onclick="App.forgotPassword(true);return false">Resend code</a><span id="resendWait"></span></div>
    </div>
  </div>`}

function renderOtp(email){
  return `<div class="auth-screen">
    <div class="auth-topbar"><button class="auth-back" onclick="App.showScreen('signup')">←</button><div class="auth-screen-title">Verify email</div></div>
    <div class="auth-body">
      <div class="auth-headline">Check your inbox</div>
      <div class="auth-sub">We sent a 6-digit code to <strong>${esc(email)}</strong>. Enter it below to activate your account.</div>
      <div class="field"><label class="field-label">Verification code</label>
        <input class="field-input otp-input" id="otpCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6"
               placeholder="••••••" autocomplete="one-time-code" oninput="if(this.value.length===6)App.verifyOtp()">
      </div>
      <button class="btn-primary" id="otpBtn" onclick="App.verifyOtp()">Verify &amp; continue</button>
      <div class="otp-resend">Didn't get it? <a href="#" id="resendLink" onclick="App.resendOtp();return false">Resend code</a><span id="resendWait"></span></div>
      <div class="otp-hint">Check spam if it's not there in a minute.</div>
    </div>
  </div>`}

function onboardingHTML(step, events){
  const dots=[0,1,2].map(i=>`<span class="ob-dot${i===step?' on':''}"></span>`).join('');
  let body='';
  if(step===0){
    const chips=events.map(e=>`<button class="ob-chip${e.id===Store.get().activeId?' picked':''}" onclick="App.obPickEvent(${e.id})">${e.emoji} ${esc(e.name)}</button>`).join('');
    body=`<div class="ob-emoji">🗂️</div>
      <h2 class="ob-title">Pick your moment</h2>
      <p class="ob-text">LifeTrak organizes spending by life event, not by month. Choose where to start — you can rename any of these, or create your own later.</p>
      <div class="ob-chips">${chips}</div>`;
  } else if(step===1){
    body=`<div class="ob-emoji">➕</div>
      <h2 class="ob-title">Log your first expense</h2>
      <p class="ob-text">Tap the <strong>＋ button</strong>, enter what you paid and pick a category — that's it. Works even with no signal: entries wait on your phone and sync themselves.</p>
      <div class="ob-demo">
        <div class="ob-demo-row"><span>🩺</span><div><b>Dr. Sharma consultation</b><small>Doctor visits · Today</small></div><em>₹1,500</em></div>
        <div class="ob-demo-fab">＋</div>
      </div>`;
  } else {
    body=`<div class="ob-emoji">⚙️</div>
      <h2 class="ob-title">Make it yours</h2>
      <p class="ob-text">Three things worth a minute:</p>
      <div class="ob-list">
        <div class="ob-li"><span>🎯</span><div><b>Set a budget</b><small>Open ⚙ settings to set total and per-category budgets — and your currency.</small></div></div>
        <div class="ob-li"><span>👥</span><div><b>Share it</b><small>Invite your partner or family with a link. They log, you both see the total.</small></div></div>
        <div class="ob-li"><span>📲</span><div><b>Install the app</b><small>Add LifeTrak to your home screen — full-screen and offline.</small></div></div>
      </div>`;
  }
  return `<div class="ob-overlay" id="obOverlay"><div class="ob-card">
    <button class="ob-skip" onclick="App.obSkip()">Skip</button>
    ${body}
    <div class="ob-footer">
      <div class="ob-dots">${dots}</div>
      ${step<2
        ? `<button class="btn-primary ob-next" onclick="App.obNext()">Next</button>`
        : `<button class="btn-primary ob-next" onclick="App.obFinish(true)">Add my first expense</button>
           <button class="ob-later" onclick="App.obFinish(false)">I'll explore first</button>`}
    </div>
  </div></div>`}

function renderLogin(){
  return `<div class="auth-screen">
    <div class="auth-topbar"><button class="auth-back" onclick="App.showScreen('welcome')">←</button><div class="auth-screen-title">Sign in</div></div>
    <div class="auth-body">
      <div class="auth-headline">Welcome back</div>
      <div class="auth-sub">Sign in to your LifeTrak account.</div>
      <div class="field"><label class="field-label">Email</label><input class="field-input" id="loginEmail" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email"></div>
      <div class="field"><label class="field-label">Password</label><input class="field-input" id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password"></div>
      <button class="btn-primary" id="loginBtn" onclick="App.login()">Sign in</button>
      <div class="forgot-link"><a href="#" onclick="App.showScreen('forgot');return false">Forgot password?</a></div>
    </div>
    <div class="auth-footer">No account? <a href="#" onclick="App.showScreen('signup');return false">Create one</a></div>
  </div>`}

function renderSignup(){
  return `<div class="auth-screen">
    <div class="auth-topbar"><button class="auth-back" onclick="App.showScreen('welcome')">←</button><div class="auth-screen-title">Create account</div></div>
    <div class="auth-body">
      <div class="auth-headline">Get started</div>
      <div class="auth-sub">Your data stays private and secure.</div>
      <div class="field"><label class="field-label">Your name</label><input class="field-input" id="regName" type="text" placeholder="Full name" autocomplete="name"></div>
      <div class="field"><label class="field-label">Email</label><input class="field-input" id="regEmail" type="email" inputmode="email" placeholder="you@example.com" autocomplete="email"></div>
      <div class="field"><label class="field-label">Password</label><input class="field-input" id="regPass" type="password" placeholder="Min. 8 characters" autocomplete="new-password"></div>
      <button class="btn-primary" id="signupBtn" onclick="App.signup()">Create account</button>
    </div>
    <div class="auth-footer">Have an account? <a href="#" onclick="App.showScreen('login');return false">Sign in</a></div>
  </div>`}

function renderLoading(){
  return `<div class="loading-screen"><div class="loading-logo">LifeTrak</div><div class="loading-dots"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div></div>`}

// ── App shell ─────────────────────────────────────────────────────
function renderShell(content, showToggle=true){
  const s=Store.get(), ev=Store.activeEvent();
  const user=s.user;
  if(!ev) return renderLoading();
  const isShared = ev.my_role && ev.my_role !== 'owner';
  return `
  <div class="topbar">
    <div class="topbar-left">
      <div class="topbar-eyebrow">LifeTrak ${user?`· ${user.name}`:''}</div>
      <div class="event-switcher" onclick="App.openEventPicker()">
        <span>${ev.emoji}</span>
        <span class="ev-name">${esc(ev.name)}</span>
        ${isShared?`<span style="font-size:10px;background:var(--accent-bg);color:var(--accent-text);padding:2px 6px;border-radius:10px;margin-left:4px">${ev.my_role}</span>`:''}
        <span class="ev-chevron">⌄</span>
      </div>
    </div>
    <div class="topbar-actions">
      <button class="icon-btn" onclick="App.openShareSheet()" aria-label="Share event" title="Invite partner">👥</button>
      <button class="icon-btn" onclick="App.openSettings()" aria-label="Settings">⚙</button>
      <button class="icon-btn" onclick="App.logout()" aria-label="Sign out" title="Sign out">⎋</button>
    </div>
  </div>
  ${renderHero()}
  ${showToggle?`<div class="view-toggle-wrap"><div class="view-toggle">
    <button class="vt-btn${s.currentView==='monthly'?' active':''}" onclick="App.setView('monthly')">Monthly</button>
    <button class="vt-btn${s.currentView==='lifetime'?' active':''}" onclick="App.setView('lifetime')">Lifetime</button>
    <button class="vt-btn${s.currentView==='analytics'?' active':''}" onclick="App.setView('analytics');App.loadAnalytics()">Analytics</button>
    <button class="vt-btn${s.currentView==='transactions'?' active':''}" onclick="App.setView('transactions')">All</button>
  </div></div>`:''}
  <div class="content" id="mainContent">${content}</div>
  ${(Store.activeEvent()?.my_role||'owner')!=='viewer'?`<div class="fab-wrap"><button class="fab" onclick="App.openAddExpense()" aria-label="Add expense">＋</button></div>`:''}`}

// ── Hero ──────────────────────────────────────────────────────────
function renderHero(){
  const ev=Store.activeEvent(),all=Store.activeExpenses();
  const total=all.reduce((s,e)=>s+Number(e.amount),0);
  const budget=ev.budget||0,now=new Date();
  const thisMo=all.filter(e=>{const d=new Date((e.date||e.expense_date)+'T00:00:00');return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()}).reduce((s,e)=>s+Number(e.amount),0);
  const left=budget?budget-total:null;
  const pct=budget?Math.max(0,Math.min(100,Math.round(total/budget*100))):0;
  const bar=budget?`<div class="budget-bar-wrap"><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div><div class="budget-bar-meta"><span>${pct}% used</span><span>${fmt(budget)} budget</span></div></div>`:'';
  let lc='ok',lv='—';
  if(left!==null){lc=left<0?'danger':left<budget*.2?'warn':'ok';lv=left<0?`-${fmt(Math.abs(left))}`:fmt(left);}
  const queueCount=Store.getQueue().length;
  const offlineNote=queueCount>0?`<div style="font-size:11px;color:var(--warn);margin-top:4px">⏳ ${queueCount} expense${queueCount>1?'s':''} waiting to sync</div>`:'';
  return `<div class="hero">
    <div class="hero-amount-row"><span class="hero-amount">${fmt(total).slice(1)}</span><span class="hero-currency">${ev.currency||'₹'}</span></div>
    <div class="hero-label">Total spent · ${all.length} expense${all.length!==1?'s':''}</div>
    ${bar}${offlineNote}
    <div class="hero-stats">
      <div class="hstat"><div class="hstat-label">This month</div><div class="hstat-value">${fmtShort(thisMo)}</div></div>
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
    const sp=cm[c.id]||0,pct=c.budget?Math.max(0,Math.min(100,Math.round(sp/c.budget*100))):0;
    return `<div class="cat-card" onclick="App.openDrill('${c.id}')">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-body"><div class="cat-name">${c.name}</div><div class="cat-prog-track"><div class="cat-prog-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div></div>
      <div class="cat-right"><div class="cat-spent">${fmt(sp)}</div><div class="cat-of-budget">${c.budget?'of '+fmtShort(c.budget):''}</div></div>
    </div>`}).join('')||`<div class="empty-state" style="padding:20px 0"><div class="empty-body">No spending this month.</div></div>`;
  return `
  <div class="month-nav"><button class="month-nav-btn" onclick="App.shiftMonth(-1)">‹</button><div class="month-nav-title">${MONTH_NAMES[m]} ${y}</div><button class="month-nav-btn" onclick="App.shiftMonth(1)">›</button></div>
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
    const sp=cm[c.id]||0,pct=Math.max(0,c.budget?Math.min(100,Math.round(sp/c.budget*100)):Math.round(sp/maxC*100));
    return `<div class="lt-card" onclick="App.openDrill('${c.id}')"><div class="lt-emoji">${c.emoji}</div><div class="lt-name">${esc(c.name)}</div><div class="lt-amount">${fmtShort(sp)}</div><div class="lt-sub">${c.budget?'of '+fmtShort(c.budget):sp===0?'no spend':''}</div><div class="lt-prog-track"><div class="lt-prog-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div></div>`}).join('');
  const mm={};all.forEach(e=>{const d=new Date((e.date||e.expense_date)+'T00:00:00');const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;mm[k]=(mm[k]||0)+Number(e.amount)});
  const months=Object.entries(mm).sort(),maxM=Math.max(1,...Object.values(mm));
  const bars=months.map(([k,v])=>{const[yr,mo]=k.split('-');const pct=Math.max(0,Math.round(v/maxM*100));const showIn=pct>28;
    return `<div class="mbar-row"><div class="mbar-label">${MONTH_SHORT[parseInt(mo)-1]} '${yr.slice(2)}</div><div class="mbar-track" onclick="App.jumpToMonth(${yr},${parseInt(mo)-1})"><div class="mbar-fill${pct<=40?' light':''}" style="width:${pct}%">${showIn?`<span class="mbar-fill-lbl">${fmtShort(v)}</span>`:''}</div></div><div class="mbar-val">${!showIn?fmtShort(v):''}</div></div>`}).join('');
  const ins=[];
  if(budget&&total>0){const p=Math.round(total/budget*100);if(p>=100)ins.push({t:'danger',i:'🚨',m:`Over budget by ${fmt(total-budget)}.`});else if(p>=90)ins.push({t:'warn',i:'⚠️',m:`${p}% of budget used — ${fmt(budget-total)} left.`});else ins.push({t:'ok',i:'✅',m:`${p}% used. ${fmt(budget-total)} remaining.`})}
  const topE=Object.entries(cm).sort((a,b)=>b[1]-a[1])[0];
  if(topE){const c=(ev.categories||[]).find(x=>x.id===topE[0]);if(c)ins.push({t:'info',i:'📊',m:`Biggest: ${c.emoji} ${c.name} at ${fmt(topE[1])}.`})}
  return `
  <div class="section-header"><div class="section-title">All-time by category</div><div class="section-value">${fmt(total)}</div></div>
  <div class="lifetime-grid">${catCards}</div>
  <div class="section-header" style="margin-top:14px"><div class="section-title">Month by month</div></div>
  <div class="monthly-bars">${months.length?bars:`<div class="empty-state" style="padding:12px 0"><div class="empty-body">No data yet.</div></div>`}</div>
  ${ins.length?`<div class="section-header" style="margin-top:14px"><div class="section-title">Insights</div></div>${ins.map(i=>`<div class="insight-card ${i.t==='warn'?'warn-card':i.t==='danger'?'danger-card':i.t==='ok'?'ok-card':''}"><span class="insight-icon">${i.i}</span><span>${i.m}</span></div>`).join('')}`:''}
  <div class="spacer"></div>`}

// ── Analytics view ────────────────────────────────────────────────
function renderAnalyticsView(){
  const ev=Store.activeEvent();
  const data=Store.getAnalytics(ev?.id);
  if(!data) return `<div class="empty-state" style="padding:48px 24px"><div class="empty-icon">📊</div><div class="empty-title">Loading analytics…</div></div>`;

  const {summary,by_category,by_month,by_dow,top_expenses,by_paid_by}=data;
  const total=parseFloat(summary?.total||0);
  const catColors=['#4f7ef8','#22c55e','#f59e0b','#ec4899','#14b8a6','#a78bfa','#f87171','#fb923c'];

  // ── Donut chart SVG ──
  const cx=90,cy=90,r=62,stroke=28;
  const circumference=2*Math.PI*r;
  let donutSVG='',offset=0,legendHTML='';
  (by_category||[]).slice(0,7).forEach((cat,i)=>{
    const pct=total>0?parseFloat(cat.total)/total:0;
    const dash=pct*circumference;
    const color=catColors[i%catColors.length];
    donutSVG+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circumference-dash}" stroke-dashoffset="${-offset*circumference}" transform="rotate(-90 ${cx} ${cy})" opacity=".9"/>`;
    offset+=pct;
    legendHTML+=`<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:6px"><div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div><div style="flex:1;color:var(--text-2)">${cat.cat_emoji} ${esc(cat.cat_name)}</div><div style="font-weight:600">${fmt(cat.total)}</div></div>`;
  });
  const donut=`<div style="display:flex;align-items:center;gap:20px;padding:0 16px;margin-bottom:8px">
    <svg width="180" height="180" viewBox="0 0 180 180" style="flex-shrink:0">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
      ${donutSVG}
      <text x="${cx}" y="${cy-6}" text-anchor="middle" font-family="Inter" font-size="11" fill="var(--text-3)">Total</text>
      <text x="${cx}" y="${cy+12}" text-anchor="middle" font-family="Inter" font-size="14" font-weight="700" fill="var(--text)">${fmtShort(total)}</text>
    </svg>
    <div style="flex:1">${legendHTML}</div>
  </div>`;

  // ── Spending trend (sparkline) ──
  const months=by_month||[];
  const maxM=Math.max(1,...months.map(m=>parseFloat(m.total)));
  const W=300,H=60,pts=months.map((m,i)=>`${Math.round(i*(W/(months.length-1||1)))},${Math.round(H-parseFloat(m.total)/maxM*(H-8)+4)}`).join(' ');
  const sparkline=months.length>1?`<div style="padding:0 16px;margin-bottom:8px">
    <svg width="100%" viewBox="0 0 ${W} ${H+20}" style="overflow:visible">
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${months.map((m,i)=>{const x=Math.round(i*(W/(months.length-1||1)));const y=Math.round(H-parseFloat(m.total)/maxM*(H-8)+4);return `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`}).join('')}
      ${months.map((m,i)=>{const x=Math.round(i*(W/(months.length-1||1)));return `<text x="${x}" y="${H+16}" text-anchor="middle" font-family="Inter" font-size="9" fill="var(--text-3)">${m.month.slice(5)}</text>`}).join('')}
    </svg>
  </div>`:'';

  // ── Day of week heatmap ──
  const dowData=new Array(7).fill(0);
  (by_dow||[]).forEach(d=>{ dowData[(d.dow-1)]=parseFloat(d.total); });
  const maxDow=Math.max(1,...dowData);
  const heatmap=`<div style="display:flex;gap:6px;padding:0 16px;margin-bottom:8px;align-items:flex-end">
    ${DOW_NAMES.map((d,i)=>{const h=Math.max(8,Math.round(dowData[i]/maxDow*48));const alpha=0.15+0.85*(dowData[i]/maxDow);
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:100%;border-radius:4px;height:${h}px;background:rgba(79,126,248,${alpha.toFixed(2)})" title="${d}: ${fmt(dowData[i])}"></div>
        <div style="font-size:10px;color:var(--text-3)">${d}</div>
      </div>`;}).join('')}
  </div>`;

  // ── Top expenses ──
  const topHTML=(top_expenses||[]).map(e=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:18px">${e.cat_emoji}</div>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.description)}</div><div style="font-size:11px;color:var(--text-3)">${e.expense_date} · ${esc(e.cat_name)}</div></div>
      <div style="font-size:14px;font-weight:600">${fmt(e.amount)}</div>
    </div>`).join('');

  // ── Paid by ──
  const paidHTML=(by_paid_by||[]).map(p=>{
    const pct=total>0?Math.round(parseFloat(p.total)/total*100):0;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:60px;font-size:13px;font-weight:500">${esc(p.paid_by)}</div>
      <div style="flex:1;height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden"><div style="height:100%;border-radius:4px;background:var(--accent);width:${pct}%"></div></div>
      <div style="font-size:13px;font-weight:600;width:56px;text-align:right">${fmtShort(p.total)}</div>
      <div style="font-size:11px;color:var(--text-3);width:30px">${pct}%</div>
    </div>`;}).join('');

  return `
  <div class="section-header"><div class="section-title">Spending breakdown</div></div>
  ${donut}
  <div class="section-header" style="margin-top:8px"><div class="section-title">Monthly trend</div></div>
  ${sparkline||`<div class="empty-state" style="padding:12px 16px"><div class="empty-body">Need at least 2 months of data.</div></div>`}
  <div class="section-header" style="margin-top:8px"><div class="section-title">Day of week</div></div>
  ${heatmap}
  <div class="section-header" style="margin-top:8px"><div class="section-title">Top 5 expenses</div></div>
  <div style="padding:0 16px">${topHTML||'<div style="color:var(--text-3);font-size:13px;padding:8px 0">No expenses yet.</div>'}</div>
  <div class="section-header" style="margin-top:14px"><div class="section-title">Paid by</div></div>
  <div style="padding:0 16px">${paidHTML}</div>
  <div class="spacer"></div>`}

// ── All transactions view ─────────────────────────────────────────
function renderTransactionsView(q='',cf=''){
  const ev=Store.activeEvent(),cats=ev.categories||[];
  let filtered=[...Store.activeExpenses()];
  if(q){const ql=q.toLowerCase();filtered=filtered.filter(e=>(e.description||e.desc||'').toLowerCase().includes(ql)||(e.cat_name||e.catName||'').toLowerCase().includes(ql)||(e.notes||'').toLowerCase().includes(ql))}
  if(cf) filtered=filtered.filter(e=>(e.cat_id||e.catId)===cf);
  filtered.sort((a,b)=>(b.date||b.expense_date)<(a.date||a.expense_date)?-1:1);
  const opts=cats.map(c=>`<option value="${c.id}"${cf===c.id?' selected':''}>${esc(c.name)}</option>`).join('');
  const tot=filtered.reduce((s,e)=>s+Number(e.amount),0);
  const stats=filtered.length?`<div class="summary-stats"><div class="sum-stat"><div class="sum-stat-label">Total</div><div class="sum-stat-value">${fmt(tot)}</div><div class="sum-stat-sub">${filtered.length} expenses</div></div><div class="sum-stat"><div class="sum-stat-label">Average</div><div class="sum-stat-value">${fmt(tot/filtered.length)}</div><div class="sum-stat-sub">per expense</div></div></div>`:'';
  return `<div class="search-bar-wrap"><div class="search-row">
    <input class="search-input" type="search" placeholder="Search…" value="${esc(q)}" oninput="App.onSearch(this.value)">
    <select class="cat-filter" onchange="App.onCatFilter(this.value)"><option value="">All</option>${opts}</select>
  </div></div>${stats}${txGroupsHTML(filtered)}<div class="spacer"></div>`}

// ── Category drill ────────────────────────────────────────────────
function renderDrillView(catId){
  const ev=Store.activeEvent(),cat=(ev.categories||[]).find(c=>c.id===catId)||{name:'Category',emoji:'📦',budget:0};
  const all=Store.activeExpenses().filter(e=>(e.cat_id||e.catId)===catId);
  all.sort((a,b)=>(b.date||b.expense_date)<(a.date||a.expense_date)?-1:1);
  const total=all.reduce((s,e)=>s+Number(e.amount),0);
  const pct=cat.budget?Math.max(0,Math.min(100,Math.round(total/cat.budget*100))):0;
  return `<div class="month-nav"><button class="month-nav-btn" onclick="App.closeDrill()">‹</button><div class="month-nav-title">${cat.emoji} ${esc(cat.name)}</div><div style="width:34px"></div></div>
  <div style="padding:14px 16px 0">
    <div style="font-size:28px;font-weight:700">${fmt(total)}</div>
    <div style="font-size:13px;color:var(--text-2);margin-top:2px">${all.length} expense${all.length!==1?'s':''}</div>
    ${cat.budget?`<div class="budget-bar-wrap" style="margin-top:12px"><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${progColor(pct)}"></div></div><div class="budget-bar-meta"><span>${pct}% of ${fmt(cat.budget)}</span><span>${fmt(total)} spent</span></div></div>`:''}
  </div>
  <div class="section-header"><div class="section-title">All transactions</div></div>
  ${txGroupsHTML(all)}<div class="spacer"></div>`}

// ── Expense sheet (with receipt + multi-currency) ─────────────────
function expenseSheetHTML(editing=null){
  const ev=Store.activeEvent(),cats=ev.categories||[],today=new Date().toISOString().split('T')[0];
  const e=editing||{},isEdit=!!editing;
  const curCat=e.cat_id||e.catId||cats[0]?.id;
  const catOpts=cats.map(c=>`<option value="${c.id}"${curCat===c.id?' selected':''}>${c.emoji} ${esc(c.name)}</option>`).join('');
  const phaseOpts=(ev.phases||[]).map(p=>`<option value="${p}"${e.phase===p?' selected':''}>${p}</option>`).join('');
  const currOpts=Object.entries(CURRENCIES).map(([sym,{name,flag}])=>`<option value="${sym}"${(e.orig_currency||e.origCurrency)===sym?' selected':''}>${flag} ${sym} ${name}</option>`).join('');
  const hasReceipt=e.receipt_path||e.receiptPath;
  return `<div class="sheet-overlay open"><div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">${isEdit?'Edit expense':'Add expense'}</div>
    <div class="field"><label class="field-label">Description</label>
      <input class="field-input" id="inDesc" type="text" placeholder="What did you pay for?" list="descSuggest"
             value="${esc(e.description||e.desc||'')}" autocomplete="off">
      <datalist id="descSuggest">${[...new Set(Store.activeExpenses().map(x=>x.description).filter(Boolean))].slice(0,8).map(d=>`<option value="${esc(d)}">`).join('')}</datalist>
    </div>
    <div class="field-row">
      <div class="field"><label class="field-label">Amount (${ev.currency||'₹'})</label>
        <input class="field-input" id="inAmount" type="number" inputmode="decimal" placeholder="0.00" step="0.01" value="${e.amount??''}">
      </div>
      <div class="field"><label class="field-label">Date</label>
        <input class="field-input" id="inDate" type="date" value="${e.date||e.expense_date||today}">
      </div>
    </div>
    <div class="field">
      <label class="field-label">Foreign currency (optional)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <select class="field-input" id="inOrigCurrency" onchange="App.onCurrencyChange()">
          <option value="">Same as event (${ev.currency||'₹'})</option>${currOpts}
        </select>
        <input class="field-input" id="inOrigAmount" type="number" inputmode="decimal" placeholder="Orig. amount" min="0" step="0.01" value="${e.orig_amount||e.origAmount||''}" oninput="App.onOrigAmountInput()">
      </div>
      <input id="inExchangeRate" type="hidden" value="${e.exchange_rate||e.exchangeRate||''}">
      <div id="inRateDisplay" style="font-size:12px;color:var(--accent);margin-top:4px"></div>
    </div>
    <div class="field"><label class="field-label">Category</label><select class="field-input" id="inCat">${catOpts}</select></div>
    <div class="field-row">
      <div class="field"><label class="field-label">Paid by</label>
        <select class="field-input" id="inPaidBy">
          <option value="Me"${(e.paid_by||e.paidBy||'Me')==='Me'?' selected':''}>Me</option>
          <option value="Partner"${(e.paid_by||e.paidBy)==='Partner'?' selected':''}>Partner</option>
          <option value="Tara"${(e.paid_by||e.paidBy)==='Tara'?' selected':''}>Tara</option>
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
    <div class="field"><label class="field-label">Notes</label><input class="field-input" id="inNotes" type="text" placeholder="Optional…" value="${esc(e.notes||'')}"></div>
    <div class="field">
      <label class="field-label">Receipt photo</label>
      ${hasReceipt?`<div style="margin-bottom:8px"><img src="${esc(hasReceipt)}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:1px solid var(--border)" onclick="App.viewReceipt('${esc(hasReceipt)}')" loading="lazy"></div>`:''}
      <input type="file" id="inReceipt" accept="image/*" capture="environment" style="font-size:13px;color:var(--text-2)">
      <div class="field-hint">JPEG, PNG or WebP · max 5MB</div>
    </div>
    <button class="btn-primary" id="expSaveBtn" onclick="App.saveExpense(${isEdit?jsArg(e.id):'null'})">${isEdit?'Save changes':'Save expense'}</button>
    ${isEdit?`<button class="btn-danger" onclick="App.deleteExpense(${jsArg(e.id)})">Delete expense</button>`:''}
    <button class="btn-secondary" onclick="App.closeSheet()">Cancel</button>
  </div></div>`}

// ── Event picker sheet ────────────────────────────────────────────
function eventPickerSheetHTML(){
  const s=Store.get();
  const cards=s.events.map(e=>{
    const count=(s.expenses[e.id]||[]).length;
    const shared=e.my_role&&e.my_role!=='owner';
    return `<div class="event-option${e.id===s.activeId?' selected':''}" onclick="App.switchEvent(${e.id})">
      ${!shared?`<span class="eo-del" onclick="event.stopPropagation();App.deleteEvent(${e.id})">✕</span>`:''}
      <div class="eo-emoji">${e.emoji}</div>
      <div class="eo-name">${esc(e.name)}</div>
      <div class="eo-count">${count} expense${count!==1?'s':''}${shared?` · ${e.my_role}`:''}</div>
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
          ${Object.entries(CURRENCIES).map(([sym,{flag,name}])=>`<option value="${sym}">${flag} ${sym}</option>`).join('')}
        </select>
      </div>
    </div>
    <button class="btn-primary" onclick="App.createEvent()">Create event</button>
    <button class="btn-secondary" onclick="App.closeSheet()">Cancel</button>
  </div></div>`}

// ── Share sheet ───────────────────────────────────────────────────
function shareSheetHTML(){
  const ev=Store.activeEvent();
  const members=ev.members||[];
  const isOwner=(ev.my_role||'owner')==='owner';
  const memberRows=members.map(m=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-bg);color:var(--accent-text);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">${esc(m.name||'?').charAt(0).toUpperCase()}</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:500">${esc(m.name)}</div><div style="font-size:12px;color:var(--text-3)">${esc(m.email)}</div></div>
      ${isOwner?`<select class="field-input" style="width:auto;padding:6px 8px;font-size:12px" onchange="App.updateMemberRole(${Number(m.id)},this.value)">
        <option value="editor"${m.role==='editor'?' selected':''}>Editor</option>
        <option value="viewer"${m.role==='viewer'?' selected':''}>Viewer</option>
      </select><button class="icon-btn" aria-label="Remove ${esc(m.name)}" onclick="App.removeMember(${Number(m.id)})">✕</button>`:
      `<div style="font-size:12px;color:var(--text-3);background:var(--surface-2);padding:3px 10px;border-radius:20px">${esc(m.role)}</div>`}
    </div>`).join('');
  return `<div class="sheet-overlay open"><div class="sheet">
    <div class="sheet-handle"></div>
    <div class="sheet-title">Share event</div>
    <div class="sheet-sub">${ev.emoji} ${esc(ev.name)}</div>
    ${members.length?`<div style="margin-bottom:16px">${memberRows}</div>`:''}
    ${isOwner?`<div class="field"><label class="field-label">Invite by email</label><input class="field-input" id="inviteEmail" type="email" inputmode="email" placeholder="tara@example.com" autocomplete="email"></div>
    <div class="field"><label class="field-label">Permission</label>
      <select class="field-input" id="inviteRole">
        <option value="editor">Editor — can add and edit expenses</option>
        <option value="viewer">Viewer — read only</option>
      </select>
    </div>
    <button class="btn-primary" id="inviteBtn" onclick="App.sendInvite()">Send invite link</button>
    <div id="inviteResult"></div>`:`<button class="btn-danger" onclick="App.leaveEvent()">Leave this event</button>`}
    <button class="btn-secondary" onclick="App.closeSheet()">Done</button>
  </div></div>`}

// ── Settings sheet ────────────────────────────────────────────────
function settingsSheetHTML(){
  const ev=Store.activeEvent();
  const user=Store.get().user||{};
  const failedSync=Store.getQueue().filter(a=>a.status==='failed');
  const catRows=(ev.categories||[]).map(c=>`<div class="cat-budget-row"><div class="cat-budget-emoji">${c.emoji}</div><div class="cat-budget-name">${esc(c.name)}</div><input class="cat-budget-input" type="number" value="${c.budget||''}" placeholder="0" onchange="App.updateCatBudget('${c.id}',this.value)"></div>`).join('');
  return `<div class="sheet-overlay open"><div class="sheet">
    <div class="sheet-handle"></div><div class="sheet-title">Event settings</div>
    <div class="sheet-sub">${ev.emoji} ${esc(ev.name)}</div>
    <div class="field-row">
      <div class="field"><label class="field-label">Event name</label><input class="field-input" id="setEvName" type="text" value="${esc(ev.name)}" maxlength="100"></div>
      <div class="field" style="max-width:90px"><label class="field-label">Icon</label><input class="field-input" id="setEvEmoji" type="text" value="${esc(ev.emoji||'📋')}" maxlength="2"></div>
    </div>
    <div class="field-row">
      <div class="field"><label class="field-label">Currency</label>
        <select class="field-input" id="setCurrency">
          ${Object.entries(CURRENCIES).map(([sym,{flag,name}])=>`<option value="${sym}"${ev.currency===sym?' selected':''}>${flag} ${sym} – ${name}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label class="field-label">Total budget</label><input class="field-input" id="setBudget" type="number" value="${ev.budget||''}" placeholder="0"></div>
    </div>
    <div class="field"><label class="field-label">Category budgets</label>${catRows}</div>
    <div class="field"><label class="field-label">Add category</label>
      <div style="display:flex;gap:8px">
        <input class="field-input" id="newCatEmoji" type="text" placeholder="🧹" maxlength="2" style="max-width:64px">
        <input class="field-input" id="newCatName" type="text" placeholder="Maid Salary" maxlength="50" style="flex:1">
        <button class="btn-accent" style="width:auto;padding:0 16px;margin:0" onclick="App.addCategory()">Add</button>
      </div>
      <div class="field-hint">New categories appear immediately in the expense form</div>
    </div>
    <button class="btn-primary" onclick="App.saveSettings()">Save settings</button>
    <div class="divider" style="margin:16px 0 8px"></div>
    <button class="btn-accent" onclick="App.exportCSV()">Export as CSV</button>
    ${failedSync.length?`<div class="divider" style="margin:18px 0 12px"></div>
    <div class="field-label">Offline changes</div>
    <div class="field-hint" style="margin-bottom:10px">${failedSync.length} change${failedSync.length===1?' needs':'s need'} attention. Your local data has been kept.</div>
    <button class="btn-accent" onclick="App.retryOfflineChanges()">Retry offline changes</button>`:''}
    <div class="divider" style="margin:18px 0 12px"></div>
    <div class="field-label">Account</div>
    <div class="field"><label class="field-label">Your name</label><input class="field-input" id="accountName" type="text" value="${esc(user.name||'')}" maxlength="100"></div>
    <div class="field-row">
      <div class="field"><label class="field-label">Current password</label><input class="field-input" id="accountCurrentPass" type="password" autocomplete="current-password" placeholder="Only to change password"></div>
      <div class="field"><label class="field-label">New password</label><input class="field-input" id="accountNewPass" type="password" autocomplete="new-password" placeholder="Optional"></div>
    </div>
    <button class="btn-accent" onclick="App.saveAccount()">Save account</button>
    <div class="field-hint" style="margin-bottom:10px">Permanently deletes your account, owned events, expenses, and memberships.</div>
    <button class="btn-danger" onclick="App.deleteAccount()">Delete my account</button>
    <button class="btn-secondary" onclick="App.closeSheet()">Cancel</button>
  </div></div>`}

// ── Receipt viewer ────────────────────────────────────────────────
App.viewReceipt = function(path) {
  const m=document.createElement('div');
  m.id='sheetMount';
  m.innerHTML=`<div class="sheet-overlay open" onclick="this.parentElement.remove()">
    <div style="padding:20px;width:100%;max-width:500px;margin:0 auto">
      <img src="${esc(path)}" style="width:100%;border-radius:16px;border:1px solid var(--border)" loading="lazy">
      <div style="text-align:center;margin-top:12px;font-size:13px;color:rgba(255,255,255,.6)">Tap anywhere to close</div>
    </div>
  </div>`;
  document.body.appendChild(m);
};
