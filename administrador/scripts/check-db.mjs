import nextEnv from '@next/env';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(fileURLToPath(new URL('../', import.meta.url)));
let client;
try {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DB;
  if (!uri || !database) throw Object.assign(new Error(), { code: 'MISSING_CONFIG' });
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 10000 });
  await client.connect();
  const result = await client.db(database).command({ ping: 1 });
  if (result.ok !== 1) throw Object.assign(new Error(), { code: 'PING_FAILED' });
  console.log('OK: conexion autenticada con MongoDB; ping respondio correctamente.');
  console.log('No se crearon ni modificaron datos. El ping no valida permisos de lectura/escritura.');
} catch (error) {
  // Never print raw errors: they may include the connection URI or credentials.
  const codes = [error?.code, error?.cause?.code];
  if (codes.includes(18)) console.error('ERROR: Atlas rechazo la autenticacion. Revisar credenciales y authSource.');
  else if (codes.includes('MISSING_CONFIG')) console.error('ERROR: faltan MONGODB_URI o MONGODB_DB en .env.local.');
  else if (codes.some(c => ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEOUT', 'ETIMEDOUT', 'EAI_AGAIN'].includes(c))) console.error('ERROR: no se pudo resolver o alcanzar Atlas. Revisar DNS, red y acceso de IP.');
  // Atlas answers TLS alert 80 when the source IP is not in its access list.
  else if (codes.includes('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')) console.error('ERROR: Atlas rechazo la conexion TLS. Normalmente la IP publica no esta en Network Access; si la red usa varias IPs publicas, autorizar todas.');
  else if (error?.name === 'MongoServerSelectionError') console.error('ERROR: no se encontro un servidor accesible. Revisar red, TLS, estado del cluster y acceso de IP en Atlas.');
  else console.error('ERROR: fallo la comprobacion. Revisar URI, credenciales y conectividad; detalles privados omitidos.');
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
