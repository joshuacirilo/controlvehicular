import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, readToken } from '@/server/auth/token';

// Optimistic check only (signature and expiry). The panel layout and every admin API handler re-authorize.
export function proxy(request: NextRequest) {
  if (readToken(request.cookies.get(ADMIN_COOKIE)?.value, 'administrador')) return NextResponse.next();
  return NextResponse.redirect(new URL('/', request.url));
}

export const config = {
  matcher: ['/dashboard/:path*', '/mapa/:path*', '/camiones/:path*', '/cuentas/:path*', '/perfil/:path*'],
};
