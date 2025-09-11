import crypto from 'node:crypto';

const base = process.env.API_BASE || 'http://localhost:3001/api';

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const ct = res.headers.get('content-type') || '';
  let body;
  try {
    if (ct.includes('application/json')) body = await res.json();
    else body = await res.text();
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
}

function pretty(o) {
  try { return JSON.stringify(o, null, 2); } catch { return String(o); }
}

async function getToken() {
  let r = await jsonFetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gmail.com', password: 'admin@gmail.com' }),
  });
  if (r.ok && r.body && r.body.access_token) return r.body.access_token;

  const email = `test+${crypto.randomBytes(4).toString('hex')}@example.com`;
  r = await jsonFetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!', firstName: 'Test', lastName: 'User' }),
  });
  if (r.ok && r.body && r.body.access_token) return r.body.access_token;

  r = await jsonFetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!' }),
  });
  if (r.ok && r.body && r.body.access_token) return r.body.access_token;

  throw new Error('Unable to obtain JWT token. Check server and DB connectivity.');
}

async function createClient(token) {
  const payload = {
    name: `Client ${crypto.randomBytes(2).toString('hex')}`,
    email: `client+${crypto.randomBytes(3).toString('hex')}@example.com`,
    isActive: true,
  };
  const r = await jsonFetch(`${base}/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Create client failed: HTTP ${r.status} -> ${pretty(r.body)}`);
  return r.body;
}

async function createRecurring(token, clientId) {
  const now = new Date();
  const payload = {
    clientId,
    items: [
      { description: 'Monthly service', quantity: 1, rate: 100, unit: 'unit', taxable: true },
    ],
    taxRate: 0,
    discount: 0,
    currency: 'USD',
    dueInDays: 14,
    frequency: 'DAILY',
    interval: 1,
    startDate: now.toISOString(),
    endDate: null,
    maxOccurrences: 1,
    autoSend: true,
  };
  const r = await jsonFetch(`${base}/recurring-invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Create recurring failed: HTTP ${r.status} -> ${pretty(r.body)}`);
  return r.body;
}

async function runNow(token, recId) {
  const r = await jsonFetch(`${base}/recurring-invoices/${recId}/run-now`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Run-now failed: HTTP ${r.status} -> ${pretty(r.body)}`);
  return r.body;
}

async function main() {
  console.log(`[Start] Base URL: ${base}`);
  const token = await getToken();
  console.log('Auth: OK');

  const client = await createClient(token);
  console.log(`Client created: ${client.id} (${client.email})`);

  const rec = await createRecurring(token, client.id);
  console.log(`Recurring template created: ${rec.id}`);

  const invoice = await runNow(token, rec.id);
  console.log(`Run-now created invoice: ${invoice.id} ${invoice.invoiceNumber || ''}`);
  console.log('Success: Recurring invoice generated. Auto-send (if configured) may have been attempted.');
}

main().catch((e) => {
  console.error('[Error]', e?.message || String(e));
  if (e?.stack) console.error(e.stack);
  process.exit(1);
});
