import 'server-only';
import { NotificationError } from '@/server/notifications/errors';
import { providerError } from '@/server/notifications/provider-error';

function config(emergency = false) {
  const env = process.env;
  return { service_id: env.EMAILJS_SERVICE_ID?.trim(),
    template_id: (emergency ? env.EMAILJS_EMERGENCY_TEMPLATE_ID : env.EMAILJS_NOTIFICATION_TEMPLATE_ID)?.trim(),
    user_id: env.EMAILJS_PUBLIC_KEY?.trim(), accessToken: env.EMAILJS_PRIVATE_KEY?.trim() };
}
export function emailjsConfigured(emergency = false) { return Object.values(config(emergency)).every(Boolean); }

export type NotificationParams = { to_email: string; subject: string; title: string; message: string; details: string; action_url: string; button_text: string };
export type EmergencyParams = { to_email: string; driver_name: string; vehicle_plate: string; location: string; event_date: string };

/** Trusted deployment configuration only; never derive links from request Host/Origin. */
export function appUrl(path = '/') {
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://controlvehicular-owwh.vercel.app');
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new NotificationError(503, 'Configura la URL HTTPS de la aplicación.');
  if (!path.startsWith('/') || path.startsWith('//')) throw new NotificationError(400, 'Ruta inválida.');
  return new URL(path, base.origin).href;
}

// Backend-only transport: callers must authorize recipients and reserve their quotas.
export const sendNotification = (params: NotificationParams) => sendTemplate(params, false);
export const sendEmergency = (params: EmergencyParams) => sendTemplate(params, true);

export async function sendEmailJS(input: { to: string; subject: string; message: string; reportType: string }) {
  return sendNotification({ to_email: input.to, subject: input.subject, title: input.subject,
    message: input.message, details: input.reportType, action_url: appUrl('/notificaciones'), button_text: 'Abrir notificaciones' });
}

async function sendTemplate(params: NotificationParams | EmergencyParams, emergency: boolean) {
  if (!emailjsConfigured(emergency)) throw new NotificationError(503, 'El envío de correos aún no está configurado en el servidor.');
  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      signal: AbortSignal.timeout(12000), redirect: 'error',
      body: JSON.stringify({ ...config(emergency), template_params: params }),
    });
    // Never echo provider response bodies: they can contain credentials or recipient data.
    if (!response.ok) {
      const diagnostic = await providerError(response);
      console.warn('[notifications] provider_rejected', response.status, diagnostic.code);
      throw new NotificationError(response.status === 429 ? 429 : 502, diagnostic.message);
    }
  } catch (error) {
    if (error instanceof NotificationError) throw error;
    console.warn('[notifications] provider_unconfirmed');
    throw new NotificationError(502, 'No se pudo confirmar el envío. Revisa la bandeja antes de volver a intentarlo.');
  }
}
