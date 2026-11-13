/** Catalogue: grid set — outdoor switchgear apparatus. */
import {
  Builder,
  addBreaker,
  addBusSupport,
  addCurrentTransformer,
  addDisconnector,
  addSurgeArrester,
  addVoltageTransformer,
  substation,
} from '@/kit';
import type { CatalogEntry } from './catalog-types';

const one = (id: string, fn: (b: Builder) => void, az = 32): CatalogEntry => ({
  id,
  set: 'grid',
  view: { az, el: 14, zoom: 1.2 },
  make: () => {
    const b = new Builder(id);
    fn(b);
    return b.build();
  },
});

export const GRID2: CatalogEntry[] = [
  one('breaker-110', (b) => addBreaker(b, { kV: 110 })),
  one('breaker-330', (b) => addBreaker(b, { kV: 330 }), 55),
  one('disconnector-110', (b) => addDisconnector(b, { kV: 110 }), 55),
  one('disconnector-330-open', (b) => addDisconnector(b, { kV: 330, open: 1 }), 55),
  one('ct-110', (b) => addCurrentTransformer(b, { kV: 110 })),
  one('vt-330', (b) => addVoltageTransformer(b, { kV: 330 })),
  one('arrester-330', (b) => addSurgeArrester(b, { kV: 330 })),
  one('bus-support-110', (b) => addBusSupport(b, { kV: 110 }), 55),
];

GRID2.push(
  {
    id: 'substation-110',
    set: 'grid',
    bare: true,
    view: { az: 35, el: 28, zoom: 1.5 },
    make: () => substation({ kV: 110, bays: [{ type: 'line' }, { type: 'transformer' }, { type: 'line', open: true }, { type: 'transformer' }] }),
  },
  {
    id: 'substation-330',
    set: 'grid',
    bare: true,
    view: { az: -40, el: 24, zoom: 1.5 },
    make: () => substation({ kV: 330, bays: [{ type: 'line' }, { type: 'transformer' }] }),
  },
);
