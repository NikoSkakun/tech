/**
 * Step 4: the «ваги енергії» — three platform scales carrying the cells for the same energy in three
 * chemistries. The pan sinks on its spring, the needle of a logarithmic dial (1 … 1000 kg, decades numbered)
 * turns with the mass and a digital window beside it shows the exact figure; the block on the pan grows with
 * the mass (volume ∝ mass — toy densities, the step carries «не в масштабі»). A column floating above each
 * scale shows the specific energy.
 */
import { CylinderGeometry, type Group, Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder } from '@/kit';
import { K, SEMANTIC, type ColorLike } from '@/style';
import { Text3D } from '@/text';
import type { Mats } from '../world';
import { group, mesh, tag } from '../world';

export type ScaleKind = 'leadAcid' | 'lfp' | 'nmc';
/** Height at which the Wh/kg columns float (above the tallest block). */
const COLUMN_Y = 2.85;

/** A battery block ≈ 1 unit wide, standing on y = 0 (scaled by the mass later). */
function block(kind: ScaleKind): Group {
  const b = new Builder(`block-${kind}`);
  if (kind === 'leadAcid') {
    b.box(1.2, 0.72, 0.7, { r: 0.06, c: ['ink', 'slate'] });
    b.box(1.26, 0.1, 0.76, { at: [0, 0.72, 0], r: 0.04, c: 'slate' });
    for (let i = 0; i < 6; i++)
      b.cyl(0.06, 0.05, { at: [-0.45 + i * 0.18, 0.82, 0.14], seg: 14, slot: 'gloss', c: 'yellow' });
    b.cyl(0.08, 0.13, { at: [-0.46, 0.82, -0.16], seg: 16, slot: 'metal', c: SEMANTIC.dcPlus });
    b.cyl(0.08, 0.13, { at: [0.46, 0.82, -0.16], seg: 16, slot: 'metal', c: SEMANTIC.dcMinus });
  } else if (kind === 'lfp') {
    // four prismatic cells strapped together (4S = 12,8 V)
    for (let i = 0; i < 4; i++) {
      const x = -0.42 + i * 0.28;
      b.box(0.26, 0.8, 0.66, { at: [x, 0, 0], r: 0.035, slot: 'gloss', c: ['blue.dark', 'sky'] });
      b.cyl(0.045, 0.06, { at: [x, 0.8, -0.18], seg: 12, slot: 'metal', c: SEMANTIC.dcPlus });
      b.cyl(0.045, 0.06, { at: [x, 0.8, 0.18], seg: 12, slot: 'metal', c: SEMANTIC.dcMinus });
    }
    b.box(1.18, 0.07, 0.7, { at: [0, 0.3, 0], r: 0.02, c: 'ink' });
  } else {
    // a brick of cylindrical NMC cells in a holder
    b.box(1.0, 0.12, 0.62, { r: 0.04, c: 'ink' });
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 3; j++) {
        b.cyl(0.085, 0.66, {
          at: [-0.4 + i * 0.2, 0.1, -0.2 + j * 0.2],
          seg: 16,
          slot: 'gloss',
          c: ['violet.dark', 'violet'],
          bevel: 0.015,
        });
        b.cyl(0.04, 0.03, { at: [-0.4 + i * 0.2, 0.76, -0.2 + j * 0.2], seg: 10, slot: 'metal', c: 'mist' });
      }
    b.box(1.0, 0.06, 0.62, { at: [0, 0.6, 0], r: 0.02, c: 'ink' });
  }
  return b.build().group;
}

export interface PlatformScale {
  group: Group;
  /** The block on the pan (callout anchor). */
  block: Group;
  /** Top of the Wh/kg column behind the scale. */
  columnTop: Group;
  /** The digital window under the dial: the step writes the mass into it («125 kg»). */
  display: Text3D;
  /** Mass on the pan, kg (eased by the caller if wanted). */
  setMass(kg: number): void;
}

/** The dial is logarithmic: 1 kg … 1000 kg over a 270° sweep (the step's range is 0,4 … 1000 kg). */
const DIAL = {
  minKg: 1,
  maxKg: 1000,
  sweep: (270 * Math.PI) / 180,
  radius: 0.46,
  x: -0.36,
  y: 0.58,
  z: 0.68,
};
/** Rest height of the pan: above the dial, so the load is never hidden behind it. */
const PAN_Y = 1.22;
const TILT = -0.22;
const WINDOW_X = 0.52;
/** Clockwise angle from 12 o'clock of a mass on the dial, rad. */
const dialAngle = (kg: number): number => {
  const decades = Math.log10(DIAL.maxKg / DIAL.minKg);
  const k = Math.log10(Math.max(kg, 1e-3) / DIAL.minKg) / decades;
  return (Math.min(Math.max(k, -0.06), 1.03) - 0.5) * DIAL.sweep;
};

/**
 * `whPerKg` sets the height of the specific-energy column (250 Wh/kg = `columnMax` units).
 * Reference mass 125 kg = block scale 1.
 */
