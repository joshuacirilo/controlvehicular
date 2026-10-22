import assert from 'node:assert/strict';
import test from 'node:test';
import { hasUsableAccuracy, hasQuestionableFix, recordedSpeedLabel } from '../lib/route-quality.ts';

test('hides the real 688.6 km/h GPS jump and checks both endpoints', () => {
  const a = { precision: 500, timestamp: '2026-10-17T15:30:06.425-06:00' };
  const b = { precision: 300, timestamp: '2026-10-17T15:30:13.764-06:00', velocidad: 688.6 };
  assert.equal(recordedSpeedLabel(a, b), 'No confiable: ubicación GPS dudosa');
  assert.equal(recordedSpeedLabel(a, { ...b, precision: 10 }), 'No confiable: ubicación GPS dudosa');
  const validA = { ...a, precision: 10 };
  const validB = { ...b, precision: 10, velocidad: 45.2 };
  assert.equal(recordedSpeedLabel(validA, validB), '45.2 km/h');
  assert.equal(recordedSpeedLabel(validA, { ...validB, qualityFlags: ['jump'] }), 'No confiable: ubicación GPS dudosa');
  assert.equal(recordedSpeedLabel(validA, { ...validB, timestamp: '2026-10-17T15:31:13-06:00' }), 'No confiable: intervalo entre ubicaciones inválido');
  assert.equal(recordedSpeedLabel(undefined, validB), 'No disponible');
});
test('accuracy thresholds still identify questionable markers', () => {
  for (const precision of [null,undefined,0,-1,Infinity,NaN,51]) assert.equal(hasUsableAccuracy(precision),false);
  assert.equal(hasUsableAccuracy(50),true);
});
test('device alerts identify markers without modifying their metadata', () => {
  const checkpoint={precision:10,timestamp:'2026-10-19T18:00:00Z',qualityFlags:['jump']};
  const original=structuredClone(checkpoint);
  assert.equal(hasQuestionableFix(checkpoint),true);
  assert.deepEqual(checkpoint,original);
  assert.equal(hasQuestionableFix({...checkpoint,qualityFlags:[]}),false);
});
