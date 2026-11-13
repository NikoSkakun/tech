/**
 * Stand-alone water pieces for scenes that do not get their water from `island()`: a lake / pond disc, a
 * river ribbon along a path (foam on both banks), an open sea plate, and a white shoreline foam strip.
 * All use the engine's `K.water`; the meshes are built in the XY plane and laid flat, as `K.water` expects.
 * Units: metres.
 */
import { BufferGeometry, CircleGeometry, Float32BufferAttribute, Mesh, type Vector3 } from 'three';
import { K, type ColorLike } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { sideAt, addRibbon, offsetPath } from './ribbon';

export interface WaterOptions {
  shallow?: ColorLike;
  deep?: ColorLike;
  /** World-space size of the glint pattern — set it to (radius or width) / 6 in *world* units after scaling. */
  scale?: number;
  glints?: number;
  /** Pattern follows `env.setScale(…, { adaptFrom })` (`K.water({ followLook })`, M3). Default false. */
  followLook?: boolean;
}

function flat(mesh: Mesh, y: number): Mesh {
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
}

/** Round lake / pond with foam rings at its rim. */
export function waterDisc(radius: number, y = 0, o: WaterOptions = {}): KitModel {
  const b = new Builder('water-disc');
  b.attach(flat(new Mesh(new CircleGeometry(radius, 64), K.water({ shallow: o.shallow ?? 'sky', deep: o.deep ?? 'blue', shape: 'disc', scale: o.scale ?? radius / 6, glints: o.glints ?? 0.6, followLook: o.followLook })), y));
  return b.build();
}

/** Open sea plate without shores (put it under / around a slab island). */
export function seaPlate(radius: number, y = 0, o: WaterOptions = {}): KitModel {
  const b = new Builder('sea');
  b.attach(flat(new Mesh(new CircleGeometry(radius, 64), K.water({ shallow: o.shallow ?? 'sky', deep: o.deep ?? 'blue', shape: 'open', scale: o.scale ?? radius / 10, glints: o.glints ?? 0.7, followLook: o.followLook })), y));
  return b.build();
}

/** River ribbon of the given width along a path (y taken from the path): foam along both banks, flow glints. */
export function waterRibbon(path: readonly Vector3[], width: number, o: WaterOptions = {}): KitModel {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let dist = 0;
  path.forEach((p, i) => {
    if (i > 0) dist += p.distanceTo(path[i - 1]!);
    const side = sideAt(path, i);
    // XY-plane geometry (x, −z) laid flat afterwards; the height of each sample goes into local z
    pos.push(p.x + side.x * (width / 2), -(p.z + side.z * (width / 2)), p.y, p.x - side.x * (width / 2), -(p.z - side.z * (width / 2)), p.y);
    uv.push(dist / width, 0, dist / width, 1);
    if (i < path.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const b = new Builder('river');
  b.attach(flat(new Mesh(g, K.water({ shallow: o.shallow ?? 'sky', deep: o.deep ?? 'blue', shape: 'strip', scale: o.scale ?? width / 4, glints: o.glints ?? 0.6, followLook: o.followLook })), 0));
  b.path('centre', path);
  return b.build();
}

/** Crisp white foam line along a shoreline path (a slightly raised matte ribbon). */
export function foamStrip(path: readonly Vector3[], width = 0.6): KitModel {
  const b = new Builder('foam');
  addRibbon(b, offsetPath(path, 0, 0.03), width, { c: 'white', thickness: 0.05 });
  return b.build();
}
