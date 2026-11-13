/**
 * Step 2, «Порівняти з гравітацією»: a logarithmic scale of forces with 40 "floors" (decades, 10⁻⁴⁸…10⁻⁸ N).
 * The electric attraction of a proton and an electron at the Bohr radius is a tower almost to the top; their
 * gravitational attraction is a speck near the ground — 39 floors lower (sim: `gravityComparison`).
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { fmtScale } from '@/content';
import { toOverlay } from '@/engine/api';
import { createElectron, createHalo, createProton } from '@/fx';
import { Builder } from '@/kit';
import { gravityComparison } from '@electricity/sim/charge-field';
import { K } from '@/style';
import { Text3D } from '@/text';
import { COULOMB } from '../layout';

const FLOORS = 40;
const BASE_EXP = -48;

export interface ForceTower {
  group: Group;
  /** Tops of the two columns (callout anchors, world space via the objects). */
  electricTop: Mesh;
  gravityTop: Mesh;
  /** Scene height of a force on the scale. */
  heightOf(forceN: number): number;
  update(dt: number, t: number): void;
}

export function createForceTower(): ForceTower {
  const cmp = gravityComparison();
  const h = COULOMB.floor;
  const heightOf = (f: number): number => (Math.log10(f) - BASE_EXP) * h;
  const group = new Group();
  group.name = 'force-tower';
  const b = new Builder('force-tower');
  b.cyl(1.5, 0.16, { seg: 40, bevel: 0.05, c: ['bg.plum', 'slate'], at: [0, -0.04, 0] });
  b.box(0.16, FLOORS * h + 0.3, 0.16, {
    r: 0.05,
    slot: 'metal',
    c: ['slate', 'steel.light'],
    at: [0, 0.1, 0],
  });
  for (let i = 0; i <= FLOORS; i++) {
    const major = i % 10 === 0;
    b.box(major ? 1.3 : i % 5 === 0 ? 0.8 : 0.5, 0.035, 0.07, {
      r: 0,
      slot: 'metal',
      c: major ? 'white' : 'steel',
      at: [0, 0.12 + i * h, 0.09],
    });
  }
  // the electric column: forty-odd glowing storeys
  const eh = heightOf(cmp.electricN);
  for (let i = 0; i * h < eh; i++) {
    const top = Math.min((i + 1) * h, eh);
    b.box(0.5, top - i * h - 0.03, 0.34, { r: 0.03, slot: 'glow', c: 'amber', at: [-0.52, 0.12 + i * h, 0] });
  }
  group.add(b.build().group);
  const dot = K.glow({ color: 'mist', whiten: 0.3, intensity: 1.6 });
  const gravityTop = new Mesh(new SphereGeometry(0.13, 16, 12), dot);
  gravityTop.position.set(0.52, 0.12 + heightOf(cmp.gravityN), 0);
  gravityTop.add(createHalo({ color: 'mist', size: 0.9, intensity: 0.8, amount: 0.3 }));
  const electricTop = new Mesh(
    new SphereGeometry(0.06, 8, 6),
    K.glow({ color: 'amber', keepHue: true, whiten: 0, intensity: 1.6 }),
  );
  electricTop.position.set(-0.52, 0.12 + eh, 0);
  group.add(gravityTop, electricTop);
  for (let i = 0; i <= FLOORS; i += 10) {
    const t = new Text3D(fmtScale(BASE_EXP + i, 'N'), {
      font: 'mono',
      size: 18,
      anchorX: 'left',
      anchorY: 'middle',
      color: 'white',
      billboard: true,
      screenSpace: true,
    });
    t.position.set(0.85, 0.12 + i * h, 0.1);
    group.add(t);
    toOverlay(t);
  }
  // the pair itself: an electron circling a proton in front of the scale
  const pair = new Group();
  const proton = createProton({ radius: 0.36 });
  const electron = createElectron({ radius: 0.16 });
  pair.add(proton, electron);
  pair.position.set(5.2, 1.7, 2.4);
  group.add(pair);
  group.position.copy(COULOMB.tower);
  const p = new Vector3();
  return {
    group,
    electricTop,
    gravityTop,
    heightOf,
    update(_dt, t) {
      p.set(Math.cos(t * 1.1) * 1.25, Math.sin(t * 1.1) * 0.35, Math.sin(t * 1.1) * 1.25);
      electron.position.copy(p);
      gravityTop.scale.setScalar(1 + 0.25 * Math.sin(t * 3.1));
    },
  };
}
