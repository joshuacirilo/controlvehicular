import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePing } from '../server/trips/pings.ts';

const now=new Date('2026-10-19T18:00:00Z');
const sample={pingId:'checkpoint_001',latitude:14.6,longitude:-90.5,accuracy:10,timestamp:now.toISOString()};
test('old clients still work and quality flags preserve the original fix',()=>{
  assert.deepEqual(parsePing(sample,now).qualityFlags,[]);
  const parsed=parsePing({...sample,qualityFlags:['jump','stale','jump']},now);
  assert.deepEqual(parsed.qualityFlags,['jump','stale']);
  assert.equal(parsed.latitude,sample.latitude);
  assert.equal(parsed.timestamp.getTime(),now.getTime());
});
test('rejects unknown, malformed and unbounded diagnostic metadata',()=>{
  for(const qualityFlags of ['jump',['unknown'],[1],Array(7).fill('jump')]) assert.equal(parsePing({...sample,qualityFlags},now),null);
});
