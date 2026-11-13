/**
 * DC circuit solver by modified nodal analysis (MNA), `current` «Модель симуляції» §7:
 * `[G B; C D]·[φ; I_V] = [i; e]`, reference node = «−» of the first source of each connected part,
 * parts without any source are reported as floating (potential `null`, shown grey), Gaussian elimination with
 * partial pivoting, singular systems (parallel ideal sources with different EMF, …) are flagged.
 *
 * Non-linear lamps (`resistanceOhm` given as a function of the lamp voltage) are handled by damped
 * fixed-point iteration on R(U). Fuses / breakers are plain low-resistance elements here; their time-current
 * behaviour lives in `protection.ts` and the caller sets `blown` / `open` before re-solving.
 */
import { solveLinear } from './linalg';

export type NodeId = string;

/** Resistance used for "ideal" conductors (wire, closed switch, ammeter, fuse) — `current` §7: 10⁻⁶ Ω. */
export const IDEAL_CONDUCTOR_OHM = 1e-6;

interface TwoTerminal {
  /** Unique element id (used as key in the solution). */
  id: string;
  a: NodeId;
  b: NodeId;
}

export interface ResistorElement extends TwoTerminal {
  kind: 'resistor';
  resistanceOhm: number;
}
export interface WireElement extends TwoTerminal {
  kind: 'wire';
}
export interface SwitchElement extends TwoTerminal {
  kind: 'switch';
  closed: boolean;
}
export interface AmmeterElement extends TwoTerminal {
  kind: 'ammeter';
  /** Default {@link IDEAL_CONDUCTOR_OHM}. */
  resistanceOhm?: number;
}
export interface FuseElement extends TwoTerminal {
  kind: 'fuse';
  blown?: boolean;
  /** Default {@link IDEAL_CONDUCTOR_OHM}. */
  resistanceOhm?: number;
}
export interface LampElement extends TwoTerminal {
  kind: 'lamp';
  /** Constant resistance, or R(|U|) for a non-linear filament. */
  resistanceOhm: number | ((voltageV: number) => number);
  /** A burnt lamp is an open circuit. */
  burnt?: boolean;
}
export interface VoltageSourceElement {
  kind: 'source';
  id: string;
  plus: NodeId;
  minus: NodeId;
  emfV: number;
  /** Internal resistance r (in series), Ω. Default 0 (ideal). */
  internalResistanceOhm?: number;
  /** Disabled sources are removed (e.g. after a short-circuit trip). Default true. */
  enabled?: boolean;
}
export interface CurrentSourceElement {
  kind: 'currentSource';
  id: string;
  /** Current `currentA` is drawn out of `from` and pushed into `to` through the external circuit. */
  from: NodeId;
  to: NodeId;
  currentA: number;
}

export type CircuitElement =
  | ResistorElement
  | WireElement
  | SwitchElement
  | AmmeterElement
  | FuseElement
  | LampElement
  | VoltageSourceElement
  | CurrentSourceElement;

export interface ElementResult {
  /**
   * Current, A. Two-terminal elements: from `a` to `b` through the element. Voltage source: current leaving
   * the «+» terminal into the external circuit (positive = delivering). Current source: `currentA`.
   */
  currentA: number;
  /** φ_a − φ_b (two-terminal), φ_plus − φ_minus (voltage source, terminal voltage), φ_to − φ_from. */
  voltageV: number;
  /** Dissipated power (passive, incl. a source's internal r) or delivered power (sources), W. */
  powerW: number;
  /** Resistance used in the final solve (lamps: R at the solved voltage), Ω; NaN for sources. */
  resistanceOhm: number;
  /** false for open switches, burnt lamps, blown fuses, disabled sources and floating parts. */
  conducting: boolean;
}

export interface CircuitSolution {
  /** Node potentials, V; `null` for nodes of a part that contains no source (undefined potential). */
  potentials: Map<NodeId, number | null>;
  elements: Map<string, ElementResult>;
  /** Index of the connected part every node belongs to. */
  componentOf: Map<NodeId, number>;
  /** True if any part's MNA matrix was singular (e.g. two ideal sources of different EMF in parallel). */
  singular: boolean;
  /** Largest |Σ I| over all nodes of solved parts (KCL check), A. */
  maxKclResidualA: number;
  /** Fixed-point iterations used for non-linear lamps (1 when everything is linear). */
  iterations: number;
}

