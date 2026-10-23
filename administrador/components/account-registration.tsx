'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { parseRegistration, registrationQr } from '@/lib/registration';

type CreatedQr = { label: string; image: string; filename: string; kind: 'truck' | 'pilot' | 'admin' };

export function AccountRegistration() {
  const router = useRouter();
  const [kind, setKind] = useState<'truck' | 'pilot' | 'admin'>('truck');
  const administrator = kind === 'admin';
  const titleId = administrator ? 'register-admin-title' : 'register-title';
  const passwordHelp = administrator ? 'admin-password-help' : 'password-help';
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedQr | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (data.password !== data.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    const parsed = parseRegistration({ ...data, kind });
    if (!parsed.ok) { setError(parsed.message); return; }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      // Prepare the image before creating the account; a QR error must not leave an unseen account.
      let image = '';
      if (parsed.value.kind !== 'admin') {
        const QRCode = await import('qrcode');
        image = await QRCode.toDataURL(registrationQr(parsed.value), {
        width: 768, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#01215a', light: '#ffffff' },
      });
      }
      const response = await fetch('/api/accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.value), cache: 'no-store', signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 401) { router.replace('/'); return; }
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? 'No se pudo registrar.'); return; }
      const label = parsed.value.kind === 'truck' ? parsed.value.placa : parsed.value.username;
      setCreated({ label, image, kind, filename: `qr-${kind === 'truck' ? 'camion' : 'piloto'}-${label}.png` });
      form.reset();
      router.refresh();
    } catch {
      setError('No se pudo confirmar el registro. Revisa la conexión. Si vuelves a intentar y aparece como duplicado, el registro anterior pudo haberse guardado.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (created) return <section className="account-card qr-result" aria-labelledby={titleId}>
    <h2 id={titleId}>{created.kind === 'truck' ? 'Camión registrado' : created.kind === 'admin' ? 'Administrador registrado' : 'Piloto registrado'}</h2>
    <p role="status"><strong>{created.label}</strong> {created.kind === 'admin' ? 'ya puede iniciar sesión en el panel administrativo.' : 'está listo para usar en la app.'}</p>
    {created.kind !== 'admin' && <>
    <Image src={created.image} alt={`Código QR de ${created.label}`} width={256} height={256} unoptimized />
    <a className="primary-button qr-download" href={created.image} download={created.filename}>Descargar PNG</a>
    <p className="layer-note">Descarga el QR antes de salir o crear otro registro. Contiene las credenciales de acceso; entrégalo solo a quien corresponda.</p>
    </>}
    <div className="account-actions">
      <button type="button" onClick={() => setCreated(null)}>Crear otro registro</button>
      {created.kind === 'truck' && <Link href="/camiones">Ver camiones</Link>}
    </div>
  </section>;

  return <section className="account-card" aria-labelledby={titleId}>
    <div className="account-kind" role="group" aria-label="Tipo de registro">
      <button type="button" aria-pressed={kind === 'truck'} disabled={busy} onClick={() => { setKind('truck'); setError(''); }}>Camión</button>
      <button type="button" aria-pressed={kind === 'pilot'} disabled={busy} onClick={() => { setKind('pilot'); setError(''); }}>Piloto</button>
      <button type="button" aria-pressed={kind === 'admin'} disabled={busy} onClick={() => { setKind('admin'); setError(''); }}>Administrador</button>
    </div>
    <h2 id={titleId}>{kind === 'truck' ? 'Registrar camión' : kind === 'admin' ? 'Crear administrador' : 'Registrar piloto'}</h2>
    <p className="layer-note">{kind === 'truck' ? 'Su QR se escanea para iniciar un viaje.' : kind === 'admin' ? 'Esta cuenta tendrá acceso al panel, configuración y creación de otras cuentas.' : 'El piloto podrá entrar con usuario y contraseña o escaneando su QR.'}</p>
    <form key={kind} onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy}>
        <legend className="sr-only">Datos del {kind === 'truck' ? 'camión' : kind === 'admin' ? 'administrador' : 'piloto'}</legend>
        <div className="account-fields">
          {kind === 'truck' ? <>
            <label>Placa<input name="placa" required maxLength={20} placeholder="P123ABC" autoComplete="off" /></label>
            <label>Modelo<input name="modelo" required maxLength={100} placeholder="Marca y modelo" autoComplete="off" /></label>
          </> : <>
            <label>Nombre completo<input name="nombre" required maxLength={120} autoComplete="name" /></label>
            <label>Usuario<input name="username" required minLength={3} maxLength={40} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
            <label>Correo electrónico<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
            {kind === 'pilot' && <>
            <label>Licencia<input name="licencia" required maxLength={40} autoComplete="off" /></label>
            <label>Teléfono<input name="telefono" type="tel" required minLength={7} maxLength={25} autoComplete="tel" /></label>
            </>}
          </>}
          <label>Contraseña<input name="password" type="password" required minLength={administrator ? 12 : 8} maxLength={128} autoComplete="new-password" aria-describedby={passwordHelp} /></label>
          <label>Confirmar contraseña<input name="confirmPassword" type="password" required minLength={administrator ? 12 : 8} maxLength={128} autoComplete="new-password" /></label>
        </div>
        <p id={passwordHelp} className="layer-note">De {administrator ? 12 : 8} a 128 caracteres. {kind === 'truck' ? 'Guarda la contraseña del camión.' : 'El correo se usará para recuperar el acceso a la cuenta.'}</p>
        {error && <p className="account-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit">{busy ? 'Guardando…' : administrator ? 'Crear administrador' : 'Crear y generar QR'}</button>
      </fieldset>
    </form>
  </section>;
}
