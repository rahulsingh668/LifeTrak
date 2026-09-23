// ── App ────────────────────────────────────────────────────────────
const App = (() => {
  let _screen  = 'loading';
  let _sheet   = null;
  let _search  = '', _catFilter = '';
  let _syncing = false;
  let _pendingInvite = null;   // invite token waiting for login/signup
  let _installPrompt = null;   // deferred beforeinstallprompt event
  let _otpEmail = null;        // email awaiting verification
  let _obStep = 0;             // onboarding step

  // ── Boot ──────────────────────────────────────────────────────
  async function init() {
    // Load cached data immediately for instant render
    Store.loadCache();

    // Check for invite token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    if (inviteToken) _pendingInvite = inviteToken;
    const _quickAction = urlParams.get('action');

    // Try persisted auth first (works offline)
    const cachedUser = Store.loadAuth();
    if (cachedUser) {
      Store.setUser(cachedUser);
      _screen = 'app';
      paint();
      if (_quickAction === 'add') { window.history.replaceState({}, '', '/app'); setTimeout(openAddExpense, 300); }
      // Then verify session silently in background
      try {
        const user = await API.me();
        Store.setUser(user);
        await loadAppData();
        if (inviteToken) await handleInvite(inviteToken);
        paint();
      } catch(e) {
        if (e.status === 401) {
          // Session genuinely expired — re-login required.
          // softLogout keeps cache + offline queue so nothing is lost;
          // they're wiped only on explicit logout.
          Store.softLogout();
          _screen = 'welcome'; paint();
        } else {
          // Offline OR transient server error — stay in app on cached data.
          // Never wipe the offline queue over a network hiccup.
          paint();
        }
      }
    } else {
      _screen = 'welcome'; paint();
    }

    // Network listeners
    window.addEventListener('online',  () => { showNetworkBanner(true);  syncQueue(); refreshContent(); });
    window.addEventListener('offline', () => showNetworkBanner(false));
    // Background Sync wake-up from the service worker (previously unhandled)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SYNC_EXPENSES') syncQueue();
      });
    }
    if (navigator.onLine && Store.hasQueue()) syncQueue();

    // ── PWA install prompt ──
    // Adopt event captured by the early head listener, then keep listening
    if (window._bipEvent) _installPrompt = window._bipEvent;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      _installPrompt = e;
      maybeShowInstallBanner();
    });
    window.addEventListener('appinstalled', () => {
      dismissInstall(true);
      toast('LifeTrak installed 🎉');
    });
    // iOS never fires beforeinstallprompt — offer instructions instead
    setTimeout(maybeShowInstallBanner, 4000);
  }

  // ── Install prompt ────────────────────────────────────────────
  const INSTALL_KEY = 'lifetrak_install_dismissed';
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function installDismissedRecently() {
    try {
      const t = parseInt(localStorage.getItem(INSTALL_KEY) || '0');
      return t && Date.now() - t < 14 * 86400000;
    } catch(_) { return false; }
  }
  function maybeShowInstallBanner() {
    if (_screen !== 'app') return;                 // only nudge signed-in users
    if (isStandalone()) return;                    // already installed
    if (installDismissedRecently()) return;
    if (document.getElementById('installBanner')) return;
    if (window._bipEvent && !_installPrompt) _installPrompt = window._bipEvent;
    const el = document.createElement('div');
    el.id = 'installBanner'; el.className = 'install-banner';
    el.innerHTML = `
      <img class="ib-icon" src="/icons/icon-192.png" alt="">
      <div class="ib-text">
        <div class="ib-title">Install LifeTrak</div>
        <div class="ib-sub">Works offline · opens from your home screen</div>
      </div>
      <button class="ib-btn" onclick="App.installApp()">${_installPrompt ? 'Install' : 'How'}</button>
      <button class="ib-close" onclick="App.dismissInstall()" aria-label="Dismiss">✕</button>`;
    document.body.appendChild(el);
  }
  async function installApp() {
    if (_installPrompt) {
      _installPrompt.prompt();
      const { outcome } = await _installPrompt.userChoice;
      _installPrompt = null;
      if (outcome !== 'accepted') dismissInstall();
      else document.getElementById('installBanner')?.remove();
      return;
    }
    // No native prompt available — show the right manual steps
    document.getElementById('installBanner')?.remove();
    const steps = isIOS() ? `
        <li><span class="ios-step-num">1</span><span>Tap the <strong>Share</strong> button <svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:-2px"><path d="M8 1v9M5 3.5L8 1l3 2.5M3 7v6.5h10V7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> in Safari's toolbar</span></li>
        <li><span class="ios-step-num">2</span><span>Scroll down and tap <strong>Add to Home Screen</strong></span></li>
        <li><span class="ios-step-num">3</span><span>Tap <strong>Add</strong> — LifeTrak opens full-screen and works offline</span></li>` : `
        <li><span class="ios-step-num">1</span><span>Tap the <strong>⋮ menu</strong> in the top-right of Chrome</span></li>
        <li><span class="ios-step-num">2</span><span>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>)</span></li>
        <li><span class="ios-step-num">3</span><span>Confirm — LifeTrak gets its own icon and opens full-screen</span></li>`;
    openSheet(`<div class="sheet-overlay open"><div class="sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Add LifeTrak to your home screen</div>
      <ol class="ios-install-steps">${steps}</ol>
      <button class="btn-secondary" onclick="App.closeSheet()">Done</button>
    </div></div>`);
    try { localStorage.setItem(INSTALL_KEY, String(Date.now())); } catch(_){}
  }
  function dismissInstall(silent=false) {
    document.getElementById('installBanner')?.remove();
    if (!silent) { try { localStorage.setItem(INSTALL_KEY, String(Date.now())); } catch(_){} }
  }

  async function loadAppData() {
    const events = await API.getEvents();
    Store.setEvents(events);
    if (!events.length) return;
    // Cached activeId may point at a deleted event or one we lost access
    // to — validate it against the live list or it 404s and blocks login.
    let activeId = Store.get().activeId;
    if (!events.some(e => e.id === activeId)) activeId = events[0].id;
    Store.switchEvent(activeId);
    // A failed expense fetch must never block login — render the shell,
    // expenses can be retried from inside the app.
    try {
      const expenses = await API.getExpenses(activeId);
      Store.setExpenses(activeId, expenses);
    } catch(e) {
      console.warn('Expense load failed at boot:', e.message);
      if (e.status === 404) Store.setExpenses(activeId, []);
    }
  }

  async function handleInvite(token) {
    _pendingInvite = null;
    try {
      const result = await API.acceptInvite(token);
      if (result.already_owner) { toast(`You own "${result.event_name}" — no need to join.`, 'ok'); window.history.replaceState({}, '', '/app'); return; }
      toast(`Joined "${result.event_name}" as ${result.role} ✓`, 'ok');
      const events = await API.getEvents();
      Store.setEvents(events);
      Store.switchEvent(result.event_id);
      const expenses = await API.getExpenses(result.event_id);
      Store.setExpenses(result.event_id, expenses);
      // Clean URL
      window.history.replaceState({}, '', '/app');
    } catch(e) { toast(e.message, 'warn'); }
  }

  // ── Offline sync ──────────────────────────────────────────────
  async function syncQueue() {
    if (_syncing) return;
    let queue = Store.getQueue();
    if (!queue.length) return;
    _syncing = true;
    let synced = 0, failed = 0;

    // Pre-pass: an offline create followed by an offline delete of the same
    // temp expense cancels out — never send either to the server.
    const deletedTemps = new Set(
      queue.filter(a => a.type==='deleteExpense' && String(a.id).startsWith('temp_')).map(a => a.id)
    );
    for (const a of queue) {
      if ((a.type==='createExpense' && deletedTemps.has(a.tempId)) ||
          (a.type==='deleteExpense' && deletedTemps.has(a.id)) ||
          (a.type==='updateExpense' && deletedTemps.has(a.id))) {
        Store.dequeue(a.queueId||a.ts);
        if (a.receiptBlobId) Store.deleteReceiptBlob(a.receiptBlobId).catch(()=>{});
      }
    }
    queue = Store.getQueue();

    for (const action of queue) {
      if (action.status === 'failed') { failed++; continue; }
      const queueId = action.queueId || action.ts;
      let targetId = action.serverId || action.id;

      try {
        if (action.type === 'createExpense') {
          if (!action.serverId) {
            const result = await API.createExpense(action.payload);
            targetId = result.id;
            Store.replaceTempExpense(action.eventId, action.tempId, {...action.payload, id:result.id, _offline:false});
            // Persist the mapping before any later network operation. If the
            // browser closes now, queued edits still target the server record.
            Store.remapQueueTarget(action.tempId, result.id);
            Store.updateQueueAction(queueId, {serverId:result.id});
          }
          if (action.receiptBlobId) {
            const file = await Store.getReceiptBlob(action.receiptBlobId);
            if (!file) throw Object.assign(new Error('Offline receipt is no longer available.'), {permanent:true});
            const uploaded = await API.uploadReceipt(targetId, file);
            const exp=Store.activeExpenses().find(e=>e.id===targetId);
            if(exp) Store.upsertExpense(action.eventId,{...exp,receipt_path:uploaded.receipt_path});
            await Store.deleteReceiptBlob(action.receiptBlobId);
          }
          Store.dequeue(queueId); synced++;
        } else if (action.type === 'updateExpense') {
          if (String(targetId).startsWith('temp_')) {
            // Its create has not synced yet; preserve ordering for the next pass.
            continue;
          }
          await API.updateExpense(targetId, action.payload);
          if (action.receiptBlobId) {
            const file = await Store.getReceiptBlob(action.receiptBlobId);
            if (!file) throw Object.assign(new Error('Offline receipt is no longer available.'), {permanent:true});
            const uploaded = await API.uploadReceipt(targetId, file);
            const exp=Store.activeExpenses().find(e=>e.id===targetId);
            if(exp) Store.upsertExpense(action.eventId,{...exp,receipt_path:uploaded.receipt_path});
            await Store.deleteReceiptBlob(action.receiptBlobId);
          }
          Store.dequeue(queueId); synced++;
        } else if (action.type === 'uploadReceipt') {
          const file = await Store.getReceiptBlob(action.receiptBlobId);
          if (!file) throw Object.assign(new Error('Offline receipt is no longer available.'), {permanent:true});
          const uploaded = await API.uploadReceipt(targetId, file);
          const exp=Store.activeExpenses().find(e=>e.id===targetId);
          if(exp) Store.upsertExpense(action.eventId,{...exp,receipt_path:uploaded.receipt_path});
          await Store.deleteReceiptBlob(action.receiptBlobId);
          Store.dequeue(queueId); synced++;
        } else if (action.type === 'deleteExpense') {
          if (String(targetId).startsWith('temp_')) continue;
          try { await API.deleteExpense(targetId); }
          catch(e) { if(e.status!==404) throw e; }
          Store.dequeue(queueId); synced++;
        }
      } catch(e) {
        if (e.network) {
          // Connection dropped mid-sync — stop, keep the rest for next reconnect
          break;
        }
        if (e.status === 401) {
          // Session expired — nothing will succeed; stop and keep queue intact
          break;
        }
        if (e.permanent || (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429)) {
          // Keep rejected mutations visible and recoverable instead of silently
          // discarding user data. A future edit/retry can resolve the problem.
          Store.updateQueueAction(queueId,{status:'failed',error:e.message||'Sync rejected'}); failed++;
          console.warn('Sync needs attention:', action.type, e.message);
        } else {
          console.warn('Sync fail (will retry):', action.type, e.message);
        }
      }
    }
    _syncing = false;
    if (synced > 0) Store.setAnalytics(Store.activeEvent()?.id,null);
    if (synced > 0)  { toast(`${synced} offline change${synced>1?'s':''} synced ✓`, 'ok'); refreshContent(); }
    if (failed > 0) { toast(`${failed} offline change${failed>1?'s need':' needs'} attention — your data was kept.`, 'warn'); refreshContent(); }
  }

  function retryOfflineChanges() {
    Store.retryFailedQueue(); closeSheet(); paintApp(); syncQueue();
  }

  function showNetworkBanner(online) {
    let el = document.getElementById('netBanner');
    if (!el) { el=document.createElement('div'); el.id='netBanner'; el.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999;text-align:center;padding:8px 16px;font-size:13px;font-weight:600;transition:transform .3s;transform:translateY(-100%)'; document.body.appendChild(el); }
    el.style.background = online ? 'var(--success)' : 'var(--warn)';
    el.style.color = '#fff';
    el.textContent = online ? '🟢 Back online — syncing…' : '🔴 Offline — expenses will sync when reconnected';
    el.style.transform = 'translateY(0)';
    if (online) setTimeout(() => { el.style.transform = 'translateY(-100%)'; }, 3000);
  }

  // ── Paint ──────────────────────────────────────────────────────
  function paint() {
    const el = document.getElementById('app');
    if (_screen === 'loading') { el.innerHTML = renderLoading(); return; }
    if (_screen === 'welcome') { el.innerHTML = renderWelcome(); return; }
    if (_screen === 'login')   { el.innerHTML = renderLogin();   return; }
    if (_screen === 'signup')  { el.innerHTML = renderSignup();  return; }
    if (_screen === 'otp')     { el.innerHTML = renderOtp(_otpEmail||''); startResendCountdown(); setTimeout(()=>document.getElementById('otpCode')?.focus(),80); return; }
    if (_screen === 'forgot')  { el.innerHTML = renderForgot(); setTimeout(()=>document.getElementById('forgotEmail')?.focus(),80); return; }
    if (_screen === 'reset')   { el.innerHTML = renderReset(_otpEmail||''); startResendCountdown(); setTimeout(()=>document.getElementById('resetCode')?.focus(),80); return; }
    paintApp();
  }

  function paintApp() {
    const s = Store.get();
    let content;
    const v = s.currentView;
    if (s.drillCat)            content = renderDrillView(s.drillCat);
    else if (v==='monthly')    content = renderMonthlyView();
    else if (v==='lifetime')   content = renderLifetimeView();
    else if (v==='analytics')  content = renderAnalyticsView();
    else                       content = renderTransactionsView(_search, _catFilter);
    document.getElementById('app').innerHTML = renderShell(content, !s.drillCat);
    if (Store.hasQueue()) showOfflineBadge();
    maybeShowInstallBanner();
  }

  function showOfflineBadge() {
    const fab = document.querySelector('.fab');
    if (!fab) return;
    const queue = Store.getQueue(), count = queue.length, hasFailed=queue.some(a=>a.status==='failed');
    let badge = document.getElementById('offlineBadge');
    if (!badge) { badge=document.createElement('div'); badge.id='offlineBadge'; badge.style.cssText='position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:var(--warn);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;pointer-events:none'; fab.style.position='relative'; fab.appendChild(badge); }
    badge.textContent = hasFailed ? '!' : count;
    badge.style.background = hasFailed ? 'var(--danger)' : 'var(--warn)';
    badge.title = hasFailed ? 'An offline change needs attention' : `${count} change${count===1?'':'s'} waiting to sync`;
  }

  function refreshContent() {
    const el = document.getElementById('mainContent');
    if (!el) return;
    const s = Store.get();
    let content;
    const v = s.currentView;
    if (s.drillCat)            content = renderDrillView(s.drillCat);
    else if (v==='monthly')    content = renderMonthlyView();
    else if (v==='lifetime')   content = renderLifetimeView();
    else if (v==='analytics')  content = renderAnalyticsView();
    else                       content = renderTransactionsView(_search, _catFilter);
    el.innerHTML = content;
    const hero = document.querySelector('.hero');
    if (hero) hero.outerHTML = renderHero();
  }

  // ── Screen nav ────────────────────────────────────────────────
  function showScreen(s) { _screen=s; paint(); }

  // ── OTP verification ──────────────────────────────────────────
  let _resendTimer = null;
  async function verifyOtp() {
    const code = document.getElementById('otpCode')?.value.replace(/\D/g,'') || '';
    if (code.length !== 6) { toast('Enter the 6-digit code.','warn'); return; }
    setBtnLoading('otpBtn', true);
    try {
      const user = await API.verifyOtp({ email:_otpEmail, code });
      Store.setUser(user);
      await loadAppData();
      if (_pendingInvite) await handleInvite(_pendingInvite);
      _screen='app'; paint();
      toast(`Welcome, ${user.name}! 🎉`,'ok');
      maybeShowOnboarding();
    } catch(e) { toast(e.message,'warn'); }
    finally { setBtnLoading('otpBtn', false); }
  }
  async function resendOtp() {
    try {
      await API.resendOtp({ email:_otpEmail });
      toast('New code sent 📬','ok');
      startResendCountdown();
    } catch(e) { toast(e.message,'warn'); }
  }
  function startResendCountdown() {
    clearInterval(_resendTimer);
    const link = document.getElementById('resendLink');
    const wait = document.getElementById('resendWait');
    if (!link || !wait) return;
    let t = 60;
    link.classList.add('disabled');
    wait.textContent = ` (${t}s)`;
    _resendTimer = setInterval(() => {
      t--;
      if (t <= 0) { clearInterval(_resendTimer); link.classList.remove('disabled'); wait.textContent=''; }
      else wait.textContent = ` (${t}s)`;
    }, 1000);
  }

  // ── Forgot / reset password ───────────────────────────────────
  async function forgotPassword(isResend=false) {
    const email = isResend ? _otpEmail
      : (document.getElementById('forgotEmail')?.value.trim().toLowerCase() || '');
    if (!email) { toast('Enter your email.','warn'); return; }
    if (!isResend) setBtnLoading('forgotBtn', true);
    try {
      await API.forgotPassword({ email });
      _otpEmail = email;
      if (_screen !== 'reset') { _screen='reset'; paint(); }
      else startResendCountdown();
      toast('If that account exists, a code is on its way 📬','ok');
    } catch(e) { toast(e.message,'warn'); }
    finally { if (!isResend) setBtnLoading('forgotBtn', false); }
  }
  async function resetPassword() {
    const code = document.getElementById('resetCode')?.value.replace(/\D/g,'') || '';
    const pass = document.getElementById('resetPass')?.value || '';
    if (code.length !== 6) { toast('Enter the 6-digit code.','warn'); return; }
    if (pass.length < 8)   { toast('Password must be at least 8 characters.','warn'); return; }
    setBtnLoading('resetBtn', true);
    try {
      const user = await API.resetPassword({ email:_otpEmail, code, password: pass });
      Store.setUser(user);
      await loadAppData();
      _screen='app'; paint();
      toast('Password updated — you\'re in ✓','ok');
      maybeShowOnboarding();
    } catch(e) { toast(e.message,'warn'); }
    finally { setBtnLoading('resetBtn', false); }
  }

  // ── Onboarding (first login) ──────────────────────────────────
  const ONBOARD_KEY = 'lifetrak_onboarded_';
  function maybeShowOnboarding() {
    const uid = Store.get().user?.id;
    if (!uid) return;
    try { if (localStorage.getItem(ONBOARD_KEY + uid)) return; } catch(_){}
    if (document.getElementById('obOverlay')) return;
    _obStep = 0;
    const host = document.createElement('div');
    host.id = 'obHost';
    host.innerHTML = onboardingHTML(_obStep, Store.get().events || []);
    document.body.appendChild(host);
  }
  function obPaint() {
    const host = document.getElementById('obHost');
    if (host) host.innerHTML = onboardingHTML(_obStep, Store.get().events || []);
  }
  function obNext() { _obStep = Math.min(2, _obStep + 1); obPaint(); }
  function obPickEvent(id) { switchEvent(id); _obStep = 0; obPaint(); }
  function obSkip() { obFinish(false); }
  function obFinish(addExpense) {
    const uid = Store.get().user?.id;
    try { if (uid) localStorage.setItem(ONBOARD_KEY + uid, '1'); } catch(_){}
    document.getElementById('obHost')?.remove();
    if (addExpense) openAddExpense();
  }

  // ── Auth ──────────────────────────────────────────────────────
  async function login() {
    const email=document.getElementById('loginEmail')?.value.trim();
    const password=document.getElementById('loginPass')?.value;
    if (!email||!password) { toast('Enter your email and password.','warn'); return; }
    setBtnLoading('loginBtn', true);
    try {
      const user = await API.login({email,password});
      Store.setUser(user); // saves to localStorage
      await loadAppData();
      if (_pendingInvite) await handleInvite(_pendingInvite);
      _screen='app'; paint();
      maybeShowOnboarding();
    } catch(e) {
      if (e.status === 403) {
        _otpEmail = document.getElementById('loginEmail')?.value.trim().toLowerCase() || '';
        _screen='otp'; paint();
        toast('Verify your email to continue — new code sent 📬','warn');
      } else toast(e.message,'warn');
    }
    finally { setBtnLoading('loginBtn', false); }
  }

  async function signup() {
    const name=document.getElementById('regName')?.value.trim();
    const email=document.getElementById('regEmail')?.value.trim();
    const password=document.getElementById('regPass')?.value;
    if (!name||!email||!password) { toast('Fill in all fields.','warn'); return; }
    setBtnLoading('signupBtn', true);
    try {
      const res = await API.register({name,email,password});
      if (res.pending_verification) {
        _otpEmail = res.email;
        _screen='otp'; paint();
        toast('Code sent — check your email 📬','ok');
        return;
      }
    } catch(e) { toast(e.message,'warn'); }
    finally { setBtnLoading('signupBtn', false); }
  }

  async function logout() {
    if (!confirm('Sign out?')) return;
    try { await API.logout(); } catch(_) {}
    Store.clearUser(); _screen='welcome'; paint();
  }

  // ── View ──────────────────────────────────────────────────────
  function setView(v)    { Store.setView(v); _search=''; _catFilter=''; paintApp(); }
  function shiftMonth(d) { Store.shiftMonth(d); refreshContent(); }
  function jumpToMonth(y,m) { Store.setMonth(parseInt(y),parseInt(m)); setView('monthly'); }
  function onSearch(v)   { _search=v; document.getElementById('mainContent').innerHTML=renderTransactionsView(_search,_catFilter); }
  function onCatFilter(v){ _catFilter=v; document.getElementById('mainContent').innerHTML=renderTransactionsView(_search,_catFilter); }
  function openDrill(c)  { Store.setDrill(c); paintApp(); }
  function closeDrill()  { Store.clearDrill(); paintApp(); }

  // ── Analytics ──────────────────────────────────────────────────
  async function loadAnalytics() {
    const ev = Store.activeEvent();
    if (!ev) return;
    if (Store.getAnalytics(ev.id)) { refreshContent(); return; }
    try {
      const data = await API.getAnalytics(ev.id);
      Store.setAnalytics(ev.id, data);
      refreshContent();
    } catch(e) { toast('Could not load analytics','warn'); }
  }

  // ── Sheets ────────────────────────────────────────────────────
  function openSheet(html) {
    closeSheet();
    const m=document.createElement('div'); m.id='sheetMount'; m.innerHTML=html;
    document.body.appendChild(m); _sheet=m;
    const ov=m.querySelector('.sheet-overlay');
    if (ov) ov.addEventListener('click',e=>{ if(e.target===ov) closeSheet(); });
  }
  function closeSheet() { if(_sheet){_sheet.remove();_sheet=null;} document.getElementById('sheetMount')?.remove(); }
  function isViewer() { return (Store.activeEvent()?.my_role||'owner')==='viewer'; }
  function openAddExpense() { if(isViewer()){toast('You have view-only access to this event.','warn');return;} openSheet(expenseSheetHTML()); setTimeout(()=>document.getElementById('inDesc')?.focus(),80); }
  function openEditExpense(id) { if(isViewer()){toast('You have view-only access to this event.','warn');return;} const exp=Store.activeExpenses().find(e=>e.id===id); if(exp) openSheet(expenseSheetHTML(exp)); }
  function openEventPicker() { openSheet(eventPickerSheetHTML()); }
  function openSettings()    { openSheet(settingsSheetHTML()); }
  function openShareSheet()  { openSheet(shareSheetHTML()); }

  // ── Currency conversion ───────────────────────────────────────
  async function onCurrencyChange() {
    const origCurr = document.getElementById('inOrigCurrency')?.value;
    const evCurr   = Store.activeEvent()?.currency || '₹';
    const amountEl = document.getElementById('inAmount');
    const origAmtEl= document.getElementById('inOrigAmount');
    const rateEl   = document.getElementById('inRateDisplay');
    if (!origCurr || origCurr === evCurr) {
      if (rateEl) rateEl.textContent = '';
      if (origAmtEl) origAmtEl.value = '';
      const hidden=document.getElementById('inExchangeRate'); if(hidden) hidden.value='';
      return;
    }
    const code1 = CURRENCIES[origCurr]?.code || origCurr;
    const code2 = CURRENCIES[evCurr]?.code   || evCurr;
    try {
      const rate = await API.getExchangeRate(code1, code2);
      if (rateEl) rateEl.textContent = `1 ${origCurr} = ${rate.toFixed(4)} ${evCurr}`;
      const hidden=document.getElementById('inExchangeRate'); if(hidden) hidden.value=String(rate);
      const origAmt = parseFloat(origAmtEl?.value || 0);
      if (origAmt > 0 && amountEl) amountEl.value = (origAmt * rate).toFixed(2);
    } catch(e) {
      if(rateEl) rateEl.textContent=e.message;
      toast(e.message,'warn');
    }
  }

  async function onOrigAmountInput() {
    const origCurr = document.getElementById('inOrigCurrency')?.value;
    const evCurr   = Store.activeEvent()?.currency || '₹';
    if (!origCurr || origCurr === evCurr) return;
    const code1 = CURRENCIES[origCurr]?.code || origCurr;
    const code2 = CURRENCIES[evCurr]?.code   || evCurr;
    const origAmt= parseFloat(document.getElementById('inOrigAmount')?.value || 0);
    const amtEl  = document.getElementById('inAmount');
    const rateEl = document.getElementById('inExchangeRate');
    try {
      const rate = await API.getExchangeRate(code1, code2);
      if (rateEl) rateEl.value=String(rate);
      if (amtEl && origAmt > 0) amtEl.value = (origAmt * rate).toFixed(2);
    } catch(e) {
      if (rateEl) rateEl.value='';
      toast(e.message,'warn');
    }
  }

  // ── Expense CRUD ──────────────────────────────────────────────
  async function saveExpense(editId=null) {
    const ev       = Store.activeEvent();
    const existingExpense = editId ? Store.activeExpenses().find(e=>e.id===editId) : null;
    const desc     = document.getElementById('inDesc')?.value.trim();
    const amount   = parseFloat(document.getElementById('inAmount')?.value);
    const date     = document.getElementById('inDate')?.value;
    const catId    = document.getElementById('inCat')?.value;
    const paidBy   = document.getElementById('inPaidBy')?.value||'Me';
    const tag      = document.getElementById('inTag')?.value||'';
    const phase    = document.getElementById('inPhase')?.value||'';
    const notes    = document.getElementById('inNotes')?.value.trim()||'';
    const origCurr = document.getElementById('inOrigCurrency')?.value||'';
    const origAmt  = parseFloat(document.getElementById('inOrigAmount')?.value)||null;
    const exchangeRate = parseFloat(document.getElementById('inExchangeRate')?.value)||null;
    const receiptFile = document.getElementById('inReceipt')?.files?.[0]||null;

    if (!desc||isNaN(amount)||amount===0) { toast('Enter description and a non-zero amount. Use a negative amount to adjust against an advance.','warn'); return; }
    if (!date) { toast('Pick a date.','warn'); return; }

    const cat = (ev.categories||[]).find(c=>c.id===catId)||{};
    const payload = {
      event_id:ev.id, description:desc, amount, date,
      cat_id:catId, cat_name:cat.name||'', cat_emoji:cat.emoji||'📦',
      paid_by:paidBy, tag, phase, notes,
      orig_amount: origCurr && origCurr !== ev.currency ? origAmt : null,
      orig_currency: origCurr && origCurr !== ev.currency ? origCurr : null,
      exchange_rate: origCurr && origCurr !== ev.currency ? exchangeRate : null,
      client_mutation_id: editId ? existingExpense?.client_mutation_id : Store.newId('mut').slice(0,64),
    };

    setBtnLoading('expSaveBtn', true);

    async function saveOffline() {
      let receiptBlobId=null;
      if(receiptFile) {
        try { receiptBlobId=await Store.putReceiptBlob(receiptFile); }
        catch(_) { toast('Expense saved, but the receipt could not be stored offline.','warn'); }
      }
      if (editId) {
        Store.upsertExpense(ev.id, {...(existingExpense||{}), ...payload, id:editId});
        const pendingCreate=String(editId).startsWith('temp_')
          ? Store.getQueue().find(a=>a.type==='createExpense'&&a.tempId===editId) : null;
        if(pendingCreate) {
          if(pendingCreate.receiptBlobId&&receiptBlobId) Store.deleteReceiptBlob(pendingCreate.receiptBlobId).catch(()=>{});
          Store.updateQueueAction(pendingCreate.queueId||pendingCreate.ts,{payload,receiptBlobId:receiptBlobId||pendingCreate.receiptBlobId,status:'pending',error:null});
        } else {
          Store.enqueue({type:'updateExpense', id:editId, payload, eventId:ev.id,receiptBlobId});
        }
      } else {
        const tempId='temp_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
        Store.upsertExpense(ev.id, {...payload, id:tempId, _offline:true});
        Store.enqueue({type:'createExpense', payload, tempId, eventId:ev.id,receiptBlobId});
      }
      Store.setAnalytics(ev.id,null);
      toast('Saved offline — syncs when online 📶');
      setBtnLoading('expSaveBtn', false); closeSheet(); refreshContent();
    }

    if (!navigator.onLine || String(editId||'').startsWith('temp_')) {
      await saveOffline();
      if(navigator.onLine) setTimeout(syncQueue,0);
      return;
    }

    try {
      let savedId = editId;
      if (editId) {
        await API.updateExpense(editId, payload);
        Store.getQueue().filter(a=>a.type==='updateExpense'&&String(a.id)===String(editId)).forEach(a=>Store.dequeue(a.queueId||a.ts));
        Store.upsertExpense(ev.id, {...(Store.activeExpenses().find(e=>e.id===editId)||{}), ...payload, id:editId});
        toast('Expense updated ✓');
      } else {
        const result = await API.createExpense(payload);
        savedId = result.id;
        Store.upsertExpense(ev.id, {...payload, id:result.id});
        toast('Expense saved ✓');
      }
      // Upload receipt if selected
      if (receiptFile && savedId) {
        try {
          const r = await API.uploadReceipt(savedId, receiptFile);
          // Update receipt_path in local store
          const exp = Store.activeExpenses().find(e=>e.id===savedId);
          if (exp) Store.upsertExpense(ev.id, {...exp, receipt_path: r.receipt_path});
          toast('Receipt saved ✓');
        } catch(e) {
          if(e.network) {
            try {
              const receiptBlobId=await Store.putReceiptBlob(receiptFile);
              Store.enqueue({type:'uploadReceipt',id:savedId,eventId:ev.id,receiptBlobId});
              toast('Expense saved; receipt will upload when online.','warn');
            } catch(_) { toast('Expense saved but receipt upload failed','warn'); }
          } else toast('Expense saved but receipt upload failed','warn');
        }
      }
      closeSheet(); refreshContent();
      Store.setAnalytics(ev.id,null);
    } catch(e) {
      // navigator.onLine lied (captive portal, flaky link, server down):
      // don't lose the expense — queue it like a normal offline save.
      if (e.network) { await saveOffline(); return; }
      toast(e.message,'warn');
    }
    finally { setBtnLoading('expSaveBtn', false); }
  }

  async function deleteExpense(id) {
    if (!confirm('Remove this expense?')) return;
    const ev=Store.activeEvent();
    const removed=Store.activeExpenses().find(e=>e.id===id);
    Store.removeExpense(ev.id,id); Store.setAnalytics(ev.id,null); closeSheet(); refreshContent();
    const queueDelete = () => { Store.enqueue({type:'deleteExpense',id,eventId:ev.id}); toast('Deleted offline — syncs when online 📶'); };
    if (!navigator.onLine) { queueDelete(); return; }
    if (String(id).startsWith('temp_')) { queueDelete(); return; }  // create not yet synced; syncQueue cancels the pair
    try { await API.deleteExpense(id); toast('Expense removed'); }
    catch(e) {
      if (e.network) { queueDelete(); return; }
      if(removed) Store.upsertExpense(ev.id,removed);
      refreshContent(); toast(`${e.message} — deletion was rolled back.`,'warn');
    }
  }

  // ── Events ────────────────────────────────────────────────────
  async function switchEvent(id) {
    Store.switchEvent(id); closeSheet();
    if (!Store.get().expenses[id] && navigator.onLine) {
      try { const exps=await API.getExpenses(id); Store.setExpenses(id,exps); } catch(_) {}
    }
    _search=''; _catFilter=''; paintApp();
  }

  async function createEvent() {
    const name=document.getElementById('newEvName')?.value.trim();
    const emoji=document.getElementById('newEvEmoji')?.value.trim()||'📋';
    const catsRaw=document.getElementById('newEvCats')?.value||'';
    const phasesRaw=document.getElementById('newEvPhases')?.value||'';
    const budget=parseFloat(document.getElementById('newEvBudget')?.value)||0;
    const currency=document.getElementById('newEvCurr')?.value||'₹';
    if (!name) { toast('Enter an event name.','warn'); return; }
    const categories=catsRaw.split(',').map(s=>s.trim()).filter(Boolean).map(s=>({id:s.toLowerCase().replace(/\s+/g,'_'),name:s,emoji:'📦',budget:0}));
    if(!categories.length) categories.push({id:'misc',name:'General',emoji:'📦',budget:0});
    const phases=phasesRaw.split(',').map(s=>s.trim()).filter(Boolean);
    try {
      const ev=await API.createEvent({name,emoji,currency,budget,categories,phases});
      Store.upsertEvent(ev); Store.setExpenses(ev.id,[]); Store.switchEvent(ev.id);
      closeSheet(); paintApp(); toast(`"${name}" created ✓`);
    } catch(e) { toast(e.message,'warn'); }
  }

  async function deleteEvent(id) {
    const ev=Store.get().events.find(e=>e.id===id);
    if(!ev||!confirm(`Delete "${ev.name}" and all expenses? Cannot be undone.`)) return;
    try { await API.deleteEvent(id); Store.removeEvent(id); closeSheet(); paintApp(); toast('Event deleted'); }
    catch(e) { toast(e.message,'warn'); }
  }

  // ── Sharing ───────────────────────────────────────────────────
  async function sendInvite() {
    const ev=Store.activeEvent();
    const email=document.getElementById('inviteEmail')?.value.trim();
    const role=document.getElementById('inviteRole')?.value||'editor';
    if(!email) { toast('Enter an email address.','warn'); return; }
    setBtnLoading('inviteBtn', true);
    try {
      const result=await API.inviteToEvent({event_id:ev.id,email,role});
      // Copy invite link
      await navigator.clipboard.writeText(result.invite_url).catch(()=>{});
      document.getElementById('inviteResult').innerHTML=`
        <div style="background:var(--success-bg);border:1px solid var(--success-bdr);border-radius:10px;padding:12px 14px;font-size:13px;margin-top:12px">
          ✅ Invite link created and copied. Send it to ${esc(email)}.<br>
          <small style="color:var(--text-2);word-break:break-all">${esc(result.invite_url)}</small>
        </div>`;
      toast('Invite link copied to clipboard ✓');
    } catch(e) { toast(e.message,'warn'); }
    finally { setBtnLoading('inviteBtn', false); }
  }

  async function updateMemberRole(memberId, role) {
    const ev=Store.activeEvent();
    try {
      await API.updateMember(ev.id,memberId,role);
      const members=(ev.members||[]).map(m=>Number(m.id)===Number(memberId)?{...m,role}:m);
      Store.upsertEvent({...ev,members});
      toast('Member permission updated ✓');
    } catch(e) { toast(e.message,'warn'); openSheet(shareSheetHTML()); }
  }

  async function removeMember(memberId) {
    const current=Store.activeEvent();
    const name=(current.members||[]).find(m=>Number(m.id)===Number(memberId))?.name||'this member';
    if(!confirm(`Remove ${name} from this event?`)) return;
    const ev=current;
    try {
      await API.removeMember(ev.id,memberId);
      Store.upsertEvent({...ev,members:(ev.members||[]).filter(m=>Number(m.id)!==Number(memberId))});
      openSheet(shareSheetHTML()); toast('Member removed');
    } catch(e) { toast(e.message,'warn'); }
  }

  async function leaveEvent() {
    const ev=Store.activeEvent();
    if(!confirm(`Leave “${ev.name}”? You will lose access to its expenses.`)) return;
    try {
      await API.leaveEvent(ev.id);
      Store.removeEvent(ev.id); closeSheet(); paintApp(); toast('You left the event');
    } catch(e) { toast(e.message,'warn'); }
  }

  async function deleteAccount() {
    if(!confirm('Permanently delete your account and all associated data? This cannot be undone.')) return;
    const password=prompt('Enter your password to confirm account deletion:')||'';
    if(!password) return;
    try {
      await API.deleteAccount(password);
      Store.clearUser(); closeSheet(); _screen='welcome'; paint();
      toast('Your account has been deleted.');
    } catch(e) { toast(e.message,'warn'); }
  }

  async function saveAccount() {
    const name=document.getElementById('accountName')?.value.trim()||'';
    const current_password=document.getElementById('accountCurrentPass')?.value||'';
    const new_password=document.getElementById('accountNewPass')?.value||'';
    if(!name){toast('Name is required.','warn');return;}
    try {
      const user=await API.updateAccount({name,current_password,new_password});
      Store.setUser(user); closeSheet(); paintApp(); toast('Account updated ✓');
    } catch(e) { toast(e.message,'warn'); }
  }

  // ── Settings ──────────────────────────────────────────────────
  async function saveSettings() {
    const ev=Store.activeEvent();
    const name=document.getElementById('setEvName')?.value.trim()||ev.name;
    const emoji=document.getElementById('setEvEmoji')?.value.trim()||ev.emoji||'📋';
    const currency=document.getElementById('setCurrency')?.value||'₹';
    const budget=parseFloat(document.getElementById('setBudget')?.value)||0;
    try {
      await API.updateEvent(ev.id,{name,emoji,currency,budget,categories:ev.categories});
      Store.upsertEvent({...ev,name,emoji,currency,budget});
      closeSheet(); paintApp(); toast('Settings saved ✓');
    } catch(e) { toast(e.message,'warn'); }
  }

  async function addCategory() {
    const ev=Store.activeEvent();
    const name=document.getElementById('newCatName')?.value.trim();
    const emoji=document.getElementById('newCatEmoji')?.value.trim()||'📦';
    if(!name){ toast('Enter a category name.','warn'); return; }
    const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||('cat_'+Date.now());
    if((ev.categories||[]).some(c=>c.id===id||c.name.toLowerCase()===name.toLowerCase())){ toast('That category already exists.','warn'); return; }
    const cats=[...(ev.categories||[]),{id,name,emoji,budget:0}];
    try {
      await API.updateEvent(ev.id,{categories:cats});
      Store.upsertEvent({...ev,categories:cats});
      openSheet(settingsSheetHTML());  // re-render sheet with the new row
      toast(`"${name}" added ✓`);
    } catch(e) { toast(e.message,'warn'); }
  }

  function updateCatBudget(catId,val) {
    const ev=Store.activeEvent();
    const cats=(ev.categories||[]).map(c=>c.id===catId?{...c,budget:parseFloat(val)||0}:c);
    Store.upsertEvent({...ev,categories:cats});
    clearTimeout(App._catTimer);
    App._catTimer=setTimeout(()=>API.updateEvent(ev.id,{categories:cats}).catch(()=>{}),800);
  }

  // ── Export ────────────────────────────────────────────────────
  function exportCSV() {
    const ev=Store.activeEvent(),exps=Store.activeExpenses();
    const rows=[['Date','Description','Category','Amount',ev.currency,'Orig Amount','Orig Currency','Exchange Rate','Paid By','Tag','Phase','Notes']];
    exps.forEach(e=>rows.push([e.date||e.expense_date,e.description||e.desc,e.cat_name||e.catName,e.amount,ev.currency,e.orig_amount||'',e.orig_currency||'',e.exchange_rate||'',e.paid_by||e.paidBy,e.tag||'',e.phase||'',e.notes||'']));
    const csv=rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download=`${ev.name.replace(/\s+/g,'_')}_expenses.csv`; a.click();
    toast('CSV downloaded ✓');
  }

  // ── Utils ─────────────────────────────────────────────────────
  function setBtnLoading(id,loading) {
    const btn=document.getElementById(id); if(!btn) return;
    if(loading){btn._orig=btn.innerHTML;btn.innerHTML='<div class="spinner"></div>';btn.disabled=true;}
    else{btn.innerHTML=btn._orig||btn.innerHTML;btn.disabled=false;}
  }
  function toast(msg,type='ok') {
    const el=document.createElement('div');
    el.className='toast'+(type==='warn'?' warn-toast':'');
    el.textContent=msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300);},2800);
  }

  return {
    init, showScreen, login, signup, logout,
    setView, shiftMonth, jumpToMonth, onSearch, onCatFilter,
    openDrill, closeDrill, loadAnalytics,
    openAddExpense, openEditExpense, saveExpense, deleteExpense,
    openEventPicker, switchEvent, createEvent, deleteEvent,
    openSettings, saveSettings, addCategory, updateCatBudget,
    openShareSheet, sendInvite, updateMemberRole, removeMember, leaveEvent, deleteAccount, saveAccount,
    onCurrencyChange, onOrigAmountInput,
    exportCSV, closeSheet, toast, syncQueue, retryOfflineChanges,
    installApp, dismissInstall,
    verifyOtp, resendOtp, forgotPassword, resetPassword,
    obNext, obPickEvent, obSkip, obFinish,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
