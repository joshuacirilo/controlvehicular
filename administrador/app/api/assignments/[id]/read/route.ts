import { markAssignment } from '@/server/assignments/service';
import { preflight, reply } from '@/server/http';
import { handleDriverRequest, parseTripId } from '@/server/trips/handler';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: RouteContext<'/api/assignments/[id]/read'>) {
  const id = parseTripId((await ctx.params).id);
  if (!id) return reply(request, { message: 'Asignación no encontrada.' }, 404);
  return handleDriverRequest(request, session => markAssignment(session, id, 'read'));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
