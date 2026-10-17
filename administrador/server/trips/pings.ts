export const MAX_PINGS_PER_REQUEST = 100;
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;
const MAX_PING_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PingInput = {
  pingId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: Date;
};

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Validates one device sample; timestamps must be ISO strings within the accepted clock window. */
export function parsePing(value: unknown, now = new Date()): PingInput | null {
  if (!value || typeof value !== 'object') return null;
  const { pingId, latitude, longitude, accuracy, timestamp } = value as Record<string, unknown>;
  if (typeof pingId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(pingId)) return null;
  if (!inRange(latitude, -90, 90) || !inRange(longitude, -180, 180)) return null;
  if (accuracy !== null && accuracy !== undefined && !inRange(accuracy, 0, 100000)) return null;
  if (typeof timestamp !== 'string') return null;
  const date = new Date(timestamp);
  const time = date.getTime();
  if (Number.isNaN(time) || time > now.getTime() + MAX_CLOCK_SKEW_MS || time < now.getTime() - MAX_PING_AGE_MS) {
    return null;
  }
  return { pingId, latitude, longitude, accuracy: accuracy ?? null, timestamp: date };
}

export type StoredPoint = { coordinates: [number, number]; timestamp: Date; accuracy: number | null };

export function distanceMeters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Speed in km/h between the previous stored point and the new one. Null when it
 * cannot be computed; zero when the displacement is within the GPS accuracy.
 */
export function speedKmh(previous: StoredPoint | null, current: StoredPoint): number | null {
  if (!previous) return null;
  const seconds = (current.timestamp.getTime() - previous.timestamp.getTime()) / 1000;
  if (seconds < 1) return null;
  const meters = distanceMeters(previous.coordinates, current.coordinates);
  if (meters <= Math.max(previous.accuracy ?? 0, current.accuracy ?? 0)) return 0;
  return Math.round((meters / seconds) * 3.6 * 10) / 10;
}
