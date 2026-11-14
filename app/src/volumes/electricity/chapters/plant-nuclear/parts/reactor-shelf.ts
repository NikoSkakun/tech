/**
 * The gallery of step 10: seven stylised reactor cutaways at one scale on pedestals in an arc, each with its
 * coolant / moderator colours — PWR/VVER (water, `blue`), BWR (water boiling in the vessel: `white` bubbles),
 * PHWR/CANDU (horizontal calandria of heavy water, `sky`), RBMK (graphite stack `ink` with channels), fast
 * sodium (a pool of silvery sodium with a warm glow, no moderator), HTGR (graphite pebbles, helium),
 * SMR (a small module beside a truck for scale). Each model's `group` is posed by the step (selected = forward).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createBubbles, createHalo } from '@/fx';
import { Builder, G, vehicle, type KitModel } from '@/kit';

export const TYPES = ['pwr', 'bwr', 'candu', 'rbmk', 'fast', 'htgr', 'smr'] as const;
export type ReactorType = (typeof TYPES)[number];

function vesselShell(b: Builder, r: number, h: number, c: [string, string]): void {
  const s = G.revolve([[r - 0.12, 0], [r, 0], [r, h], [r - 0.12, h]], { phiStart: Math.PI / 2 + 0.7, phiLength: Math.PI * 2 - 1.4, seg: 28 });
  b.add(s.shell, { slot: 'metal', c: c as never });
  if (s.caps) b.add(s.caps, { slot: 'matte', c: 'slate.light' });
  b.dome(r, r * 0.5, { seg: 28, slot: 'metal', c: c[1] as never, at: [0, h, 0] });
}

function model(kind: ReactorType): KitModel {
  const b = new Builder(`type-${kind}`);
  b.cyl(2.4, 0.6, { seg: 40, slot: 'matte', c: ['slate', 'steel'] }); // pedestal
  const y = 0.6;
  if (kind === 'pwr' || kind === 'bwr') {
    vesselShell(b, 1.1, 3.6, ['steel', 'steel.light']);
    b.cyl(0.95, kind === 'bwr' ? 2.2 : 3.4, { seg: 24, slot: 'gloss', c: ['blue.dark', 'blue'], at: [0, y + 0.1, 0] });
    b.cyl(0.6, 1.4, { seg: 6, slot: 'glow', c: 'orange', at: [0, y + 0.6, 0] });
    if (kind === 'pwr') b.capsule(0.45, 2.2, { axis: 'z', seg: 16, slot: 'metal', c: 'steel.light', at: [1.7, y + 2.6, -1.1] }); // steam generator
    b.tube([new Vector3(0.9, y + 2.9, 0), new Vector3(1.7, y + 2.9, 0), new Vector3(1.7, y + 3.4, 0)], 0.14, { c: kind === 'pwr' ? 'sky' : 'white' });
  } else if (kind === 'candu') {
    b.capsule(1.3, 2.6, { axis: 'x', seg: 28, slot: 'glass', c: 'sky', at: [-1.3, y + 1.8, 0] });
    for (let i = 0; i < 9; i++) b.cyl(0.08, 4.2, { axis: 'x', seg: 8, slot: 'metal', c: 'steel', at: [-2.1, y + 1.0 + (i % 3) * 0.5, -0.5 + Math.floor(i / 3) * 0.5] });
  } else if (kind === 'rbmk') {
    b.box(3.4, 2.6, 3.4, { r: 0.1, slot: 'matte', c: ['ink', 'slate'], at: [0, y, 0] });
    for (let i = 0; i < 25; i++) b.cyl(0.12, 2.8, { seg: 8, slot: 'metal', c: i % 6 === 0 ? 'slate' : 'steel.light', at: [-1.2 + (i % 5) * 0.6, y, -1.2 + Math.floor(i / 5) * 0.6] });
  } else if (kind === 'fast') {
    vesselShell(b, 1.5, 3.0, ['steel', 'mist']);
    b.cyl(1.38, 2.4, { seg: 28, slot: 'metal', c: ['mist', 'mist.light'], at: [0, y + 0.1, 0] });
    b.cyl(0.55, 1.0, { seg: 6, slot: 'glow', c: 'orange', at: [0, y + 0.6, 0] });
  } else if (kind === 'htgr') {
    vesselShell(b, 1.1, 4.2, ['steel', 'steel.light']);
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996;
      const r = 0.85 * Math.sqrt((i % 10) / 10 + 0.05);
      b.sphere(0.14, { seg: 10, slot: 'gloss', c: i % 9 === 0 ? 'slate.light' : 'ink', at: [Math.cos(a) * r, y + 0.4 + Math.floor(i / 10) * 0.3, Math.sin(a) * r] });
    }
  } else {
    // SMR: a small module on a skid
    vesselShell(b, 0.55, 2.4, ['steel', 'steel.light']);
    b.cyl(0.45, 1.6, { seg: 20, slot: 'gloss', c: ['blue.dark', 'blue'], at: [0, y + 0.1, 0] });
    b.box(1.6, 0.2, 1.6, { r: 0.05, slot: 'metal', c: 'amber.dark', at: [0, y, 0] });
  }
  b.anchor('top', 0, 5.4, 0);
  return b.build();
}

export interface Shelf {
  group: Group;
  models: Record<ReactorType, KitModel>;
  home: Record<ReactorType, Vector3>;
  bubbles: ReturnType<typeof createBubbles>;
  glows: ReturnType<typeof createHalo>[];
}

export function buildShelf(ctx: ChapterContext): Shelf {
  const group = new Group();
  const floor = new Builder('gallery-floor');
  floor.cyl(21, 0.3, { seg: 64, slot: 'matte', c: ['bg.indigo', 'slate'], at: [0, -0.3, 0] });
  group.add(floor.build().group);
  const models = {} as Record<ReactorType, KitModel>;
  const home = {} as Record<ReactorType, Vector3>;
  TYPES.forEach((k, i) => {
    const a = ((i - 3) / 3) * 0.8; // an arc of ±0,8 rad around the camera axis
    home[k] = new Vector3(Math.sin(a) * 15, 0, 6 - Math.cos(a) * 15);
    const m = model(k);
    m.group.position.copy(home[k]);
    m.group.rotation.y = -a;
    models[k] = m;
    group.add(m.group);
  });
  // SMR: a truck beside the module, for scale
  const truck = vehicle('truck');
  truck.group.position.set(1.6, 0.6, 1.2);
  truck.group.scale.setScalar(0.42);
  truck.group.rotation.y = -0.6;
  models.smr.group.add(truck.group);
  const bubbles = createBubbles(ctx, { size: [1.4, 1.6, 1.4], radius: 0.06, rise: 0.8 });
  bubbles.position.set(0, 2.0, 0);
  models.bwr.group.add(bubbles);
  const glows = (['pwr', 'bwr', 'fast', 'htgr', 'candu', 'rbmk', 'smr'] as const).map((k) => {
    const h = createHalo({ color: 'orange', size: 2.8, intensity: 0.8 });
    h.position.set(0, 1.6, 0.4);
    models[k].group.add(h);
    return h;
  });
  return { group, models, home, bubbles, glows };
}
