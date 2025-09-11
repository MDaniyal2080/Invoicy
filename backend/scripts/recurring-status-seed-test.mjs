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
  // Try admin credentials from seed
  let r = await jsonFetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@gmail.com', password: 'admin@gmail.com' }),
  });
  if (r.ok && r.body && r.body.access_token) return r.body.access_token;

  // Fallback: register a test user
  const email = `test+${crypto.randomBytes(4).toString('hex')}@example.com`;
  r = await jsonFetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'Test1234!',
      firstName: 'Test',
      lastName: 'User',
    }),
  });
  if (r.ok && r.body && r.body.access_token) return r.body.access_token;

  // Try login after register in case register returns user only
  r = await jsonFetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test1234!' }),
  });
  if (r.ok && r.body && r.body.access_token) return r.body.access_token;

  throw new Error('Unable to obtain JWT token.');
}

async function ensureClient(token) {
  const unique = Date.now();
  const payload = {
    name: `Seed Client ${unique}`,
    email: `client+${unique}@example.com`,
    phone: '555-0000',
    addressLine1: '123 Test St',
    city: 'Testville',
    country: 'US',
  };
  const r = await jsonFetch(`${base}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    throw new Error(`Failed creating client: ${pretty(r.body)}`);
  }
  return r.body;
}

function dtPlus(mins = 0) { const d = new Date(); d.setMinutes(d.getMinutes() + mins); return d; }

async function createRecurring(token, clientId) {
  const payload = {
    clientId,
    items: [
      { description: 'Service A', quantity: 1, rate: 100 },
    ],
    frequency: 'MONTHLY',
    interval: 1,
    startDate: dtPlus(-1),
    taxRate: 0,
    discount: 0,
    currency: 'USD',
    autoSend: false,
  };
  const r = await jsonFetch(`${base}/recurring-invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload, (k, v) => (v instanceof Date ? v.toISOString() : v)),
  });
  if (!r.ok) throw new Error(`Failed creating recurring invoice: ${pretty(r.body)}`);
  return r.body;
}

async function setStatus(token, id, action) {
  const r = await jsonFetch(`${base}/recurring-invoices/${id}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Failed to ${action} recurring invoice ${id}: ${pretty(r.body)}`);
  return r.body;
}

async function countFor(token, qs) {
  const r = await jsonFetch(`${base}/recurring-invoices${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Query ${qs} failed: ${pretty(r.body)}`);
  const b = r.body;
  if (Array.isArray(b?.items)) return b.items.length;
  return 0;
}

async function main() {
  console.log(`[Start] Base URL: ${base}`);
  const token = await getToken();
  console.log('Auth: OK (token acquired)');

  const client = await ensureClient(token);
  console.log(`Client created: ${client.id}`);

  const active = await createRecurring(token, client.id);
  const paused = await createRecurring(token, client.id);
  const cancelled = await createRecurring(token, client.id);

  await setStatus(token, paused.id, 'pause');
  await setStatus(token, cancelled.id, 'cancel');
  console.log(`Created recurring: ACTIVE=${active.id}, PAUSED=${paused.id}, CANCELLED=${cancelled.id}`);

  const allCount = await countFor(token, '');
  const activeCount = await countFor(token, 'status=ACTIVE');
  const pausedCount = await countFor(token, 'status=PAUSED');
  const cancelledCount = await countFor(token, 'status=CANCELLED');

  console.log('Counts:');
  console.log(`  all         = ${allCount}`);
  console.log(`  ACTIVE      = ${activeCount}`);
  console.log(`  PAUSED      = ${pausedCount}`);
  console.log(`  CANCELLED   = ${cancelledCount}`);

  // Negative test
  const neg = await jsonFetch(`${base}/recurring-invoices?status=INVALID`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('Negative (INVALID) ->', neg.status);
}

main().catch((e) => { console.error(e); process.exit(1); });
