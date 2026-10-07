import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Leer .env.local manualmente para no requerir dotenv adicional
const envFile = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
let uri = '';
for (const line of envFile.split('\n')) {
  if (line.startsWith('MONGODB_URI=')) {
    uri = line.replace('MONGODB_URI=', '').trim().replace(/^["']|["']$/g, '');
  }
}

console.log('Probando conexión a:', uri ? uri.replace(/:[^:@]+@/, ':****@') : 'NO URI');

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log('✅ Conexión exitosa a MongoDB Atlas!');
  console.log('Base de datos:', mongoose.connection.name);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Colecciones existentes:', collections.map((c) => c.name));
  await mongoose.disconnect();
} catch (err) {
  console.error('❌ Error de conexión:', err.message);
  process.exit(1);
}
