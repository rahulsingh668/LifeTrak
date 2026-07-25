// ── API client ────────────────────────────────────────────────────
// All requests go to /api/* — same origin, cookie auth.

const API = (() => {
  async function request(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    const json = await res.json().catch(() => ({ ok: false, error: 'Server error' }));
    if (!json.ok) throw new Error(json.error || 'Request failed');
    return json.data;
  }

  const get    = (path)        => request('GET',    path);
  const post   = (path, body)  => request('POST',   path, body);
  const put    = (path, body)  => request('PUT',    path, body);
  const del    = (path)        => request('DELETE', path);

  return {
    // Auth
    me:       ()     => get('/auth/me'),
    login:    (b)    => post('/auth/login', b),
    register: (b)    => post('/auth/register', b),
    logout:   ()     => post('/auth/logout'),

    // Events
    getEvents:    ()      => get('/events'),
    createEvent:  (b)     => post('/events', b),
    updateEvent:  (id, b) => put(`/events/${id}`, b),
    deleteEvent:  (id)    => del(`/events/${id}`),

    // Expenses
    getExpenses:    (eventId) => get(`/expenses?event_id=${eventId}`),
    createExpense:  (b)       => post('/expenses', b),
    updateExpense:  (id, b)   => put(`/expenses/${id}`, b),
    deleteExpense:  (id)      => del(`/expenses/${id}`),
  };
})();
