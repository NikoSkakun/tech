/**
 * `gridWall` — step 8's tabletop: a piece of the house wall with the closed inverter «ЛІ-6» (kit model), the
 * big connection relay with its synchronism lamp, the two-way meter, the service cable to a 0,4 kV pole with a
 * lineman at work and a second pole "down the street". Kit models are in metres, scaled by `S`.
 *
 * Handles only: `setRelay(closed)`, `setSync(inSync)`, `setGrid(on)`, `setSafe(v)`, `setLit(on)`; flows are
 * `wires` (set power / speed). Order of the equipment is the real one: inverter → relay → meter → service
 * cable → pole.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createSpan, createWire, type Wire } from '@/fx';
import { Builder, distributionPole, hybridInverter, people, type KitModel } from '@/kit';
import { FLOW, K, type KGlowMaterial } from '@/style';
import { COPPER } from '../world';

const S = 0.46; // metres → bench units for the street side (an 8,6 m pole becomes ≈ 4 units)

export interface GridWall {
  group: Group;
  inverter: ReturnType<typeof hybridInverter>;
  wires: { toRelay: Wire; toMeter: Wire; service: Wire; reactive: Wire; street: Wire };
  setRelay(closed: number): void;
  setSync(inSync: boolean): void;
  setGrid(on: boolean): void;
  /** Green «безпечно» tick over the lineman (0…1). */
  setSafe(v: number): void;
  setLit(on: number): void;
  update(dt: number, t: number): void;
  points: Record<
    'inverter' | 'relay' | 'meter' | 'lineman' | 'pole' | 'gridSwitch' | 'service' | 'window',
    Vector3
  >;
}

function wall(): KitModel {
  const b = new Builder('grid-wall');
  b.box(5.0, 4.1, 0.24, { r: 0.06, slot: 'matte', c: ['mist', 'white'], at: [0, 0, -0.12] });
  b.box(5.2, 0.3, 0.34, { r: 0.05, c: 'slate', at: [0, 0, -0.1] });
  b.box(5.3, 0.16, 0.5, { r: 0.05, slot: 'matte', c: 'coral', at: [0, 4.1, -0.05] }); // eaves
  // a window: lit while the house has power
  b.box(1.1, 1.3, 0.1, { r: 0.04, c: 'white', at: [-1.75, 2.2, 0] });
  b.box(0.92, 1.12, 0.06, { r: 0.02, slot: 'window', c: 'bg.indigo', at: [-1.75, 2.29, 0.04] });
  b.box(0.05, 1.12, 0.08, { r: 0, c: 'white', at: [-1.75, 2.29, 0.05] });
  // two-way meter in its box on the wall
  b.box(0.7, 0.9, 0.3, { r: 0.05, slot: 'gloss', c: ['slate', 'mist'], at: [1.85, 1.3, 0.02] });
  b.box(0.5, 0.26, 0.04, { r: 0.02, slot: 'gloss', c: 'ink', at: [1.85, 1.82, 0.3] });
  b.box(0.36, 0.06, 0.02, { r: 0, slot: 'glow', c: 'teal', at: [1.85, 1.92, 0.33] });
  b.cone(0.07, 0.14, { axis: 'x', seg: 3, slot: 'glow', c: 'yellow', at: [1.98, 1.55, 0.33] });
  b.cone(0.07, 0.14, {
    axis: 'x',
    seg: 3,
    slot: 'glow',
    c: 'sky',
    at: [1.72, 1.4, 0.33],
    rot: [0, Math.PI, 0],
  });
  b.anchor('meter', 1.85, 2.25, 0.35);
  b.anchor('window', -1.75, 3.0, 0.2);
  // relay base: two fixed contacts; the moving bridge is a part
  b.box(1.0, 0.9, 0.16, { r: 0.04, slot: 'gloss', c: 'ink', at: [0.55, 1.25, 0.02] });
  for (const x of [0.25, 0.85])
    b.cyl(0.09, 0.22, { axis: 'z', seg: 14, slot: 'metal', c: COPPER, at: [x, 1.9, 0.16] });
  const arm = b.part('arm', { at: [0.25, 1.9, 0.4] });
  arm.box(0.7, 0.1, 0.08, { r: 0.03, slot: 'metal', c: COPPER, at: [0.3, -0.05, 0] });
  arm.cyl(0.07, 0.2, { axis: 'z', seg: 12, c: 'red', at: [0.62, 0, 0.02] });
  b.anchor('relay', 0.55, 2.3, 0.4);
  return b.build();
}

