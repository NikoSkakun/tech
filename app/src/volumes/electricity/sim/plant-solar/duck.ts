/**
 * `plant-solar` M5 (step 8): duck curve. Hour index h means [h, h+1). L_net = L − P_PV·profile.
 * Demonstration BESS (greedy) and demand response. GW, GWh.
 */

/** Load as a share of the 20 GW peak, h = 0…23. */
export const DUCK_LOAD_SHARE = [
  0.7, 0.66, 0.64, 0.63, 0.63, 0.66, 0.74, 0.84, 0.9, 0.92, 0.92, 0.91, 0.9, 0.89, 0.88, 0.88, 0.89, 0.93,
  0.98, 1.0, 0.99, 0.94, 0.86, 0.77,
] as const;
export const DUCK_PEAK_GW = 20;
/** PV per 1 GWp, 21 March, clear, fixed 35°, hourly mean, GW (sum 5.43 GWh/GWp). */
export const DUCK_PV_PROFILE = [
  0, 0, 0, 0, 0, 0, 0.05, 0.23, 0.41, 0.57, 0.69, 0.75, 0.75, 0.69, 0.58, 0.42, 0.23, 0.05, 0, 0, 0, 0, 0, 0,
] as const;

export interface DuckParams {
  /** Installed PV, GWp (0…30). */
  pvGw: number;
  /** BESS power, GW (energy = 4·P_b, η_rt = 0.88). */
  bessGw?: number;
  /** Demand response: −1 GW at h19, h20 and +1 GW at h11, h12. */
  demandResponse?: boolean;
}

export interface DuckResult {
  loadGw: number[];
  pvGw: number[];
  /** Net load without storage, GW. */
  netGw: number[];
  /** Net load after BESS / demand response (what the dispatcher sees), GW. */
  netShapedGw: number[];
  /** BESS power per hour (+ discharge, − charge), GW. */
  bessGw: number[];
  minGw: number;
  minHour: number;
  /** Largest 3-hour increase max_h (L(h+3) − L(h)), GW, and its start hour (of the shaped curve). */
  maxRamp3hGw: number;
  rampStartHour: number;
  /** Surplus energy Σ max(0, −L_net) of the shaped curve, GWh («Обмежити надлишок»). */
  surplusGwh: number;
}

function stats(net: readonly number[]) {
  let minGw = Infinity;
  let minHour = 0;
  net.forEach((v, h) => {
    if (v < minGw - 1e-12) {
      minGw = v;
      minHour = h;
    }
  });
  let ramp = -Infinity;
  let start = 0;
  for (let h = 0; h + 3 < net.length; h++) {
    const r = net[h + 3]! - net[h]!;
    if (r > ramp + 1e-12) {
      ramp = r;
      start = h;
    }
  }
  return { minGw, minHour, maxRamp3hGw: ramp, rampStartHour: start };
}

/**
 * Greedy BESS: charge in the hours with the lowest net load (ascending) until W_b/√η_rt has been taken, ≤ P_b per
 * hour; discharge in the hours with the highest net load with the same power, W_b·√η_rt in total.
 */
export function greedyBess(net: readonly number[], pGw: number, etaRt = 0.88): number[] {
  const out = new Array<number>(net.length).fill(0);
  if (pGw <= 0) return out;
  const w = 4 * pGw;
  const idx = net.map((_, h) => h);
  let take = w / Math.sqrt(etaRt);
  for (const h of [...idx].sort((a, b) => net[a]! - net[b]!)) {
    if (take <= 1e-12) break;
    const c = Math.min(pGw, take);
    out[h] = -c;
    take -= c;
  }
  let give = w * Math.sqrt(etaRt);
  for (const h of [...idx].sort((a, b) => net[b]! - net[a]!)) {
    if (give <= 1e-12) break;
    if (out[h]! < 0) continue;
    const d = Math.min(pGw, give);
    out[h] = d;
    give -= d;
  }
  return out;
}

export function duckCurve(p: DuckParams): DuckResult {
  const load = DUCK_LOAD_SHARE.map((s) => s * DUCK_PEAK_GW);
  const pv = DUCK_PV_PROFILE.map((x) => x * p.pvGw);
  const net = load.map((l, h) => l - pv[h]!);
  const dr = net.map((_, h) =>
    !p.demandResponse ? 0 : h === 19 || h === 20 ? -1 : h === 11 || h === 12 ? 1 : 0,
  );
  const withDr = net.map((v, h) => v + dr[h]!);
  const bess = greedyBess(withDr, p.bessGw ?? 0);
  const shaped = withDr.map((v, h) => v - bess[h]!);
  const surplusGwh = shaped.reduce((a, v) => a + Math.max(0, -v), 0);
  return {
    loadGw: load,
    pvGw: pv,
    netGw: net,
    netShapedGw: shaped,
    bessGw: bess,
    surplusGwh,
    ...stats(shaped),
  };
}
