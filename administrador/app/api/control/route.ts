import { handleAdminRequest } from '@/server/auth/admin';
import { readJsonObject } from '@/server/http';
import { getSpeedControl, saveSpeedControl } from '@/server/control/speed';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return handleAdminRequest(request, async () => ({ ok: true, status: 200, body: await getSpeedControl() }));
}

export async function PUT(request: Request) {
  return handleAdminRequest(request, async admin => saveSpeedControl(await readJsonObject(request), {
    id: admin.id, username: admin.username, nombre: admin.nombre,
  }));
}
