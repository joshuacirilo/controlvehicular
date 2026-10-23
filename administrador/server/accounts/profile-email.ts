import 'server-only';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '@/server/db/mongo';
import { USER_COLLATION, toAdminUser, type AdminUser, type UserDoc } from '@/server/auth/admin';
import { checkCredentials } from '@/server/auth/accounts';
import { normalizeNotificationEmail } from '@/lib/email-settings';
import { appUrl, emailjsConfigured, sendNotification } from '@/server/notifications/emailjs';
import { reserveEmailSend } from '@/server/notifications/repository';
import { takeGate } from '@/server/notifications/rate';
import { NotificationError } from '@/server/notifications/errors';

type Pending = { id: string; email: string; previousEmail: string; hash: string; passwordHash: string; expiresAt: Date; attempts: number };
type Account = UserDoc & { pendingEmail?: Pending };
const digest = (id: string, code: string) => createHash('sha256').update(`${id}:${code}`).digest('hex');
export async function changeProfileEmail(admin: AdminUser, input: Record<string, unknown>) {
  const users = (await getDb()).collection<Account>('users');
  const own = { _id: new ObjectId(admin.id), activo: true, rol: 'administrador' as const };
  if (input.action === 'request') {
    const email = normalizeNotificationEmail(input.email);
    if (Object.keys(input).some(key => !['action', 'email', 'currentPassword'].includes(key)) || !email || email.endsWith('.local') ||
        typeof input.currentPassword !== 'string' || !input.currentPassword || input.currentPassword.length > 128) throw new NotificationError(400, 'Ingresa un correo válido y tu contraseña actual.');
    const check = await checkCredentials('users', await users.findOne(own), input.currentPassword);
    if (!check.ok) throw new NotificationError(check.reason === 'locked' ? 429 : 400, check.reason === 'locked' ? 'Demasiados intentos. Espera 15 minutos.' : 'La contraseña actual es incorrecta.');
    if (check.account.email?.toLowerCase() === email.toLowerCase()) throw new NotificationError(400, 'Ese ya es el correo de tu cuenta.');
    if (await users.findOne({ _id: { $ne: own._id }, email }, { collation: USER_COLLATION })) throw new NotificationError(409, 'Ese correo ya está en uso.');
    if (!emailjsConfigured()) throw new NotificationError(503, 'El servicio de correo no está configurado.');
    await takeGate(`profile-email:${admin.id}`, 60000);
    await reserveEmailSend(new Date(), 'profile-email');
    await takeGate('provider', 1100);
    const id = randomUUID(), code = String(randomInt(0, 1000000)).padStart(6, '0');
    const pendingEmail: Pending = { id, email, previousEmail: check.account.email, passwordHash: check.account.passwordHash,
      hash: digest(id, code), expiresAt: new Date(Date.now() + 10 * 60000), attempts: 0 };
    const saved = await users.updateOne({ ...own, passwordHash: check.account.passwordHash, email: check.account.email }, { $set: { pendingEmail } });
    if (!saved.matchedCount) throw new NotificationError(409, 'La cuenta cambió. Recarga e intenta de nuevo.');
    await sendNotification({ to_email: email, subject: 'Confirma tu nuevo correo', title: 'Cambiar correo de la cuenta',
      message: `Tu código de verificación es: ${code}`, details: 'Vence en 10 minutos y permite cinco intentos. Tu correo actual no cambiará hasta confirmar este código.',
      action_url: appUrl('/perfil'), button_text: 'Abrir mi perfil' });
    return { verified: false, message: 'EmailJS aceptó el correo de verificación. Revisa tu bandeja y spam e ingresa el código.' };
  }
  if (input.action !== 'verify' || Object.keys(input).some(key => !['action', 'code'].includes(key)) || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) throw new NotificationError(400, 'Ingresa el código de seis dígitos.');
  const row = await users.findOneAndUpdate({ ...own, 'pendingEmail.expiresAt': { $gt: new Date() }, 'pendingEmail.attempts': { $lt: 5 } },
    { $inc: { 'pendingEmail.attempts': 1 } }, { returnDocument: 'after' });
  const pending = row?.pendingEmail;
  if (!pending || pending.hash !== digest(pending.id, input.code)) throw new NotificationError(400, 'Código inválido, vencido o sin intentos disponibles.');
  try {
    if (await users.findOne({ _id: { $ne: own._id }, email: pending.email }, { collation: USER_COLLATION })) throw new NotificationError(409, 'Ese correo ya está en uso.');
    // The existing unique email index arbitrates concurrent confirmations.
    const updated = await users.findOneAndUpdate({ ...own, email: pending.previousEmail, passwordHash: pending.passwordHash,
      'pendingEmail.id': pending.id, 'pendingEmail.expiresAt': { $gt: new Date() } }, {
      $set: { email: pending.email, updatedAt: new Date() }, $unset: { pendingEmail: '', passwordReset: '' },
    }, { returnDocument: 'after' });
    if (!updated) throw new NotificationError(409, 'La cuenta cambió o el código venció. Solicita otro.');
    return { verified: true, user: toAdminUser(updated), message: 'Correo actualizado y verificado. Ya puedes usarlo para iniciar sesión y recuperar tu cuenta.' };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new NotificationError(409, 'Ese correo ya está en uso.');
    throw error;
  }
}
