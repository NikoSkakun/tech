/**
 * Inside the boiler house (step 4), in the shell's own frame (origin = centre of the footprint on the ground):
 * the tall furnace whose walls are rows of vertical water-wall tubes (front wall cut away), the bottom-ash
 * hopper, three tiers of corner burners (tangential firing), the platen superheater hanging at the top, the
 * horizontal pass and the convective shaft with the reheater and the economizer banks, the steam drum (drum
 * boiler) or the separators (once-through), soot blowers. `paths` are the centre lines of the three media.
 *
 * Toy proportions (chip «не в масштабі»); order and flow directions are the real ones.
 */
import { Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col, type ColorToken } from '@/style';
import { BOILER } from '../layout';

/** Furnace and convective shaft in the shell frame (metres). */
export const FURNACE = { x: -8, z: 0, w: 18, y0: 10, y1: 62 } as const;
export const SHAFT = { x: 13, w: 10, y0: 22, y1: 64 } as const;

export interface BoilerCore {
  /** Casing, hopper, burners, platens, banks: static. */
  body: KitModel;
  /** Water-wall tubes (part of their own: «Без екранів» hides them). */
  tubes: KitModel;
  /** The red-hot back wall that shows when the tubes are gone (its material is heated). */
  wall: KitModel;
  /** Drum with separators inside (drum boiler) and the separator bottles (once-through). */
  drum: KitModel;
  separators: KitModel;
  /** Corner burner mouths (shell frame), heights of the three tiers. */
  burners: Vector3[];
  /** Media paths in the shell frame. */
  paths: { water: Vector3[]; reheat: Vector3[]; gas: Vector3[]; air: Vector3[] };
  /** Anchor points (shell frame) for callouts and hotspots. */
  points: Record<'furnace' | 'platen' | 'reheater' | 'economizer' | 'hopper' | 'soot' | 'walls' | 'drum' | 'burner', Vector3>;
}

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

