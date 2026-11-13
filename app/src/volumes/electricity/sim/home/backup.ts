/**
 * home §З (step 12) — autonomy of backup sources: t = W·DoD·η/(P_avg + P_idle) [h]; overload if Σ P_run > P_inv or
 * max(start) + rest > P_peak. Fridge: mean 60 W, start 150·5 = 750 W; gas boiler: mean 80 W, start 100·2 = 200 W.
 * Sources (shared lab equipment, `_shared-house.md` §4): idle 50 W only for the hybrid ЛІ-6 (included in η otherwise).
 */

export type BackupSource = 'ups' | 'station1' | 'station2' | 'hybrid';

export const BACKUP_SOURCES: Readonly<Record<BackupSource, { energyKWh: number; inverterW: number; peakW: number; dod: number; eta: number; idleW: number }>> = {
  ups: { energyKWh: 0.1, inverterW: 600, peakW: 900, dod: 0.9, eta: 0.85, idleW: 0 },
  station1: { energyKWh: 1, inverterW: 1000, peakW: 2000, dod: 0.9, eta: 0.9, idleW: 0 },
  station2: { energyKWh: 2, inverterW: 2000, peakW: 4000, dod: 0.9, eta: 0.9, idleW: 0 },
  hybrid: { energyKWh: 10.24, inverterW: 6000, peakW: 12000, dod: 0.9, eta: 0.95, idleW: 50 },
};

export type BackupLoad = 'router' | 'lamps3' | 'laptop' | 'tv' | 'fridge' | 'gasBoiler' | 'kettle';

/** Running (nameplate) power, average power and start-up power [W]. */
export const BACKUP_LOADS: Readonly<Record<BackupLoad, { runW: number; avgW: number; startW: number }>> = {
  router: { runW: 20, avgW: 20, startW: 20 },
  lamps3: { runW: 24, avgW: 24, startW: 24 },
  laptop: { runW: 65, avgW: 65, startW: 65 },
  tv: { runW: 100, avgW: 100, startW: 100 },
  fridge: { runW: 150, avgW: 60, startW: 750 },
  gasBoiler: { runW: 100, avgW: 80, startW: 200 },
  kettle: { runW: 2000, avgW: 2000, startW: 2000 },
};

export interface AutonomyResult {
  averageW: number;
  runningW: number;
  /** Worst start: max(start) + the running power of the others. */
  startW: number;
  overload: boolean;
  overloadReason: 'continuous' | 'start' | null;
  /** Autonomy [h] (Infinity with no load). */
  hours: number;
}

export function autonomy(source: BackupSource, loads: readonly BackupLoad[]): AutonomyResult {
  const s = BACKUP_SOURCES[source];
  const L = loads.map((l) => BACKUP_LOADS[l]);
  const avg = L.reduce((a, l) => a + l.avgW, 0);
  const run = L.reduce((a, l) => a + l.runW, 0);
  const start = L.reduce((best, l) => Math.max(best, l.startW - l.runW), 0) + run;
  const continuous = run > s.inverterW;
  const peak = start > s.peakW;
  const denom = avg + s.idleW;
  return {
    averageW: avg,
    runningW: run,
    startW: start,
    overload: continuous || peak,
    overloadReason: continuous ? 'continuous' : peak ? 'start' : null,
    hours: denom > 0 ? (s.energyKWh * 1000 * s.dod * s.eta) / denom : Infinity,
  };
}
