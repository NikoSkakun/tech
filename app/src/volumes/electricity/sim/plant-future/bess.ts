/**
 * `plant-future` M4 (step 6): island frequency after losing a 1000 MW unit, with a BESS in FCR; arbitrage;
 * step 5 BESS sizing.
 *
 * The frequency model is the shared one of `grid` (DECISIONS §9–10): island P_L0 15 GW, S_sync 12 GW, FCR 500 MW,
 * BESS in FCR with the 10…200 mHz droop law (`islandWithBessFcrScenario`).
 */
import {
  islandWithBessFcrScenario,
  simulateFrequency,
  type FrequencySample,
} from '@electricity/sim/core/S2-sim/frequency';

export const LOST_UNIT_MW = 1000;

export interface BessFrequencyResult {
  samples: FrequencySample[];
  nadirHz: number;
  nadirTimeS: number;
  /** Load shed by UFLS, MW. */
  shedMw: number;
  /** RoCoF at t = 0, Hz/s. */
  rocofHzPerS: number;
  /** f(30 s), Hz. */
  f30Hz: number;
}

/** Run the M4 scenario: H 2…6 s, BESS 0…1000 MW, 1000 MW lost at t = 0, 60 s simulated. */
export function bessFrequencyRun(inertiaH: number, bessMw: number, durationS = 60): BessFrequencyResult {
  const run = simulateFrequency(
    islandWithBessFcrScenario(inertiaH, bessMw),
    [{ timeS: 0, deltaMW: LOST_UNIT_MW }],
    durationS,
    0.05,
  );
  const at30 = run.samples.reduce((best, s) =>
    Math.abs(s.timeS - 30) < Math.abs(best.timeS - 30) ? s : best,
  );
  return {
    samples: run.samples,
    nadirHz: run.final.nadirHz,
    nadirTimeS: run.final.nadirTimeS,
    shedMw: run.final.pShedMW,
    rocofHzPerS: run.final.rocofAtEventHzPerS,
    f30Hz: at30.fHz,
  };
}

/** Smallest BESS (step 50 MW) for which UFLS does not trip. H 2 s → 600 MW, H 4 s → 500 MW. */
export function minimumBessWithoutShedding(inertiaH: number, stepMw = 50, maxMw = 1000): number | null {
  for (let b = 0; b <= maxMw; b += stepMw) if (bessFrequencyRun(inertiaH, b, 30).shedMw === 0) return b;
  return null;
}

/** Arbitrage profit per MWh charged: p_evening·η_rt − p_noon (η_rt 0.87); break-even ratio 1/0.87 ≈ 1.15. */
export function arbitrageProfit(priceNoon: number, priceEvening: number, etaRt = 0.87) {
  return {
    profitPerMwh: priceEvening * etaRt - priceNoon,
    breakEvenRatio: 1 / etaRt,
    profitable: priceEvening * etaRt > priceNoon,
  };
}

/** Step 5: containers of 5 MWh, area ≈ 0.35 ha per 100 MWh (estimate), homes at 1 kW each in the evening peak. */
export function bessSizing(powerMw: number, durationH: number) {
  const mwh = powerMw * durationH;
  return {
    energyMwh: mwh,
    containers: Math.ceil(mwh / 5 - 1e-9),
    areaHa: (0.35 * mwh) / 100,
    homes: powerMw * 1000,
    hours: durationH,
  };
}
