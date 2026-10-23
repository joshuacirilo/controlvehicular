import { handleAdminRequest } from '@/server/auth/admin';
import { notificationAction } from '@/server/notifications/errors';
import { getEmailSettings } from '@/server/notifications/service';
import { saveEmailSettings } from '@/server/notifications/repository';
import { readNotificationInput } from '@/server/notifications/request';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return handleAdminRequest(request, () => notificationAction(getEmailSettings));
}
export function PUT(request: Request) {
  return handleAdminRequest(request, admin => notificationAction(async () => saveEmailSettings(await readNotificationInput(request), admin)));
}
