/**
 * plant-nuclear M6 (step 11) — enrichment mass balance: m_F/m_P = (x_P − x_T)/(x_F − x_T), x_F = 0,711 %;
 * tails m_T/m_P = m_F/m_P − 1. Sliders x_P 3…5 %, x_T 0,20…0,30 %.
 */
export const NATURAL_U235_PCT = 0.711;

export function feedPerProduct(productPct: number, tailsPct: number): number {
  return (productPct - tailsPct) / (NATURAL_U235_PCT - tailsPct);
}

export function tailsPerProduct(productPct: number, tailsPct: number): number {
  return feedPerProduct(productPct, tailsPct) - 1;
}
