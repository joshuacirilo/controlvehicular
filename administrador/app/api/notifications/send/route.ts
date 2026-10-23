import { handleAdminRequest } from '@/server/auth/admin';
import { NotificationError, notificationAction } from '@/server/notifications/errors';
import { sendReportNotification } from '@/server/notifications/service';
import { readNotificationInput, requireRevision } from '@/server/notifications/request';
export const runtime = 'nodejs';

/** Fixed, non-sensitive report for exercising the integration; arbitrary content is never accepted. */
export function POST(request: Request) {
  return handleAdminRequest(request, () => notificationAction(async () => {
    const input = await readNotificationInput(request);
    const revision = requireRevision(input, ['reportType']);
    if (input.reportType !== 'notification-status') throw new NotificationError(400, 'Tipo de reporte no permitido.');
    return sendReportNotification({ reportType: 'notification-status', subject: 'Estado de notificaciones de Control vehicular',
      message: 'El administrador solicitó este reporte de configuración. Las notificaciones están activadas y el correo destinatario está verificado. Los reportes operativos se integrarán posteriormente.' }, revision);
  }));
}
