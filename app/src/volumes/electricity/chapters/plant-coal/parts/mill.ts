/**
 * Step 3 hero: a vertical roller mill in cutaway, drawn ×3 (chip «збільшено ×3»): the turning bowl with its coal
 * bed, three huge rollers that crush the coal, the hot primary air (`orange`, translucent) rising round the bowl and
 * lifting the fine dust up through the rotating classifier into the coal pipes, coarse grains falling back. Next to
 * it a small furnace window with a burner flame — coarse grinding throws `orange` sparks of unburnt coal into the
 * slag — and the magnifier: dust grains beside a human hair (≈ 70 μm), drawn ≈ ×40 000.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlame, createFlow, createSparks, type Flow } from '@/fx';
import { Builder, G, type KitModel } from '@/kit';
import { K } from '@/style';

export interface Mill {
  group: Group;
  model: KitModel;
  flows: Flow[];
  /** World anchors. */
  points: { classifier: Vector3; bowl: Vector3; air: Vector3; window: Vector3; lens: Vector3; hair: Vector3; dust: Vector3; pipes: Vector3 };
  /** Magnifier group (its own actor). */
  lens: Group;
  /** Unburnt share 0…0.05 → spark rate in the furnace window. */
  unburnt: number;
  update(dt: number, t: number): void;
}

/** Height of the mill top (local). */
const TOP = 26;

