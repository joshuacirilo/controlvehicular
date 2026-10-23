import 'server-only';
import { ObjectId } from 'mongodb';
import { USER_COLLATION, toAdminUser, type AdminUser, type UserDoc } from '@/server/auth/admin';
import { checkCredentials } from '@/server/auth/accounts';
import { hashPassword } from '@/server/auth/password';
import { getDb, getMongoClient } from '@/server/db/mongo';
import { lockUsername } from '@/server/accounts/username-lock';
import type { Result } from '@/server/trips/service';

export async function updateProfile(admin: AdminUser, input: Record<string, unknown>): Promise<Result<{ user?: AdminUser; passwordChanged: boolean }>> {
  const fail = (status: number, message: string): Result<never> => ({ ok: false, status, message });
  const passwordChange = input.action === 'password';
  const keys = passwordChange ? ['action', 'currentPassword', 'newPassword'] : ['action', 'currentPassword', 'nombre', 'username'];
  if (!['profile', 'password'].includes(String(input.action)) || Object.keys(input).some(key => !keys.includes(key)) ||
      typeof input.currentPassword !== 'string' || !input.currentPassword || input.currentPassword.length > 128) return fail(400, 'Ingresa tu contraseña actual y datos válidos.');
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  if (!passwordChange && (!nombre || nombre.length > 120 || /[\u0000-\u001f]/.test(nombre) || !/^[a-z0-9._-]{3,40}$/.test(username))) return fail(400, 'Nombre: hasta 120 caracteres. Usuario: de 3 a 40 letras, números, puntos, guiones o guiones bajos.');
  if (passwordChange && (typeof input.newPassword !== 'string' || input.newPassword.length < 12 || input.newPassword.length > 128 || !input.newPassword.trim())) return fail(400, 'La nueva contraseña debe tener entre 12 y 128 caracteres.');
  const db = await getDb(), users = db.collection<UserDoc>('users');
  const id = new ObjectId(admin.id);
  const user = await users.findOne({ _id: id, activo: true, rol: 'administrador' });
  const check = await checkCredentials('users', user, input.currentPassword);
  if (!check.ok) return fail(check.reason === 'locked' ? 429 : 400, check.reason === 'locked' ? 'Demasiados intentos. Espera 15 minutos.' : 'La contraseña actual es incorrecta.');
  // Do not overwrite a password changed concurrently by another tab or recovery.
  const filter = { _id: id, activo: true, rol: 'administrador' as const, passwordHash: check.account.passwordHash };
  if (passwordChange) {
    if (input.newPassword === input.currentPassword) return fail(400, 'Elige una contraseña diferente a la actual.');
    const passwordHash = await hashPassword(input.newPassword as string);
    const result = await users.updateOne(filter, { $set: { passwordHash, updatedAt: new Date() }, $inc: { sessionVersion: 1 }, $unset: { passwordReset: '' } });
    if (!result.matchedCount) return fail(409, 'La cuenta cambió mientras guardabas. Inicia sesión de nuevo.');
    return { ok: true, status: 200, body: { passwordChanged: true } };
  }
  const session = (await getMongoClient()).startSession();
  try {
    return await session.withTransaction(async () => {
      await lockUsername(db, session, username);
      const existing = await users.findOne({ _id: { $ne: id }, $or: [{ username }, { email: username }] }, { session, collation: USER_COLLATION });
      if (existing) return fail(409, 'Ese nombre de usuario ya está en uso.');
      const updated = await users.findOneAndUpdate(filter, { $set: { nombre, username, updatedAt: new Date() } }, { session, returnDocument: 'after' });
      if (!updated) return fail(409, 'La cuenta cambió mientras guardabas. Inicia sesión de nuevo.');
      return { ok: true as const, status: 200, body: { user: toAdminUser(updated), passwordChanged: false } };
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return fail(409, 'Ese nombre de usuario está siendo registrado. Prueba otro o vuelve a intentarlo.');
    throw error;
  } finally { await session.endSession(); }
}
