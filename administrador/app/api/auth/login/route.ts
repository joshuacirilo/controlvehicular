import { corsHeaders } from '@/server/cors';
import { verifyTestLogin } from '@/server/auth/test-login';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  // Test credentials must never enable access in a deployed environment.
  if (process.env.NODE_ENV !== 'development' || process.env.VERCEL) {
    return Response.json({ message: 'Acceso de prueba deshabilitado.' }, { status: 403, headers });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return Response.json({ message: 'Se requiere JSON.' }, { status: 415, headers });
  }
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ message: 'Solicitud invalida.' }, { status: 400, headers });
  }
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' ||
      !body.username.trim() || !body.password || body.username.length > 80 || body.password.length > 128) {
    return Response.json({ message: 'Ingresa usuario y contrase?a.' }, { status: 400, headers });
  }
  const user = verifyTestLogin(body.username.trim(), body.password);
  if (!user) return Response.json({ message: 'Usuario o contrase?a incorrectos.' }, { status: 401, headers });
  // Connectivity demo only: no session, token, or access to protected resources.
  return Response.json({ mode: 'test', user }, { headers });
}
export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