export function buildMill(ctx: ChapterContext, at: Vector3): Mill {
  const group = new Group();
  group.position.copy(at);
  const b = new Builder('coal-mill');
  b.box(18, 2, 18, { r: 0.4, slot: 'matte', c: ['slate', 'steel'] });
  b.cyl(5, 3, { seg: 28, slot: 'metal', c: 'slate', at: [0, 2, 0] }); // gearbox
  // cutaway shell: a wide window toward the step's camera (south-east, φ ≈ 0,5 rad from +Z)
  const shellProfile: [number, number][] = [[7.4, 5], [7.4, 16], [4.2, 21], [4.2, 23], [7, 23], [7, 23.6], [3.6, 23.6], [3.6, 16.8], [6.8, 15.6], [6.8, 5]];
  const shell = G.revolve(shellProfile, { seg: 40, phiStart: 1.8, phiLength: Math.PI * 2 - 2.6 });
  b.add(shell.shell, { slot: 'gloss', c: ['steel', 'mist'] });
  b.cyl(7.6, 0.6, { seg: 40, slot: 'gloss', c: 'amber', at: [0, 15.4, 0] });
  // primary air inlet duct and the coal pipes that leave the classifier head
  b.box(9, 4, 4, { r: 0.5, slot: 'gloss', c: ['orange.dark', 'orange'], at: [-10, 5.4, 0] });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    b.tube([new Vector3(Math.cos(a) * 3, TOP - 2, Math.sin(a) * 3), new Vector3(Math.cos(a) * 5, TOP + 3, Math.sin(a) * 5), new Vector3(Math.cos(a) * 6, TOP + 10, Math.sin(a) * 6 - 4)], 0.8, { slot: 'metal', c: 'steel' });
  }
  b.cyl(1.4, 10, { seg: 16, slot: 'metal', c: 'slate', at: [0, 16, 0] }); // central coal feed pipe
  const bowl = b.part('bowl', { at: [0, 6, 0] });
  bowl.lathe([[0.1, 0], [6.4, 0], [6.6, 1.6], [5.6, 1.6], [5.2, 0.9], [0.1, 0.9]], { seg: 40, slot: 'gloss', c: ['steel', 'mist'] });
  bowl.ring(4.6, 0.9, { seg: 40, slot: 'facet', c: 'ink', at: [0, 1.1, 0] }); // coal bed under the rollers
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const r = b.part(`roller${k}`, { at: [Math.cos(a) * 4.4, 9.4, Math.sin(a) * 4.4], rot: [0, -a, 0.42] });
    r.cyl(2.4, 2.2, { seg: 32, axis: 'x', slot: 'metal', c: ['slate', 'steel'], at: [-1.1, 0, 0] });
    r.cyl(0.7, 4, { seg: 12, axis: 'x', slot: 'metal', c: 'amber', at: [-3.4, 0, 0] });
  }
  const cls = b.part('classifier', { at: [0, 18, 0] });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    cls.box(0.25, 4, 1.4, { r: 0, slot: 'metal', c: 'amber', at: [Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2], rot: [0, -a + 0.5, 0] });
  }
  cls.cyl(3.4, 0.3, { seg: 24, slot: 'metal', c: 'amber.dark', at: [0, 4, 0] });
  const model = b.build();
  group.add(model.group);
  // furnace window with a burner flame (right of the mill)
  const win = new Builder('flame-window');
  // an open box: back and side walls, floor and roof — the camera looks in through the missing front
  win.box(12, 14, 1, { r: 0.3, c: ['slate', 'steel'], at: [0, 0, -4.5] });
  win.box(10, 11, 0.3, { r: 0.1, slot: 'matte', c: 'ink', at: [0, 1.5, -3.9] });
  for (const s of [-1, 1]) win.box(1, 14, 9, { r: 0.3, c: ['slate', 'steel'], at: [s * 5.5, 0, -0.5] });
  win.box(12.4, 0.8, 9.4, { r: 0.2, slot: 'gloss', c: 'amber', at: [0, 14, -0.5] });
  win.box(12, 1, 9, { r: 0.2, c: 'slate', at: [0, 0, -0.5] });
  win.box(8, 1.4, 5, { r: 0.2, slot: 'matte', c: 'slate', at: [0, 1.6, 0.6] }); // slag tray
  const window = win.build();
  window.group.position.set(22, 0, 2);
  group.add(window.group);
  const flame = createFlame({ height: 7, width: 3.4, intensity: 1.3 });
  flame.position.set(20.6, 3.6, 1.6);
  flame.rotation.z = -0.35;
  group.add(flame);
  const sparks = createSparks(ctx, { count: ctx.quality.count(80, 30), color: 'orange', size: 0.5, gravity: 14 });
  group.add(sparks);
  // magnifier: a lens with one hair and a cloud of dust grains (10…75 μm, at 40 000 : 1 → 0,4…3 m)
  const lens = new Group();
  lens.position.set(-22, 20, 6);
  const rim = new Builder('lens-rim');
  rim.ring(10, 0.7, { axis: 'z', seg: 64, slot: 'gloss', c: 'amber' });
  rim.cyl(0.7, 9, { seg: 12, slot: 'gloss', c: 'amber.dark', at: [7.4, -16, 0], rot: [0, 0, 0.75] });
  lens.add(rim.build().group);
  const disc = new Mesh(new SphereGeometry(10, 40, 12), K.glass({ color: 'sky', opacity: 0.12, edgeOpacity: 0.4 }));
  disc.scale.z = 0.08;
  lens.add(disc);
  const hairB = new Builder('hair');
  hairB.cyl(1.4, 19, { seg: 20, axis: 'x', slot: 'gloss', c: 'wireBrown', at: [-9.5, 4, 0] });
  lens.add(hairB.build().group);
  const dust = new Builder('dust-grains');
  const rng = ctx.random.fork('dust');
  for (let i = 0; i < 26; i++) {
    const r = 0.2 + rng.next() * 1.3;
    dust.add(G.facet(r, 0), { slot: 'facet', c: 'slate', at: [-7 + rng.next() * 14, -7 + rng.next() * 9, (rng.next() - 0.5) * 1.2] });
  }
  lens.add(dust.build().group);
  group.add(lens);
  // flows: hot primary air, coal feed, fine dust to the pipes, coarse grains back to the bowl
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const air = createFlow(ctx, { kind: 'blob', color: 'orange', paths: [v(-13, 5.4, 0), v(-7.2, 5.6, 0), v(-6.8, 8, 0), v(-5.5, 14, 0), v(-2.6, 18, 0), v(0, 22, 0)], count: ctx.quality.count(40, 16), radius: 0.45, speed: 5, spread: 1.4, halo: false });
  const feed = createFlow(ctx, { kind: 'blob', color: 'ink', paths: [v(0, 26, 0), v(0, 16, 0), v(0, 8, 0)], count: ctx.quality.count(14, 8), radius: 0.7, speed: 4, spread: 0.6, halo: false });
  const fine = createFlow(ctx, { kind: 'blob', color: 'slate', paths: [v(5.8, 8, 2), v(6, 14, 2), v(3, 19, 1), v(0, 23, 0), v(3.6, TOP + 3, 3.6), v(4.2, TOP + 10, 0.2)], count: ctx.quality.count(50, 20), radius: 0.22, speed: 6, spread: 1, halo: false });
  const coarse = createFlow(ctx, { kind: 'blob', color: 'ink', paths: [v(-2.8, 17, 1.5), v(-4, 13, 1.5), v(-4.4, 8, 1.5)], count: ctx.quality.count(10, 6), radius: 0.45, speed: 3, spread: 0.8, halo: false });
  const flows = [air, feed, fine, coarse];
  group.add(...flows);
  const w = (x: number, y: number, z: number): Vector3 => at.clone().add(v(x, y, z));
  let nextSpark = 0;
  const api: Mill = {
    group,
    model,
    flows,
    lens,
    unburnt: 0.005,
    points: { classifier: w(3, 21, 6), bowl: w(0, 7, 4), air: w(-11, 7, 2), window: w(22, 10, 3), lens: w(-22, 20, 6), hair: w(-31, 24, 6), dust: w(-22, 12, 6), pipes: w(4, TOP + 10, 0) },
    update(dt, t) {
      model.part('bowl').rotation.y += dt * 1.1;
      model.part('classifier').rotation.y -= dt * 2.2;
      for (let k = 0; k < 3; k++) model.part(`roller${k}`).rotation.x += dt * 2.6;
      // unburnt particles: spark bursts more often and denser the coarser the grind
      if (t >= nextSpark) {
        const n = Math.round(2 + api.unburnt * 600);
        sparks.burst([22, 7, 1.6], n, [0.2, -1, 0.3], 0.6);
        nextSpark = t + 0.5;
      }
      coarse.density = Math.min(1, 0.2 + api.unburnt * 20);
    },
  };
  return api;
}
