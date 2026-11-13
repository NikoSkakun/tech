/**
 * plants step 11 — data of the «Порівняння» table for `CompareTable` (numbers only, for sorting and range bars;
 * sources and footnotes are on-screen text from the content export). null = «н/д».
 * Ranges are [min, max]; CO₂ is the IPCC 2014 life-cycle median with its range; LCOE in $/MWh (new plants, unsubsidised).
 */

export type Range = readonly [number, number];

export interface CompareRow {
  id: string;
  /** Palette token `plantType.*` (STYLE_GUIDE §2.2). */
  color: 'slate' | 'pink' | 'violet' | 'blue' | 'sky' | 'teal' | 'amber' | 'orange' | 'green' | 'cyan' | 'lime';
  cfPct: Range | null;
  etaPct: Range | null;
  co2Median: number | null;
  co2Range: Range | null;
  lcoeUsd: Range | null;
  rampPctPerMin: Range | null;
  /** Cold start, minutes (null = not applicable / weather). */
  coldStartMin: Range | null;
  dispatchable: 'yes' | 'no' | 'partly';
  lowCarbon: boolean;
}

const r = (a: number, b: number): Range => [a, b];

export const COMPARE_ROWS: readonly CompareRow[] = [
  { id: 'coal', color: 'slate', cfPct: r(40, 80), etaPct: r(33, 47), co2Median: 820, co2Range: r(740, 910), lcoeUsd: r(72, 177), rampPctPerMin: r(1, 6), coldStartMin: r(360, 600), dispatchable: 'yes', lowCarbon: false },
  { id: 'gasCcgt', color: 'pink', cfPct: r(30, 70), etaPct: r(55, 64), co2Median: 490, co2Range: r(410, 650), lcoeUsd: r(51, 129), rampPctPerMin: r(2, 8), coldStartMin: r(120, 240), dispatchable: 'yes', lowCarbon: false },
  { id: 'gasPeaker', color: 'pink', cfPct: r(2, 15), etaPct: r(33, 44), co2Median: null, co2Range: r(600, 750), lcoeUsd: r(144, 276), rampPctPerMin: r(8, 20), coldStartMin: r(5, 15), dispatchable: 'yes', lowCarbon: false },
  { id: 'gasEngine', color: 'pink', cfPct: r(20, 60), etaPct: r(42, 50), co2Median: null, co2Range: r(450, 550), lcoeUsd: null, rampPctPerMin: r(20, 100), coldStartMin: r(2, 5), dispatchable: 'yes', lowCarbon: false },
  { id: 'nuclear', color: 'violet', cfPct: r(80, 93), etaPct: r(33, 37), co2Median: 12, co2Range: r(3.7, 110), lcoeUsd: r(175, 255), rampPctPerMin: r(1, 5), coldStartMin: r(1440, 1440), dispatchable: 'yes', lowCarbon: true },
  { id: 'hydro', color: 'blue', cfPct: r(30, 60), etaPct: r(85, 92), co2Median: 24, co2Range: r(1, 2200), lcoeUsd: r(57, 57), rampPctPerMin: r(10, 100), coldStartMin: r(1, 3), dispatchable: 'yes', lowCarbon: true },
  { id: 'psh', color: 'sky', cfPct: r(10, 30), etaPct: r(70, 80), co2Median: null, co2Range: null, lcoeUsd: null, rampPctPerMin: r(10, 100), coldStartMin: r(1, 3), dispatchable: 'yes', lowCarbon: true },
  { id: 'windOnshore', color: 'teal', cfPct: r(25, 45), etaPct: r(40, 45), co2Median: 11, co2Range: r(7, 56), lcoeUsd: r(37, 99), rampPctPerMin: null, coldStartMin: null, dispatchable: 'no', lowCarbon: true },
  { id: 'windOffshore', color: 'teal', cfPct: r(40, 50), etaPct: r(40, 45), co2Median: 12, co2Range: r(8, 35), lcoeUsd: r(105, 167), rampPctPerMin: null, coldStartMin: null, dispatchable: 'no', lowCarbon: true },
  { id: 'solarPv', color: 'amber', cfPct: r(10, 25), etaPct: r(18, 23), co2Median: 48, co2Range: r(18, 180), lcoeUsd: r(40, 98), rampPctPerMin: null, coldStartMin: null, dispatchable: 'no', lowCarbon: true },
  { id: 'csp', color: 'amber', cfPct: r(40, 70), etaPct: r(15, 20), co2Median: 27, co2Range: r(8.8, 63), lcoeUsd: r(92, 92), rampPctPerMin: null, coldStartMin: null, dispatchable: 'partly', lowCarbon: true },
  { id: 'geothermal', color: 'orange', cfPct: r(75, 90), etaPct: r(8, 20), co2Median: 38, co2Range: r(6, 79), lcoeUsd: r(60, 111), rampPctPerMin: null, coldStartMin: null, dispatchable: 'yes', lowCarbon: true },
  { id: 'biomass', color: 'green', cfPct: r(50, 80), etaPct: r(20, 40), co2Median: 230, co2Range: r(130, 420), lcoeUsd: r(87, 87), rampPctPerMin: r(1, 5), coldStartMin: null, dispatchable: 'yes', lowCarbon: false },
  { id: 'tidalBarrage', color: 'cyan', cfPct: r(20, 30), etaPct: null, co2Median: 17, co2Range: r(5.6, 28), lcoeUsd: null, rampPctPerMin: null, coldStartMin: null, dispatchable: 'no', lowCarbon: true },
  { id: 'bess', color: 'lime', cfPct: null, etaPct: r(85, 90), co2Median: null, co2Range: null, lcoeUsd: null, rampPctPerMin: r(6000, 6000), coldStartMin: null, dispatchable: 'yes', lowCarbon: true },
];

export type CompareKey = 'cfPct' | 'etaPct' | 'co2Median' | 'lcoeUsd' | 'rampPctPerMin' | 'coldStartMin';

/** Sort by a column (range → its midpoint; «н/д» always last). */
export function sortRows(rows: readonly CompareRow[], key: CompareKey, descending = false): CompareRow[] {
  const v = (row: CompareRow): number | null => {
    const x = row[key];
    if (x === null) return key === 'co2Median' && row.co2Range ? (row.co2Range[0] + row.co2Range[1]) / 2 : null;
    return typeof x === 'number' ? x : (x[0] + x[1]) / 2;
  };
  return [...rows].sort((a, b) => {
    const va = v(a);
    const vb = v(b);
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    return descending ? vb - va : va - vb;
  });
}
