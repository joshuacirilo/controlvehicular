import { preflight, reply } from '@/server/http';
import { handleDriverRequest, parseTripId } from '@/server/trips/handler';
import { resumeTrip } from '@/server/trips/pause';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: RouteContext<'/api/trips/[id]/resume'>) {
  const tripId = parseTripId((await ctx.params).id);
  if (!tripId) return reply(request, { message: 'Viaje no encontrado.' }, 404);
  return handleDriverRequest(request, session => resumeTrip(session, tripId));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
