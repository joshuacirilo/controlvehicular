import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';

const TTL_SECONDS = 12 * 60 * 60;

export type DriverSession = { sub: string; name: string; role: 'conductor'; driverId: string; exp: number };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET is missing or shorter than 32 characters.');
  return value;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueDriverToken(user: { id: string; name: string; driverId: string }) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const session: DriverSession = { sub: user.id, name: user.name, role: 'conductor', driverId: user.driverId, exp };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

function verify(token: string): DriverSession | null {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session?.role !== 'conductor' || typeof session.exp !== 'number' || session.exp * 1000 <= Date.now() ||
        typeof session.driverId !== 'string' || !ObjectId.isValid(session.driverId)) return null;
    return session as DriverSession;
  } catch {
    return null;
  }
}

/** Returns the authenticated driver, or null when the bearer token is missing, invalid or expired. */
export function authenticateDriver(request: Request) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_\-.]{20,2048})$/.exec(header);
  return match ? verify(match[1]) : null;
}
