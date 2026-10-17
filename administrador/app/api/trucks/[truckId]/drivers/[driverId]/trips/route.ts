import { ObjectId } from 'mongodb';
import { handleAdminRequest } from '@/server/auth/admin';
import { driverTrips } from '@/server/trucks/history';

export const runtime = 'nodejs';

const parseId = (id: string) => /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;

export async function GET(request: Request, ctx: RouteContext<'/api/trucks/[truckId]/drivers/[driverId]/trips'>) {
  const { truckId, driverId } = await ctx.params;
  const rawPage = new URL(request.url).searchParams.get('page') ?? '1';
  return handleAdminRequest(request, async () => {
    const truck = parseId(truckId);
    const driver = parseId(driverId);
    if (!truck || !driver) return { ok: false, status: 404, message: 'Camión o conductor no encontrado.' };
    if (!/^[1-9]\d{0,5}$/.test(rawPage)) return { ok: false, status: 400, message: 'Página inválida.' };
    return driverTrips(truck, driver, Number(rawPage));
  });
}
