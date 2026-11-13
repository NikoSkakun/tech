/**
 * Four small illustrations of Maxwell's equations (step `maxwell`, view «Рівняння»), one shown at a time:
 * 0 Gauss — a charge with radial `amber` **E** lines; 1 no monopoles — a bar magnet with closed **B** loops
 * (inside included); 2 Faraday — a magnet bobbing up and down and an `amber` **E** whirl around its path,
 * bright ∝ |dB/dt|; 3 Ampère–Maxwell — capacitor plates whose `amber` field grows and shrinks, with a
 * `magenta` **B** whirl around the gap ∝ |dE/dt|. Origin: centre of the pedestal; illustrations stand on it.
 */
import { Group, Vector3 } from 'three';
import { createProton, type RibbonLine } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { barMagnet, traceMagnetLines } from '@electricity/sim/magnetism';
import { createBarMagnet } from './bar-magnet';
import { createBLines } from './b-lines';

export interface EqViews {
  group: Group;
  views: Group[];
  /** Anchor of the ∂E/∂t hotspot (capacitor gap). */
  gap: Vector3;
  update(t: number, shown: number): void;
}

const circle = (r: number, y: number, n = 48): Vector3[] => Array.from({ length: n + 1 }, (_, k) => new Vector3(Math.cos((k / n) * Math.PI * 2) * r, y, -Math.sin((k / n) * Math.PI * 2) * r));

export function createEqViews(): EqViews {
  const g = new Group();
  const pb = new Builder('eq-pedestal');
  pb.cyl(1.2, 0.12, { seg: 48, c: ['ink', 'slate'] });
  pb.ring(1.2, 0.03, { at: [0, 0.12, 0], seg: 64, slot: 'glow', c: 'magenta' });
  g.add(pb.build().group);
  const views = [0, 1, 2, 3].map(() => new Group());
  views.forEach((v) => (v.position.y = 0.12));
  // 0: charge + radial E
  const q = createProton({ radius: 0.16 });
  q.position.y = 0.9;
  const eLines = createBLines(26 * 2, { color: SEMANTIC.fieldE, width: 0.02, dashSpeed: 0.5 });
  const rad: RibbonLine[] = [];
  for (let k = 0; k < 26; k++) {
    const y = 1 - (2 * (k + 0.5)) / 26;
    const r = Math.sqrt(1 - y * y);
    const a = k * 2.4;
    const d = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    rad.push({ points: [d.clone().multiplyScalar(0.22).setY(0.9 + d.y * 0.22), d.clone().multiplyScalar(0.95).setY(0.9 + d.y * 0.95)] });
  }
  eLines.set(rad);
  views[0]!.add(q, eLines.mesh);
  // 1: magnet with closed loops (inside too)
  const mag = createBarMagnet(0.8);
  mag.peek = 0.6;
  mag.update();
  mag.group.position.y = 0.55;
  const loops = createBLines(14 * 2 * 402 + 16, { width: 0.018 });
  const m = barMagnet(0, 0, 0, 1.2, 0.08);
  loops.fromSim(
    traceMagnetLines([m], 10).map((l) => {
      const out = l.points.findIndex((p) => Math.hypot(p.x, p.y) > 0.11);
      return { points: out < 0 ? l.points : l.points.slice(0, out) };
    }),
    0.62,
    [-0.03, 0, 0.03].map((z) => ({ points: [new Vector3(-0.4, 0.62, z), new Vector3(0.4, 0.62, z)] })),
  );
  loops.mesh.position.y = 0;
  views[1]!.add(mag.group, loops.mesh);
  // 2: bobbing magnet + E whirl
  const bob = createBarMagnet(0.5);
  bob.group.rotation.z = Math.PI / 2;
  const whirl = createBLines(3 * 50, { color: SEMANTIC.fieldE, width: 0.025, dashSpeed: 0.6 });
  whirl.set([0.45, 0.65, 0.85].map((r) => ({ points: circle(r, 0.7), closed: true })));
  views[2]!.add(bob.group, whirl.mesh);
  // 3: capacitor with changing E and a B whirl around the gap
  const cb = new Builder('capacitor');
  for (const y of [0.35, 1.05]) cb.cyl(0.42, 0.05, { at: [0, y, 0], seg: 40, slot: 'metal', c: 'steel' });
  cb.cyl(0.03, 0.35, { at: [0, 0, 0], seg: 10, slot: 'metal', c: 'orange' });
  cb.cyl(0.03, 0.5, { at: [0, 1.1, 0], seg: 10, slot: 'metal', c: 'orange' });
  const capE = createBLines(9 * 2, { color: SEMANTIC.fieldE, width: 0.022, dashSpeed: 0.5 });
  const capB = createBLines(3 * 50, { width: 0.025, dashSpeed: 0.5 });
  capB.set([0.55, 0.72, 0.9].map((r) => ({ points: circle(r, 0.72), closed: true })));
  views[3]!.add(cb.build().group, capE.mesh, capB.mesh);
  g.add(...views);
  let lastSign = 0;
  return {
    group: g,
    views,
    gap: new Vector3(0.45, 0.85, 0.3),
    update(t, shown) {
      views.forEach((v, k) => {
        const want = k === shown ? 1 : 0;
        const s = v.scale.x + (want - v.scale.x) * 0.15;
        v.scale.setScalar(Math.max(s, 0.001));
        v.visible = s > 0.01;
      });
      const w = 2 * Math.PI * 0.4;
      // 2: magnet bobbing y = 0.7 + 0.35·sin ωt; whirl ∝ |dB/dt| ∝ |cos ωt|, sense flips with the motion
      bob.group.position.y = 0.7 + 0.35 * Math.sin(w * t);
      const rate = Math.cos(w * t);
      whirl.mesh.intensity = 0.2 + 1.3 * Math.abs(rate);
      whirl.mesh.dashSpeed = 0.7 * rate;
      // 3: E between the plates ∝ sin ωt (lines flip), B whirl ∝ dE/dt ∝ cos ωt
      const e = Math.sin(w * t);
      const sign = Math.sign(e) || 1;
      if (sign !== lastSign) {
        lastSign = sign;
        const lines: RibbonLine[] = [];
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          const r = k === 0 ? 0 : 0.26;
          const top = new Vector3(Math.cos(a) * r, 1.02, Math.sin(a) * r);
          const bottom = top.clone().setY(0.42);
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
