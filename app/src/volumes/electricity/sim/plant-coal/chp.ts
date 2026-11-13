/**
 * plant-coal M5 (step 10) CHP: P0 = 300 MW, η = 0,36 → P_fuel = 833,3 MW, Z = 6;
 *   Q_heat ∈ [0; 1,6·P0], P_el = P0 − Q/Z, ε = (P_el + Q)/P_fuel.
 * M6 (step 10) «Ранковий пік»: P from 40 % to 100 % at 3 %/min after a 0,5 min delay (100 % at 20,5 min) vs the
 * target ramp in 15 min; the shortfall area is shown in MWh. The unit size for MWh is not given in the document —
 * the 300 MW block of M5 is used (audit C1).
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

export const CHP = { p0MW: 300, eta: 0.36, z: 6 } as const;
export const CHP_FUEL_MW = CHP.p0MW / CHP.eta;

export function chpOperatingPoint(heatMW: number): { electricMW: number; heatMW: number; fuelUtilisation: number } {
  const q = clamp(heatMW, 0, 1.6 * CHP.p0MW);
  const pel = CHP.p0MW - q / CHP.z;
  return { electricMW: pel, heatMW: q, fuelUtilisation: (pel + q) / CHP_FUEL_MW };
}

export const MORNING_RAMP = { fromPct: 40, toPct: 100, rampPctPerMin: 3, delayMin: 0.5, targetMin: 15, unitMW: 300 } as const;

/** Actual unit output [%] at t [min]. */
export function actualPct(tMin: number): number {
  const m = MORNING_RAMP;
  return clamp(m.fromPct + m.rampPctPerMin * Math.max(0, tMin - m.delayMin), m.fromPct, m.toPct);
}

/** Demanded output [%] — the 15-min target ramp. */
export function targetPct(tMin: number): number {
  const m = MORNING_RAMP;
  return clamp(m.fromPct + ((m.toPct - m.fromPct) * Math.max(0, tMin)) / m.targetMin, m.fromPct, m.toPct);
}

/** Time to reach 100 % [min] = 0,5 + 60/3 = 20,5. */
export const MORNING_FULL_MIN = MORNING_RAMP.delayMin + (MORNING_RAMP.toPct - MORNING_RAMP.fromPct) / MORNING_RAMP.rampPctPerMin;

/** Shortfall energy ∫(target − actual)⁺ dt up to t [MWh] for a unit of `unitMW`. */
export function shortfallMWh(tMin: number, unitMW: number = MORNING_RAMP.unitMW): number {
  const n = Math.max(1, Math.ceil(tMin * 100));
  const h = tMin / n;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * h;
    area += Math.max(0, targetPct(t) - actualPct(t)) * h;
  }
  return (area / 100) * unitMW / 60;
}
