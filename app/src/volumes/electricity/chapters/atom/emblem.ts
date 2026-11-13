import { Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a coral nucleus with two crossed electron
 * orbits — the classic "atom" pictogram in the course's semantic colours.
 */
export default function emblem(): Group {
  const g = new Group();
  const nucleus = new Mesh(
    new SphereGeometry(0.34, 28, 20),
    K.toon({ color: SEMANTIC.proton, gloss: 0.6, rim: 1.2 }),
  );
  const ring = new TorusGeometry(0.86, 0.045, 10, 64);
  const orbit = K.glow({ color: SEMANTIC.electron, intensity: 1.6, falloff: 0 });
  const a = new Mesh(ring, orbit);
  a.rotation.set(1.15, 0.5, 0);
  const b = new Mesh(ring, orbit);
  b.rotation.set(1.15, -0.5, 0);
  g.add(nucleus, a, b);
  return g;
}
