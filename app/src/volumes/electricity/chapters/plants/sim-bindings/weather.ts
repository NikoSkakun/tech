/**
 * Illustrative weather of the step-9 race (plants M6: «Вітер/СЕС не диспетчеризовані: P(t) = погодний шум, не
 * реагує»). Deterministic, no randomness: a sum of incommensurate sines. `nightMorning(h)` gives the demand of the
 * «Ніч → ранок» run (60 % at 03:00 rising to 85 % at 09:00) and the sun's share of the solar rating. No three.js.
 */

/** Wind lane, % of rating, at model time `tMin` (gusty, 25…65 %). */
export function windPct(tMin: number): number {
  return 45 + 12 * Math.sin(tMin * 0.21 + 0.6) + 6 * Math.sin(tMin * 0.83 + 1.9) + 3 * Math.sin(tMin * 2.7);
}

/** Solar lane, % of rating, at clock hour `h` (sunrise ≈ 05:00, noon peak 70 %), with passing clouds. */
export function solarPct(h: number): number {
  const sun = Math.max(0, Math.sin(((h - 5) / 14) * Math.PI));
  return 70 * sun * (0.85 + 0.15 * Math.sin(h * 9.1));
}

/** Demand of the «Ніч → ранок» run, % of the dispatchable rating, for clock hour 3…9. */
export function morningDemandPct(h: number): number {
  const k = Math.min(1, Math.max(0, (h - 3) / 6));
  return 60 + 25 * k * k * (3 - 2 * k);
}
