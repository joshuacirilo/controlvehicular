import assert from 'node:assert/strict';
import test from 'node:test';
import { hasUsableAccuracy, hasQuestionableFix } from '../lib/route-quality.ts';
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
