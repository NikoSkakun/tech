/**
 * A run of the k_eff sandbox (step 3, model M2) turned into individual neutron flights for the picture. The
 * population per generation comes from the simulation library: the sum of `n0` independent chains of
 * `neutronGenerations(k, G, seed)` (each neutron causes a fission with p = min(1, k/ν̄), ν ∈ {2, 3}). This file
 * only distributes the shown neutrons of a generation over fates — fission (on a nearby nucleus), absorption
 * (water, rods) or leakage (out of the cube) — so that the next generation has the counted number of
 * neutrons. Up to `CAP` neutrons are drawn individually; beyond that the picture shows a «density» glow.
 * Pure TypeScript (no three.js); positions are flat arrays of nucleus centres.
 */
import { Rng } from '@/engine/api';
import { NON_LEAKAGE, kEff, neutronGenerations, type CoreSize } from '@electricity/sim/plant-nuclear';

export const CAP = 600;
export const MAX_GENERATIONS = 30;
const NU = 2.43;

export interface SandboxParams {
  enrichment: number;
  moderator: boolean;
  /** Rods inserted 0…1. */
  rods: number;
  size: CoreSize;
}

export type Fate = 'fission' | 'absorbed' | 'leaked';
export interface Flight {
  from: number;
  /** Target nucleus (fission) or −1. */
  to: number;
  fate: Fate;
  /** Direction for absorbed / leaked flights (unit vector). */
  dir: [number, number, number];
}

export interface SandboxRun {
  readonly k: number;
  /** Neutrons per generation (true counts, from the model). */
  readonly counts: readonly number[];
  /** The generation now flying (index into counts). */
  readonly g: number;
  /** Flights of the current generation (≤ CAP). */
  readonly flights: readonly Flight[];
  /** Advance to the next generation; false when the chain died out or the run ended. */
  next(): boolean;
}

export function sandboxK(p: SandboxParams): number {
  return kEff(p.enrichment, p.moderator, p.rods, p.size);
}

/**
 * Start a run: `n0` neutrons born at random visible nuclei (`visible` = their indices). `near(i)` lists the
 * visible nuclei close to nucleus i (targets of the next fission).
 */
export function startRun(p: SandboxParams, n0: number, visible: readonly number[], near: (i: number) => readonly number[], seed: number): SandboxRun {
  const k = sandboxK(p);
  const counts = new Array<number>(MAX_GENERATIONS + 1).fill(0);
  for (let s = 0; s < n0; s++) neutronGenerations(k, MAX_GENERATIONS, seed + s * 7919, CAP).forEach((c, g) => (counts[g] = counts[g]! + c));
  const rng = new Rng(seed);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng.next() * a.length)]!;
  const dir = (): [number, number, number] => {
    const [x, y, z] = rng.onSphere();
    return [x, y, z];
  };
  const pf = Math.min(1, k / NU);
  const leakShare = pf >= 1 ? 0 : Math.min(1, (1 - NON_LEAKAGE[p.size]) / (1 - pf));
  const shown = (g: number): number => Math.min(CAP, counts[g] ?? 0);
  let g = 0;
  let sources: number[] = Array.from({ length: shown(0) }, () => pick(visible));
  let flights: Flight[] = [];
  const plan = (): void => {
    const n = sources.length;
    const nextN = shown(g + 1);
    const f = Math.min(n, Math.round(nextN / NU));
    flights = sources.map((from, i) => {
      if (i < f) return { from, to: pick(near(from)), fate: 'fission' as Fate, dir: [0, 1, 0] as [number, number, number] };
      return { from, to: -1, fate: rng.next() < leakShare ? 'leaked' : 'absorbed', dir: dir() };
    });
    // shuffle so the fates are not ordered on screen
    for (let i = flights.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [flights[i], flights[j]] = [flights[j]!, flights[i]!];
    }
  };
  plan();
  return {
    k,
    counts,
    get g() {
      return g;
    },
    get flights() {
      return flights;
    },
    next() {
      const born: number[] = [];
      const fissions = flights.filter((x) => x.fate === 'fission');
      const want = shown(g + 1);
      fissions.forEach((x, i) => {
        const nu = Math.round(want / Math.max(1, fissions.length) + (i % 2 ? 0.4 : -0.4));
        for (let c = 0; c < nu && born.length < want; c++) born.push(x.to);
      });
      while (born.length < want && fissions.length) born.push(pick(fissions).to);
      g++;
      sources = born;
      if (g >= MAX_GENERATIONS || sources.length === 0) {
        flights = [];
        return false;
      }
      plan();
      return true;
    },
  };
}
