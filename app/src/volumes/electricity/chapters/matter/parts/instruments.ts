/**
 * Stylised instruments of step 5 (document: `Thermometer` / `ResistanceGauge`): a bulb thermometer whose
 * column follows the temperature (heat ramp colour) and a needle meter «ρ» on a small stand. Both are props —
 * the crystal stays the hero — so they are compact and sit to its right.
 */
import { Group, Mesh, Vector3 } from 'three';
import { Builder, G } from '@/kit';
import { heatRamp, K } from '@/style';

export interface Thermometer {
  group: Group;
  /** 0…1 column height. */
  level: number;
  /** 0…1 colour (cold → hot). */
  heat: number;
  top: Vector3;
  update(): void;
}

const TUBE_H = 2.2;

export function createThermometer(): Thermometer {
  const group = new Group();
  const b = new Builder('thermometer');
  b.cyl(0.32, 0.12, { seg: 32, c: ['bg.deep', 'slate'] });
  b.sphere(0.24, { slot: 'glass', at: [0, 0.38, 0] });
  b.cyl(0.11, TUBE_H, { seg: 24, slot: 'glass', at: [0, 0.5, 0] });
  for (let k = 0; k <= 8; k++)
    b.box(0.12, 0.018, 0.02, { r: 0, c: 'mist', at: [0.15, 0.62 + (k * (TUBE_H - 0.3)) / 8, 0.06] });
  group.add(b.build().group);
  const mat = K.toon({ color: 'red', emissive: 'red', emissiveIntensity: 0.5 });
  const bulb = new Mesh(G.sphere(0.18, 24), mat);
  bulb.position.y = 0.38;
  const column = new Mesh(G.cyl(0.055, 1, { seg: 16 }), mat);
  column.position.y = 0.5;
  group.add(bulb, column);
  const th: Thermometer = {
    group,
    level: 0.3,
    heat: 0.3,
    top: new Vector3(0, 0.5 + TUBE_H, 0),
    update() {
      column.scale.y = 0.1 + (TUBE_H - 0.25) * Math.min(Math.max(th.level, 0), 1);
      const c = heatRamp(0.15 + 0.85 * th.heat);
      mat.color.copy(c);
      mat.emissive.copy(c);
    },
  };
  return th;
}

export interface NeedleMeter {
  group: Group;
  /** 0…1 needle position. */
  value: number;
  face: Vector3;
  update(dt: number): void;
}

/** Round meter, face toward +z; the needle sweeps ±60° from the vertical. */
export function createNeedleMeter(): NeedleMeter {
  const group = new Group();
  const b = new Builder('rho-meter');
  b.box(0.16, 0.9, 0.16, { r: 0.05, c: ['bg.deep', 'slate'] });
  b.cyl(0.62, 0.2, { seg: 48, c: ['slate', 'steel'], axis: 'z', at: [0, 1.45, -0.1] });
  b.cyl(0.54, 0.04, { seg: 48, c: 'white', axis: 'z', at: [0, 1.45, 0.1] });
  // scale: green → amber → red ticks along the arc
  for (let k = 0; k <= 10; k++) {
    const a = (-60 + k * 12) * (Math.PI / 180);
    const tone = k < 5 ? 'green' : k < 8 ? 'amber' : 'red';
    b.box(0.03, 0.11, 0.02, {
      r: 0,
      slot: 'flat',
      c: tone,
      at: [Math.sin(a) * 0.42, 1.45 + Math.cos(a) * 0.42, 0.15],
      rot: [0, 0, -a],
      mid: true,
    });
  }
  group.add(b.build().group);
  const needle = new Group();
  needle.position.set(0, 1.45, 0.17);
  const blade = new Mesh(G.box(0.025, 0.46, 0.015), K.toon({ color: 'red' }));
  blade.position.y = 0.2;
  const hub = new Mesh(G.cyl(0.05, 0.04, { seg: 16 }).rotateX(Math.PI / 2), K.metal({ color: 'ink' }));
  needle.add(blade, hub);
  group.add(needle);
  let shown = 0;
  const meter: NeedleMeter = {
    group,
    value: 0,
    face: new Vector3(0, 1.45, 0.2),
    update(dt) {
      shown += (meter.value - shown) * Math.min(dt * 5, 1);
      needle.rotation.z = -(-Math.PI / 3 + ((2 * Math.PI) / 3) * Math.min(Math.max(shown, 0), 1));
    },
  };
  return meter;
}
