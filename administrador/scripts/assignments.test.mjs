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
    'next/headers': 'export async function cookies(){return {get:()=>globalThis.assignCookie&&({value:globalThis.assignCookie})};}',
    '@/server/db/mongo': 'export async function getDb(){return globalThis.assignDb;} export async function getMongoClient(){return null;}',
    '@/server/cors': 'export const corsHeaders=()=>({});',
  };
  if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });

const { parseAssignment, guatemalaInstant } = await import('../lib/assignments.ts');
const collection = await import('../app/api/assignments/route.ts');
const mine = await import('../app/api/assignments/mine/route.ts');
const read = await import('../app/api/assignments/[id]/read/route.ts');
const cancel = await import('../app/api/assignments/[id]/cancel/route.ts');
const { linkAssignment, completeAssignment } = await import('../server/assignments/service.ts');
const { signToken } = await import('../server/auth/token.ts');

const same = (a, b) => (a instanceof ObjectId || b instanceof ObjectId) ? String(a) === String(b) : (a ?? null) === (b ?? null);
function matches(doc, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && !(condition instanceof ObjectId) && !(condition instanceof Date)) {
      if ('$in' in condition) return condition.$in.some(value => same(doc[key], value));
      if ('$ne' in condition) return !same(doc[key], condition.$ne);
    }
    return same(doc[key], condition);
  });
}
function sorted(rows, sort = {}) {
  return [...rows].sort((a, b) => {
    for (const [key, direction] of Object.entries(sort)) {
      const delta = (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * direction;
      if (delta) return delta;
    }
    return 0;
  });
}
function fakeCollection(rows) {
  return {
    rows,
    find(filter, options = {}) {
      const result = sorted(rows.filter(row => matches(row, filter)), options.sort)
        .slice(options.skip ?? 0, (options.skip ?? 0) + (options.limit ?? Infinity));
      return { toArray: async () => result };
    },
    async findOne(filter) { return rows.find(row => matches(row, filter)) ?? null; },
    async countDocuments(filter) { return rows.filter(row => matches(row, filter)).length; },
    async insertOne(doc) { rows.push(doc); return { insertedId: doc._id }; },
    async updateOne(filter, update) {
      const row = rows.find(item => matches(item, filter));
      if (row) Object.assign(row, update.$set);
      return { matchedCount: row ? 1 : 0 };
    },
    async findOneAndUpdate(filter, update, options = {}) {
      const row = sorted(rows.filter(item => matches(item, filter)), options.sort)[0];
      if (row) Object.assign(row, update.$set);
      return row ?? null;
    },
  };
}

const ids = {
  admin: new ObjectId(), pilotUser: new ObjectId(), otherUser: new ObjectId(),
  pilot: new ObjectId(), other: new ObjectId(), unlinked: new ObjectId(),
  truck: new ObjectId(), secondTruck: new ObjectId(), inactiveTruck: new ObjectId(),
};
function setup() {
  const tables = {
    users: [
      { _id: ids.admin, username: 'admin', nombre: 'Admin', email: 'a@example.invalid', rol: 'administrador', activo: true },
      { _id: ids.pilotUser, rol: 'conductor', activo: true, sessionVersion: 0 },
      { _id: ids.otherUser, rol: 'conductor', activo: true, sessionVersion: 0 },
    ],
    drivers: [
      { _id: ids.pilot, nombre: 'Piloto Uno', userId: ids.pilotUser, activo: true },
      { _id: ids.other, nombre: 'Piloto Dos', userId: ids.otherUser, activo: true },
      { _id: ids.unlinked, nombre: 'Sin cuenta', userId: null, activo: true },
    ],
    trucks: [
      { _id: ids.truck, placa: 'P123ABC', modelo: 'Hino', activo: true },
      { _id: ids.secondTruck, placa: 'C456DEF', modelo: 'Isuzu', activo: true },
      { _id: ids.inactiveTruck, placa: 'OLD1', modelo: 'Viejo', activo: false },
    ],
    trips: [],
    tripAssignments: [],
  };
  const collections = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, fakeCollection(rows)]));
  globalThis.assignDb = { collection: name => collections[name] ?? assert.fail(`Unexpected collection ${name}`) };
  globalThis.assignCookie = signToken({ sub: ids.admin.toHexString(), role: 'administrador', exp: Math.floor(Date.now() / 1000) + 60, ver: 0 });
  return tables;
}

/** Guatemala wall clock two days from now. */
function futureSchedule() {
  const local = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000).toISOString();
  return { fecha: local.slice(0, 10), hora: local.slice(11, 16) };
}
const valid = (overrides = {}) => ({
  truckId: ids.truck.toHexString(), driverId: ids.pilot.toHexString(),
  origen: { lat: 14.6349, lng: -90.5069, nombre: 'Bodega' }, destino: { lat: 14.5586, lng: -90.7295, nombre: 'Antigua' },
  ...futureSchedule(), nota: 'Llevar documentos', ...overrides,
});
const adminPost = (body, site = 'same-origin') => collection.POST(new Request('http://localhost/api/assignments', {
  method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': site }, body: JSON.stringify(body),
}));
const bearer = (user, driver) => `Bearer ${signToken({ sub: user.toHexString(), name: 'Piloto', role: 'conductor', driverId: driver.toHexString(), ver: 0 })}`;
const ctx = id => ({ params: Promise.resolve({ id }) });

