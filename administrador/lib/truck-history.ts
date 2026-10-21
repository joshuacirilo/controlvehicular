/** Dates are ISO 8601 with the -06:00 offset, like the rest of the admin API. */
import type { CheckpointQuality } from './route-quality';

export const TRUCKS_PER_PAGE = 10;
export const TRIPS_PER_PAGE = 5;

/** A driver who has made at least one trip with the truck. */
export type DriverSummary = {
  driverId: string;
  nombre: string;
  viajes: number;
  ultimoViaje: string;
  enCurso: boolean;
};

export type TruckHistory = {
  truckId: string;
  placa: string;
  modelo: string;
  activo: boolean;
  conductores: DriverSummary[];
};

export type TruckHistoryPage = {
  page: number;
  totalPages: number;
  total: number;
  trucks: TruckHistory[];
};

/** One trip; `ruta` contains every `[lat, lng]` fix chronologically, numbered from index 0. */
export type TripRoute = {
  tripId: string;
  estado: 'activo' | 'finalizado';
  inicio: string;
  fin: string | null;
  puntos: number;
  distanciaKm: number;
  ruta: [number, number][];
  checkpoints: CheckpointQuality[];
};

/** Served by `GET /api/trucks/:truckId/drivers/:driverId/trips?page=N`. */
export type DriverTripsPage = {
  page: number;
  totalPages: number;
  total: number;
  trips: TripRoute[];
};
