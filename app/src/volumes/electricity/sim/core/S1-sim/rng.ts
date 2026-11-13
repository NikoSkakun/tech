/**
 * Injected randomness. Models never call `Math.random()`: they take a {@link RandomSource} (the engine's
 * `ctx.random` satisfies it structurally) or a numeric seed, so QA runs are reproducible.
 */
export interface RandomSource {
  /** Uniform float in [0, 1). */
  next(): number;
}

/** mulberry32 — same generator as `engine/random.ts`, duplicated so `sim/` has no engine dependency. */
export function createRng(seed = 1): RandomSource {
  let state = seed >>> 0 || 0x9e3779b9;
  return {
    next(): number {
      let t = (state = (state + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Accepts either a ready source or a seed. */
export function toRandomSource(source: RandomSource | number | undefined, fallbackSeed = 1): RandomSource {
  if (source === undefined) return createRng(fallbackSeed);
  return typeof source === 'number' ? createRng(source) : source;
}

/** Exponentially distributed waiting time with the given mean (Poisson process). */
export function exponentialSample(rng: RandomSource, mean: number): number {
  return -mean * Math.log(1 - rng.next());
}

/** Uniform random unit vector in 3D. */
export function randomUnitVector(rng: RandomSource): [number, number, number] {
  const z = 2 * rng.next() - 1;
  const phi = 2 * Math.PI * rng.next();
  const s = Math.sqrt(1 - z * z);
  return [s * Math.cos(phi), s * Math.sin(phi), z];
}

/** Integer in [min, max] inclusive. */
export function randomInt(rng: RandomSource, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}
