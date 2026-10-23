'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeNotificationEmail, type EmailSettings, type EmailSettingsView } from '@/lib/email-settings';

const dateTime = new Intl.DateTimeFormat('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'medium', timeStyle: 'short' });

export function EmailSettingsForm() {
  const router = useRouter();
  const [saved, setSaved] = useState<EmailSettings | null>(null);
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [emergencyConfigured, setEmergencyConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const lock = useRef(false);
  const dirty = !saved || normalizeNotificationEmail(email) !== saved.email || enabled !== saved.enabled;

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/settings/email', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (response.status === 401) { router.replace('/'); return; }
        if (!response.ok) throw new Error();
        const result: EmailSettingsView = await response.json();
        if (controller.signal.aborted) return;
        setSaved(result.settings); setEmail(result.settings?.email ?? ''); setEnabled(result.settings?.enabled ?? false);
        setConfigured(result.providerConfigured); setEmergencyConfigured(result.emergencyProviderConfigured); setLoaded(true);
      } catch { if (!controller.signal.aborted) setError('No se pudo cargar la configuración. Recarga la página para reintentar.'); }
    })();
    return () => controller.abort();
  }, [router]);

  async function run(action: 'save' | 'verification' | 'verify' | 'test') {
    if (lock.current || !loaded) return;
    setError(''); setMessage('');
    if (action === 'save' && !normalizeNotificationEmail(email)) { setError('Ingresa un correo válido.'); return; }
    lock.current = true; setBusy(action);
    try {
      const url = action === 'save' ? '/api/settings/email' : action === 'test' ? '/api/notifications/test' : `/api/settings/email/${action}`;
      const body = action === 'save' ? { email, enabled, revision: saved?.revision ?? null }
        : action === 'verify' ? { code, revision: saved?.revision } : { revision: saved?.revision };
      const response = await fetch(url, { method: action === 'save' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
      if (response.status === 401) { router.replace('/'); return; }
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? 'No se pudo completar la operación.');
        if (response.status === 409) setMessage('Si otro administrador hizo cambios, recarga esta página.');
        return;
      }
      if (action === 'save' || action === 'verify') {
        const settings = result as EmailSettings;
        setSaved(settings); setEmail(settings.email); setEnabled(settings.enabled); setCode('');
        setMessage(action === 'save' ? 'Configuración guardada.' : 'Correo verificado. Ya puedes enviar una prueba.');
      } else {
        setMessage(action === 'verification' ? 'EmailJS aceptó el envío del código. Revisa la bandeja y spam; vence en 10 minutos.' : result.message);
      }
    } catch { setError('No se pudo confirmar la operación. Recarga para comprobar los cambios y revisa tu bandeja antes de repetir un envío.'); }
    finally { lock.current = false; setBusy(''); }
  }

  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void run('save'); }
  const canSend = loaded && configured && saved?.enabled && !dirty && !busy;
  return <section className="account-card email-settings" aria-labelledby="email-title">
    <h2 id="email-title">Correo destinatario</h2>
    <p className="layer-note">Configura quién recibe las notificaciones. Un correo nuevo requiere verificación antes de recibir reportes.</p>
    {!loaded && !error && <p role="status">Cargando configuración…</p>}
    {loaded && !configured && <p className="account-error">El servicio de correo aún no está configurado en el servidor. Puedes guardar el destinatario; los envíos estarán disponibles cuando se configure.</p>}
    {loaded && !emergencyConfigured && <p className="account-error">Falta configurar el correo de emergencias. Los SOS se registrarán en el panel.</p>}
    {saved && <div className="control-summary">
      <p><strong>{saved.enabled ? 'Notificaciones activadas' : 'Notificaciones desactivadas'}</strong> · {saved.verifiedAt ? 'Correo verificado' : 'Verificación pendiente'}</p>
      <p>Última modificación: {dateTime.format(new Date(saved.updatedAt))} (Guatemala), por {saved.updatedBy.nombre}.</p>
    </div>}
    <form onSubmit={save} aria-busy={!!busy}>
      <fieldset disabled={!loaded || !!busy}><legend className="sr-only">Destinatario y estado</legend>
        <div className="account-fields"><label htmlFor="notification-email">Correo electrónico
          <input id="notification-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => { setEmail(event.target.value); setMessage(''); }} />
        </label></div>
        <label className="email-toggle"><input type="checkbox" role="switch" checked={enabled} onChange={event => { setEnabled(event.target.checked); setMessage(''); }} /> Activar notificaciones</label>
        <button className="primary-button" type="submit">{busy === 'save' ? 'Guardando…' : 'Guardar cambios'}</button>
      </fieldset>
    </form>
    {saved && !saved.verifiedAt && <section aria-labelledby="email-verify-title">
      <h2 id="email-verify-title">Verificar destinatario</h2>
      <p className="layer-note">Guarda y activa las notificaciones, solicita un código y escríbelo aquí. No se enviarán reportes hasta verificarlo.</p>
      <button className="pagination-button" type="button" disabled={!canSend} onClick={() => void run('verification')}>{busy === 'verification' ? 'Enviando…' : 'Enviar código de verificación'}</button>
      <form onSubmit={event => { event.preventDefault(); void run('verify'); }}>
        <fieldset disabled={!canSend}><legend className="sr-only">Código de verificación</legend>
          <div className="account-fields"><label htmlFor="email-verification-code">Código de seis dígitos
            <input id="email-verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value)} />
          </label></div>
          <button className="pagination-button" type="submit">{busy === 'verify' ? 'Verificando…' : 'Verificar correo'}</button>
        </fieldset>
      </form>
    </section>}
    <div className="email-actions"><button type="button" className="pagination-button" disabled={!canSend || !saved?.verifiedAt} onClick={() => void run('test')}>{busy === 'test' ? 'Enviando prueba…' : 'Enviar correo de prueba'}</button>
      <p className="layer-note">Guarda los cambios antes de enviar. Espera un minuto entre correos; máximo 20 intentos al día.</p>
    </div>
    {error && <p className="account-error" role="alert">{error}</p>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
