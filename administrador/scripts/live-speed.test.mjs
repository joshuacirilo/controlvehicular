import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { isRecentLocation } from '../lib/live-trucks.ts';
const root = new URL('../', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  return specifier.startsWith('@/') ? next(new URL(`${specifier.slice(2)}.ts`, root).href, context) : next(specifier, context);
} });
const { liveSpeed } = await import('../server/trucks/live-speed.ts');
const point = (meters, seconds, precision = 5) => ({ coords: { coordinates: [meters / 6371000 * 180 / Math.PI, 0] }, timestamp: new Date(Date.UTC(2026, 9, 21, 12, 0, seconds)), precision });

test('recalculates the latest pair and rejects bad precision at either end', () => {
  const pair = [point(150, 5), point(0, 0)];
  assert.ok(Math.abs(liveSpeed(pair) - 108) < 1e-8);
  assert.equal(liveSpeed([{ ...pair[0], precision: 300 }, pair[1]]), null);
  assert.equal(liveSpeed([pair[0], { ...pair[1], precision: 500 }]), null);
  assert.equal(liveSpeed([{ ...pair[0], qualityFlags: ['jump'] }, pair[1]]), null);
  assert.equal(liveSpeed([point(0, 5), point(0, 0)]), 0);
});

test('does not evaluate missing samples, large gaps or duplicate timestamps', () => {
  assert.equal(liveSpeed([]), null);
  assert.equal(liveSpeed([point(0, 0)]), null);
  assert.equal(liveSpeed([point(150, 31), point(0, 0)]), null);
  assert.equal(liveSpeed([point(150, 0), point(0, 0)]), null);
});

test('freshness accommodates minute uploads but expires even when polling fails', () => {
  const timestamp = '2026-10-21T12:00:00-06:00';
  const at = Date.parse(timestamp);
  assert.equal(isRecentLocation(timestamp, at + 60000), true);
  assert.equal(isRecentLocation(timestamp, at + 90000), true);
  assert.equal(isRecentLocation(timestamp, at + 90001), false);
  assert.equal(isRecentLocation(timestamp, at - 1), false);
  assert.equal(isRecentLocation('invalid', at), false);
});