function isActive(e: CircuitElement): boolean {
  switch (e.kind) {
    case 'switch':
      return e.closed;
    case 'lamp':
      return !e.burnt;
    case 'fuse':
      return !e.blown;
    case 'source':
      return e.enabled !== false;
    default:
      return true;
  }
}

function fixedResistance(e: CircuitElement): number {
  switch (e.kind) {
    case 'resistor':
      return Math.max(e.resistanceOhm, IDEAL_CONDUCTOR_OHM);
    case 'wire':
    case 'switch':
      return IDEAL_CONDUCTOR_OHM;
    case 'ammeter':
    case 'fuse':
      return Math.max(e.resistanceOhm ?? IDEAL_CONDUCTOR_OHM, IDEAL_CONDUCTOR_OHM);
    default:
      return NaN;
  }
}

const internalNode = (id: string): NodeId => `${id}#internal`;

/** Two-terminal "branches" seen by the matrix (sources with r > 0 are split into r + ideal source). */
interface Branch {
  id: string;
  a: NodeId;
  b: NodeId;
  resistanceOhm: number;
}

/** Solve a DC circuit. Element order matters only for choosing reference nodes (first source wins). */
export function solveDc(elements: readonly CircuitElement[], options: { maxIterations?: number } = {}): CircuitSolution {
  const maxIterations = options.maxIterations ?? 80;
  const lamps = elements.filter((e): e is LampElement => e.kind === 'lamp' && !e.burnt);
  const nonlinear = lamps.filter((l) => typeof l.resistanceOhm === 'function');
  const lampR = new Map<string, number>();
  for (const l of lamps) {
    lampR.set(l.id, typeof l.resistanceOhm === 'function' ? l.resistanceOhm(0) : l.resistanceOhm);
  }
  let solution = solveLinearCircuit(elements, lampR);
  let iterations = 1;
  if (nonlinear.length > 0) {
    for (; iterations < maxIterations; iterations++) {
      let maxRel = 0;
      for (const l of nonlinear) {
        const u = Math.abs(solution.elements.get(l.id)?.voltageV ?? 0);
        const target = (l.resistanceOhm as (v: number) => number)(u);
        const old = lampR.get(l.id)!;
        // Damped update: plain substitution oscillates for steep R(U) curves.
        const next = 0.5 * old + 0.5 * target;
        maxRel = Math.max(maxRel, Math.abs(target - old) / Math.max(old, 1e-12));
        lampR.set(l.id, next);
      }
      if (maxRel < 1e-10) break;
      solution = solveLinearCircuit(elements, lampR);
    }
  }
  solution.iterations = iterations;
  return solution;
}

