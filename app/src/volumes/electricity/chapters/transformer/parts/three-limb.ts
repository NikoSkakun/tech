/**
 * Step 7: the three-limb core close up (metres; the step scales it). Each limb carries its LV and HV winding cut
 * open at the front, a phase band in L1 / L2 / L3 colour on each coil, and a column of `magenta` flux orbs on the
 * limb face whose speed follows that limb's flux (up = positive). Below the core, the terminal board with the HV
 * terminals 1U 1V 1W and the LV terminals 2U 2V 2W 2N (studs as kit shapes, marks as world tags).
 */
import { Group, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { SEMANTIC, col } from '@/style';
import { ACTIVE, addCore, addLimbWindings, limbMid, limbX, limbY0 } from './active-part';
import { tag } from '../world';

const PHASE = [SEMANTIC.phaseL1, SEMANTIC.phaseL2, SEMANTIC.phaseL3] as const;
const CUT = 1.5;

export interface ThreeLimb {
  group: Group;
  model: KitModel;
  fluxes: Flow[];
  /** Terminal tags by name ('2N' is shown only with a neutral). */
  terminals: Record<string, Group>;
  /** Model-space point of a terminal (metres). */
  terminal(name: string): Vector3;
}

export function createThreeLimb(ctx: ChapterContext): ThreeLimb {
  const b = new Builder('three-limb');
  b.frame({ at: [0, 0.4, 0] }, () => {
    addCore(b);
    for (let k = 0; k < 3; k++) {
      addLimbWindings(b, limbX(k), 'both', CUT);
      // phase bands on top of the HV and LV coils
      const y = limbMid() + ACTIVE.windH / 2 + 0.01;
      b.ring(ACTIVE.hv[1] - 0.04, 0.05, { seg: 40, tubeSeg: 6, slot: 'gloss', c: PHASE[k]!, at: [limbX(k), y, 0] });
      b.ring(ACTIVE.lv[1] - 0.03, 0.04, { seg: 40, tubeSeg: 6, slot: 'gloss', c: PHASE[k]!, at: [limbX(k), y, 0] });
    }
  });
  // terminal board: a dark bar with 7 studs
  const terms: Record<string, Vector3> = {};
  const names = ['1U', '1V', '1W', '2U', '2V', '2W', '2N'];
  b.box(7.2, 0.35, 0.7, { r: 0.08, slot: 'gloss', c: col('slate').lerp(col('bg.indigo'), 0.3), at: [0, 0, 2.0] });
  names.forEach((n, i) => {
    const x = -3.0 + i * 1.0;
    const c = n.startsWith('1') ? 'coral' : n === '2N' ? 'blue' : 'sky';
    b.cyl(0.13, 0.25, { seg: 16, slot: 'metal', c, at: [x, 0.35, 2.0] });
    terms[n] = new Vector3(x, 0.85, 2.15);
  });
  const model = b.build();
  const group = new Group();
  group.add(model.group);
  const fluxes = [0, 1, 2].map((k) => {
    const x = limbX(k);
    const path = [new Vector3(x, 0.4 + limbY0() + 0.15, ACTIVE.limbR + 0.02), new Vector3(x, 0.4 + limbY0() + ACTIVE.limbH - 0.15, ACTIVE.limbR + 0.02)];
    const f = createFlow(ctx, { kind: 'pulse', color: 'magenta', paths: [{ path, closed: false }], count: 14, radius: 0.08, spread: 0.12, speed: 0, name: `limb-flux-${k}` });
    group.add(f);
    return f;
  });
  const terminals: Record<string, Group> = {};
  for (const n of names) {
    const g = new Group();
    const t = tag(n, 21, n.startsWith('1') ? 'coral' : 'sky');
    g.add(t);
    g.position.copy(terms[n]!);
    group.add(g);
    terminals[n] = g;
  }
  return { group, model, fluxes, terminals, terminal: (n) => terms[n]!.clone() };
}
