/**
 * Live state shared by the world systems and the steps. Steps write *targets* (what the wind should be, how
 * the hero is controlled); `scene.ts` eases the world toward them every frame, so any step can be entered
 * from any other and the world simply glides to its state. Targets are reset to their defaults before the
 * current step's `update` runs: a step that does not mention the wind gets the default wind back.
 */
import { WIND } from './layout';

export interface Live {
  /** Free-stream wind speed the diorama shows, m/s (eased). */
  wind: number;
  windTarget: number;
  /** Direction the wind comes from, degrees (eased along the shortest arc). */
  windFrom: number;
  windFromTarget: number;
  /** Hero turbine: rotor speed (rpm), blade pitch (degrees) and electrical output (0…1 of rated). */
  heroRpm: number;
  heroPitch: number;
  heroPower: number;
  /** Size factor of the hero rotor (step 2) and of its tower (step 9), eased toward the targets. */
  rotorScale: number;
  rotorScaleTarget: number;
  towerScale: number;
  towerScaleTarget: number;
  /** Hero nacelle cover: 0 closed … 1 petals open. */
  cover: number;
  coverTarget: number;
  /** Extra transparency of the sea block on top of the step's base (step 10 depth views), 0…1. */
  seaBoost: number;
  seaBoostTarget: number;
  /** When false the hero follows the steady-state power curve for `wind`; a step may drive it itself. */
  heroManual: boolean;
  /** Total output of the onshore farm, 0…1 of installed power: brightness of the collector and line pulses. */
  farmPower: number;
  /** 0 day … 1 night: aviation lights, lit windows (eased toward `nightTarget`). */
  night: number;
  nightTarget: number;
}

export function createLive(): Live {
  return {
    wind: WIND.speed,
    windTarget: WIND.speed,
    windFrom: WIND.fromDeg,
    windFromTarget: WIND.fromDeg,
    heroRpm: 0,
    heroPitch: 0,
    heroPower: 0,
    rotorScale: 1,
    rotorScaleTarget: 1,
    towerScale: 1,
    towerScaleTarget: 1,
    cover: 0,
    coverTarget: 0,
    seaBoost: 0,
    seaBoostTarget: 0,
    heroManual: false,
    farmPower: 0.5,
    night: 0,
    nightTarget: 0,
  };
}

/** Ease an angle in degrees toward a target along the shortest arc. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const d = ((((target - current) % 360) + 540) % 360) - 180;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/** Defaults a step gets unless its `update` says otherwise (called by the scene every frame). */
export function resetTargets(live: Live): void {
  live.windTarget = WIND.speed;
  live.windFromTarget = WIND.fromDeg;
  live.nightTarget = 0;
  live.heroManual = false;
  live.rotorScaleTarget = 1;
  live.towerScaleTarget = 1;
  live.coverTarget = 0;
  live.seaBoostTarget = 0;
}
