/**
 * The lab bench: a console with a rheostat (big ring with a knob), a voltmeter, an ammeter and a wattmeter
 * with real needles, and a status LED. Pure builder: `set()` poses the needles and the knob from one model
 * sample; cables to the module are made by `benchCables`. Units: stage units (the console is ≈ 2 wide).
 */
import { type Group, type Object3D, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder, G } from '@/kit';
import { K, SEMANTIC, type KGlowMaterial } from '@/style';

export interface BenchReading {
  /** Needle deflections 0…1 of the voltmeter, ammeter and wattmeter. */
  v: number;
  i: number;
  p: number;
  /** Knob position 0…1 along the rheostat ring (0 = short circuit, 1 = open circuit). */
  knob: number;
}

export interface Bench {
  group: Group;
  /** Pick / drag target of the rheostat (the knob with a generous proxy). */
  knob: Object3D;
  anchors: Record<'voltmeter' | 'ammeter' | 'wattmeter' | 'rheostat' | 'plus' | 'minus', Object3D>;
  set(r: BenchReading, t: number): void;
}

const SWEEP = 2.1; // needle sweep, rad (±60°)
const RING = 4.4; // rheostat travel, rad

export function createBench(): Bench {
  const b = new Builder('bench');
  // cabinet with a plinth and a sloped instrument face
  b.box(2.1, 0.12, 1.0, { r: 0.04, c: 'bg.indigo', at: [0, 0, 0] });
  b.box(2.0, 0.78, 0.9, { r: 0.08, slot: 'gloss', c: ['slate', 'steel'], at: [0, 0.1, 0] });
  b.box(1.9, 0.03, 0.8, { r: 0.01, slot: 'metal', c: 'steel.light', at: [0, 0.88, 0] });
  const face = b.part('face', { at: [0, 1.3, -0.05], rot: [-0.62, 0, 0] });
  face.box(2.0, 1.0, 0.1, { r: 0.05, mid: true, slot: 'gloss', c: ['ink', 'slate'] });
  const dial = (name: string, x: number, y: number, accent: string): void => {
    face.cyl(0.25, 0.04, { axis: 'z', seg: 40, slot: 'metal', c: 'steel.light', at: [x, y, 0.05] });
    face.cyl(0.21, 0.045, { axis: 'z', seg: 40, slot: 'matte', c: 'white', at: [x, y, 0.05] });
    for (let k = 0; k <= 6; k++) {
      const a = -SWEEP / 2 + (k / 6) * SWEEP;
      face.box(0.014, 0.05, 0.004, { r: 0, mid: true, c: 'ink', at: [x + Math.sin(a) * 0.17, y + Math.cos(a) * 0.17, 0.097], rot: [0, 0, -a] });
    }
    face.box(0.2, 0.03, 0.004, { r: 0, mid: true, c: accent, at: [x, y - 0.11, 0.097] });
    const needle = face.part(name, { at: [x, y, 0.1] });
    needle.box(0.016, 0.19, 0.006, { r: 0, c: 'red', at: [0, -0.02, 0] });
    needle.cyl(0.028, 0.012, { axis: 'z', seg: 16, slot: 'metal', c: 'ink' });
    needle.anchor('pivot', 0, 0, 0);
  };
  dial('needleV', -0.66, 0.2, 'sky');
  dial('needleI', -0.1, 0.2, 'cyan');
  dial('needleP', 0.46, 0.2, 'yellow');
  // rheostat: a wound ring with a travelling knob
  const ringAt: [number, number, number] = [0.66, -0.2, 0.05];
  face.ring(0.2, 0.035, { axis: 'z', seg: 48, tubeSeg: 10, slot: 'metal', c: 'orange', at: ringAt });
  face.cyl(0.11, 0.03, { axis: 'z', seg: 32, slot: 'gloss', c: 'slate', at: ringAt });
  const knob = face.part('knob', { at: [ringAt[0], ringAt[1], ringAt[2] + 0.03] });
  knob.box(0.07, 0.3, 0.05, { r: 0.02, slot: 'gloss', c: 'cyan', at: [0, -0.03, 0] });
  knob.cyl(0.07, 0.06, { axis: 'z', seg: 24, slot: 'gloss', c: 'white' });
  knob.anchor('grip', 0, 0.2, 0.05);
  // terminals and the status LED
  face.cyl(0.05, 0.05, { axis: 'z', seg: 16, slot: 'gloss', c: SEMANTIC.dcPlus, at: [-0.5, -0.28, 0.05] });
  face.cyl(0.05, 0.05, { axis: 'z', seg: 16, slot: 'gloss', c: SEMANTIC.dcMinus, at: [-0.75, -0.28, 0.05] });
  face.anchor('plus', -0.5, -0.28, 0.1).anchor('minus', -0.75, -0.28, 0.1);
  const model = b.build();
  const led: KGlowMaterial = K.glow({ color: 'green', intensity: 1.4, keepHue: true, whiten: 0 });
  const lamp = model.part('face');
  const ledMesh = new Builder('led').sphere(0.035, { seg: 12, at: [-0.1, -0.26, 0.07] }).build().group;
  ledMesh.traverse((o) => {
    if ('material' in o) (o as { material: unknown }).material = led;
  });
  lamp.add(ledMesh);
  model.group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  const nV = model.part('needleV');
  const nI = model.part('needleI');
  const nP = model.part('needleP');
  const knobPart = model.part('knob');
  const pose = (o: Object3D, v: number): void => void (o.rotation.z = SWEEP / 2 - Math.min(1.05, Math.max(0, v)) * SWEEP);
  return {
    group: model.group,
    knob: knobPart,
    anchors: {
      voltmeter: nV,
      ammeter: nI,
      wattmeter: nP,
      rheostat: knobPart,
      plus: model.anchor('face.plus'),
      minus: model.anchor('face.minus'),
    },
    set(r, t) {
      // needles settle with a tiny tremble, like moving-coil instruments
      const tremble = Math.sin(t * 23) * 0.004;
      pose(nV, r.v + tremble);
      pose(nI, r.i - tremble);
      pose(nP, r.p + tremble);
      knobPart.rotation.z = RING / 2 - r.knob * RING;
      led.intensity = 1.1 + 0.5 * Math.sin(t * 4);
    },
  };
}

