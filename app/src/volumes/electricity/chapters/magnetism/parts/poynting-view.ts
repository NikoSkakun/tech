/**
 * Energy flow in a simple circuit (step `maxwell`, view «Енергія»): a battery on the left, two long parallel
 * wires along +x (the + wire behind, the − wire in front, 0,7 apart) and a resistor joining them on the right.
 * **E** (`amber`) arcs run from the + wire to the − wire, **B** (`magenta`) rings circle each wire in opposite
 * senses, and the Poynting flux **S = E×H** (`yellow`) streams through the space between the wires from the
 * battery to the resistor and turns into it from the side. Electrons (`cyan`) in the wires barely crawl.
 * Densities follow `poyntingCircuit(U, R)`: E ∝ U, B ∝ I, S ∝ P.
 */
import { Group, Vector3 } from 'three';
import { createFlow, type Flow } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import type { ChapterContext } from '@/engine/api';
import { createBLines, type BLines } from './b-lines';
import { COPPER } from './coil';

const X0 = -1.4;
const X1 = 2.0;
const Y = 0.55;
const ZP = -0.35;
const ZM = 0.35;

export interface PoyntingView {
  group: Group;
  resistor: Vector3;
  e: BLines;
  b: BLines;
  s: BLines;
  electrons: Flow;
}

export function createPoyntingView(ctx: ChapterContext): PoyntingView {
  const g = new Group();
  const b = new Builder('poynting');
  // battery: a big cell lying across, + (coral) back, − (blue) front
  b.cyl(0.2, 0.38, { axis: 'z', at: [X0 - 0.3, Y, ZP - 0.05], seg: 28, c: SEMANTIC.dcPlus });
  b.cyl(0.2, 0.38, { axis: 'z', at: [X0 - 0.3, Y, ZP + 0.33], seg: 28, c: SEMANTIC.dcMinus });
  b.box(0.36, Y - 0.2, 0.36, { at: [X0 - 0.3, 0, 0], r: 0.04, c: 'slate' });
  for (const z of [ZP, ZM]) {
    b.rod([X0 - 0.1, Y, z], [X1, Y, z], 0.03, { slot: 'metal', c: COPPER });
    for (const x of [X0 + 0.4, (X0 + X1) / 2, X1 - 0.4]) b.rod([x, 0, z], [x, Y - 0.03, z], 0.018, { slot: 'metal', c: 'steel' });
  }
  // resistor across the ends
  b.box(0.22, 0.22, ZM - ZP - 0.12, { at: [X1, Y - 0.11, 0], r: 0.08, c: 'amber' });
  for (const z of [-0.12, 0, 0.12]) b.box(0.235, 0.235, 0.04, { at: [X1, Y - 0.117, z], r: 0.03, c: z === 0 ? 'red' : 'ink' });
  g.add(b.build().group);
  const e = createBLines(15 * 26, { color: SEMANTIC.fieldE, width: 0.018, dashSpeed: 0.4 });
  const arcs = [];
  for (const x of [-0.9, -0.3, 0.3, 0.9, 1.5]) {
    for (const h of [-0.12, 0, 0.12]) {
      const pts: Vector3[] = [];
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI;
        // from the + wire (back) to the − wire (front), fanning slightly up and down
        pts.push(new Vector3(x, Y + Math.sin(a) * h, ZP + ((ZM - ZP) * (1 - Math.cos(a))) / 2));
      }
      arcs.push({ points: pts });
    }
  }
  e.set(arcs);
  const bl = createBLines(12 * 34, { width: 0.018, dashSpeed: 0.4 });
  const rings = [];
  for (const x of [-0.6, 0.6, 1.6])
    for (const [z, sense] of [
      [ZP, -1],
      [ZM, 1],
    ] as const)
      for (const r of [0.12, 0.22]) {
        const pts: Vector3[] = [];
        for (let k = 0; k <= 32; k++) {
          // sense −1 turns +z → −y, i.e. positively about +x: the field of a current along +x
          const a = (k / 32) * Math.PI * 2 * sense;
          pts.push(new Vector3(x, Y + Math.sin(a) * r, z + Math.cos(a) * r));
        }
        rings.push({ points: pts, closed: true });
      }
  bl.set(rings);
  const s = createBLines(9 * 40, { color: SEMANTIC.current, width: 0.03, dashSpeed: 1.2, intensity: 1.5 });
  const streams = [];
  for (const [dy, dz] of [
    [0, 0],
    [0.14, -0.08],
    [-0.14, 0.08],
    [0.24, 0.05],
    [-0.24, -0.05],
  ]) {
    const pts: Vector3[] = [];
    for (let k = 0; k <= 36; k++) {
      const u = k / 36;
      const x = X0 + 0.1 + (X1 - X0 - 0.2) * u;
      // in the last fifth the flux bends into the resistor's side
      const into = Math.max(0, (u - 0.8) / 0.2);
      pts.push(new Vector3(x, Y + dy * (1 - into), dz * (1 - into)));
    }
    streams.push({ points: pts });
  }
  s.set(streams);
  const wirePath = [new Vector3(X0 - 0.1, Y, ZP), new Vector3(X1, Y, ZP), new Vector3(X1, Y, ZM), new Vector3(X0 - 0.1, Y, ZM)];
  const electrons = createFlow(ctx, { kind: 'electron', paths: [{ path: wirePath }], count: ctx.quality.count(40, 14), radius: 0.03, speed: -0.02 });
  g.add(e.mesh, bl.mesh, s.mesh, electrons);
  return { group: g, resistor: new Vector3(X1, Y + 0.2, 0), e, b: bl, s, electrons };
}
