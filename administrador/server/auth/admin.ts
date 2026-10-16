import 'server-only';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, readToken, signToken, type TokenClaims } from '@/server/auth/token';
import { getDb } from '@/server/db/mongo';
import type { Result } from '@/server/trips/service';

const TTL_SECONDS = 8 * 60 * 60;

/** Matches the collation of the unique `email` index, so lookups are case-insensitive and use it. */
export const USER_COLLATION = { locale: 'en', strength: 2 };

export type UserDoc = {
  _id: ObjectId;
  email: string;
  username?: string;
  nombre?: string;
  passwordHash: string;
  rol: 'administrador' | 'conductor';
  activo: boolean;
  failedLogins?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminUser = { id: string; username: string; nombre: string; email: string };

export async function usersCollection() {
  return (await getDb()).collection<UserDoc>('users');
}

export function toAdminUser(user: Pick<UserDoc, '_id' | 'email' | 'username' | 'nombre'>): AdminUser {
  const username = user.username ?? user.email;
  return { id: user._id.toHexString(), username, nombre: user.nombre ?? username, email: user.email };
}

export function adminJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Cookie-authenticated mutations must come from the panel itself (CSRF protection). */
export function isSameOrigin(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  try {
    return origin !== null && new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

export async function startAdminSession(userId: ObjectId) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const token = signToken<TokenClaims>({ sub: userId.toHexString(), role: 'administrador', exp });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TTL_SECONDS,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** Returns the signed-in administrator, re-checking the database so deactivation takes effect immediately. */
export async function getAdmin(): Promise<AdminUser | null> {
  const claims = readToken((await cookies()).get(ADMIN_COOKIE)?.value, 'administrador');
  if (!claims || typeof claims.sub !== 'string' || !ObjectId.isValid(claims.sub)) return null;
  const user = await (await usersCollection()).findOne(
    { _id: new ObjectId(claims.sub), rol: 'administrador', activo: true },
    { projection: { email: 1, username: 1, nombre: 1 } },
  );
  return user && toAdminUser(user);
}

/** Authorizes an administrator and maps service results and database failures to HTTP responses. */
export async function handleAdminRequest(
  request: Request,
  action: (admin: AdminUser) => Promise<Result<unknown>>,
) {
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOrigin(request)) {
    return adminJson({ message: 'Origen no permitido.' }, 403);
  }
  try {
    const admin = await getAdmin();
    if (!admin) return adminJson({ message: 'Sesión de administrador inválida o vencida.' }, 401);
    const result = await action(admin);
    return result.ok ? adminJson(result.body, result.status) : adminJson({ message: result.message }, result.status);
  } catch (error) {
    // Driver errors can embed the connection string; log only their type.
    console.error('[admin] request failed', (error as Error)?.name, (error as { code?: unknown })?.code);
    return adminJson({ message: 'El servicio no está disponible. Intenta de nuevo.' }, 503);
  }
}
