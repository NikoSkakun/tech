/** Catalogue: industrial set — piping, handling, process equipment, machine hall. */
import { Builder, addPipe, addPump, addValve, conveyor, gantryCrane, heatExchanger, machineHall, pipeRack } from '@/kit';
import type { CatalogEntry } from './catalog-types';

export const INDUSTRIAL2: CatalogEntry[] = [
  {
    id: 'pipes-pump-valves',
    set: 'industrial',
    view: { az: 28, el: 18 },
    make: () => {
      const b = new Builder('pipes');
      addPump(b);
      addPipe(b, [[-1.5, 0.85, 0], [-4, 0.85, 0], [-4, 0.85, 4], [-7, 0.85, 4]], { radius: 0.24, color: 'blue', name: 'suction' });
      addPipe(b, [[-0.75, 1.95, 0.25], [-0.75, 3.5, 0.25], [5, 3.5, 0.25], [5, 3.5, 5], [5, 0.6, 5]], { radius: 0.2, color: 'sky', supportEvery: 4, name: 'discharge' });
      b.frame({ at: [-4, 0.85, 2.2] }, () => addValve(b, { radius: 0.24, kind: 'gate' }), 'v1.');
      b.frame({ at: [2.4, 3.5, 0.25], rot: [0, Math.PI / 2, 0] }, () => addValve(b, { radius: 0.2, kind: 'control' }), 'v2.');
      b.frame({ at: [5, 3.5, 2.8] }, () => addValve(b, { radius: 0.2, kind: 'butterfly' }), 'v3.');
      return b.build();
    },
  },
  { id: 'pipe-rack', set: 'industrial', view: { az: 35, el: 16 }, make: () => pipeRack() },
  { id: 'conveyor', set: 'industrial', view: { az: 50, el: 14 }, make: () => conveyor({ from: [0, 1.2, -12], to: [0, 9, 12] }) },
  {
    id: 'gantry-crane',
    set: 'industrial',
    view: { az: 30, el: 12 },
    make: () => {
      const c = gantryCrane();
      c.setTrolley(0.4);
      c.setHook(0.35);
      return c;
    },
  },
  { id: 'heat-exchanger', set: 'industrial', view: { az: 20, el: 16 }, make: () => heatExchanger() },
  { id: 'condenser', set: 'industrial', view: { az: 20, el: 16 }, make: () => heatExchanger({ kind: 'condenser', length: 10, radius: 1.8 }) },
  {
    id: 'machine-hall',
    set: 'industrial',
    view: { az: 25, el: 30 },
    make: () => {
      const h = machineHall();
      h.setOpen(true);
      h.setCrane(-0.4, 0.3);
      return h;
    },
  },
];
