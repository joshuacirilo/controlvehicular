import { checkCredentials } from '@/server/auth/accounts';
import {
  USER_COLLATION, adminJson, isSameOrigin, startAdminSession, toAdminUser, usersCollection,
} from '@/server/auth/admin';
import { readJsonObject } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ message: 'Origen no permitido.' }, 403);
  const body = await readJsonObject(request);
  const login = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!login || !password || login.length > 254 || password.length > 128) {
    return adminJson({ message: 'Ingresa usuario y contraseña.' }, 400);
  }
  try {
    const users = await usersCollection();
    const user = await users.findOne(
      { rol: 'administrador', activo: true, $or: [{ username: login }, { email: login }] },
      { collation: USER_COLLATION },
    );
    const check = await checkCredentials('users', user, password);
    if (!check.ok) {
      return check.reason === 'locked'
        ? adminJson({ message: 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.' }, 429)
        : adminJson({ message: 'Usuario o contraseña incorrectos.' }, 401);
    }
    await users.updateOne({ _id: check.account._id }, { $set: { lastLoginAt: new Date() } });
    await startAdminSession(check.account._id);
    return adminJson({ user: toAdminUser(check.account) });
  } catch (error) {
    console.error('[admin] login failed', (error as Error)?.name, (error as { code?: unknown })?.code);
    return adminJson({ message: 'El servicio no está disponible. Intenta de nuevo.' }, 503);
  }
}
