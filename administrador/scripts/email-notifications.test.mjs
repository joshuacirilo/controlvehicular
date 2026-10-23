import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';

process.env.AUTH_SECRET = randomBytes(32).toString('hex');
const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  const stubs = {
    'server-only': 'export {};',
    'next/headers': 'export async function cookies(){return {get:()=>({value:globalThis.mailToken})};}',
    '@/server/db/mongo': 'export async function getDb(){return globalThis.mailDb;}',
  };
  if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });
const settingsRoute = await import('../app/api/settings/email/route.ts');
const verificationRoute = await import('../app/api/settings/email/verification/route.ts');
const verifyRoute = await import('../app/api/settings/email/verify/route.ts');
const testRoute = await import('../app/api/notifications/test/route.ts');
const sendRoute = await import('../app/api/notifications/send/route.ts');
const { signToken } = await import('../server/auth/token.ts');
const { reserveEmailSend } = await import('../server/notifications/repository.ts');
const { sendReportNotification } = await import('../server/notifications/service.ts');

// A minimal Mongo boundary fake; no network or real Atlas writes in these tests.
const field = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
const equal = (a, b) => a?.toHexString ? a.toHexString() === b?.toHexString?.() : a instanceof Date ? +a === +b : a === b;
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === '$or') return expected.some(item => matches(row, item));
    const actual = field(row, key);
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !expected.toHexString) {
      return Object.entries(expected).every(([op, value]) => op === '$lt' ? actual < value : op === '$lte' ? actual <= value : op === '$gt' ? actual > value : op === '$ne' ? !equal(actual, value) : false);
    }
    return equal(actual, expected);
  });
}
function setField(row, path, value, remove = false) {
  const parts = path.split('.'); let parent = row;
  for (const part of parts.slice(0, -1)) parent = parent[part] ??= {};
  if (remove) delete parent[parts.at(-1)]; else parent[parts.at(-1)] = value;
}
function expression(value, row) {
  if (typeof value === 'string' && value.startsWith('$')) return field(row, value.slice(1));
  if (!value || value instanceof Date || typeof value !== 'object') return value;
  if (value.$cond) return expression(value.$cond[0], row) ? expression(value.$cond[1], row) : expression(value.$cond[2], row);
  if (value.$eq) return equal(expression(value.$eq[0], row), expression(value.$eq[1], row));
  if (value.$add) return value.$add.reduce((total, item) => total + expression(item, row), 0);
  return value;
}
function update(row, change) {
  if (Array.isArray(change)) {
    for (const stage of change) {
      const old = structuredClone(row);
      for (const [key, value] of Object.entries(stage.$set)) setField(row, key, expression(value, old));
    }
  } else {
    for (const [key, value] of Object.entries(change.$set ?? {})) setField(row, key, value);
    for (const [key, value] of Object.entries(change.$inc ?? {})) setField(row, key, (field(row, key) ?? 0) + value);
    for (const key of Object.keys(change.$unset ?? {})) setField(row, key, null, true);
  }
}
let state;
const originalFetch = globalThis.fetch;
const originalInfo = console.info, originalWarn = console.warn;
const adminId = new ObjectId();
const jsonRequest = (method, body = {}, site = 'same-origin') => new Request('http://localhost/api/settings/email', {
  method, headers: { 'content-type': 'application/json', 'sec-fetch-site': site }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
});
const login = (role = 'administrador') => { globalThis.mailToken = signToken({ sub: adminId.toHexString(), role, exp: Math.floor(Date.now() / 1000) + 60 }); };
beforeEach(() => {
  for (const name of ['SERVICE_ID', 'NOTIFICATION_TEMPLATE_ID', 'EMERGENCY_TEMPLATE_ID', 'PUBLIC_KEY', 'PRIVATE_KEY']) process.env[`EMAILJS_${name}`] = `fake-${name}`;
  state = { tables: {}, active: true, calls: [], logs: [], providerStatus: 200, networkError: false };
  console.info = console.warn = (...args) => state.logs.push(args);
  globalThis.mailDb = { collection(name) {
    if (name === 'users') return { async findOne(filter) {
      assert.equal(filter.rol, 'administrador'); assert.equal(filter.activo, true);
      return state.active ? { _id: adminId, email: 'admin@example.invalid', nombre: 'Admin', username: 'admin' } : null;
    } };
    const rows = state.tables[name] ??= [];
    return {
      async findOne(filter) { const row = rows.find(item => matches(item, filter)); return row ? structuredClone(row) : null; },
      async insertOne(row) {
        if (row._id && rows.some(item => item._id === row._id)) throw Object.assign(new Error('Duplicate'), { code: 11000 });
        rows.push(structuredClone(row)); return { acknowledged: true };
      },
      async replaceOne(filter, row) {
        const index = rows.findIndex(item => matches(item, filter));
        if (index < 0) return { matchedCount: 0 };
        rows[index] = structuredClone(row); return { matchedCount: 1 };
      },
      async updateOne(filter, change, options) {
        let row = rows.find(item => matches(item, filter));
        if (!row && options?.upsert) { row = { ...filter, ...structuredClone(change.$setOnInsert) }; rows.push(row); }
        if (!row) return { matchedCount: 0 };
        update(row, change); return { matchedCount: 1 };
      },
      async findOneAndUpdate(filter, change) {
        const row = rows.find(item => matches(item, filter));
        if (!row) return null;
        update(row, change); return structuredClone(row);
      },
    };
  } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.emailjs.com/api/v1.0/email/send');
    assert.equal(options.redirect, 'error');
    const body = JSON.parse(options.body); state.calls.push(body);
    if (state.networkError) throw new Error('fake-PRIVATE_KEY must never be logged');
    return new Response(state.providerStatus === 200 ? 'OK' : 'fake-PRIVATE_KEY provider detail', { status: state.providerStatus });
  };
  login();
});
afterEach(() => { globalThis.fetch = originalFetch; console.info = originalInfo; console.warn = originalWarn; });
const save = async (email = 'reports@example.invalid', enabled = true, revision = null) => {
  const response = await settingsRoute.PUT(jsonRequest('PUT', { email, enabled, revision }));
  assert.equal(response.status, 200); return response.json();
};
const resetCooldown = () => { for (const gate of [...(state.tables.notificationSendLimits ?? []), ...(state.tables.notificationGates ?? [])]) gate.nextAt = new Date(0); };
async function verified() {
  const saved = await save();
  const sent = await verificationRoute.POST(jsonRequest('POST', { revision: saved.revision }));
  assert.equal(sent.status, 200);
  const code = state.calls.at(-1).template_params.message.match(/\b\d{6}\b/)[0];
  const response = await verifyRoute.POST(jsonRequest('POST', { revision: saved.revision, code }));
  assert.equal(response.status, 200); resetCooldown(); return response.json();
}

