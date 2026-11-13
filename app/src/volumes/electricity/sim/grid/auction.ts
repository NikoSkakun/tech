/**
 * grid §Г «Аукціон» (steps 5, 9): day-ahead hour with inelastic demand and the offer table of the model country.
 */
import { clearMarket, type ClearingResult, type Offer } from '@electricity/sim/core/S2-sim/meritOrder';

export const BASE_OFFERS: readonly Offer[] = [
  { id: 'nuclear', volumeMW: 7000, priceEurPerMWh: 10 },
  { id: 'hydro', volumeMW: 2000, priceEurPerMWh: 20 },
  { id: 'chp', volumeMW: 1200, priceEurPerMWh: 90 },
  { id: 'coal', volumeMW: 1800, priceEurPerMWh: 110 },
  { id: 'import', volumeMW: 2100, priceEurPerMWh: 130 },
  { id: 'gas', volumeMW: 1000, priceEurPerMWh: 160 },
  { id: 'demandResponse', volumeMW: 500, priceEurPerMWh: 300 },
];
export const WIND_OFFER: Offer = { id: 'wind', volumeMW: 2000, priceEurPerMWh: 0 };
export const SOLAR_OFFER: Offer = { id: 'solar', volumeMW: 3000, priceEurPerMWh: 0 };
/** Nuclear volume used for the «Виручка АЕС за годину» chip. */
export const NUCLEAR_MW = 7000;

export interface AuctionParams {
  /** Demand 8…17 GW expressed in MW. */
  demandMW: number;
  windy: boolean;
  sunny: boolean;
}

export interface AuctionResult extends ClearingResult {
  /** Revenue of the nuclear fleet for the hour p*·7000 MW [€] (null on deficit). */
  nuclearRevenueEur: number | null;
}

export function runAuction(p: AuctionParams): AuctionResult {
  // zero-price renewables are placed first (stable merit-order sort keeps wind before solar before nuclear)
  const offers: Offer[] = [...(p.windy ? [WIND_OFFER] : []), ...(p.sunny ? [SOLAR_OFFER] : []), ...BASE_OFFERS];
  const r = clearMarket(offers, p.demandMW);
  return { ...r, nuclearRevenueEur: r.priceEurPerMWh === null ? null : r.priceEurPerMWh * NUCLEAR_MW };
}
