/**
 * Live state shared by the world systems and the steps. Steps write *targets*; `scene.ts` eases the world toward
 * them every frame. Targets are reset to their defaults before the current step's `update` runs, so a step that
 * does not mention, say, the unit load gets the default back — every step is random-access safe without "undo".
 */

export interface Live {
  /** Lit windows / lamps 0 (day) … 1 (night), eased. */
  night: number;
  nightTarget: number;
  /** Unit load 0…1 (belts, flame, steam flow, yellow pulses), eased. */
  load: number;
  loadTarget: number;
  /** Dark smoke share over the stack 0 (clean, white vapour) … 1 (uncleaned), eased. */
  smoke: number;
  smokeTarget: number;
  /** White vapour over the stack 0…1 (after a wet scrubber it is dense), eased. */
  vapour: number;
  vapourTarget: number;
  /** Plume strength of the cooling towers 0…1 (step 10: heat goes to the city instead), eased. */
  towerPlume: number;
  towerPlumeTarget: number;
}

/** Defaults of the dusk scene of the document. */
const DEFAULTS = { night: 0.75, load: 1, smoke: 0, vapour: 0.5, towerPlume: 1 } as const;

export function createLive(): Live {
  return {
    night: DEFAULTS.night,
    nightTarget: DEFAULTS.night,
    load: DEFAULTS.load,
    loadTarget: DEFAULTS.load,
    smoke: DEFAULTS.smoke,
    smokeTarget: DEFAULTS.smoke,
    vapour: DEFAULTS.vapour,
    vapourTarget: DEFAULTS.vapour,
    towerPlume: DEFAULTS.towerPlume,
    towerPlumeTarget: DEFAULTS.towerPlume,
  };
}

export function resetTargets(live: Live): void {
  live.nightTarget = DEFAULTS.night;
  live.loadTarget = DEFAULTS.load;
  live.smokeTarget = DEFAULTS.smoke;
  live.vapourTarget = DEFAULTS.vapour;
  live.towerPlumeTarget = DEFAULTS.towerPlume;
}
