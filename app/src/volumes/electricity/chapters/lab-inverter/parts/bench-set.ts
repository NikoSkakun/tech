/**
 * The bench set shared by steps 1, 6 and 7: the opened inverter in the middle, its DC sources on the left (a
 * module «ЛМ-440» on a stand, the 48 V battery cabinet), the AC side on the right (a wall tile with a socket
 * and the phone charger — the inverter's mirror, a rectifier). Feeds: steady pulses on the DC cables, a sine
 * ribbon on the AC cable. Pure builder: steps drive the handles.
 */
import { CatmullRomCurve3, type Group, Vector3 } from 'three';
import { createScope, createWaveOnCurve, createWire, type Scope, type WaveOnCurve, type Wire } from '@/fx';
import { Builder, addPlug, addSchukoSocket, batteryCabinet, pvModule, type KitModel } from '@/kit';
import { SEMANTIC } from '@/style';
import type { Text3D } from '@/text';
import { OWN } from '../labels-own';
import { group, tag } from '../world';
import { PATHS } from './inverter-layout';
import { createInverterLive, type InverterLive } from './inverter-live';

/** Pose of the inverter on the bench (set space). */
export const INV = { scale: 0.82, x: 0.05, y: 0.07, z: 0.45 } as const;
/** Inverter model space → set space. */
export const invToSet = (p: Vector3, out = new Vector3()): Vector3 =>
  out.set(p.x * INV.scale + INV.x, p.y * INV.scale + INV.y, p.z * INV.scale + INV.z);

export interface BenchSet {
  group: Group;
  inv: InverterLive;
  module: KitModel;
  battery: ReturnType<typeof batteryCabinet>;
  wall: Group;
  /** Cables outside the inverter: PV → input A / B, battery ↔ port, AC out → socket. */
  feeds: { pvA: Wire; pvB: Wire; bat: Wire; ac: Wire };
  /** The oscillating AC ribbon over the output cable. */
  acWave: WaveOnCurve;
  dcScope: Scope;
  acScope: Scope;
  tags: { dc: Text3D; ac: Text3D };
  /** Anchor points in set space for callouts. */
  points: { module: Vector3; battery: Vector3; socket: Vector3; charger: Vector3 };
}

function socketWall(): { group: Group; socket: Vector3; charger: Vector3 } {
  const b = new Builder('socket-wall');
  b.box(2.0, 2.5, 0.18, { r: 0.06, slot: 'matte', c: ['slate', 'mist'], at: [0, 0, -0.09] });
  b.box(2.0, 0.22, 0.24, { r: 0.04, c: 'white', at: [0, 0, -0.08] }); // skirting board
  // two sockets (real size × 6.5): the upper one is free, the phone charger sits in the lower one
  b.frame({ at: [0, 1.55, 0], s: 6.5 }, () => addSchukoSocket(b));
  b.frame({ at: [0, 0.8, 0], s: 6.5 }, () => addSchukoSocket(b));
  b.frame({ at: [0, 0.8, 0.1], s: 6.5 }, () => addPlug(b, 'euro', 'white'));
  b.box(0.36, 0.36, 0.3, { r: 0.07, slot: 'gloss', c: 'white', at: [0, 0.62, 0.2] }); // charger body
  b.box(0.1, 0.03, 0.02, { r: 0, slot: 'glow', c: 'green', at: [0.08, 0.9, 0.36] });
  // the phone on the bench with its cable
  b.tube(
    [
      new Vector3(0, 0.66, 0.5),
      new Vector3(0.05, 0.3, 0.75),
      new Vector3(0.2, 0.05, 1.0),
      new Vector3(0.3, 0.05, 1.3),
    ],
    0.025,
    { c: 'white', seg: 8 },
  );
  b.box(0.42, 0.05, 0.8, { r: 0.02, slot: 'gloss', c: 'ink', at: [0.32, 0, 1.7], rot: [0, 0.3, 0] });
  b.box(0.36, 0.01, 0.72, { r: 0, slot: 'glow', c: 'sky', at: [0.32, 0.05, 1.7], rot: [0, 0.3, 0] });
  const model = b.build();
  return { group: model.group, socket: new Vector3(0, 1.55, 0.1), charger: new Vector3(0, 0.85, 0.4) };
}

function moduleStand(): Group {
  const b = new Builder('module-stand');
  for (const x of [-0.5, 0.5]) {
    b.beam([x, 0, 0.35], [x, 1.7, -0.3], 0.07, { c: 'steel', slot: 'metal', r: 0.02 });
    b.beam([x, 0, -0.6], [x, 1.2, -0.12], 0.06, { c: 'steel', slot: 'metal', r: 0.02 });
  }
  b.box(1.3, 0.06, 1.2, { r: 0.02, slot: 'metal', c: 'slate', at: [0, 0, -0.1] });
  return b.build().group;
}

