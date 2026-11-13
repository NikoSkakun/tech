/**
 * Junctions for simple networks (pipes, circuits): describe edges once, then list the *routes* particles
 * take through them with a weight (share of the flow). Each route becomes one path of a `Flow`, so on a
 * shared trunk the densities add up and at a junction the stream splits in proportion to the weights —
 * particle count is conserved exactly like current at a node (Kirchhoff's current law).
 */
import type { Vector3 } from 'three';
import { concatPaths, type PathInput } from './paths';
import type { PathSpec } from './pathset';

export interface RouteSpec {
  /** Edge names in travel order; prefix a name with `-` to run that edge backwards. */
  via: readonly string[];
  /** Share of the total flow on this route (any positive scale). */
  weight: number;
  /** The route returns to its start (a circuit loop). Default false. */
  closed?: boolean;
}

export interface FlowNetwork {
  /** Pass to `createFlow({ paths })`; route `i` is path row `i`. */
  readonly paths: PathSpec[];
  /** Normalised weights (sum 1), same order as the routes. */
  readonly weights: number[];
}

function reversed(input: PathInput): Vector3[] {
  const pts = Array.isArray(input)
    ? (input as readonly Vector3[]).map((p) => p.clone())
    : (input as { getPoints(n: number): Vector3[] }).getPoints(200);
  return pts.reverse();
}

/**
 * Build flow paths for a network.
 *
 * ```ts
 * const net = flowNetwork(
 *   { trunk, left, right, back },
 *   [{ via: ['trunk', 'left', 'back'], weight: 2, closed: true },
 *    { via: ['trunk', 'right', 'back'], weight: 1, closed: true }]);
 * const flow = createFlow(ctx, { kind: 'electron', paths: net.paths, count: 300 });
 * ```
 */
export function flowNetwork(
  edges: Readonly<Record<string, PathInput>>,
  routes: readonly RouteSpec[],
): FlowNetwork {
  if (routes.length === 0) throw new Error('flowNetwork: at least one route is required');
  const total = routes.reduce((sum, r) => sum + Math.max(r.weight, 0), 0) || 1;
  const paths = routes.map((route) => {
    const parts = route.via.map((name) => {
      const back = name.startsWith('-');
      const edge = edges[back ? name.slice(1) : name];
      if (!edge) throw new Error(`flowNetwork: unknown edge '${name}'`);
      return back ? reversed(edge) : edge;
    });
    return { path: concatPaths(parts), closed: route.closed ?? false, weight: Math.max(route.weight, 0) / total };
  });
  return { paths, weights: paths.map((p) => p.weight) };
}

/**
 * Split fractions at a junction from branch conductances (parallel resistors: I_k ∝ 1 / R_k) or pipe
 * capacities. Returns weights that sum to 1.
 */
export function splitByConductance(conductances: readonly number[]): number[] {
  const total = conductances.reduce((a, b) => a + Math.max(b, 0), 0);
  return conductances.map((g) => (total > 0 ? Math.max(g, 0) / total : 1 / conductances.length));
}
