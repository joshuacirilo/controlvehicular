import { driverAssignments } from '@/server/assignments/service';
import { preflight } from '@/server/http';
import { handleDriverRequest } from '@/server/trips/handler';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleDriverRequest(request, session => driverAssignments(session));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
