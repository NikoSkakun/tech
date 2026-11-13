/** Catalogue: grid set — distribution level (poles, consumer substations). */
import { Builder, distTransformer, distributionPole, kioskSubstation, poleSubstation, powerLine, type PoleOptions } from '@/kit';
import type { CatalogEntry } from './catalog-types';

const poleLine = (id: string, o: PoleOptions, span: number): CatalogEntry => ({
  id,
  set: 'grid',
  view: { az: 60, el: 10, zoom: 1.3 },
  make: () => {
    const b = new Builder(id);
    const poles = [-1, 0, 1].map((i) => {
      const p = distributionPole(o);
      p.group.position.set(0, 0, i * span);
      b.attach(p.group);
      return p;
    });
    b.attach(powerLine(poles, { sag: 0.025, radius: o.voltage === 0.4 && (o.sip ?? true) ? 0.07 : 0.035, color: o.voltage === 0.4 && (o.sip ?? true) ? 'ink' : undefined }).group);
    return b.build();
  },
});

export const GRID3: CatalogEntry[] = [
  poleLine('poles-10', { voltage: 10 }, 14),
  poleLine('poles-04-sip', { voltage: 0.4, lamp: true }, 12),
  poleLine('poles-04-wood', { voltage: 0.4, sip: false, kind: 'wood' }, 12),
  poleLine('poles-35', { voltage: 35 }, 18),
  { id: 'ktp', set: 'grid', view: { az: 25, el: 16 }, make: () => kioskSubstation() },
  {
    id: 'ktp-open',
    set: 'grid',
    view: { az: 12, el: 12 },
    make: () => {
      const m = kioskSubstation();
      m.part('doors').visible = false;
      return m;
    },
  },
  { id: 'pole-substation', set: 'grid', view: { az: 30, el: 10 }, make: () => poleSubstation() },
  { id: 'dist-transformer', set: 'grid', view: { az: 35, el: 20 }, make: () => distTransformer() },
];
