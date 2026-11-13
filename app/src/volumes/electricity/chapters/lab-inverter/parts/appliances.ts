/**
 * `applianceTray` toys of step 12: the appliances of the shared house (`_shared-house.md` §3) as small models,
 * each scaled so that it fits a tray slot (≈ 0,9 units) — real proportions between them are not kept (the
 * step carries «не в масштабі»). Kit models where the kit has one (fridge, TV, router, gas boiler), own
 * shapes for the rest. Each toy stands on y = 0 and carries a status ring: off / connected / warning / fault.
 */
import { Group, Mesh, TorusGeometry } from 'three';
import { Builder, addFridge, addGasBoiler, addRouter, addTv } from '@/kit';
import { K, col, type ColorLike, type KGlowMaterial } from '@/style';
import { pickBox } from '../world';

export type ToyStatus = 'idle' | 'on' | 'starting' | 'warn' | 'fault' | 'dead';

export interface Toy {
  id: string;
  group: Group;
  hit: Mesh;
  ring: KGlowMaterial;
  setStatus(s: ToyStatus, t: number): void;
}

const SHAPES: Record<string, (b: Builder) => void> = {
  fridge: (b) => b.frame({ s: 0.5 }, () => addFridge(b)),
  well_pump: (b) => {
    // submersible well pump: a steel tube with the motor below and a riser pipe
    b.cyl(0.16, 0.78, { seg: 24, slot: 'metal', c: 'steel', at: [0, 0.04, 0] });
    b.cyl(0.165, 0.2, { seg: 24, slot: 'gloss', c: 'blue', at: [0, 0.3, 0] });
    b.cyl(0.07, 0.2, { seg: 14, slot: 'gloss', c: 'sky', at: [0, 0.82, 0] });
    b.cyl(0.2, 0.05, { seg: 24, slot: 'metal', c: 'slate' });
  },
  drill: (b) => {
    b.box(0.26, 0.5, 0.2, { r: 0.05, slot: 'gloss', c: 'teal', at: [0, 0, 0], rot: [0, 0, 0.12] });
    b.box(0.74, 0.24, 0.22, { r: 0.07, slot: 'gloss', c: ['teal.dark', 'teal'], at: [0.12, 0.46, 0] });
    b.cyl(0.07, 0.16, { axis: 'x', seg: 14, slot: 'metal', c: 'steel', at: [0.48, 0.58, 0] });
    b.cyl(0.022, 0.3, { axis: 'x', seg: 8, slot: 'metal', c: 'mist', at: [0.64, 0.58, 0] });
  },
  kettle: (b) => {
    b.cyl(0.24, 0.05, { seg: 28, slot: 'gloss', c: 'slate' });
    b.cyl(0.22, 0.46, { rTop: 0.17, seg: 28, slot: 'metal', c: 'mist', at: [0, 0.05, 0] });
    b.cyl(0.17, 0.05, { seg: 28, slot: 'gloss', c: 'ink', at: [0, 0.51, 0] });
    b.box(0.07, 0.36, 0.07, { r: 0.03, slot: 'gloss', c: 'ink', at: [-0.27, 0.12, 0] });
    b.box(0.16, 0.07, 0.1, { r: 0.03, slot: 'metal', c: 'mist', at: [0.2, 0.42, 0], rot: [0, 0, 0.5] });
  },
  microwave: (b) => {
    b.box(0.8, 0.46, 0.5, { r: 0.05, slot: 'gloss', c: ['mist', 'white'] });
    b.box(0.5, 0.32, 0.02, { r: 0.02, slot: 'gloss', c: 'ink', at: [-0.1, 0.07, 0.25] });
    b.box(0.14, 0.32, 0.02, { r: 0.01, slot: 'gloss', c: 'slate', at: [0.27, 0.07, 0.25] });
    b.cyl(0.04, 0.03, { axis: 'z', seg: 12, slot: 'metal', c: 'mist', at: [0.27, 0.16, 0.26] });
  },
  laptop: (b) => {
    b.box(0.66, 0.035, 0.46, { r: 0.015, slot: 'metal', c: 'mist' });
    b.box(0.66, 0.44, 0.03, { r: 0.015, slot: 'metal', c: 'mist', at: [0, 0.03, -0.24], rot: [-0.3, 0, 0] });
    b.box(0.58, 0.36, 0.01, { r: 0, slot: 'glow', c: 'sky', at: [0, 0.07, -0.215], rot: [-0.3, 0, 0] });
  },
  tv: (b) => b.frame({ s: 0.52 }, () => addTv(b)),
  router: (b) => b.frame({ s: 2.6 }, () => addRouter(b)),
  lights: (b) => {
    // three LED bulbs on a strip stand for the 20 lamps of the house
    b.box(0.8, 0.06, 0.2, { r: 0.02, slot: 'gloss', c: 'slate' });
    for (const x of [-0.27, 0, 0.27]) {
      b.cyl(0.05, 0.12, { seg: 12, slot: 'metal', c: 'mist', at: [x, 0.06, 0] });
      b.sphere(0.12, { seg: 16, slot: 'glow', c: col('yellow').lerp(col('white'), 0.4), at: [x, 0.29, 0] });
    }
  },
  boiler: (b) => {
    b.box(0.08, 0.95, 0.5, { r: 0.02, slot: 'matte', c: 'slate', at: [0, 0, -0.06] });
    b.frame({ at: [0, 0.55, -0.02], s: 0.95, rot: [0, 0, 0] }, () => addGasBoiler(b));
  },
};

const RING: Record<ToyStatus, [ColorLike, number]> = {
  idle: ['slate', 0.25],
  on: ['cyan', 1.5],
  starting: ['yellow', 2.0],
  warn: ['orange', 1.8],
  fault: ['red', 1.9],
  dead: ['red', 0.5],
};

export function createToy(id: string): Toy {
  const make = SHAPES[id];
  if (!make) throw new Error(`lab-inverter: no toy for appliance '${id}'`);
  const b = new Builder(`toy-${id}`);
  b.cyl(0.52, 0.04, { seg: 36, c: ['bg.indigo', 'slate'] });
  b.frame({ at: [0, 0.04, 0] }, () => make(b));
  const model = b.build();
  const ring = K.glow({ color: 'slate', intensity: 0.25, whiten: 0, keepHue: true, falloff: 0 });
  const hoop = new Mesh(new TorusGeometry(0.52, 0.022, 8, 48).rotateX(Math.PI / 2), ring);
  hoop.position.y = 0.045;
  const hit = pickBox(1.05, 1.15, 1.05, 0, 0.58, 0);
  const group = new Group();
  group.name = `toy-${id}`;
  group.add(model.group, hoop, hit);
  let last: ToyStatus | null = null;
  return {
    id,
    group,
    hit,
    ring,
    setStatus(s, t) {
      if (s !== last) ring.setColor(RING[s][0]);
      last = s;
      const pulse = s === 'starting' || s === 'fault' || s === 'warn' ? 0.75 + 0.25 * Math.sin(t * 9) : 1;
      ring.intensity = RING[s][1] * pulse;
    },
  };
}
