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
  /** Set while the pilot has paused the trip; `movimiento` is when the app saw the vehicle moving during it. */
  pausa: { desde: string; movimiento: string | null } | null;
  /** Open SOS of the trip, until an administrator marks it attended. `desde` is a UTC ISO date. */
  sos: { id: string; desde: string } | null;
};

export const LIVE_FRESH_MS = 90_000;
export function isRecentLocation(timestamp: string, now: number) {
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= LIVE_FRESH_MS;
}
export type LiveRoute = { tripId: string; ruta: [number, number][] };
export type LiveTrucksResponse = {
  trucks: LiveTruck[];
  limiteKmh: number | null;
  route: LiveRoute | null;
  /** Full routes of the trips with an open SOS, always sent so the emergency is visible on the map. */
  sosRoutes: LiveRoute[];
};
