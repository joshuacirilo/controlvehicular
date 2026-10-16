import { preflight, readJsonObject, reply } from '@/server/http';
import { handleDriverRequest } from '@/server/trips/handler';
import { parsePing } from '@/server/trips/pings';
import { startTrip } from '@/server/trips/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const qrCode = typeof body?.qrCode === 'string' ? body.qrCode.trim() : '';
  if (!qrCode || qrCode.length > 200) return reply(request, { message: 'Escanea el QR del camión.' }, 400);
  const ping = body?.ping === undefined ? null : parsePing(body.ping);
  if (body?.ping !== undefined && !ping) return reply(request, { message: 'Ubicación inicial inválida.' }, 400);
  return handleDriverRequest(request, session => startTrip(session, qrCode, ping));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
