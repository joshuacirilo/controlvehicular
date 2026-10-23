import 'server-only';
import { emailjsConfigured, sendEmailJS } from '@/server/notifications/emailjs';
import { NotificationError } from '@/server/notifications/errors';
import { takeGate } from '@/server/notifications/rate';
import { createVerification, finishDelivery, getEmailRecord, publicSettings, reserveEmailSend, startDelivery, type SettingsRecord } from '@/server/notifications/repository';

export async function getEmailSettings() {
  const row = await getEmailRecord();
  return { settings: row ? publicSettings(row) : null, providerConfigured: emailjsConfigured(), emergencyProviderConfigured: emailjsConfigured(true) };
}

async function authorizedRecipient(verified: boolean, revision?: string) {
  const row = await getEmailRecord();
  if (!row) throw new NotificationError(409, 'Guarda primero el correo destinatario.');
  if (revision !== undefined && row.revision !== revision) throw new NotificationError(409, 'La configuración cambió. Recarga antes de enviar.');
  if (!row.enabled) throw new NotificationError(409, 'Las notificaciones están desactivadas.');
  if (verified && !row.verifiedAt) throw new NotificationError(409, 'Verifica el correo destinatario antes de enviar reportes o pruebas.');
  if (!emailjsConfigured()) throw new NotificationError(503, 'El envío de correos aún no está configurado en el servidor.');
  return row;
}

async function deliver(row: SettingsRecord, report: { subject: string; message: string; reportType: string }) {
  const current = await getEmailRecord();
  if (!current?.enabled || current.revision !== row.revision) throw new NotificationError(409, 'La configuración cambió. Recarga antes de enviar.');
  const deliveryId = await startDelivery(report.reportType, row.revision);
  try {
    await takeGate('provider', 1100);
    await sendEmailJS({ ...report, to: current.email });
  } catch (error) {
    await finishDelivery(deliveryId, 'unconfirmed');
    throw error;
  }
  await finishDelivery(deliveryId, 'accepted');
  return { deliveryId, status: 'accepted' as const, message: 'EmailJS aceptó el correo. Comprueba la bandeja de entrada y spam.' };
}

/** Backend-only reusable entry point. Recipient and enabled/verified state always come from MongoDB. */
export async function sendReportNotification(report: { subject: string; message: string; reportType: string }, expectedRevision?: string) {
  if (typeof report.subject !== 'string' || !report.subject.trim() || report.subject.length > 150 || /[\r\n]/.test(report.subject) ||
    typeof report.message !== 'string' || !report.message.trim() || report.message.length > 8000 ||
    !/^[a-z0-9_-]{1,50}$/.test(report.reportType)) throw new NotificationError(400, 'El contenido del reporte no es válido.');
  const row = await authorizedRecipient(true, expectedRevision);
  await reserveEmailSend();
  return deliver(row, { subject: report.subject, message: report.message, reportType: report.reportType });
}

export async function requestEmailVerification(revision: string) {
  const row = await authorizedRecipient(false, revision);
  if (row.verifiedAt) throw new NotificationError(409, 'El correo ya está verificado.');
  await reserveEmailSend();
  const code = await createVerification(row);
  return deliver(row, { subject: 'Verifica el correo de Control vehicular', reportType: 'verification',
    message: `Código de verificación: ${code}\nVence en 10 minutos y admite hasta 5 intentos. Ingresa el código en Configuración de notificaciones. Si no solicitaste este cambio, ignora este correo.` });
}

export async function sendTestNotification(revision: string) {
  return sendReportNotification({ subject: 'Prueba de notificaciones de Control vehicular', reportType: 'test',
    message: 'Esta es una prueba solicitada desde el panel administrativo. El correo configurado está listo para recibir notificaciones. No contiene datos de pilotos ni recorridos.' }, revision);
}
