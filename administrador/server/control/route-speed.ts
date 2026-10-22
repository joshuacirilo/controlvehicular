import { distanceMeters } from '@/server/trips/pings';
import { hasQuestionableFix, MAX_ROUTE_GAP_MS, type CheckpointQuality } from '@/lib/route-quality';

/** Each segment is one pair of consecutive fixes; keep original route indices. */
export function routeSpeed(ruta: [number, number][], checkpoints: CheckpointQuality[], limiteKmh: number | null) {
  const excesos: { inicio: number; fin: number; velocidadKmh: number }[] = [];
  let evaluados = 0;
  const total = Math.max(0, ruta.length - 1);
  if (limiteKmh === null || !Number.isFinite(limiteKmh) || limiteKmh <= 0) {
    return { limiteKmh: null, evaluados, sinEvaluar: total, excesos };
  }
  for (let i = 1; i < ruta.length; i++) {
    const a = checkpoints[i - 1];
    const b = checkpoints[i];
    if (hasQuestionableFix(a) || hasQuestionableFix(b)) continue;
    const elapsed = Date.parse(b.timestamp) - Date.parse(a.timestamp);
    if (!Number.isFinite(elapsed) || elapsed < 1000 || elapsed > MAX_ROUTE_GAP_MS) continue;
    const [latA, lngA] = ruta[i - 1];
    const [latB, lngB] = ruta[i];
    if (![latA, lngA, latB, lngB].every(Number.isFinite) || Math.abs(latA) > 90 || Math.abs(latB) > 90 || Math.abs(lngA) > 180 || Math.abs(lngB) > 180) continue;
    const meters = distanceMeters([lngA, latA], [lngB, latB]);
    const speed = meters <= Math.max(a.precision!, b.precision!) ? 0 : meters / elapsed * 3600;
    evaluados++;
    // Compare before rounding so a real excess cannot disappear at the threshold.
    if (speed > limiteKmh) excesos.push({ inicio: i - 1, fin: i, velocidadKmh: speed });
  }
  return { limiteKmh, evaluados, sinEvaluar: total - evaluados, excesos };
}
