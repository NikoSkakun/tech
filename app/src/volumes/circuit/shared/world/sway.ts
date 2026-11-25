/**
 * The little camera sway of lens mode (the owner, 2026-11-25: «щоб ми все рівно могли трохи рухати камерою
 * курсором» — chosen: a sway that springs back). A drag on empty space turns the camera a few degrees about its
 * target, following the hand with a soft limit (never a full orbit; the lens stays in frame); let go and it springs
 * back to the pose with a small overshoot (none with reduced motion). The rail that owns the camera applies it to its
 * shot (`applySway`).
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';

/** Largest turn, rad: ≈ 6° sideways, ≈ 3.5° up / down. */
export const SWAY_YAW = 0.1;
export const SWAY_PITCH = 0.06;
/** Radians per screen height of drag, before the soft limit. */
const GAIN = 0.55;
/** Spring while held (stiff, no overshoot) and after release (softer, a little overshoot). */
const HELD = { w: 22, z: 1 } as const;
const BACK = { w: 8, z: 0.55 } as const;

export interface Sway {
  readonly yaw: number;
  readonly pitch: number;
  /** The hand is down: `dx`, `dy` = total drag in px, `height` = the frame's height in px. */
  hold(dx: number, dy: number, height: number): void;
  release(): void;
  /** Snap to rest (step entry). */
  reset(): void;
  step(dt: number): void;
  readonly active: boolean;
}

export function createSway(reducedMotion: boolean): Sway {
  let yaw = 0;
  let pitch = 0;
  let vy = 0;
  let vp = 0;
  let ty = 0;
  let tp = 0;
  let held = false;
  return {
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get active() {
      return held || Math.abs(yaw) + Math.abs(pitch) + Math.abs(vy) + Math.abs(vp) > 1e-5;
    },
    hold(dx, dy, height) {
      held = true;
      const h = Math.max(height, 1);
      // the scene follows the hand: drag right → the camera swings left round the target
      ty = SWAY_YAW * Math.tanh((-dx / h) * GAIN / SWAY_YAW);
      tp = SWAY_PITCH * Math.tanh((dy / h) * GAIN / SWAY_PITCH);
    },
    release() {
      held = false;
      ty = tp = 0;
    },
    reset() {
      held = false;
      yaw = pitch = vy = vp = ty = tp = 0;
    },
    step(dt) {
      const s = held ? HELD : BACK;
      const z = reducedMotion ? 1 : s.z;
      // semi-implicit Euler in small steps: stable for any frame time
      const n = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        vy += (s.w * s.w * (ty - yaw) - 2 * z * s.w * vy) * h;
        vp += (s.w * s.w * (tp - pitch) - 2 * z * s.w * vp) * h;
        yaw += vy * h;
        pitch += vp * h;
      }
      if (!held && Math.abs(yaw) + Math.abs(pitch) + Math.abs(vy) + Math.abs(vp) < 1e-6) yaw = pitch = vy = vp = 0;
    },
  };
}

const UP = new Vector3(0, 1, 0);
const off = new Vector3();
const axis = new Vector3();
const tgt = new Vector3();

/** Turn a shot's camera about its target by the sway (in place). */
export function applySway(shot: Shot, yaw: number, pitch: number): void {
  if (yaw === 0 && pitch === 0) return;
  const p = shot.position as readonly number[];
  const g = shot.target as readonly number[];
  tgt.set(g[0]!, g[1]!, g[2]!);
  off.set(p[0]!, p[1]!, p[2]!).sub(tgt);
  off.applyAxisAngle(UP, yaw);
  axis.crossVectors(off, UP);
  if (axis.lengthSq() > 1e-12) off.applyAxisAngle(axis.normalize(), pitch);
  off.add(tgt);
  shot.position = [off.x, off.y, off.z];
}
