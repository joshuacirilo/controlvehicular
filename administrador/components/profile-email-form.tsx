'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function ProfileEmailForm({ email }: { email: string }) {
  const router = useRouter(), lock = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>, action: 'request' | 'verify') {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget, data = new FormData(form);
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/profile/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify(action === 'request' ? { action, email: data.get('email'), currentPassword: data.get('currentPassword') } : { action, code: data.get('code') }) });
      const result = await response.json();
      if (response.status === 401) { router.replace('/'); return; }
      if (!response.ok) { setError(result.message ?? 'No se pudo actualizar el correo.'); return; }
      setMessage(result.message); form.reset(); if (result.verified) router.refresh();
    } catch { setError('No se pudo confirmar la operación. Revisa tu correo o recarga el perfil antes de reintentar.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="account-card"><h2>Correo electrónico</h2><p>Correo actual: <strong>{email || 'Sin correo'}</strong></p>
    <p>Agrega o cambia el correo para iniciar sesión y recuperar tu cuenta. El nuevo correo se guardará cuando verifiques el código.</p>
    <form onSubmit={event => submit(event, 'request')} aria-busy={busy}><fieldset className="account-fields" disabled={busy}>
      <label>Nuevo correo electrónico<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>
      <label>Contraseña actual<input type="password" name="currentPassword" autoComplete="current-password" maxLength={128} required /></label>
      <button className="primary-button">Enviar código de verificación</button>
    </fieldset></form>
    <form onSubmit={event => submit(event, 'verify')} aria-busy={busy}><fieldset className="account-fields" disabled={busy}>
      <label>Código recibido<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required /></label>
      <p className="layer-note">El código vence en 10 minutos. Puedes ingresarlo aunque hayas recargado esta página.</p>
      <button className="pagination-button">Verificar y guardar correo</button>
    </fieldset></form>
    {message && <p role="status">{message}</p>}{error && <p className="account-error" role="alert">{error}</p>}
  </section>;
}
