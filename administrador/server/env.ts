import 'server-only';

// Call only from server-side database code. Never serialize this configuration.
export function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  const database = process.env.MONGODB_DB;
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI is missing or invalid.');
  }
  if (!database?.trim()) {
    throw new Error('MONGODB_DB is required.');
  }
  return { uri, database };
}
