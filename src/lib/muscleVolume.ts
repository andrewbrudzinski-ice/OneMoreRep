/**
 * Per-muscle working-volume aggregation for the heatmap. Primary muscle gets
 * full credit; secondary muscles get a fraction. Pure + unit-tested.
 */

export interface MuscleVolumeEntry {
  volume: number;
  primaryMuscleId: string;
  secondaryMuscleIds: string[];
}

/**
 * Aggregate working volume onto muscle groups. Returns a plain map of
 * muscleGroupId → volume. `secondaryFactor` weights secondary involvement.
 */
export function aggregateMuscleVolume(
  entries: readonly MuscleVolumeEntry[],
  secondaryFactor = 0.5,
): Record<string, number> {
  const totals: Record<string, number> = {};
  const add = (id: string, amount: number) => {
    totals[id] = (totals[id] ?? 0) + amount;
  };
  for (const entry of entries) {
    if (entry.volume <= 0) continue;
    add(entry.primaryMuscleId, entry.volume);
    for (const secondary of entry.secondaryMuscleIds) {
      add(secondary, entry.volume * secondaryFactor);
    }
  }
  return totals;
}

/** Normalize volumes to 0..1 by the max, for shading intensity. */
export function normalizeIntensities(
  volumes: Record<string, number>,
): Record<string, number> {
  const max = Math.max(0, ...Object.values(volumes));
  if (max <= 0) return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(volumes)) out[id] = v / max;
  return out;
}
