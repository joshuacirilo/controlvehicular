import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

// Replace only external boundaries; execute the real service, validation and password hashing.
const root = new URL('../', import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    const stubs = {
      'server-only': 'export {};',
      '@/server/auth/admin': "export const USER_COLLATION = {locale:'en',strength:2};",
      '@/server/db/mongo': 'export async function getDb(){return globalThis.registrationTestDb;} export async function getMongoClient(){return globalThis.registrationTestClient;}',
    };
    if (specifier in stubs) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    if (specifier.startsWith('@/')) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    return next(specifier, context);
  },
});
const { registerAccount } = await import('../server/accounts/register.ts');
const { verifyPassword } = await import('../server/auth/password.ts');

function fakeDatabase({ duplicateUser = false, driverError = null } = {}) {
  const records = { users: [], drivers: [], trucks: [] };
  const session = {
    ended: false,
    async withTransaction(action) {
      try { await action(); } catch (error) { records.users.length = 0; records.drivers.length = 0; throw error; }
    },
    async endSession() { this.ended = true; },
  };
  globalThis.registrationTestClient = { startSession: () => session };
  globalThis.registrationTestDb = { collection: name => ({
    async findOne() { return duplicateUser ? { _id: 'existing' } : null; },
    async insertOne(record, options) {
      if (name !== 'trucks') assert.equal(options.session, session);
      if (name === 'drivers' && driverError) throw Object.assign(new Error(), { code: driverError });
      records[name].push(record);
    },
  }) };
  return { records, session };
}
const pilot = { kind: 'pilot', username: 'pilot.test', nombre: 'Piloto', licencia: 'ABC123', telefono: '55551234', password: 'Test-password-123!' };

test('creates linked pilot records with hashed credentials and conductor role', async () => {
  const { records, session } = fakeDatabase();
  const result = await registerAccount({ ...pilot, rol: 'administrador' });
  assert.equal(result.status, 201);
  assert.equal(records.users[0].rol, 'conductor');
  assert.equal(records.users[0]._id.toHexString(), records.drivers[0].userId.toHexString());
  assert.equal(await verifyPassword(pilot.password, records.users[0].passwordHash), true);
  assert.equal('password' in records.users[0], false);
  assert.equal(JSON.stringify(result).includes(pilot.password), false);
  assert.equal(session.ended, true);
});
test('duplicate user is rejected without writes', async () => {
  const { records } = fakeDatabase({ duplicateUser: true });
  assert.equal((await registerAccount(pilot)).status, 409);
  assert.equal(records.users.length, 0);
});
test('driver failures roll back the account and end the session', async () => {
  for (const code of [11000, 121]) {
    const { records, session } = fakeDatabase({ driverError: code });
    assert.equal((await registerAccount(pilot)).status, code === 11000 ? 409 : 400);
    assert.equal(records.users.length, 0);
    assert.equal(session.ended, true);
  }
});
test('truck creation uses the existing QR identifier convention', async () => {
  const { records } = fakeDatabase();
  const result = await registerAccount({ kind: 'truck', placa: 'p123abc', modelo: 'Camión', password: pilot.password });
  assert.equal(result.status, 201);
  assert.equal(records.trucks[0].qrCode, 'TRUCK-P123ABC');
  assert.equal(await verifyPassword(pilot.password, records.trucks[0].passwordHash), true);
});
