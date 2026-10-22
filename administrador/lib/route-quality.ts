/** Display policy, not a guarantee of GPS validity. Never deletes recorded fixes. */
export const MAX_ROUTE_ACCURACY_METERS = 50;
export const MAX_ROUTE_GAP_MS = 30_000;

export type CheckpointQuality = { precision: number | null; timestamp: string; qualityFlags?: string[]; velocidad?: number | null };

export function hasQuestionableFix(checkpoint: CheckpointQuality | undefined) {
  return !hasUsableAccuracy(checkpoint?.precision) ||
    (checkpoint?.qualityFlags?.some(flag => ['stale', 'mocked', 'out_of_order', 'jump'].includes(flag)) ?? false);
}

export function hasUsableAccuracy(precision: number | null | undefined) {
  return precision != null && Number.isFinite(precision) && precision > 0 && precision <= MAX_ROUTE_ACCURACY_METERS;
}

/** Recorded speeds need two reliable fixes, just like the segment evaluation. */
export function recordedSpeedLabel(previous: CheckpointQuality | undefined, current: CheckpointQuality | undefined) {
  if (hasQuestionableFix(current) || (previous && hasQuestionableFix(previous))) {
    return 'No confiable: ubicación GPS dudosa';
  }
  if (!previous || !current) return 'No disponible';
  const elapsed = Date.parse(current.timestamp) - Date.parse(previous.timestamp);
  if (!Number.isFinite(elapsed) || elapsed < 1000 || elapsed > MAX_ROUTE_GAP_MS) {
    return 'No confiable: intervalo entre ubicaciones inválido';
  }
  const speed = current.velocidad;
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0
    ? `${speed.toFixed(1)} km/h` : 'No disponible';
}

