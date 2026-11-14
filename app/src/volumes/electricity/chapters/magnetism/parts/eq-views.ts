/**
 * Four illustrations of Maxwell's equations (step `maxwell`, view «Рівняння»), one shown at a time on a low
 * pedestal: 0 Gauss — a proton and an electron with `amber` **E** lines that start on the + charge and end on
 * the − one (the surplus runs off), growing out of the charge each time the view opens; 1 no monopoles — a big
 * glass-ghost bar magnet with closed `magenta` **B** loops in three planes around its axis, inside included
 * (pole model, drawn with the fx field tracer: an illustration, not a simulated quantity);
 * 2 Faraday — a magnet bobbing through a copper ring: an `amber` **E** whirl around its path, bright and
 * flowing ∝ dB/dt, lights a small bulb on the ring; 3 Ampère–Maxwell — capacitor plates whose `amber` field
 * grows and shrinks, with a `magenta` **B** whirl around the gap ∝ dE/dt. Origin: centre of the pedestal.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { barMagnetField, createElectron, createFieldLines, createProton, pointChargesField, seedsOnSphere, type RibbonLine } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { glow } from '../world';
import { createBarMagnet, MAGNET_H } from './bar-magnet';
import { createBLines } from './b-lines';
import { COPPER } from './coil';

export interface EqViews {
  group: Group;
  views: Group[];
  /** Anchor of the ∂E/∂t hotspot (capacitor gap). */
  gap: Vector3;
  update(t: number, shown: number): void;
}

const TOP = 0.1;
const circle = (r: number, y: number, n = 48): Vector3[] => Array.from({ length: n + 1 }, (_, k) => new Vector3(Math.cos((k / n) * Math.PI * 2) * r, y, -Math.sin((k / n) * Math.PI * 2) * r));

/** 0 — Gauss: lines begin on + and end on −; net charge +1, so half of them leave the picture. */
function gaussView(): { group: Group; reveal(k: number): void } {
  const v = new Group();
  const pp = new Vector3(-0.42, 0.95, 0);
  const pe = new Vector3(0.55, 0.85, 0.05);
  const p = createProton({ radius: 0.2 });
  p.position.copy(pp);
  const e = createElectron({ radius: 0.14 });
  e.position.copy(pe);
  const field = pointChargesField([
    { position: pp, q: 2 },
    { position: pe, q: -1 },
  ]);
  const lines = createFieldLines({
    field,
    kind: 'E',
    seeds: seedsOnSphere(pp, 0.24, 30),
    trace: { step: 0.025, maxLength: 2.4, bounds: { center: new Vector3(0.05, 0.9, 0), radius: 1.15 }, stops: [{ position: pe, radius: 0.15 }] },
    width: 0.016,
    magnitudeContrast: 0.6,
    dashSpeed: 0.5,
  });
  v.add(p, e, lines);
  return {
    group: v,
    reveal(k) {
      lines.reveal = k;
    },
  };
}

/** 1 — no monopoles: closed B loops in three planes through the magnet's axis (x), inside included. */
function loopsView(): Group {
  const v = new Group();
  const len = 1.0;
  const mag = createBarMagnet(len);
  mag.peek = 0.45;
  mag.update();
  const y0 = 0.75;
  mag.group.position.y = y0;
  v.add(mag.group);
  // the pole model of a bar magnet (N at +x): lines leave N, loop round and enter S. Seeds sit on a small
  // circle round N in three planes through the axis, aimed sideways/backwards so every loop closes in frame.
  const c = new Vector3(0, y0 + MAGNET_H / 2, 0);
  const n = c.clone().setX(len * 0.4);
  const s = c.clone().setX(-len * 0.4);
  const seeds: Vector3[] = [];
  for (const plane of [0, Math.PI / 3, (2 * Math.PI) / 3])
    for (const side of [1, -1])
      for (const deg of [55, 75, 100, 132]) {
        const a = (deg * Math.PI) / 180;
        const r = 0.07 * Math.sin(a) * side;
        seeds.push(new Vector3(n.x + 0.07 * Math.cos(a), c.y + r * Math.cos(plane), r * Math.sin(plane)));
      }
  const outside = createFieldLines({
    field: barMagnetField(n, s),
    kind: 'B',
    seeds,
    trace: { step: 0.02, maxLength: 5, bounds: { center: c, radius: 1.25 }, stops: [{ position: s, radius: 0.06 }] },
    width: 0.016,
    magnitudeContrast: 0.5,
    dashSpeed: 0.35,
  });
  // inside the magnet B runs from S to N (−x → +x), closing every loop (seen through the glass ghost)
  const inside = createBLines(3 * 2, { width: 0.02, dashSpeed: 0.35 });
  inside.set([-0.04, 0, 0.04].map((y) => ({ points: [new Vector3(-len / 2, c.y + y, 0), new Vector3(len / 2, c.y + y, 0)] })));
  v.add(outside, inside.mesh);
  return v;
}

const W = 2 * Math.PI * 0.4;
const RING_Y = 0.72;

