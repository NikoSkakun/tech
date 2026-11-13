/**
 * Day / night switch of the whole diorama and the aviation lights: red beacons on every nacelle blink once
 * per 1.5 s, in sync across the farm (document: «синхронно по всій ВЕС», so that pilots see one obstacle).
 */
import type { KGlowMaterial } from '@/style';
import type { KitModel } from '@/kit';

export interface Lights {
  /** 0 day … 1 night: lit windows, lamps, brighter beacons. */
  night: number;
  update(t: number): void;
}

export const BEACON_PERIOD_S = 1.5;

export function buildLights(models: readonly KitModel[], beacons: readonly KitModel[]): Lights {
  const glows = beacons.filter((m) => m.mats.has('glow')).map((m) => m.mats.get('glow') as KGlowMaterial);
  let applied = -1;
  const lights: Lights = {
    night: 0,
    update(t) {
      if (Math.abs(lights.night - applied) > 1e-3) {
        applied = lights.night;
        for (const m of models) m.night = applied;
      }
      // a short flash at the start of every period; dim but visible by day, bright at night
      const phase = (t % BEACON_PERIOD_S) / BEACON_PERIOD_S;
      const flash = Math.exp(-phase * 7);
      const level = 0.5 + flash * (1.6 + 2.6 * lights.night);
      for (const g of glows) g.intensity = level;
    },
  };
  return lights;
}
