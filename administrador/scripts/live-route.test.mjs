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
  } finally { delete globalThis.liveRouteTestDb; }
});
