import { after } from 'next/server';
import { adminJson, isSameOrigin } from '@/server/auth/admin';
import { normalizeNotificationEmail } from '@/lib/email-settings';
import { requestPasswordReset, RESET_RESPONSE } from '@/server/auth/password-reset';
import { readNotificationInput } from '@/server/notifications/request';
import { takeGate } from '@/server/notifications/rate';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminJson({ message: 'Origen no permitido.' }, 403);
  try {
    const body = await readNotificationInput(request);
    const email = normalizeNotificationEmail(body.email);
    if (email && Object.keys(body).length === 1) {
      // A single bounded global record, including for nonexistent accounts.
      await takeGate('reset-requests', 10000);
      after(() => requestPasswordReset(email));
    }
  } catch { /* Same response for rate limits, invalid input, nonexistent accounts and failures. */ }
  return adminJson({ message: RESET_RESPONSE });
}
