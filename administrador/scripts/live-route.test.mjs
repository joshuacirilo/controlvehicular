import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { ObjectId } from 'mongodb';
const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
  if (specifier === '@/server/db/mongo') return { url: 'data:text/javascript,export async function getDb(){return globalThis.liveRouteTestDb}', shortCircuit: true };
  if (specifier === '@/server/control/speed') return { url: 'data:text/javascript,export async function getSpeedControl(){return {velocidadPromedio:100}}', shortCircuit: true };
  return specifier.startsWith('@/') ? next(new URL(`${specifier.slice(2)}.ts`, root).href, context) : next(specifier, context);
} });
const { liveTrucks } = await import('../server/trucks/live.ts');

test('only loads the selected active trip route and replaces raw speed with the latest valid pair', async () => {
  const id = new ObjectId();
  const older = { coords: { coordinates: [-90, 14] }, precision: 5, timestamp: new Date('2026-10-21T12:00:00Z') };
  const latest = { ...older, timestamp: new Date('2026-10-21T12:00:05Z'), velocidad: 688.6 };
  let routeReads = 0;
  globalThis.liveRouteTestDb = { collection(name) {
    if (name === 'trips') return { aggregate(pipeline) {
      assert.deepEqual(pipeline[0], { $match: { estado: 'activo' } });
      const lookup = pipeline.find(stage => stage.$lookup?.from === 'locationPings').$lookup;
      assert.equal(lookup.pipeline.find(stage => stage.$limit).$limit, 2);
      return { toArray: async () => [{ _id: id, truckId: new ObjectId(), inicio: older.timestamp,
        truck: { placa: 'TEST' }, driver: { nombre: 'Test' }, ping: latest, recent: [latest, older] }] };
    } };
    assert.equal(name, 'locationPings');
    return { find(filter) {
      routeReads++;
      assert.equal(filter.tripId.toHexString(), id.toHexString());
      return { sort(order) { assert.deepEqual(order, { timestamp: 1, _id: 1 }); return { toArray: async () => [older, latest] }; } };
    } };
  } };
  try {
    assert.equal((await liveTrucks()).body.route, null);
    assert.equal((await liveTrucks(new ObjectId().toHexString())).body.route, null);
    assert.equal(routeReads, 0);
    const response = (await liveTrucks(id.toHexString())).body;
    assert.equal(response.limiteKmh, 100);
    assert.equal(response.trucks[0].ubicacion.velocidad, 0);
    assert.equal(response.route.tripId, id.toHexString());
    assert.deepEqual(response.route.ruta, [[14, -90], [14, -90]]);
    assert.equal(routeReads, 1);
    assert.deepEqual(response.sosRoutes, []);
    assert.equal(response.trucks[0].sos, null);
  } finally { delete globalThis.liveRouteTestDb; }
});

test('trips with an open SOS always include their full route, read once even when selected', async () => {
  const sosTrip = new ObjectId(), calm = new ObjectId();
  const ping = seconds => ({ coords: { coordinates: [-90 + seconds / 1000, 14] }, precision: 5, timestamp: new Date(Date.UTC(2026, 9, 21, 12, 0, seconds)) });
  const reads = [];
  globalThis.liveRouteTestDb = { collection(name) {
    if (name === 'trips') return { aggregate(pipeline) {
      const lookup = pipeline.find(stage => stage.$lookup?.from === 'notificationIncidents').$lookup;
      assert.equal(lookup.localField, 'sosId');
      assert.deepEqual(lookup.pipeline[0], { $match: { acknowledgedAt: { $exists: false } } });
      return { toArray: async () => [
        { _id: sosTrip, truckId: new ObjectId(), inicio: ping(0).timestamp, truck: { placa: 'SOS1' }, driver: { nombre: 'A' },
          ping: ping(10), recent: [ping(10), ping(5)], sos: { _id: 'incident-1', createdAt: new Date('2026-10-21T18:00:00Z') } },
        { _id: calm, truckId: new ObjectId(), inicio: ping(0).timestamp, truck: { placa: 'OK1' }, driver: { nombre: 'B' },
          ping: ping(10), recent: [ping(10), ping(5)] },
      ] };
    } };
    return { find(filter) {
      reads.push(filter.tripId.toHexString());
      return { sort: () => ({ toArray: async () => [ping(0), ping(5), ping(10)] }) };
    } };
  } };
  try {
    const body = (await liveTrucks()).body;
    assert.deepEqual(body.trucks.map(truck => truck.sos), [null, { id: 'incident-1', desde: '2026-10-21T18:00:00.000Z' }]);
    assert.equal(body.route, null);
    assert.deepEqual(body.sosRoutes.map(route => [route.tripId, route.ruta.length]), [[sosTrip.toHexString(), 3]]);
    assert.deepEqual(reads, [sosTrip.toHexString()]);
    reads.length = 0;
    const selected = (await liveTrucks(sosTrip.toHexString())).body;
    assert.equal(selected.route.tripId, sosTrip.toHexString());
    assert.deepEqual(reads, [sosTrip.toHexString()]);
  } finally { delete globalThis.liveRouteTestDb; }
});
