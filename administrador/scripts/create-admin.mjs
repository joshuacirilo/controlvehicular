// Usage: npm run admin:create -- --username admin1 [--nombre "Nombre"] [--email correo@dominio.com]
// The password is read from ADMIN_PASSWORD or prompted without echo; it is never printed.
import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { hashPassword, readPassword } from './password.mjs';

nextEnv.loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)));
const COLLATION = { locale: 'en', strength: 2 };

const { values } = parseArgs({ options: { username: { type: 'string' }, nombre: { type: 'string' }, email: { type: 'string' } } });
const username = values.username?.trim().toLowerCase() ?? '';
const email = (values.email ?? `${username}@controlvehicular.local`).trim().toLowerCase();
const nombre = values.nombre?.trim() || username;
if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  console.error('ERROR: --username debe tener 3 a 40 caracteres: letras, numeros, punto, guion o guion bajo.');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('ERROR: --email no tiene formato de correo valido.');
  process.exit(1);
}
const password = await readPassword('ADMIN_PASSWORD', 12);

let client;
try {
  const { MONGODB_URI: uri, MONGODB_DB: database } = process.env;
  if (!uri || !database) throw Object.assign(new Error(), { code: 'MISSING_CONFIG' });
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  const users = client.db(database).collection('users');
  if (await users.findOne({ $or: [{ username }, { email }] }, { collation: COLLATION, projection: { _id: 1 } })) {
    throw Object.assign(new Error(), { code: 'EXISTS' });
  }
  const now = new Date();
  await users.insertOne({
    email, username, nombre, passwordHash: await hashPassword(password),
    rol: 'administrador', activo: true, failedLogins: 0, lockedUntil: null, createdAt: now, updatedAt: now,
  });
  console.log(`OK: administrador "${username}" creado (${email}).`);
} catch (error) {
  // Never print raw errors: they may include the connection URI or credentials.
  const code = error?.code;
  if (code === 'EXISTS' || code === 11000) console.error('ERROR: ya existe un usuario con ese username o email.');
  else if (code === 'MISSING_CONFIG') console.error('ERROR: faltan MONGODB_URI o MONGODB_DB en .env.local.');
  else if (code === 121) console.error('ERROR: el documento no cumple el validador de la coleccion users.');
  else console.error('ERROR: no se pudo crear el administrador. Ejecuta npm run db:check para revisar la conexion.');
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
