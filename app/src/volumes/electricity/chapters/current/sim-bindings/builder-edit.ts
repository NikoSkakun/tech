/**
 * Editing glue of the circuit constructor (step 7) around `@electricity/sim/current` — no three.js here.
 * Parts lie on the 6×4 node grid between two nodes of one row or one column; the physics (modified nodal
 * analysis, lamp burn-out, short-circuit trip) is entirely `solveBuilder`'s.
 */
import { BUILDER, gridNode, type BuilderSolution, type Part, type PartKind } from '@electricity/sim/current';

export type NodeXY = readonly [c: number, r: number];
export const nodeXY = (id: string): NodeXY => {
  const [c, r] = id.split(',').map(Number);
  return [c ?? 0, r ?? 0];
};

/** Unit grid cells a part covers, as keys `c,r|c,r` of consecutive node pairs. */
function cells(a: string, b: string): string[] {
  const [ca, ra] = nodeXY(a);
  const [cb, rb] = nodeXY(b);
  const out: string[] = [];
  if (ra === rb)
    for (let c = Math.min(ca, cb); c < Math.max(ca, cb); c++) out.push(`${c},${ra}|${c + 1},${ra}`);
  else if (ca === cb)
    for (let r = Math.min(ra, rb); r < Math.max(ra, rb); r++) out.push(`${ca},${r}|${ca},${r + 1}`);
  return out;
}

/** Why a part cannot go between `a` and `b`, or null when it can. */
export function placementError(
  parts: readonly Part[],
  a: string,
  b: string,
): 'same' | 'diagonal' | 'occupied' | null {
  if (a === b) return 'same';
  const want = cells(a, b);
  if (want.length === 0) return 'diagonal';
  const taken = new Set(parts.flatMap((p) => cells(p.a, p.b)));
  return want.some((c) => taken.has(c)) ? 'occupied' : null;
}

const PREFIX: Record<PartKind, string> = {
  source: 'V',
  resistor: 'R',
  lamp: 'L',
  switch: 'S',
  wire: 'W',
  ammeter: 'A',
};

/** A new part of `kind` from `a` to `b` (for sources `a` is «+») with the kind's default parameter. */
export function addPart(parts: readonly Part[], kind: PartKind, a: string, b: string): Part[] {
  let n = 1;
  while (parts.some((p) => p.id === `${PREFIX[kind]}${n}`)) n++;
  const part: Part = { id: `${PREFIX[kind]}${n}`, kind, a, b };
  if (kind === 'source') part.emfV = BUILDER.emfRangeV.default;
  if (kind === 'resistor') part.resistanceOhm = 10;
  if (kind === 'switch') part.closed = true;
  return [...parts, part];
}

export const removePart = (parts: readonly Part[], id: string): Part[] => parts.filter((p) => p.id !== id);
export const patchPart = (parts: readonly Part[], id: string, patch: Partial<Part>): Part[] =>
  parts.map((p) => (p.id === id ? { ...p, ...patch } : p));

/** True if current can pass through the part at all (a burnt lamp, an open switch, a tripped source cannot). */
const conducts = (p: Part): boolean =>
  !(p.kind === 'lamp' && p.burnt) && !(p.kind === 'switch' && p.closed === false);

/**
 * Closed loops for «Обійти контур»: every simple path from the first source's «+» back to its «−» through
 * conducting parts, as node lists that start at «−», cross the source, and return (≤ `limit` loops).
 */
export function loopsThroughSource(parts: readonly Part[], limit = 6): string[][] {
  const source = parts.find((p) => p.kind === 'source');
  if (!source) return [];
  const edges = parts.filter((p) => p !== source && conducts(p));
  const loops: string[][] = [];
  const walk = (node: string, path: string[], used: Set<string>): void => {
    if (loops.length >= limit) return;
    if (node === source.b) {
      loops.push([source.b, ...path]);
      return;
    }
    for (const e of edges) {
      if (used.has(e.id) || (e.a !== node && e.b !== node)) continue;
      const next = e.a === node ? e.b : e.a;
      if (next !== source.b && path.includes(next)) continue;
      used.add(e.id);
      walk(next, [...path, next], used);
      used.delete(e.id);
    }
  };
  walk(source.a, [source.a], new Set());
  // each loop ends with the «−» node it started from: drop the duplicate
  return loops.map((l) => l.slice(0, -1));
}

/** Current through a part in its a → b direction (a source delivers out of «+» = `a`, so inside it runs b → a). */
export const flowAB = (part: Part, s: BuilderSolution): number => {
  const i = s.parts.get(part.id)?.currentA ?? 0;
  return part.kind === 'source' ? -i : i;
};

/** Signed currents into a node from each part touching it (KCL: they sum to zero), largest first. */
export function nodeBalance(parts: readonly Part[], s: BuilderSolution, node: string): number[] {
  return parts
    .filter((p) => p.a === node || p.b === node)
    .map((p) => (p.b === node ? flowAB(p, s) : -flowAB(p, s)))
    .filter((i) => Math.abs(i) > 1e-6)
    .sort((x, y) => y - x);
}

/** Nodes where three or more current-carrying branches meet. */
export function junctions(parts: readonly Part[], s: BuilderSolution): string[] {
  const count = new Map<string, number>();
  for (const p of parts)
    if (Math.abs(flowAB(p, s)) > 1e-6) for (const n of [p.a, p.b]) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count].filter(([, k]) => k >= 3).map(([n]) => n);
}

export const ALL_NODES: readonly string[] = Array.from({ length: BUILDER.columns * BUILDER.rows }, (_, k) =>
  gridNode(k % BUILDER.columns, Math.floor(k / BUILDER.columns)),
);