export function createEqViews(): EqViews {
  const g = new Group();
  // low neutral pedestal: no glowing rim (magenta would read as B)
  const pb = new Builder('eq-pedestal');
  pb.cyl(1.05, TOP, { seg: 48, c: ['ink', 'slate'] });
  pb.ring(1.05, 0.025, { at: [0, TOP, 0], seg: 64, slot: 'metal', c: 'steel' });
  g.add(pb.build().group);
  const gauss = gaussView();
  // 2: a magnet bobbing through a copper ring; the E whirl drives a current that lights the bulb
  const f = new Group();
  const bob = createBarMagnet(0.6);
  bob.group.rotation.z = Math.PI / 2;
  const fb = new Builder('faraday-ring');
  fb.ring(0.42, 0.03, { at: [0, RING_Y, 0], seg: 64, slot: 'metal', c: COPPER });
  fb.cyl(0.015, RING_Y, { at: [0.42, 0, 0], seg: 8, slot: 'metal', c: 'steel' });
  fb.cyl(0.05, 0.06, { at: [0.42, RING_Y + 0.02, 0], seg: 16, slot: 'metal', c: 'steel' });
  const bulbMat = glow('yellow', 0.3);
  const bulb = new Mesh(new SphereGeometry(0.085, 20, 14), bulbMat);
  bulb.position.set(0.42, RING_Y + 0.16, 0);
  const whirl = createBLines(3 * 50, { color: SEMANTIC.fieldE, width: 0.022, dashSpeed: 0.6 });
  whirl.set([0.3, 0.62, 0.85].map((r) => ({ points: circle(r, RING_Y), closed: true })));
  f.add(bob.group, fb.build().group, bulb, whirl.mesh);
  // 3: capacitor with changing E and a B whirl around the gap
  const c = new Group();
  const cb = new Builder('capacitor');
  for (const y of [0.4, 1.1]) cb.cyl(0.5, 0.05, { at: [0, y, 0], seg: 40, slot: 'metal', c: 'steel' });
  cb.cyl(0.03, 0.4, { at: [0, 0, 0], seg: 10, slot: 'metal', c: COPPER });
  cb.cyl(0.03, 0.5, { at: [0, 1.15, 0], seg: 10, slot: 'metal', c: COPPER });
  const capE = createBLines(11 * 2, { color: SEMANTIC.fieldE, width: 0.02, dashSpeed: 0.5 });
  const capB = createBLines(3 * 50, { width: 0.024, dashSpeed: 0.5 });
  capB.set([0.62, 0.8, 0.98].map((r) => ({ points: circle(r, 0.77), closed: true })));
  c.add(cb.build().group, capE.mesh, capB.mesh);
  const views = [gauss.group, loopsView(), f, c];
  views.forEach((v) => (v.position.y = TOP));
  g.add(...views);
  let lastSign = 0;
  let lastShown = -2;
  let since = 0;
  let lastT = 0;
  return {
    group: g,
    views,
    gap: new Vector3(0.5, 0.9, 0.3),
    update(t, shown) {
      if (shown !== lastShown) since = 0;
      since += Math.max(t - lastT, 0);
      lastT = t;
      lastShown = shown;
      views.forEach((v, k) => {
        const want = k === shown ? 1 : 0;
        const s = v.scale.x + (want - v.scale.x) * 0.15;
        v.scale.setScalar(Math.max(s, 0.001));
        v.visible = s > 0.01;
      });
      // 0: the E lines grow out of the charge over 1,4 s whenever the illustration is opened
      gauss.reveal(Math.min(since / 1.4, 1));
      // 2: magnet bobbing y = 0.72 + 0.4·sin ωt; whirl and bulb ∝ |dB/dt| ∝ |cos ωt|, sense flips with the motion
      bob.group.position.y = RING_Y + 0.4 * Math.sin(W * t);
      const rate = Math.cos(W * t);
      whirl.mesh.intensity = 0.2 + 1.3 * Math.abs(rate);
      whirl.mesh.dashSpeed = 0.7 * rate;
      bulbMat.intensity = 0.3 + 1.6 * rate * rate;
      // 3: E between the plates ∝ sin ωt (lines flip), B whirl ∝ dE/dt ∝ cos ωt
      const e = Math.sin(W * t);
      const sign = Math.sign(e) || 1;
      if (sign !== lastSign) {
        lastSign = sign;
        const lines: RibbonLine[] = [];
        for (let k = 0; k < 11; k++) {
          const a = (k / 10) * Math.PI * 2;
          const r = k === 0 ? 0 : 0.32;
          const top = new Vector3(Math.cos(a) * r, 1.07, Math.sin(a) * r);
          const bottom = top.clone().setY(0.47);
          lines.push({ points: sign > 0 ? [top, bottom] : [bottom, top] });
        }
        capE.set(lines);
      }
      capE.mesh.intensity = 0.2 + 1.2 * Math.abs(e);
      capB.mesh.intensity = 0.2 + 1.3 * Math.abs(rate);
      capB.mesh.dashSpeed = 0.7 * rate;
    },
  };
}
