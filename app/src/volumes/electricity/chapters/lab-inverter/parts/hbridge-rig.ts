/**
 * `hBridgeRig` — the teaching H-bridge as a classroom demonstrator board standing on the bench (front +Z):
 * DC source on the left, the + rail on top (coral marks), the − rail at the bottom (blue marks), leg A with
 * the keys S1 (top) / S2 (bottom), leg B with S3 / S4, the load between the two leg nodes, and a freewheeling
 * diode beside every key (cathode toward the + rail).
 *
 * `loopPath(conducting, forward)` returns the closed path of the load current for the devices that carry it —
 * the electron stream and the tests use it. Geometry only; states come from the step.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { Builder, type KitModel } from '@/kit';
import { K, SEMANTIC, col, type KGlowMaterial, type KToonMaterial } from '@/style';
import type { Conductor } from '@electricity/sim/lab-inverter';
import { COPPER } from '../world';

/** Board coordinates (x right, y up, the conductors lie at z = `Z`). */
export const RIG = {
  yTop: 3.55,
  yBottom: 0.55,
  yNode: 2.05,
  xSource: -3.55,
  xA: -1.35,
  xB: 2.45,
  /** Diode branch offset from its leg (outward). */
  dx: 0.82,
  ySwTop: 2.8,
  ySwBottom: 1.3,
  xLoad: 0.55,
  z: 0.16,
} as const;

const BODY = col('slate');
const BURNT = col('ink').multiplyScalar(0.5);

export type KeyName = 'S1' | 'S2' | 'S3' | 'S4';
export const KEYS: readonly KeyName[] = ['S1', 'S2', 'S3', 'S4'];
/** Centre of a key (S1…S4) or diode (D1…D4) on the board. */
export function devicePoint(name: Conductor, out = new Vector3()): Vector3 {
  const n = Number(name[1]);
  const legA = n <= 2;
  const top = n % 2 === 1;
  const x = (legA ? RIG.xA : RIG.xB) + (name[0] === 'D' ? (legA ? -RIG.dx : RIG.dx) : 0);
  return out.set(x, top ? RIG.ySwTop : RIG.ySwBottom, RIG.z);
}

export interface HBridgeRig {
  group: Group;
  model: KitModel;
  /** Pick targets and levers of the four keys. */
  keys: Record<KeyName, { hit: Mesh; lever: Group; frame: KGlowMaterial; body: KToonMaterial }>;
  /** Amber glow of the four diodes D1…D4 (0 = idle). */
  diodes: KGlowMaterial[];
  /** Voltmeter needle: −1…+1 → −U…+U. */
  setNeedle(k: number): void;
  setKey(name: KeyName, on: boolean, burnt?: boolean): void;
}

function conductors(b: Builder): void {
  const { yTop, yBottom, yNode, xSource, xA, xB, dx, z } = RIG;
  const r = 0.06;
  const bar = (a: [number, number], c: [number, number]): void => {
    b.rod([a[0], a[1], z], [c[0], c[1], z], r, { slot: 'metal', c: COPPER, seg: 10 });
  };
  bar([xSource, yTop], [xB + dx, yTop]);
  bar([xSource, yBottom], [xB + dx, yBottom]);
  bar([xSource, yBottom], [xSource, 1.0]);
  bar([xSource, 3.1], [xSource, yTop]);
  for (const x of [xA, xB]) bar([x, yBottom], [x, yTop]);
  for (const x of [xA - dx, xB + dx]) bar([x, yBottom], [x, yTop]);
  bar([xA - dx, yNode], [xA, yNode]);
  bar([xB, yNode], [xB + dx, yNode]);
  bar([xA, yNode], [xB, yNode]);
  // solder blobs at the junctions, polarity marks on the rails
  for (const [x, y] of [
    [xA, yNode],
    [xB, yNode],
    [xA, yTop],
    [xB, yTop],
    [xA, yBottom],
    [xB, yBottom],
  ] as const)
    b.sphere(0.12, { slot: 'metal', c: COPPER, at: [x, y, z] });
  for (const x of [-2.6, 0.55, 3.3]) {
    b.box(0.34, 0.16, 0.18, { r: 0.04, mid: true, slot: 'gloss', c: SEMANTIC.dcPlus, at: [x, yTop, z] });
    b.box(0.34, 0.16, 0.18, { r: 0.04, mid: true, slot: 'gloss', c: SEMANTIC.dcMinus, at: [x, yBottom, z] });
  }
}

