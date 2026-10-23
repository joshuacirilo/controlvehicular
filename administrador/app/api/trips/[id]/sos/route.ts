import { after } from 'next/server';
import { handleDriverRequest, parseTripId } from '@/server/trips/handler';
import { preflight, reply } from '@/server/http';
import { notificationAction } from '@/server/notifications/errors';
import { createSos, dispatchIncident } from '@/server/notifications/incidents';
export const runtime = 'nodejs';
export async function POST(request: Request, context: RouteContext<'/api/trips/[id]/sos'>) {
  const id = parseTripId((await context.params).id);
  if (!id) return reply(request, { message: 'Viaje inválido.' }, 404);
  return handleDriverRequest(request, session => notificationAction(async () => {
    const result = await createSos(session, id);
    after(async () => { try { await dispatchIncident(); } catch { console.warn('[notifications] sos_dispatch_failed'); } });
    return { ...result, message: 'SOS registrado en el panel. Contacta también a emergencias o a tu central por teléfono.' };
  }));
}
export function OPTIONS(request: Request) { return preflight(request); }
