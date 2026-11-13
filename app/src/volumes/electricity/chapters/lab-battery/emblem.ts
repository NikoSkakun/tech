import { CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a chunky Li-ion cell with the DC «+» cap
 * and a glowing Li⁺ ion beside it.
 */
export default function emblem(): Group {
  const g = new Group();
  const body = new Mesh(
    new CylinderGeometry(0.4, 0.4, 1.25, 40, 1),
    K.toon({ gradient: { bottom: 'teal', top: 'lime', range: [-0.62, 0.62] }, gloss: 0.5 }),
  );
  body.position.y = -0.1;
  const cap = new Mesh(
    new CylinderGeometry(0.2, 0.24, 0.2, 32),
    K.toon({ color: SEMANTIC.dcPlus, gloss: 0.5 }),
  );
  cap.position.y = 0.62;
  const ion = new Mesh(
    new SphereGeometry(0.2, 24, 16),
    K.glow({ color: 'lime', intensity: 1.7, keepHue: true, whiten: 0.15 }),
  );
  ion.position.set(0.66, 0.3, 0.3);
  g.add(body, cap, ion);
  g.rotation.z = -0.3;
  return g;
}