function source(b: Builder): void {
  const { xSource, z } = RIG;
  b.cyl(0.46, 2.1, { seg: 40, slot: 'gloss', c: ['slate', 'steel'], at: [xSource, 1.0, z] });
  b.cyl(0.47, 0.34, { seg: 40, slot: 'gloss', c: SEMANTIC.dcMinus, at: [xSource, 0.98, z] });
  b.cyl(0.47, 0.34, { seg: 40, slot: 'gloss', c: SEMANTIC.dcPlus, at: [xSource, 2.78, z] });
  b.cyl(0.16, 0.14, { seg: 20, slot: 'metal', c: 'mist', at: [xSource, 3.1, z] });
  // big + and − embossed on the caps
  b.box(0.3, 0.07, 0.04, { r: 0, mid: true, c: 'white', at: [xSource, 2.95, z + 0.46] });
  b.box(0.07, 0.3, 0.04, { r: 0, mid: true, c: 'white', at: [xSource, 2.95, z + 0.46] });
  b.box(0.3, 0.07, 0.04, { r: 0, mid: true, c: 'white', at: [xSource, 1.15, z + 0.46] });
  b.anchor('source', xSource, 2.0, z + 0.5);
}

function boardAndMeter(b: Builder): void {
  b.box(8.9, 4.3, 0.14, {
    r: 0.12,
    seg: 2,
    slot: 'matte',
    c: ['bg.indigo', 'slate'],
    at: [-0.25, 0.05, -0.02],
  });
  for (const x of [-3.8, 3.3]) b.box(0.5, 0.12, 1.5, { r: 0.05, slot: 'metal', c: 'slate', at: [x, 0, 0.1] });
  // voltmeter «+/−» under the load: dial with a zero-centre scale, the needle is a part
  const { xLoad, z } = RIG;
  const y = 1.0;
  b.cyl(0.62, 0.1, { axis: 'z', seg: 48, slot: 'gloss', c: 'ink', at: [xLoad, y, z - 0.02] });
  b.cyl(0.54, 0.02, { axis: 'z', seg: 48, slot: 'gloss', c: 'white', at: [xLoad, y, z + 0.08] });
  for (let i = -4; i <= 4; i++) {
    const a = (i / 4) * 1.05;
    b.box(0.025, i % 2 ? 0.07 : 0.12, 0.01, {
      r: 0,
      mid: true,
      c: i < 0 ? 'blue' : i > 0 ? 'coral' : 'ink',
      at: [xLoad + Math.sin(a) * 0.43, y - 0.12 + Math.cos(a) * 0.43, z + 0.105],
      rot: [0, 0, -a],
    });
  }
  const needle = b.part('needle', { at: [xLoad, y - 0.12, z + 0.12] });
  needle.box(0.035, 0.46, 0.02, { r: 0.008, c: 'red', at: [0, 0, 0] });
  needle.cyl(0.06, 0.04, { axis: 'z', seg: 16, slot: 'metal', c: 'slate', at: [0, 0, -0.01] });
  b.anchor('meter', xLoad, y + 0.25, z + 0.2);
  b.anchor('load', xLoad, RIG.yNode + 0.2, z + 0.3);
}

