import { handleAdminRequest } from '@/server/auth/admin';
import { notificationAction } from '@/server/notifications/errors';
import { sendTestNotification } from '@/server/notifications/service';
import { readNotificationInput, requireRevision } from '@/server/notifications/request';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return handleAdminRequest(request, () => notificationAction(async () => sendTestNotification(requireRevision(await readNotificationInput(request)))));
}
