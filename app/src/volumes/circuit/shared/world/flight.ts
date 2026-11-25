/**
 * Moving between floors, on the dive rail (`dive.ts`). While the rail is engaged it owns the camera and `deep`
 * every frame: the frame is a function of the rail's position, whether the hand scrubs it, a click travels it, or
 * a step change flies it. Around the rail:
 * - down from the stand plan in a step flight: the lens goes onto the wire and the camera to `lens` first (one
 *   camera move), then the rail engages at 0 — the same pose — and travels;
 * - the hand on the rail from the stand plan (`prologue/dive`): the rail's own lens leg (−½…0) is the take of the
 *   lens — the lens param and the camera are functions of the position there too;
 * - engaging never cuts: whatever separates the camera on screen from the rail's pose (the reader's orbit, the
 *   idle drift, a camera move still under way) is carried as an offset that fades out in ≈ 0.5 s (`CATCH_UP`);
 * - at the end of a travel to a step whose camera is not the stop's own shot (`race`, `copper-gate`, …): the rail
 *   lets go and one camera move takes the frame there, the lens returning to the step's `lens` value.
 */
import { applySway, type Sway } from './sway';
import { Vector3 } from 'three';
import type { ChapterContext, Shot } from '@/engine/api';
import { REDUCED_MOTION } from '@/style';
import { STAGE_SHOTS } from '@circuit/shared/stage';
import type { DiveRail } from './dive';
import { LEG } from './levels';

const LENS_SHOT = new Vector3(...STAGE_SHOTS.lens.position);
/** Shot names at the rail's stops (0 lens · 1 «жила» · 2 «ряди» · 3 «один атом»). */
export const STOP_SHOTS = ['lens', 'handover', 'copper-rows', 'copper-atom'] as const;
/** Rate (1/s) at which the offset between the camera on screen and the rail's pose fades after engaging. */
const CATCH_UP = 6;

export interface FlightPlan {
  /** Where to end: `deep` and the camera of the destination. */
  deep: number;
  camera: string | Shot;
  /** The stage param `lens` at the end (the lens lies over the wire during any time below the stand). */
  lens: number;
}

export interface Flight {
  /**
   * Go to a floor: lens leg if needed (`lead` seconds for it, default `LEG.lens`), rail travel, final camera move.
   * Replaces any flight under way.
   */
  fly(plan: FlightPlan, lead?: number): void;
  /** Glide the rail to 0: the lens onto the wire, the camera to the rail's start (from the stand: the lens leg). */
  takeLens(): void;
  /** The hand on the rail (engages it at once; the camera must already be on the rail's pose). */
  scrub(t: number): void;
  travelTo(t: number, seconds?: number): void;
  /** Let the stage have the camera again (step entry). */
  release(): void;
  /** True while anything of a flight is still moving. */
  readonly flying: boolean;
  /** True while the rail owns the camera and `deep` (from the first scrub / travel / flight until a step entry). */
  readonly engaged: boolean;
  /** Every frame, before the world applies `deep`. */
  update(dt: number): void;
}

