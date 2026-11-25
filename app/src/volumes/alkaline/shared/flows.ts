/**
 * The electrons' way outside (VISUAL.md §4.2): `cyan` sparks running along the stand's wire from the battery's minus
 * round the far side, through the lamp and the switch to the plus — the direction of `loopPath()` of `circuit`,
 * which is the electrons' way. They show only while a current flows; their speed follows the current. Drawn huge
 * and fast on purpose (the real electrons crawl: «Докладніше» of `trick/loop`). Not drawn through the battery.
 *
 * Also: the ions of the lengthwise cut of `circuit` are `sky`; this volume draws every ion `violet`, so the cut's
 * ions are recoloured here (only in this volume's stage instance).
 */
import { type Color, type Group, InstancedMesh, Vector3 } from 'three';
import { col } from '@/style';
import { BATTERY, LOOP } from '@circuit/shared/stage';
import { loopPath } from '@circuit/shared/stage/tools/frame';
import { electrons } from './micro/particles';

const SPARKS = 44;

export interface WireSparks {
  /** Current through the loop, A (0 = none); the sparks' speed and presence follow it. */
  amps: number;
  update(dt: number): void;
}

export function createWireSparks(frame: Group): WireSparks {
  const path = loopPath().filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]!) > 1e-4);
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + path[i]!.distanceTo(path[i - 1]!));
  const total = cum[cum.length - 1]!;
  const set = electrons(frame, SPARKS, 0.055);
  const at = new Vector3();
  const pointAt = (s: number): Vector3 => {
    const d = (((s % 1) + 1) % 1) * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < d) i++;
    const k = (d - cum[i - 1]!) / Math.max(cum[i]! - cum[i - 1]!, 1e-6);
    return at.copy(path[i - 1]!).lerp(path[i]!, k);
  };
  let phase = 0;
  let shown = 0;
  const sparks: WireSparks = {
    amps: 0,
    update(dt) {
      const on = sparks.amps > 0.005 ? 1 : 0;
      shown += (on - shown) * Math.min(1, dt * 6);
      // ≈ 0.09 of the loop per second at the lamp's 0.3 A
      phase += dt * 0.3 * Math.min(sparks.amps / 0.3, 3);
      for (let i = 0; i < SPARKS; i++) {
        const p = pointAt(phase + i / SPARKS);
        // through the battery (between its two ends on the near side) the electrons are not drawn
        const inBattery =
          Math.abs(p.z - LOOP.near) < 0.3 &&
          p.x > BATTERY.x - BATTERY.length / 2 - 0.25 &&
          p.x < BATTERY.x + BATTERY.length / 2 + 0.25;
        set.put(i, p.x, p.y + 0.02, p.z, inBattery ? 0 : shown);
      }
      set.commit();
    },
  };
  return sparks;
}

/** Recolour the ions of `circuit`'s lengthwise cut to this volume's `violet` (its `sky` glow set of 16 instances). */
export function violetIons(battery: Group): void {
  const sky = col('sky');
  battery.traverse((o) => {
    if (o instanceof InstancedMesh && o.count === 16) {
      const m = o.material as { color?: Color; intensity?: number };
      if (m.intensity !== undefined && m.color && m.color.equals(sky)) m.color.copy(col('violet'));
    }
  });
}
