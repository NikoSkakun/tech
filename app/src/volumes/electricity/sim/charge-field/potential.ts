/**
 * `charge-field` «Модель симуляції» §4 (step `potential`): landscape φ(r) = Σ k·qᵢ/√(|r − rᵢ|² + ε²), ε = 5 mm;
 * height h = H·tanh(φ/φ_s), φ_s = 600 V, H = 6 cm (chip «висоту стиснуто: шкала нелінійна»); for a negative
 * ball the landscape shows W = q·φ (inverted). Voltmeter probes use the exact φ = Σ k·qᵢ/|r − rᵢ| (probes kept
 * ≥ 5 mm from charges). Isoline step options 10 / 25 / 50 / 100 V.
 */
import { electricPotential, vec3 } from '../core/S1-sim/field';
import { toPointCharges, type TableCharge } from './field-sandbox';

export const POTENTIAL = {
  softeningM: 0.005,
  compressionV: 600,
  heightScaleM: 0.06,
  probeMinDistanceM: 0.005,
  maxCharges: 4,
  isolineStepsV: [10, 25, 50, 100] as const,
  defaultIsolineStepV: 50,
} as const;

/** «Горб і яма» (±2 nC, 12 cm apart), «Два горби» (+2, +2 nC, 12 cm). */
export const POTENTIAL_PRESETS: Readonly<Record<'hillAndWell' | 'twoHills', readonly TableCharge[]>> = {
  hillAndWell: [
    { x: -0.06, z: 0, chargeNC: 2 },
    { x: 0.06, z: 0, chargeNC: -2 },
  ],
  twoHills: [
    { x: -0.06, z: 0, chargeNC: 2 },
    { x: 0.06, z: 0, chargeNC: 2 },
  ],
};

/** Softened potential for the landscape mesh, V. */
export function landscapePotential(charges: readonly TableCharge[], x: number, z: number): number {
  return electricPotential(toPointCharges(charges), vec3(x, 0, z), POTENTIAL.softeningM);
}

/**
 * Landscape height, m: H·tanh(s·φ/φ_s) with s = +1 for a positive ball and −1 for a negative one
 * («енергетичний рельєф для електрона»: W = q·φ has the opposite sign).
 */
export function landscapeHeight(charges: readonly TableCharge[], x: number, z: number, ballSign: 1 | -1 = 1): number {
  return POTENTIAL.heightScaleM * Math.tanh((ballSign * landscapePotential(charges, x, z)) / POTENTIAL.compressionV);
}

/** Exact potential at a probe (pushed out to ≥ 5 mm from every charge), V. */
export function probePotential(charges: readonly TableCharge[], x: number, z: number): number {
  let px = x;
  let pz = z;
  for (const c of charges) {
    const d = Math.hypot(px - c.x, pz - c.z);
    if (d < POTENTIAL.probeMinDistanceM) {
      const s = POTENTIAL.probeMinDistanceM / (d || 1);
      px = c.x + (d ? (px - c.x) * s : POTENTIAL.probeMinDistanceM);
      pz = c.z + (d ? (pz - c.z) * s : 0);
    }
  }
  return electricPotential(toPointCharges(charges), vec3(px, 0, pz));
}

/** Voltmeter U = φ(A) − φ(B), V; `sameIsoline` for the green flash (|U| below half an isoline step or 0,5 V). */
export function voltmeter(charges: readonly TableCharge[], a: { x: number; z: number }, b: { x: number; z: number }, isolineStepV: number = POTENTIAL.defaultIsolineStepV): { voltageV: number; sameIsoline: boolean } {
  const u = probePotential(charges, a.x, a.z) - probePotential(charges, b.x, b.z);
  return { voltageV: u, sameIsoline: Math.abs(u) < Math.min(0.5, isolineStepV / 2) };
}
