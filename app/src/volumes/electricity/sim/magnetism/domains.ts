/**
 * `magnetism` М2 (step `domains`) — phenomenological Preisach-like hysteresis on 40 domains (chip «спрощена
 * модель»). Domain i: initial direction φ_i, projection p_i = cos φ_i, switching threshold
 * h_c,i = 0,1 + 0,5·(i + 0,5)/40; state free (s_i = p_i) or aligned (s_i = ±1). |h| > h_c,i → aligned with sign h;
 * soft domains (h_c,i < 0,25, 30 %) return to free when |h| < 0,05; hard ones keep their state.
 * M/M_s = Σ s_i / 40. T ≥ T_C = 770 °C → random directions every frame, M = 0, cooled → free (demagnetised).
 *
 * Initial directions: the document asks for uniform random φ_i with Σ p_i ≈ 0. To make the control points
 * exact we stratify angles within each threshold group (soft i < 12, middle 12…19, hard 20…39): equally spaced
 * angles with a seeded offset and seeded shuffle → Σ p_i = 0 within every group.
 */
import { toRandomSource, type RandomSource } from '../core/S1-sim/rng';

export const DOMAINS = { count: 40, softThreshold: 0.25, releaseField: 0.05, curieC: 770, temperatureRange: { min: 20, max: 900, step: 10 } } as const;

export const domainThreshold = (i: number): number => 0.1 + (0.5 * (i + 0.5)) / DOMAINS.count;

export interface DomainState {
  /** Initial (free) direction φ_i, rad. */
  freeAngles: Float64Array;
  /** Current projection s_i on the field axis (−1…1). */
  projections: Float64Array;
  /** Displayed direction of each domain arrow, rad (aligned: 0 or π; free: φ_i; hot: random). */
  angles: Float64Array;
  aligned: Int8Array;
  /** M/M_s. */
  magnetization: number;
  /** Arrow jitter amplitude ∝ T/T_C (clamped to 1). */
  jitter: number;
  aboveCurie: boolean;
}

export interface DomainModel {
  readonly state: DomainState;
  /** Apply field h ∈ [−1, 1] and temperature (°C); call every frame. */
  update(h: number, temperatureC: number): DomainState;
  /** Back to the demagnetised state. */
  reset(): void;
}

export function createDomains(rng: RandomSource | number = 5): DomainModel {
  const r = toRandomSource(rng);
  const n = DOMAINS.count;
  const free = new Float64Array(n);
  const groups: [number, number][] = [
    [0, 12],
    [12, 20],
    [20, 40],
  ];
  for (const [a, b] of groups) {
    const m = b - a;
    const offset = r.next();
    const order = Array.from({ length: m }, (_, k) => k);
    for (let k = m - 1; k > 0; k--) {
      const j = Math.floor(r.next() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    for (let k = 0; k < m; k++) free[a + order[k]] = (2 * Math.PI * (k + offset)) / m;
  }
  const state: DomainState = {
    freeAngles: free,
    projections: new Float64Array(n),
    angles: new Float64Array(n),
    aligned: new Int8Array(n),
    magnetization: 0,
    jitter: 0,
    aboveCurie: false,
  };
  const publish = (): void => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = state.aligned[i];
      state.projections[i] = a === 0 ? Math.cos(state.angles[i]) : a;
      if (a !== 0) state.angles[i] = a > 0 ? 0 : Math.PI;
      s += state.projections[i];
    }
    state.magnetization = state.aboveCurie ? 0 : s / n;
  };
  const reset = (): void => {
    state.aligned.fill(0);
    state.angles.set(free);
    state.aboveCurie = false;
    publish();
  };
  reset();
  return {
    state,
    update(h: number, temperatureC: number): DomainState {
      state.jitter = Math.min(Math.max(temperatureC / DOMAINS.curieC, 0), 1);
      if (temperatureC >= DOMAINS.curieC) {
        state.aboveCurie = true;
        state.aligned.fill(0);
        for (let i = 0; i < n; i++) state.angles[i] = 2 * Math.PI * r.next();
        publish();
        return state;
      }
      if (state.aboveCurie) {
        // cooled down through T_C: demagnetised, all free
        state.aboveCurie = false;
        state.aligned.fill(0);
        state.angles.set(free);
      }
      const hc = Math.min(Math.max(h, -1), 1);
      for (let i = 0; i < n; i++) {
        const t = domainThreshold(i);
        if (Math.abs(hc) > t) state.aligned[i] = hc > 0 ? 1 : -1;
        else if (t < DOMAINS.softThreshold && Math.abs(hc) < DOMAINS.releaseField) {
          state.aligned[i] = 0;
          state.angles[i] = free[i];
        }
      }
      publish();
      return state;
    },
    reset,
  };
}
