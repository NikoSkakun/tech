/**
 * The voltage ladder of step 9 (world units): two rails and seven rungs coloured along the voltage ramp (`coral`
 * 750 kV at the top → `pink` → `blue` 230 V at the bottom), a small transformer icon on each rung, the generator on a
 * side ledge at its own voltage (24 kV), the house at the foot, and a 750 kV line running off into the distance from
 * the top rung. `route()` is the path of the energy pulse: generator → up to the top rung → out along the line and
 * back → down rung by rung → house.
 */
import { Group, Vector3 } from 'three';
import { Builder, house, latticeTower, powerLine, turbogenerator } from '@/kit';
import { K, col, voltageRamp } from '@/style';
import { PORCELAIN } from './porcelain';

export interface Rung {
  id: string;
  y: number;
  /** 0…1 position on the voltage ramp. */
  t: number;
}
/** Rungs from the top: 750, 330, 110, 35, 10, 0,4 kV, the house at 230 V. */
export const RUNGS: readonly Rung[] = ['750', '330', '110', '35', '10', '0.4', '230'].map((id, i) => ({ id, y: 4.7 - i * 0.68, t: 1 - i / 6 }));
export const LADDER = { x: 0.6, half: 1.25 } as const;
const GEN_Y = 1.95;
/** Generator ledge centre (x), clear of the rung tags left of the ladder. */
export const GEN_X = -2.45;

export interface Ladder {
  group: Group;
  rungs: Group[];
  route(): Vector3[];
  /** Where on the route (0…1) each rung is passed. */
  marks: number[];
}

/**
 * Transformer icons of the rungs, one builder: the higher the class, the bigger the tank and the taller the grey
 * bushings (750 / 330 kV: radiator banks and a conservator; 0,4 kV: a pole-top can). Rung 0…5 = 750…0,4 kV.
 */
function icons(x: number): Builder {
  const b = new Builder('rung-icons');
  RUNGS.slice(0, 6).forEach((r, i) => {
    const k = 1.25 - i * 0.12;
    const y = r.y + 0.08;
    b.frame({ at: [x + 0.62, y, 0], s: k }, () => {
      if (i === 5) {
        // pole-top distribution can
        b.cyl(0.11, 0.26, { seg: 14, slot: 'gloss', c: 'mist' });
        for (let j = -1; j <= 1; j++) b.cyl(0.018, 0.08, { seg: 6, slot: 'gloss', c: PORCELAIN, at: [j * 0.06, 0.26, 0] });
        return;
      }
      b.box(0.4, 0.26, 0.24, { r: 0.04, slot: 'gloss', c: 'mist' });
      for (let j = 0; j < 4; j++) b.box(0.03, 0.2, 0.08, { r: 0.01, slot: 'metal', c: 'steel', at: [-0.14 + j * 0.093, 0.03, 0.15] });
      const h = 0.1 + (3 - Math.min(3, i)) * 0.07;
      for (let j = -1; j <= 1; j++) b.cyl(0.026, h, { seg: 8, slot: 'gloss', c: PORCELAIN, at: [j * 0.11, 0.26, 0.03] });
      if (i < 2) b.capsule(0.05, 0.22, { axis: 'x', seg: 10, slot: 'gloss', c: 'mist', at: [0.06, 0.38, -0.09] });
    });
  });
  return b;
}

export function createLadder(): Ladder {
  const group = new Group();
  const b = new Builder('ladder');
  const { x, half } = LADDER;
  for (const s of [-1, 1]) b.box(0.12, 5.2, 0.16, { r: 0.05, slot: 'metal', c: 'slate', at: [x + s * half, 0, 0] });
  b.box(2 * half + 0.6, 0.12, 0.9, { r: 0.05, slot: 'gloss', c: 'bg.indigo', at: [x, 0, 0] });
  group.add(b.build().group);
  const rungs = RUNGS.map((r) => {
    const g = new Group();
    const rb = new Builder(`rung-${r.id}`);
    rb.box(2 * half - 0.1, 0.16, 0.5, { r: 0.07, slot: 'gloss', c: voltageRamp(r.t), at: [0, -0.08, 0] });
    g.add(rb.build().group);
    g.position.set(x, r.y, 0);
    group.add(g);
    return g;
  });
  group.add(icons(x).build().group);
  // generator on its ledge, the house at the foot
  const ledge = new Builder('ledge');
  ledge.box(1.5, 0.16, 0.8, { r: 0.06, slot: 'gloss', c: voltageRamp(0.45), at: [GEN_X, GEN_Y - 0.16, 0] });
  ledge.box(0.12, GEN_Y - 0.16, 0.12, { r: 0.03, slot: 'metal', c: 'slate', at: [GEN_X, 0, 0] });
  group.add(ledge.build().group);
  const gen = turbogenerator({ cut: 0 });
  gen.group.scale.setScalar(0.1);
  gen.group.position.set(GEN_X, GEN_Y, 0);
  const home = house({ seed: 4 });
  home.night = 1;
  home.group.scale.setScalar(0.11);
  home.group.position.set(x + half + 1.0, 0.06, 0.3);
  group.add(gen.group, home.group);
  // a 750 kV line into the distance (back right), fed by a lead from the top rung
  const line = new Group();
  // nearer and larger than a backdrop: the 750 kV line is where the top rung's energy goes (low-detail towers)
  const LS = 0.062;
  const towers = [0, 1, 2].map((i) => {
    const t = latticeTower({ voltage: 750, low: true });
    t.group.position.set(i * 22, 0, -i * 46);
    t.group.rotation.y = 0.45;
    line.add(t.group);
    return t;
  });
  const energy = K.energy({ color: col('mist'), pulseColor: 'yellow', repeat: 0.05, speed: 12, power: 1.1 });
  line.add(powerLine(towers, { material: energy, radius: 0.35, segments: 16 }).group);
  line.scale.setScalar(LS);
  line.position.set(x + half + 1.45, 0, -1.7);
  group.add(line);
  const p0 = towers[0]!.anchorLocal(`${towers[0]!.phases[1]}.in`).multiplyScalar(LS).add(line.position);
  const lead = new Builder('lead');
  lead.tube([new Vector3(x + half, RUNGS[0]!.y, 0), new Vector3(x + half + 0.9, RUNGS[0]!.y - 0.2, -1.0), p0], 0.03, { seg: 6, slot: 'metal', c: 'mist' });
  group.add(lead.build().group);
  const pts: Vector3[] = [];
  const marks: number[] = [];
  pts.push(new Vector3(GEN_X, GEN_Y + 0.45, 0.4), new Vector3(x - half - 0.15, GEN_Y + 0.3, 0.4), new Vector3(x - half - 0.15, RUNGS[0]!.y + 0.2, 0.4));
  pts.push(new Vector3(x + half + 0.2, RUNGS[0]!.y + 0.2, 0.4), new Vector3(x + half + 1.0, RUNGS[0]!.y + 0.1, -0.6), new Vector3(x + half + 0.25, RUNGS[1]!.y + 0.2, 0.4));
  for (let i = 1; i < RUNGS.length; i++) pts.push(new Vector3(x + half + 0.25, RUNGS[i]!.y + 0.2, 0.4));
  pts.push(new Vector3(x + half + 1.0, 0.7, 0.5));
  // passing marks: proportional to the polyline length up to each rung's point
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  const total = lens[lens.length - 1]!;
  marks.push(lens[3]! / total, lens[5]! / total);
  for (let i = 2; i < RUNGS.length; i++) marks.push(lens[4 + i]! / total);
  return { group, rungs, route: () => pts.map((p) => p.clone()), marks };
}
