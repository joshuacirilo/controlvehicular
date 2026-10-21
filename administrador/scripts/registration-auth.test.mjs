import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';
import { ObjectId } from 'mongodb';

process.env.AUTH_SECRET = randomBytes(32).toString('hex');
const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const stubs = {
      'server-only': 'export {};',
      'next/headers': 'export async function cookies(){return {get:()=>({value:globalThis.testAdminToken})};}',
      '@/server/db/mongo': 'export async function getDb(){return globalThis.authTestDb;}',
      '@/server/cors': 'export const corsHeaders=()=>({});',
      '@/server/accounts/register': 'export async function registerAccount(input){globalThis.registrationCalls++;return {ok:true,status:201,body:{id:"test",label:input.placa}};}',
    };
    if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    return next(specifier, context);
  },
});
const { POST } = await import('../app/api/accounts/route.ts');
const { signToken } = await import('../server/auth/token.ts');
const id = new ObjectId();
function setup(role = 'administrador', active = true) {
  globalThis.registrationCalls = 0;
  globalThis.testAdminToken = role && signToken({ sub: id.toHexString(), role, exp: Math.floor(Date.now() / 1000) + 60 });
  globalThis.authTestDb = { collection: () => ({ async findOne(filter) {
    assert.equal(filter.rol, 'administrador');
    assert.equal(filter.activo, true);
    return active ? { _id: id, email: 'test@example.invalid', username: 'test' } : null;
  } }) };
}
const request = (origin = 'same-origin') => new Request('http://localhost/api/accounts', {
  method: 'POST', headers: { 'sec-fetch-site': origin, 'content-type': 'application/json' },
  body: JSON.stringify({ kind: 'truck', placa: 'TEST' }),
});
test('missing session, pilot token and disabled admin cannot register', async () => {
  for (const [role, active] of [[null, true], ['conductor', true], ['administrador', false]]) {
    setup(role, active);
    assert.equal((await POST(request())).status, 401);
    assert.equal(globalThis.registrationCalls, 0);
  }
});
test('cross-origin creation is blocked before persistence', async () => {
  setup();
  assert.equal((await POST(request('cross-site'))).status, 403);
  assert.equal(globalThis.registrationCalls, 0);
});
test('active administrator reaches the creation service with no-store response', async () => {
  setup();
  const response = await POST(request());
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(globalThis.registrationCalls, 1);
});
