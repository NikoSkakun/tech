/**
 * `plant-ocean` M2 batch runs: 6 tidal cycles from h_b = 0 / HOLD, report and average the last two (steady state);
 * «energy per day» = energy per cycle × 24/12.42. Spring–neap: average over 29.5 days.
 */
import { BARRAGE, T_M2_S, createBarrage, type BarrageParams } from './barrage';

export interface BarrageResult {
  energyPerCycleMwh: number;
  energyPerDayMwh: number;
  pMaxMw: number;
  genHoursPerDay: number;
  basinMinM: number;
  basinMaxM: number;
  /** Last cycle sampled every 5 min: t (h from the cycle start), sea, basin, P (MW), state. */
  series: { hour: number; seaM: number; basinM: number; pMw: number; state: string }[];
}

export function simulateBarrage(p: BarrageParams, cycles = 6): BarrageResult {
  const b = createBarrage({ ...p, springNeap: false });
  const dt = BARRAGE.dtS;
  const total = Math.round((cycles * T_M2_S) / dt);
  const reportFrom = Math.round(((cycles - 2) * T_M2_S) / dt);
  const lastFrom = Math.round(((cycles - 1) * T_M2_S) / dt);
  let e = 0;
  let pMax = 0;
  let genS = 0;
  let bMin = Infinity;
  let bMax = -Infinity;
  const series: BarrageResult['series'] = [];
  for (let k = 0; k < total; k++) {
    b.step(dt);
    if (k >= reportFrom) {
      const s = b.state;
      e += s.powerW * dt;
      pMax = Math.max(pMax, s.powerW);
      if (s.powerW > 0) genS += dt;
      bMin = Math.min(bMin, s.basinM);
      bMax = Math.max(bMax, s.basinM);
      if (k >= lastFrom && (k - lastFrom) % 30 === 0) {
        series.push({
          hour: ((k - lastFrom) * dt) / 3600,
          seaM: s.seaM,
          basinM: s.basinM,
          pMw: s.powerW / 1e6,
          state: s.state,
        });
      }
    }
  }
  const perCycle = e / 2 / 3.6e9;
  const perDay = (24 * 3600) / T_M2_S;
  return {
    energyPerCycleMwh: perCycle,
    energyPerDayMwh: perCycle * perDay,
    pMaxMw: pMax / 1e6,
    genHoursPerDay: (genS / 2 / 3600) * perDay,
    basinMinM: bMin,
    basinMaxM: bMax,
    series,
  };
}

/** Spring–neap average over 29.5 days (h_start follows the current H): MWh/day and GWh/year. */
export function springNeapAverage(p: BarrageParams, days = 29.5): { mwhPerDay: number; gwhPerYear: number } {
  const b = createBarrage({ ...p, springNeap: true });
  b.step(days * 86400);
  const mwh = b.state.energyJ / 3.6e9 / days;
  return { mwhPerDay: mwh, gwhPerYear: (mwh * 365) / 1000 };
}

/** Theoretical energy of one emptying: E_p = ½·ρ·g·A_b·H², MWh. */
export function theoreticalEnergyMwh(rangeM: number): number {
  return (0.5 * 1025 * 9.81 * BARRAGE.basinM2 * rangeM * rangeM) / 3.6e9;
}