test('validates addresses, persists settings across module reload and detects conflicting saves', async () => {
  for (const email of ['a@b', 'x@y.com,z@y.com', 'a\r\n@b.com', '.a@b.com', 'a..b@b.com']) {
    assert.equal((await settingsRoute.PUT(jsonRequest('PUT', { email, enabled: true, revision: null }))).status, 400);
  }
  const saved = await save('reports@EXAMPLE.invalid');
  assert.equal(saved.email, 'reports@example.invalid');
  assert.equal(saved.updatedBy.id, adminId.toHexString());
  const reloaded = await import('../server/notifications/service.ts?reload');
  assert.equal((await reloaded.getEmailSettings()).settings.email, saved.email);
  assert.equal((await settingsRoute.PUT(jsonRequest('PUT', { email: 'new@example.invalid', enabled: false, revision: null }))).status, 409);
  const changed = await save('new@example.invalid', false, saved.revision);
  assert.equal(changed.enabled, false);
  assert.equal(changed.verifiedAt, null);
});

test('verification uses a code without exposing it, caps guesses and expires codes', async () => {
  const saved = await save();
  assert.equal((await testRoute.POST(jsonRequest('POST', { revision: saved.revision }))).status, 409);
  const sent = await verificationRoute.POST(jsonRequest('POST', { revision: saved.revision }));
  const code = state.calls[0].template_params.message.match(/\b\d{6}\b/)[0];
  const text = await (await settingsRoute.GET(jsonRequest('GET'))).text();
  assert.equal(text.includes('verification'), false); assert.equal(text.includes(code), false);
  assert.equal((await sent.text()).includes(code), false);
  for (let i = 0; i < 5; i++) assert.equal((await verifyRoute.POST(jsonRequest('POST', { code: code === '000000' ? '111111' : '000000', revision: saved.revision }))).status, 400);
  assert.equal((await verifyRoute.POST(jsonRequest('POST', { code, revision: saved.revision }))).status, 400);
  resetCooldown();
  await verificationRoute.POST(jsonRequest('POST', { revision: saved.revision }));
  const newCode = state.calls.at(-1).template_params.message.match(/\b\d{6}\b/)[0];
  state.tables.notificationSettings[0].verification.expiresAt = new Date(0);
  assert.equal((await verifyRoute.POST(jsonRequest('POST', { code: newCode, revision: saved.revision }))).status, 400);
});

