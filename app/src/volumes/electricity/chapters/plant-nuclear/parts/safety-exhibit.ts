/**
 * The safety exhibit of step 9. Left: the four barriers as nested cut-open shells around one pellet — pellet
 * (`slate`), fuel cladding (glass), vessel and primary circuit (`steel`), containment (concrete with its steel
 * liner); `spread` (0…1) moves them apart into an «exploded» view; one barrier can be highlighted. Right: the
 * safety systems — four hydro-accumulators (boric acid under nitrogen; their level drops when used), two
 * pumps, the sump tank, and three independent channels with diesel generators (frames coral / amber / sky,
 * numbered by colour) with exhaust puffs when running. A small model of the New Safe Confinement arch stands
 * at the back as the lesson of Chornobyl. Metres; origin = centre of the exhibit floor.
 */
import { Group, type Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createSmoke, type ParticleSystem } from '@/fx';
import { Builder, G, type KitModel } from '@/kit';
import { CHANNEL_COLORS } from './site';

const CUT = { phiStart: Math.PI / 2 + 0.75, phiLength: Math.PI * 2 - 1.5 }; // open toward +Z
export const BARRIER_IDS = ['pellet', 'clad', 'primary', 'containment'] as const;
export type BarrierId = (typeof BARRIER_IDS)[number];

function shell(name: string, r: number, h: number, t: number, slot: 'matte' | 'metal' | 'glass', c: string | [string, string], dome = true): KitModel {
  const b = new Builder(name);
  const sec: [number, number][] = [[r - t, 0], [r, 0], [r, h]];
  if (dome) for (let i = 1; i <= 8; i++) sec.push([Math.max(0.02, r * Math.cos((i / 8) * (Math.PI / 2))), h + r * 0.6 * Math.sin((i / 8) * (Math.PI / 2))]);
  if (dome) for (let i = 8; i >= 1; i--) sec.push([Math.max(0.02, (r - t) * Math.cos((i / 8) * (Math.PI / 2))), h + (r - t) * 0.6 * Math.sin((i / 8) * (Math.PI / 2))]);
  else sec.push([r - t, h]);
  const s = G.revolve(sec, { ...CUT, seg: 40 });
  b.add(s.shell, { slot, c: c as never });
  if (s.caps) b.add(s.caps, { slot: 'matte', c: 'slate.light' });
  return b.build();
}

export interface SafetyExhibit {
  group: Group;
  barriers: Record<BarrierId, KitModel>;
  /** Accumulator water levels (part per tank), 0…1. */
  setTanks(level: number): void;
  diesels: KitModel;
  smoke: ParticleSystem[];
  pellet: Mesh | Group;
  spread: number;
  update(): void;
  at: Record<BarrierId | 'tank' | 'channels' | 'sump' | 'nsc' | 'recombiner', Vector3>;
}

