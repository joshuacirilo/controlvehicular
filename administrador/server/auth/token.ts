// No `server-only` marker: proxy.ts imports this module, and Proxy must not rely on it.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Admin tokens always expire; pilot tokens omit `exp` and are revoked through `users.sessionVersion`. */
export type TokenClaims = { sub: string; role: 'administrador' | 'conductor'; exp?: number };

export const ADMIN_COOKIE = 'cv_admin';

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error('AUTH_SECRET is missing or shorter than 32 characters.');
  return value;
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Signs claims as `payload.signature` (base64url, HMAC-SHA256 with AUTH_SECRET). */
export function signToken<T extends TokenClaims>(claims: T) {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns the claims of a well-signed, unexpired token for the given role, or null. Only pilot tokens may lack `exp`. */
export function readToken(token: string | undefined, role: TokenClaims['role']): Record<string, unknown> | null {
  if (!token || token.length > 4096) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const exp = claims?.exp;
    const unexpired = typeof exp === 'number' ? exp * 1000 > Date.now() : exp === undefined && role === 'conductor';
    if (claims?.role !== role || typeof claims.sub !== 'string' || !unexpired) return null;
    return claims;
  } catch {
    return null;
  }
}
