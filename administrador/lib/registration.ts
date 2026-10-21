export type TruckRegistration = { kind: 'truck'; placa: string; modelo: string; password: string };
export type PilotRegistration = { kind: 'pilot'; username: string; nombre: string; licencia: string; telefono: string; password: string };
export type Registration = TruckRegistration | PilotRegistration;
type Validation = { ok: true; value: Registration } | { ok: false; message: string };

export function parseRegistration(input: unknown): Validation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, message: 'Datos inválidos.' };
  const data = input as Record<string, unknown>;
  const text = (key: string) => typeof data[key] === 'string' ? data[key].trim() : '';
  const password = typeof data.password === 'string' ? data.password : '';
  if (password.length < 8 || password.length > 128 || password.trim().length === 0) {
    return { ok: false, message: 'La contraseña debe tener entre 8 y 128 caracteres.' };
  }
  if (data.kind === 'truck') {
    const placa = text('placa').toUpperCase();
    const modelo = text('modelo');
    if (!/^[A-Z0-9-]{1,20}$/.test(placa)) return { ok: false, message: 'Placa inválida: usa hasta 20 letras, números o guiones.' };
    if (!modelo || modelo.length > 100) return { ok: false, message: 'Indica un modelo de hasta 100 caracteres.' };
    return { ok: true, value: { kind: 'truck', placa, modelo, password } };
  }
  if (data.kind === 'pilot') {
    const username = text('username').toLowerCase();
    const nombre = text('nombre');
    const licencia = text('licencia').toUpperCase();
    const telefono = text('telefono');
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return { ok: false, message: 'Usuario: de 3 a 40 letras, números, puntos, guiones o guiones bajos.' };
    if (!nombre || nombre.length > 120) return { ok: false, message: 'Indica el nombre del piloto (máximo 120 caracteres).' };
    if (!/^[A-Z0-9-]{1,40}$/.test(licencia)) return { ok: false, message: 'Licencia inválida: usa hasta 40 letras, números o guiones.' };
    if (!/^[+\d ()-]{7,25}$/.test(telefono) || telefono.replace(/\D/g, '').length < 7) return { ok: false, message: 'Indica un teléfono válido de al menos 7 dígitos.' };
    return { ok: true, value: { kind: 'pilot', username, nombre, licencia, telefono, password } };
  }
  return { ok: false, message: 'Selecciona camión o piloto.' };
}

/** Same JSON contract used by Flutter's TruckCredentials and QrCredentials. */
export function registrationQr(value: Registration) {
  return JSON.stringify(value.kind === 'truck'
    ? { placa: value.placa, password: value.password }
    : { username: value.username, password: value.password });
}
