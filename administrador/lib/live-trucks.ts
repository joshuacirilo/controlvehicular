/** Latest reported position of a truck. `timestamp` is ISO 8601 with the -06:00 offset. */
export type TruckLocation = {
  lat: number;
  lng: number;
  velocidad: number | null;
  precision: number | null;
  timestamp: string;
};

/** A truck on an active trip, as served by `GET /api/trucks/live`. */
export type LiveTruck = {
  tripId: string;
  truckId: string;
  placa: string;
  modelo: string;
  conductor: string;
  inicio: string;
  /** Null until the first ping of the trip arrives. */
  ubicacion: TruckLocation | null;
};

export const LIVE_FRESH_MS = 90_000;
export function isRecentLocation(timestamp: string, now: number) {
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= LIVE_FRESH_MS;
}
export type LiveRoute = { tripId: string; ruta: [number, number][] };
export type LiveTrucksResponse = { trucks: LiveTruck[]; limiteKmh: number | null; route: LiveRoute | null };
