/**
 * Step 3 hero: an alkaline AA cell standing upright with a window cut into its can. Inside, the «ескалатор»:
 * the chemical reaction lifts charge from the «−» level at the bottom to the «+» level at the top (ℰ joules per
 * coulomb) — `coral` charges ride a staircase upward at a rate ∝ current. A potential scale stands beside the
 * cell (`blue` low → `pink` → `coral` high). Terminals are posts on the base, 2.24 apart like the lab supply's:
 * `plus` (+X) is strapped to the top cap, `minus` (−X) to the bottom.
 */
import { Vector3, type Group, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, G } from '@/kit';
import { SEMANTIC, voltageRamp } from '@/style';

export interface BatteryCutaway {
  group: Group;
  plus: Object3D;
  minus: Object3D;
  /** Middle of the window (hotspot). */
  inside: Object3D;
  top: Object3D;
  /** Top / bottom of the potential scale (tags). */
  scaleTop: Object3D;
  scaleBottom: Object3D;
  /** Charges lifted per second, scene units (∝ current). */
  lift: number;
  update(): void;
}

const H = 2.1;
const R = 0.62;

export function createBatteryCutaway(ctx: ChapterContext): BatteryCutaway {
  const b = new Builder('battery-cutaway');
  b.box(2.75, 0.1, 2.1, { at: [0, 0, 0.25], r: 0.04, c: ['ink', 'slate'] });
  // can with a window toward the camera (+Z); the cut faces get the lighter jacket colour
  const cut = { seg: 48, phiStart: Math.PI / 2 + 1.15, phiLength: Math.PI * 2 - 2.3 };
  const can = G.revolve(
    [
      [R - 0.07, 0],
      [R, 0],
      [R, H],
      [R - 0.07, H],
    ],
    cut,
  );
  b.add(can.shell, { slot: 'gloss', c: ['ink', 'amber'], at: [0, 0.14, 0] });
  if (can.caps) b.add(can.caps, { c: 'amber.light', at: [0, 0.14, 0] });
  // cathode mix (MnO₂, dark ring) hugging the can, zinc anode gel in the middle, brass collector pin
  const ring = G.revolve(
    [
      [R - 0.3, 0.06],
      [R - 0.08, 0.06],
      [R - 0.08, H - 0.1],
      [R - 0.3, H - 0.1],
    ],
    cut,
  );
  b.add(ring.shell, { c: 'slate', at: [0, 0.14, 0] });
  if (ring.caps) b.add(ring.caps, { c: 'steel', at: [0, 0.14, 0] });
  b.cyl(0.2, H - 0.3, { at: [0, 0.24, 0], seg: 28, c: ['steel', 'white'] });
  b.cyl(0.035, H - 0.2, { at: [0, 0.16, 0], seg: 10, slot: 'metal', c: 'amber' });
  b.cyl(R, 0.08, { at: [0, 0.1, 0], seg: 48, slot: 'metal', c: 'mist' }); // «−» bottom plate
  b.cyl(R, 0.07, { at: [0, 0.14 + H, 0], seg: 48, slot: 'metal', c: 'mist' }); // top cap
  b.cyl(0.2, 0.12, { at: [0, 0.2 + H, 0], seg: 24, slot: 'metal', c: 'mist' }); // «+» nub
  // straps to the posts: «+» from the top cap down the right side, «−» from the bottom plate
  b.tube([new Vector3(0, H + 0.26, 0), new Vector3(1.12, H + 0.1, 0.3), new Vector3(1.12, 0.3, 1.15)], 0.05, {
    c: SEMANTIC.dcPlus,
  });
  b.tube([new Vector3(-0.5, 0.14, 0.2), new Vector3(-1.12, 0.14, 0.7), new Vector3(-1.12, 0.2, 1.15)], 0.05, {
    c: SEMANTIC.dcMinus,
  });
  for (const s of [-1, 1] as const)
    b.cyl(0.1, 0.18, {
      at: [s * 1.12, 0.08, 1.15],
      seg: 18,
      slot: 'gloss',
      c: s > 0 ? SEMANTIC.dcPlus : SEMANTIC.dcMinus,
    });
  // the escalator: a staircase in the window
  const steps = 7;
  const stair: Vector3[] = [];
  for (let k = 0; k <= steps; k++) {
    const y = 0.34 + (k / steps) * (H - 0.46);
    const x = -0.26 + (k / steps) * 0.52;
    b.box(0.13, 0.035, 0.12, { at: [x, y - 0.06, R - 0.2], r: 0.01, slot: 'metal', c: 'steel.light' });
    stair.push(new Vector3(x, y + 0.05, R - 0.2));
  }
  // potential scale beside the cell
  b.box(0.14, H, 0.06, {
    at: [-0.98, 0.14, 0.1],
    r: 0.02,
    slot: 'flat',
    c: (p, _n, out) => void voltageRamp((p.y - 0.14) / H, out),
  });
  for (let k = 0; k <= 4; k++)
    b.box(0.26, 0.022, 0.03, { at: [-0.98, 0.14 + (k / 4) * (H - 0.02), 0.14], r: 0, c: 'white' });
  b.anchor('plus', 1.12, 0.16, 1.15)
    .anchor('minus', -1.12, 0.16, 1.15)
    .anchor('inside', 0.1, 0.14 + H * 0.55, R - 0.1);
  b.anchor('top', 0, 0.4 + H, 0)
    .anchor('scaleTop', -1.3, 0.2 + H, 0.14)
    .anchor('scaleBottom', -1.3, 0.0, 0.3);
  const model = b.build();
  const charges: Flow = createFlow(ctx, {
    kind: 'ion',
    color: SEMANTIC.dcPlus,
    paths: [{ path: stair }],
    count: 7,
    exactCount: true,
    radius: 0.075,
    speed: 0,
    endFade: 0.12,
    halo: false,
    seed: 'escalator',
  });
  model.group.add(charges);
  const self: BatteryCutaway = {
    group: model.group,
    plus: model.anchor('plus'),
    minus: model.anchor('minus'),
    inside: model.anchor('inside'),
    top: model.anchor('top'),
    scaleTop: model.anchor('scaleTop'),
    scaleBottom: model.anchor('scaleBottom'),
    lift: 0,
    update() {
      charges.speed = self.lift;
    },
  };
  return self;
}
