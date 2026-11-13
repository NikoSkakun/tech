/**
 * Aviation lights: one red beacon on every nacelle of the chapter (hero, onshore farm, offshore farm), all
 * flashing together once per 1.5 s (document: «синхронно по всій ВЕС» — pilots see one obstacle). The kit
 * turbine's own lamp is 0.2 m at a 110 m rotor and all but invisible on a toy turbine seen from 400 m, so
 * the chapter draws its own as one swarm of self-lit `pulse` orbs (`@/fx`): a lamp with a halo that blooms,
 * sized generously («не в масштабі») so the flash reads in the wide shots, by day and at night.
 */
import type { Vector3 } from 'three';
import { createOrbs, type Orbs } from '@/fx';

export const BEACON_PERIOD_S = 1.5;

export interface Beacons {
  orbs: Orbs;
  /** 0 day … 1 night. */
  night: number;
  /** Place beacon `i` (world position of the lamp); `size` scales the lamp for bigger machines. */
  set(i: number, p: Vector3, size?: number): void;
  /** Upload moved beacons (call once after a batch of `set`). */
  commit(): void;
  update(t: number): void;
}

export function buildBeacons(count: number, radius = 0.55): Beacons {
  const orbs = createOrbs({ kind: 'pulse', count, radius, color: 'red' });
  orbs.name = 'aviation-lights';
  orbs.raycast = () => undefined;
  for (let i = 0; i < count; i++) orbs.setPosition(i, 0, -1e4, 0);
  orbs.commit();
  const beacons: Beacons = {
    orbs,
    night: 0,
    set: (i, p, size = 1) => orbs.setPosition(i, p.x, p.y, p.z, size),
    commit: () => orbs.commit(),
    update(t) {
      // a short flash at the start of every period; dim but visible by day, bright at night
      const phase = (t % BEACON_PERIOD_S) / BEACON_PERIOD_S;
      const flash = Math.exp(-phase * 7);
      orbs.intensity = 0.55 + flash * (1.5 + 1.6 * beacons.night);
      orbs.glow = 0.3 + flash * (1.6 + 2.4 * beacons.night);
    },
  };
  return beacons;
}
