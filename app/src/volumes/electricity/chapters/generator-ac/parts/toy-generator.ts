/**
 * The toy generator of step 1 (the closing shot of «Магнетизм»): a horseshoe magnet (N `coral` on the left,
 * S `blue` on the right, so **B** points along +X), a copper loop on a steel axle along Z between the pole
 * shoes, two slip rings with brushes at the front and an optional hand crank. Origin = centre of the base on
 * the floor. Part `loop` turns about Z: at angle θ the loop's normal is (cos θ, sin θ, 0) — θ = 0 means the
 * loop "faces" the pole (normal ∥ B, flux maximal, EMF zero).
 */
import { Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { COPPER } from '../world';

/** Height of the axle above the model origin, units. */
export const AXLE_Y = 3.0;
export const POLE_GAP = 1.05;
export const LOOP_HALF_H = 0.82;
export const LOOP_HALF_L = 0.55;
export const RING_Z = [1.35, 1.6] as const;
export const CRANK_Z = 2.05;
export const CRANK_R = 0.62;

export function createToyGenerator(): KitModel {
  const b = new Builder('toy-generator');
  // base board
  b.box(4.6, 0.28, 3.4, { r: 0.1, c: ['ink', 'slate'], at: [0, 0, 0.3] });
  b.box(4.3, 0.04, 3.1, { r: 0.02, c: 'bg.violet', at: [0, 0.28, 0.3] });

  // horseshoe: centre line of the U in the XY plane, split at the bottom into the N and S halves
  const R = 1.45;
  const cy = 2.05;
  const arc = (from: number, to: number): Vector3[] =>
    Array.from({ length: 13 }, (_, i) => {
      const a = from + ((to - from) * i) / 12;
      return new Vector3(Math.cos(a) * R, cy + Math.sin(a) * R, 0);
    });
  const left = [new Vector3(-R, AXLE_Y + 0.25, 0), ...arc(Math.PI, Math.PI * 1.5)];
  const right = [...arc(Math.PI * 1.5, Math.PI * 2), new Vector3(R, AXLE_Y + 0.25, 0)];
  b.add(G.tube(left, 0.38, { seg: 24 }), { c: ['coral.dark', 'coral'], slot: 'gloss' });
  b.add(G.tube(right, 0.38, { seg: 24 }), { c: ['blue.dark', 'blue'], slot: 'gloss' });
  // pole shoes facing each other across the gap
  for (const sign of [-1, 1] as const) {
    const w = R + 0.38 - POLE_GAP;
    b.box(w, 1.05, 1.3, {
      r: 0.12,
      mid: true,
      c: sign < 0 ? 'coral' : 'blue',
      slot: 'gloss',
      at: [sign * (POLE_GAP + w / 2), AXLE_Y, 0],
    });
    b.anchor(sign < 0 ? 'poleN' : 'poleS', sign * (R + 0.1), AXLE_Y + 0.75, 0);
  }
  // bearing posts in front of and behind the magnet, axle, slip rings and brushes
  for (const z of [-1.15, 1.05]) {
    b.box(0.32, AXLE_Y - 0.28, 0.32, { r: 0.06, c: ['slate', 'steel'], slot: 'metal', at: [0, 0.28, z] });
    b.cyl(0.2, 0.3, { axis: 'z', c: 'steel.light', slot: 'metal', at: [0, AXLE_Y, z - 0.15] });
  }
  for (const [i, z] of RING_Z.entries()) {
    // brushes: carbon blocks pressing from above, on a small insulating bridge
    b.box(0.14, 0.26, 0.12, { r: 0.03, c: 'ink', at: [0, AXLE_Y + 0.2, z] });
    b.box(0.08, 0.2, 0.08, { r: 0.02, c: 'steel', slot: 'metal', at: [0, AXLE_Y + 0.46, z] });
    b.anchor(`brush${i}`, 0, AXLE_Y + 0.62, z);
  }
  b.box(0.5, 0.1, 0.6, { r: 0.04, c: 'slate', at: [0, AXLE_Y + 0.66, (RING_Z[0] + RING_Z[1]) / 2] });
  b.box(0.12, AXLE_Y + 0.4, 0.12, { r: 0.03, c: 'slate', at: [0.32, 0.28, (RING_Z[0] + RING_Z[1]) / 2] });
  b.anchor('rings', 0, AXLE_Y, (RING_Z[0] + RING_Z[1]) / 2);
  b.anchor('leads', 0, AXLE_Y + 0.72, (RING_Z[0] + RING_Z[1]) / 2);

  // the rotating loop (with axle, slip rings and the leads along the axle)
  const loop = b.part('loop', { at: [0, AXLE_Y, 0] });
  loop.cyl(0.07, 3.3, { axis: 'z', c: 'steel.light', slot: 'metal', at: [0, 0, -1.45] });
  for (const z of RING_Z) loop.cyl(0.21, 0.12, { axis: 'z', c: COPPER, slot: 'metal', at: [0, 0, z - 0.06] });
  loop.cyl(0.15, 0.6, { axis: 'z', c: 'ink', at: [0, 0, RING_Z[0] - 0.2] });
  const corners = [
    new Vector3(0, -LOOP_HALF_H, -LOOP_HALF_L),
    new Vector3(0, LOOP_HALF_H, -LOOP_HALF_L),
    new Vector3(0, LOOP_HALF_H, LOOP_HALF_L),
    new Vector3(0, -LOOP_HALF_H, LOOP_HALF_L),
  ];
  const mid = corners[3]!.clone().add(corners[0]!).multiplyScalar(0.5);
  for (const dx of [-0.06, 0.06]) {
    const pts = G.roundPath([mid, ...corners, mid].map((p) => p.clone().setX(dx)), 0.18, 6);
    loop.add(G.tube(pts, 0.07, { seg: 12, caps: false }), { c: COPPER, slot: 'metal' });
  }
  // leads from the loop to the rings, spokes holding the loop
  loop.rod([0, -0.12, LOOP_HALF_L], [0, -0.12, RING_Z[1]], 0.03, { c: COPPER, slot: 'metal' });
  loop.rod([0, 0.12, LOOP_HALF_L], [0, 0.12, RING_Z[0]], 0.03, { c: COPPER, slot: 'metal' });
  loop.rod([0, -LOOP_HALF_H, 0], [0, LOOP_HALF_H, 0], 0.035, { c: 'ink' });
  loop.anchor('top', 0, LOOP_HALF_H, 0);

  // the hand crank on the front end of the axle (shown in «Ручна ручка» mode)
  const crank = b.part('crank', { at: [0, AXLE_Y, CRANK_Z] });
  crank.cyl(0.13, 0.12, { axis: 'z', c: 'slate', slot: 'metal', at: [0, 0, -0.06] });
  crank.beam([0, 0, 0], [CRANK_R, 0, 0], 0.12, { h: 0.08, r: 0.03, c: 'steel', slot: 'metal' });
  crank.cyl(0.11, 0.4, { axis: 'z', c: 'amber', slot: 'gloss', at: [CRANK_R, 0, 0] });
  crank.anchor('knob', CRANK_R, 0, 0.25);
  return b.build();
}
