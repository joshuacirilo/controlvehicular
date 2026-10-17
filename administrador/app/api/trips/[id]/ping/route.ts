import { preflight, readJsonObject, reply } from '@/server/http';
import { handleDriverRequest, parseTripId } from '@/server/trips/handler';
import { MAX_PINGS_PER_REQUEST, parsePing, type PingInput } from '@/server/trips/pings';
import { recordPings } from '@/server/trips/service';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: RouteContext<'/api/trips/[id]/ping'>) {
  const tripId = parseTripId((await ctx.params).id);
  if (!tripId) return reply(request, { message: 'Viaje no encontrado.' }, 404);
  const body = await readJsonObject(request);
  const raw = body?.pings;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PINGS_PER_REQUEST) {
    return reply(request, { message: `Envía entre 1 y ${MAX_PINGS_PER_REQUEST} ubicaciones.` }, 400);
  }
  const now = new Date();
  const pings = raw.map(item => parsePing(item, now));
  if (pings.some(ping => ping === null)) return reply(request, { message: 'Datos de ubicación inválidos.' }, 400);
  return handleDriverRequest(request, session => recordPings(session, tripId, pings as PingInput[]));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
