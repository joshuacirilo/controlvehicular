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
    'next/headers': 'export async function cookies(){return {get:()=>undefined};}',
    '@/server/db/mongo': 'export async function getDb(){return globalThis.pauseDb;} export async function getMongoClient(){return null;}',
    '@/server/cors': 'export const corsHeaders=()=>({});',
  };
  if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });

const pause = await import('../app/api/trips/[id]/pause/route.ts');
const resume = await import('../app/api/trips/[id]/resume/route.ts');
const movement = await import('../app/api/trips/[id]/pause-movement/route.ts');
const end = await import('../app/api/trips/[id]/end/route.ts');
const active = await import('../app/api/trips/active/route.ts');
const { signToken } = await import('../server/auth/token.ts');

const same = (a, b) => (a instanceof ObjectId || b instanceof ObjectId) ? String(a) === String(b) : (a ?? null) === (b ?? null);
function matches(doc, filter) {
  return Object.entries(filter).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && !(condition instanceof ObjectId) && !(condition instanceof Date)) {
      if ('$ne' in condition) return !same(doc[key], condition.$ne);
    }
    return same(doc[key], condition);
  });
}
function fakeCollection(rows) {
  return {
    rows,
    async findOne(filter) { return rows.find(row => matches(row, filter)) ?? null; },
    async insertOne(doc) { rows.push(doc); return { insertedId: doc._id }; },
    async updateOne(filter, update) {
      const row = rows.find(item => matches(item, filter));
      if (row) Object.assign(row, update.$set);
      return { matchedCount: row ? 1 : 0 };
    },
    async findOneAndUpdate(filter, update) {
      const row = rows.find(item => matches(item, filter));
      if (row) Object.assign(row, update.$set);
      return row ?? null;
    },
  };
}

const ids = { user: new ObjectId(), pilot: new ObjectId(), otherUser: new ObjectId(), other: new ObjectId(), truck: new ObjectId(), trip: new ObjectId() };
function setup() {
  const tables = {
    users: [
      { _id: ids.user, rol: 'conductor', activo: true, sessionVersion: 0 },
      { _id: ids.otherUser, rol: 'conductor', activo: true, sessionVersion: 0 },
    ],
    drivers: [
      { _id: ids.pilot, userId: ids.user, activo: true },
      { _id: ids.other, userId: ids.otherUser, activo: true },
    ],
    trucks: [{ _id: ids.truck, placa: 'P123ABC', modelo: 'Hino', activo: true }],
    trips: [{ _id: ids.trip, driverId: ids.pilot, truckId: ids.truck, estado: 'activo', inicio: new Date(), updatedAt: new Date() }],
    tripPauses: [],
    tripAssignments: [],
    locationPings: [],
  };
  const collections = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, fakeCollection(rows)]));
  globalThis.pauseDb = { collection: name => collections[name] ?? assert.fail(`Unexpected collection ${name}`) };
  return tables;
}

const bearer = (user, driver) => `Bearer ${signToken({ sub: user.toHexString(), name: 'Piloto', role: 'conductor', driverId: driver.toHexString(), ver: 0 })}`;
const ctx = (id = ids.trip.toHexString()) => ({ params: Promise.resolve({ id }) });
const post = (body, auth = bearer(ids.user, ids.pilot)) => new Request('http://localhost/x', {
  method: 'POST',
  headers: { authorization: auth, 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('pausing and resuming are idempotent and keep a pause record', async () => {
  const tables = setup();
  const [trip] = tables.trips;
  const paused = await pause.POST(post(), ctx());
  assert.equal(paused.status, 200);
  const body = await paused.json();
  assert.equal(body.pausado, true);
  assert.match(body.pausadoDesde, /-06:00$/);
  assert.ok(trip.pausadoDesde instanceof Date);
  assert.equal((await pause.POST(post(), ctx())).status, 200);
  assert.equal(tables.tripPauses.length, 1, 'a repeated pause must not open a second record');

  const listed = await (await active.GET(new Request('http://localhost/x', { headers: { authorization: bearer(ids.user, ids.pilot) } }))).json();
  assert.equal(listed.trip.pausadoDesde, body.pausadoDesde);

  const resumed = await resume.POST(post(), ctx());
  assert.deepEqual(await resumed.json(), { tripId: ids.trip.toHexString(), pausado: false, pausadoDesde: null });
  assert.equal(trip.pausadoDesde, null);
  assert.ok(tables.tripPauses[0].fin instanceof Date);
  assert.equal((await resume.POST(post(), ctx())).status, 200);
});

test('movement while paused is recorded once and rejected when not paused', async () => {
  const tables = setup();
  const [trip] = tables.trips;
  assert.equal((await movement.POST(post({ velocidadKmh: 30 }), ctx())).status, 409);
  await pause.POST(post(), ctx());
  for (const bad of [{}, { velocidadKmh: -1 }, { velocidadKmh: 301 }, { velocidadKmh: '20' }]) {
    assert.equal((await movement.POST(post(bad), ctx())).status, 400);
  }
  assert.equal((await movement.POST(post({ velocidadKmh: 23.456 }), ctx())).status, 200);
  const first = trip.pausaMovimientoAt;
  assert.ok(first instanceof Date);
  assert.equal(tables.tripPauses[0].velocidadKmh, 23.5);
  await movement.POST(post({ velocidadKmh: 80 }), ctx());
  assert.equal(trip.pausaMovimientoAt, first);
  assert.equal(tables.tripPauses[0].velocidadKmh, 23.5);
  await resume.POST(post(), ctx());
  assert.equal(trip.pausaMovimientoAt, null);
});

test('only the trip owner can pause it, and finished trips cannot be paused', async () => {
  const tables = setup();
  const [trip] = tables.trips;
  assert.equal((await pause.POST(post(undefined, ''), ctx())).status, 401);
  assert.equal((await pause.POST(post(undefined, bearer(ids.otherUser, ids.other)), ctx())).status, 404);
  assert.equal((await pause.POST(post(), ctx('nope'))).status, 404);
  assert.equal(trip.pausadoDesde, undefined);
  trip.estado = 'finalizado';
  assert.equal((await pause.POST(post(), ctx())).status, 409);
  assert.equal((await resume.POST(post(), ctx())).status, 409);
  assert.equal(tables.tripPauses.length, 0);
});

test('ending a paused trip closes the pause', async () => {
  const tables = setup();
  const [trip] = tables.trips;
  await pause.POST(post(), ctx());
  assert.equal((await end.POST(post(), ctx())).status, 200);
  assert.equal(trip.estado, 'finalizado');
  assert.equal(trip.pausadoDesde, null);
  assert.equal(tables.tripPauses[0].fin, trip.fin);
});