export function createHBridgeRig(): HBridgeRig {
  const b = new Builder('hbridge-rig');
  boardAndMeter(b);
  conductors(b);
  source(b);
  // diode bodies (cathode band toward the + rail)
  for (const d of ['D1', 'D2', 'D3', 'D4'] as const) {
    const p = devicePoint(d);
    b.cyl(0.15, 0.5, { seg: 20, slot: 'gloss', c: 'ink', at: [p.x, p.y - 0.25, p.z] });
    b.cyl(0.155, 0.09, { seg: 20, slot: 'gloss', c: 'mist', at: [p.x, p.y + 0.12, p.z] });
    b.anchor(d, p.x, p.y, p.z + 0.2);
  }
  const model = b.build();
  const group = new Group();
  group.name = 'hbridge-rig';
  group.add(model.group);

  const p = new Vector3();
  const keys = {} as HBridgeRig['keys'];
  for (const name of KEYS) {
    devicePoint(name, p);
    const body = K.toon({ color: 'slate', gloss: 0.4, emissive: 'red', emissiveIntensity: 0, keepHue: true });
    const box = new Mesh(new BoxGeometry(0.74, 0.86, 0.36), body);
    box.position.copy(p);
    box.castShadow = true;
    // the rocker: tilts down when on
    const lever = new Group();
    lever.position.set(p.x, p.y, p.z + 0.2);
    const paddle = new Mesh(new BoxGeometry(0.42, 0.6, 0.12), K.toon({ color: 'white', gloss: 0.6 }));
    paddle.position.z = 0.04;
    lever.add(paddle);
    const frame = K.glow({ color: SEMANTIC.electron, intensity: 0.1, whiten: 0, keepHue: true, falloff: 0 });
    const rim = new Mesh(new BoxGeometry(0.86, 0.98, 0.3), frame);
    rim.position.set(p.x, p.y, p.z - 0.06);
    // generous one-finger target around the key
    const hitMat = K.flat('cyan');
    hitMat.colorWrite = false;
    hitMat.depthWrite = false;
    const hit = new Mesh(new BoxGeometry(1.1, 1.2, 0.7), hitMat);
    hit.position.set(p.x, p.y, p.z + 0.1);
    hit.name = `key-${name}`;
    group.add(rim, box, lever, hit);
    keys[name] = { hit, lever, frame, body };
  }
  const diodes = (['D1', 'D2', 'D3', 'D4'] as const).map((d) => {
    devicePoint(d, p);
    const m = K.glow({ color: 'amber', intensity: 0, whiten: 0, keepHue: true, falloff: 0 });
    const halo = new Mesh(new BoxGeometry(0.42, 0.62, 0.2), m);
    halo.position.set(p.x, p.y, p.z - 0.08);
    group.add(halo);
    return m;
  });
  const needle = model.part('needle');
  const self: HBridgeRig = {
    group,
    model,
    keys,
    diodes,
    setNeedle: (k) => (needle.rotation.z = -Math.max(-1, Math.min(1, k)) * 1.05),
    setKey(name, on, burnt = false) {
      const k = keys[name];
      k.lever.rotation.x = on ? 0.32 : -0.32;
      k.frame.intensity = burnt ? 0 : on ? 1.8 : 0.1;
      k.body.color.copy(burnt ? BURNT : BODY);
      k.body.emissiveIntensity = burnt ? 0.9 : 0;
    },
  };
  for (const name of KEYS) self.setKey(name, false);
  return self;
}

/**
 * Closed path of the load current for the two devices that carry it (leg A device first, as the simulation
 * lists them), in the direction A → load → B. With both legs on the same rail the loop closes along that rail
 * (zero state / freewheeling); otherwise it runs through the source.
 */
export function loopPath(conducting: readonly Conductor[]): Vector3[] {
  const [a, c] = conducting;
  if (!a || !c) return [];
  const { yTop, yBottom, yNode, xA, xB, xSource, z } = RIG;
  const isTop = (d: Conductor): boolean => Number(d[1]) % 2 === 1;
  const pa = devicePoint(a);
  const pb = devicePoint(c);
  const ya = isTop(a) ? yTop : yBottom;
  const yb = isTop(c) ? yTop : yBottom;
  const pts = [new Vector3(pa.x, ya, z), new Vector3(pa.x, yNode, z)];
  if (pa.x !== xA) pts.push(new Vector3(xA, yNode, z));
  pts.push(new Vector3(xB, yNode, z));
  if (pb.x !== xB) pts.push(new Vector3(pb.x, yNode, z));
  pts.push(new Vector3(pb.x, yb, z));
  if (ya !== yb) pts.push(new Vector3(xSource, yb, z), new Vector3(xSource, ya, z));
  return pts;
}
