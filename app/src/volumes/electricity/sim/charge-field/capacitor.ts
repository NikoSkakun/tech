/**
 * `charge-field` «Модель симуляції» §6 (step `capacitor`): ideal parallel plates (no fringing, chip «спрощена
 * модель»): C = ε₀·ε_r·A/d, Q = C·U, E = U/d, W = C·U²/2. Breakdown if E > E_b → spark, U → 0 and the slider
 * rebounds to 0,9·E_b·d. Lamp flash: brightness ∝ log W; below 1 μJ «енергії замало».
 */
import { ELEMENTARY_CHARGE_C, EPSILON_0_F_PER_M } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';

export type DielectricId = 'air' | 'ptfe' | 'glass' | 'ceramic';

export const DIELECTRICS: Readonly<Record<DielectricId, { permittivity: number; breakdownVPerM: number }>> = {
  air: { permittivity: 1.0006, breakdownVPerM: 3e6 },
  ptfe: { permittivity: 2.1, breakdownVPerM: 60e6 },
  glass: { permittivity: 6.0, breakdownVPerM: 13e6 },
  ceramic: { permittivity: 2000, breakdownVPerM: 10e6 },
};

export const CAPACITOR_RANGES = {
  voltageV: { min: 0, max: 1000, step: 10, default: 100 },
  areaM2: { min: 25e-4, max: 400e-4, default: 100e-4 },
  gapM: { min: 0.1e-3, max: 5e-3, step: 0.1e-3, default: 1e-3 },
} as const;

export interface CapacitorParams {
  voltageV: number;
  areaM2: number;
  gapM: number;
  dielectric: DielectricId;
}

export interface CapacitorState {
  capacitanceF: number;
  chargeC: number;
  /** Q/e. */
  electrons: number;
  fieldVPerM: number;
  energyJ: number;
  /** E > E_b (relative tolerance 10⁻⁹, so E = E_b exactly is "on the edge", not breakdown). */
  breakdown: boolean;
  /** E/E_b. */
  breakdownRatio: number;
  /** Slider value after a breakdown: 0,9·E_b·d, V. */
  reboundVoltageV: number;
  /** W ≥ 1 μJ — the lamp visibly flashes. */
  lampVisible: boolean;
  /** Lamp brightness 0…1 on a log scale of W (1 μJ → 0, 10 J → 1). */
  lampBrightness: number;
}

export function parallelPlateCapacitor(p: CapacitorParams): CapacitorState {
  const d = DIELECTRICS[p.dielectric];
  const gap = clamp(p.gapM, CAPACITOR_RANGES.gapM.min, CAPACITOR_RANGES.gapM.max);
  const area = clamp(p.areaM2, CAPACITOR_RANGES.areaM2.min, CAPACITOR_RANGES.areaM2.max);
  const u = clamp(p.voltageV, CAPACITOR_RANGES.voltageV.min, CAPACITOR_RANGES.voltageV.max);
  const c = (EPSILON_0_F_PER_M * d.permittivity * area) / gap;
  const q = c * u;
  const e = u / gap;
  const w = 0.5 * c * u * u;
  const ratio = e / d.breakdownVPerM;
  return {
    capacitanceF: c,
    chargeC: q,
    electrons: q / ELEMENTARY_CHARGE_C,
    fieldVPerM: e,
    energyJ: w,
    breakdown: ratio > 1 + 1e-9,
    breakdownRatio: ratio,
    reboundVoltageV: 0.9 * d.breakdownVPerM * gap,
    lampVisible: w >= 1e-6,
    lampBrightness: w > 0 ? clamp((Math.log10(w) + 6) / 7, 0, 1) : 0,
  };
}
