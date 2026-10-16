import { corsHeaders } from '@/server/cors';
// Liveness only; does not check Atlas.
export function GET(request: Request) {
  return Response.json({ status: 'ok', service: 'control-vehicular-api' }, { headers: corsHeaders(request) });
}
export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
