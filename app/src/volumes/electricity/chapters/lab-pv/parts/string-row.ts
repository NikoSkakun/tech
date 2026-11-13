/**
 * The other nine modules of a string of ten (step 7, «Ланцюжок із 10 модулів»): small kit modules on a rail
 * along the front rim of the podium, wired in series with energy pulses, plus the optional optimiser boxes
 * (`teal`) — one per module, the hero included. Not to scale with the hero module (the step says so).
 */
import { Group, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder, instanced, pvModule, PV_MODULE, type KitModel } from '@/kit';
import { shadows } from '../world';

const N = 9;
const SCALE = 0.5;
const PITCH = (PV_MODULE.width + 0.12) * SCALE;
const Z = 3.2;

export interface StringRow {
  /** Modules, rail and the series wire. */
  group: Group;
  /** Optimiser boxes of the ten modules (shown on demand). */
  optimisers: Group;
  wire: Wire;
  /** Top centre of row module `i` (0…8) in the rig frame — for callouts. */
  top(i: number, out?: Vector3): Vector3;
}

/** `tilt` = module tilt from horizontal (rad); `heroFoot` = where the hero module's optimiser sits (rig frame). */
export function createStringRow(tilt: number, heroFoot: Vector3): StringRow {
  const group = new Group();
  group.name = 'string-row';
  const lift = (PV_MODULE.length / 2) * SCALE * Math.sin(tilt) + 0.16;
  const xs = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * PITCH);

  // one mid-detail kit module, tilted inside a wrapper so that every instance keeps the tilt
  const one = pvModule({ detail: 'mid' });
  one.group.rotation.x = tilt;
  const wrapper = new Group();
  wrapper.add(one.group);
  const copies = instanced({ ...one, group: wrapper } as KitModel, xs.map((x) => ({ at: [x, lift, Z] as [number, number, number], s: SCALE })));
  group.add(shadows(copies));

  const b = new Builder('string-rail');
  b.box(N * PITCH + 0.3, 0.07, 0.12, { r: 0.02, slot: 'metal', c: 'steel', at: [0, 0, Z + 0.25] });
  b.box(N * PITCH + 0.3, 0.07, 0.12, { r: 0.02, slot: 'metal', c: 'steel', at: [0, 0, Z - 0.3] });
  for (const x of xs) {
    b.beam([x, 0.06, Z - 0.3], [x, lift + 0.2, Z - 0.22], 0.05, { slot: 'metal', c: 'steel.light' });
    b.beam([x, 0.06, Z + 0.25], [x, lift - 0.3, Z + 0.2], 0.05, { slot: 'metal', c: 'steel.light' });
  }
  group.add(shadows(b.build().group));

  // series wiring: one conductor weaving from module to module behind the row
  const pts: Vector3[] = [];
  xs.forEach((x, i) => {
    pts.push(new Vector3(x - PITCH * 0.3, lift - 0.12, Z - 0.16), new Vector3(x + PITCH * 0.3, lift - 0.12, Z - 0.16));
    if (i < N - 1) pts.push(new Vector3(x + PITCH * 0.5, lift - 0.3, Z - 0.2));
  });
  const wire = createWire(pts, { radius: 0.018, color: 'ink', repeat: 2.2, speed: 1.2, power: 0, detail: 6 });
  group.add(wire);

  const o = new Builder('optimisers');
  for (const x of xs) o.box(0.2, 0.09, 0.12, { r: 0.02, slot: 'gloss', c: 'teal', at: [x, lift - 0.42, Z - 0.26] });
  o.box(0.5, 0.2, 0.28, { r: 0.04, slot: 'gloss', c: 'teal', at: [heroFoot.x, heroFoot.y, heroFoot.z] });
  const optimisers = shadows(o.build().group);

  return {
    group,
    optimisers,
    wire,
    top: (i, out = new Vector3()) => out.set(xs[i]!, lift + (PV_MODULE.length / 2) * SCALE * Math.sin(tilt) + 0.05, Z - (PV_MODULE.length / 2) * SCALE * Math.cos(tilt)),
  };
}
