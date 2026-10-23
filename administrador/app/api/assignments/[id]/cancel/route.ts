import { handleAdminRequest } from '@/server/auth/admin';
import { cancelAssignment } from '@/server/assignments/service';
import { parseTripId } from '@/server/trips/handler';

export const runtime = 'nodejs';

export async function POST(request: Request, ctx: RouteContext<'/api/assignments/[id]/cancel'>) {
  const id = parseTripId((await ctx.params).id);
  return handleAdminRequest(request, async () => id
    ? cancelAssignment(id)
    : { ok: false, status: 404, message: 'Asignación no encontrada.' });
}
