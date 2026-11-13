/**
 * plant-hydro M1 (steps 2, 7) P = η·ρ·g·Q·H; M2 (steps 4, 5) wicket gate and turbine efficiency curves; M4 (step 5)
 * turbine choice.
 *   M2: x = Q/Q_design, Q = Q_design·gate/0,85; Francis 0,94·(1 − (x − 0,85)²) (x < 0,40 → vortex rope);
 *       Kaplan 0,93·(1 − 0,5·(x − 0,80)²); Pelton 0,91·(1 − 0,35·(x − 0,70)²), nozzles = clamp(⌈6x⌉, 1, 6); η ≥ 0;
 *       H_net = H_gross − 0,03·H_gross·(Q/Q_design)²; step-4 station H_gross 80 m, Q_design 300 m³/s, Francis.
 */
import { clamp } from '@electricity/sim/core/S2-sim/math';

export const RHO = 1000;
export const G = 9.81;
/** Average household 0,34 kW (≈ 3000 kWh per year). */
export const HOME_KW = 0.34;

export function hydroPowerMW(eta: number, flowM3s: number, headM: number): number {
  return (eta * RHO * G * flowM3s * headM) / 1e6;
}

export function homesForPowerMW(powerMW: number): number {
  return (powerMW * 1000) / HOME_KW;
}

/** Energy of 1 m³ falling H metres [kWh]. */
export function energyPerCubicMetreKWh(headM: number): number {
  return (RHO * G * headM) / 3.6e6;
}

/** Pelton jet velocity v = √(2gH) [m/s] (step 5 counter). */
export function jetVelocityMs(headM: number): number {
  return Math.sqrt(2 * G * headM);
}

export type Turbine = 'francis' | 'kaplan' | 'pelton';

export function turbineEfficiency(t: Turbine, x: number): number {
  const e = t === 'francis' ? 0.94 * (1 - (x - 0.85) ** 2) : t === 'kaplan' ? 0.93 * (1 - 0.5 * (x - 0.8) ** 2) : 0.91 * (1 - 0.35 * (x - 0.7) ** 2);
  return Math.max(0, e);
}

export function peltonNozzles(x: number): number {
  return clamp(Math.ceil(6 * x - 1e-9), 1, 6);
}

export const STEP4_STATION = { headGrossM: 80, designFlowM3s: 300 } as const;

export interface GateResult {
  flowM3s: number;
  loadRatio: number;
  netHeadM: number;
  eta: number;
  powerMW: number;
  /** Francis below 40 % flow: vortex rope, vibrations. */
  vortexRope: boolean;
}

/** Wicket-gate opening 0…1 at the step-4 station (Francis). */
export function gateOperatingPoint(gate: number, turbine: Turbine = 'francis', st = STEP4_STATION): GateResult {
  const q = (st.designFlowM3s * clamp(gate, 0, 1)) / 0.85;
  const x = q / st.designFlowM3s;
  const hNet = st.headGrossM - 0.03 * st.headGrossM * x * x;
  const eta = turbineEfficiency(turbine, x);
  return { flowM3s: q, loadRatio: x, netHeadM: hNet, eta, powerMW: hydroPowerMW(eta, q, hNet), vortexRope: turbine === 'francis' && x < 0.4 };
}

/** M4 recommendation(s) for head H [m] and flow Q [m³/s]; overlap zones return two; `bulb` hint below 15 m. */
export function chooseTurbine(headM: number, flowM3s: number): { turbines: Turbine[]; bulb: boolean } {
  if (headM > 600) return { turbines: ['pelton'], bulb: false };
  if (headM > 250) return { turbines: flowM3s < 30 ? ['pelton', 'francis'] : ['francis'], bulb: false };
  if (headM > 70) return { turbines: ['francis'], bulb: false };
  if (headM > 25) return { turbines: flowM3s < 50 ? ['francis', 'kaplan'] : ['kaplan'], bulb: false };
  return { turbines: ['kaplan'], bulb: headM < 15 };
}

/** TurbineMap zones (log-log rectangles). */
export const TURBINE_ZONES: Readonly<Record<Turbine, { headM: [number, number]; flowM3s: [number, number] }>> = {
  pelton: { headM: [100, 1900], flowM3s: [0.1, 60] },
  francis: { headM: [15, 800], flowM3s: [0.5, 1000] },
  kaplan: { headM: [2, 70], flowM3s: [2, 1000] },
};

/** Step 3 dam: horizontal water force per metre of length F = ½·ρ·g·h² [N/m]. */
export function damForcePerMetreN(depthM: number): number {
  return 0.5 * RHO * G * depthM * depthM;
}
