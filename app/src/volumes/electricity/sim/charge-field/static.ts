/**
 * `charge-field` «Модель симуляції» §5 (step `static`) — simplified:
 * rubbing pass: q ← max(q − 15 nC, −300 nC); balloon sphere R = 0,12 m: C = 4πε₀R = 1,34×10⁻¹¹ F, U = q/C;
 * spark to the finger when d < |U|/E_b, E_b = 3 kV/mm (no Paschen), then q = 0; sticks to the wall if
 * |q| ≥ 60 nC. A "pass" = reversal of the drag direction after ≥ 4 cm of travel (step text).
 * Storm: slider s ∈ [0, 1] drives cloud charge density and field brightness linearly; strike at s = 1 with fixed
 * chips (300 MV, 30 kA); strike timeline: leader 1,2 s, return stroke 0,15 s, 2–3 re-strikes every 0,3 s.
 */
import { EPSILON_0_F_PER_M } from '../core/S1-sim/constants';
import { randomInt, toRandomSource, type RandomSource } from '../core/S1-sim/rng';

export const BALLOON = {
  radiusM: 0.12,
  chargePerPassC: -15e-9,
  minChargeC: -300e-9,
  stickThresholdC: 60e-9,
  breakdownVPerM: 3e6,
  passStrokeM: 0.04,
} as const;

export const balloonCapacitanceF = (): number => 4 * Math.PI * EPSILON_0_F_PER_M * BALLOON.radiusM;

export interface BalloonState {
  chargeC: number;
  /** U = q/C, V. */
  voltageV: number;
  /** Finger distance below which a spark jumps, m (|U|/E_b). */
  sparkGapM: number;
  sticksToWall: boolean;
  passes: number;
}

export interface Balloon {
  readonly state: BalloonState;
  /** One rubbing pass. */
  rub(): void;
  /** Feed the drag position along the sweater (m); counts a pass at each reversal after ≥ 4 cm. */
  dragTo(positionM: number): boolean;
  /** Finger at distance d (m): sparks (and discharges) if d < spark gap; returns true on a spark. */
  fingerAt(distanceM: number): boolean;
  reset(): void;
}

export function createBalloon(): Balloon {
  const c = balloonCapacitanceF();
  const state: BalloonState = { chargeC: 0, voltageV: 0, sparkGapM: 0, sticksToWall: false, passes: 0 };
  let anchor: number | null = null;
  let extreme = 0;
  let dir = 0;
  const publish = (): void => {
    state.voltageV = state.chargeC / c;
    state.sparkGapM = Math.abs(state.voltageV) / BALLOON.breakdownVPerM;
    state.sticksToWall = Math.abs(state.chargeC) >= BALLOON.stickThresholdC - 1e-15;
  };
  const rub = (): void => {
    state.chargeC = Math.max(state.chargeC + BALLOON.chargePerPassC, BALLOON.minChargeC);
    state.passes += 1;
    publish();
  };
  return {
    state,
    rub,
    dragTo(x: number): boolean {
      if (anchor === null) {
        anchor = x;
        extreme = x;
        return false;
      }
      const d = Math.sign(x - extreme);
      if (d !== 0 && dir !== 0 && d !== dir) {
        // reversal: count a pass if the stroke since the last reversal was long enough
        const stroke = Math.abs(extreme - anchor);
        anchor = extreme;
        extreme = x;
        dir = d;
        if (stroke >= BALLOON.passStrokeM) {
          rub();
          return true;
        }
        return false;
      }
      if (d !== 0) dir = d;
      if ((dir > 0 && x > extreme) || (dir < 0 && x < extreme)) extreme = x;
      return false;
    },
    fingerAt(distanceM: number): boolean {
      if (state.chargeC !== 0 && distanceM < state.sparkGapM) {
        state.chargeC = 0;
        publish();
        return true;
      }
      return false;
    },
    reset(): void {
      state.chargeC = 0;
      state.passes = 0;
      anchor = null;
      dir = 0;
      publish();
    },
  };
}

/** Storm slider s (0…1, default 0,2): linear scene intensities; strike at s = 1. */
export function stormState(separation: number): { chargeDensity: number; fieldBrightness: number; strike: boolean; voltageMV: number; currentKA: number } {
  const s = Math.min(Math.max(separation, 0), 1);
  return { chargeDensity: s, fieldBrightness: s, strike: s >= 1, voltageMV: 300, currentKA: 30 };
}

/** Strike timeline (scene seconds): leader, first stroke, then 2–3 re-strikes 0,3 s apart (seeded). */
export function lightningTimeline(rng: RandomSource | number = 1): { leaderS: number; strokes: { startS: number; durationS: number }[] } {
  const r = toRandomSource(rng);
  const leader = 1.2;
  const strokes = [{ startS: leader, durationS: 0.15 }];
  const repeats = randomInt(r, 2, 3);
  for (let i = 1; i <= repeats; i++) strokes.push({ startS: leader + i * 0.3, durationS: 0.15 });
  return { leaderS: leader, strokes };
}
