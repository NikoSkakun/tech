/**
 * Live state shared by the world systems and the steps. Steps write *targets* every frame in their `update`;
 * `scene.ts` resets the targets to their defaults first and eases the world toward them afterwards, so every
 * step is random-access safe without "undo" code.
 */
export interface Live {
  /** Generator output 0…1 of rated: brightness of the yellow pulses on the outgoing line (eased). */
  power: number;
  powerTarget: number;
  /** Plumes and spray-pond fountains 0…1 (eased; 0 = unit stopped). */
  cooling: number;
  coolingTarget: number;
  /** Turbine hall with its roof and front wall off (step 7). */
  hallOpen: boolean;
}

export function createLive(): Live {
  return { power: 0.9, powerTarget: 0.9, cooling: 1, coolingTarget: 1, hallOpen: false };
}

/** Defaults a step gets unless its `update` says otherwise (called by the scene every frame). */
export function resetTargets(live: Live): void {
  live.powerTarget = 0.9;
  live.coolingTarget = 1;
  live.hallOpen = false;
}
