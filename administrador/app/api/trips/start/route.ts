import { preflight, readJsonObject, reply } from '@/server/http';
import { handleDriverRequest } from '@/server/trips/handler';
import { parsePing } from '@/server/trips/pings';
import { startTrip, type TruckQr } from '@/server/trips/service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!body) return reply(request, { message: 'Solicitud inválida.' }, 400);
  const { placa, password } = body;
  let qr: TruckQr | null = null;
  if (placa !== undefined || password !== undefined) {
    if (typeof placa !== 'string' || typeof password !== 'string' || !placa.trim() || !password ||
        placa.length > 20 || password.length > 128) {
      return reply(request, { message: 'El QR debe contener la placa y la contraseña del camión.' }, 400);
    }
    qr = { placa, password };
  }
  const ping = body.ping === undefined ? null : parsePing(body.ping);
  if (body.ping !== undefined && !ping) return reply(request, { message: 'Ubicación inicial inválida.' }, 400);
  return handleDriverRequest(request, session => startTrip(session, qr, ping));
}

export function OPTIONS(request: Request) {
  return preflight(request);
}
