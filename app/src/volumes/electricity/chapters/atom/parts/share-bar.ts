/**
 * ShareBar — a chunky vertical "test tube" that shows how a whole splits into a huge share and a sliver:
 * the mass of an atom (nucleus 99,97 % vs electrons) and the mass of a proton (field energy ≈ 99 % vs quarks).
 * The sliver is drawn at its true height but never thinner than a visible glowing line.
 */
import { CapsuleGeometry, CylinderGeometry, Group, Mesh, Object3D } from 'three';
import { K, type ColorLike } from '@/style';

export interface ShareBarOptions {
  height?: number;
  radius?: number;
  /** Colour of the big share (bottom) and of the sliver (top). */
  major: ColorLike;
  minor: ColorLike;
  /** Share of the sliver, 0…1. */
  minorShare: number;
}

export interface ShareBar {
  group: Group;
  majorAnchor: Object3D;
  minorAnchor: Object3D;
}

export function createShareBar(opts: ShareBarOptions): ShareBar {
  const height = opts.height ?? 4.6;
  const radius = opts.radius ?? 0.32;
  const group = new Group();
  group.name = 'share-bar';
  const sliver = Math.max(height * opts.minorShare, 0.045);
  const body = height - sliver;
  const major = new Mesh(
    new CylinderGeometry(radius, radius, body, 40),
    K.toon({ color: opts.major, gloss: 0.5, rim: 1.1 }),
  );
  major.position.y = -height / 2 + body / 2;
  const minor = new Mesh(
    new CylinderGeometry(radius, radius, sliver, 40),
    K.glow({ color: opts.minor, intensity: 1.7, whiten: 0.2, keepHue: true }),
  );
  minor.position.y = height / 2 - sliver / 2;
  // glass tube around the column, with rounded ends, and two metal collars
  const tube = new Mesh(
    new CapsuleGeometry(radius + 0.09, height, 12, 40),
    K.glass({ color: 'mist', opacity: 0.16, edgeOpacity: 0.75 }),
  );
  const collarMaterial = K.metal({ color: 'steel' });
  const collars = [-1, 1].map((s) => {
    const collar = new Mesh(new CylinderGeometry(radius + 0.13, radius + 0.13, 0.12, 40), collarMaterial);
    collar.position.y = s * (height / 2 + 0.02);
    return collar;
  });
  const majorAnchor = new Object3D();
  majorAnchor.position.set(-radius - 0.1, -height * 0.12, 0);
  const minorAnchor = new Object3D();
  minorAnchor.position.set(-radius - 0.1, height / 2 - sliver / 2, 0);
  group.add(major, minor, tube, ...collars, majorAnchor, minorAnchor);
  return { group, majorAnchor, minorAnchor };
}
