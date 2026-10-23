export const GUATEMALA_LIMITS = { south: 13.6, west: -92.4, north: 17.9, east: -88.1 } as const;
export const ASSIGNMENTS_PER_PAGE = 10;
const MIN_SEPARATION_M = 50;
const PAST_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

export type AssignmentStatus = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
export type AssignmentPoint = { lat: number; lng: number; nombre: string };

export type AssignmentInput = {
  truckId: string; driverId: string; origen: AssignmentPoint; destino: AssignmentPoint;
  programadoPara: Date; nota: string;
};

/** Shape returned to the pilot app (`/api/assignments/mine`, trip start and active trip). */
export type DriverAssignment = {
  id: string; truck: { placa: string; modelo: string };
  origen: AssignmentPoint; destino: AssignmentPoint;
  programadoPara: string; nota: string; estado: AssignmentStatus;
  entregada: boolean; leida: boolean;
};

export type AdminAssignment = Omit<DriverAssignment, 'entregada' | 'leida'> & {
  truck: { id: string; placa: string; modelo: string };
  driver: { id: string; nombre: string };
  createdBy: { username: string; nombre: string };
  tripId: string | null; entregadaAt: string | null; leidaAt: string | null; createdAt: string;
};

export type AssignmentOptions = {
  trucks: { id: string; placa: string; modelo: string }[];
  drivers: { id: string; nombre: string }[];
};

export type AssignmentPage = { page: number; totalPages: number; total: number; assignments: AdminAssignment[] };

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada', cancelada: 'Cancelada',
};

/** Guatemala has no daylight saving time, so its wall clock is always UTC-6. */
export function guatemalaInstant(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return null;
  const instant = new Date(`${fecha}T${hora}:00-06:00`);
  if (Number.isNaN(instant.getTime())) return null;
  // Rejects rolled-over values such as 2026-02-30 or 25:00.
  const local = new Date(instant.getTime() - 6 * 60 * 60 * 1000).toISOString();
  return local.startsWith(`${fecha}T${hora}`) ? instant : null;
}

export function insideGuatemala(lat: number, lng: number) {
  const { south, west, north, east } = GUATEMALA_LIMITS;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

function meters(a: AssignmentPoint, b: AssignmentPoint) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function point(value: unknown): AssignmentPoint | null {
  if (!value || typeof value !== 'object') return null;
  const { lat, lng, nombre } = value as Record<string, unknown>;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!insideGuatemala(lat, lng)) return null;
  const name = typeof nombre === 'string' ? nombre.trim() : '';
  if (name.length > 120) return null;
  return { lat, lng, nombre: name };
}

type Validation = { ok: true; value: AssignmentInput } | { ok: false; message: string };

export function parseAssignment(input: unknown, now = new Date()): Validation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, message: 'Datos inválidos.' };
  const data = input as Record<string, unknown>;
  const truckId = typeof data.truckId === 'string' ? data.truckId : '';
  const driverId = typeof data.driverId === 'string' ? data.driverId : '';
  if (!OBJECT_ID.test(truckId)) return { ok: false, message: 'Selecciona un camión.' };
  if (!OBJECT_ID.test(driverId)) return { ok: false, message: 'Selecciona un piloto.' };
  const origen = point(data.origen);
  const destino = point(data.destino);
  if (!origen) return { ok: false, message: 'Marca el origen en el mapa, dentro de Guatemala (nombre de hasta 120 caracteres).' };
  if (!destino) return { ok: false, message: 'Marca el destino en el mapa, dentro de Guatemala (nombre de hasta 120 caracteres).' };
  if (meters(origen, destino) < MIN_SEPARATION_M) return { ok: false, message: 'El origen y el destino deben estar separados al menos 50 m.' };
  const programadoPara = guatemalaInstant(String(data.fecha ?? ''), String(data.hora ?? ''));
  if (!programadoPara) return { ok: false, message: 'Indica una fecha y hora válidas.' };
  const delta = programadoPara.getTime() - now.getTime();
  if (delta < -PAST_TOLERANCE_MS) return { ok: false, message: 'La fecha y hora ya pasaron.' };
  if (delta > MAX_AHEAD_MS) return { ok: false, message: 'La fecha no puede ser de más de un año en el futuro.' };
  const nota = typeof data.nota === 'string' ? data.nota.trim() : '';
  if (nota.length > 500) return { ok: false, message: 'La nota admite hasta 500 caracteres.' };
  return { ok: true, value: { truckId, driverId, origen, destino, programadoPara, nota } };
}
