/**
 * Protection devices (home.md §А, §В; distribution.md Р5).
 *  MCB (IEC 60898-1, one point inside the bands): thermal release = first-order body θ, dθ/dt = ((I/In)² − θ)/τ,
 *  τ = 120 s, trip at θ ≥ 1,30² = 1,69 → from cold t = −τ·ln(1 − 1,69/(I/In)²); magnetic release I ≥ k_m·In →
 *  0,01 s with k_m: B 4, C 7, D 14.
 *  Fuse gG (illustrative): t = max(0,004 s; 80 s/((I/In)² − 1)) for I > 1,25·In.
 *  RCD: trips at I_Δ ≥ 0,75·IΔn in 0,025 s.
 */
import { firstOrderCrossingTimeS, firstOrderStep } from './thermal';

export type McbCurve = 'B' | 'C' | 'D';
export const MCB_MAGNETIC_MULTIPLE: Readonly<Record<McbCurve, number>> = { B: 4, C: 7, D: 14 };
/** UI bands of the magnetic release (multiples of In). */
export const MCB_MAGNETIC_BAND: Readonly<Record<McbCurve, readonly [number, number]>> = { B: [3, 5], C: [5, 10], D: [10, 20] };
export const MCB_TAU_S = 120;
export const MCB_THERMAL_THRESHOLD = 1.69;
export const MCB_MAGNETIC_TIME_S = 0.01;

export type TripReason = 'thermal' | 'magnetic';

/** Trip time from the cold state at a constant current [s] (Infinity = never) and the release that acts. */
export function mcbTripTime(currentA: number, ratedA: number, curve: McbCurve, theta0 = 0): { timeS: number; reason: TripReason | null } {
  const k = currentA / ratedA;
  if (k >= MCB_MAGNETIC_MULTIPLE[curve]) return { timeS: MCB_MAGNETIC_TIME_S, reason: 'magnetic' };
  const t = firstOrderCrossingTimeS(theta0, k * k, MCB_TAU_S, MCB_THERMAL_THRESHOLD);
  return Number.isFinite(t) ? { timeS: t, reason: 'thermal' } : { timeS: Infinity, reason: null };
}

export interface McbState {
  /** Bimetal «temperature» θ (dimensionless; steady value (I/In)²). */
  theta: number;
  closed: boolean;
  tripReason: TripReason | null;
  /** Simulated time of the trip [s] (null if closed). */
  tripTimeS: number | null;
  timeS: number;
  /** Bending of the bimetal for the scene, θ/θ_t clamped to [0, 1]. */
  bend: number;
  /** Time to trip at the present current [s] (Infinity if it will not trip). */
  timeToTripS: number;
}

export interface Mcb {
  readonly state: Readonly<McbState>;
  readonly ratedA: number;
  readonly curve: McbCurve;
  /** Advance with the present current [A] (any dt; trip time is resolved exactly inside the step). */
  step(dtS: number, currentA: number): void;
  /** Re-close («Звести автомат»): θ stays as it is — a hot bimetal trips sooner. */
  close(): void;
  reset(): void;
}

export function createMcb(ratedA: number, curve: McbCurve): Mcb {
  const init = (): McbState => ({ theta: 0, closed: true, tripReason: null, tripTimeS: null, timeS: 0, bend: 0, timeToTripS: Infinity });
  let st = init();
  const derive = (currentA: number) => {
    st.bend = Math.min(1, Math.max(0, st.theta / MCB_THERMAL_THRESHOLD));
    st.timeToTripS = st.closed ? mcbTripTime(currentA, ratedA, curve, st.theta).timeS : Infinity;
  };
  return {
    get state() {
      return st;
    },
    ratedA,
    curve,
    step(dtS, currentA) {
      if (!(dtS > 0)) return;
      const i = st.closed ? Math.max(0, currentA) : 0;
      const target = (i / ratedA) ** 2;
      if (st.closed) {
        const t = mcbTripTime(i, ratedA, curve, st.theta);
        if (t.reason !== null && t.timeS <= dtS) {
          st.theta = firstOrderStep(st.theta, target, MCB_TAU_S, t.timeS);
          st.closed = false;
          st.tripReason = t.reason;
          st.tripTimeS = st.timeS + t.timeS;
          // cooling for the rest of the step
          st.theta = firstOrderStep(st.theta, 0, MCB_TAU_S, dtS - t.timeS);
          st.timeS += dtS;
          derive(0);
          return;
        }
      }
      st.theta = firstOrderStep(st.theta, target, MCB_TAU_S, dtS);
      st.timeS += dtS;
      derive(i);
    },
    close() {
      st.closed = true;
      st.tripReason = null;
      st.tripTimeS = null;
    },
    reset() {
      st = init();
    },
  };
}

/** gG fuse (illustrative curve of distribution Р5): t = max(0,004; 80/((I/In)² − 1)) for I > 1,25·In. */
export function fuseTripTimeS(currentA: number, ratedA: number): number {
  const k = currentA / ratedA;
  if (k <= 1.25) return Infinity;
  return Math.max(0.004, 80 / (k * k - 1));
}

export type ProtectiveDevice =
  | { id: string; kind: 'mcb'; ratedA: number; curve: McbCurve }
  | { id: string; kind: 'fuse'; ratedA: number };

export interface SelectivityRow {
  id: string;
  timeS: number;
  /** This device clears the fault (smallest time among those that carry the fault current). */
  trips: boolean;
}

/** Fault through a chain of devices: each device's time; the fastest one trips (ties all trip). */
export function selectivity(devices: readonly ProtectiveDevice[], faultA: number): SelectivityRow[] {
  const times = devices.map((d) => (d.kind === 'mcb' ? mcbTripTime(faultA, d.ratedA, d.curve).timeS : fuseTripTimeS(faultA, d.ratedA)));
  const best = Math.min(...times);
  return devices.map((d, i) => ({ id: d.id, timeS: times[i]!, trips: Number.isFinite(best) && Math.abs(times[i]! - best) < 1e-12 }));
}

/** RCD: trips when the residual current reaches 0,75·IΔn (model threshold), in 0,025 s. */
export const RCD_TRIP_FRACTION = 0.75;
export const RCD_TRIP_TIME_S = 0.025;

export function rcdTrips(residualA: number, ratedResidualA: number): boolean {
  return residualA >= RCD_TRIP_FRACTION * ratedResidualA - 1e-12;
}
