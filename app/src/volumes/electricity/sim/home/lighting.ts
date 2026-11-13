/**
 * home §Е (step 10) — lamps: W_year = P·n·h·365/1000 kWh, C = W·tariff, replacements in 10 years = ⌈h·365·10/life⌉
 * per lamp. Step 7 «Подорож»: a resistive appliance on another voltage, P = U²/R → P'/P = (U'/U)².
 */
import { TARIFF_UAH_PER_KWH } from '@electricity/sim/core/S2-sim/house';

export type LampType = 'incandescent' | 'halogen' | 'cfl' | 'led';

export const LAMPS: Readonly<Record<LampType, { powerW: number; lumen: number; lifeH: number }>> = {
  incandescent: { powerW: 60, lumen: 710, lifeH: 1000 },
  halogen: { powerW: 42, lumen: 630, lifeH: 2000 },
  cfl: { powerW: 13, lumen: 750, lifeH: 8000 },
  led: { powerW: 7.5, lumen: 806, lifeH: 15000 },
};

export interface LightingResult {
  totalW: number;
  efficacyLmPerW: number;
  kWhPerYear: number;
  uahPerYear: number;
  replacementsPer10Years: number;
  /** Heat into the room [W] (everything ends as heat; light is absorbed by the walls). */
  heatW: number;
}

export function lightingCost(type: LampType, count: number, hoursPerDay: number, tariff = TARIFF_UAH_PER_KWH): LightingResult {
  const l = LAMPS[type];
  const kwh = (l.powerW * count * hoursPerDay * 365) / 1000;
  return {
    totalW: l.powerW * count,
    efficacyLmPerW: l.lumen / l.powerW,
    kWhPerYear: kwh,
    uahPerYear: kwh * tariff,
    replacementsPer10Years: Math.ceil((hoursPerDay * 365 * 10) / l.lifeH - 1e-9),
    heatW: l.powerW * count,
  };
}

/** Power factor of a resistive appliance rated for `ratedV` on a socket of `socketV`: (U'/U)². */
export function resistivePowerRatio(ratedV: number, socketV: number): number {
  return (socketV / ratedV) ** 2;
}
