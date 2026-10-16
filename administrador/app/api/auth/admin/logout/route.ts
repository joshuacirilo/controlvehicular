import { adminJson, endAdminSession, isSameOrigin } from '@/server/auth/admin';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ message: 'Origen no permitido.' }, 403);
  await endAdminSession();
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
