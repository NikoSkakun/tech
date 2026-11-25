/**
 * `inside`: the magnifier as the door to «усередині лампочки» (VISUAL §3) — one position −½…1 is the whole way,
 * both ways, at any speed:
 *
 * - −½…0, the lens leg: the lens rises out of its holder and lands on the lamp's glass (`GLASS_POSE`, by 85 % of
 *   the leg), the camera following from the stand plan to `lampDoor` (the lamp with the lens on it, from farther
 *   back on `lampInside`'s line);
 * - 0…1, the door: the camera pushes in to `lampInside`; the ring comes to meet it, grows past the frame's edges
 *   and stays as the thin cyan arcs in the corners (`rim`), the lamp's base opens (`cut`). The ring is at the
 *   camera by `PASS` and behind it after; its glass thins out on the way so the tint never snaps.
 */
import { Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { STAGE_SHOTS, worldToBoard, type CircuitStage, type LensPose } from '@circuit/shared/stage';
import { LENS_LEG, leadLens } from '@circuit/shared/world/dive';
import { GLASS_POSE } from '../shots';
import { cameraRail, type CameraRail } from './rail';
import { emptyPose, mixPose } from './lens-keeper';
import type { LampWorld } from '../world';

/** Share of the door leg at which the ring reaches the camera. */
const PASS = 0.82;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const ramp = (x: number, a: number, b: number): number => clamp01((x - a) / (b - a));
const smooth = (x: number): number => x * x * (3 - 2 * x);

export interface Door {
  rail: CameraRail;
  /** The lens's pose for a position (board frame; the camera must be placed for that position first). */
  lens(t: number): LensPose;
  /** Rim arcs, glass and the base's cut for a position. */
  rim(t: number): number;
  glass(t: number): number;
  cut(t: number): number;
}

export function createDoor(ctx: ChapterContext, lw: LampWorld, stand: CircuitStage): Door {
  const rail = cameraRail(ctx, [lw.shot('lampDoor'), lw.shot('lampWhole')], STAGE_SHOTS.stand, lw.world.sway);
  const pose = emptyPose();
  const eye = emptyPose();
  const cam = new Vector3();
  const holder = stand.tools.poses.holder;
  return {
    rail,
    lens(t) {
      if (t <= 0) {
        const u = clamp01((t + LENS_LEG) / LENS_LEG);
        const e = smooth(leadLens(u));
        return mixPose(holder, GLASS_POSE, e, 0.7, pose);
      }
      // the ring travels from the glass toward the camera along their line, facing it, and on past it
      worldToBoard(cam.fromArray(rail.rail.shotAt(t).position as readonly number[] as number[]), cam);
      const k = smooth(ramp(t, 0.04, 1)) / smooth(ramp(PASS, 0.04, 1));
      eye.position.copy(GLASS_POSE.position).lerp(cam, k);
      eye.facing.copy(cam).sub(GLASS_POSE.position).normalize();
      eye.handle.copy(GLASS_POSE.handle);
      eye.scale = GLASS_POSE.scale ?? 1;
      eye.grip = GLASS_POSE.grip ?? 1;
      return mixPose(GLASS_POSE, eye, 1, 0, pose);
    },
    rim: (t) => smooth(ramp(t, PASS - 0.3, PASS)),
    glass: (t) => 1 - smooth(ramp(t, PASS - 0.32, PASS - 0.04)),
    cut: (t) => smooth(ramp(t, 0.45, 1)),
  };
}
