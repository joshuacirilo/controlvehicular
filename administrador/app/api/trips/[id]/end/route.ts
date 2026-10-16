import { preflight, reply } from '@/server/http';
import { handleDriverRequest, parseTripId } from '@/server/trips/handler';
import { endTrip } from '@/server/trips/service';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: RouteContext<'/api/trips/[id]/end'>) {
  const tripId = parseTripId((await ctx.params).id);
  if (!tripId) return reply(request, { message: 'Viaje no encontrado.' }, 404);
  return handleDriverRequest(request, session => endTrip(session, tripId));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
