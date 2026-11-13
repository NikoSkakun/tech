/**
 * distribution step 7: Р5 protection selectivity (MCB model of `home` §А, gG fuse) and Р6 harmonics.
 * Р6: u(t) = √2·230·[sin ωt + h₃·sin 3ωt − h₅·sin 5ωt + h₇·sin 7ωt] (signs flatten the crest), THD = √(h₃² + h₅² + h₇²);
 * neutral current of a balanced three-phase building I_N = 3·I₁·h₃,i·k (I₁ = 10 A, h₃,i = 0,8), phase I = I₁·√(1 + (h₃,i·k)²).
 */
import { selectivity, type ProtectiveDevice, type SelectivityRow } from '@electricity/sim/core/S2-sim/protection';

export const DEVICES: readonly ProtectiveDevice[] = [
  { id: 'C16', kind: 'mcb', ratedA: 16, curve: 'C' },
  { id: 'C40', kind: 'mcb', ratedA: 40, curve: 'C' },
  { id: 'gG160', kind: 'fuse', ratedA: 160 },
];

export type FaultPoint = 'kettle' | 'socketCable' | 'serviceEntrance' | 'streetNearTp';

/** Fault current and the devices it flows through. */
export const FAULT_POINTS: Readonly<Record<FaultPoint, { currentA: number; devices: readonly string[] }>> = {
  kettle: { currentA: 250, devices: ['C16', 'C40', 'gG160'] },
  socketCable: { currentA: 250, devices: ['C16', 'C40', 'gG160'] },
  serviceEntrance: { currentA: 1200, devices: ['C40', 'gG160'] },
  streetNearTp: { currentA: 5000, devices: ['gG160'] },
};

export function faultSelectivity(point: FaultPoint): SelectivityRow[] {
  const f = FAULT_POINTS[point];
  return selectivity(DEVICES.filter((d) => f.devices.includes(d.id)), f.currentA);
}

export const THD_LIMIT = 0.08;
export const PEAK_V = 230 * Math.SQRT2;

export interface Harmonics {
  h3: number;
  h5: number;
  h7: number;
}

export function thd(h: Harmonics): number {
  return Math.hypot(h.h3, h.h5, h.h7);
}

/** Instantaneous voltage [V] at phase angle ωt [rad]. */
export function distortedVoltageV(h: Harmonics, wt: number): number {
  return PEAK_V * (Math.sin(wt) + h.h3 * Math.sin(3 * wt) - h.h5 * Math.sin(5 * wt) + h.h7 * Math.sin(7 * wt));
}

/** Crest value at ωt = 90° [V] (the illustrative «flattened top»). */
export function crestV(h: Harmonics): number {
  return distortedVoltageV(h, Math.PI / 2);
}

export const BUILDING = { i1A: 10, h3Current: 0.8 } as const;

export function buildingCurrents(electronicShare: number): { neutralA: number; phaseA: number } {
  const x = BUILDING.h3Current * Math.min(1, Math.max(0, electronicShare));
  return { neutralA: 3 * BUILDING.i1A * x, phaseA: BUILDING.i1A * Math.sqrt(1 + x * x) };
}

/** Disturbance buttons: sag 60 % / swell 115 % for 5 periods (100 ms); flicker ±3 % at 9 Hz. */
export const DISTURBANCES = {
  sag: { amplitude: 0.6, durationS: 0.1 },
  swell: { amplitude: 1.15, durationS: 0.1 },
  flicker: { depth: 0.03, frequencyHz: 9 },
} as const;

/** Amplitude factor of the voltage envelope at time t since the disturbance started. */
export function envelope(kind: keyof typeof DISTURBANCES, timeS: number): number {
  if (kind === 'flicker') return 1 + DISTURBANCES.flicker.depth * Math.sin(2 * Math.PI * DISTURBANCES.flicker.frequencyHz * timeS);
  const d = DISTURBANCES[kind];
  return timeS >= 0 && timeS < d.durationS ? d.amplitude : 1;
}
