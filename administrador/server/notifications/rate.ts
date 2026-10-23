import 'server-only';
import { getDb } from '@/server/db/mongo';
import { NotificationError } from '@/server/notifications/errors';

/** Atomic, bounded singleton/per-user gates. Keys never contain email or tokens. */
export async function takeGate(key: string, interval: number, now = new Date()) {
  const rows = (await getDb()).collection<{ _id: string; nextAt: Date }>('notificationGates');
  try { await rows.updateOne({ _id: key }, { $setOnInsert: { nextAt: new Date(0) } }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const result = await rows.findOneAndUpdate({ _id: key, nextAt: { $lte: now } },
    { $set: { nextAt: new Date(now.getTime() + interval) } }, { returnDocument: 'after' });
  if (!result) throw new NotificationError(429, 'Espera antes de volver a intentarlo.');
}
