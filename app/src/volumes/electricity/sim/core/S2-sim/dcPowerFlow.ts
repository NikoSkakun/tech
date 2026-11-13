/**
 * DC power flow for small networks (grid.md §Д): lossless, flat voltage, P_ij = (θ_i − θ_j)/X_ij.
 * For every connected island: build B (b = 1/X), drop the reference bus (lowest index), solve B'·θ = P'.
 * Island rules (§Д.2): an island without generators is de-energised (its loads are lost); an island with generators
 * scales the generators in proportion to their current output to cover the island load, or — if the load exceeds
 * Σ P_max — runs them at P_max and scales the loads down (UFLS).
 * Cascade (§Д.3): while some line is loaded above the threshold, the most loaded line trips after 1 s (> 150 %) or
 * 5 s (100…150 %) of simulated time, then the flows are recomputed.
 */
import { solveLinear } from './math';

export interface DcBus {
  id: string;
  /** Scheduled injection [MW]: generation > 0, load < 0. Injections of the whole network should balance. */
  injectionMW: number;
  /** Present for generator buses. */
  pMaxMW?: number;
}

export interface DcLine {
  id: string;
  from: string;
  to: string;
  /** Series reactance [p.u.] (any consistent unit; flows come out in MW). */
  reactance: number;
  ratingMW: number;
  inService: boolean;
}

export interface DcIsland {
  buses: string[];
  energized: boolean;
  /** Island load before shedding [MW] (positive). */
  loadMW: number;
  /** Load actually supplied [MW]. */
  servedMW: number;
  /** Generator scaling factor applied (1 = unchanged). */
  generationScale: number;
  /** Load scaling factor applied (< 1 → load shedding). */
  loadScale: number;
}

export interface DcFlowResult {
  /** Flow [MW] per line id, positive from `from` to `to`; 0 for lines out of service. */
  flowsMW: Record<string, number>;
  /** |flow|/rating [%] per line id (0 for lines out of service). */
  loadingPct: Record<string, number>;
  /** Final injection per bus after island rules [MW]. */
  injectionMW: Record<string, number>;
  /** Bus angle [rad if X in p.u. and P in p.u.; here MW·X units] per bus (0 for the reference of each island). */
  angle: Record<string, number>;
  islands: DcIsland[];
  /** Load lost: de-energised islands + shed [MW]. */
  unservedMW: number;
  /** Buses without supply. */
  deadBuses: string[];
}

function islandsOf(buses: readonly DcBus[], lines: readonly DcLine[]): string[][] {
  const adj = new Map<string, string[]>(buses.map((b) => [b.id, []]));
  for (const l of lines) {
    if (!l.inService) continue;
    adj.get(l.from)?.push(l.to);
    adj.get(l.to)?.push(l.from);
  }
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const b of buses) {
    if (seen.has(b.id)) continue;
    const comp: string[] = [];
    const queue = [b.id];
    seen.add(b.id);
    while (queue.length > 0) {
      const v = queue.shift()!;
      comp.push(v);
      for (const w of adj.get(v) ?? []) {
        if (!seen.has(w)) {
          seen.add(w);
          queue.push(w);
        }
      }
    }
    // keep the bus order of the input (reference = lowest index)
    const order = new Map(buses.map((x, i) => [x.id, i]));
    comp.sort((a, c) => order.get(a)! - order.get(c)!);
    out.push(comp);
  }
  return out;
}