/** Lineman's bucket on the pole (he stands in it): a small platform with a rail. */
function bucket(): Group {
  const b = new Builder('bucket');
  b.box(0.5, 0.06, 0.5, { r: 0.02, slot: 'metal', c: 'slate' });
  b.box(0.52, 0.34, 0.04, { r: 0.01, c: 'yellow', at: [0, 0.06, 0.24] });
  for (const x of [-0.24, 0.24]) b.box(0.04, 0.34, 0.5, { r: 0.01, c: 'yellow', at: [x, 0.06, 0] });
  b.beam([0, 0, -0.3], [0, -0.5, -0.75], 0.07, { c: 'slate', slot: 'metal' });
  return b.build().group;
}

export function createGridWall(ctx: ChapterContext): GridWall {
  const group = new Group();
  group.name = 'grid-wall';
  const w = wall();
  w.group.position.set(-1.75, 0, -0.6);
  w.group.rotation.y = 0.22;
  const inverter = hybridInverter();
  inverter.group.scale.setScalar(2.4);
  inverter.group.position.set(-0.55, 2.2, 0.02);
  w.group.add(inverter.group);

  // synchronism lamp on the relay (red → green) and the «мережа є» lamp on the pole switch
  const lamp = (color: string): KGlowMaterial =>
    K.glow({ color, intensity: 1.7, whiten: 0, keepHue: true, falloff: 0.3 });
  const syncLamp = lamp('red');
  const sync = new Mesh(new SphereGeometry(0.11, 16, 12), syncLamp);
  sync.position.set(0.55, 1.45, 0.24);
  w.group.add(sync);

  const pole = distributionPole({ voltage: 0.4, kind: 'concrete', sip: true, lamp: false });
  pole.group.scale.setScalar(S);
  pole.group.position.set(3.15, 0, 0.4);
  const far = distributionPole({ voltage: 0.4, kind: 'concrete', sip: true, lamp: true });
  far.group.scale.setScalar(S * 0.8);
  far.group.position.set(4.55, 0, -2.2);
  // the street switch box on the pole («рубильник») with its lamp
  const sb = new Builder('street-switch');
  sb.box(0.34, 0.46, 0.2, { r: 0.04, slot: 'gloss', c: ['slate', 'steel'] });
  sb.box(0.06, 0.26, 0.06, { r: 0.02, c: 'red', at: [0, 0.12, 0.12] });
  const box = sb.build().group;
  box.position.set(3.15, 1.25, 0.56);
  const gridLamp = lamp('green');
  const gl = new Mesh(new SphereGeometry(0.07, 12, 8), gridLamp);
  gl.position.set(3.15, 1.82, 0.62);

  // the lineman in his bucket near the top of the pole
  const man = people(
    [{ at: [0, 0.06, 0], ry: -1.2, action: 'work', color: 'orange', hat: 'yellow' }],
    ctx.random.fork('lineman'),
  );
  man.group.scale.setScalar(S * 1.55);
  const perch = new Group();
  perch.position.set(3.8, 2.55, 0.55);
  perch.add(bucket(), man.group);
  const tickMat = K.glow({ color: 'green', intensity: 0, whiten: 0, keepHue: true, falloff: 0 });
  const tb = new Builder('tick');
  tb.beam([-0.16, 0, 0], [-0.04, -0.14, 0], 0.06, { slot: 'flat', c: 'green' });
  tb.beam([-0.04, -0.14, 0], [0.2, 0.16, 0], 0.06, { slot: 'flat', c: 'green' });
  const tick = new Mesh(tb.geometry('flat'), tickMat);
  tick.position.set(3.8, 3.95, 0.6);

  // conductors: inverter → relay → meter on the wall, the service cable up to the pole, the street beyond
  const wire = (pts: Vector3[], o: { radius?: number; pulse?: string } = {}): Wire =>
    createWire(pts, {
      radius: o.radius ?? 0.045,
      color: 'ink',
      pulseColor: o.pulse,
      repeat: 1.6,
      speed: 1.4,
      power: 0,
      detail: 8,
    });
  const toRelay = wire([
    new Vector3(-0.42, 1.38, 0.3),
    new Vector3(-0.3, 1.1, 0.34),
    new Vector3(0.1, 1.5, 0.36),
    new Vector3(0.25, 1.9, 0.36),
  ]);
  const toMeter = wire([
    new Vector3(0.85, 1.9, 0.36),
    new Vector3(1.3, 2.3, 0.34),
    new Vector3(1.85, 2.22, 0.3),
  ]);
  w.group.add(toRelay, toMeter);
  w.group.updateMatrix();
  const fromWall = (x: number, y: number, z: number): Vector3 =>
    new Vector3(x, y, z).applyMatrix4(w.group.matrix);
  const drop = pole.anchorLocal('drop').multiplyScalar(S).add(pole.group.position);
  const farTop = far
    .anchorLocal('drop')
    .multiplyScalar(S * 0.8)
    .add(far.group.position);
  const meterOut = fromWall(2.2, 2.0, 0.2);
  const service = createSpan(meterOut, drop, 0.5, {
    radius: 0.04,
    color: 'ink',
    repeat: 1.2,
    speed: 1.6,
    power: 0,
  });
  // reactive exchange: a thin companion of the service cable with dashed `sky` pulses (DECISIONS §38)
  const reactive = createSpan(
    meterOut.clone().setY(meterOut.y - 0.16),
    drop.clone().setY(drop.y - 0.16),
    0.5,
    {
      radius: 0.022,
      color: 'slate',
      pulseColor: FLOW.reactive as unknown as string,
      repeat: 3.2,
      length: 0.25,
      speed: 1.6,
      power: 0,
    },
  );
  const street = createSpan(drop, farTop, 0.35, {
    radius: 0.04,
    color: 'ink',
    repeat: 1.0,
    speed: 1.6,
    power: 0.7,
  });
  group.add(w.group, pole.group, far.group, box, gl, perch, tick, service, reactive, street);

  const arm = w.part('arm');
  let safe = 0;
  return {
    group,
    inverter,
    wires: { toRelay, toMeter, service, reactive, street },
    // open: the bridge hangs away from the second contact; closed: it lies across both
    setRelay: (closed) => (arm.rotation.z = 0.75 * (1 - closed)),
    setSync(inSync) {
      syncLamp.setColor(inSync ? 'green' : 'red');
    },
    setGrid(on) {
      gridLamp.setColor(on ? 'green' : 'red');
      street.material.power = on ? 0.7 : 0;
      far.night = on ? 1 : 0;
    },
    setSafe: (v) => (safe = v),
    setLit: (on) => (w.night = on),
    update(dt, t) {
      man.update(dt, t);
      tickMat.intensity = 1.9 * safe;
      tick.scale.setScalar(0.001 + safe * (1 + 0.08 * Math.sin(t * 4)));
      syncLamp.intensity = 1.5 + 0.4 * Math.sin(t * 5);
    },
    points: {
      inverter: fromWall(-0.55, 3.05, 0.3),
      relay: fromWall(0.55, 2.3, 0.4),
      meter: fromWall(1.85, 2.3, 0.4),
      window: fromWall(-1.75, 3.6, 0.2),
      lineman: new Vector3(3.8, 3.45, 0.6),
      pole: drop.clone(),
      gridSwitch: new Vector3(3.15, 1.5, 0.75),
      service: meterOut.clone().lerp(drop, 0.5).setY(2.35),
    },
  };
}
