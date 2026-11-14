/**
 * The nine plant types of the archipelago: id, plant-type colour (STYLE_GUIDE §2.2 `plantType.*`, the same
 * everywhere in the app), the chapter each island opens and the index of its plaque line in the `gallery`
 * facts. Pure data, no three.js.
 */
import type { ColorToken } from '@/style';

export const PLANT_IDS = ['coal', 'gas', 'nuclear', 'hydro', 'wind', 'solar', 'geoBio', 'ocean', 'future'] as const;
export type PlantId = (typeof PLANT_IDS)[number];

export interface PlantInfo {
  id: PlantId;
  /** `plantType.*` token of the island (chips, callouts, rays of the mix donut). */
  color: ColorToken;
  /** Address of the plant chapter's first step (crossReferences of `gallery`). */
  route: string;
}

export const PLANTS: Readonly<Record<PlantId, PlantInfo>> = {
  coal: { id: 'coal', color: 'plantType.coal', route: 'electricity/plant-coal/overview' },
  gas: { id: 'gas', color: 'plantType.gas', route: 'electricity/plant-gas/overview' },
  nuclear: { id: 'nuclear', color: 'plantType.nuclear', route: 'electricity/plant-nuclear/overview' },
  hydro: { id: 'hydro', color: 'plantType.hydro', route: 'electricity/plant-hydro/overview' },
  wind: { id: 'wind', color: 'plantType.wind', route: 'electricity/plant-wind/overview' },
  solar: { id: 'solar', color: 'plantType.solar', route: 'electricity/plant-solar/overview' },
  // geothermal heat and biomass share one chapter; the island shows the geothermal colour
  geoBio: { id: 'geoBio', color: 'plantType.geothermal', route: 'electricity/plant-geo-bio/overview' },
  ocean: { id: 'ocean', color: 'plantType.ocean', route: 'electricity/plant-ocean/overview' },
  // hydrogen, generator sets, storage, fusion — the storage colour
  future: { id: 'future', color: 'plantType.bess', route: 'electricity/plant-future/overview' },
};

/** Address of the next stop for travellers who skip the plants (gallery «Перехід»). */
export const TRANSMISSION_ROUTE = 'electricity/transmission/plant-exit';
