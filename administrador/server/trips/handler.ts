import 'server-only';
import { ObjectId } from 'mongodb';
import { authenticateDriver, type DriverSession } from '@/server/auth/session';
import { reply } from '@/server/http';
import type { Result } from '@/server/trips/service';

export function parseTripId(id: string) {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

/** Authenticates the driver and maps service results and database failures to HTTP responses. */
export async function handleDriverRequest(
  request: Request,
  action: (session: DriverSession) => Promise<Result<unknown>>,
) {
  try {
    const session = await authenticateDriver(request);
    if (!session) return reply(request, { message: 'Tu sesión fue cerrada. Vuelve a iniciar sesión.' }, 401);
    const result = await action(session);
    return result.ok ? reply(request, result.body, result.status) : reply(request, { message: result.message }, result.status);
  } catch (error) {
    // Driver errors can embed the connection string; log only their type.
    console.error('[trips] request failed', (error as Error)?.name, (error as { code?: unknown })?.code);
    return reply(request, { message: 'El servicio no está disponible. Intenta de nuevo.' }, 503);
  }
}