export function createBenchSet(): BenchSet {
  const inv = createInverterLive();
  inv.group.scale.setScalar(INV.scale);
  inv.group.position.set(INV.x, INV.y, INV.z);

  // sources on the left: the module leans on its stand facing the viewer, the battery cabinet in front of it
  const module = pvModule({ detail: 'hero' });
  module.group.scale.setScalar(1.2);
  module.group.rotation.set(Math.PI / 2 - 0.36, 0, 0);
  const moduleAt = group('module', -4.55, 0, -0.95, [
    moduleStand(),
    group('tilt', 0, 1.02, 0, [module.group]),
  ]);
  moduleAt.rotation.y = 0.5;
  const battery = batteryCabinet();
  battery.group.scale.setScalar(1.45);
  const batteryAt = group('battery', -4.45, 0, 1.75, [battery.group]);
  batteryAt.rotation.y = 0.65;
  battery.setSoc(0.8);

  const sw = socketWall();
  const wall = group('socket-wall', 4.45, 0, -0.35, [sw.group]);
  wall.rotation.y = -0.6;
  const toSet = (local: Vector3): Vector3 =>
    local
      .clone()
      .applyAxisAngle(new Vector3(0, 1, 0), wall.rotation.y)
      .add(wall.position);
  const socket = toSet(sw.socket);
  const charger = toSet(sw.charger);

  // cables: from the sources to the inverter's terminals (first points of its internal paths), and out
  const pvA0 = invToSet(PATHS.pvA[0]);
  const pvB0 = invToSet(PATHS.pvB[0]);
  const bat0 = invToSet(PATHS.bat[0]);
  const out0 = invToSet(PATHS.out[PATHS.out.length - 1]!);
  const cable = (pts: Vector3[], radius = 0.045): Wire =>
    createWire(pts, { radius, color: 'ink', repeat: 1.3, speed: 1.3, power: 0.8, detail: 8 });
  const feeds = {
    pvA: cable([
      new Vector3(-3.95, 0.75, -0.95),
      new Vector3(-3.65, 0.12, -0.7),
      new Vector3(-3.4, 0.1, -0.42),
      pvA0,
    ]),
    pvB: cable([
      new Vector3(-4.2, 0.75, -0.8),
      new Vector3(-3.85, 0.1, -0.35),
      new Vector3(-3.5, 0.1, 0.05),
      pvB0,
    ]),
    bat: cable(
      [new Vector3(-4.05, 0.5, 1.75), new Vector3(-3.65, 0.12, 1.6), new Vector3(-3.4, 0.12, 1.38), bat0],
      0.06,
    ),
    ac: cable([out0, new Vector3(3.5, 0.12, 0.85), new Vector3(3.95, 0.5, 0.45), socket], 0.045),
  };
  // the AC ribbon: a sine travelling along the output cable (the DC cables keep their even pulses)
  const acCurve = new CatmullRomCurve3(
    [
      out0.clone().setY(0.55),
      new Vector3(3.5, 0.7, 0.85),
      new Vector3(3.9, 1.15, 0.5),
      socket.clone().setY(socket.y + 0.1),
    ],
    false,
    'centripetal',
  );
  const acWave = createWaveOnCurve(acCurve, {
    color: SEMANTIC.current,
    amplitude: 0.2,
    wavelength: 0.75,
    speed: 0.6,
    transverse: new Vector3(0, 1, 0),
    width: 0.05,
    taper: 0.15,
  });

  // two little scopes: «рівна лінія» over the sources, «синусоїда ±325 V» over the socket
  const dcScope = createScope({
    width: 1.7,
    height: 0.95,
    cycles: 2,
    frequency: 0.5,
    channels: [SEMANTIC.current],
    lineWidth: 0.055,
  });
  dcScope.setWave(0, () => 0.62);
  dcScope.position.set(-4.0, 2.95, 0.4);
  dcScope.rotation.y = 0.35;
  const acScope = createScope({
    width: 1.7,
    height: 0.95,
    cycles: 2,
    frequency: 0.5,
    channels: [SEMANTIC.current],
    lineWidth: 0.055,
  });
  acScope.setWave(0, Math.sin, 0.85);
  acScope.position.set(4.0, 2.95, 0.4);
  acScope.rotation.y = -0.4;
  const tags = { dc: tag(OWN.dcTag, 20, 'mist'), ac: tag(OWN.acTag, 20, 'mist') };
  tags.dc.position.set(-4.0, 3.65, 0.4);
  tags.ac.position.set(4.0, 3.65, 0.4);

  const set = group('set:bench', 0, 0, 0, [
    inv.group,
    moduleAt,
    batteryAt,
    wall,
    acWave,
    dcScope,
    acScope,
    tags.dc,
    tags.ac,
  ]);
  set.add(...Object.values(feeds));
  return {
    group: set,
    inv,
    module,
    battery,
    wall,
    feeds,
    acWave,
    dcScope,
    acScope,
    tags,
    points: {
      module: new Vector3(-4.8, 2.2, -0.9),
      battery: new Vector3(-4.45, 1.75, 1.75),
      socket,
      charger,
    },
  };
}
