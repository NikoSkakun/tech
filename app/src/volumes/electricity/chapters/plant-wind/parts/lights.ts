/**
 * Day / night switch of the whole diorama (lit windows, lamps) and the aviation lights (parts/beacons.ts).
 */
import type { KitModel } from '@/kit';
import type { Beacons } from './beacons';

export interface Lights {
  /** 0 day … 1 night: lit windows, lamps, brighter beacons. */
  night: number;
  update(t: number): void;
}

export function buildLights(models: readonly KitModel[], beacons: Beacons): Lights {
  let applied = -1;
  const lights: Lights = {
    night: 0,
    update(t) {
      if (Math.abs(lights.night - applied) > 1e-3) {
        applied = lights.night;
        for (const m of models) m.night = applied;
      }
      beacons.night = lights.night;
      beacons.update(t);
    },
  };
  return lights;
}
