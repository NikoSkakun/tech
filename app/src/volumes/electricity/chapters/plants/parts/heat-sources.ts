/**
 * The six «stoves» of step 7 that slide into the heat-source socket of the steam island: coal boiler, reactor with
 * steam generator, heat-recovery boiler of a combined cycle, molten-salt tank of a concentrating solar plant,
 * geothermal well, biomass boiler. Small Builder models (≈ 10 m), origin = centre of their footprint, the hot
 * steam outlet at `OUTLET` above it. Each carries its plant-type colour as an accent band.
 */
import { Group } from 'three';
import { createFlame, createGasFlame, createHalo } from '@/fx';
import { Builder, addSilo, addStack, addVerticalTank, type KitModel } from '@/kit';

export const SOURCE_IDS = ['coal', 'nuclear', 'hrsg', 'csp', 'geothermal', 'biomass'] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
export const OUTLET: [number, number, number] = [0, 13, 0];

function finish(b: Builder, extra: (g: Group) => void): Group {
  const m: KitModel = b.build();
  const g = new Group();
  g.add(m.group);
  extra(g);
  return g;
}

export function createSource(id: SourceId): Group {
  const b = new Builder(`src-${id}`);
  // the common steam header on top: the outlet every source connects to
  b.cyl(0.8, 2, { at: [0, OUTLET[1] - 2, 0], seg: 20, c: 'orange', slot: 'gloss' });
  switch (id) {
    case 'coal':
      b.box(8, 11, 7, { r: 0.4, c: ['slate', 'steel'], slot: 'matte' });
      b.box(8.2, 1, 7.2, { r: 0.2, at: [0, 8, 0], c: 'plantType.coal', slot: 'gloss' });
      b.frame({ at: [-6.5, 0, -2] }, () => addStack(b, { height: 22, radius: 1, bands: 2 }));
      b.dome(3, 1.6, { at: [5.6, 0, 3], slot: 'facet', c: ['ink', 'slate'] });
      return finish(b, (g) => {
        const f = createFlame({ height: 2.6, width: 4 });
        f.position.set(0, 0.4, 3.6);
        g.add(f);
      });
    case 'nuclear':
      b.cyl(5, 9, { seg: 40, c: ['mist', 'white'], slot: 'matte' });
      b.dome(5, 3.6, { at: [0, 9, 0], seg: 40, c: 'white', slot: 'gloss' });
      b.cyl(5.05, 0.8, { at: [0, 7, 0], seg: 40, c: 'plantType.nuclear', slot: 'gloss' });
      b.cyl(1.4, 7, { at: [6, 0, 0], seg: 24, c: ['steel', 'mist'], slot: 'metal' });
      return finish(b, (g) => {
        const h = createHalo({ color: 'sky', size: 7, intensity: 1 });
        h.position.set(0, 5, 5.2);
        g.add(h);
      });
    case 'hrsg':
      b.box(5, 12, 6, { r: 0.4, c: ['steel.dark', 'mist'], slot: 'matte' });
      b.box(9, 3, 3, { r: 0.4, at: [-7, 0, 0], c: ['pink.dark', 'pink'], slot: 'gloss' });
      b.cyl(1, 16, { at: [3.4, 0, -2], seg: 20, c: ['steel', 'white'], slot: 'matte' });
      return finish(b, (g) => {
        const f = createGasFlame({ height: 1, width: 0.6 });
        f.position.set(-5, 3.4, 1.6);
        g.add(f);
      });
    case 'csp':
      b.frame({ at: [0, 0, 0] }, () => addVerticalTank(b, { radius: 4.6, height: 8, color: 'amber.light', band: 'orange' }));
      b.cyl(0.6, 4, { at: [-6, 0, 0], seg: 16, c: 'steel', slot: 'metal' });
      b.box(4, 0.3, 2.4, { at: [-6, 4, 0], rot: [0.6, 0, 0], c: ['sky.dark', 'sky.light'], slot: 'gloss' });
      return finish(b, (g) => {
        const h = createHalo({ color: 'amber', size: 8, intensity: 1.2 });
        h.position.set(-6, 5, 0);
        g.add(h);
      });
    case 'geothermal':
      b.cyl(2.6, 1.2, { seg: 28, c: ['orange.dark', 'orange'], slot: 'matte' });
      b.cyl(0.9, 5, { at: [0, 1.2, 0], seg: 20, c: 'orange', slot: 'gloss' });
      b.cyl(2.2, 7, { at: [-5, 0, 1], seg: 24, c: ['steel', 'mist'], slot: 'matte' });
      b.cone(3, 4, { at: [0, -4, 0], tip: 0.3, seg: 24, c: ['orange.dark', 'bg.plum'], slot: 'facet', rot: [Math.PI, 0, 0] });
      return finish(b, () => undefined);
    case 'biomass':
      b.box(7, 10, 6, { r: 0.4, c: ['green.dark', 'green'], slot: 'matte' });
      b.frame({ at: [-6.5, 0, 0] }, () => addSilo(b, { radius: 2.2, height: 9, color: 'green.light' }));
      for (let i = 0; i < 6; i++) b.cyl(0.35, 2.6, { axis: 'x', at: [5.4, 0.4 + (i % 3) * 0.7, 2 + Math.floor(i / 3) * 0.7], seg: 10, c: 'wireBrown', slot: 'matte' });
      return finish(b, (g) => {
        const f = createFlame({ height: 2, width: 3 });
        f.position.set(0, 0.4, 3.2);
        g.add(f);
      });
  }
}
