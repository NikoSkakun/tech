/**
 * `FieldTable` — the hero of the chapter: a round glass table floating in "inner space". A steel rim with four
 * bracket "legs" (bolts, amber indicator lights) carries a glass top with a faint polar grid (5 cm rings), and a
 * soft violet floor disc glows far below it. The glass top and the grid are separate objects so that step 4 can
 * dissolve them into the potential landscape.
 */
import { CylinderGeometry, Group, Mesh, Vector3 } from 'three';
import { createHalo, RibbonLines } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K } from '@/style';
import { TABLE, toScene } from '../layout';

export interface FieldTable {
  group: Group;
  /** Rim, brackets, lights — always on screen. */
  frame: KitModel;
  /** Glass disc + grid (one group: a `fade` actor in `world.ts`). */
  top: Group;
  /** Indicator lights breathe; call every frame. */
  update(t: number): void;
}

function frameModel(): KitModel {
  const b = new Builder('field-table');
  const R = TABLE.radius;
  // rim: a chunky steel band around the glass with a lighter inner lip
  b.ring(R + 0.12, 0.2, { seg: 96, tubeSeg: 10, slot: 'metal', c: ['slate', 'steel'], at: [0, -0.08, 0] });
  b.ring(R - 0.06, 0.06, { seg: 96, tubeSeg: 6, slot: 'metal', c: 'steel.light', at: [0, 0.03, 0] });
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    b.frame({ at: [Math.cos(a) * (R + 0.1), -0.1, Math.sin(a) * (R + 0.1)], rot: [0, -a, 0] }, () => {
      // bracket: clamp on the rim, an arm sweeping down and inward, a pod with an indicator light
      b.box(0.7, 0.42, 0.9, { r: 0.1, slot: 'metal', c: ['slate', 'steel'], at: [0.05, -0.2, 0], mid: true });
      b.beam([0, -0.35, 0], [-0.9, -1.25, 0], 0.26, {
        h: 0.34,
        r: 0.08,
        slot: 'toon',
        c: ['bg.plum', 'slate'],
      });
      b.cyl(0.34, 0.5, {
        seg: 20,
        bevel: 0.08,
        slot: 'toon',
        c: ['bg.violet', 'slate'],
        at: [-0.95, -1.75, 0],
      });
      b.cyl(0.2, 0.1, { seg: 16, slot: 'glow', c: 'amber', at: [-0.95, -1.84, 0] });
      for (const z of [-0.28, 0.28])
        b.cyl(0.07, 0.06, { seg: 8, slot: 'metal', c: 'steel.light', at: [0.12, 0.0, z] });
      b.sphere(0.07, { seg: 10, slot: 'glow', c: 'amber', at: [0.42, -0.16, 0] });
    });
  }
  return b.build();
}

/** Polar grid on the glass: a ring every 5 cm and 12 spokes, one draw call. */
function grid(): RibbonLines {
  const lines: { points: Vector3[]; closed?: boolean }[] = [];
  for (let cm = 5; cm <= 15; cm += 5) {
    const r = toScene(cm / 100);
    const ring: Vector3[] = [];
    for (let i = 0; i < 72; i++)
      ring.push(new Vector3(Math.cos((i / 72) * Math.PI * 2) * r, 0, Math.sin((i / 72) * Math.PI * 2) * r));
    lines.push({ points: ring, closed: true });
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    lines.push({
      points: [
        new Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5),
        new Vector3(Math.cos(a) * (TABLE.radius - 0.3), 0, Math.sin(a) * (TABLE.radius - 0.3)),
      ],
    });
  }
  const g = new RibbonLines({
    capacity: 400,
    color: 'slate',
    width: 0.026,
    intensity: 0.75,
    dashStrength: 0,
    base: 1,
    endFade: [0, 0],
    blend: 'normal',
  });
  g.setLines(lines);
  g.position.y = 0.012;
  return g;
}

export function createTable(): FieldTable {
  const group = new Group();
  group.name = 'field-table';
  const frame = frameModel();
  const top = new Group();
  const glass = new Mesh(
    new CylinderGeometry(TABLE.radius, TABLE.radius, TABLE.thickness, 96),
    K.glass({ color: 'bg.violet', opacity: 0.42, edgeOpacity: 0.8 }),
  );
  glass.position.y = -TABLE.thickness / 2;
  glass.name = 'table-glass';
  top.add(glass, grid());
  // the soft floor disc of the mood description, far below the table
  const floor = createHalo({ color: 'bg.plum', size: 34, intensity: 0.55, billboard: false, amount: 0.05 });
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.2;
  group.add(frame.group, top, floor);
  const glow = frame.mats.has('glow') ? frame.mats.get('glow') : null;
  return {
    group,
    frame,
    top,
    update(t) {
      // slow breathing of the indicator lights (STYLE_GUIDE: something moves in every shot)
      if (glow && 'intensity' in glow)
        (glow as { intensity: number }).intensity = 1.5 + 0.35 * Math.sin(t * 1.7);
    },
  };
}
