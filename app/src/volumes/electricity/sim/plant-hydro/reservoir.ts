/**
 * plant-hydro M6 (step 7) — reservoir balance. A = 50 km² (constant), h = level above the normal pool [m], h ≥ 0.
 *   Q_turb = h > 0 ? 1000 : min(1000, Q_in);  Q_spill = g·min(20 000, 8000·max(h,0)^1,5)
 *   (g = 1 «auto», slider 0…1 «manual»);  dh/dt = (Q_in − Q_turb − Q_spill)/A
 *   h > 2 m forced level (amber), h > 4 m overtopping (red); H = 60 + h; P = 0,9·ρ·g·Q_turb·H.
 * «Злива»: Q_in ramps from the current value to 12 000 m³/s in 12 h, holds 12 h, ramps back in 12 h.
 * Time is compressed (1 s on screen = 1 h); explicit Euler with ≤ 10 s of model time per sub-step.
 */
import { clamp, FixedStepper } from '@electricity/sim/core/S2-sim/math';

export const RESERVOIR = { areaM2: 5e7, turbineMaxM3s: 1000, ks: 8000, spillMaxM3s: 20000, baseHeadM: 60, eta: 0.9, forcedM: 2, overtopM: 4 } as const;
export const STORM = { peakM3s: 12000, riseH: 12, holdH: 12, fallH: 12 } as const;

export function turbineFlow(levelM: number, inflowM3s: number): number {
  return levelM > 0 ? RESERVOIR.turbineMaxM3s : Math.min(RESERVOIR.turbineMaxM3s, inflowM3s);
}

export function spillFlow(levelM: number, gate: number): number {
  return clamp(gate, 0, 1) * Math.min(RESERVOIR.spillMaxM3s, RESERVOIR.ks * Math.max(levelM, 0) ** 1.5);
}

/** Equilibrium level for a constant inflow with automatic spillway (h = ((Q_in − 1000)/(8000·g))^(2/3)). */
export function equilibriumLevelM(inflowM3s: number, gate = 1): number {
  const excess = inflowM3s - RESERVOIR.turbineMaxM3s;
  if (excess <= 0) return 0;
  return gate > 0 ? (excess / (RESERVOIR.ks * gate)) ** (2 / 3) : Infinity;
}

export function plantPowerMW(levelM: number, turbineM3s: number): number {
  return (RESERVOIR.eta * 1000 * 9.81 * turbineM3s * (RESERVOIR.baseHeadM + levelM)) / 1e6;
}

export function levelState(levelM: number): 'normal' | 'forced' | 'overtopping' {
  return levelM > RESERVOIR.overtopM ? 'overtopping' : levelM > RESERVOIR.forcedM ? 'forced' : 'normal';
}

/** Storm inflow at t hours after the start, from `baseM3s`. */
export function stormInflow(baseM3s: number, tH: number): number {
  const s = STORM;
  if (tH <= 0) return baseM3s;
  if (tH < s.riseH) return baseM3s + ((s.peakM3s - baseM3s) * tH) / s.riseH;
  if (tH < s.riseH + s.holdH) return s.peakM3s;
  if (tH < s.riseH + s.holdH + s.fallH) return s.peakM3s - ((s.peakM3s - baseM3s) * (tH - s.riseH - s.holdH)) / s.fallH;
  return baseM3s;
}

export function createReservoir(initialInflowM3s = 800) {
  const h = 10; // s of model time
  const stepper = new FixedStepper(h);
  let level = 0;
  let tS = 0;
  let inflow = initialInflowM3s;
  let gate = 1;
  let auto = true;
  let storm: { startS: number; baseM3s: number } | null = null;
  let maxLevel = 0;
  const qIn = () => (storm ? stormInflow(storm.baseM3s, (tS - storm.startS) / 3600) : inflow);
  return {
    get state() {
      const q = qIn();
      const qt = turbineFlow(level, q);
      const qs = spillFlow(level, auto ? 1 : gate);
      return { timeS: tS, levelM: level, maxLevelM: maxLevel, inflowM3s: q, turbineM3s: qt, spillM3s: qs, powerMW: plantPowerMW(level, qt), status: levelState(level) };
    },
    set(p: { inflowM3s?: number; auto?: boolean; gate?: number }) {
      if (p.inflowM3s !== undefined) {
        inflow = clamp(p.inflowM3s, 500, 20000);
        storm = null;
      }
      if (p.auto !== undefined) auto = p.auto;
      if (p.gate !== undefined) gate = clamp(p.gate, 0, 1);
    },
    startStorm() {
      storm = { startS: tS, baseM3s: qIn() };
    },
    /** Advance by dt seconds of MODEL time (the scene passes dt·3600 for «1 s = 1 h»). */
    step(dtS: number) {
      const n = stepper.advance(dtS);
      for (let i = 0; i < n; i++) {
        const q = qIn();
        const d = (q - turbineFlow(level, q) - spillFlow(level, auto ? 1 : gate)) / RESERVOIR.areaM2;
        level = Math.max(0, level + d * h);
        tS += h;
        maxLevel = Math.max(maxLevel, level);
      }
    },
  };
}