export function createPlatformScale(
  mats: Mats,
  kind: ScaleKind,
  color: ColorLike,
  whPerKg: number,
  columnMax = 1.5,
): PlatformScale {
  const g = group(`scale-${kind}`);
  const b = new Builder(`scale-body-${kind}`);
  b.box(1.7, 0.3, 1.25, { r: 0.1, c: ['bg.indigo', 'slate'] });
  // dial head: a round housing on the front edge, leaning back toward the viewer's eye line
  b.frame({ at: [DIAL.x, DIAL.y, DIAL.z], rot: [TILT, 0, 0] }, () => {
    const R = DIAL.radius;
    b.cyl(R + 0.07, 0.16, { at: [0, 0, -0.1], axis: 'z', seg: 56, c: ['slate', 'steel'], bevel: 0.03 });
    b.cyl(R, 0.02, { at: [0, 0, 0.055], axis: 'z', seg: 56, slot: 'flat', c: 'white' });
    b.ring(R + 0.035, 0.03, { at: [0, 0, 0.07], axis: 'z', seg: 56, slot: 'metal', c: 'steel.light' });
    // ticks: decades long and dark, 2× and 5× short
    for (let d = 0; d <= 3; d++)
      for (const m of d < 3 ? [1, 2, 5] : [1]) {
        const a = dialAngle(m * 10 ** d);
        const long = m === 1;
        const len = long ? 0.11 : 0.06;
        const r = R - 0.03 - len;
        b.box(long ? 0.03 : 0.018, len, 0.012, {
          at: [Math.sin(a) * r, Math.cos(a) * r, 0.08],
          rot: [0, 0, -a],
          r: 0,
          slot: 'flat',
          c: long ? 'ink' : 'slate',
        });
      }
  });
  // digital window beside the dial: the exact mass
  b.frame({ at: [WINDOW_X, 0.33, DIAL.z], rot: [TILT, 0, 0] }, () => {
    b.box(0.68, 0.34, 0.1, { at: [0, 0, -0.06], r: 0.05, c: ['slate', 'steel'] });
    b.box(0.62, 0.24, 0.02, { at: [0, 0.05, 0.04], r: 0.03, slot: 'flat', c: 'ink' });
  });
  g.add(b.build().group);
  const head = group('dial', DIAL.x, DIAL.y, DIAL.z);
  head.rotation.x = TILT;
  // decade numbers inside the tick ring, each growing inward from its tick (world-size text: ≈ 17 px-eq in
  // the step's shot)
  for (let d = 0; d <= 3; d++) {
    const a = dialAngle(10 ** d);
    const r = DIAL.radius - 0.17;
    const text = new Text3D(String(10 ** d), {
      font: 'mono',
      size: 0.105,
      color: 'ink',
      anchorX: a < 0 ? 'left' : 'right',
      anchorY: 'middle',
      halo: false,
    });
    text.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.09);
    head.add(text);
  }
  // The exact mass is a screen-space tag (constant on-screen size): it stays legible when a narrow window
  // makes the scene small, where world-size text on the plate would not.
  const display = tag('', 21, 'lime', 'mono');
  const window = group('window', WINDOW_X, 0.33, DIAL.z, [display]);
  window.rotation.x = TILT;
  display.position.set(0, 0.17, 0.08);
  const needle = group('needle', 0, 0, 0.1);
  needle.add(
    mesh(new RoundedBoxGeometry(0.04, DIAL.radius - 0.07, 0.02, 1, 0.008), mats.plus, 0, 0.13, 0, false),
    mesh(new CylinderGeometry(0.06, 0.06, 0.035, 20).rotateX(Math.PI / 2), mats.ink, 0, 0, 0.005, false),
  );
  head.add(needle);
  g.add(head, window);
  // pan on its spring column (the column slides into the base as the pan sinks)
  const pan = group('pan', 0, PAN_Y, 0);
  pan.add(mesh(new CylinderGeometry(0.78, 0.74, 0.07, 48), mats.light, 0, 0, 0));
  pan.add(mesh(new CylinderGeometry(0.1, 0.1, 0.9, 16), mats.steel, 0, -0.48, 0));
  const body = block(kind);
  body.position.y = 0.035;
  pan.add(body);
  g.add(pan);
  // specific-energy column floating above the scale (height ∝ Wh/kg), on a thin holographic base line
  const h = (whPerKg / 250) * columnMax;
  const column = new Mesh(
    new RoundedBoxGeometry(0.5, h, 0.5, 3, 0.09),
    K.toon({ color, emissive: color, emissiveIntensity: 0.35, gloss: 0.4 }),
  );
  column.position.set(0, COLUMN_Y + h / 2, 0);
  const baseLine = new Mesh(
    new CylinderGeometry(0.52, 0.52, 0.02, 40),
    K.glow({ color, intensity: 1.3, keepHue: true, whiten: 0, falloff: 0 }),
  );
  baseLine.position.y = COLUMN_Y - 0.03;
  g.add(baseLine);
  const columnTop = group('column-top', 0, COLUMN_Y + h, 0);
  g.add(column, columnTop);
  return {
    group: g,
    block: body,
    columnTop,
    display,
    setMass(kg) {
      // the pan sinks on its spring (toy law that saturates); the needle reads the mass on the log dial
      pan.position.y = PAN_Y - 0.2 * (kg / (kg + 90));
      needle.rotation.z = -dialAngle(kg);
      body.scale.setScalar(Math.min(Math.max(Math.cbrt(kg / 125), 0.22), 1.75) * 0.95);
    },
  };
}
