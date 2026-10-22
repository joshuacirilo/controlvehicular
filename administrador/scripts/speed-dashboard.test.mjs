import assert from 'node:assert/strict';
import test from 'node:test';
import { speedDashboardAccumulator } from '../lib/speed-dashboard.ts';
const trip = { tripId: 't1', driverId: 'd1', nombre: 'Piloto', placa: 'ABC' };
const segment = { evaluated: true, speed: 80, start: '2026-10-17T15:30:00-06:00', end: '2026-10-17T15:30:05-06:00', index: 1 };

test('percentages use evaluated segments and unique trips/drivers, never bad GPS', () => {
  const report = speedDashboardAccumulator(60);
  report.addSegment(trip, segment);
  report.addSegment(trip, { ...segment, index: 2 });
  report.addSegment(trip, { ...segment, speed: null, index: 3 });
  report.addSegment(trip, { ...segment, evaluated: false, speed: 688.6, index: 4 });
  report.addSegment({ ...trip, tripId: 't2' }, { ...segment, speed: null });
  report.addTrip({ ...trip, tripId: 't3', driverId: 'd2' });
  const data = report.snapshot();
  assert.equal(data.percent, 50);
  assert.equal(data.skipped, 1);
  assert.equal(data.affectedTrips, 1);
  assert.equal(data.tripPercent, 50);
  assert.equal(data.affectedDrivers, 1);
  assert.equal(data.evaluatedDrivers, 1);
  assert.equal(data.ranking[1].percent, null);
  assert.equal(data.daily[0].excesses, 2);
  assert.equal(data.events.some(e => e.speed === 688.6), false);
  assert.equal(data.affectedDetails.length, 1);
  assert.equal(data.affectedDetails[0].tripId, 't1');
  assert.equal(data.affectedDetails[0].excesses, 2);
});

test('keeps newest 20 events without truncating totals; empty data has no percentage', () => {
  const report = speedDashboardAccumulator(60);
  assert.equal(report.snapshot().percent, null);
  for (let i = 25; i >= 1; i--) report.addSegment(trip, { ...segment, index: i, end: `2026-10-17T15:30:${String(i).padStart(2, '0')}-06:00` });
  const data = report.snapshot();
  assert.equal(data.excesses, 25);
  assert.equal(data.events.length, 20);
  assert.equal(data.events[0].index, 25);
  assert.equal(data.events.at(-1).index, 6);
  assert.equal(data.percent, 100);
});

test('drill-down keeps every affected trip beyond the recent event limit and latest segment', () => {
  const report = speedDashboardAccumulator(60);
  for (let i = 0; i < 25; i++) report.addSegment({ ...trip, tripId: `t${i}` }, segment);
  report.addSegment(trip, { ...segment, index: 8, end: '2026-10-18T12:00:00-06:00' });
  const data = report.snapshot();
  assert.equal(data.events.length, 20);
  assert.equal(data.affectedDetails.length, 25);
  assert.equal(data.affectedDetails[0].tripId, 't1');
  assert.equal(data.affectedDetails[0].index, 8);
  assert.equal(data.affectedDetails[0].excesses, 2);
});
