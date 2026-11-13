/**
 * The water analogy of step 3 — the same circuit as pipes: glass pipes along the very routes of the leads
 * (water = current), a centrifugal pump where the source stands (pressure difference = voltage; its gauge
 * follows ℰ), and a narrow section with a paddle wheel where the lamp stands (resistance; the wheel takes the
 * energy). Flow speed and both wheels' rotation ∝ current.
 */
import { Group, Mesh, Vector3, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow } from '@/fx';
import { Builder, G } from '@/kit';
import type { Mats } from '../world';

export interface WaterLoop {
  group: Group;
  /** Hotspot / callout anchors. */
  pump: Object3D;
  gauge: Object3D;
  wheel: Object3D;
  /** Water speed in the pipes, scene units/s (∝ current). */
  flow: number;
  /** Pump pressure difference 0…1 of the gauge scale (∝ ℰ). */
  pressure: number;
  /** Morph target: 0 = the electric circuit, 1 = the water loop (script: «морфінг 1,6 s»). */
  target: number;
  /** Jump to a morph state without animation (step entry). */
  snap(v: number): void;
  update(dt: number): void;
}

const PIPE_R = 0.13;
export const MORPH_S = 1.6;
/** `back.out` overshoot (STYLE_GUIDE §5) for the parts that grow in. */
const backOut = (x: number): number => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

/**
 * `routes`: the lead routes in set space, in flow order (source «+» → … → source «−»); `sourceAt` / `loadAt`:
 * centres of the terminal pairs of the source and of the lamp (both pairs lie along X, 2.24 / 1.16 apart).
 */
