/**
 * One station of the `upsShelf` (step 10): a UPS tower feeding a small PC with its monitor, a glass tube
 * showing the charge left in the PC power supply's hold-up capacitor, and a scope over the desk that writes
 * the UPS output. `apply(unit)` sets everything from the session's unit state.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { createScope, createWire, type Scope, type Wire } from '@/fx';
import { Builder, levelTube, type LevelTube } from '@/kit';
import { K, SEMANTIC, col, type ColorToken, type KGlowMaterial } from '@/style';
import type { UpsUnit } from '../sim-bindings/ups-session';

export interface UpsStation {
  group: Group;
  scope: Scope;
  reserve: LevelTube;
  wires: { mains: Wire; out: Wire };
  apply(u: UpsUnit, t: number): void;
  points: { ups: Vector3; pc: Vector3; scope: Vector3; reserve: Vector3 };
}

export function createUpsStation(accent: ColorToken): UpsStation {
  const b = new Builder('ups-station');
  // desk
  b.box(2.5, 0.1, 1.5, { r: 0.04, c: ['slate', 'steel'], at: [0, 0.5, 0] });
  for (const x of [-1.1, 1.1]) b.box(0.1, 0.5, 1.3, { r: 0.03, slot: 'metal', c: 'slate', at: [x, 0, 0] });
  // UPS tower on the floor to the left: dark body, accent stripe, vents
  b.box(0.55, 1.0, 1.0, { r: 0.06, slot: 'gloss', c: ['ink', 'slate'], at: [-1.75, 0, 0.1] });
  b.box(0.56, 0.08, 1.01, { r: 0.02, slot: 'gloss', c: accent, at: [-1.75, 0.78, 0.1] });
  for (let i = 0; i < 4; i++)
    b.box(0.3, 0.025, 0.02, { r: 0, c: 'steel', at: [-1.75, 0.15 + i * 0.07, 0.61] });
  b.box(0.3, 0.2, 0.02, { r: 0.02, slot: 'gloss', c: 'ink', at: [-1.75, 0.5, 0.61] });
  // PC: small tower on the desk, monitor with its stand, keyboard
  b.box(0.36, 0.7, 0.7, { r: 0.04, slot: 'gloss', c: ['slate', 'mist'], at: [0.85, 0.6, -0.15] });
  b.box(0.2, 0.03, 0.02, { r: 0, slot: 'glow', c: 'cyan', at: [0.85, 1.15, 0.21] });
  b.box(0.5, 0.04, 0.3, { r: 0.02, slot: 'metal', c: 'slate', at: [-0.2, 0.6, -0.2] });
  b.box(0.1, 0.34, 0.06, { r: 0.02, slot: 'metal', c: 'slate', at: [-0.2, 0.62, -0.25] });
  b.box(1.3, 0.82, 0.07, { r: 0.04, slot: 'gloss', c: 'ink', at: [-0.2, 0.9, -0.2] });
  b.box(0.8, 0.03, 0.26, { r: 0.012, slot: 'gloss', c: 'mist', at: [-0.2, 0.6, 0.4] });
  const model = b.build();
  const group = new Group();
  group.name = 'ups-station';
  group.add(model.group);

  // screen (the "desktop"), the UPS's battery bars and its front display: own materials
  const screenMat = K.glow({ color: 'sky', intensity: 1.1, whiten: 0.1, keepHue: true, falloff: 0 });
  const screen = new Mesh(new BoxGeometry(1.18, 0.7, 0.02), screenMat);
  screen.position.set(-0.2, 1.31, -0.155);
  const iconMat = K.glow({ color: 'white', intensity: 1.3, falloff: 0 });
  const icons = new Mesh(new BoxGeometry(0.1, 0.1, 0.01), iconMat);
  icons.position.set(-0.62, 1.52, -0.14);
  const batMat: KGlowMaterial = K.glow({
    color: 'lime',
    intensity: 0.15,
    whiten: 0,
    keepHue: true,
    falloff: 0,
  });
  const bat = new Mesh(new BoxGeometry(0.24, 0.06, 0.02), batMat);
  bat.position.set(-1.75, 0.6, 0.63);
  group.add(screen, icons, bat);

  const reserve = levelTube({ height: 0.7, radius: 0.06, color: 'sky', level: 1, ticks: 4 });
  reserve.group.position.set(0.42, 0.6, 0.35);
  const scope = createScope({
    width: 2.4,
    height: 1.25,
    channels: [SEMANTIC.current],
    samples: 260,
    lineWidth: 0.03,
  });
  scope.position.set(-0.3, 3.0, -0.3);
  group.add(reserve.group, scope);

  const wire = (pts: Vector3[]): Wire =>
    createWire(pts, { radius: 0.035, color: 'ink', repeat: 2, speed: 1.2, power: 0, detail: 10 });
  const wires = {
    mains: wire([
      new Vector3(-1.75, 0.3, -1.3),
      new Vector3(-1.75, 0.25, -0.9),
      new Vector3(-1.75, 0.3, -0.42),
    ]),
    out: wire([
      new Vector3(-1.45, 0.25, 0.1),
      new Vector3(-0.6, 0.12, 0.5),
      new Vector3(0.5, 0.2, 0.3),
      new Vector3(0.85, 0.62, 0.22),
    ]),
  };
  group.add(wires.mains, wires.out);
  const dead = col('bg.void');
  return {
    group,
    scope,
    reserve,
    wires,
    apply(u, t) {
      const battery = u.source === 'battery';
      wires.mains.material.power = battery ? 0 : 0.8;
      wires.out.material.power = Math.abs(u.u) > 0.02 || !battery ? 0.8 : 0;
      batMat.intensity = battery ? 1.4 + 0.4 * Math.sin(t * 6) : u.source === 'avr' ? 0.5 : 0.15;
      reserve.level = u.reserve;
      reserve.setColor(u.reserve < 0.35 ? 'red' : 'sky');
      // alive: the desktop glows; dead: dark; booting: the blue screen fills up as the supply recovers
      if (u.pcAlive) {
        screenMat.setColor('sky');
        screenMat.intensity = 1.0 + 0.08 * Math.sin(t * 3);
        iconMat.intensity = 1.3;
      } else if (u.reserve <= 0.001) {
        screenMat.setColor(dead);
        screenMat.intensity = 0.02;
        iconMat.intensity = 0;
      } else {
        screenMat.setColor('blue');
        screenMat.intensity = 0.5 + 0.7 * u.reserve;
        iconMat.intensity = 0;
      }
    },
    points: {
      ups: new Vector3(-1.75, 1.15, 0.3),
      pc: new Vector3(-0.2, 1.85, -0.15),
      scope: new Vector3(-0.3, 3.75, -0.3),
      reserve: new Vector3(0.42, 1.38, 0.35),
    },
  };
}
