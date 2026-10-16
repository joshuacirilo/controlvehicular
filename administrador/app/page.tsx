'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function Home() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.get('username'), password: data.get('password') }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Usuario o contraseña incorrectos.' :
          response.status === 429 ? 'Demasiados intentos fallidos. Espera unos minutos.' :
          response.status === 503 ? 'El servicio no está disponible. Intenta de nuevo.' : 'No se pudo ingresar. Intenta de nuevo.');
        return;
      }
      router.replace('/dashboard');
    } catch { setError('No se pudo conectar con el servidor. Intenta de nuevo.'); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-card" aria-label="Acceso al panel">
      <div className="brand-mark" aria-hidden="true">CV</div>
      <p className="eyebrow">CONTROL VEHICULAR · ADMIN</p>
      <h1>Bienvenido</h1><p>Ingresa con tu cuenta de administrador.</p>
      <form onSubmit={login} aria-busy={busy}>
        <label htmlFor="username">Usuario</label>
        <input id="username" name="username" autoComplete="username" placeholder="Usuario o correo" required maxLength={254} disabled={busy} />
        <label htmlFor="password">Contraseña</label>
        <div className="password-field">
          <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contraseña" required maxLength={128} disabled={busy} />
          <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{visible ? 'Ocultar' : 'Mostrar'}</button>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Conectando…' : 'Ingresar'}</button>
      </form>
    </section>
  </main>;
}
