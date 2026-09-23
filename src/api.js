// ── API client ────────────────────────────────────────────────────
const API = (() => {
  async function request(method, path, body) {
    const opts = {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch('/api' + path, opts);
    } catch (fetchErr) {
      // fetch() itself failed → network problem, NOT a server rejection.
      const err = new Error('Network unavailable');
      err.network = true;
      throw err;
    }
    const json = await res.json().catch(() => ({ ok: false, error: 'Server error' }));
    if (!json.ok) {
      const err = new Error(json.error || 'Request failed');
      err.status = res.status;
      throw err;
    }
    return json.data;
  }

  const get  = p     => request('GET',    p);
  const post = (p,b) => request('POST',   p, b);
  const put  = (p,b) => request('PUT',    p, b);
  const del  = (p,b) => request('DELETE', p, b);

  // Receipt upload uses FormData (not JSON)
  async function uploadReceipt(expenseId, file) {
    const fd = new FormData();
    fd.append('receipt', file);
    fd.append('expense_id', expenseId);
    let res;
    try {
      res = await fetch('/api/receipts/upload', {
        method: 'POST', credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: fd,
      });
    } catch (_) {
      const err = new Error('Network unavailable'); err.network = true; throw err;
    }
    const json = await res.json().catch(() => ({ ok: false, error: 'Upload failed' }));
    if (!json.ok) { const err = new Error(json.error || 'Upload failed'); err.status = res.status; throw err; }
    return json.data;
  }

  // Exchange rate fetch (free, no key needed)
  async function getExchangeRate(from, to) {
    if (from === to) return 1;
    const cacheKey = `fx_${from}_${to}`;
    let cached=null;
    try { cached=JSON.parse(localStorage.getItem(cacheKey) || 'null'); } catch(_) {}
    if (cached && Date.now() - cached.ts < 3600000) return cached.rate; // 1hr cache
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(from)}`);
      if (!res.ok) throw new Error('Rate service unavailable');
      const data = await res.json();
      const rate = Number(data.rates?.[to]);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Exchange rate unavailable');
      if (rate) localStorage.setItem(cacheKey, JSON.stringify({ rate, ts: Date.now() }));
      return rate;
    } catch(_) {
      if (cached?.rate && Number.isFinite(Number(cached.rate))) return Number(cached.rate);
      throw new Error('Could not fetch an exchange rate. Enter the converted amount manually.');
    }
  }

  return {
    me:             ()      => get('/auth/me'),
    login:          b       => post('/auth/login', b),
    register:       b       => post('/auth/register', b),
    verifyOtp:      b       => post('/auth/verify-otp', b),
    resendOtp:      b       => post('/auth/resend-otp', b),
    forgotPassword: b       => post('/auth/forgot-password', b),
    resetPassword:  b       => post('/auth/reset-password', b),
    logout:         ()      => post('/auth/logout'),
    getEvents:      ()      => get('/events'),
    createEvent:    b       => post('/events', b),
    updateEvent:    (id,b)  => put(`/events/${id}`, b),
    deleteEvent:    id      => del(`/events/${id}`),
    inviteToEvent:  b       => post('/events/invite', b),
    acceptInvite:   token   => get(`/events/invite?token=${encodeURIComponent(token)}`),
    updateMember:   (eventId,userId,role) => put(`/events/${eventId}/members/${userId}`, {role}),
    removeMember:   (eventId,userId) => del(`/events/${eventId}/members/${userId}`),
    leaveEvent:     eventId => post(`/events/${eventId}/leave`),
    getExpenses:    evId    => get(`/expenses?event_id=${evId}`),
    createExpense:  b       => post('/expenses', b),
    updateExpense:  (id,b)  => put(`/expenses/${id}`, b),
    deleteExpense:  id      => del(`/expenses/${id}`),
    deleteAccount:  password => del('/account', {password}),
    updateAccount:  b => put('/account', b),
    uploadReceipt,
    getAnalytics:   evId    => get(`/analytics?event_id=${evId}`),
    getExchangeRate,
  };
})();

// ── Currency helpers ──────────────────────────────────────────────
const CURRENCIES = {
  '₹': { code: 'INR', name: 'Indian Rupee',    flag: '🇮🇳' },
  '$': { code: 'USD', name: 'US Dollar',       flag: '🇺🇸' },
  '€': { code: 'EUR', name: 'Euro',            flag: '🇪🇺' },
  '฿': { code: 'THB', name: 'Thai Baht',       flag: '🇹🇭' },
  '£': { code: 'GBP', name: 'British Pound',   flag: '🇬🇧' },
  '¥': { code: 'JPY', name: 'Japanese Yen',    flag: '🇯🇵' },
  'د.إ': { code: 'AED', name: 'UAE Dirham',   flag: '🇦🇪' },
  'S$': { code: 'SGD', name: 'Singapore Dollar', flag: '🇸🇬' },
};
