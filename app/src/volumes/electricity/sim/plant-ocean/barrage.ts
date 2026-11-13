/**
 * `plant-ocean` M2 (reviewed): tidal barrage as a 0-D basin, La-Rance-like. Explicit Euler, dt = 10 s.
 * Sea ζ(t) = (H/2)·cos(2πt/T_M2) (t = 0 high water); Δh = h_b − ζ; dh_b/dt = −Q/A_b (Q > 0 basin → sea).
 * Turbine: q = A_t·√(2g|Δh|), p = η·ρ·g·q·|Δh|, capped at P_rated with the flow throttled; filling / sluicing
 * through gates and idling turbines Q_f = (A_s + N·A_t)·√(2g|Δh|).
 */

export const RHO_SEA = 1025;
export const G = 9.81;
export const T_M2_S = 44712;
export const SPRING_NEAP_S = 14.77 * 86400;

export const BARRAGE = {
  basinM2: 22e6,
  turbines: 24,
  turbineAreaM2: 22.5,
  ratedW: 10e6,
  eta: 0.8,
  etaRev: 0.6,
  sluiceAreaM2: 900,
  hMinM: 1.0,
  dtS: 10,
} as const;

export type BarrageMode = 'ebb' | 'two-way' | 'manual';
export type BarrageState = 'FILL' | 'HOLD' | 'GEN' | 'SLUICE';
export type ManualCommand = 'gates' | 'turbines' | 'closed';

export interface BarrageParams {
  /** Tidal range H, m (2…14). */
  rangeM: number;
  mode: BarrageMode;
  /** Head to start generation, m (default 0.5·H ebb, 0.35·H two-way); as a fraction of H with `hStartFraction`. */
  hStartM?: number;
  /** Spring–neap modulation H(t) = H̄·(1 + 0.4·cos(2πt/14.77 d)); h_start then follows the current H. */
  springNeap?: boolean;
}

/** Turbine flow (m³/s) and power (W) for one unit at head |Δh|, with η and the P_rated cap. */
export function turbineUnit(head: number, eta: number): { q: number; p: number } {
  const dh = Math.abs(head);
  if (dh <= 0) return { q: 0, p: 0 };
  let q = BARRAGE.turbineAreaM2 * Math.sqrt(2 * G * dh);
  let p = eta * RHO_SEA * G * q * dh;
  if (p > BARRAGE.ratedW) {
    p = BARRAGE.ratedW;
    q = BARRAGE.ratedW / (eta * RHO_SEA * G * dh);
  }
  return { q, p };
}

function fillFlow(head: number): number {
  return (
    (BARRAGE.sluiceAreaM2 + BARRAGE.turbines * BARRAGE.turbineAreaM2) * Math.sqrt(2 * G * Math.abs(head))
  );
}

export function createBarrage(params: BarrageParams) {
  let p = { ...params };
  let manual: ManualCommand = 'closed';
  let acc = 0;
  const s = {
    timeS: 0,
    basinM: 0,
    seaM: 0,
    state: 'HOLD' as BarrageState,
    flowM3s: 0,
    powerW: 0,
    energyJ: 0,
  };

  const rangeAt = (t: number): number =>
    p.springNeap ? p.rangeM * (1 + 0.4 * Math.cos((2 * Math.PI * t) / SPRING_NEAP_S)) : p.rangeM;
  const hStartAt = (t: number): number => {
    const frac = (p.hStartM ?? (p.mode === 'two-way' ? 0.35 : 0.5) * p.rangeM) / p.rangeM;
    return frac * rangeAt(t);
  };

  function stepOnce(dt: number): void {
    const H = rangeAt(s.timeS);
    s.seaM = (H / 2) * Math.cos((2 * Math.PI * s.timeS) / T_M2_S);
    const dh = s.basinM - s.seaM;
    const hs = hStartAt(s.timeS);
    let q = 0;
    let pw = 0;
    if (p.mode === 'ebb') {
      if (dh < -0.02) s.state = 'FILL';
      else if (s.state === 'FILL') s.state = 'HOLD';
      if (s.state === 'HOLD' && dh >= hs) s.state = 'GEN';
      if (s.state === 'GEN' && dh < BARRAGE.hMinM) s.state = 'HOLD';
      if (s.state === 'FILL') q = -fillFlow(dh);
      else if (s.state === 'GEN') {
        const u = turbineUnit(dh, BARRAGE.eta);
        q = BARRAGE.turbines * u.q;
        pw = BARRAGE.turbines * u.p;
      }
    } else if (p.mode === 'two-way') {
      const a = Math.abs(dh);
      if (s.state === 'FILL') s.state = 'HOLD';
      if (s.state === 'HOLD' && a >= hs) s.state = 'GEN';
      if (s.state === 'GEN' && a < BARRAGE.hMinM) s.state = 'SLUICE';
      if (s.state === 'SLUICE' && a < 0.05) s.state = 'HOLD';
      if (s.state === 'GEN') {
        const u = turbineUnit(dh, dh > 0 ? BARRAGE.eta : BARRAGE.etaRev);
        q = Math.sign(dh) * BARRAGE.turbines * u.q;
        pw = BARRAGE.turbines * u.p;
      } else if (s.state === 'SLUICE') q = Math.sign(dh) * fillFlow(dh);
    } else {
      // Manual: gates (sluice both ways), turbines (generate in either direction), or closed.
      s.state = manual === 'gates' ? 'SLUICE' : manual === 'turbines' ? 'GEN' : 'HOLD';
      if (manual === 'gates') q = Math.sign(dh) * fillFlow(dh);
      else if (manual === 'turbines' && Math.abs(dh) > 0.05) {
        const u = turbineUnit(dh, dh > 0 ? BARRAGE.eta : BARRAGE.etaRev);
        q = Math.sign(dh) * BARRAGE.turbines * u.q;
        pw = BARRAGE.turbines * u.p;
      }
    }
    s.flowM3s = q;
    s.powerW = pw;
    s.energyJ += pw * dt;
    s.basinM -= (q / BARRAGE.basinM2) * dt;
    s.timeS += dt;
  }

  return {
    state: s,
    /** Advance by dt seconds on a fixed 10 s grid (the remainder is carried), so results do not depend on frame dt. */
    step(dt: number): void {
      acc += Math.max(0, dt);
      while (acc >= BARRAGE.dtS - 1e-9) {
        stepOnce(BARRAGE.dtS);
        acc -= BARRAGE.dtS;
      }
    },
    set(next: Partial<BarrageParams>): void {
      p = { ...p, ...next };
    },
    command(c: ManualCommand): void {
      manual = c;
    },
    reset(): void {
      acc = 0;
      Object.assign(s, { timeS: 0, basinM: 0, seaM: 0, state: 'HOLD', flowM3s: 0, powerW: 0, energyJ: 0 });
    },
  };
}
