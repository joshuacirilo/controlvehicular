import 'server-only';
import { MongoClient, type Db } from 'mongodb';
import { getMongoConfig } from '@/server/env';

// Reuse one client per server process; dev hot reloads re-evaluate this module.
const cache = globalThis as typeof globalThis & { __mongoClient?: Promise<MongoClient> };

export async function getMongoClient(): Promise<MongoClient> {
  const { uri } = getMongoConfig();
  cache.__mongoClient ??= new MongoClient(uri, { serverSelectionTimeoutMS: 10000 }).connect()
    .catch(error => {
      cache.__mongoClient = undefined;
      throw error;
    });
  return cache.__mongoClient;
}

export async function getDb(): Promise<Db> {
  return (await getMongoClient()).db(getMongoConfig().database);
}
