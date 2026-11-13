/**
 * distribution Р8 (step 8) — a day on the street: Р3 line (СІП 70 mm²), houses on phases L1, L1, L1, L2, L3, L1
 * (deliberately unbalanced), 8 kW PV on houses 1, 2, 3, 6 and 7,4 kW EV chargers (model default: houses 3 and 6).
 * House power P = load − PV + EV. Simple inverters: all with U > 253 V switch off together, then recompute (repeat
 * until stable). Volt-Watt: P_PV = 8 kW·clamp((253 − U)/5 V, 0, 1), relaxation P ← 0,8·P + 0,2·P_new (≤ 400 iterations,
 * convergence < 0,01 kW). «Розумна зарядка»: no EV in the evening, EV at night.
 */
import { solveLvLine } from './lvLine';
import type { Phase } from '@electricity/sim/core/S2-sim/voltageDrop';

export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night';
export const STREET_PHASES: readonly Phase[] = [0, 0, 0, 1, 2, 0];
export const PV_KW = 8;
export const EV_KW = 7.4;
export const OVERVOLTAGE_V = 253;

export const STREET_PRESETS: Readonly<Record<TimeOfDay, { sourceV: number; loadKW: number; pvKW: number; evCharging: 'yes' | 'no' | 'smartOnly' }>> = {
  morning: { sourceV: 235, loadKW: 1.5, pvKW: 2, evCharging: 'no' },
  noon: { sourceV: 240, loadKW: 0.3, pvKW: 8, evCharging: 'no' },
  evening: { sourceV: 230, loadKW: 4, pvKW: 0, evCharging: 'yes' },
  night: { sourceV: 238, loadKW: 0.5, pvKW: 0, evCharging: 'smartOnly' },
};

export interface StreetParams {
  time: TimeOfDay;
  pv: readonly boolean[];
  ev: readonly boolean[];
  inverters: 'simple' | 'voltWatt';
  smartCharging: boolean;
}

export const STREET_DEFAULTS: StreetParams = {
  time: 'noon',
  pv: [true, true, true, false, false, true],
  ev: [false, false, true, false, false, true],
  inverters: 'simple',
  smartCharging: false,
};

export interface StreetResult {
  voltagesV: number[];
  /** PV actually injected per house [kW]. */
  pvKW: number[];
  /** Simple inverters that switched off on overvoltage. */
  invertersOff: boolean[];
  headPhaseA: number[];
  evActive: boolean[];
  /** Voltages before the simple inverters tripped (noon scenario chip). */
  voltagesBeforeTripV: number[] | null;
}

function solve(sourceV: number, loadKW: number, pv: readonly number[], ev: readonly boolean[]) {
  return solveLvLine({
    sourceV,
    crossSectionMm2: 70,
    houses: STREET_PHASES.map((phase, k) => ({ phase, powerW: (loadKW - pv[k]! + (ev[k] ? EV_KW : 0)) * 1000 })),
  });
}

export function solveStreet(input: Partial<StreetParams> = {}): StreetResult {
  const p = { ...STREET_DEFAULTS, ...input };
  const pre = STREET_PRESETS[p.time];
  const evOn = pre.evCharging === 'yes' ? !p.smartCharging : pre.evCharging === 'smartOnly' ? p.smartCharging : false;
  const evActive = p.ev.map((e) => e && evOn);
  const avail = p.pv.map((on) => (on ? pre.pvKW : 0));
  const off = avail.map(() => false);
  let pv = [...avail];
  let r = solve(pre.sourceV, pre.loadKW, pv, evActive);
  let before: number[] | null = null;
  if (p.inverters === 'simple') {
    for (let iter = 0; iter < 6; iter++) {
      const trip = r.voltagesV.map((u, k) => pv[k]! > 0 && u > OVERVOLTAGE_V);
      if (!trip.some(Boolean)) break;
      if (before === null) before = r.voltagesV;
      trip.forEach((t, k) => {
        if (t) {
          off[k] = true;
          pv[k] = 0;
        }
      });
      r = solve(pre.sourceV, pre.loadKW, pv, evActive);
    }
  } else {
    for (let iter = 0; iter < 400; iter++) {
      const target = r.voltagesV.map((u, k) => Math.min(avail[k]!, PV_KW * Math.min(1, Math.max(0, (OVERVOLTAGE_V - u) / 5))));
      const next = pv.map((x, k) => 0.8 * x + 0.2 * target[k]!);
      const delta = Math.max(...next.map((x, k) => Math.abs(x - pv[k]!)));
      pv = next;
      r = solve(pre.sourceV, pre.loadKW, pv, evActive);
      if (delta < 0.01) break;
    }
  }
  return { voltagesV: r.voltagesV, pvKW: pv, invertersOff: off, headPhaseA: r.headPhaseA, evActive, voltagesBeforeTripV: before };
}
