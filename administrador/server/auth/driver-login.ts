import 'server-only';
import { ObjectId } from 'mongodb';
import { checkCredentials } from '@/server/auth/accounts';
import { USER_COLLATION, type UserDoc } from '@/server/auth/admin';
import { issueDriverToken } from '@/server/auth/session';
import { getDb } from '@/server/db/mongo';
import type { Result } from '@/server/trips/service';

type DriverDoc = { _id: ObjectId; userId: ObjectId | null; nombre: string; activo: boolean };
export type TruckDoc = {
  _id: ObjectId;
  placa: string;
  modelo: string;
  qrCode: string;
  activo: boolean;
  passwordHash?: string;
  failedLogins?: number;
  lockedUntil?: Date | null;
};

const LOCKED = 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.';

export async function driverCollections() {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>('users'),
    drivers: db.collection<DriverDoc>('drivers'),
    trucks: db.collection<TruckDoc>('trucks'),
  };
}

/** Normalizes the plate the way the `trucks` validator stores it. */
export const normalizePlate = (value: string) => value.trim().toUpperCase();

/** Finds an active truck by the plate on its QR and verifies its password; failures lock the truck. */
export async function verifyTruck(placa: string, password: string): Promise<Result<TruckDoc>> {
  const { trucks } = await driverCollections();
  const truck = await trucks.findOne({ placa: normalizePlate(placa), activo: true });
  const check = await checkCredentials('trucks', truck, password);
  if (check.ok) return { ok: true, status: 200, body: check.account };
  return check.reason === 'locked'
    ? { ok: false, status: 429, message: LOCKED }
    : { ok: false, status: 403, message: 'El QR del camión no es válido o su contraseña cambió.' };
}

/** Pilot login against `users` (rol conductor) linked through `drivers.userId`. */
export async function loginUser(username: string, password: string) {
  const { users, drivers } = await driverCollections();
  const login = username.trim().toLowerCase();
  const user = await users.findOne(
    { rol: 'conductor', activo: true, $or: [{ username: login }, { email: login }] },
    { collation: USER_COLLATION },
  );
  const check = await checkCredentials('users', user, password);
  if (!check.ok) {
    return check.reason === 'locked'
      ? { ok: false as const, status: 429, message: LOCKED }
      : { ok: false as const, status: 401, message: 'Usuario o contraseña incorrectos.' };
  }
  const driver = await drivers.findOne({ userId: check.account._id, activo: true });
  if (!driver) return { ok: false as const, status: 403, message: 'Tu usuario no está vinculado a un conductor activo.' };
  const account = check.account;
  const name = account.nombre ?? driver.nombre;
  const { token, expiresAt } = issueDriverToken({ id: account._id.toHexString(), name, driverId: driver._id.toHexString() });
  return {
    ok: true as const, status: 200,
    body: { user: { id: account._id.toHexString(), username: account.username ?? account.email, name }, token, expiresAt },
  };
}
