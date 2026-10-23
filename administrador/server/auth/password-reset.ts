import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getDb } from '@/server/db/mongo';
import { USER_COLLATION, type UserDoc } from '@/server/auth/admin';
import { hashPassword } from '@/server/auth/password';
import { normalizeNotificationEmail } from '@/lib/email-settings';
import { appUrl, emailjsConfigured, sendNotification } from '@/server/notifications/emailjs';
import { takeGate } from '@/server/notifications/rate';
import { reserveEmailSend } from '@/server/notifications/repository';
import { NotificationError } from '@/server/notifications/errors';

type ResetUser = UserDoc & { passwordReset?: { hash: string; expiresAt: Date } };
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export const RESET_RESPONSE = 'Si existe una cuenta activa con ese correo, recibirás un enlace para restablecer la contraseña.';

/** Called after the generic HTTP response, so account existence/provider latency is not exposed. */
export async function requestPasswordReset(email: string) {
  try {
    if (!emailjsConfigured()) return;
    const users = (await getDb()).collection<ResetUser>('users');
    const user = await users.findOne({ email, activo: true, rol: { $in: ['administrador', 'conductor'] } }, { collation: USER_COLLATION });
    if (!user || !normalizeNotificationEmail(user.email)) return;
    await takeGate(`reset:${user._id}`, 5 * 60000);
    await reserveEmailSend(new Date(), 'password-reset');
    await takeGate('provider', 1100);
    const token = randomBytes(32).toString('base64url');
    const resetUrl = appUrl(`/restablecer#token=${token}`);
    await users.updateOne({ _id: user._id, activo: true }, { $set: { passwordReset: { hash: digest(token), expiresAt: new Date(Date.now() + 15 * 60000) } } });
    await sendNotification({ to_email: user.email, subject: 'Restablecer contraseña', title: 'Recuperación de contraseña',
      message: 'Recibimos una solicitud para restablecer tu contraseña.',
      details: 'El enlace expira en 15 minutos y solo puede utilizarse una vez. Si no solicitaste el cambio, ignora este mensaje.',
      action_url: resetUrl, button_text: 'Restablecer contraseña' });
    console.info('[password-reset] provider_accepted');
  } catch { console.warn('[password-reset] send_unconfirmed'); }
}

export async function completePasswordReset(input: Record<string, unknown>) {
  if (Object.keys(input).some(key => !['token', 'password'].includes(key)) || typeof input.token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.token) || typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128) {
    throw new NotificationError(400, 'Enlace inválido o contraseña fuera del rango de 12 a 128 caracteres.');
  }
  const users = (await getDb()).collection<ResetUser>('users');
  const filter = { activo: true, 'passwordReset.hash': digest(input.token), 'passwordReset.expiresAt': { $gt: new Date() } };
  const user = await users.findOne(filter);
  if (!user) throw new NotificationError(400, 'El enlace venció o ya fue utilizado. Solicita uno nuevo.');
  const passwordHash = await hashPassword(input.password);
  const result = await users.updateOne({ ...filter, _id: user._id, 'passwordReset.expiresAt': { $gt: new Date() } }, {
    $set: { passwordHash, updatedAt: new Date(), failedLogins: 0, lockedUntil: null },
    $inc: { sessionVersion: 1 }, $unset: { passwordReset: '' },
  });
  if (!result.matchedCount) throw new NotificationError(400, 'El enlace venció o ya fue utilizado.');
  return { message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' };
}
