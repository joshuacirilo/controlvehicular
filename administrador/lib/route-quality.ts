/** Display policy, not a guarantee of GPS validity. Never deletes recorded fixes. */
export const MAX_ROUTE_ACCURACY_METERS = 50;
export const MAX_ROUTE_GAP_MS = 30_000;

export type CheckpointQuality = { precision: number | null; timestamp: string; qualityFlags?: string[] };

export function hasQuestionableFix(checkpoint: CheckpointQuality | undefined) {
  return !hasUsableAccuracy(checkpoint?.precision) ||
    (checkpoint?.qualityFlags?.some(flag => ['stale', 'mocked', 'out_of_order', 'jump'].includes(flag)) ?? false);
}

export function hasUsableAccuracy(precision: number | null | undefined) {
  return precision != null && Number.isFinite(precision) && precision > 0 && precision <= MAX_ROUTE_ACCURACY_METERS;
}

