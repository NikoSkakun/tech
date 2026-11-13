/**
 * Sim binding for step 10: the toy ageing model (§M6) sampled for the chart and split into its two terms for
 * the scene — calendar loss (SEI growth) and cycle loss (cracked particles). The split uses the model itself:
 * calendar = 1 − SOH at zero cycles, cycle = the rest.
 */
import {
  AGEING_MODEL_FLOOR,
  fecPerYearFromCycles,
  stateOfHealth,
  yearsToSoh,
  type Chemistry,
} from '@electricity/sim/lab-battery';

export interface AgeingScenario {
  chem: Chemistry;
  tempC: number;
  cyclesPerYear: number;
  dodPct: number;
  socAvgPct: number;
}

export const AGEING_YEARS = 20;
/** Lower edge of the SOH chart, %. */
export const AGEING_CHART_MIN = 40;

const input = (s: AgeingScenario) => ({
  chem: s.chem,
  fecPerYear: fecPerYearFromCycles(s.cyclesPerYear, s.dodPct),
  dodPct: s.dodPct,
  tempC: s.tempC,
  socAvgPct: s.socAvgPct,
});

/** SOH and its two loss terms after `years`. */
export function ageingAt(s: AgeingScenario, years: number): { soh: number; calendar: number; cycle: number } {
  const soh = stateOfHealth({ ...input(s), years });
  const calendar = 1 - stateOfHealth({ ...input(s), fecPerYear: 0, years });
  return { soh, calendar, cycle: Math.max(1 - soh - calendar, 0) };
}

export interface Trace {
  xs: number[];
  ys: number[];
}

/**
 * SOH(t) in % over 0…20 years, split where the model leaves its range: `solid` down to 60 %, `beyond` below
 * (the UI draws it thin with the «поза межами моделі» chip). The pieces share their boundary point.
 */
export function ageingCurve(s: AgeingScenario): { solid: Trace; beyond: Trace; outOfModel: boolean } {
  const solid: Trace = { xs: [], ys: [] };
  const beyond: Trace = { xs: [], ys: [] };
  for (let k = 0; k <= AGEING_YEARS * 4; k++) {
    const y = k / 4;
    const soh = stateOfHealth({ ...input(s), years: y }) * 100;
    if (soh >= AGEING_MODEL_FLOOR * 100) {
      solid.xs.push(y);
      solid.ys.push(soh);
      continue;
    }
    if (beyond.xs.length === 0 && solid.xs.length > 0) {
      beyond.xs.push(solid.xs[solid.xs.length - 1]!);
      beyond.ys.push(solid.ys[solid.ys.length - 1]!);
    }
    if (soh < AGEING_CHART_MIN) break; // below the chart: the tail simply leaves the picture
    beyond.xs.push(y);
    beyond.ys.push(soh);
  }
  return { solid, beyond, outOfModel: beyond.xs.length > 0 };
}

/** Years until 80 % SOH (null if not within 60 years). */
export function yearsTo80(s: AgeingScenario): number | null {
  return yearsToSoh(input(s), 0.8);
}
