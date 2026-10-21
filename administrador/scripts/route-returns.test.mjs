import assert from 'node:assert/strict';
import test from 'node:test';
import { returnSections } from '../lib/route-returns.ts';

const point = (x, y = 0) => [y / 111_320, x / 111_320];
const detect = (points, reliable = points.slice(1).map(() => true)) => returnSections(points, reliable);

test('marks only the later reverse traversal and preserves input', () => {
  const route = [point(0), point(100), point(200), point(100), point(0)];
  const original = structuredClone(route);
  assert.deepEqual(detect(route), [[route[2], route[3], route[4]]]);
  assert.deepEqual(route, original);
});
test('matches reverse travel with different sampling and small GPS offsets', () => {
  const route = [point(0), point(100), point(200), point(160, 5), point(80, 5), point(0, 5)];
  assert.deepEqual(detect(route), [[route[2], route[3], route[4], route[5]]]);
});
test('does not mark a perpendicular crossing or a same-direction repeat', () => {
  assert.deepEqual(detect([point(0), point(100), point(50, -50), point(50, 50)]), []);
  assert.deepEqual(detect([point(0), point(100), point(0), point(100)], [true, false, true]), []);
});
test('does not match a separate parallel road beyond tolerance', () => {
  assert.deepEqual(detect([point(0), point(100), point(100, 40), point(0, 40)]), []);
});
test('unreliable edges cannot provide or receive return classifications', () => {
  const route = [point(0), point(100), point(0)];
  assert.deepEqual(detect(route, [false, true]), []);
  assert.deepEqual(detect(route, [true, false]), []);
});
test('ignores stationary noise, long jumps and empty routes', () => {
  assert.deepEqual(detect([point(0), point(2), point(0)]), []);
  assert.deepEqual(detect([point(0), point(1000), point(0)]), []);
  assert.deepEqual(detect([]), []);
});
