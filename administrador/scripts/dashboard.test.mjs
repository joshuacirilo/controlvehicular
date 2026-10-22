import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardPeriod } from '../lib/dashboard.ts';

test('uses Guatemala midnight and wall-clock storage bounds, including year rollover', () => {
  const before = dashboardPeriod('7', new Date('2026-01-01T05:59:59Z'));
  assert.equal(before.dates.at(-1), '2025-12-31');
  assert.equal(before.start.toISOString(), '2025-12-25T00:00:00.000Z');
  assert.equal(before.end.toISOString(), '2026-01-01T00:00:00.000Z');
  const after = dashboardPeriod('7', new Date('2026-01-01T06:00:00Z'));
  assert.equal(after.dates.at(-1), '2026-01-01');
  assert.equal(after.dates.length, 7);
});

test('bounds report size and spans calendar months with 30 inclusive days', () => {
  const now = new Date('2026-03-01T12:00:00Z');
  const period = dashboardPeriod('30', now);
  assert.equal(period.dates.length, 30);
  assert.equal(period.dates[0], '2026-01-31');
  assert.equal(period.dates.at(-1), '2026-03-01');
  for (const invalid of [undefined, '999999', ['30'], '0']) assert.equal(dashboardPeriod(invalid, now).days, 7);
});