export function buildBoilerCore(): BoilerCore {
  const F = FURNACE;
  const h = F.w / 2;
  const casing = col('slate').lerp(col('steel'), 0.35);
  const b = new Builder('boiler-core');
  // hopper (inverted pyramid) + slag conveyor under it
  b.cone(h * 1.25, F.y0 - 2, { seg: 4, tip: 0.22, slot: 'matte', c: ['slate', 'steel'], at: [F.x, F.y0, F.z], rot: [Math.PI, Math.PI / 4, 0] });
  b.box(8, 1.2, 4, { r: 0.2, slot: 'metal', c: 'ink', at: [F.x, 0.4, F.z] });
  // burners: three tiers × four corners, aimed at a circle in the middle (tangential firing)
  const burners: Vector3[] = [];
  for (const y of [18, 23, 28]) {
    for (let k = 0; k < 4; k++) {
      const sx = k === 0 || k === 3 ? -1 : 1;
      const sz = k < 2 ? -1 : 1;
      const p = v(F.x + sx * (h - 0.6), y, F.z + sz * (h - 0.6));
      burners.push(p);
      const yaw = Math.atan2(-sz, -sx) + 0.35;
      b.cyl(0.9, 3.2, { seg: 14, axis: 'x', slot: 'metal', c: 'amber', at: [p.x, p.y, p.z], rot: [0, yaw, 0] });
    }
    b.box(F.w + 3, 1.6, 1.4, { r: 0.2, slot: 'gloss', c: 'orange.dark', at: [F.x, y - 0.8, F.z - h - 1.4] }); // windbox
  }
  // platen superheater: vertical plates hanging in the furnace top
  for (let i = 0; i < 6; i++) b.box(0.5, 10, F.w - 4, { r: 0.1, slot: 'metal', c: ['white', 'pink.light'], at: [F.x - 6 + i * 2.4, F.y1 - 12, F.z] });
  // horizontal pass roof and the convective shaft with its banks (serpentines as stacked tubes)
  b.box(SHAFT.x - F.x + SHAFT.w / 2 + h, 1, F.w, { r: 0.2, c: casing, at: [(F.x - h + SHAFT.x + SHAFT.w / 2) / 2, F.y1 + 2, F.z] });
  b.box(SHAFT.w + 1, SHAFT.y1 - SHAFT.y0, 1, { r: 0.2, c: casing, at: [SHAFT.x, SHAFT.y0, F.z - h] });
  b.box(1, SHAFT.y1 - SHAFT.y0, F.w, { r: 0.2, c: casing, at: [SHAFT.x + SHAFT.w / 2, SHAFT.y0, F.z] });
  const bank = (y0: number, rows: number, c: readonly [ColorToken, ColorToken]): void => {
    for (let r = 0; r < rows; r++) b.cyl(0.32, F.w - 2, { seg: 8, axis: 'z', slot: 'metal', c: r % 2 ? c[0] : c[1], at: [SHAFT.x, y0 + r * 1.1, F.z - (F.w - 2) / 2] });
    for (let r = 0; r < rows; r++) b.cyl(0.32, F.w - 2, { seg: 8, axis: 'z', slot: 'metal', c: r % 2 ? c[1] : c[0], at: [SHAFT.x + 2.6, y0 + r * 1.1 + 0.55, F.z - (F.w - 2) / 2] });
  };
  bank(48, 9, ['pink.light', 'white']); // reheater
  bank(37, 6, ['white', 'mist']); // primary superheater
  bank(26, 8, ['blue', 'sky']); // economizer
  // soot blowers: lances along the shaft wall
  for (const y of [32, 44, 56]) b.cyl(0.25, 6, { seg: 8, axis: 'x', slot: 'metal', c: 'amber', at: [SHAFT.x + SHAFT.w / 2, y, F.z + 4] });
  // headers: bottom ring of the water walls, outlet header to the main steam line
  b.box(F.w + 1, 1.2, 1.2, { r: 0.4, slot: 'metal', c: 'blue', at: [F.x, F.y0 - 0.6, F.z - h] });
  b.cyl(0.9, F.w + 6, { seg: 16, axis: 'z', slot: 'metal', c: ['pink.light', 'white'], at: [F.x, F.y1 + 4, F.z - h - 3] });
  const body = b.build();

  // water walls: back and both sides (the front is cut away so the flame shows)
  const t = new Builder('water-walls');
  const n = 16;
  const tubeH = F.y1 - F.y0;
  for (let i = 0; i < n; i++) {
    const u = -h + 0.6 + (i / (n - 1)) * (F.w - 1.2);
    const grad = { c: ['blue', 'pink.light'] as [ColorToken, ColorToken], seg: 8, slot: 'gloss' as const };
    t.cyl(0.42, tubeH, { ...grad, at: [F.x + u, F.y0, F.z - h] });
    t.cyl(0.42, tubeH, { ...grad, at: [F.x - h, F.y0, F.z + u] });
    t.cyl(0.42, tubeH, { ...grad, at: [F.x + h, F.y0, F.z + u] });
  }
  const tubes = t.build();
  const w = new Builder('furnace-wall');
  w.box(F.w + 1.6, tubeH, 0.6, { r: 0.1, c: casing, at: [F.x, F.y0, F.z - h - 0.8] });
  for (const s of [-1, 1]) w.box(0.6, tubeH, F.w + 1.6, { r: 0.1, c: casing, at: [F.x + s * (h + 0.8), F.y0, F.z] });
  const wall = w.build();

  const d = new Builder('drum');
  d.capsule(2.2, 16, { axis: 'x', seg: 28, slot: 'gloss', c: ['steel', 'mist'], at: [F.x + 2, F.y1 + 8, F.z - 4] });
  for (const dx of [-5, 0, 5]) d.cyl(0.5, 4, { seg: 10, slot: 'metal', c: 'blue', at: [F.x + 2 + dx, F.y1 + 4, F.z - 4] });
  const drum = d.build();
  const s = new Builder('separators');
  for (const dx of [-4, 4]) s.capsule(1.1, 6, { seg: 20, slot: 'gloss', c: ['steel', 'mist'], at: [F.x + 2 + dx, F.y1 + 5, F.z - 6] });
  const separators = s.build();

  const top = F.y1 - 4;
  return {
    body,
    tubes,
    wall,
    drum,
    separators,
    burners,
    paths: {
      // feed water → economizer (up) → drum / separators → downcomer → water walls (up) → platens → main steam
      water: [v(SHAFT.x + 6, 26, F.z + 6), v(SHAFT.x, 27, F.z), v(SHAFT.x, 35, F.z), v(F.x + 2, F.y1 + 8, F.z - 4), v(F.x - h - 2, F.y1 + 6, F.z - h + 2), v(F.x - h - 2, F.y0 - 1, F.z - h + 2), v(F.x, F.y0, F.z - h + 1), v(F.x, top, F.z - h + 1), v(F.x - 3, F.y1 - 8, F.z), v(F.x - 3, F.y1 + 4, F.z - h - 3), v(-BOILER.w / 2 + 2, F.y1 + 4, F.z + BOILER.d / 2 - 2)],
      // cold reheat from the turbine → reheater banks → hot reheat back to the turbine
      reheat: [v(-BOILER.w / 2 + 4, 52, BOILER.d / 2 - 4), v(SHAFT.x + 2, 50, F.z + 6), v(SHAFT.x + 1, 57, F.z), v(SHAFT.x - 2, 58, F.z - 6), v(-BOILER.w / 2 + 4, 58, BOILER.d / 2 - 6)],
      // flame core → up the furnace → platens → horizontal pass → down the shaft → outlet duct
      gas: [v(F.x, 22, F.z), v(F.x, 40, F.z), v(F.x, F.y1 - 6, F.z), v(F.x + 6, F.y1, F.z), v(SHAFT.x, F.y1 - 2, F.z), v(SHAFT.x, 40, F.z), v(SHAFT.x, 25, F.z), v(BOILER.w / 2, 24, F.z)],
      // forced-draft fan → air heater (outside, east) → hot-air duct → windbox → burners
      air: [v(BOILER.w / 2 + 14, 2, 14), v(BOILER.w / 2 + 26, 12, 6), v(BOILER.w / 2 + 26, 22, 0), v(BOILER.w / 2 + 8, 30, F.z - h - 3), v(F.x + h, 23, F.z - h - 1.4), v(F.x - h, 23, F.z - h - 1.4)],
    },
    points: {
      furnace: v(F.x, 34, F.z),
      platen: v(F.x - 2, F.y1 - 4, F.z),
      reheater: v(SHAFT.x + 1, 49, F.z),
      economizer: v(SHAFT.x + 1, 30, F.z),
      hopper: v(F.x, F.y0 - 3, F.z),
      soot: v(SHAFT.x + SHAFT.w / 2 + 3, 44, F.z + 4),
      walls: v(F.x - h, 44, F.z + 4),
      drum: v(F.x + 2, F.y1 + 8, F.z - 4),
      burner: burners[11]!.clone(),
    },
  };
}
