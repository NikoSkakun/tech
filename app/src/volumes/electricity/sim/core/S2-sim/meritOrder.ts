/**
 * Merit order / uniform-price auction with inelastic demand (grid.md §Г, also used in steps 5 and 9).
 * Offers are stacked by price (stable sort: equal prices keep the given order, so zero-price renewables placed first
 * stay first); the clearing price p* is the price of the first offer at which the cumulative volume ≥ demand.
 */

export interface Offer {
  id: string;
  volumeMW: number;
  priceEurPerMWh: number;
}

export interface AcceptedOffer extends Offer {
  /** Accepted volume [MW] (the marginal offer may be partly accepted). */
  acceptedMW: number;
  /** Cumulative volume at the right edge of this step [MW]. */
  cumulativeMW: number;
}

export interface ClearingResult {
  /** Offers in merit order with cumulative volumes (all offers, including rejected: acceptedMW = 0). */
  stack: AcceptedOffer[];
  /** Clearing price p* [€/MWh] or null when demand is not covered (price cap applies). */
  priceEurPerMWh: number | null;
  /** id of the marginal (price-setting) offer, or null on deficit. */
  marginalId: string | null;
  /** Uncovered demand [MW] (0 if covered). */
  deficitMW: number;
  totalOfferedMW: number;
}

/** Stack offers in merit order. */
export function meritOrder(offers: readonly Offer[]): Offer[] {
  return offers
    .map((o, i) => ({ o, i }))
    .sort((a, b) => a.o.priceEurPerMWh - b.o.priceEurPerMWh || a.i - b.i)
    .map((x) => x.o);
}

export function clearMarket(offers: readonly Offer[], demandMW: number): ClearingResult {
  const sorted = meritOrder(offers);
  let cum = 0;
  let remaining = Math.max(0, demandMW);
  let price: number | null = null;
  let marginal: string | null = null;
  const stack: AcceptedOffer[] = sorted.map((o) => {
    cum += Math.max(0, o.volumeMW);
    const acc = Math.min(remaining, Math.max(0, o.volumeMW));
    remaining -= acc;
    if (price === null && cum >= demandMW && demandMW > 0) {
      price = o.priceEurPerMWh;
      marginal = o.id;
    }
    return { ...o, acceptedMW: acc, cumulativeMW: cum };
  });
  return {
    stack,
    priceEurPerMWh: price,
    marginalId: marginal,
    deficitMW: Math.max(0, demandMW - cum),
    totalOfferedMW: cum,
  };
}
