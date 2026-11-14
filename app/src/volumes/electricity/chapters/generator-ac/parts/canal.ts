/**
 * The barge analogy of step 10: a stylised canal (flowing water strip) with a barge, a meadow on the far side and
 * a toy horse pulling a rope of fixed length. The barge stays put and the water flows past it (speed ∝ useful
 * pull P). `setRope(φ)` walks the horse along an arc path around the bow, so the drawn rope makes exactly angle φ
 * with the canal for every φ in 0…80°: the canal ends in a strip of land ahead of the barge, so at small angles the
 * horse stands on that land, not in the water. Canal along +X; origin = barge position on the water.
 */
import { CatmullRomCurve3, Group, Mesh, RingGeometry, Vector3 } from 'three';
import { createWaterStrip, RibbonLines, type WaterStrip } from '@/fx';
import { Builder, G } from '@/kit';
import { K } from '@/style';

export const CANAL_W = 1.0;
/** Rope length from the bow to the swingletree behind the horse. */
const ROPE_L = 1.9;
const HORSE_SCALE = 1.35;
/** Bow → horse centre (the horse body is ≈ 1 unit long before scaling). */
const HORSE_R = ROPE_L + 0.55 * HORSE_SCALE;
/** Where the water ends and the land ahead of the barge begins (local x). */
const WATER_END = 2.15;
const LAND_X0 = -2.2;
const LAND_X1 = 3.8;
const MEADOW_Z = -3.4;
const MEADOW_X0 = -0.6;
/** Width of the far bank along the whole canal. */
const FAR_W = 0.45;

export interface Canal {
  group: Group;
  water: WaterStrip;
  barge: Group;
  horse: Group;
  legs: Mesh[];
  rope: RibbonLines;
  /** Local bow point (where the rope is tied). */
  bow: Vector3;
  /** Angle of the rope as drawn (rad, measured in plan from +X towards −Z) — equals the set φ. */
  ropeAngle(): number;
  setRope(angleRad: number): void;
}

function horseModel(): { group: Group; legs: Mesh[] } {
  const g = new Group();
  const coat = K.toon({ color: 'wireBrown', gloss: 0.3 });
  const dark = K.toon({ color: 'ink' });
  const body = new Mesh(G.capsule(0.16, 0.7, 16).rotateZ(Math.PI / 2), coat);
  body.position.y = 0.5;
  const neck = new Mesh(G.capsule(0.08, 0.35, 12), coat);
  neck.position.set(0.35, 0.68, 0);
  neck.rotation.z = -0.6;
  const head = new Mesh(G.capsule(0.08, 0.26, 12).rotateZ(Math.PI / 2.4), coat);
  head.position.set(0.5, 0.8, 0);
  const mane = new Mesh(G.rbox(0.25, 0.06, 0.04, 0.02), dark);
  mane.position.set(0.32, 0.78, 0);
  mane.rotation.z = -0.6;
  const tail = new Mesh(G.capsule(0.03, 0.22, 8), dark);
  tail.position.set(-0.5, 0.45, 0);
  tail.rotation.z = -0.5;
  const collar = new Mesh(G.rbox(0.07, 0.3, 0.3, 0.03), K.toon({ color: 'amber', gloss: 0.4 }));
  collar.position.set(0.22, 0.6, 0);
  collar.rotation.z = -0.5;
  // swingletree behind the horse: the rope ends here
  const bar = new Mesh(G.cyl(0.025, 0.42, { seg: 8 }).rotateX(Math.PI / 2), K.toon({ color: 'amber.dark' }));
  bar.position.set(-0.55, 0.4, 0);
  g.add(body, neck, head, mane, tail, collar, bar);
  const legs = [-0.22, 0.22].flatMap((x) =>
    [-0.08, 0.08].map((z) => {
      const leg = new Mesh(G.cyl(0.035, 0.38, { seg: 8 }).translate(0, -0.38, 0), coat);
      leg.position.set(x, 0.42, z);
      g.add(leg);
      return leg;
    }),
  );
  for (const m of g.children) m.castShadow = true;
  g.scale.setScalar(HORSE_SCALE);
  const outer = new Group();
  outer.add(g);
  return { group: outer, legs };
}

