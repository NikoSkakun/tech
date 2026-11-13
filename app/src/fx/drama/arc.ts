/**
 * Arc / lightning — a jagged, flickering, branching discharge between two points. The bolt is rebuilt from a
 * seed derived from engine time (`floor(t · flickerRate)`), so it flickers like a real arc yet every frame
 * is reproducible under the debug clock. It is bright enough to drive bloom.
 */
import { Vector3 } from 'three';
import { Rng } from '@/engine/api';
import type { ColorLike } from '@/style';
import { RibbonLines, type RibbonLine } from '../core/ribbon';
import { fxTime, onTick } from '../core/tick';
import type { Vec3 } from '../particles/emitters';

export interface ArcOptions {
  from?: Vec3;
  to?: Vec3;
  /** Glow colour (the core is white-hot). Default `sky`. */
  color?: ColorLike;
  /** Sideways wander as a fraction of the arc length. Default 0.16. */
  jaggedness?: number;
  /** Number of side branches. Default 2. */
  branches?: number;
  /** New shapes per second. Default 16. */
  flickerRate?: number;
  /** Core width, units. Default 0.04. */
  width?: number;
  /** Brightness. Default 2.6. */
  intensity?: number;
  /** Subdivision levels (2^n segments). Default 5. */
  detail?: number;
  /** Start burning immediately. Default true. `false` = dark until `strike()`. */
  continuous?: boolean;
}

const _axis = new Vector3();
const _u = new Vector3();
const _v = new Vector3();

/** Midpoint-displacement bolt from a to b (deterministic for a given generator). */
export function boltPoints(a: Vector3, b: Vector3, rng: Rng, jaggedness: number, detail: number): Vector3[] {
  let pts = [a.clone(), b.clone()];
  _axis.subVectors(b, a);
  const length = _axis.length();
  _axis.normalize();
  _u.set(Math.abs(_axis.y) < 0.99 ? 0 : 1, Math.abs(_axis.y) < 0.99 ? 1 : 0, 0).cross(_axis).normalize();
  _v.crossVectors(_axis, _u);
  let amp = length * jaggedness;
  for (let level = 0; level < detail; level++) {
    const next: Vector3[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const mid = pts[i - 1]!.clone().add(pts[i]!).multiplyScalar(0.5);
      const ang = rng.next() * Math.PI * 2;
      const r = rng.signed(amp);
      mid.addScaledVector(_u, Math.cos(ang) * r).addScaledVector(_v, Math.sin(ang) * r);
      next.push(mid, pts[i]!);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}

/** Electric arc. Create through `createArc()`; move the ends through `from` / `to` at any time. */
export class Arc extends RibbonLines {
  readonly from: Vector3;
  readonly to: Vector3;
  /** 0…1 strength of a continuous arc (tweenable: 0 = extinguished). */
  power: number;
  private readonly o: Required<Pick<ArcOptions, 'jaggedness' | 'branches' | 'flickerRate' | 'detail'>>;
  private readonly baseIntensity: number;
  private strikeAt = -1e9;
  private strikeLife = 0.35;

  constructor(o: ArcOptions = {}) {
    const detail = o.detail ?? 5;
    const branches = o.branches ?? 2;
    super({
      capacity: ((1 << detail) + 2) * (1 + branches) + 8,
      color: o.color ?? 'sky',
      width: o.width ?? 0.04,
      intensity: o.intensity ?? 2.6,
      dashStrength: 0,
      endFade: [0.01, 0.01],
      minPixels: 2,
      hotCore: 0.9,
    });
    this.name = 'arc';
    this.from = new Vector3(...(o.from ?? [0, 0, 0]));
    this.to = new Vector3(...(o.to ?? [1, 0, 0]));
    this.power = (o.continuous ?? true) ? 1 : 0;
    this.baseIntensity = o.intensity ?? 2.6;
    this.o = { jaggedness: o.jaggedness ?? 0.16, branches, flickerRate: o.flickerRate ?? 16, detail };
    let lastSeed = -1;
    onTick(this, (t) => {
      const seed = Math.floor(t * this.o.flickerRate);
      // a strike decays quickly; a continuous arc shimmers ±20 % from shape to shape
      const age = (t - this.strikeAt) / this.strikeLife;
      const strike = age >= 0 && age < 1 ? (1 - age) * (1 - age) : 0;
      const level = Math.max(this.power, strike);
      this.intensity = this.baseIntensity * level * (0.8 + 0.4 * ((seed * 0.618) % 1));
      if (level <= 0.001 || seed === lastSeed) return;
      lastSeed = seed;
      this.rebuild(new Rng(seed * 7919 + 13));
    });
  }

  /** One-shot discharge that fades over `duration` seconds (lightning, breaker arc, short circuit). */
  strike(duration = 0.35): void {
    this.strikeAt = fxTime();
    this.strikeLife = duration;
  }

  private rebuild(rng: Rng): void {
    const main = boltPoints(this.from, this.to, rng, this.o.jaggedness, this.o.detail);
    const lines: RibbonLine[] = [{ points: main }];
    const length = this.from.distanceTo(this.to);
    for (let b = 0; b < this.o.branches; b++) {
      const start = main[rng.int(Math.floor(main.length * 0.15), Math.floor(main.length * 0.75))]!;
      const dir = new Vector3(...rng.onSphere()).multiplyScalar(0.6).add(_axis.subVectors(this.to, this.from).normalize());
      const end = start.clone().addScaledVector(dir.normalize(), length * rng.range(0.15, 0.35));
      const pts = boltPoints(start, end, rng, this.o.jaggedness * 1.3, Math.max(2, this.o.detail - 2));
      // branches taper: dimmer toward their free end
      lines.push({ points: pts, brightness: pts.map((_, i) => 0.55 * (1 - i / pts.length)) });
    }
    this.setLines(lines);
  }
}

/** A flickering electric arc between two points (see `ArcOptions`). */
export function createArc(o: ArcOptions = {}): Arc {
  return new Arc(o);
}
