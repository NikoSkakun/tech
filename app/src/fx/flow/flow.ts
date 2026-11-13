/**
 * Flow — character orbs travelling along one or many paths (electrons in a wire, ions in an electrolyte,
 * water blobs in a pipe, energy pulses). Modes are just parameters, all tweenable without jumps:
 *   DC drift      `speed` (units/s, sign = direction)
 *   AC jiggle     `ac.amplitude` (units) and `ac.frequency` (Hz, already slowed down for the eye)
 *   stop / start  tween `speed` to 0 and back
 *   density       `density` 0…1 (or per path: `setPathDensity`)
 */
import { capacityFor, followQuality, type FxEnv } from '../core/env';
import { onTick } from '../core/tick';
import { Orbs, type OrbOptions } from '../characters/orb';
import { pathMotion } from './motion';
import { PathSet, type PathSpec } from './pathset';
import type { PathInput } from './paths';

export interface FlowOptions extends Omit<OrbOptions, 'motion' | 'count'> {
  /** One path, or several (each optionally `closed` / weighted). */
  paths: PathInput | readonly PathSpec[];
  /** Close the single path given as `paths`. Default false. */
  closed?: boolean;
  /** Nominal number of particles at quality `high` (all paths together). */
  count: number;
  exactCount?: boolean;
  /** Drift speed, units/s. Default 1. */
  speed?: number;
  /** Radius of the tube the particles fill around the path. Default 0 (single file). */
  spread?: number;
  /** Thermal wobble amplitude, units. Default 0. */
  wobble?: number;
  /** Half of the particles travel the other way (ions of both signs, counter-flow). Default false. */
  bidirectional?: boolean;
  /** Share of an open path used for growing in / shrinking out at the ends. Default 0.06. */
  endFade?: number;
  /** AC oscillation around the mean position. */
  ac?: { amplitude?: number; frequency?: number };
  /** Samples per path in the baked texture. Default 256. */
  samples?: number;
  seed?: string;
}

function isSpecList(p: FlowOptions['paths']): p is readonly PathSpec[] {
  return Array.isArray(p) && p.length > 0 && typeof (p[0] as PathSpec).path === 'object';
}

/** Orbs flowing along paths. Create through `createFlow()`. */
export class Flow extends Orbs {
  readonly pathSet: PathSet;
  /** Drift speed in units/s (tweenable; negative reverses). */
  speed: number;
  /** AC oscillation: amplitude in units, frequency in Hz (both tweenable). */
  readonly ac: { amplitude: number; frequency: number };
  private readonly pathSpeed: number[];
  private acPhase = 0;
  private readonly unfollow: () => void;

  constructor(env: FxEnv, opts: FlowOptions) {
    const specs: readonly PathSpec[] = isSpecList(opts.paths)
      ? opts.paths
      : [{ path: opts.paths as PathInput, closed: opts.closed }];
    const set = new PathSet(specs, opts.samples ?? 256);
    const weights = specs.map((s, i) => s.weight ?? set.paths[i]!.length);
    const capacity = opts.exactCount ? opts.count : capacityFor(env, opts.count);
    super({
      ...opts,
      count: capacity,
      name: opts.name ?? 'flow',
      motion: pathMotion(set, env.random.fork(opts.seed ?? 'flow'), {
        spread: opts.spread ?? 0,
        wobble: opts.wobble ?? 0,
        bidirectional: opts.bidirectional ?? false,
        endFade: opts.endFade ?? 0.06,
        weights,
      }),
    });
    this.pathSet = set;
    this.speed = opts.speed ?? 1;
    this.ac = { amplitude: opts.ac?.amplitude ?? 0, frequency: opts.ac?.frequency ?? 1 };
    this.pathSpeed = specs.map(() => 1);
    this.unfollow = opts.exactCount
      ? () => undefined
      : followQuality(env, opts.count, capacity, (n) => (this.instances = n));
    onTick(this, (_t, dt) => {
      // phases are integrated, so changing speed or frequency never makes particles jump
      this.acPhase = (this.acPhase + dt * this.ac.frequency * Math.PI * 2) % (Math.PI * 2);
      const swing = Math.sin(this.acPhase) * this.ac.amplitude;
      for (let row = 0; row < set.count; row++) {
        const length = set.paths[row]!.length;
        set.setPhase(row, set.getPhase(row) + (this.speed * this.pathSpeed[row]! * dt) / length);
        set.setOffset(row, swing / length);
      }
    });
  }

  /** 0…1 share of particles shown on every path (tweenable). */
  get density(): number {
    return this.pathSet.getDensity(0);
  }
  set density(v: number) {
    for (let row = 0; row < this.pathSet.count; row++) this.pathSet.setDensity(row, v);
  }

  /**
   * Replace the paths (M3) — e.g. every frame while a slider reshapes them. Give the same number of paths as at
   * creation (one `PathInput` or a `PathSpec` list); the share of particles per path stays as created, `closed`
   * per spec defaults to the current flag. Phases continue, so the particles do not jump along the path.
   */
  setPaths(paths: PathInput | readonly PathSpec[]): void {
    const specs: readonly PathSpec[] = isSpecList(paths) ? paths : [{ path: paths as PathInput }];
    if (specs.length !== this.pathSet.count)
      throw new Error(`Flow.setPaths: expected ${this.pathSet.count} path(s), got ${specs.length}`);
    specs.forEach((s, row) => this.pathSet.setPath(row, s.path, s.closed ?? this.pathSet.paths[row]!.closed));
  }

  /** Replace one path (see `setPaths`). */
  setPath(row: number, path: PathInput, closed?: boolean): void {
    this.pathSet.setPath(row, path, closed);
  }

  /** Density of one path (branch currents, valves). */
  setPathDensity(row: number, density: number): void {
    this.pathSet.setDensity(row, density);
  }

  /** Speed multiplier of one path relative to `speed` (a narrower pipe flows faster). */
  setPathSpeed(row: number, factor: number): void {
    this.pathSpeed[row] = factor;
  }

  /** Radius of the tube filled around the paths (tweenable). */
  get spread(): number {
    return (this.motionUniforms.uFlow!.value as { x: number }).x;
  }
  set spread(v: number) {
    (this.motionUniforms.uFlow!.value as { x: number }).x = v;
  }

  /** Thermal wobble amplitude (tweenable: hotter conductor → more jitter). */
  get wobble(): number {
    return (this.motionUniforms.uFlow!.value as { y: number }).y;
  }
  set wobble(v: number) {
    (this.motionUniforms.uFlow!.value as { y: number }).y = v;
  }

  override dispose(): void {
    this.unfollow();
    this.pathSet.dispose();
  }
}

/** Character orbs flowing along paths (see `FlowOptions`). */
export function createFlow(env: FxEnv, opts: FlowOptions): Flow {
  return new Flow(env, opts);
}
