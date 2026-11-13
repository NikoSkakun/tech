/**
 * The «стрічка часу» of step 11: a curved track across the podium, 0…30 years, with a notch per year and a
 * label every five; `at(year)` gives the point and heading for the module that rides it. Next to it stands
 * the «пісочний годинник енергії»: its sand runs out during the first year — the energy payback time.
 * Units: stage units.
 */
import { CatmullRomCurve3, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, type Object3D, TubeGeometry, Vector3 } from 'three';
import { Builder, G, levelTube } from '@/kit';
import { K } from '@/style';
import type { Text3D } from '@/text';
import { shadows, tag } from '../world';

export const YEARS = 30;

export interface TimeRibbon {
  group: Group;
  labels: Text3D[];
  hourglass: Object3D;
  /** Point on the track for a year (0…30) and the track's direction there. */
  at(year: number, out?: Vector3): Vector3;
  heading(year: number): number;
  /** Sand left in the upper bulb, 0…1. */
  setSand(top: number): void;
  /** Years lived (0…30, fractional): lights the track up to there and stacks one energy token per paid-back year. */
  setYears(years: number, paybackYears: number): void;
}

export function createTimeRibbon(): TimeRibbon {
  const group = new Group();
  group.name = 'time-ribbon';
  const curve = new CatmullRomCurve3([new Vector3(-2.6, 0.06, -0.6), new Vector3(-1.45, 0.06, 0.35), new Vector3(-0.3, 0.06, 0.7), new Vector3(0.85, 0.06, 0.35), new Vector3(1.9, 0.06, -0.6)]);
  const b = new Builder('time-track');
  b.add(G.tube(curve.getSpacedPoints(80), 0.075, { seg: 10 }), { slot: 'gloss', c: 'sky' });
  const p = new Vector3();
  for (let y = 0; y <= YEARS; y++) {
    curve.getPointAt(y / YEARS, p);
    const major = y % 5 === 0;
    b.cyl(major ? 0.13 : 0.06, major ? 0.12 : 0.05, { seg: 14, slot: 'gloss', c: major ? 'white' : 'mist', at: [p.x, 0.02, p.z] });
  }
  group.add(shadows(b.build().group));
  // the lived part of the track glows (a slightly fatter tube drawn up to the current year)
  const SEG = 120;
  const lit = new Mesh(new TubeGeometry(curve, SEG, 0.095, 10, false), K.glow({ color: 'yellow', intensity: 0.9 }));
  lit.geometry.setDrawRange(0, 0);
  group.add(lit);
  const labels: Text3D[] = [];
  for (let y = 0; y <= YEARS; y += 5) {
    curve.getPointAt(y / YEARS, p);
    const t = tag(`${y}`, 18, 'white', 'display');
    t.position.set(p.x, 0.1, p.z + 0.42);
    labels.push(t);
    group.add(t);
  }

  // hourglass: two level tubes tip to tip in a frame (sand = `yellow`)
  const hg = new Group();
  // right of the track's end, on the floor: nothing rides over it and it covers no year mark
  hg.position.set(2.65, 0, 0.75);
  hg.scale.setScalar(0.9);
  const frame = new Builder('hourglass-frame');
  frame.cyl(0.42, 0.08, { seg: 28, slot: 'metal', c: 'steel' });
  frame.cyl(0.42, 0.08, { seg: 28, slot: 'metal', c: 'steel', at: [0, 1.62, 0] });
  for (const a of [0.6, 2.7, 4.8]) frame.cyl(0.035, 1.6, { seg: 8, slot: 'metal', c: 'steel.light', at: [Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36] });
  frame.cyl(0.07, 0.1, { seg: 14, slot: 'gloss', c: 'sky', at: [0, 0.8, 0] });
  hg.add(shadows(frame.build().group));
  const lower = levelTube({ height: 0.66, radius: 0.24, color: 'yellow', level: 0, caps: false, ticks: 0 });
  lower.group.position.y = 0.1;
  const upper = levelTube({ height: 0.66, radius: 0.24, color: 'yellow', level: 1, caps: false, ticks: 0 });
  upper.group.position.y = 0.9;
  hg.add(lower.group, upper.group);
  // beside the hourglass: one yellow token for every payback period lived — each is the energy of the module's making, given back
  const TOKENS = YEARS;
  const tokens = new InstancedMesh(new CylinderGeometry(0.2, 0.2, 0.055, 20), K.toon({ color: 'yellow', emissive: 'yellow', emissiveIntensity: 0.35 }), TOKENS);
  const m = new Matrix4();
  for (let i = 0; i < TOKENS; i++) {
    const col = Math.floor(i / 10);
    tokens.setMatrixAt(i, m.makeTranslation(-0.2 + col * 0.46, 0.03 + (i % 10) * 0.065, 0.62 + col * 0.06));
  }
  tokens.count = 0;
  tokens.castShadow = true;
  hg.add(tokens);
  group.add(hg);

  return {
    group,
    labels,
    hourglass: hg,
    at: (year, out = new Vector3()) => curve.getPointAt(Math.min(1, Math.max(0, year / YEARS)), out),
    heading(year) {
      const t = curve.getTangentAt(Math.min(1, Math.max(0, year / YEARS)), p);
      return Math.atan2(-t.z, t.x);
    },
    setSand(top) {
      upper.level = top;
      lower.level = 1 - top;
    },
    setYears(years, paybackYears) {
      const u = Math.min(1, Math.max(0, years / YEARS));
      lit.geometry.setDrawRange(0, Math.round(u * SEG) * 10 * 6);
      lit.visible = u > 0.002;
      tokens.count = Math.max(0, Math.min(TOKENS, Math.floor(years / paybackYears + 1e-6)));
    },
  };
}
