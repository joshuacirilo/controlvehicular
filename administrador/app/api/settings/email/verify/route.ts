import { handleAdminRequest } from '@/server/auth/admin';
import { notificationAction } from '@/server/notifications/errors';
import { verifyEmailCode } from '@/server/notifications/repository';
import { readNotificationInput } from '@/server/notifications/request';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return handleAdminRequest(request, admin => notificationAction(async () => verifyEmailCode(await readNotificationInput(request), admin)));
}
