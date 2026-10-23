import { endAdminSession, handleAdminRequest } from '@/server/auth/admin';
import { updateProfile } from '@/server/accounts/profile';
import { readNotificationInput } from '@/server/notifications/request';
import { NotificationError } from '@/server/notifications/errors';
export const runtime = 'nodejs';
export async function PUT(request: Request) {
  return handleAdminRequest(request, async admin => {
    try {
      const result = await updateProfile(admin, await readNotificationInput(request));
      if (result.ok && result.body.passwordChanged) await endAdminSession();
      return result;
    } catch (error) {
      if (error instanceof NotificationError) return { ok: false, status: error.status, message: error.message };
      throw error;
    }
  });
}
