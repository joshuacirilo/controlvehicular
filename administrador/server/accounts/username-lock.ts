import 'server-only';
import type { ClientSession, Db } from 'mongodb';

/** Serialize checks for the same username across registration and profile edits. */
export async function lockUsername(db: Db, session: ClientSession, username: string) {
  await db.collection<{ _id: string; revision: number }>('usernameLocks').updateOne(
    { _id: username.toLowerCase() }, { $inc: { revision: 1 } }, { upsert: true, session },
  );
}
