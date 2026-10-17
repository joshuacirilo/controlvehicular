import { loginUser } from '@/server/auth/driver-login';
import { preflight, readJsonObject, reply } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!username || !password || username.length > 254 || password.length > 128) {
    return reply(request, { message: 'Ingresa usuario y contraseña.' }, 400);
  }
  try {
    const result = await loginUser(username, password);
    return result.ok ? reply(request, result.body) : reply(request, { message: result.message }, result.status);
  } catch (error) {
    // Driver errors can embed the connection string; log only their type.
    console.error('[auth] login failed', (error as Error)?.name, (error as { code?: unknown })?.code);
    return reply(request, { message: 'El servicio no está disponible. Intenta de nuevo.' }, 503);
  }
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
