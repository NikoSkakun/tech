/**
 * The bench of step 8: a big supercapacitor (10 F, 2,7 V) on a glass stand, a knife switch and a small lamp
 * joined by copper wires into one loop, with `cyan` electrons running round it while the switch is closed
 * (fx flow, speed ∝ current) and the lamp glowing with (U/U₀)².
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
import { createFlow, createHalo, createWire, curveThrough, type Flow } from '@/fx';
import { Builder } from '@/kit';
import { K } from '@/style';
import { BRIDGE } from '../layout';

export interface Bench {
  group: Group;
  flow: Flow;
  /** Pick target of the switch lever. */
  lever: Group;
  /** Anchors: glass stand, middle of the copper wire, lamp. */
  stand: Vector3;
  wire: Vector3;
  lamp: Vector3;
  closed: boolean;
  /** 0…1 lamp brightness and normalised current (I / I₀). */
  brightness: number;
  current: number;
  hover: number;
  update(dt: number, t: number): void;
}

export function createBench(ctx: ChapterContext): Bench {
  const group = new Group();
  group.name = 'bench';
  const b = new Builder('bench');
  // glass stand + supercapacitor can with its two terminals
  b.frame({ at: [BRIDGE.cap.x, 0, BRIDGE.cap.z] }, () => {
    b.cyl(1.25, 0.5, { seg: 36, bevel: 0.06, slot: 'glass', c: 'sky' });
    b.cyl(0.95, 2.3, { seg: 36, bevel: 0.1, slot: 'gloss', c: ['blue.dark', 'blue'], at: [0, 0.5, 0] });
    b.cyl(0.96, 0.5, { seg: 36, slot: 'gloss', c: 'mist', at: [0, 1.45, 0] });
    b.cyl(0.97, 0.08, { seg: 36, slot: 'metal', c: 'steel.light', at: [0, 2.7, 0] });
    b.cyl(0.14, 0.3, { seg: 14, slot: 'metal', c: 'blue', at: [-0.4, 2.8, 0] });
    b.cyl(0.14, 0.3, { seg: 14, slot: 'metal', c: 'coral', at: [0.4, 2.8, 0] });
  });
  // lamp socket and switch base
  b.frame({ at: [BRIDGE.lamp.x, 0, BRIDGE.lamp.z] }, () => {
    b.cyl(0.75, 0.2, { seg: 28, bevel: 0.05, c: ['bg.plum', 'slate'] });
    b.cyl(0.32, 0.55, { seg: 20, slot: 'metal', c: 'steel.light', at: [0, 0.2, 0] });
  });
  b.frame({ at: [BRIDGE.key.x, 0, BRIDGE.key.z] }, () => {
    b.box(2.2, 0.22, 0.9, { r: 0.08, c: ['bg.plum', 'slate'] });
    for (const x of [-0.75, 0.75])
      b.box(0.22, 0.5, 0.5, { r: 0.05, slot: 'metal', c: 'steel.light', at: [x, 0.22, 0] });
  });
  group.add(b.build().group);

  const lever = new Group();
  const lb = new Builder('lever');
  lb.box(1.7, 0.1, 0.24, { r: 0.04, slot: 'metal', c: 'orange', at: [0.8, 0, 0], mid: true });
  lb.sphere(0.2, { seg: 16, slot: 'gloss', c: 'cyan', at: [1.7, 0.02, 0] });
  lever.add(lb.build().group);
  lever.position.set(BRIDGE.key.x - 0.75, 0.62, BRIDGE.key.z);
  const grip = new Mesh(new SphereGeometry(1.1, 12, 8), K.flat('cyan'));
  grip.material.colorWrite = false;
  grip.material.depthWrite = false;
  grip.position.set(0.8, 0.2, 0);
  lever.add(grip);

  const lamp = new Vector3(BRIDGE.lamp.x, 1.35, BRIDGE.lamp.z);
  const glow = K.glow({ color: 'yellow', intensity: 0.15, whiten: 0.6 });
  const bulb = new Mesh(new SphereGeometry(0.55, 28, 20), glow);
  bulb.position.copy(lamp);
  const shell = new Mesh(
    new SphereGeometry(0.6, 28, 20),
    K.glass({ color: 'white', opacity: 0.2, edgeOpacity: 0.7 }),
  );
  shell.position.copy(lamp);
  const halo = createHalo({ color: 'yellow', size: 6, intensity: 0, amount: 0.1 });
  halo.position.copy(lamp);

  // the loop, in the direction the electrons travel: «−» terminal → switch → lamp → «+» terminal
  const minus = new Vector3(BRIDGE.cap.x - 0.4, 3.1, BRIDGE.cap.z);
  const plus = new Vector3(BRIDGE.cap.x + 0.4, 3.1, BRIDGE.cap.z);
  const k0 = new Vector3(BRIDGE.key.x - 0.75, 0.6, BRIDGE.key.z);
  const k1 = new Vector3(BRIDGE.key.x + 0.75, 0.6, BRIDGE.key.z);
  const l0 = new Vector3(BRIDGE.lamp.x - 0.25, 0.5, BRIDGE.lamp.z + 0.3);
  const l1 = new Vector3(BRIDGE.lamp.x + 0.25, 0.5, BRIDGE.lamp.z - 0.3);
  const legs = [
    [
      minus,
      new Vector3(minus.x - 1.5, 2.6, minus.z + 0.8),
      new Vector3(minus.x - 1.2, 0.3, 2.2),
      new Vector3(k0.x - 0.9, 0.3, k0.z),
      k0,
    ],
    [k1, new Vector3(k1.x + 1.0, 0.3, k1.z), new Vector3(l0.x - 0.6, 0.3, l0.z + 0.8), l0],
    [
      l1,
      new Vector3(l1.x + 0.9, 0.3, l1.z - 0.9),
      new Vector3(1.4, 0.4, -2.4),
      new Vector3(plus.x + 1.6, 2.4, plus.z - 1.4),
      plus,
    ],
  ];
  const copper = { radius: 0.06, color: 'orange' as const, power: 0, detail: 5 };
  for (const leg of legs) group.add(createWire(curveThrough(leg), copper));
  const loop = [...legs[0]!, ...legs[1]!, ...legs[2]!];
  const flow = createFlow(ctx, {
    kind: 'electron',
    paths: curveThrough(loop),
    count: 70,
    radius: 0.075,
    speed: 0,
    spread: 0.02,
  });
  group.add(lever, bulb, shell, halo, flow);

  let angle = 0.6;
  const bench: Bench = {
    group,
    flow,
    lever,
    stand: new Vector3(BRIDGE.cap.x + 1.0, 0.3, BRIDGE.cap.z + 0.9),
    wire: new Vector3().copy(legs[1]![2]!),
    lamp,
    closed: false,
    brightness: 0,
    current: 0,
    hover: 0,
    update(dt, t) {
      angle = damp(angle, bench.closed ? 0 : 0.6, 12, dt);
      lever.rotation.z = angle;
      lever.scale.setScalar(1 + 0.06 * bench.hover);
      flow.speed = damp(flow.speed, 3.2 * bench.current, 6, dt);
      glow.intensity = 0.12 + 3.4 * bench.brightness * (1 + 0.03 * Math.sin(t * 40));
      halo.intensity = 1.8 * bench.brightness;
    },
  };
  return bench;
}