export function buildSafetyExhibit(ctx: ChapterContext): SafetyExhibit {
  const group = new Group();
  const floor = new Builder('safety-floor');
  floor.cyl(19, 0.4, { seg: 64, slot: 'matte', c: ['bg.indigo', 'slate'], at: [0, -0.4, 0] });
  group.add(floor.build().group);
  const bx = -9; // barriers stand left of centre
  const barriers: Record<BarrierId, KitModel> = {
    pellet: shell('b-pellet', 0.7, 1.4, 0.7, 'matte', ['slate', 'slate.light'], false),
    clad: shell('b-clad', 1.5, 3.2, 0.12, 'glass', 'mist'),
    primary: shell('b-primary', 3.2, 4.6, 0.35, 'metal', ['steel', 'steel.light']),
    containment: shell('b-containment', 6.2, 6.5, 0.9, 'matte', ['steel.light', 'mist']),
  };
  for (const id of BARRIER_IDS) {
    barriers[id].group.position.set(bx, 0, 0);
    barriers[id].group.scale.setScalar(1.35);
    group.add(barriers[id].group);
  }
  // safety systems on the right: accumulators, pumps, sump, three channels with diesels
  const sb = new Builder('safety-systems');
  const tanks: Group[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 4 + i * 2.6;
    sb.cyl(0.95, 5.2, { seg: 28, slot: 'glass', c: 'mist', at: [x, 0, -4] });
    sb.dome(0.95, 0.6, { seg: 28, slot: 'gloss', c: 'steel.light', at: [x, 5.2, -4] });
    sb.cyl(1.0, 0.3, { seg: 28, slot: 'metal', c: 'slate', at: [x, 0, -4] });
  }
  for (const [x, z] of [[5, 1.5], [8, 1.5]]) {
    sb.cyl(0.6, 1.0, { seg: 20, slot: 'metal', c: ['blue.dark', 'blue'], at: [x, 0, z] });
    sb.cyl(0.4, 0.8, { seg: 20, slot: 'gloss', c: 'blue', at: [x, 1.0, z] });
  }
  sb.box(4.2, 1.6, 2.4, { r: 0.15, slot: 'matte', c: ['slate', 'steel'], at: [11.5, 0, 1.8] });
  const systems = sb.build();
  group.add(systems.group);
  // water inside the accumulators (boric acid solution), scaled by `setTanks`
  const wb = new Builder('tank-water');
  for (let i = 0; i < 4; i++) {
    const p = wb.part(`w${i}`, { at: [4 + i * 2.6, 0.3, -4] });
    p.cyl(0.85, 4.2, { seg: 24, slot: 'gloss', c: ['blue.dark', 'blue'] });
  }
  const water = wb.build();
  for (let i = 0; i < 4; i++) tanks.push(water.part(`w${i}`));
  group.add(water.group);
  const db = new Builder('safety-diesels');
  for (let i = 0; i < 3; i++) {
    const x = 4 + i * 4;
    db.box(3.2, 2.4, 2.6, { r: 0.2, slot: 'matte', c: ['steel.light', 'mist'], at: [x, 0, 6] });
    db.box(3.4, 0.35, 2.8, { r: 0.1, slot: 'matte', c: CHANNEL_COLORS[i], at: [x, 2.4, 6] });
    for (let k = 0; k <= i; k++) db.sphere(0.18, { seg: 12, slot: 'glow', c: CHANNEL_COLORS[i], at: [x - 0.6 + k * 0.6, 1.4, 7.32] });
    db.cyl(0.18, 1.4, { seg: 10, slot: 'metal', c: 'slate', at: [x + 1, 2.4, 5.4] });
  }
  const diesels = db.build();
  group.add(diesels.group);
  const smoke = [0, 1, 2].map((i) => {
    const s = createSmoke(ctx, { radius: 0.25, height: 3, count: 40 });
    s.position.set(5 + i * 4, 3.8, 5.4);
    s.setEmitting(false, true);
    group.add(s);
    return s;
  });
  // the New Safe Confinement: a small arch on a plinth at the back
  const ab = new Builder('nsc');
  ab.box(6, 0.4, 3, { r: 0.1, slot: 'matte', c: 'slate', at: [0, 0, 0] });
  const arch = G.revolve([[2.6, 0], [2.8, 0], [2.8, 2.6], [2.6, 2.6]], { phiStart: 0, phiLength: Math.PI, seg: 28 });
  ab.add(arch.shell, { slot: 'metal', c: ['steel', 'mist'], at: [0, 0.4, -1.3], rot: [-Math.PI / 2, 0, 0] });
  const nsc = ab.build();
  nsc.group.position.set(13, 0, -9);
  group.add(nsc.group);
  const ex: SafetyExhibit = {
    group,
    barriers,
    diesels,
    smoke,
    pellet: barriers.pellet.group,
    spread: 0,
    setTanks(level) {
      for (const t of tanks) t.scale.y = Math.max(0.02, level);
    },
    update() {
      // exploded view: each outer shell moves back and to the side a little more than the one inside it
      BARRIER_IDS.forEach((id, i) => barriers[id].group.position.set(bx - i * 1.2 * ex.spread, 0, -i * 2.2 * ex.spread));
    },
    at: {
      pellet: new Vector3(bx, 2.2, 0.5),
      clad: new Vector3(bx + 1.6, 4.9, 0.8),
      primary: new Vector3(bx + 3.5, 7.3, 1.1),
      containment: new Vector3(bx + 6.2, 11, 1.6),
      tank: new Vector3(4, 6, -4),
      channels: new Vector3(8, 3.4, 6),
      sump: new Vector3(11.5, 2, 1.8),
      nsc: new Vector3(13, 4, -9),
      recombiner: new Vector3(bx - 4.2, 5.5, 0.5),
    },
  };
  return ex;
}
