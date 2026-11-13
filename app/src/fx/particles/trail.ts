/**
 * Trail — a glowing ribbon that follows a moving object and fades behind it (an electron on its orbit, a
 * charged particle bending in a magnetic field, a photon's path). The trail lives in the space of its own
 * parent, so add it to the group the target moves in (usually `ctx.root`).
 */
import { type Object3D, Vector3 } from 'three';
import { SEMANTIC, type ColorLike } from '@/style';
import { RibbonLines } from '../core/ribbon';
import { fxStepping, onStep, onTick, shown } from '../core/tick';

export interface TrailOptions {
  color?: ColorLike;
  /** How long a point of the trail lives, seconds. Default 0.8. */
  duration?: number;
  /** Number of points kept. Default 48. */
  points?: number;
  /** Width, units. Default 0.04. */
  width?: number;
  /** Brightness at the head. Default 1.4. */
  intensity?: number;
}

const _p = new Vector3();

/** Trail behind `target`. Create through `createTrail()`; call `reset()` after teleporting the target. */
export class Trail extends RibbonLines {
  private readonly history: Vector3[] = [];
  private readonly brightness: number[] = [];
  private readonly max: number;
  private readonly interval: number;
  private since = 0;
  private readonly offStep: () => void;

  constructor(
    private readonly target: Object3D,
    o: TrailOptions = {},
  ) {
    const max = o.points ?? 48;
    super({
      capacity: max + 2,
      color: o.color ?? SEMANTIC.electron,
      width: o.width ?? 0.04,
      intensity: o.intensity ?? 1.4,
      dashStrength: 0,
      endFade: [0, 0.02],
    });
    this.name = 'trail';
    this.max = max;
    this.interval = (o.duration ?? 0.8) / max;
    // history must be sampled on every engine step (also the unrendered fixed steps of QA modes)
    this.offStep = onStep((dt) => {
      if (this.parent && shown(this)) this.sample(dt);
      else this.history.length = 0;
    });
    onTick(this, (_t, dt) => {
      if (!fxStepping()) this.sample(dt);
      const n = this.history.length;
      if (n < 2) {
        this.setLines([]);
        return;
      }
      // quadratic fade from head (1) to tail (0), independent of how many points exist yet
      for (let i = 0; i < n; i++) this.brightness[i] = (1 - i / (this.max - 1)) ** 2;
      this.brightness.length = n;
      this.setLines([{ points: this.history, brightness: this.brightness }]);
    });
  }

  private sample(dt: number): void {
    // a long pause (tab switch) would draw a straight chord through space: start afresh
    if (dt > this.interval * 12) this.history.length = 0;
    this.since += dt;
    this.target.updateWorldMatrix(true, false);
    this.target.getWorldPosition(_p);
    if (this.parent) {
      this.parent.updateWorldMatrix(true, false);
      this.parent.worldToLocal(_p);
    }
    const head = this.history[0];
    if (!head || this.since >= this.interval) {
      this.since = 0;
      this.history.unshift(_p.clone());
      if (this.history.length > this.max) this.history.pop();
    } else {
      head.copy(_p); // between samples the newest point rides with the target: no visible stepping
    }
  }

  override dispose(): void {
    this.offStep();
  }

  /** Forget the history (after the target jumped: step change, deep link). */
  reset(): void {
    this.history.length = 0;
  }
}

/** A fading trail behind a moving object (see `TrailOptions`). */
export function createTrail(target: Object3D, o: TrailOptions = {}): Trail {
  return new Trail(target, o);
}