test('test/report mail uses only verified saved recipient and remains disabled when switched off', async () => {
  const saved = await verified();
  const result = await testRoute.POST(jsonRequest('POST', { revision: saved.revision }));
  assert.equal(result.status, 200);
  const payload = state.calls.at(-1);
  assert.equal(payload.template_params.to_email, saved.email);
  assert.equal(payload.accessToken, 'fake-PRIVATE_KEY');
  assert.equal((await result.text()).includes('fake-PRIVATE_KEY'), false);
  assert.equal(state.tables.notificationDeliveries.at(-1).status, 'accepted');
  assert.equal(JSON.stringify(state.tables.notificationDeliveries).includes(saved.email), false);
  resetCooldown();
  assert.equal((await sendRoute.POST(jsonRequest('POST', { revision: saved.revision, reportType: 'notification-status' }))).status, 200);
  const changed = await save(saved.email, false, saved.revision);
  const count = state.calls.length;
  assert.equal((await testRoute.POST(jsonRequest('POST', { revision: changed.revision }))).status, 409);
  await assert.rejects(sendReportNotification({ subject: 'Report', message: 'Test', reportType: 'test' }), error => error.status === 409);
  assert.equal(state.calls.length, count);
  const other = await save('other@example.invalid', true, changed.revision);
  assert.equal(other.verifiedAt, null);
  assert.equal((await testRoute.POST(jsonRequest('POST', { revision: other.revision }))).status, 409);
});

test('rate limit is atomic, global and survives service calls; daily cap resets next UTC day', async () => {
  const at = new Date('2026-10-23T10:00:00Z');
  const attempts = await Promise.allSettled(Array.from({ length: 8 }, () => reserveEmailSend(at)));
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  for (let i = 1; i < 20; i++) await reserveEmailSend(new Date(+at + i * 60000));
  await assert.rejects(reserveEmailSend(new Date(+at + 20 * 60000)), error => error.status === 429);
  await reserveEmailSend(new Date('2026-10-24T00:00:00Z'));
  assert.equal(state.tables.notificationSendLimits[0].count, 1);
});

test('all administrative endpoints reject anonymous, pilot, disabled admin and cross-site mutations', async () => {
  const actions = [[settingsRoute.GET, 'GET'], [settingsRoute.PUT, 'PUT'], [verificationRoute.POST, 'POST'], [verifyRoute.POST, 'POST'], [testRoute.POST, 'POST'], [sendRoute.POST, 'POST']];
  for (const mode of ['anonymous', 'pilot', 'inactive']) {
    state.active = mode !== 'inactive'; login(mode === 'pilot' ? 'conductor' : 'administrador');
    if (mode === 'anonymous') globalThis.mailToken = undefined;
    for (const [handler, method] of actions) assert.equal((await handler(jsonRequest(method))).status, 401);
  }
  state.active = true; login();
  for (const [handler, method] of actions.filter(([, method]) => method !== 'GET')) assert.equal((await handler(jsonRequest(method, {}, 'cross-site'))).status, 403);
  assert.equal(state.calls.length, 0);
  const read = await settingsRoute.GET(jsonRequest('GET'));
  assert.equal(read.headers.get('cache-control'), 'no-store');
});

test('provider failures are sanitized and recorded without revealing response content', async () => {
  const saved = await verified();
  for (const status of [400, 429, 500]) {
    resetCooldown(); state.providerStatus = status;
    const response = await testRoute.POST(jsonRequest('POST', { revision: saved.revision }));
    assert.equal(response.status, status === 429 ? 429 : 502);
    assert.equal((await response.text()).includes('fake-PRIVATE_KEY'), false);
    assert.equal(state.tables.notificationDeliveries.at(-1).status, 'unconfirmed');
  }
  resetCooldown(); state.networkError = true;
  assert.equal((await testRoute.POST(jsonRequest('POST', { revision: saved.revision }))).status, 502);
  assert.equal(JSON.stringify(state.logs).includes('fake-PRIVATE_KEY'), false);
  resetCooldown(); delete process.env.EMAILJS_PRIVATE_KEY;
  const count = state.calls.length;
  assert.equal((await testRoute.POST(jsonRequest('POST', { revision: saved.revision }))).status, 503);
  assert.equal(state.calls.length, count);
});

test('rejects arbitrary recipients/content and oversized bodies before sending', async () => {
  const saved = await verified();
  const count = state.calls.length;
  assert.equal((await testRoute.POST(jsonRequest('POST', { revision: saved.revision, to_email: 'attacker@example.invalid' }))).status, 400);
  assert.equal((await sendRoute.POST(jsonRequest('POST', { revision: saved.revision, reportType: 'notification-status', message: 'arbitrary' }))).status, 400);
  assert.equal((await sendRoute.POST(jsonRequest('POST', { revision: saved.revision, reportType: 'unknown' }))).status, 400);
  assert.equal((await settingsRoute.PUT(jsonRequest('PUT', { email: 'a'.repeat(3000) }))).status, 413);
  assert.equal(state.calls.length, count);
});