/** Two cables (plus `coral` rings, minus `blue` rings) from the module leads to the bench terminals, with energy pulses. */
export function benchCables(from: { plus: Vector3; minus: Vector3 }, to: { plus: Vector3; minus: Vector3 }, floorY: number): { group: Object3D; wires: Wire[] } {
  const b = new Builder('bench-cable-marks');
  const wires: Wire[] = [];
  const route = (a: Vector3, z: Vector3, side: number, color: string): void => {
    const pts = G.roundPath(
      [a, new Vector3(a.x, floorY + 0.05, a.z - 0.3), new Vector3((a.x + z.x) / 2, floorY + 0.05, z.z - 0.9 - side * 0.12), new Vector3(z.x, floorY + 0.05, z.z - 0.7), new Vector3(z.x, z.y - 0.25, z.z - 0.45), z],
      0.28,
    );
    wires.push(createWire(pts, { radius: 0.03, color: 'ink', repeat: 1.3, speed: 1.6, power: 0, detail: 7 }));
    for (const p of [pts[2]!, pts[pts.length - 3]!]) b.sphere(0.05, { seg: 10, slot: 'gloss', c: color, at: [p.x, p.y, p.z] });
  };
  route(from.plus, to.plus, 1, SEMANTIC.dcPlus);
  route(from.minus, to.minus, -1, SEMANTIC.dcMinus);
  const group = b.build().group;
  group.add(...wires);
  return { group, wires };
}
