import { routeSpeed } from '@/server/control/route-speed';
import { formatGuatemala } from '@/server/time';

export type LivePing = { coords: { coordinates: [number, number] }; timestamp: Date; precision?: number | null; qualityFlags?: string[] };

/** Latest pair in descending time order. Do not reuse unvalidated stored speeds. */
export function liveSpeed(pings: LivePing[]): number | null {
  if (pings.length < 2) return null;
  const pair = [pings[1], pings[0]];
  const result = routeSpeed(pair.map(p => [p.coords.coordinates[1], p.coords.coordinates[0]]),
    pair.map(p => ({ timestamp: formatGuatemala(p.timestamp), precision: p.precision ?? null, qualityFlags: p.qualityFlags })), Number.MIN_VALUE);
  return result.evaluados ? result.excesos[0]?.velocidadKmh ?? 0 : null;
}
