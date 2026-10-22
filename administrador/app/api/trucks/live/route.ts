import { handleAdminRequest } from '@/server/auth/admin';
import { liveTrucks } from '@/server/trucks/live';

export const runtime = 'nodejs';

export function GET(request: Request) {
  return handleAdminRequest(request, () => {
    const trip = new URL(request.url).searchParams.get('trip');
    return liveTrucks(trip && /^[a-fA-F0-9]{24}$/.test(trip) ? trip.toLowerCase() : undefined);
  });
}
