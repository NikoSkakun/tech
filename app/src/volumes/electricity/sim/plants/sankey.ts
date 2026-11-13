/**
 * plants M4 (step 3) — illustrative Sankey shares per 100 units of primary energy, as a flow graph
 * (node ids are stable keys; on-screen names come from the content export). `loss` flows are the red branches.
 */

export type SankeyType = 'coal' | 'gasCcgt' | 'nuclear' | 'hydro' | 'wind' | 'solarPv' | 'geothermal' | 'biomass' | 'fuelCell';

export interface SankeyFlow {
  from: string;
  to: string;
  value: number;
  loss: boolean;
}

const f = (from: string, to: string, value: number, loss = false): SankeyFlow => ({ from, to, value, loss });

export const SANKEY: Readonly<Record<SankeyType, readonly SankeyFlow[]>> = {
  coal: [
    f('chemical', 'steamHeat', 92), f('chemical', 'boilerFlueGas', 8, true),
    f('steamHeat', 'mechanical', 46), f('steamHeat', 'condenser', 46, true),
    f('mechanical', 'electricGross', 45.3), f('mechanical', 'generator', 0.7, true),
    f('electricGross', 'grid', 42.6), f('electricGross', 'auxiliaries', 2.7, true),
  ],
  gasCcgt: [
    f('chemical', 'gtMechanical', 40), f('chemical', 'exhaustHeat', 60),
    f('exhaustHeat', 'hrsg', 53), f('exhaustHeat', 'stack', 7, true),
    f('hrsg', 'stMechanical', 20), f('hrsg', 'condenser', 33, true),
    f('gtMechanical', 'electricGross', 39.3), f('stMechanical', 'electricGross', 19.7),
    f('gtMechanical', 'generator', 0.7, true), f('stMechanical', 'generator', 0.3, true),
    f('electricGross', 'grid', 58), f('electricGross', 'auxiliaries', 1, true),
  ],
  nuclear: [
    f('nuclear', 'mechanical', 33.8), f('nuclear', 'condenser', 66.2, true),
    f('mechanical', 'electricGross', 33.3), f('mechanical', 'generator', 0.5, true),
    f('electricGross', 'grid', 31.7), f('electricGross', 'auxiliaries', 1.6, true),
  ],
  hydro: [
    f('potential', 'penstock', 97), f('potential', 'friction', 3, true),
    f('penstock', 'mechanical', 91), f('penstock', 'turbine', 6, true),
    f('mechanical', 'grid', 89), f('mechanical', 'generatorTransformer', 2, true),
  ],
  wind: [
    f('kinetic', 'mechanical', 45), f('kinetic', 'betzAero', 55, true),
    f('mechanical', 'grid', 42), f('mechanical', 'drivetrain', 3, true),
  ],
  solarPv: [
    f('radiant', 'electricDc', 21), f('radiant', 'module', 79, true),
    f('electricDc', 'grid', 19), f('electricDc', 'temperatureCablesInverter', 2, true),
  ],
  geothermal: [
    f('thermal', 'mechanical', 13), f('thermal', 'condenserReinjection', 87, true),
    f('mechanical', 'grid', 12), f('mechanical', 'generator', 1, true),
  ],
  biomass: [
    f('chemical', 'steamHeat', 85), f('chemical', 'boiler', 15, true),
    f('steamHeat', 'mechanical', 32), f('steamHeat', 'condenser', 53, true),
    f('mechanical', 'grid', 30), f('mechanical', 'generator', 2, true),
  ],
  fuelCell: [
    f('chemicalH2', 'electricDc', 52), f('chemicalH2', 'heat', 48, true),
    f('electricDc', 'grid', 50), f('electricDc', 'inverter', 2, true),
  ],
};

/** Electricity delivered to the grid and the sum of losses («Показати втрати»). */
export function sankeySummary(type: SankeyType): { gridShare: number; lossShare: number } {
  const flows = SANKEY[type];
  const grid = flows.filter((x) => x.to === 'grid').reduce((s, x) => s + x.value, 0);
  const loss = flows.filter((x) => x.loss).reduce((s, x) => s + x.value, 0);
  return { gridShare: grid, lossShare: loss };
}
