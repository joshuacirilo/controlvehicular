import { handleAdminRequest } from '@/server/auth/admin';
import { liveTrucks } from '@/server/trucks/live';

export const runtime = 'nodejs';

export function GET(request: Request) {
  return handleAdminRequest(request, () => liveTrucks());
}
