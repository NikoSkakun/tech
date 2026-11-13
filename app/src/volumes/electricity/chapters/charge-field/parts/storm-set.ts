/**
 * `StormDiorama` of step 6, static part (kit models, built in metres inside a group scaled to the scene): a
 * small island with a house that carries a lightning rod, a tall tree, and a cumulonimbus with an anvil made of
 * merged soft puffs. Returns the points the lightning effects need.
 */
import { Group, Mesh, Plane, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { Builder, house, island, trees } from '@/kit';
import type { ColorToken } from '@/style';
import { STATIC } from '../layout';

/** Scene units per metre of the diorama. */
export const STORM_SCALE = 0.3;
/** z (metres, cloud space) of the cutaway face of the thundercloud; the charge marks sit on it. */
export const CLOUD_CUT = 1.2;
const CUT = CLOUD_CUT;
/** x (metres) left of which the cloud stays whole; the charge marks sit right of it. */
export const CLOUD_CUT_X = -3;
const CUT_X = CLOUD_CUT_X;

export interface StormSet {
  /** Everything in metres; `group.scale` = `STORM_SCALE`, positioned at `STATIC.storm`. */
  group: Group;
  /** Local points, metres. */
  rodTip: Vector3;
  treeTop: Vector3;
  /** Lowest point of the cloud above the house, where the leader starts. */
  cloudBase: Vector3;
  /** Centre of the charging zone inside the cloud (graupel hotspot). */
  core: Vector3;
  cloudTop: Vector3;
  /** Rod mast (hidden when the «Громовідвід» toggle is off). */
  rod: Group;
  update(dt: number, t: number): void;
}

export function createStormSet(ctx: ChapterContext): StormSet {
  const group = new Group();
  group.name = 'storm-diorama';
  group.scale.setScalar(STORM_SCALE);
  group.position.copy(STATIC.storm);

  const land = island({ radius: 24, seed: 11, wobble: 0.45, relief: 0.5 });
  group.add(land.group);
  const home = house({ width: 8, depth: 7, floors: 1, roof: 'gable', seed: 5, lit: 1 });
  land.place(home.group, -5, 3, 0.35);
  home.night = 0.8;
  const roof = home.anchorLocal('roof').applyEuler(home.group.rotation).add(home.group.position);

  // lightning rod: mast on the ridge, a thick down conductor along the wall, an earth electrode
  const rb = new Builder('lightning-rod');
  rb.cyl(0.09, 3.6, { seg: 10, slot: 'metal', c: 'steel.light', at: [0, 0, 0] });
  rb.cone(0.12, 0.5, { seg: 10, slot: 'metal', c: 'white', at: [0, 3.6, 0] });
  rb.rod([0, 0.1, 0], [4.6, -3.2, 0.4], 0.07, { slot: 'metal', c: 'steel' });
  rb.rod([4.6, -3.2, 0.4], [4.9, -(roof.y - land.heightAt(0, 3)) - 0.2, 0.6], 0.07, {
    slot: 'metal',
    c: 'steel',
  });
  const rod = rb.build().group;
  rod.position.copy(roof);
  land.group.add(rod);
  const rodTip = roof.clone().add(new Vector3(0, 4.1, 0));

  const wood = trees(
    [
      { x: 9, y: land.heightAt(9, -2), z: -2, kind: 'poplar', scale: 1.9 },
      { x: 13, y: land.heightAt(13, 5), z: 5, kind: 'round', scale: 1.0 },
      { x: -14, y: land.heightAt(-14, -6), z: -6, kind: 'conifer', scale: 1.1 },
      { x: 3, y: land.heightAt(3, -10), z: -10, kind: 'bush', scale: 1.0 },
    ],
    { rng: ctx.random.fork('storm-trees') },
  );
  land.group.add(wood.group);
  const treeTop = new Vector3(9, land.heightAt(9, -2) + 15.5, -2);

  // Cumulonimbus: dark flat base, bulging tower, anvil spreading at the top. It is shown as a cutaway: the
  // front-right block (x > CUT_X and z > CUT) is clipped away and flat caps (the exact sections of the puffs)
  // close the cut, so the separated charge sits *inside* the cloud, on the cut face, while the left part keeps
  // its puffy outline.
  const keepZ = new Plane(); // z <= CUT
  const keepX = new Plane(); // x <= CUT_X
  const capX = new Plane(); // x >= CUT_X (the front cap only right of the cut)
  const capZ = new Plane(); // z >= CUT (the side cap only in front of the cut)
  const cb = new Builder('thundercloud', { clippingPlanes: [keepZ, keepX] });
  const front = new Builder('thundercloud-cut', { clippingPlanes: [capX] });
  const side = new Builder('thundercloud-side', { clippingPlanes: [capZ] });
  const S: [number, number, number] = [1, 0.72, 0.9];
  const puff = (x: number, y: number, z: number, r: number, tone: number): void => {
    cb.sphere(r, {
      seg: 18,
      slot: 'soft',
      c: tone < 0.5 ? ['slate', 'steel'] : ['steel', 'mist'],
      at: [x, y, z],
      s: S,
    });
    const inner: ColorToken = tone < 0.7 ? 'slate' : 'steel';
    // sections of the ellipsoid (r, 0.72 r, 0.9 r) by z = CUT and by x = CUT_X
    const kz = 1 - ((CUT - z) / (S[2] * r)) ** 2;
    if (kz > 0) {
      const a = r * Math.sqrt(kz);
      front.cyl(a, 0.04, { seg: 24, slot: 'matte', c: inner, at: [x, y, CUT], axis: 'z', s: [1, S[1], 1] });
    }
    const kx = 1 - ((CUT_X - x) / r) ** 2;
    if (kx > 0) {
      const a = r * Math.sqrt(kx);
      side.cyl(a, 0.04, {
        seg: 24,
        slot: 'matte',
        c: inner,
        at: [CUT_X, y, z],
        axis: 'x',
        s: [1, S[1], S[2]],
      });
    }
  };
  const base = 24;
  for (let i = 0; i < 9; i++)
    puff(-14 + i * 3.6, base + 2.2 + (i % 2) * 0.6, (i % 3) - 1, 4.4 + (i % 3) * 0.5, 0.2);
  for (let i = 0; i < 6; i++)
    puff(-8 + i * 3.4, base + 7 + (i % 2), (i % 2) * 1.5 - 0.5, 5 + (i % 2) * 0.8, 0.6);
  for (let i = 0; i < 4; i++) puff(-4 + i * 3, base + 12.5, 0.3 * i, 4.6, 0.8);
  for (let i = 0; i < 9; i++)
    puff(-17 + i * 4.4, base + 17 + (i % 2) * 0.5, (i % 3) * 0.8 - 0.8, 4.2 - Math.abs(i - 4) * 0.25, 0.9);
  const cloud = cb.build().group;
  // a fragment is clipped only when it is outside *both* planes: that removes just the front-right block
  cloud.traverse((o) => {
    if (o instanceof Mesh) for (const m of [o.material].flat()) m.clipIntersection = true;
  });
  cloud.add(front.build().group, side.build().group);
  group.add(cloud);
  // the planes in cloud space (metres); copied to world space every frame
  const local = [
    [keepZ, new Plane(new Vector3(0, 0, -1), CUT)],
    [keepX, new Plane(new Vector3(-1, 0, 0), CUT_X)],
    [capX, new Plane(new Vector3(1, 0, 0), -CUT_X)],
    [capZ, new Plane(new Vector3(0, 0, 1), -CUT)],
  ] as const;

  return {
    group,
    rodTip,
    treeTop,
    cloudBase: new Vector3(-2, base - 0.8, 2.6),
    core: new Vector3(CUT_X + 8, base + 8, CUT + 0.6),
    cloudTop: new Vector3(CUT_X + 6, base + 17.5, CUT + 0.4),
    rod,
    update(dt, t) {
      wood.update?.(dt, t);
      cloud.position.x = Math.sin(t * 0.25) * 0.5; // the cloud drifts a little
      cloud.updateWorldMatrix(true, false);
      for (const [world, own] of local) world.copy(own).applyMatrix4(cloud.matrixWorld); // planes are world-space
    },
  };
}
