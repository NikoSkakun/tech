/**
 * `FxEnv` — the two engine services effect factories need. A `ChapterContext` satisfies it structurally, so
 * chapters simply pass `ctx`.
 */
import type { QualityView, Rng } from '@/engine/api';

export interface FxEnv {
  /** Quality tier view: particle / instance budgets scale with it. */
  readonly quality: QualityView;
  /** Seeded generator — effects fork their own sub-stream, so builds are reproducible. */
  readonly random: Rng;
  /** When true, effects drop shake / jitter (STYLE_GUIDE §5). */
  readonly reducedMotion?: boolean;
}

/**
 * Keep an instanced effect's live instance count in step with the quality tier. `apply(n)` receives the count
 * for the current tier (never above `capacity`). Returns the unsubscribe function — call it in `dispose()`.
 */
export function followQuality(
  env: FxEnv,
  nominal: number,
  capacity: number,
  apply: (count: number) => void,
  min = 1,
): () => void {
  const set = (): void => apply(Math.min(capacity, env.quality.count(nominal, min)));
  set();
  return env.quality.onChange(set);
}

/** Instance capacity to allocate for a nominal count: enough for the current tier and for `high`. */
export function capacityFor(env: FxEnv, nominal: number, min = 1): number {
  return Math.max(env.quality.count(nominal, min), nominal, min);
}
