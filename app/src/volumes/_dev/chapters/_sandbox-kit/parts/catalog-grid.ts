/** Catalogue: grid set. */
import { Builder, latticeTower, powerLine, powerTransformer, type TowerVoltage } from '@/kit';
import type { CatalogEntry } from './catalog-types';

const tower = (voltage: TowerVoltage, type: 'suspension' | 'tension' = 'suspension'): CatalogEntry => ({
  id: `tower-${voltage}${type === 'tension' ? '-tension' : ''}`,
  set: 'grid',
  view: { az: 28, el: 8, zoom: 1.25 },
  make: () => latticeTower({ voltage, type, angle: type === 'tension' ? 0.5 : 0 }),
});

export const GRID: CatalogEntry[] = [tower(110), tower(220), tower(330), tower(750), tower(330, 'tension'), tower(110, 'tension')];

const line = (voltage: TowerVoltage, span: number): CatalogEntry => ({
  id: `line-${voltage}`,
  set: 'grid',
  bare: true,
  view: { az: 62, el: 10, zoom: 1.6 },
  make: () => {
    const b = new Builder('line-demo');
    const towers = [-1, 0, 1].map((i) => {
      const t = latticeTower({ voltage, type: i === 1 ? 'tension' : 'suspension', angle: 0 });
      t.group.position.set(0, 0, i * span);
      b.attach(t.group);
      return t;
    });
    b.attach(powerLine(towers).group);
    b.box(40, 0.4, span * 2 + 30, { r: 0.2, slot: 'matte', c: 'green', at: [0, -0.4, 0] });
    return b.build();
  },
});

GRID.push(line(110, 60), line(330, 90), line(750, 120));

GRID.push(
  { id: 'transformer-330', set: 'grid', view: { az: 40, el: 18 }, make: () => powerTransformer({ hv: 330, lv: 110 }) },
  { id: 'transformer-110', set: 'grid', view: { az: -140, el: 18 }, make: () => powerTransformer({ hv: 110, lv: 10 }) },
  { id: 'transformer-750-1ph', set: 'grid', view: { az: 40, el: 18 }, make: () => powerTransformer({ hv: 750, lv: 330, phases: 1 }) },
);
