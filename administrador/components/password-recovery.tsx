'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    if (reset) {
      const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
      // Capture browser-only fragment once; Strict Mode's second effect must not erase it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (value) setToken(value);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [reset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget);
    if (reset && data.get('password') !== data.get('confirm')) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await fetch(`/api/auth/password/${reset ? 'reset' : 'forgot'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { token, password: data.get('password') } : { email: data.get('email') }), signal: AbortSignal.timeout(15000) });
      const result = await response.json();
      if (!response.ok) setError(result.message ?? 'No se pudo procesar la solicitud.');
      else { setMessage(result.message); if (reset) setToken(''); }
    } catch { setError('No se pudo confirmar la solicitud. Comprueba tu conexión.'); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card">
    <h1>{reset ? 'Nueva contraseña' : 'Recuperar contraseña'}</h1>
    <p>{reset ? 'Crea una contraseña de 12 a 128 caracteres.' : 'Ingresa el correo de tu cuenta de administrador o conductor.'}</p>
    <form onSubmit={submit} aria-busy={busy}>
      {reset ? <><label htmlFor="password">Nueva contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} />
        <label htmlFor="confirm">Confirmar contraseña</label><input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} /></>
        : <><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy} /></>}
      <button className="primary-button" disabled={busy || (reset && !token)}>{busy ? 'Procesando…' : reset ? 'Guardar contraseña' : 'Solicitar enlace'}</button>
    </form>
    {error && <p role="alert" className="login-error">{error}</p>}{message && <p role="status">{message}</p>}
    {reset && !token && !message && <p>Abre el enlace completo recibido por correo o solicita uno nuevo.</p>}
    <Link href={reset ? '/recuperar' : '/'}>{reset ? 'Solicitar otro enlace' : 'Volver al inicio'}</Link>
  </section></main>;
}
