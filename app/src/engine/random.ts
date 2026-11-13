/**
 * Seeded pseudo-random generator (mulberry32). Chapters use `ctx.random` instead of `Math.random()` so that
 * scenes build identically on every load and QA screenshots are reproducible.
 */
export class Rng {
  private state: number;

  constructor(seed: number | string = 1) {
    this.state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Uniform float in [-1, 1) × scale. */
  signed(scale = 1): number {
    return (this.next() * 2 - 1) * scale;
  }

  /** Approximately normal (mean 0, σ 1) via the sum of uniforms. */
  gauss(): number {
    return (this.next() + this.next() + this.next() + this.next() - 2) * 1.7320508;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Random point on the unit sphere as [x, y, z]. */
  onSphere(): [number, number, number] {
    const z = this.signed();
    const a = this.range(0, Math.PI * 2);
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(a), z, r * Math.sin(a)];
  }

  /** Independent generator derived from this one (stable sub-streams per subsystem). */
  fork(label: string): Rng {
    return new Rng((hashString(label) ^ Math.floor(this.next() * 4294967296)) >>> 0);
  }
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
