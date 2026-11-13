/**
 * `current` «Модель симуляції» §7 (step `series-parallel`) — circuit constructor on a 6×4 node grid solved by
 * the shared MNA solver. Parts: source ℰ (1,5…12 V, optional r), resistor (list), lamp 12 Ω (6 V / 3 W, linear),
 * switch, wire, ammeter (10⁻⁶ Ω); voltmeters only read φ_a − φ_b. Lamps burn when P > 2·P_nom (= 6 W) and
 * become open; a source with |I| > 20 A (or in a singular part) trips: «Коротке замикання!», source off.
 * Brightness = clamp(P/3 W, 0, 1)^0,5. The solve repeats until no new lamp burns and no new source trips.
 */
import { solveDc, voltageBetween, type CircuitElement, type CircuitSolution, type NodeId } from '../core/S1-sim/mna';
import { lampBrightness } from './bench';

export const BUILDER = {
  columns: 6,
  rows: 4,
  lampOhm: 12,
  lampRatedW: 3,
  burnFactor: 2,
  shortCircuitA: 20,
  emfRangeV: { min: 1.5, max: 12, step: 0.5, default: 12 },
  /** Resistor values offered in the part menu (document: «зі списку»; our list). */
  resistorValuesOhm: [1, 2, 3, 4, 6, 8, 10, 12, 20, 50, 100] as const,
} as const;

/** Grid node id for column c (0…5), row r (0…3). */
export const gridNode = (c: number, r: number): NodeId => `${c},${r}`;

export type PartKind = 'source' | 'resistor' | 'lamp' | 'switch' | 'wire' | 'ammeter';

export interface Part {
  id: string;
  kind: PartKind;
  /** For sources `a` is «+», `b` is «−». */
  a: NodeId;
  b: NodeId;
  emfV?: number;
  internalOhm?: number;
  resistanceOhm?: number;
  closed?: boolean;
  /** Lamp burnt (persistent until «Полагодити лампи»). */
  burnt?: boolean;
  /** Source tripped by the short-circuit detector. */
  tripped?: boolean;
}

export interface PartResult {
  currentA: number;
  voltageV: number;
  powerW: number;
  /** Lamps only. */
  brightness: number;
  burnt: boolean;
  tripped: boolean;
}

export interface BuilderSolution {
  parts: Map<string, PartResult>;
  potentials: Map<NodeId, number | null>;
  /** Lamps that burnt / sources that tripped during *this* solve (for flashes and alarms). */
  newlyBurnt: string[];
  newlyTripped: string[];
  shortCircuit: boolean;
  maxKclResidualA: number;
  raw: CircuitSolution;
}

function toElement(p: Part): CircuitElement {
  switch (p.kind) {
    case 'source':
      return { kind: 'source', id: p.id, plus: p.a, minus: p.b, emfV: p.emfV ?? BUILDER.emfRangeV.default, internalResistanceOhm: p.internalOhm ?? 0, enabled: !p.tripped };
    case 'resistor':
      return { kind: 'resistor', id: p.id, a: p.a, b: p.b, resistanceOhm: p.resistanceOhm ?? 10 };
    case 'lamp':
      return { kind: 'lamp', id: p.id, a: p.a, b: p.b, resistanceOhm: BUILDER.lampOhm, burnt: p.burnt };
    case 'switch':
      return { kind: 'switch', id: p.id, a: p.a, b: p.b, closed: p.closed ?? true };
    case 'wire':
      return { kind: 'wire', id: p.id, a: p.a, b: p.b };
    case 'ammeter':
      return { kind: 'ammeter', id: p.id, a: p.a, b: p.b };
  }
}

/** Solves the constructor, applying burn-out and short-circuit trips (returns updated copies of the parts). */
export function solveBuilder(parts: readonly Part[]): { parts: Part[]; solution: BuilderSolution } {
  const work = parts.map((p) => ({ ...p }));
  const newlyBurnt: string[] = [];
  const newlyTripped: string[] = [];
  let sol = solveDc(work.map(toElement));
  for (let guard = 0; guard < work.length + 2; guard++) {
    let changed = false;
    for (const p of work) {
      if (p.kind !== 'source' || p.tripped) continue;
      const r = sol.elements.get(p.id)!;
      const comp = sol.componentOf.get(p.b);
      const singularHere = sol.singular && sol.potentials.get(p.b) === null && comp !== undefined;
      if (Math.abs(r.currentA) > BUILDER.shortCircuitA || singularHere) {
        p.tripped = true;
        newlyTripped.push(p.id);
        changed = true;
      }
    }
    if (!changed) {
      for (const p of work) {
        if (p.kind !== 'lamp' || p.burnt) continue;
        if (sol.elements.get(p.id)!.powerW > BUILDER.burnFactor * BUILDER.lampRatedW) {
          p.burnt = true;
          newlyBurnt.push(p.id);
          changed = true;
        }
      }
    }
    if (!changed) break;
    sol = solveDc(work.map(toElement));
  }
  const results = new Map<string, PartResult>();
  for (const p of work) {
    const r = sol.elements.get(p.id)!;
    results.set(p.id, {
      currentA: r.currentA,
      voltageV: r.voltageV,
      powerW: r.powerW,
      brightness: p.kind === 'lamp' && !p.burnt ? lampBrightness(r.powerW, BUILDER.lampRatedW) : 0,
      burnt: !!p.burnt,
      tripped: !!p.tripped,
    });
  }
  return {
    parts: work,
    solution: { parts: results, potentials: sol.potentials, newlyBurnt, newlyTripped, shortCircuit: newlyTripped.length > 0 || work.some((p) => p.tripped), maxKclResidualA: sol.maxKclResidualA, raw: sol },
  };
}

/** Voltmeter between two grid nodes (null if either is floating). */
export const builderVoltmeter = (s: BuilderSolution, a: NodeId, b: NodeId): number | null => voltageBetween(s.raw, a, b);

/** KVL walk «Обійти контур»: potential steps along a closed node loop; their sum is 0. */
export function kvlWalk(s: BuilderSolution, loop: readonly NodeId[]): { steps: (number | null)[]; sum: number | null } {
  const steps = loop.map((n, i) => builderVoltmeter(s, n, loop[(i + 1) % loop.length]));
  return { steps, sum: steps.some((x) => x === null) ? null : steps.reduce<number>((a, x) => a + (x as number), 0) };
}

/** «Полагодити лампи». */
export const repairLamps = (parts: readonly Part[]): Part[] => parts.map((p) => (p.kind === 'lamp' ? { ...p, burnt: false } : p));
