/**
 * `magnetism` М3 (steps `oersted`, `solenoid`) and step `lorentz` (electron beam, Ampère swing).
 * Wire: vertical at the origin, north +Y, east +X, I > 0 upward: B_wire = (μ₀I/(2πr²))·(−y, x) (CCW from above).
 * Compass angle from north α = atan2(−B_x, B_y) of B_wire + B_E, B_E = (0, 20 μT); positive α = west.
 * Solenoid: B_air = μ₀(N/l)I, l = 0,1 m; with core B = B_sat·tanh(μ₀μ_eff(N/l)I/B_sat), μ_eff = 200,
 * B_sat = 1,6 T; paper clips n = round(40·(B/B_sat)²).
 * Beam: v = √(2eU_a/m), r = mv/(|q|B); full circle if 2r < 15 cm (bulb). Swing: tan β = B·I·L/(m·g),
 * B = 0,3 T, L = 0,05 m, m = 0,01 kg.
 */
import { ELECTRON_MASS_KG, ELEMENTARY_CHARGE_C, GRAVITY_M_PER_S2, MU_0_H_PER_M, PROTON_MASS_KG } from '../core/S1-sim/constants';
import { clamp } from '../core/S1-sim/math';

export const OERSTED_STEP = { earthT: 20e-6, currentRangeA: { min: -20, max: 20, step: 0.5 }, probeRangeM: { min: 0.01, max: 0.15, step: 0.005, default: 0.02 } } as const;

/** Field of the vertical wire at table point (x, y), T. */
export function wireFieldXY(currentA: number, x: number, y: number): { x: number; y: number } {
  const r2 = x * x + y * y;
  if (r2 === 0) return { x: 0, y: 0 };
  const k = (MU_0_H_PER_M * currentA) / (2 * Math.PI * r2);
  return { x: -y * k, y: x * k };
}

/** Compass angle from north (rad, positive = towards west) under wire + Earth field. */
export function compassAngleFromNorth(currentA: number, x: number, y: number): number {
  const b = wireFieldXY(currentA, x, y);
  return Math.atan2(-b.x, b.y + OERSTED_STEP.earthT);
}

/** Probe compass due north of the wire at distance r: B in μT and α (rad); chip B[μT] = 20·I[A]/r[cm]. */
export function oerstedProbe(currentA: number, distanceM: number): { fieldMicroT: number; angleRad: number } {
  const r = clamp(distanceM, OERSTED_STEP.probeRangeM.min, OERSTED_STEP.probeRangeM.max);
  return { fieldMicroT: ((MU_0_H_PER_M * Math.abs(currentA)) / (2 * Math.PI * r)) * 1e6, angleRad: compassAngleFromNorth(currentA, 0, r) };
}

export const SOLENOID = { lengthM: 0.1, muEff: 200, saturationT: 1.6, maxClips: 40, currentRangeA: { min: 0, max: 2, step: 0.05, default: 1 }, turnsRange: { min: 100, max: 1000, step: 100, default: 500 } } as const;

export function solenoid(turns: number, currentA: number, core: boolean, reversed = false): { fieldT: number; airFieldT: number; clips: number; saturation: number } {
  const nl = turns / SOLENOID.lengthM;
  const air = MU_0_H_PER_M * nl * currentA;
  const b = core ? SOLENOID.saturationT * Math.tanh((MU_0_H_PER_M * SOLENOID.muEff * nl * currentA) / SOLENOID.saturationT) : air;
  const sign = reversed ? -1 : 1;
  return { fieldT: sign * b, airFieldT: sign * air, clips: Math.round(SOLENOID.maxClips * (b / SOLENOID.saturationT) ** 2), saturation: Math.abs(b) / SOLENOID.saturationT };
}

export const BEAM = { bulbDiameterM: 0.15, fieldRangeT: { min: 0, max: 2e-3, step: 5e-5 }, voltageRangeV: { min: 50, max: 300, step: 10, default: 100 } } as const;

export function electronBeam(acceleratingV: number, fieldT: number, particle: 'electron' | 'proton' = 'electron'): { speedMPerS: number; radiusM: number; energyEv: number; closedCircle: boolean; turnSign: 1 | -1 } {
  const m = particle === 'electron' ? ELECTRON_MASS_KG : PROTON_MASS_KG;
  const v = Math.sqrt((2 * ELEMENTARY_CHARGE_C * acceleratingV) / m);
  const r = fieldT > 0 ? (m * v) / (ELEMENTARY_CHARGE_C * fieldT) : Infinity;
  return { speedMPerS: v, radiusM: r, energyEv: acceleratingV, closedCircle: 2 * r < BEAM.bulbDiameterM, turnSign: particle === 'electron' ? 1 : -1 };
}

export const AMPERE_SWING = { fieldT: 0.3, lengthM: 0.05, massKg: 0.01, currentRangeA: { min: -5, max: 5, step: 0.1 } } as const;

/** Swing deflection β, rad (sign follows current and magnet orientation). */
export function ampereSwingAngle(currentA: number, magnetFlipped = false): number {
  const s = magnetFlipped ? -1 : 1;
  return Math.atan((s * AMPERE_SWING.fieldT * currentA * AMPERE_SWING.lengthM) / (AMPERE_SWING.massKg * GRAVITY_M_PER_S2));
}
