import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });
const { routeSpeed } = await import('../server/control/route-speed.ts');
const longitude = meters => meters / 6371000 * 180 / Math.PI;
const route = [0, 100, 110, 210].map(meters => [0, longitude(meters)]);
const fixes = [0, 5, 10, 15].map(seconds => ({ precision: 2, timestamp: new Date(Date.UTC(2026, 9, 20, 12, 0, seconds)).toISOString(), qualityFlags: [] }));

test('counts consecutive segments independently and retains indices for highlighting', () => {
  const original = structuredClone({ route, fixes });
  const result = routeSpeed(route, fixes, 60);
  assert.equal(result.evaluados, 3);
  assert.equal(result.sinEvaluar, 0);
  assert.deepEqual(result.excesos.map(({ inicio, fin }) => [inicio, fin]), [[0, 1], [2, 3]]);
  assert.ok(Math.abs(result.excesos[0].velocidadKmh - 72) < 1e-8);
  assert.deepEqual({ route, fixes }, original);
  assert.equal(routeSpeed(route, fixes, 10).excesos.length, 2);
  assert.equal(routeSpeed(route, fixes, 80).excesos.length, 0);
});

test('equal limit is allowed, comparison does not round away a slight excess', () => {
  const exact = routeSpeed(route, fixes, 1).excesos[0].velocidadKmh;
  assert.equal(routeSpeed(route.slice(0, 2), fixes.slice(0, 2), exact).excesos.length, 0);
  assert.equal(routeSpeed(route.slice(0, 2), fixes.slice(0, 2), exact - 0.001).excesos.length, 1);
});

test('bad fixes exclude both adjacent segments without bridging over them', () => {
  for (const change of [{ precision: null }, { precision: 51 }, { qualityFlags: ['jump'] }, { qualityFlags: ['mocked'] }, { qualityFlags: ['stale'] }, { qualityFlags: ['out_of_order'] }]) {
    const points = structuredClone(fixes);
    points[1] = { ...points[1], ...change };
    const result = routeSpeed(route, points, 60);
    assert.equal(result.evaluados, 1);
    assert.equal(result.sinEvaluar, 2);
    assert.deepEqual(result.excesos.map(segment => segment.inicio), [2]);
  }
});

test('missing limit, empty route and missing checkpoints are not reported as evaluated', () => {
  assert.deepEqual(routeSpeed([], [], 60), { limiteKmh: 60, evaluados: 0, sinEvaluar: 0, excesos: [] });
  assert.equal(routeSpeed(route, fixes, null).sinEvaluar, 3);
  assert.equal(routeSpeed(route, [], 60).evaluados, 0);
  assert.equal(routeSpeed(route, [], 60).sinEvaluar, 3);
});

test('non-increasing dates, long gaps, invalid times and GPS jitter do not produce excesses', () => {
  for (const timestamp of [fixes[0].timestamp, 'invalid', '2026-10-20T11:59:59Z', '2026-10-20T12:00:31Z']) {
    const result = routeSpeed(route.slice(0, 2), [fixes[0], { ...fixes[1], timestamp }], 1);
    assert.equal(result.evaluados, 0);
    assert.equal(result.excesos.length, 0);
  }
  const jitter = routeSpeed([[0, 0], [0, longitude(1)]], fixes.slice(0, 2), 0.1);
  assert.equal(jitter.evaluados, 1);
  assert.equal(jitter.excesos.length, 0);
});
