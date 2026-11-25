/**
 * A camera rail of the chapter's own (DECISIONS §60 p): a position whose frame is a pure function of it, on the
 * world's dive-rail maths (`createDiveRail`: shots of the stops interpolated around their targets — direction
 * slerped, distance log-lerped; an optional lead leg −½…0 from a `lead` shot). `scrub` follows a hand, `travelTo`
 * glides (speed-limited, or timed), and engaging never cuts: the frame on screen when the rail takes the camera
 * is carried as an offset that fades out (as the world's flight does).
 */
import { Vector3 } from 'three';
import type { ChapterContext, Shot } from '@/engine/api';
import { createDiveRail, type DiveRail } from '@circuit/shared/world/dive';
import { applySway, type Sway } from '@circuit/shared/world/sway';

/** Rate (1/s) at which the offset between the camera on screen and the rail's pose fades after engaging. */
const CATCH_UP = 3.2;
/**
 * A hand on a slider is followed with this time constant (s): direct to the eye, yet a pointer event that lands
 * two moves in one frame (a touch's start slop, coalesced events) never shows as a one-frame jump of the camera.
 */
const HAND = 0.05;

export interface CameraRail {
  readonly rail: DiveRail;
  readonly engaged: boolean;
  readonly position: number;
  readonly target: number;
  readonly moving: boolean;
  /** Take the camera (if not yet) and put the frame at `t` now. */
  scrub(t: number): void;
  /** Take the camera (if not yet) and put the frame at `t` exactly, no follow (the caller smooths). */
  place(t: number): void;
  /** Take the camera (if not yet) and glide to `t` (in `seconds`, eased, when given). */
  travelTo(t: number, seconds?: number): void;
  /** Jump without motion, and take the camera with no offset (deep links). */
  snap(t: number): void;
  /** Give the camera back to the stage where it is. */
  release(): void;
  /** Advance and, while engaged, drive the camera. */
  update(dt: number): void;
}

export function cameraRail(
  ctx: ChapterContext,
  stops: readonly Shot[],
  lead?: Shot,
  /** Lens mode's camera sway (`@circuit/shared/world/sway`), applied to the rail's pose while it drives. */
  sway?: Sway,
): CameraRail {
  const { camera } = ctx;
  const rail = createDiveRail(stops, lead);
  let engaged = false;
  let catchUp = false;
  const offPos = new Vector3();
  const offTarget = new Vector3();
  const was = new Vector3();
  const wasTarget = new Vector3();
  let weight = 0;
  /** Where the hand wants the rail (a slider's drag), followed in `update`; null = no hand. */
  let hand: number | null = null;
  const engage = (from?: number): void => {
    if (engaged) return;
    engaged = true;
    if (from !== undefined) rail.set(from);
    catchUp = true;
  };
  /** The stops' own framing (`fit`, used by the director to keep the subject clear of the panels), carried along
   *  the rail — so the frame at a stop is exactly the named shot's, and handing the camera back never jumps. */
  type Fit = { center: readonly number[]; radius: number };
  const fits = stops.map((s) => s.fit as Fit | undefined);
  const lerpFit = (t: number, shot: Shot): void => {
    if (t < 0 || fits.some((f) => !f)) return;
    const i = Math.min(Math.floor(t), stops.length - 2);
    const k = Math.min(Math.max(t - i, 0), 1);
    const a = fits[i]!;
    const b = fits[i + 1]!;
    shot.fit = {
      center: [0, 1, 2].map((c) => a.center[c]! + (b.center[c]! - a.center[c]!) * k) as [number, number, number],
      radius: a.radius * Math.pow(b.radius / a.radius, k),
    };
  };
  const drive = (): void => {
    const shot = rail.shotAt(rail.position);
    lerpFit(rail.position, shot);
    if (weight > 0) {
      const p = shot.position as [number, number, number];
      const g = shot.target as [number, number, number];
      shot.position = [p[0] + offPos.x * weight, p[1] + offPos.y * weight, p[2] + offPos.z * weight];
      shot.target = [g[0] + offTarget.x * weight, g[1] + offTarget.y * weight, g[2] + offTarget.z * weight];
    }
    if (sway) applySway(shot, sway.yaw, sway.pitch);
    camera.go(shot, { instant: true });
  };
  return {
    rail,
    get engaged() {
      return engaged;
    },
    get position() {
      return rail.position;
    },
    get target() {
      return hand ?? rail.target;
    },
    get moving() {
      return hand !== null || rail.moving;
    },
    scrub(t) {
      engage();
      if (hand === null && rail.moving) rail.scrub(rail.position);
      hand = t;
    },
    place(t) {
      engage();
      hand = null;
      rail.scrub(t);
    },
    travelTo(t, seconds) {
      engage();
      hand = null;
      rail.travelTo(t, seconds);
    },
    snap(t) {
      hand = null;
      rail.set(t);
      engaged = true;
      catchUp = false;
      weight = 0;
      drive();
    },
    release() {
      hand = null;
      engaged = false;
      catchUp = false;
      weight = 0;
    },
    update(dt) {
      if (hand !== null) {
        const p = rail.position;
        const next = Math.abs(hand - p) < 1e-4 ? hand : p + (hand - p) * (1 - Math.exp(-dt / HAND));
        rail.scrub(next);
        if (next === hand) hand = null;
      }
      rail.step(dt);
      if (!engaged) return;
      if (catchUp) {
        // the frame on screen now vs the rail's pose: the difference fades out, never cuts
        catchUp = false;
        was.copy(camera.camera.position);
        wasTarget.copy(camera.target);
        weight = 0;
        drive();
        offPos.subVectors(was, camera.camera.position);
        offTarget.subVectors(wasTarget, camera.target);
        weight = offPos.length() + offTarget.length() > 1e-4 ? 1 : 0;
      } else weight *= Math.exp(-CATCH_UP * dt);
      if (weight < 1e-3) weight = 0;
      drive();
    },
  };
}
