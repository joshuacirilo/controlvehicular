// Usage: npm run truck:create -- --placa PRUEBA123 [--modelo "Modelo"]
// The password is read from TRUCK_PASSWORD or prompted without echo; it is never printed.
// The truck QR must contain the lines "Placa: <placa>" and "Contraseña: <contraseña>".
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { hashPassword, readPassword } from './password.mjs';

nextEnv.loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)));

const { values } = parseArgs({ options: { placa: { type: 'string' }, modelo: { type: 'string' } } });
const placa = values.placa?.trim().toUpperCase() ?? '';
const modelo = values.modelo?.trim() || 'Sin modelo';
if (!/^[A-Z0-9-]{1,20}$/.test(placa)) {
  console.error('ERROR: --placa debe tener 1 a 20 caracteres: letras, numeros o guion.');
  process.exit(1);
}
const password = await readPassword('TRUCK_PASSWORD', 8);

let client;
try {
  const { MONGODB_URI: uri, MONGODB_DB: database } = process.env;
  if (!uri || !database) throw Object.assign(new Error(), { code: 'MISSING_CONFIG' });
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  const now = new Date();
  await client.db(database).collection('trucks').insertOne({
    placa, qrCode: `TRUCK-${placa}`, modelo, activo: true, passwordHash: await hashPassword(password),
    failedLogins: 0, lockedUntil: null, createdAt: now, updatedAt: now,
  });
  console.log(`OK: camion ${placa} creado.`);
} catch (error) {
  // Never print raw errors: they may include the connection URI or credentials.
  const code = error?.code;
  if (code === 11000) console.error('ERROR: ya existe un camion con esa placa o qrCode.');
  else if (code === 'MISSING_CONFIG') console.error('ERROR: faltan MONGODB_URI o MONGODB_DB en .env.local.');
  else if (code === 121) console.error('ERROR: el documento no cumple el validador de la coleccion trucks.');
  else console.error('ERROR: no se pudo crear el camion. Ejecuta npm run db:check para revisar la conexion.');
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
