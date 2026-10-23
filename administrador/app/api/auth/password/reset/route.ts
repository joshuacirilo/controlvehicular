import { adminJson, isSameOrigin } from '@/server/auth/admin';
import { completePasswordReset } from '@/server/auth/password-reset';
import { readNotificationInput } from '@/server/notifications/request';
import { NotificationError } from '@/server/notifications/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ message: 'Origen no permitido.' }, 403);
  try { return adminJson(await completePasswordReset(await readNotificationInput(request))); }
  catch (error) { return adminJson({ message: error instanceof NotificationError ? error.message : 'Servicio no disponible.' }, error instanceof NotificationError ? error.status : 503); }
}