export function createCanal(): Canal {
  const group = new Group();
  group.name = 'canal';
  const land = new Builder('banks');
  const grass = { c: ['green.dark', 'green'] as const, slot: 'matte' as const };
  const nearW = 0.55;
  const len = LAND_X1 - LAND_X0;
  const midX = (LAND_X0 + LAND_X1) / 2;
  // near bank, meadow on the far side, and the land across the canal's end
  land.box(len, 0.22, nearW, { r: 0.06, ...grass, at: [midX, -0.2, CANAL_W / 2 + nearW / 2] });
  land.box(len, 0.22, FAR_W, { r: 0.06, ...grass, at: [midX, -0.2, -CANAL_W / 2 - FAR_W / 2] });
  // the meadow only where the horse walks (it never goes further back than x ≈ bow)
  land.box(LAND_X1 - MEADOW_X0, 0.22, -MEADOW_Z - CANAL_W / 2 - FAR_W, { r: 0.06, ...grass, at: [(MEADOW_X0 + LAND_X1) / 2, -0.2, (MEADOW_Z - CANAL_W / 2 - FAR_W) / 2] });
  land.box(LAND_X1 - WATER_END, 0.22, CANAL_W + 0.02, { r: 0.04, ...grass, at: [(WATER_END + LAND_X1) / 2, -0.2, 0] });
  land.box(WATER_END - LAND_X0, 0.08, CANAL_W + 0.1, { r: 0.02, c: 'blue.dark', at: [(LAND_X0 + WATER_END) / 2, -0.22, 0] });
  // the horse's path: an arc of radius HORSE_R around the bow, 0…80° (it never crosses the water)
  const path = new RingGeometry(HORSE_R - 0.11, HORSE_R + 0.11, 48, 1, (-4 * Math.PI) / 180, (88 * Math.PI) / 180);
  path.rotateX(-Math.PI / 2);
  land.add(path, { c: 'green.dark', slot: 'matte', at: [0.45, 0.025, 0] });
  group.add(land.build().group);
  const water = createWaterStrip(new CatmullRomCurve3([new Vector3(LAND_X0, -0.05, 0), new Vector3(WATER_END, -0.05, 0)]), { width: CANAL_W, speed: 0.3 });
  group.add(water);
  const b = new Builder('barge');
  b.box(1.4, 0.26, 0.6, { r: 0.1, c: ['orange.dark', 'orange'], slot: 'gloss', at: [0, -0.12, 0] });
  b.box(0.36, 0.24, 0.42, { r: 0.04, c: 'sky', at: [-0.38, 0.14, 0] });
  b.box(0.3, 0.2, 0.42, { r: 0.04, c: 'coral', at: [-0.02, 0.14, 0] });
  b.box(0.22, 0.16, 0.3, { r: 0.04, c: 'yellow', at: [-0.38, 0.38, 0] });
  b.cyl(0.035, 0.5, { c: 'ink', at: [0.45, 0.14, 0] });
  b.sphere(0.06, { c: 'amber', at: [0.45, 0.62, 0] });
  const barge = b.build().group;
  group.add(barge);
  const h = horseModel();
  group.add(h.group);
  const rope = new RibbonLines({ capacity: 8, color: 'mist', width: 0.035, intensity: 1.0, dashStrength: 0, minPixels: 2 });
  group.add(rope);
  const bow = new Vector3(0.45, 0.6, 0);
  let drawn = 0;
  return {
    group,
    water,
    barge,
    horse: h.group,
    legs: h.legs,
    rope,
    bow,
    ropeAngle: () => drawn,
    setRope(phi) {
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      h.group.position.set(bow.x + HORSE_R * c, 0.02, -HORSE_R * s);
      h.group.rotation.y = phi; // walking away from the barge, along the rope
      const end = new Vector3(bow.x + ROPE_L * c, 0.4 * HORSE_SCALE + 0.02, -ROPE_L * s);
      rope.setLines([{ points: [bow.clone(), end] }]);
      drawn = Math.atan2(bow.z - end.z, end.x - bow.x);
    },
  };
}