test('validation enforces identifiers, Guatemala bounds, separation and schedule window', () => {
  const now = new Date('2026-10-23T16:00:00Z');
  const base = { ...valid(), fecha: '2026-10-24', hora: '08:00' };
  const ok = parseAssignment(base, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.programadoPara.toISOString(), '2026-10-24T14:00:00.000Z');
  for (const [change, message] of [
    [{ truckId: 'x' }, /camión/],
    [{ driverId: '' }, /piloto/],
    [{ origen: { lat: 19.4, lng: -99.1 } }, /origen/],
    [{ destino: { lat: 14.6349, lng: -90.5070 } }, /50 m/],
    [{ fecha: '2026-10-23', hora: '09:00' }, /pasaron/],
    [{ fecha: '2028-01-01' }, /un año/],
    [{ fecha: '2026-02-30' }, /fecha y hora válidas/],
    [{ nota: 'x'.repeat(501) }, /500/],
  ]) {
    const result = parseAssignment({ ...base, ...change }, now);
    assert.equal(result.ok, false);
    assert.match(result.message, message);
  }
  assert.equal(guatemalaInstant('2026-10-24', '25:00'), null);
});

test('administrator creates a pending assignment; forged fields are ignored', async () => {
  const tables = setup();
  const response = await adminPost({ ...valid(), estado: 'completada', createdBy: { id: 'forged' }, tripId: 'x' });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.estado, 'pendiente');
  assert.equal(body.truck.placa, 'P123ABC');
  assert.equal(body.driver.nombre, 'Piloto Uno');
  const [stored] = tables.tripAssignments;
  assert.deepEqual(stored.origen.coordinates, [-90.5069, 14.6349]);
  assert.equal(stored.createdBy.id, ids.admin.toHexString());
  assert.equal(stored.tripId, null);
  const list = await (await collection.GET(new Request('http://localhost/api/assignments?page=1'))).json();
  assert.equal(list.total, 1);
  assert.equal((await collection.GET(new Request('http://localhost/api/assignments?page=0'))).status, 400);
});

test('inactive trucks and pilots without an app account are rejected', async () => {
  const tables = setup();
  assert.equal((await adminPost(valid({ truckId: ids.inactiveTruck.toHexString() }))).status, 400);
  assert.equal((await adminPost(valid({ driverId: ids.unlinked.toHexString() }))).status, 400);
  tables.users[1].activo = false;
  assert.equal((await adminPost(valid())).status, 400);
  assert.equal(tables.tripAssignments.length, 0);
});

test('anonymous users, pilots and cross-site requests cannot create assignments', async () => {
  const tables = setup();
  globalThis.assignCookie = undefined;
  assert.equal((await adminPost(valid())).status, 401);
  globalThis.assignCookie = signToken({ sub: ids.pilotUser.toHexString(), role: 'conductor', driverId: ids.pilot.toHexString() });
  assert.equal((await adminPost(valid())).status, 401);
  setup();
  assert.equal((await adminPost(valid(), 'cross-site')).status, 403);
  assert.equal(tables.tripAssignments.length, 0);
});

test('pilots only see and mark their own assignments', async () => {
  const tables = setup();
  await adminPost(valid());
  await adminPost(valid({ driverId: ids.other.toHexString() }));
  const [own, foreign] = tables.tripAssignments;
  assert.equal((await mine.GET(new Request('http://localhost/api/assignments/mine'))).status, 401);
  const auth = { authorization: bearer(ids.pilotUser, ids.pilot) };
  const listed = await (await mine.GET(new Request('http://localhost/api/assignments/mine', { headers: auth }))).json();
  assert.deepEqual(listed.assignments.map(item => item.id), [own._id.toHexString()]);
  assert.equal(listed.assignments[0].entregada, false);
  assert.equal(listed.assignments[0].origen.nombre, 'Bodega');
  const foreignRead = await read.POST(new Request('http://localhost/x', { method: 'POST', headers: auth }), ctx(foreign._id.toHexString()));
  assert.equal(foreignRead.status, 404);
  assert.equal(foreign.leidaAt, null);
  const ownRead = await read.POST(new Request('http://localhost/x', { method: 'POST', headers: auth }), ctx(own._id.toHexString()));
  assert.deepEqual(await ownRead.json(), { id: own._id.toHexString(), entregada: true, leida: true });
  assert.ok(own.entregadaAt instanceof Date);
});

test('only pending assignments can be cancelled', async () => {
  const tables = setup();
  await adminPost(valid());
  const id = tables.tripAssignments[0]._id.toHexString();
  const post = () => new Request('http://localhost/x', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' } });
  assert.equal((await cancel.POST(post(), ctx(id))).status, 200);
  assert.equal(tables.tripAssignments[0].estado, 'cancelada');
  assert.equal((await cancel.POST(post(), ctx(id))).status, 409);
  assert.equal((await cancel.POST(post(), ctx(new ObjectId().toHexString()))).status, 404);
  assert.equal((await cancel.POST(post(), ctx('nope'))).status, 404);
});

test('a trip claims the oldest pending assignment of its truck once and closing completes it', async () => {
  const tables = setup();
  await adminPost(valid());
  await adminPost(valid({ truckId: ids.secondTruck.toHexString() }));
  const [sameTruck, otherTruck] = tables.tripAssignments;
  const trip = { _id: new ObjectId(), truckId: ids.truck, driverId: ids.pilot };
  tables.trips.push({ ...trip });
  const linked = await linkAssignment(trip);
  assert.equal(linked.id, sameTruck._id.toHexString());
  assert.equal(sameTruck.estado, 'en_curso');
  assert.equal(String(tables.trips[0].assignmentId), String(sameTruck._id));
  assert.equal(await linkAssignment({ ...trip, _id: new ObjectId() }), null);
  assert.equal(otherTruck.estado, 'pendiente');
  await completeAssignment(trip._id);
  assert.equal(sameTruck.estado, 'completada');
  assert.ok(sameTruck.completadaAt instanceof Date);
});
