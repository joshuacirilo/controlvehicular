import 'server-only';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { getDb } from '@/server/db/mongo';
import { normalizeNotificationEmail, type EmailSettings } from '@/lib/email-settings';
import { NotificationError } from '@/server/notifications/errors';

type Author = EmailSettings['updatedBy'];
export type SettingsRecord = Omit<EmailSettings, 'id' | 'updatedAt' | 'verifiedAt'> & {
  _id: string; updatedAt: Date; verifiedAt: Date | null;
  verification?: { id: string; hash: string; expiresAt: Date; attempts: number };
};
const settings = async () => (await getDb()).collection<SettingsRecord>('notificationSettings');
export async function getEmailRecord() { return (await settings()).findOne({ _id: 'email' }); }
export function publicSettings(row: SettingsRecord): EmailSettings {
  return { id: row._id, email: row.email, enabled: row.enabled, revision: row.revision,
    verifiedAt: row.verifiedAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy };
}

export async function saveEmailSettings(input: Record<string, unknown> | null, author: Author) {
  const email = normalizeNotificationEmail(input?.email);
  if (!input || Object.keys(input).some(key => !['email', 'enabled', 'revision'].includes(key)) || !email || typeof input.enabled !== 'boolean' ||
    !(input.revision === null || (typeof input.revision === 'string' && /^[a-f0-9-]{36}$/.test(input.revision)))) {
    throw new NotificationError(400, 'Ingresa un correo válido, el estado y la revisión de la configuración.');
  }
  const collection = await settings();
  const previous = await getEmailRecord();
  if ((previous?.revision ?? null) !== input.revision) throw new NotificationError(409, 'La configuración cambió. Recarga antes de guardar.');
  const record: SettingsRecord = { _id: 'email', email, enabled: input.enabled, revision: randomUUID(), updatedAt: new Date(),
    updatedBy: { id: author.id, nombre: author.nombre, username: author.username },
    verifiedAt: previous?.email === email ? previous.verifiedAt : null };
  try {
    if (!previous) await collection.insertOne(record);
    else {
      const saved = await collection.replaceOne({ _id: 'email', revision: previous.revision }, record);
      if (!saved.matchedCount) throw new NotificationError(409, 'La configuración cambió. Recarga antes de guardar.');
    }
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new NotificationError(409, 'Otro administrador guardó la configuración. Recarga la página.');
    throw error;
  }
  return publicSettings(record);
}

/** Global atomic quota shared by all server instances and all types of mail. */
export async function reserveEmailSend(now = new Date(), lane = 'emailjs') {
  type Gate = { _id: string; nextAt: Date; day: string; count: number };
  const collection = (await getDb()).collection<Gate>('notificationSendLimits');
  try {
    await collection.updateOne({ _id: lane }, { $setOnInsert: { nextAt: new Date(0), day: '', count: 0 } }, { upsert: true });
  } catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  const day = now.toISOString().slice(0, 10);
  const reserved = await collection.findOneAndUpdate({ _id: lane, nextAt: { $lte: now }, $or: [{ day: { $ne: day } }, { count: { $lt: 20 } }] }, [
    { $set: { nextAt: new Date(now.getTime() + 60000), day, count: { $cond: [{ $eq: ['$day', day] }, { $add: ['$count', 1] }, 1] } } },
  ], { returnDocument: 'after' });
  if (!reserved) throw new NotificationError(429, 'Espera un minuto entre correos. Se permiten hasta 20 intentos por día UTC.');
}

const codeHash = (id: string, code: string) => createHash('sha256').update(`${id}:${code}`).digest('hex');
export async function createVerification(row: SettingsRecord) {
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const id = randomUUID();
  const verification = { id, hash: codeHash(id, code), expiresAt: new Date(Date.now() + 10 * 60000), attempts: 0 };
  const updated = await (await settings()).updateOne({ _id: 'email', revision: row.revision, enabled: true }, { $set: { verification } });
  if (!updated.matchedCount) throw new NotificationError(409, 'La configuración cambió. Recarga e intenta de nuevo.');
  return code;
}

export async function verifyEmailCode(input: Record<string, unknown> | null, author: Author) {
  if (!input || Object.keys(input).some(key => !['code', 'revision'].includes(key)) || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code) || typeof input.revision !== 'string') {
    throw new NotificationError(400, 'Ingresa el código de seis dígitos del correo.');
  }
  const now = new Date();
  const collection = await settings();
  // Reserve an attempt atomically; even parallel guesses cannot exceed five tries.
  const row = await collection.findOneAndUpdate({ _id: 'email', revision: input.revision, enabled: true,
    'verification.expiresAt': { $gt: now }, 'verification.attempts': { $lt: 5 },
  }, { $inc: { 'verification.attempts': 1 } }, { returnDocument: 'after' });
  if (!row?.verification || row.verification.hash !== codeHash(row.verification.id, input.code)) {
    throw new NotificationError(400, 'Código inválido, vencido o sin intentos disponibles. Solicita otro si es necesario.');
  }
  const saved = await collection.findOneAndUpdate({ _id: 'email', revision: row.revision, 'verification.id': row.verification.id }, {
    $set: { verifiedAt: now, updatedAt: now, updatedBy: { id: author.id, nombre: author.nombre, username: author.username }, revision: randomUUID() },
    $unset: { verification: '' },
  }, { returnDocument: 'after' });
  if (!saved) throw new NotificationError(409, 'La configuración cambió. Recarga antes de verificar.');
  return publicSettings(saved);
}

export async function startDelivery(reportType: string, revision: string) {
  const id = randomUUID();
  await (await getDb()).collection('notificationDeliveries').insertOne({ deliveryId: id, reportType, revision, status: 'pending', createdAt: new Date() });
  return id;
}
export async function finishDelivery(id: string, status: 'accepted' | 'unconfirmed') {
  try {
    await (await getDb()).collection('notificationDeliveries').updateOne({ deliveryId: id }, { $set: { status, completedAt: new Date() } });
  } catch { console.warn('[notifications] delivery_log_failed', id); }
  console.info('[notifications]', id, status);
}