function solveLinearCircuit(elements: readonly CircuitElement[], lampR: Map<string, number>): CircuitSolution {
  // ---- collect nodes and branches
  const nodes: NodeId[] = [];
  const nodeSet = new Set<NodeId>();
  const addNode = (n: NodeId): void => {
    if (!nodeSet.has(n)) {
      nodeSet.add(n);
      nodes.push(n);
    }
  };
  const branches: Branch[] = [];
  const vSources: { id: string; plus: NodeId; minus: NodeId; emfV: number }[] = [];
  const iSources: CurrentSourceElement[] = [];
  for (const e of elements) {
    if (e.kind === 'source') {
      addNode(e.plus);
      addNode(e.minus);
      if (!isActive(e)) continue;
      const r = e.internalResistanceOhm ?? 0;
      if (r > 0) {
        const mid = internalNode(e.id);
        addNode(mid);
        branches.push({ id: `${e.id}#r`, a: e.plus, b: mid, resistanceOhm: r });
        vSources.push({ id: e.id, plus: mid, minus: e.minus, emfV: e.emfV });
      } else {
        vSources.push({ id: e.id, plus: e.plus, minus: e.minus, emfV: e.emfV });
      }
    } else if (e.kind === 'currentSource') {
      addNode(e.from);
      addNode(e.to);
      iSources.push(e);
    } else {
      addNode(e.a);
      addNode(e.b);
      if (!isActive(e)) continue;
      const r = e.kind === 'lamp' ? Math.max(lampR.get(e.id) ?? NaN, IDEAL_CONDUCTOR_OHM) : fixedResistance(e);
      branches.push({ id: e.id, a: e.a, b: e.b, resistanceOhm: r });
    }
  }

  // ---- connected parts (union-find over conducting branches and sources)
  const parent = new Map<NodeId, NodeId>(nodes.map((n) => [n, n]));
  const find = (n: NodeId): NodeId => {
    let r = n;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = n;
    while (parent.get(c) !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const union = (x: NodeId, y: NodeId): void => {
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };
  for (const br of branches) union(br.a, br.b);
  for (const v of vSources) union(v.plus, v.minus);
  for (const s of iSources) union(s.from, s.to);

  const rootIndex = new Map<NodeId, number>();
  const componentOf = new Map<NodeId, number>();
  for (const n of nodes) {
    const r = find(n);
    if (!rootIndex.has(r)) rootIndex.set(r, rootIndex.size);
    componentOf.set(n, rootIndex.get(r)!);
  }

  const potentials = new Map<NodeId, number | null>(nodes.map((n) => [n, null]));
  const vCurrent = new Map<string, number>();
  let singular = false;

  // ---- solve each part with its own reference node
  for (let comp = 0; comp < rootIndex.size; comp++) {
    const compNodes = nodes.filter((n) => componentOf.get(n) === comp);
    const compV = vSources.filter((v) => componentOf.get(v.plus) === comp);
    const compI = iSources.filter((s) => componentOf.get(s.from) === comp);
    let reference: NodeId | undefined;
    // Reference = «−» of the first source in element order (document rule).
    for (const e of elements) {
      if (e.kind === 'source' && isActive(e) && componentOf.get(e.minus) === comp) {
        reference = e.minus;
        break;
      }
      if (e.kind === 'currentSource' && componentOf.get(e.from) === comp) {
        reference = e.from;
        break;
      }
    }
    if (reference === undefined) continue; // floating part: potentials stay null
    const unknownNodes = compNodes.filter((n) => n !== reference);
    const idx = new Map<NodeId, number>(unknownNodes.map((n, i) => [n, i]));
    const size = unknownNodes.length + compV.length;
    const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    const rhs = new Array<number>(size).fill(0);
    for (const br of branches) {
      if (componentOf.get(br.a) !== comp) continue;
      const g = 1 / br.resistanceOhm;
      const ia = idx.get(br.a);
      const ib = idx.get(br.b);
      if (ia !== undefined) A[ia][ia] += g;
      if (ib !== undefined) A[ib][ib] += g;
      if (ia !== undefined && ib !== undefined) {
        A[ia][ib] -= g;
        A[ib][ia] -= g;
      }
    }
    compV.forEach((v, k) => {
      const row = unknownNodes.length + k;
      const ip = idx.get(v.plus);
      const im = idx.get(v.minus);
      // Unknown j_k = current entering the source at «+» from the circuit (KCL rows), φ+ − φ− = ℰ.
      if (ip !== undefined) {
        A[ip][row] += 1;
        A[row][ip] += 1;
      }
      if (im !== undefined) {
        A[im][row] -= 1;
        A[row][im] -= 1;
      }
      rhs[row] = v.emfV;
    });
    for (const s of compI) {
      const it = idx.get(s.to);
      const iF = idx.get(s.from);
      if (it !== undefined) rhs[it] += s.currentA;
      if (iF !== undefined) rhs[iF] -= s.currentA;
    }
    const x = size === 0 ? [] : solveLinear(A, rhs);
    if (x === null) {
      singular = true;
      continue;
    }
    potentials.set(reference, 0);
    unknownNodes.forEach((n, i) => potentials.set(n, x[i]));
    compV.forEach((v, k) => vCurrent.set(v.id, 0 - x[unknownNodes.length + k])); // 0 − x avoids −0
  }

  // ---- element results
  const results = new Map<string, ElementResult>();
  const phi = (n: NodeId): number | null => potentials.get(n) ?? null;
  const branchById = new Map(branches.map((b) => [b.id, b]));
  for (const e of elements) {
    if (e.kind === 'source') {
      const pPlus = phi(e.plus);
      const pMinus = phi(e.minus);
      const terminal = pPlus !== null && pMinus !== null ? pPlus - pMinus : 0;
      const i = vCurrent.get(e.id);
      if (!isActive(e) || i === undefined || pPlus === null || pMinus === null) {
        results.set(e.id, { currentA: 0, voltageV: terminal, powerW: 0, resistanceOhm: NaN, conducting: false });
      } else {
        // Delivered by the EMF: ℰ·I (terminal power U·I plus internal loss I²·r).
        results.set(e.id, { currentA: i, voltageV: terminal, powerW: e.emfV * i, resistanceOhm: NaN, conducting: true });
      }
      continue;
    }
    if (e.kind === 'currentSource') {
      const pt = phi(e.to);
      const pf = phi(e.from);
      const u = pt !== null && pf !== null ? pt - pf : 0;
      results.set(e.id, { currentA: e.currentA, voltageV: u, powerW: u * e.currentA, resistanceOhm: NaN, conducting: pt !== null });
      continue;
    }
    const pa = phi(e.a);
    const pb = phi(e.b);
    const br = branchById.get(e.id);
    const u = pa !== null && pb !== null ? pa - pb : 0;
    if (!br || pa === null || pb === null) {
      results.set(e.id, { currentA: 0, voltageV: u, powerW: 0, resistanceOhm: br?.resistanceOhm ?? Infinity, conducting: false });
      continue;
    }
    const i = u / br.resistanceOhm;
    results.set(e.id, { currentA: i, voltageV: u, powerW: u * i, resistanceOhm: br.resistanceOhm, conducting: true });
  }

  // ---- KCL check on the matrix-level network: Σ currents leaving every solved node ≈ 0
  const nodeSum = new Map<NodeId, number>();
  const leave = (n: NodeId, i: number): void => {
    nodeSum.set(n, (nodeSum.get(n) ?? 0) + i);
  };
  for (const br of branches) {
    const pa = phi(br.a);
    const pb = phi(br.b);
    if (pa === null || pb === null) continue;
    const i = (pa - pb) / br.resistanceOhm;
    leave(br.a, i);
    leave(br.b, -i);
  }
  for (const v of vSources) {
    const i = vCurrent.get(v.id);
    if (i === undefined) continue;
    leave(v.plus, -i); // the source pushes i out of «+» into the node
    leave(v.minus, i);
  }
  for (const s of iSources) {
    if (phi(s.to) === null) continue;
    leave(s.to, -s.currentA);
    leave(s.from, s.currentA);
  }
  let maxKcl = 0;
  for (const [n, s] of nodeSum) if (phi(n) !== null) maxKcl = Math.max(maxKcl, Math.abs(s));

  return { potentials, elements: results, componentOf, singular, maxKclResidualA: maxKcl, iterations: 1 };
}

/** φ_a − φ_b, or `null` if either node is floating / unknown (a voltmeter reads nothing meaningful). */
export function voltageBetween(solution: CircuitSolution, a: NodeId, b: NodeId): number | null {
  const pa = solution.potentials.get(a);
  const pb = solution.potentials.get(b);
  if (pa === undefined || pb === undefined || pa === null || pb === null) return null;
  return pa - pb;
}

/**
 * Resistance between two nodes of a passive network (ohmmeter, `current` §9): all voltage sources removed
 * (open), a 1 mA test current injected. Returns `Infinity` for "OL" (no conducting path).
 */
export function resistanceBetween(elements: readonly CircuitElement[], a: NodeId, b: NodeId, testCurrentA = 1e-3): number {
  if (a === b) return 0;
  const passive: CircuitElement[] = [
    { kind: 'currentSource', id: '__ohmmeter', from: b, to: a, currentA: testCurrentA },
    ...elements.filter((e) => e.kind !== 'source' && e.kind !== 'currentSource'),
  ];
  // No conducting path → the test source sees an open circuit → singular part → potentials null → "OL".
  const u = voltageBetween(solveDc(passive), a, b);
  return u === null ? Infinity : u / testCurrentA;
}
