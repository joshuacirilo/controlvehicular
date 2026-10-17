import 'server-only';
import { ObjectId } from 'mongodb';
import type { UserDoc } from '@/server/auth/admin';
import { readToken, signToken } from '@/server/auth/token';
import { getDb } from '@/server/db/mongo';

export type DriverSession = { sub: string; name: string; role: 'conductor'; driverId: string; ver: number };

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * Pilot tokens do not expire: they stay valid until the pilot signs out or an admin deactivates
 * the user or its driver. `ver` must match `users.sessionVersion`.
 */
export function issueDriverToken(user: { id: string; name: string; driverId: string; sessionVersion: number }) {
  const token = signToken<DriverSession>({
    sub: user.id, name: user.name, role: 'conductor', driverId: user.driverId, ver: user.sessionVersion,
  });
  return { token, expiresAt: null };
}

/** Returns the authenticated driver, or null when the token is invalid or the session was revoked. */
export async function authenticateDriver(request: Request): Promise<DriverSession | null> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_\-.]{20,2048})$/.exec(header);
  const claims = readToken(match?.[1], 'conductor');
  if (!claims || typeof claims.driverId !== 'string' || !OBJECT_ID.test(claims.driverId) ||
      typeof claims.sub !== 'string' || !OBJECT_ID.test(claims.sub) || typeof claims.name !== 'string') return null;
  const ver = typeof claims.ver === 'number' ? claims.ver : 0;
  const userId = new ObjectId(claims.sub);
  const db = await getDb();
  const [user, driver] = await Promise.all([
    db.collection<UserDoc>('users').findOne(
      { _id: userId, rol: 'conductor', activo: true }, { projection: { sessionVersion: 1 } },
    ),
    db.collection('drivers').findOne(
      { _id: new ObjectId(claims.driverId), userId, activo: true }, { projection: { _id: 1 } },
    ),
  ]);
  if (!user || !driver || (user.sessionVersion ?? 0) !== ver) return null;
  return { sub: claims.sub, name: claims.name, role: 'conductor', driverId: claims.driverId, ver };
}

/** Signs the pilot out on every device by invalidating all of its tokens. */
export async function revokeDriverSessions(session: DriverSession) {
  await (await getDb()).collection<UserDoc>('users').updateOne(
    { _id: new ObjectId(session.sub) },
    { $inc: { sessionVersion: 1 }, $set: { updatedAt: new Date() } },
  );
}
