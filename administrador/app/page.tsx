'use client';
import { useState, type FormEvent } from 'react';

type User = { id: string; username: string; name: string };
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
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
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: data.get('username'), password: data.get('password') }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Usuario o contrase?a incorrectos.' :
          response.status === 403 ? 'El acceso de prueba solo funciona en desarrollo local.' : 'No se pudo ingresar. Intenta de nuevo.');
        return;
      }
      const result = await response.json();
      if (result.mode !== 'test' || typeof result.user?.name !== 'string') throw new Error('Invalid response');
      form.reset(); setUser(result.user);
    } catch { setError('No se pudo conectar con el servidor. Intenta de nuevo.'); }
    finally { setBusy(false); }
  }
  return <main className="login-shell">
    <section className="login-card" aria-label="Acceso al panel">
      <div className="brand-mark" aria-hidden="true">CV</div>
      <p className="eyebrow">CONTROL VEHICULAR ? ADMIN</p>
      <span className="test-badge">Entorno de prueba</span>
      {user ? <div role="status">
        <h1>Hola, {user.name}</h1>
        <p>El backend valid? tus credenciales correctamente.</p>
        <p className="login-note">Prueba de conexi?n completada. No se ha creado una sesi?n de producci?n.</p>
        <button className="primary-button" onClick={() => { setUser(null); setError(''); }}>Volver al inicio</button>
      </div> : <>
        <h1>Bienvenido</h1><p>Ingresa para probar el acceso al panel.</p>
        <form onSubmit={login} aria-busy={busy}>
          <label htmlFor="username">Usuario</label>
          <input id="username" name="username" autoComplete="username" placeholder="Tu usuario" required maxLength={80} disabled={busy} />
          <label htmlFor="password">Contrase?a</label>
          <div className="password-field">
            <input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Tu contrase?a" required maxLength={128} disabled={busy} />
            <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contrase?a' : 'Mostrar contrase?a'}>{visible ? 'Ocultar' : 'Mostrar'}</button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Conectando?' : 'Ingresar'}</button>
        </form>
        <p className="login-note">Acceso temporal con usuarios de prueba. No requiere conexi?n con Atlas.</p>
      </>}
    </section>
  </main>;
}
