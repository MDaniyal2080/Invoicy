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

  throw new Error('Unable to obtain JWT token. Check server and DB connectivity.');
}

async function testGet(label, path, token) {
  const url = `${base}${path}`;
  const r = await jsonFetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`\n${label}`);
  console.log(`GET ${path} -> HTTP ${r.status}`);
  if (r.ok) {
    // Print a compact summary: either array length or paginated items length
    const b = r.body;
    if (Array.isArray(b)) console.log(`Result: array(${b.length})`);
    else if (b && typeof b === 'object' && Array.isArray(b.items)) console.log(`Result: paginated(items=${b.items.length}, total=${b.total})`);
    else console.log(`Result: ${pretty(b)}`);
  } else {
    console.log(pretty(r.body));
  }
}

async function main() {
  console.log(`[Start] Base URL: ${base}`);
  let token;
  try {
    token = await getToken();
    console.log('Auth: OK (token acquired)');
  } catch (e) {
    console.error('Auth: FAILED');
    console.error(String(e));
    process.exit(1);
  }

  await testGet('[1/5] /recurring-invoices (no status)', '/recurring-invoices', token);
  await testGet('[2/5] /recurring-invoices?status=ACTIVE', '/recurring-invoices?status=ACTIVE', token);
  await testGet('[3/5] /recurring-invoices?status=PAUSED', '/recurring-invoices?status=PAUSED', token);
  await testGet('[4/5] /recurring-invoices?status=CANCELLED', '/recurring-invoices?status=CANCELLED', token);

  console.log('\n[5/5 NEGATIVE] /recurring-invoices?status=INVALID (expect 400)');
  const neg = await jsonFetch(`${base}/recurring-invoices?status=INVALID`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`HTTP ${neg.status}`);
  if (neg.ok) console.log('Unexpected success:', pretty(neg.body));
  else console.log(pretty(neg.body));

  console.log('\n[Done]');
}

main().catch((e) => { console.error(e); process.exit(1); });
