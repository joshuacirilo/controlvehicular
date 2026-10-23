import { after } from 'next/server';
import { handleAdminRequest } from '@/server/auth/admin';
import { notificationAction } from '@/server/notifications/errors';
import { readNotificationInput } from '@/server/notifications/request';
import { acknowledgeIncident, dispatchIncident, listIncidents } from '@/server/notifications/incidents';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return handleAdminRequest(request, () => notificationAction(async () => {
    const incidents = await listIncidents();
    after(async () => { try { await dispatchIncident(); } catch { console.warn('[notifications] dispatch_failed'); } });
    return { incidents };
  }));
}
export async function POST(request: Request) {
  return handleAdminRequest(request, admin => notificationAction(async () => acknowledgeIncident((await readNotificationInput(request)).id, admin.id)));
}