export function solveDcPowerFlow(buses: readonly DcBus[], lines: readonly DcLine[]): DcFlowResult {
  const byId = new Map(buses.map((b) => [b.id, b]));
  const injection: Record<string, number> = {};
  const angle: Record<string, number> = {};
  const islands: DcIsland[] = [];
  const dead: string[] = [];
  let unserved = 0;

  for (const comp of islandsOf(buses, lines)) {
    const gens = comp.filter((id) => byId.get(id)!.pMaxMW !== undefined);
    const loadMW = comp.reduce((s, id) => s + Math.max(0, -byId.get(id)!.injectionMW), 0);
    if (gens.length === 0) {
      for (const id of comp) {
        injection[id] = 0;
        angle[id] = 0;
      }
      dead.push(...comp);
      unserved += loadMW;
      islands.push({ buses: comp, energized: false, loadMW, servedMW: 0, generationScale: 0, loadScale: 0 });
      continue;
    }
    const genNow = gens.reduce((s, id) => s + Math.max(0, byId.get(id)!.injectionMW), 0);
    const pMax = gens.reduce((s, id) => s + byId.get(id)!.pMaxMW!, 0);
    let gScale: number;
    let lScale = 1;
    const genOut = new Map<string, number>();
    if (loadMW <= pMax + 1e-9) {
      if (genNow > 0) {
        gScale = loadMW / genNow;
        for (const id of gens) genOut.set(id, Math.max(0, byId.get(id)!.injectionMW) * gScale);
      } else {
        // no current output: share by P_max
        for (const id of gens) genOut.set(id, (byId.get(id)!.pMaxMW! / pMax) * loadMW);
        gScale = Number.NaN;
      }
    } else {
      lScale = pMax / loadMW;
      for (const id of gens) genOut.set(id, byId.get(id)!.pMaxMW!);
      gScale = genNow > 0 ? pMax / genNow : Number.NaN;
      unserved += loadMW - pMax;
    }
    for (const id of comp) {
      const b = byId.get(id)!;
      injection[id] = genOut.has(id) ? genOut.get(id)! : Math.min(0, b.injectionMW) * lScale;
    }
    islands.push({
      buses: comp,
      energized: true,
      loadMW,
      servedMW: loadMW * lScale,
      generationScale: gScale,
      loadScale: lScale,
    });

    // B'·θ = P' with the first bus of the island as reference
    const ref = comp[0]!;
    angle[ref] = 0;
    const others = comp.slice(1);
    if (others.length === 0) continue;
    const idx = new Map(others.map((id, i) => [id, i]));
    const n = others.length;
    const B = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const l of lines) {
      if (!l.inService || !comp.includes(l.from)) continue;
      const b = 1 / l.reactance;
      const i = idx.get(l.from);
      const j = idx.get(l.to);
      if (i !== undefined) B[i]![i]! += b;
      if (j !== undefined) B[j]![j]! += b;
      if (i !== undefined && j !== undefined) {
        B[i]![j]! -= b;
        B[j]![i]! -= b;
      }
    }
    const theta = solveLinear(
      B,
      others.map((id) => injection[id]!),
    );
    others.forEach((id, i) => (angle[id] = theta[i]!));
  }

  const flowsMW: Record<string, number> = {};
  const loadingPct: Record<string, number> = {};
  for (const l of lines) {
    if (!l.inService) {
      flowsMW[l.id] = 0;
      loadingPct[l.id] = 0;
      continue;
    }
    const f = (angle[l.from]! - angle[l.to]!) / l.reactance;
    flowsMW[l.id] = f;
    loadingPct[l.id] = (Math.abs(f) / l.ratingMW) * 100;
  }
  return { flowsMW, loadingPct, injectionMW: injection, angle, islands, unservedMW: unserved, deadBuses: dead };
}

export interface CascadeOptions {
  /** Trip threshold [%] (100,5 in the code of §Д.3 so that exactly 100 % does not trip on round-off). */
  overloadThresholdPct: number;
  /** Above this loading [%] the protection is fast. */
  fastAbovePct: number;
  fastDelayS: number;
  slowDelayS: number;
  maxTrips: number;
}

export const DEFAULT_CASCADE: CascadeOptions = {
  overloadThresholdPct: 100.5,
  fastAbovePct: 150,
  fastDelayS: 1,
  slowDelayS: 5,
  maxTrips: 50,
};

export interface CascadeStep {
  /** Simulated time of the trip [s]. */
  timeS: number;
  lineId: string;
  /** Loading of the tripped line just before the trip [%]. */
  loadingPct: number;
  /** Network state after the trip. */
  after: DcFlowResult;
}

export interface CascadeResult {
  initial: DcFlowResult;
  steps: CascadeStep[];
  final: DcFlowResult;
  /** Line service states at the end. */
  lines: DcLine[];
}

/** Most loaded line above the threshold, or null. */
export function mostOverloaded(r: DcFlowResult, threshold: number): { id: string; pct: number } | null {
  let best: { id: string; pct: number } | null = null;
  for (const [id, pct] of Object.entries(r.loadingPct)) {
    if (pct > threshold && (best === null || pct > best.pct)) best = { id, pct };
  }
  return best;
}

export function runCascade(
  buses: readonly DcBus[],
  linesIn: readonly DcLine[],
  options: Partial<CascadeOptions> = {},
): CascadeResult {
  const o = { ...DEFAULT_CASCADE, ...options };
  const lines = linesIn.map((l) => ({ ...l }));
  const initial = solveDcPowerFlow(buses, lines);
  let current = initial;
  let t = 0;
  const steps: CascadeStep[] = [];
  for (let k = 0; k < o.maxTrips; k++) {
    const worst = mostOverloaded(current, o.overloadThresholdPct);
    if (worst === null) break;
    t += worst.pct > o.fastAbovePct ? o.fastDelayS : o.slowDelayS;
    lines.find((l) => l.id === worst.id)!.inService = false;
    current = solveDcPowerFlow(buses, lines);
    steps.push({ timeS: t, lineId: worst.id, loadingPct: worst.pct, after: current });
  }
  return { initial, steps, final: current, lines };
}

export interface ContingencyRow {
  outageId: string;
  /** Most loaded remaining line and its loading [%]. */
  worstLineId: string | null;
  worstLoadingPct: number;
  unservedMW: number;
}

/** N-1 analysis (§Д.4): each in-service line out alone. */
export function contingencyAnalysis(buses: readonly DcBus[], lines: readonly DcLine[]): ContingencyRow[] {
  return lines
    .filter((l) => l.inService)
    .map((out) => {
      const r = solveDcPowerFlow(
        buses,
        lines.map((l) => (l.id === out.id ? { ...l, inService: false } : l)),
      );
      let worstId: string | null = null;
      let worst = 0;
      for (const [id, pct] of Object.entries(r.loadingPct)) {
        if (pct > worst) {
          worst = pct;
          worstId = id;
        }
      }
      return { outageId: out.id, worstLineId: worstId, worstLoadingPct: worst, unservedMW: r.unservedMW };
    });
}