export function createFlight(
  ctx: ChapterContext,
  rail: DiveRail,
  deepNow: () => number,
  lensNow: () => number,
  /** Lens mode's camera sway (`sway.ts`), applied to the rail's pose while the rail owns the camera. */
  sway?: Sway,
): Flight {
  const { stage, camera } = ctx;
  let engaged = false;
  /** Seconds of a camera-only move (lens leg, final move) still running. */
  let busy = 0;
  /** What to do when the rail arrives. */
  let pending: FlightPlan | null = null;
  /** The lens leg is running: engage and travel when it ends. */
  let afterLens: number | null = null;
  /** The rail drives the stage param `lens` (its position is on the lens leg, or just left it). */
  let lensDriven = false;
  /** Engaged this frame at this position: measure the offset of the camera on screen from the rail's pose. */
  let catchFrom: number | null = null;
  /** The offset (camera position, look-at target) and its weight, fading to 0. */
  const offPos = new Vector3();
  const offTarget = new Vector3();
  let offWeight = 0;
  const span = (d: number): number =>
    ctx.reducedMotion ? Math.min(d, Math.max(0.3, d * REDUCED_MOTION.camera)) : d;
  const engage = (): void => {
    if (!engaged) {
      rail.set(rail.positionOf(deepNow(), lensNow()));
      catchFrom = rail.position;
    }
    engaged = true;
  };
  /** The lens onto the wire and the camera to `lens`; `seconds` longer when the camera comes from far away. */
  const lensLeg = (seconds: number = LEG.lens): void => {
    stage.setParam('lens', 1, { duration: span(Math.min(seconds, LEG.lens + 0.6)), ease: 'power2.inOut' });
    camera.go('lens', { duration: seconds, ease: 'power2.inOut' });
    busy = span(seconds);
  };
  const atLens = (): boolean => lensNow() > 0.99 && camera.camera.position.distanceTo(LENS_SHOT) < 0.4;

  const flight: Flight = {
    get flying() {
      return busy > 0 || afterLens !== null || pending !== null || (engaged && rail.moving);
    },
    fly(plan, lead) {
      pending = plan;
      afterLens = null;
      const from = deepNow();
      if (plan.deep > from && from < 0.01 && !atLens()) {
        lensLeg(lead);
        afterLens = plan.deep;
        return;
      }
      // the step's own tween would take the lens away while the reader is still below: hold it
      if (from > 0.01) stage.setParam('lens', 1, { instant: lensNow() > 0.99, duration: 0.4 });
      engage();
      rail.travelTo(plan.deep);
    },
    takeLens() {
      pending = null;
      engage();
      rail.travelTo(0);
    },
    scrub(t) {
      pending = null;
      engage();
      rail.scrub(t);
    },
    travelTo(t, seconds) {
      pending = null;
      engage();
      rail.travelTo(t, seconds);
    },
    get engaged() {
      return engaged;
    },
    release() {
      engaged = false;
      pending = null;
      afterLens = null;
      lensDriven = false;
      catchFrom = null;
      offWeight = 0;
    },
    update(dt) {
      if (busy > 0) {
        busy = Math.max(0, busy - dt);
        if (busy === 0 && afterLens !== null) {
          const to = afterLens;
          afterLens = null;
          engage();
          rail.travelTo(to);
        }
      }
      if (!engaged) return;
      const t = rail.step(ctx.reducedMotion ? dt / REDUCED_MOTION.camera : dt);
      stage.setParam('deep', rail.deepAt(t), { instant: true });
      // the lens leg: the lens is the rail's too; leaving it (or entering it) hands the param over once more
      if (t < 0 || lensDriven) {
        stage.setParam('lens', rail.lensAt(t), { instant: true });
        lensDriven = t < 0;
      }
      if (catchFrom !== null) {
        // the frame on screen now vs the rail's pose where it engaged: the difference fades out, never cuts
        const was = camera.camera.position.clone();
        const wasTarget = camera.target.clone();
        camera.go(rail.shotAt(catchFrom), { instant: true });
        offPos.subVectors(was, camera.camera.position);
        offTarget.subVectors(wasTarget, camera.target);
        offWeight = offPos.length() + offTarget.length() > 1e-4 ? 1 : 0;
        catchFrom = null;
      } else offWeight = offWeight * Math.exp(-CATCH_UP * dt);
      if (offWeight < 1e-3) offWeight = 0;
      const shot = rail.shotAt(t);
      if (offWeight > 0) {
        const p = shot.position as [number, number, number];
        const g = shot.target as [number, number, number];
        shot.position = [
          p[0] + offPos.x * offWeight,
          p[1] + offPos.y * offWeight,
          p[2] + offPos.z * offWeight,
        ];
        shot.target = [
          g[0] + offTarget.x * offWeight,
          g[1] + offTarget.y * offWeight,
          g[2] + offTarget.z * offWeight,
        ];
      }
      if (sway) applySway(shot, sway.yaw, sway.pitch);
      camera.go(shot, { instant: true });
      if (pending && !rail.moving) {
        const plan = pending;
        pending = null;
        const stop = STOP_SHOTS[Math.round(plan.deep)];
        if (plan.camera !== stop) {
          // the rail's stop is not the step's frame: one camera move takes it there
          engaged = false;
          camera.go(plan.camera, { duration: LEG.lens + 0.3, ease: 'power2.inOut' });
          busy = span(LEG.lens + 0.3);
        }
        if (Math.abs(plan.lens - lensNow()) > 0.01)
          stage.setParam('lens', plan.lens, { duration: span(LEG.lens), ease: 'power2.inOut' });
      }
    },
  };
  return flight;
}
