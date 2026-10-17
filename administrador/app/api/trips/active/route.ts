import { preflight } from '@/server/http';
import { handleDriverRequest } from '@/server/trips/handler';
import { activeTrip } from '@/server/trips/service';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleDriverRequest(request, activeTrip);
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
