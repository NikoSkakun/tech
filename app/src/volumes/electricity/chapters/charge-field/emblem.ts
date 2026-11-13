import { Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { G } from '@/kit';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a `coral` «+» and a `cyan` «−» charge joined
 * by three `amber` field lines — the dipole picture of the chapter.
 */
export default function emblem(): Group {
  const g = new Group();
  const ball = new SphereGeometry(0.27, 28, 20);
  const plus = new Mesh(ball, K.toon({ color: SEMANTIC.proton, gloss: 0.6, rim: 1.2 }));
  plus.position.x = -0.56;
  const minus = new Mesh(
    ball,
    K.glow({ color: SEMANTIC.electron, whiten: 0, keepHue: true, intensity: 1.4 }),
  );
  minus.position.x = 0.56;
  // three arcs from one charge to the other: the middle one straight, two bulging above and below
  const arcs = [-1, 0, 1].map((k) => {
    if (k === 0)
      return new TorusGeometry(4, 0.035, 8, 24, 0.14).rotateZ(Math.PI / 2 - 0.07).translate(0, -4, 0);
    const r = 0.72;
    const a = new TorusGeometry(r, 0.035, 8, 40, Math.PI * 0.72).rotateZ(Math.PI * 0.14);
    return a.translate(0, -0.42, 0).scale(1, k, 1);
  });
  const lines = new Mesh(
    G.mergeGeometries(arcs),
    K.glow({ color: SEMANTIC.fieldE, whiten: 0, keepHue: true, intensity: 1.6 }),
  );
  g.add(plus, minus, lines);
  return g;
}
