import { preflight, readJsonObject, reply } from '@/server/http';
import { handleDriverRequest, parseTripId } from '@/server/trips/handler';
import { reportPausedMovement } from '@/server/trips/pause';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: RouteContext<'/api/trips/[id]/pause-movement'>) {
  const tripId = parseTripId((await ctx.params).id);
  if (!tripId) return reply(request, { message: 'Viaje no encontrado.' }, 404);
  const body = await readJsonObject(request);
  return handleDriverRequest(request, session => reportPausedMovement(session, tripId, body));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
