/**
 * The barge analogy of step 10: a stylised canal (flowing water strip between two grass banks), a barge with
 * cargo and a toy horse on the towpath pulling a rope. The barge stays put and the water flows past it (speed
 * ∝ useful pull P); `setRope(φ)` places the horse so the rope makes angle φ with the canal. Canal along +X.
 * Origin = barge position on the water.
 */
import { CatmullRomCurve3, Group, Mesh, Vector3 } from 'three';
import { createWaterStrip, RibbonLines, type WaterStrip } from '@/fx';
import { Builder, G } from '@/kit';
import { K } from '@/style';

export const CANAL_W = 1.0;
const ROPE_L = 2.6;

export interface Canal {
  group: Group;
  water: WaterStrip;
  barge: Group;
  horse: Group;
  legs: Mesh[];
  rope: RibbonLines;
  /** Local bow point (where the rope is tied). */
  bow: Vector3;
  setRope(angleRad: number): void;
}

function horseModel(): { group: Group; legs: Mesh[] } {
  const g = new Group();
  const coat = K.toon({ color: 'wireBrown', gloss: 0.3 });
  const body = new Mesh(G.capsule(0.16, 0.7, 16).rotateZ(Math.PI / 2), coat);
  body.position.y = 0.5;
  const neck = new Mesh(G.capsule(0.08, 0.35, 12), coat);
  neck.position.set(0.35, 0.68, 0);
  neck.rotation.z = -0.6;
  const head = new Mesh(G.capsule(0.08, 0.26, 12).rotateZ(Math.PI / 2.4), coat);
  head.position.set(0.5, 0.8, 0);
  const mane = new Mesh(G.rbox(0.25, 0.06, 0.04, 0.02), K.toon({ color: 'ink' }));
  mane.position.set(0.32, 0.78, 0);
  mane.rotation.z = -0.6;
  g.add(body, neck, head, mane);
  const legs = [-0.22, 0.22].flatMap((x) =>
    [-0.08, 0.08].map((z) => {
      const leg = new Mesh(G.cyl(0.035, 0.38, { seg: 8 }).translate(0, -0.38, 0), coat);
      leg.position.set(x, 0.42, z);
      g.add(leg);
      return leg;
    }),
  );
  for (const m of g.children) m.castShadow = true;
  return { group: g, legs };
}

export function createCanal(): Canal {
  const group = new Group();
  group.name = 'canal';
  const banks = new Builder('banks');
  for (const s of [-1, 1]) banks.box(5.2, 0.22, s < 0 ? 0.9 : 0.5, { r: 0.06, c: ['green.dark', 'green'], slot: 'matte', at: [0.4, -0.2, s * (CANAL_W / 2 + (s < 0 ? 0.45 : 0.25))] });
  banks.box(5.2, 0.04, 0.22, { r: 0.02, c: 'amber.dark', slot: 'matte', at: [0.4, 0.02, -(CANAL_W / 2 + 0.3)] }); // towpath
  banks.box(5.2, 0.08, CANAL_W + 0.1, { r: 0.02, c: 'blue.dark', at: [0.4, -0.22, 0] });
  group.add(banks.build().group);
  const water = createWaterStrip(new CatmullRomCurve3([new Vector3(-2.2, -0.05, 0), new Vector3(3.0, -0.05, 0)]), { width: CANAL_W, speed: 0.3 });
  group.add(water);
  const b = new Builder('barge');
  b.box(1.3, 0.24, 0.55, { r: 0.1, c: ['orange.dark', 'orange'], slot: 'gloss', at: [0, -0.1, 0] });
  b.box(0.36, 0.22, 0.4, { r: 0.04, c: 'sky', at: [-0.3, 0.14, 0] });
  b.box(0.32, 0.18, 0.4, { r: 0.04, c: 'coral', at: [0.1, 0.14, 0] });
  b.cyl(0.03, 0.5, { c: 'ink', at: [0.45, 0.14, 0] });
  const barge = b.build().group;
  group.add(barge);
  const h = horseModel();
  group.add(h.group);
  const rope = new RibbonLines({ capacity: 8, color: 'mist', width: 0.03, intensity: 0.9, dashStrength: 0, minPixels: 1.5 });
  group.add(rope);
  const bow = new Vector3(0.45, 0.6, 0);
  return {
    group,
    water,
    barge,
    horse: h.group,
    legs: h.legs,
    rope,
    bow,
    setRope(phi) {
      // the horse walks on the far bank (−z); keep it out of the water for small angles
      const dz = Math.max(CANAL_W / 2 + 0.25, ROPE_L * Math.sin(phi));
      const dx = Math.max(0.3, Math.sqrt(Math.max(0, ROPE_L * ROPE_L - dz * dz)));
      h.group.position.set(bow.x + dx, 0.02, -dz);
      h.group.rotation.y = 0;
      rope.setLines([{ points: [bow.clone(), new Vector3(bow.x + dx + 0.1, 0.55, -dz)] }]);
    },
  };
}
