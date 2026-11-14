/**
 * Live state shared by the world systems and the steps. Steps write *targets* (how hard each machine runs, how
 * dark it is, where the exhaust goes); `scene.ts` eases the world toward them every frame, so any step can be
 * entered from any other and the island simply glides to its state. Targets are reset to their defaults
 * before the current step's `update` runs: a step that does not mention a machine gets its default back.
 */

export interface Live {
  /** Combined-cycle unit: gas-turbine load and steam-turbine load 0…1 (eased). */
  gt: number;
  gtTarget: number;
  st: number;
  stTarget: number;
  /** Peaker gas turbine 0…1 (its heat haze appears with it). */
  peaker: number;
  peakerTarget: number;
  /** Gas engines running, 0…8 (eased; engine i runs when `engines > i`). */
  engines: number;
  enginesTarget: number;
  /** Exhaust to the bypass stack: 0 = through the boiler … 1 = bypass (damper position, eased). */
  bypass: number;
  bypassTarget: number;
  /** 0 day … 1 night: lit windows, lamps (eased toward `nightTarget`). */
  night: number;
  nightTarget: number;
  /** Rotor speed of the shaft line on screen (rad/s, slowed down). */
  spin: number;
  spinTarget: number;
}

export const DEFAULTS = { gt: 0.85, st: 0.85, peaker: 0, engines: 3, bypass: 0, night: 0, spin: 2.2 } as const;

export function createLive(): Live {
  return {
    gt: DEFAULTS.gt,
    gtTarget: DEFAULTS.gt,
    st: DEFAULTS.st,
    stTarget: DEFAULTS.st,
    peaker: DEFAULTS.peaker,
    peakerTarget: DEFAULTS.peaker,
    engines: DEFAULTS.engines,
    enginesTarget: DEFAULTS.engines,
    bypass: DEFAULTS.bypass,
    bypassTarget: DEFAULTS.bypass,
    night: DEFAULTS.night,
    nightTarget: DEFAULTS.night,
    spin: DEFAULTS.spin,
    spinTarget: DEFAULTS.spin,
  };
}

/** Defaults a step gets unless its `update` says otherwise (called by the scene every frame). */
export function resetTargets(live: Live): void {
  live.gtTarget = DEFAULTS.gt;
  live.stTarget = DEFAULTS.st;
  live.peakerTarget = DEFAULTS.peaker;
  live.enginesTarget = DEFAULTS.engines;
  live.bypassTarget = DEFAULTS.bypass;
  live.nightTarget = DEFAULTS.night;
  live.spinTarget = DEFAULTS.spin;
}
