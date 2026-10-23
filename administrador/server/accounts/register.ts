import 'server-only';
import { ObjectId } from 'mongodb';
import { parseRegistration } from '@/lib/registration';
import { USER_COLLATION } from '@/server/auth/admin';
import { hashPassword } from '@/server/auth/password';
import { getDb, getMongoClient } from '@/server/db/mongo';
import { lockUsername } from '@/server/accounts/username-lock';
import type { Result } from '@/server/trips/service';

export async function registerAccount(input: unknown): Promise<Result<{ id: string; label: string }>> {
  const parsed = parseRegistration(input);
  if (!parsed.ok) return { ok: false, status: 400, message: parsed.message };
  const value = parsed.value;
  const db = await getDb();
  const passwordHash = await hashPassword(value.password);
  const now = new Date();
  const id = new ObjectId();
  try {
    if (value.kind === 'truck') {
      await db.collection('trucks').insertOne({
        _id: id, placa: value.placa, modelo: value.modelo, qrCode: `TRUCK-${value.placa}`,
        passwordHash, activo: true, failedLogins: 0, lockedUntil: null, createdAt: now, updatedAt: now,
      });
      return { ok: true, status: 201, body: { id: id.toHexString(), label: value.placa } };
    }
    // Username locks serialize names; the unique email index protects email ownership.
    const email = value.email;
    const session = (await getMongoClient()).startSession();
    try {
      await session.withTransaction(async () => {
        await lockUsername(db, session, value.username);
        const existing = await db.collection('users').findOne(
          { $or: [{ username: value.username }, { email }] },
          { session, collation: USER_COLLATION, projection: { _id: 1 } },
        );
        if (existing) throw Object.assign(new Error('Duplicate account'), { code: 11000 });
        await db.collection('users').insertOne({
          _id: id, username: value.username, email, nombre: value.nombre, passwordHash,
          rol: value.kind === 'admin' ? 'administrador' : 'conductor', activo: true, sessionVersion: 0, failedLogins: 0, lockedUntil: null,
          createdAt: now, updatedAt: now,
        }, { session });
        if (value.kind === 'pilot') await db.collection('drivers').insertOne({
          userId: id, nombre: value.nombre, licencia: value.licencia, telefono: value.telefono,
          activo: true, createdAt: now, updatedAt: now,
        }, { session });
      });
    } finally {
      await session.endSession();
    }
    return { ok: true, status: 201, body: { id: id.toHexString(), label: value.username } };
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code === 11000) return { ok: false, status: 409, message: value.kind === 'truck'
      ? 'Ya existe un camión con esa placa.' : 'El usuario, correo o licencia ya están registrados.' };
    if (code === 121) return { ok: false, status: 400, message: 'Los datos no cumplen los requisitos de registro de la base de datos.' };
    throw error;
  }
}
