/**
 * `transformer` Т6 (step `three-phase-groups`) and step `types` (CT and SMPS demos).
 * Т6: clock number h: (Y,y) → 0, (Y,d) → 11, (D,y) → 11, (D,d) → 0 (the 11 variant is used for Yd/Dy); "n" when
 * the LV neutral is brought out. LV vector at 30°·h clockwise from 12 (HV vector); phasors rotate CCW, so h = 11
 * means LV leads HV by 30°. Unbalance (only groups with yn, slider a ∈ [0, 1], illustrative): loaded phase
 * 230 V·(1 − c·a), others 230 V·(1 + c·a/2), c = 0,03 (Dyn11), 0,09 (Yyn0). Limb fluxes sum to zero.
 * CT: 1000/1 A, secondary 0…1 A; open secondary → danger warning. SMPS: core volume for 50 W
 * V = max(V_min, V₅₀·(50 Hz/f)^0,75), V₅₀ = 250 cm³, V_min = 3 cm³; steel up to 1 kHz, ferrite above.
 */
import { clamp } from '../core/S1-sim/math';

export type HvConnection = 'Y' | 'D';
export type LvConnection = 'y' | 'yn' | 'd';

export interface VectorGroup {
  label: string;
  clock: 0 | 11;
  /** Clockwise angle of the LV vector from 12 o'clock, degrees. */
  lvAngleCwDeg: number;
  /** Phase lead of LV over HV, degrees (h = 11 → +30°). */
  lvLeadDeg: number;
  neutral: boolean;
  /** Unbalance coefficient c (null when the slider is disabled: no LV neutral). */
  unbalanceCoefficient: number | null;
}

export function vectorGroup(hv: HvConnection, lv: LvConnection): VectorGroup {
  const lvStar = lv !== 'd';
  const clock: 0 | 11 = (hv === 'Y') === lvStar ? 0 : 11;
  const neutral = lv === 'yn';
  return {
    label: `${hv}${lv}${clock}`,
    clock,
    lvAngleCwDeg: 30 * clock,
    lvLeadDeg: clock === 11 ? 30 : 0,
    neutral,
    unbalanceCoefficient: neutral ? (hv === 'D' ? 0.03 : 0.09) : null,
  };
}

/** Phase voltages under unbalance a ∈ [0, 1] (loaded phase first), V; null when the group has no LV neutral. */
export function unbalancedVoltages(hv: HvConnection, lv: LvConnection, unbalance: number, nominalV = 230): [number, number, number] | null {
  const c = vectorGroup(hv, lv).unbalanceCoefficient;
  if (c === null) return null;
  const a = clamp(unbalance, 0, 1);
  return [nominalV * (1 - c * a), nominalV * (1 + (c * a) / 2), nominalV * (1 + (c * a) / 2)];
}

/** «Пульс потоків»: limb fluxes Φ_k = Φ_m·sin(ωt − k·120°) — their sum is zero at every instant. */
export function limbFluxes(tS: number, frequencyHz = 50, peak = 1): [number, number, number] {
  const wt = 2 * Math.PI * frequencyHz * tS;
  return [peak * Math.sin(wt), peak * Math.sin(wt - (2 * Math.PI) / 3), peak * Math.sin(wt - (4 * Math.PI) / 3)];
}

export const CURRENT_TRANSFORMER = { ratio: 1000, busRangeA: { min: 0, max: 1000 } } as const;

export function currentTransformer(busA: number, secondaryOpen: boolean): { secondaryA: number; danger: boolean } {
  const i = clamp(busA, CURRENT_TRANSFORMER.busRangeA.min, CURRENT_TRANSFORMER.busRangeA.max);
  return { secondaryA: secondaryOpen ? 0 : i / CURRENT_TRANSFORMER.ratio, danger: secondaryOpen && i > 0 };
}

export const SMPS = { referenceVolumeCm3: 250, minVolumeCm3: 3, referenceHz: 50, exponent: 0.75, ferriteAboveHz: 1000, frequencyRangeHz: { min: 50, max: 100e3 } } as const;

export function smpsCoreVolume(frequencyHz: number): { volumeCm3: number; material: 'steel' | 'ferrite'; atMinimum: boolean } {
  const f = clamp(frequencyHz, SMPS.frequencyRangeHz.min, SMPS.frequencyRangeHz.max);
  const v = SMPS.referenceVolumeCm3 * Math.pow(SMPS.referenceHz / f, SMPS.exponent);
  return { volumeCm3: Math.max(SMPS.minVolumeCm3, v), material: f > SMPS.ferriteAboveHz ? 'ferrite' : 'steel', atMinimum: v <= SMPS.minVolumeCm3 };
}
