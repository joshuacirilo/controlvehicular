import 'server-only';
import { NotificationError } from '@/server/notifications/errors';

/** Small configuration bodies only, including when Content-Length is omitted. */
export async function readNotificationInput(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json') || !request.body) throw new NotificationError(400, 'Envía un objeto JSON.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) { await reader.cancel(); throw new NotificationError(413, 'La solicitud es demasiado grande.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NotificationError) throw error;
    throw new NotificationError(400, 'El cuerpo JSON no es válido.');
  } finally { reader.releaseLock(); }
}
export function requireRevision(input: Record<string, unknown>, extra: string[] = []) {
  if (Object.keys(input).some(key => !['revision', ...extra].includes(key)) || typeof input.revision !== 'string' || !/^[a-f0-9-]{36}$/.test(input.revision)) {
    throw new NotificationError(400, 'La solicitud no es válida. No se permiten destinatarios ni contenido personalizado.');
  }
  return input.revision;
}
