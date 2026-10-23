import { handleAdminRequest } from '@/server/auth/admin';
import { changeProfileEmail } from '@/server/accounts/profile-email';
import { readNotificationInput } from '@/server/notifications/request';
import { notificationAction } from '@/server/notifications/errors';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return handleAdminRequest(request, admin => notificationAction(async () => changeProfileEmail(admin, await readNotificationInput(request))));
}