export function createWaterLoop(
  ctx: ChapterContext,
  mats: Mats,
  routes: readonly Vector3[][],
  sourceAt: Vector3,
  loadAt: Vector3,
): WaterLoop {
  const g = new Group();
  g.name = 'water-loop';
  const paths = routes.map((r) => (r.length > 2 ? G.roundPath(r, 0.28, 5) : [...r]));
  const pipes = paths.map((p) => {
    const pipe = new Mesh(G.tube(p, PIPE_R, { seg: 14, caps: false }), mats.water);
    pipe.renderOrder = 5;
    g.add(pipe);
    return pipe;
  });
  // the morph fills the pipes in flow order: the index buffer of a tube runs ring by ring along its path
  const counts = pipes.map((p) => p.geometry.index?.count ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const water = createFlow(ctx, {
    kind: 'blob',
    color: 'sky',
    paths: paths.map((path) => ({ path })),
    count: 150,
    radius: 0.045,
    spread: PIPE_R * 0.62,
    speed: 0,
    endFade: 0.06,
    seed: 'water',
  });
  g.add(water);

  // pump: volute casing facing the camera, impeller behind a glass cover, pressure gauge on top
  const pb = new Builder('pump');
  pb.box(2.75, 0.1, 1.5, { at: [0, 0, -0.55], r: 0.04, c: ['ink', 'slate'] });
  pb.box(0.9, 0.5, 0.7, { at: [0, 0.1, -0.75], r: 0.08, c: ['blue.dark', 'blue'] }); // pedestal
  pb.cyl(0.85, 0.5, {
    at: [0, 1.25, -1.0],
    axis: 'z',
    seg: 48,
    slot: 'gloss',
    c: ['blue.dark', 'blue'],
    bevel: 0.06,
  });
  pb.cyl(0.7, 0.05, { at: [0, 1.25, -0.5], axis: 'z', seg: 48, slot: 'glass' });
  pb.ring(0.74, 0.05, { at: [0, 1.25, -0.48], axis: 'z', seg: 48, slot: 'metal', c: 'mist' });
  // outlet (high pressure, right) and inlet (left) stubs down to the terminals
  pb.tube(
    [new Vector3(0.6, 1.5, -0.75), new Vector3(1.12, 1.2, -0.4), new Vector3(1.12, 0.1, 0)],
    PIPE_R + 0.03,
    { seg: 14, c: 'blue' },
  );
  pb.tube(
    [new Vector3(-0.6, 1.0, -0.75), new Vector3(-1.12, 0.8, -0.4), new Vector3(-1.12, 0.1, 0)],
    PIPE_R + 0.03,
    { seg: 14, c: 'blue' },
  );
  pb.cyl(0.3, 0.14, { at: [0, 2.32, -0.82], axis: 'z', seg: 32, slot: 'gloss', c: 'white' }); // gauge
  pb.cyl(0.05, 0.25, { at: [0, 2.05, -0.75], seg: 10, slot: 'metal', c: 'mist' });
  const imp = pb.part('impeller', { at: [0, 1.25, -0.56] });
  imp.cyl(0.16, 0.08, { axis: 'z', seg: 20, slot: 'metal', c: 'mist' });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    imp.box(0.5, 0.11, 0.07, {
      at: [Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.04],
      rot: [0, 0, a + 0.5],
      r: 0.03,
      mid: true,
      c: 'sky',
    });
  }
  const needle = pb.part('needle', { at: [0, 2.32, -0.67] });
  needle.box(0.03, 0.24, 0.012, { at: [0, -0.02, 0], r: 0, c: 'coral' });
  pb.anchor('pump', 0, 1.25, -0.45).anchor('gauge', 0, 2.32, -0.66);
  const pump = pb.build();
  pump.group.position.copy(sourceAt);

  // load: the pipe narrows, and a paddle wheel in a glass housing turns in the stream
  const wb = new Builder('water-wheel');
  wb.box(1.5, 0.12, 0.9, { at: [0, 0, -0.2], r: 0.04, c: ['ink', 'slate'] });
  for (const s of [-1, 1] as const)
    wb.tube(
      [new Vector3(s * 0.58, 0.12, 0), new Vector3(s * 0.5, 0.5, -0.2), new Vector3(s * 0.2, 0.62, -0.2)],
      PIPE_R,
      { seg: 14, c: 'sky', taper: (t) => 1 - 0.5 * t },
    );
  wb.cyl(0.62, 0.4, { at: [0, 0.95, -0.4], axis: 'z', seg: 44, slot: 'glass' });
  wb.ring(0.63, 0.045, { at: [0, 0.95, 0.0], axis: 'z', seg: 44, slot: 'metal', c: 'mist' });
  wb.box(0.16, 0.5, 0.3, { at: [0, 0.1, -0.5], r: 0.03, c: 'slate' });
  const wh = wb.part('wheel', { at: [0, 0.95, -0.2] });
  wh.cyl(0.12, 0.34, { at: [0, 0, -0.17], axis: 'z', seg: 18, slot: 'metal', c: 'mist' });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    wh.box(0.4, 0.05, 0.28, {
      at: [Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0],
      rot: [0, 0, a],
      r: 0.015,
      mid: true,
      c: 'amber',
    });
  }
  wb.anchor('wheel', 0, 0.95, 0.05);
  const wheel = wb.build();
  wheel.group.position.copy(loadAt);
  g.add(pump.group, wheel.group);

  const impeller = pump.part('impeller');
  const hand = pump.part('needle');
  const paddles = wheel.part('wheel');
  let m = 0; // morph progress 0 (wires) … 1 (pipes)
  const show = (): void => {
    // pump and wheel grow where the cell and the lamp shrink; the pipes fill along the leads; water last
    const e = m * m * (3 - 2 * m);
    let left = Math.round(e * total);
    pipes.forEach((pipe, k) => {
      const n = Math.min(counts[k]!, left);
      left -= n;
      pipe.geometry.setDrawRange(0, n - (n % 3));
      pipe.visible = n > 0;
    });
    const grow = backOut(Math.min(Math.max((m - 0.1) / 0.55, 0), 1));
    pump.group.scale.setScalar(Math.max(grow, 1e-3));
    wheel.group.scale.setScalar(Math.max(grow, 1e-3));
    water.visible = m > 0.8;
  };
  const self: WaterLoop = {
    group: g,
    pump: pump.anchor('pump'),
    gauge: pump.anchor('gauge'),
    wheel: wheel.anchor('wheel'),
    flow: 0,
    pressure: 0,
    target: 0,
    snap(v) {
      self.target = m = v;
      show();
    },
    update(dt) {
      if (m !== self.target) {
        m += Math.sign(self.target - m) * Math.min(dt / MORPH_S, Math.abs(self.target - m));
        show();
      }
      water.speed = self.flow;
      impeller.rotation.z -= self.flow * 3.2 * dt;
      // the stream enters the wheel housing from the left, so the paddles turn clockwise as seen by the camera
      paddles.rotation.z -= self.flow * 2.2 * dt;
      hand.rotation.z = 1.9 / 2 - 1.9 * Math.min(Math.max(self.pressure, 0), 1);
    },
  };
  show();
  return self;
}
