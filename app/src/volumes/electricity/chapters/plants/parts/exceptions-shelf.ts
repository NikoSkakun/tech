/**
 * The «shelf of exceptions» of step 2: a solar panel, a fuel cell stack and a battery — nothing in them turns.
 * Each sends a `cyan` stream of electrons (direct current) into a small inverter box whose output is a glowing
 * sine (alternating current). Built in metres at shelf scale (≈ 9 m long), origin = centre of the shelf base.
 */
import { CatmullRomCurve3, Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, pvModule, type KitModel } from '@/kit';

export interface Shelf {
  group: Group;
  model: KitModel;
  electrons: Flow;
  /** Local anchor points: panel, cell, battery, inverter. */
  at: Record<'panel' | 'cell' | 'battery' | 'inverter', Vector3>;
}

export function createShelf(ctx: ChapterContext): Shelf {
  const g = new Group();
  g.name = 'exceptions-shelf';
  const b = new Builder('shelf');
  b.box(10, 0.4, 3.2, { r: 0.12, at: [0, 1.6, 0], c: ['steel.dark', 'steel'], slot: 'matte' });
  for (const x of [-4.6, 4.6]) for (const z of [-1.3, 1.3]) b.box(0.3, 1.6, 0.3, { r: 0.06, at: [x, 0, z], c: 'slate', slot: 'metal' });
  // fuel cell stack: end plates + thin cells + tie rods
  b.box(0.3, 1.8, 1.6, { r: 0.05, at: [-0.9, 2.0, 0], c: 'steel', slot: 'metal' });
  b.box(0.3, 1.8, 1.6, { r: 0.05, at: [0.9, 2.0, 0], c: 'steel', slot: 'metal' });
  for (let i = 0; i < 9; i++) b.box(0.12, 1.6, 1.4, { r: 0.02, at: [-0.65 + i * 0.16, 2.1, 0], c: i % 2 ? 'mist' : 'sky.light', slot: 'gloss' });
  // battery: block with + (coral) and − (blue) terminals
  b.box(1.8, 1.4, 1.4, { r: 0.15, at: [2.6, 2.0, 0], c: ['lime.dark', 'lime'], slot: 'gloss' });
  b.cyl(0.16, 0.3, { at: [2.2, 3.4, 0], c: 'coral', slot: 'gloss' });
  b.cyl(0.16, 0.3, { at: [3.0, 3.4, 0], c: 'blue', slot: 'gloss' });
  // inverter: a small cabinet with a sine on its face
  b.box(1.6, 2.2, 1.2, { r: 0.18, at: [4.2, 2.0, -0.1], c: ['ink', 'slate'], slot: 'gloss' });
  const sine = Array.from({ length: 25 }, (_, i) => new Vector3(4.2 - 0.55 + (i / 24) * 1.1, 3.1 + Math.sin((i / 24) * Math.PI * 2) * 0.35, 0.52));
  b.tube(sine, 0.05, { c: 'yellow', slot: 'glow' });
  const model = b.build();
  g.add(model.group);
  const panel = pvModule({ detail: 'mid' });
  panel.group.scale.setScalar(1.25);
  panel.group.rotation.set(-0.9, 0, 0);
  panel.group.position.set(-3.4, 2.4, 0.2);
  g.add(panel.group);
  const at = {
    panel: new Vector3(-3.4, 3.6, 0),
    cell: new Vector3(0, 3.2, 0),
    battery: new Vector3(2.6, 3.6, 0),
    inverter: new Vector3(4.2, 4.0, 0),
  };
  const path = (from: Vector3): CatmullRomCurve3 =>
    new CatmullRomCurve3([from.clone().setZ(0.95), new Vector3(from.x, 4.6, 0.95), new Vector3(3.6, 4.6, 0.95), new Vector3(3.6, 3.3, 0.7)]);
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: [at.panel, at.cell, at.battery].map((p) => ({ path: path(p) })),
    count: 60,
    radius: 0.09,
    speed: 1.2,
    spread: 0.04,
  });
  g.add(electrons);
  return { group: g, model, electrons, at };
}
