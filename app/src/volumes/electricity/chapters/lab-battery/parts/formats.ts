/**
 * Cell formats of step 2 with typical numbers. Cylinders and the prismatic cell come from the simulation
 * library's cell table (§M2); the 4680 and the phone pouch use the document's typical values (≈ 22–26 Ah;
 * 4000–5000 mAh × 3,85 V) and the NMC specific energy of §M8 for the mass.
 */
import { CELL_LIMITS, CELLS, SPECIFIC_ENERGY } from '@electricity/sim/lab-battery';

export type FormatId = '18650' | '21700' | '4680' | 'prismatic' | 'pouch';

const nmc = CELL_LIMITS.NMC.uNomV;
const byEnergy = (ah: number, volts: number) => ({
  ah,
  wh: ah * volts,
  kg: (ah * volts) / SPECIFIC_ENERGY.nmc.whPerKg,
});

export const FORMATS: Record<FormatId, { ah: number; wh: number; kg: number }> = {
  '18650': {
    ah: CELLS['18650-NMC'].capacityAh,
    wh: CELLS['18650-NMC'].capacityAh * nmc,
    kg: CELLS['18650-NMC'].massKg,
  },
  '21700': {
    ah: CELLS['21700-NMC'].capacityAh,
    wh: CELLS['21700-NMC'].capacityAh * nmc,
    kg: CELLS['21700-NMC'].massKg,
  },
  '4680': byEnergy(24, nmc),
  prismatic: {
    ah: CELLS['LFP-314'].capacityAh,
    wh: CELLS['LFP-314'].capacityAh * CELL_LIMITS.LFP.uNomV,
    kg: CELLS['LFP-314'].massKg,
  },
  pouch: byEnergy(4.5, 3.85),
};
