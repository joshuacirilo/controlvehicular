/** Only fixed labels/messages leave this boundary, never provider-controlled text. */
export async function providerError(response: Response) {
  let text = '';
  const reader = response.body?.getReader();
  if (reader) {
    try {
      let bytes = 0;
      const decoder = new TextDecoder();
      while (bytes < 4096) {
        const { value, done } = await reader.read();
        if (done) break;
        const part = value.subarray(0, 4096 - bytes);
        bytes += part.length; text += decoder.decode(part, { stream: true });
      }
    } catch { /* Retain the HTTP status if the body cannot be read. */ }
    finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
  }
  const body = text.toLowerCase();
  if (response.status === 429) return { code: 'rate_limit', message: 'EmailJS alcanzó su límite de envíos. Intenta más tarde.' };
  if (/non.browser/.test(body) && /disabled|not allowed|forbidden/.test(body)) return {
    code: 'non_browser_disabled', message: 'EmailJS indica que el acceso desde servidor está deshabilitado. Revisa Account → Security en la cuenta correspondiente a EMAILJS_PUBLIC_KEY.' };
  if (/private.?key|access.?token/.test(body)) return {
    code: 'private_key', message: 'EmailJS señala un problema con la clave privada. Revisa EMAILJS_PRIVATE_KEY y la autorización de clave privada en Account → Security; después reinicia Next.js o vuelve a desplegar.' };
  if (/public.?key|user.?id/.test(body)) return {
    code: 'public_key', message: 'EmailJS señala un problema con la clave pública. Revisa EMAILJS_PUBLIC_KEY y que corresponda a la misma cuenta del servicio y las plantillas.' };
  if (/origin|domain|whitelist|allowlist/.test(body)) return {
    code: 'origin_restricted', message: 'EmailJS señala una restricción de origen o dominio. Revisa las restricciones de Account → Security para solicitudes desde servidor.' };
  if (/captcha/.test(body)) return {
    code: 'captcha', message: 'EmailJS exige CAPTCHA para esta plantilla. Revisa su configuración: este flujo se ejecuta desde servidor, sin un CAPTCHA del navegador.' };
  if (/template/.test(body)) return { code: 'template', message: 'EmailJS señala un problema con la plantilla. Revisa su ID, permisos y que pertenezca a la misma cuenta.' };
  if (/service/.test(body)) return { code: 'service', message: 'EmailJS señala un problema con el servicio de correo. Revisa EMAILJS_SERVICE_ID y la conexión del servicio en EmailJS.' };
  return { code: response.status === 403 ? 'forbidden_unknown' : 'provider_unknown', message:
    response.status === 403 ? 'EmailJS rechazó la autorización (403) sin una causa reconocida. Consulta el detalle del intento en EmailJS y verifica que ambas claves, servicio y plantilla pertenezcan a la misma cuenta.' :
      'EmailJS rechazó el envío. Revisa el detalle del intento en EmailJS y la configuración del servicio.' };
}
