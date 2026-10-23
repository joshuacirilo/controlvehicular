'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProfileEmailForm } from '@/components/profile-email-form';

type User = { nombre: string; username: string; email: string };
export function ProfileForm({ user }: { user: User }) {
  const router = useRouter();
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(false);
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>, action: 'profile' | 'password') {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget, data = new FormData(form);
    setError(''); setMessage('');
    if (action === 'password' && data.get('newPassword') !== data.get('confirmPassword')) { setError('Las contraseñas nuevas no coinciden.'); return; }
    lock.current = true; setBusy(action);
    try {
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ action, currentPassword: data.get('currentPassword'), ...(action === 'profile' ? { nombre: data.get('nombre'), username: data.get('username') } : { newPassword: data.get('newPassword') }) }) });
      const result = await response.json();
      if (response.status === 401) { router.replace('/'); return; }
      if (!response.ok) { setError(result.message ?? 'No se pudo guardar.'); return; }
      form.querySelectorAll<HTMLInputElement>('input[type="password"]').forEach(input => { input.value = ''; });
      if (result.passwordChanged) { setPasswordChanged(true); return; }
      setMessage('Datos actualizados. Usa tu nuevo usuario al iniciar sesión.'); router.refresh();
    } catch { setError('No se pudo confirmar el cambio. Recarga para comprobar tus datos; si cambiaste la contraseña, intenta iniciar sesión con la nueva.'); }
    finally { lock.current = false; setBusy(''); }
  }
  if (passwordChanged) return <section className="account-card" role="status"><h2>Contraseña actualizada</h2><p>Tus sesiones anteriores se cerraron. Ingresa con tu nueva contraseña.</p><Link className="primary-button" href="/">Iniciar sesión</Link></section>;
  return <div className="email-settings">
    {error && <p className="account-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <section className="account-card"><h2>Datos personales</h2>
      <p>Correo de la cuenta: <strong>{user.email}</strong></p>
      <form onSubmit={event => submit(event, 'profile')} aria-busy={busy === 'profile'}>
        <fieldset disabled={Boolean(busy)} className="account-fields">
          <label>Nombre completo<input name="nombre" defaultValue={user.nombre} autoComplete="name" maxLength={120} required /></label>
          <label>Nombre de usuario<input name="username" defaultValue={user.username} autoComplete="username" minLength={3} maxLength={40} pattern="[A-Za-z0-9._\-]{3,40}" required /></label>
          <p className="layer-note">De 3 a 40 letras, números, puntos, guiones o guiones bajos.</p>
          <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required /></label>
          <button className="primary-button" type="submit">{busy === 'profile' ? 'Guardando…' : 'Guardar datos'}</button>
        </fieldset>
      </form>
    </section>
    <ProfileEmailForm email={user.email} />
    <section className="account-card"><h2>Cambiar contraseña</h2><p>Al guardar se cerrarán tus sesiones. Tendrás que iniciar sesión con la nueva contraseña.</p>
      <form onSubmit={event => submit(event, 'password')} aria-busy={busy === 'password'}>
        <fieldset disabled={Boolean(busy)} className="account-fields">
          <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required /></label>
          <label>Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <label>Confirmar nueva contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <p className="layer-note">Entre 12 y 128 caracteres.</p>
          <button className="primary-button" type="submit">{busy === 'password' ? 'Actualizando…' : 'Actualizar contraseña'}</button>
        </fieldset>
      </form>
    </section>
  </div>;
}
