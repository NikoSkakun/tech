/**
 * Two kitchen-style scales for step 6: the small ferrite transformer of a high-frequency inverter (≈ 2 kg)
 * against the copper-and-steel 50 Hz toroid of a low-frequency one (≈ 28 kg). Same power, very different
 * iron: the core size goes with 1/f. The pans sink in proportion to the mass; each dial needle is a part.
 */
import { Group } from 'three';
import { Builder, type KitModel } from '@/kit';
import { col } from '@/style';
import type { Text3D } from '@/text';
import { COPPER, tag } from '../world';

export interface Scale {
  group: Group;
  model: KitModel;
  tag: Text3D;
  /** Selection ring / emphasis 0…1. */
  setFocus(on: boolean): void;
}

function scaleBase(b: Builder, kg: number): void {
  b.box(1.5, 0.32, 1.1, { r: 0.1, slot: 'gloss', c: ['slate', 'mist'] });
  // dial on the front: 0…30 kg, needle as a part
  b.cyl(0.26, 0.04, { axis: 'z', seg: 32, slot: 'gloss', c: 'white', at: [0, 0.16, 0.55] });
  for (let i = 0; i <= 6; i++) {
    const a = -2.2 + (i / 6) * 4.4;
    b.box(0.02, 0.06, 0.01, {
      r: 0,
      mid: true,
      c: 'ink',
      at: [Math.sin(a) * 0.2, 0.16 + Math.cos(a) * 0.2, 0.595],
      rot: [0, 0, -a],
    });
  }
  const needle = b.part('needle', { at: [0, 0.16, 0.6] });
  needle.box(0.025, 0.2, 0.012, { r: 0, c: 'red' });
  // pan on a short column; a heavier load pushes it lower
  const sink = Math.min(0.1, kg * 0.0035);
  b.cyl(0.1, 0.16 - sink, { seg: 14, slot: 'metal', c: 'steel', at: [0, 0.32, 0] });
  b.cyl(0.78, 0.06, { seg: 40, slot: 'metal', c: 'mist', at: [0, 0.48 - sink, 0] });
  b.anchor('pan', 0, 0.54 - sink, 0);
}

function build(name: string, kg: number, load: (b: Builder, y: number) => void, text: string): Scale {
  const b = new Builder(name);
  scaleBase(b, kg);
  const sink = Math.min(0.1, kg * 0.0035);
  load(b, 0.54 - sink);
  const model = b.build();
  model.part('needle').rotation.z = 2.2 - (Math.min(kg, 30) / 30) * 4.4;
  const label = tag(text, 26, 'white', 'mono');
  label.position.set(0, 2.25, 0);
  const group = new Group();
  group.name = name;
  group.add(model.group, label);
  return {
    group,
    model,
    tag: label,
    setFocus(on) {
      label.opacity = on ? 1 : 0.5;
      label.color = on ? 'yellow' : 'white';
    },
  };
}

/** Ferrite E-core transformer of the high-frequency design. */
export function createFerriteScale(text: string): Scale {
  return build(
    'scale-hf',
    2,
    (b, y) => {
      b.box(0.5, 0.09, 0.32, { r: 0.02, c: 'ink', at: [0, y, 0] });
      b.box(0.5, 0.09, 0.32, { r: 0.02, c: 'ink', at: [0, y + 0.33, 0] });
      for (const k of [-1, 1]) b.box(0.09, 0.26, 0.32, { r: 0.02, c: 'ink', at: [k * 0.205, y + 0.08, 0] });
      b.cyl(0.13, 0.24, { seg: 20, slot: 'metal', c: COPPER, at: [0, y + 0.09, 0] });
      b.box(0.18, 0.012, 0.34, { r: 0, c: 'yellow', at: [0, y + 0.42, 0] });
    },
    text,
  );
}

/** 50 Hz toroidal transformer of the low-frequency design: a steel core buried under copper, taped, bolted. */
export function createToroidScale(text: string): Scale {
  return build(
    'scale-lf',
    28,
    (b, y) => {
      b.ring(0.42, 0.25, {
        seg: 48,
        tubeSeg: 14,
        slot: 'gloss',
        c: col('slate').lerp(col('ink'), 0.3),
        at: [0, y + 0.25, 0],
      });
      for (let k = 0; k < 26; k++) {
        const phi = (k / 26) * Math.PI * 2;
        b.ring(0.262, 0.034, {
          axis: 'x',
          seg: 16,
          tubeSeg: 6,
          slot: 'metal',
          c: k % 6 === 0 ? 'yellow' : COPPER,
          at: [Math.cos(phi) * 0.42, y + 0.25, Math.sin(phi) * 0.42],
          rot: [0, -phi + Math.PI / 2, 0],
        });
      }
      b.cyl(0.16, 0.03, { seg: 20, slot: 'metal', c: 'steel', at: [0, y + 0.5, 0] });
      b.cyl(0.05, 0.56, { seg: 10, slot: 'metal', c: 'mist', at: [0, y, 0] });
    },
    text,
  );
}
