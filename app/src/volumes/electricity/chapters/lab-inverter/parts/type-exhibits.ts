/**
 * The exhibits of step 9: five miniature power systems on round plinths — off-grid, string, micro-inverters,
 * central, hybrid. Each has the parts that type really has (battery or not, grid connection or not), wires
 * between them for the animated flows, a house whose window is lit while it has power, and a status light on
 * the inverter. `apply(flows)` sets the picture from `typeFlows(…)`.
 */
import { BoxGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { createWire, type Wire } from '@/fx';
import { Builder } from '@/kit';
import { K, col, type ColorToken, type KGlowMaterial } from '@/style';
import type { InverterType, TypeFlows } from '../sim-bindings/types-logic';
import { pickBox } from '../world';

export interface Exhibit {
  type: InverterType;
  group: Group;
  hit: Mesh;
  apply(f: TypeFlows): void;
  /** Local anchor points: top of the exhibit, the inverter, the grid pole. */
  points: { top: Vector3; inverter: Vector3; grid: Vector3 };
}

const CELL = col('bg.indigo').lerp(col('blue'), 0.3);
/** Accent of each exhibit (ring, inverter band). */
export const ACCENT: Record<InverterType, ColorToken> = {
  offgrid: 'lime',
  string: 'sky',
  micro: 'teal',
  central: 'orange',
  hybrid: 'violet',
};

function module(b: Builder, x: number, z: number, s = 1): void {
  b.box(0.42 * s, 0.03, 0.62 * s, { r: 0.01, slot: 'gloss', c: CELL, at: [x, 0.3 * s, z], rot: [0.6, 0, 0] });
  b.box(0.44 * s, 0.015, 0.64 * s, {
    r: 0.008,
    slot: 'metal',
    c: 'mist',
    at: [x, 0.29 * s, z - 0.005],
    rot: [0.6, 0, 0],
  });
  b.rod([x, 0.02, z - 0.18 * s], [x, 0.42 * s, z - 0.18 * s], 0.018, { slot: 'metal', c: 'steel' });
}

function house(b: Builder, x: number, z: number): void {
  b.box(0.5, 0.34, 0.42, { r: 0.03, slot: 'matte', c: ['mist', 'white'], at: [x, 0.02, z] });
  b.cone(0.44, 0.26, { seg: 4, slot: 'matte', c: 'coral', at: [x, 0.36, z], rot: [0, Math.PI / 4, 0] });
  b.box(0.1, 0.2, 0.02, { r: 0.01, c: 'wireBrown', at: [x - 0.12, 0.02, z + 0.21] });
}

function pole(b: Builder, x: number, z: number): void {
  b.cyl(0.03, 1.0, { seg: 10, slot: 'matte', c: 'steel', at: [x, 0.02, z] });
  b.box(0.36, 0.04, 0.04, { r: 0.01, c: 'slate', at: [x, 0.9, z] });
  for (const k of [-1, 0, 1]) b.cyl(0.025, 0.06, { seg: 8, c: 'white', at: [x + k * 0.14, 0.94, z] });
}

export function createExhibit(type: InverterType): Exhibit {
  const b = new Builder(`exhibit-${type}`);
  const hasBattery = type === 'offgrid' || type === 'hybrid';
  const hasGrid = type !== 'offgrid';
  const accent = ACCENT[type];
  b.cyl(1.05, 0.12, { seg: 56, c: ['bg.indigo', 'slate'] });
  b.cyl(0.95, 0.02, {
    seg: 56,
    slot: 'matte',
    c: col('green').lerp(col('bg.indigo'), 0.55),
    at: [0, 0.12, 0],
  });
  b.ring(1.0, 0.025, { seg: 64, slot: 'glow', c: accent, at: [0, 0.13, 0] });
  const inv = new Vector3(0, 0.14, 0.05);
  const y = 0.14;
  b.frame({ at: [0, y, 0] }, () => {
    if (type === 'central') {
      // a field of modules, a container-size inverter, a transformer kiosk at the grid
      for (const [x, z] of [
        [-0.7, -0.45],
        [-0.3, -0.45],
        [-0.7, 0.05],
        [-0.3, 0.05],
        [-0.7, 0.5],
        [-0.3, 0.5],
      ] as const)
        module(b, x, z, 0.62);
      b.box(0.56, 0.36, 0.3, { r: 0.03, slot: 'gloss', c: ['mist', 'white'], at: [0.18, 0.02, 0.05] });
      b.box(0.5, 0.06, 0.02, { r: 0, c: accent, at: [0.18, 0.28, 0.21] });
      b.box(0.24, 0.26, 0.22, { r: 0.03, slot: 'gloss', c: 'slate', at: [0.6, 0.02, -0.4] });
      inv.set(0.18, y + 0.2, 0.05);
    } else {
      const n = type === 'micro' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const x = -0.72 + i * 0.4 + (n === 2 ? 0.1 : 0);
        module(b, x, -0.5, 0.8);
        // micro-inverters: a small box under every module
        if (type === 'micro')
          b.box(0.16, 0.07, 0.1, { r: 0.02, slot: 'gloss', c: accent, at: [x, 0.03, -0.52] });
      }
      if (type !== 'micro') {
        b.box(0.07, 0.62, 0.3, { r: 0.02, slot: 'matte', c: 'slate', at: [0, 0.02, -0.05] });
        b.box(0.34, 0.44, 0.16, { r: 0.04, slot: 'gloss', c: ['mist', 'white'], at: [0, 0.14, 0.1] });
        b.box(0.34, 0.1, 0.165, { r: 0.03, slot: 'gloss', c: accent, at: [0, 0.14, 0.1] });
        inv.set(0, y + 0.36, 0.12);
      } else inv.set(-0.32, y + 0.08, -0.5);
    }
    if (hasBattery) {
      b.box(0.3, 0.5, 0.2, { r: 0.04, slot: 'gloss', c: ['mist', 'white'], at: [-0.55, 0.02, 0.45] });
      for (let i = 0; i < 3; i++)
        b.box(0.2, 0.05, 0.02, { r: 0, slot: 'glow', c: 'lime', at: [-0.55, 0.14 + i * 0.1, 0.56] });
    }
    house(b, 0.55, 0.42);
    if (hasGrid) pole(b, 0.65, -0.45);
  });
  const model = b.build();
  const group = new Group();
  group.name = `exhibit-${type}`;
  group.add(model.group);

  // window of the house and the inverter's status light: own materials
  const windowMat = K.glow({ color: 'yellow', intensity: 0.1, whiten: 0.2, keepHue: true, falloff: 0 });
  const pane = new Mesh(new BoxGeometry(0.24, 0.17, 0.02), windowMat);
  pane.position.set(0.63, y + 0.2, 0.635);
  const ledMat: KGlowMaterial = K.glow({
    color: 'green',
    intensity: 1.6,
    whiten: 0,
    keepHue: true,
    falloff: 0.3,
  });
  const led = new Mesh(new SphereGeometry(0.04, 10, 8), ledMat);
  led.position
    .copy(inv)
    .add(new Vector3(0.1, type === 'central' ? 0.1 : 0.14, type === 'central' ? 0.16 : 0.09));
  group.add(pane, led);

  const w = (pts: [number, number, number][]): Wire =>
    createWire(
      pts.map(([x, yy, z]) => new Vector3(x, y + yy, z)),
      { radius: 0.022, color: 'ink', repeat: 4, speed: 0.9, power: 0, detail: 12, castShadow: false },
    );
  const src: [number, number, number] =
    type === 'central' ? [-0.3, 0.05, 0.05] : type === 'micro' ? [-0.32, 0.05, -0.4] : [-0.5, 0.05, -0.35];
  const core: [number, number, number] =
    type === 'central' ? [0.18, 0.08, 0.05] : type === 'micro' ? [0.2, 0.05, -0.1] : [0, 0.12, 0.2];
  const wires = {
    pv: w([src, [(src[0] + core[0]) / 2, 0.04, (src[2] + core[2]) / 2 + 0.1], core]),
    house:
      type === 'central'
        ? w([
            [0.65, 0.9, -0.45],
            [0.62, 0.6, 0.0],
            [0.55, 0.36, 0.3],
          ])
        : w([core, [0.3, 0.04, 0.4], [0.5, 0.1, 0.62]]),
    grid: hasGrid ? w([core, [0.45, 0.3, -0.25], [0.65, 0.9, -0.45]]) : null,
    bat: hasBattery ? w([[-0.4, 0.1, 0.45], [-0.2, 0.04, 0.35], core]) : null,
  };
  for (const x of Object.values(wires)) if (x) group.add(x);
  const hit = pickBox(2.1, 1.4, 2.1, 0, 0.8, 0);
  group.add(hit);
  const set = (wire: Wire | null, v: number): void => {
    if (!wire) return;
    wire.material.power = Math.abs(v) * 0.9;
    wire.material.speed = Math.sign(v || 1) * Math.abs(wire.material.speed);
  };
  return {
    type,
    group,
    hit,
    apply(f) {
      set(wires.pv, f.pv);
      set(wires.house, f.house);
      set(wires.grid, f.grid);
      set(wires.bat, f.bat);
      windowMat.intensity = f.houseLit ? 1.8 : 0.05;
      ledMat.setColor(f.running ? 'green' : 'red');
      ledMat.intensity = f.running ? 1.7 : 1.0;
    },
    points: {
      top: new Vector3(0, 1.35, 0),
      inverter: inv.clone().setY(inv.y + 0.25),
      grid: new Vector3(0.65, y + 1.05, -0.45),
    },
  };
}
