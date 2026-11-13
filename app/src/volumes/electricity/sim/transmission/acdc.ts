/**
 * transmission ЛЕП-4 (step 7) — illustrative cost and loss model AC vs DC (d in km, cost in conventional units).
 *   overhead: AC 1 + 0,5·d/100, DC 4 + 0,1·d/100 → break-even 750 km;  cable: AC 1 + 6·d/100, DC 4 + 2·d/100 → 75 km
 *   losses %: AC overhead 6·d/1000; DC overhead 1,4 + 3,5·d/1000 (two converters 0,7 % each) → equal at 560 km;
 *   DC cable 1,4 + 3·d/1000; AC cable loss not shown («depends on compensation»); AC cable impossible beyond 125 km.
 */
import { chargingCurrent } from './cable';

export type RouteKind = 'overhead' | 'cable';

export interface AcDcResult {
  costAc: number;
  costDc: number;
  /** null where the document shows no bar (AC cable). */
  lossAcPct: number | null;
  lossDcPct: number;
  breakEvenKm: number;
  /** AC cable longer than l_crit (ЛЕП-3) → both AC bars hatched red. */
  acImpossible: boolean;
}

export function compareAcDc(distanceKm: number, kind: RouteKind): AcDcResult {
  const d = Math.max(0, distanceKm);
  if (kind === 'overhead') {
    return {
      costAc: 1 + (0.5 * d) / 100,
      costDc: 4 + (0.1 * d) / 100,
      lossAcPct: (6 * d) / 1000,
      lossDcPct: 1.4 + (3.5 * d) / 1000,
      breakEvenKm: 750,
      acImpossible: false,
    };
  }
  return {
    costAc: 1 + (6 * d) / 100,
    costDc: 4 + (2 * d) / 100,
    lossAcPct: null,
    lossDcPct: 1.4 + (3 * d) / 1000,
    breakEvenKm: 75,
    acImpossible: d > Math.floor(chargingCurrent(0, 'cable').criticalLengthKm),
  };
}

/** Loss equality distance of the overhead variants [km]: 6d/1000 = 1,4 + 3,5d/1000 → 560 km. */
export const OVERHEAD_LOSS_EQUAL_KM = 1.4 / ((6 - 3.5) / 1000);

/** «Розсинхронізувати сусіда»: zone frequencies drift apart, the HVDC flow stays 1000 MW. */
export function desyncState(desynced: boolean): { zoneAHz: number; zoneBHz: number; hvdcFlowMW: number } {
  return desynced ? { zoneAHz: 50.02, zoneBHz: 49.97, hvdcFlowMW: 1000 } : { zoneAHz: 50, zoneBHz: 50, hvdcFlowMW: 1000 };
}
