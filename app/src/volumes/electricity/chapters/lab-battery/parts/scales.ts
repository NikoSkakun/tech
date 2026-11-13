/**
 * Step 4: the «ваги енергії» — three platform scales carrying the cells for the same energy in three
 * chemistries. A pan sinks on its spring and the dial needle turns with the mass; the block on the pan grows
 * with the mass (volume ∝ mass — toy densities, the step carries «не в масштабі»). A column floating above
 * each scale shows the specific energy.
 */
import { CylinderGeometry, type Group, Mesh } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder } from '@/kit';
import { K, SEMANTIC, type ColorLike } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';

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
  /** Mass on the pan, kg (eased by the caller if wanted). */
  setMass(kg: number): void;
}

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
  g.add(mesh(new RoundedBoxGeometry(1.7, 0.34, 1.25, 4, 0.1), mats.dark, 0, 0.17, 0));
  // dial on the front
  const face = new CylinderGeometry(0.36, 0.36, 0.06, 40);
  face.rotateX(Math.PI / 2);
  g.add(mesh(face, mats.white, 0, 0.5, 0.56, false));
  g.add(mesh(new RoundedBoxGeometry(0.9, 0.62, 0.16, 3, 0.07), mats.plinth, 0, 0.48, 0.5));
  const needle = group('needle', 0, 0.42, 0.6);
  needle.add(mesh(new RoundedBoxGeometry(0.03, 0.3, 0.02, 1, 0.01), mats.plus, 0, 0.14, 0, false));
  g.add(needle);
  // pan on a spring column
  const pan = group('pan', 0, 0.72, 0);
  pan.add(mesh(new CylinderGeometry(0.78, 0.74, 0.07, 48), mats.light, 0, 0, 0));
  pan.add(mesh(new CylinderGeometry(0.1, 0.1, 0.5, 16), mats.steel, 0, -0.27, 0));
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
    setMass(kg) {
      // spring: deflection saturates like a real bathroom scale's dial (toy law)
      const load = kg / (kg + 90);
      pan.position.y = 0.72 - 0.26 * load;
      needle.rotation.z = 1.25 - 2.5 * load;
      body.scale.setScalar(Math.min(Math.max(Math.cbrt(kg / 125), 0.22), 1.75) * 0.95);
    },
  };
}
