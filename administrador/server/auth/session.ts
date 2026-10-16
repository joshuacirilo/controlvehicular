import 'server-only';
import { ObjectId } from 'mongodb';
import { readToken, signToken } from '@/server/auth/token';

const TTL_SECONDS = 12 * 60 * 60;

export type DriverSession = { sub: string; name: string; role: 'conductor'; driverId: string; exp: number };

export function issueDriverToken(user: { id: string; name: string; driverId: string }) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = signToken<DriverSession>({ sub: user.id, name: user.name, role: 'conductor', driverId: user.driverId, exp });
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

/** Returns the authenticated driver, or null when the bearer token is missing, invalid or expired. */
export function authenticateDriver(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_\-.]{20,2048})$/.exec(header);
  const session = readToken(match?.[1], 'conductor');
  if (!session || typeof session.driverId !== 'string' || !ObjectId.isValid(session.driverId)) return null;
  return session as DriverSession;
}
