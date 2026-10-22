import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { registerHooks } from 'node:module';
import { ObjectId } from 'mongodb';

process.env.AUTH_SECRET = randomBytes(32).toString('hex');
const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  const stubs = {
    'server-only': 'export {};',
    'next/headers': 'export async function cookies(){return {get:()=>({value:globalThis.controlToken})};}',
    '@/server/db/mongo': 'export async function getDb(){return globalThis.controlDb;} export async function getMongoClient(){return globalThis.controlClient;}',
    '@/server/cors': 'export const corsHeaders=()=>({});',
  };
  if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });
const { GET, PUT } = await import('../app/api/control/route.ts');
const { signToken } = await import('../server/auth/token.ts');
const firstId = new ObjectId();
const secondId = new ObjectId();
function setup({ failAudit = false } = {}) {
  const state = { records: [], ended: false, active: true, user: firstId };
  const session = {
    async withTransaction(action) {
      const previous = structuredClone(state.records);
      try { return await action(); } catch (error) { state.records = previous; throw error; }
    },
    async endSession() { state.ended = true; },
  };
  globalThis.controlClient = { startSession: () => session };
  globalThis.controlDb = { collection(name) {
    if (name === 'users') return { async findOne(filter) {
      assert.equal(filter.rol, 'administrador');
      assert.equal(filter.activo, true);
      return state.active ? { _id: state.user, username: state.user.toHexString(), nombre: 'Administrador', email: 'test@example.invalid' } : null;
    } };
    assert.equal(name, 'speedControls');
    return {
      async findOne(filter) { return state.records.find(row => row._id === filter._id) ?? null; },
      async replaceOne(filter, record, options) {
        assert.equal(options.session, session);
        state.records = state.records.filter(row => row._id !== filter._id);
        state.records.push(record);
      },
      async insertOne(record, options) {
        assert.equal(options.session, session);
        if (failAudit) throw new Error('Simulated audit failure');
        state.records.push(record);
      },
    };
  } };
  state.login = (id = firstId, role = 'administrador') => {
    state.user = id;
    globalThis.controlToken = signToken({ sub: id.toHexString(), role, exp: Math.floor(Date.now() / 1000) + 60 });
  };
  state.login();
  return state;
}
function request(speed, site = 'same-origin') {
  return new Request('http://localhost/api/control', { method: 'PUT',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': site },
    body: JSON.stringify({ velocidadPromedio: speed, modificadoPor: { id: 'forged' }, velocidadAnterior: 999 }),
  });
}
const getRequest = () => new Request('http://localhost/api/control');

test('first save and later edit preserve values and authenticated authors in immutable history', async () => {
  const state = setup();
  assert.equal(await (await GET(getRequest())).json(), null);
  const first = await PUT(request(100));
  assert.equal(first.status, 200);
  const saved = await first.json();
  assert.equal(saved.velocidadAnterior, null);
  assert.equal(saved.autorAnterior, null);
  assert.equal(saved.modificadoPor.id, firstId.toHexString());
  assert.ok(Number.isFinite(Date.parse(saved.fechaModificacion)));
  state.login(secondId);
  const second = await PUT(request(85.5));
  assert.equal(second.status, 200);
  const changed = await second.json();
  assert.equal(changed.velocidadAnterior, 100);
  assert.equal(changed.autorAnterior.id, firstId.toHexString());
  assert.equal(changed.modificadoPor.id, secondId.toHexString());
  assert.equal(state.records.filter(row => row.tipo === 'cambio').length, 2);
  assert.equal(state.records.find(row => row.tipo === 'cambio').velocidadPromedio, 100);
  const read = await GET(getRequest());
  assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal((await read.json()).velocidadPromedio, 85.5);
  assert.equal(state.ended, true);
});

test('invalid speeds cannot write records', async () => {
  const state = setup();
  for (const speed of [null, '', '100', 0, -1, 301, 10.55, 1e-12, true]) {
    assert.equal((await PUT(request(speed))).status, 400);
  }
  assert.equal(state.records.length, 0);
});

test('anonymous users, pilots, disabled admins and cross-site writes are blocked', async () => {
  const state = setup();
  globalThis.controlToken = undefined;
  assert.equal((await PUT(request(100))).status, 401);
  assert.equal((await GET(getRequest())).status, 401);
  state.login(firstId, 'conductor');
  assert.equal((await PUT(request(100))).status, 401);
  state.login();
  state.active = false;
  assert.equal((await PUT(request(100))).status, 401);
  state.active = true;
  assert.equal((await PUT(request(100, 'cross-site'))).status, 403);
  assert.equal(state.records.length, 0);
});

test('audit failure rolls back the current value and ends the transaction session', async () => {
  const state = setup({ failAudit: true });
  assert.equal((await PUT(request(100))).status, 503);
  assert.equal(state.records.length, 0);
  assert.equal(state.ended, true);
});
