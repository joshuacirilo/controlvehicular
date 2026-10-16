import 'server-only';

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = (process.env.CORS_ALLOWED_ORIGINS ??
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8080,http://127.0.0.1:8080' : ''))
    .split(',').map(value => value.trim()).filter(Boolean);
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  if (origin && allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
  }
  return headers;
}
