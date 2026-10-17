import { revokeDriverSessions } from '@/server/auth/session';
import { preflight } from '@/server/http';
import { handleDriverRequest } from '@/server/trips/handler';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleDriverRequest(request, async session => {
    await revokeDriverSessions(session);
    return { ok: true, status: 200, body: { loggedOut: true } };
  });
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
