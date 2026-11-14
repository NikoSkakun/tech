/**
 * Live state shared by the world systems and the steps. Steps write *targets* every frame (what the reservoir
 * level should be, how much water the spillway passes, day / night / storm); `scene.ts` eases the world toward
 * them. Targets are reset to their defaults before the current step's `update` runs, so a step that does not
 * mention the spillway gets the calm default back — any step can be entered from any other.
 */
import { RESERVOIR } from './layout';

export interface Live {
  /** Reservoir surface, world y (eased toward `levelTarget`). */
  level: number;
  levelTarget: number;
  /** Spillway discharge 0 (gates shut) … 1 (full flood), eased: jets, foam, spray. */
  spill: number;
  spillTarget: number;
  /** Turbine discharge 0…1 of the plant's rating: churn at the draft-tube outlets, line pulses. */
  turbine: number;
  turbineTarget: number;
  /** 0 day … 1 night: lit windows, lamps (eased). */
  night: number;
  nightTarget: number;
  /** 0 calm … 1 thunderstorm: rain, darker clouds (eased). */
  storm: number;
  stormTarget: number;
  /** Rain over the western mountains only (step 2: the water cycle), 0…1. */
  mountainRain: number;
  mountainRainTarget: number;
  /** Pumped-storage unit: +1 generating, −1 pumping, 0 stopped; bowl fill 0…1 (eased). */
  psh: number;
  pshTarget: number;
  bowl: number;
  bowlTarget: number;
  /** Town windows lit 0…1 on top of `night` (step 8: the city wakes when the plant generates). */
  town: number;
  townTarget: number;
}

export const LEVEL_DEFAULT = RESERVOIR.dead + 0.85 * (RESERVOIR.npr - RESERVOIR.dead);

export function createLive(): Live {
  return {
    level: LEVEL_DEFAULT,
    levelTarget: LEVEL_DEFAULT,
    spill: 0.25,
    spillTarget: 0.25,
    turbine: 0.8,
    turbineTarget: 0.8,
    night: 0,
    nightTarget: 0,
    storm: 0,
    stormTarget: 0,
    mountainRain: 0,
    mountainRainTarget: 0,
    psh: 1,
    pshTarget: 1,
    bowl: 0.6,
    bowlTarget: 0.6,
    town: 0.3,
    townTarget: 0.3,
  };
}

/** Defaults a step gets unless its `update` says otherwise (called by the scene every frame). */
export function resetTargets(live: Live): void {
  live.levelTarget = LEVEL_DEFAULT;
  live.spillTarget = 0.25;
  live.turbineTarget = 0.8;
  live.nightTarget = 0;
  live.stormTarget = 0;
  live.mountainRainTarget = 0;
  live.pshTarget = 1;
  live.bowlTarget = 0.6;
  live.townTarget = 0.3;
}
