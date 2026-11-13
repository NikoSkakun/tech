import { Group, Mesh, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): the white wall box of the inverter with its
 * dark lower band and, across the front, one glowing period of the sine it makes (two half-rings).
 */
export default function emblem(): Group {
  const g = new Group();
  const body = new Mesh(
    new RoundedBoxGeometry(1.05, 1.3, 0.42, 4, 0.12),
    K.toon({ gradient: { bottom: 'violet', top: 'white', range: [-0.62, -0.1] }, gloss: 0.5 }),
  );
  const wave = K.glow({ color: SEMANTIC.current, intensity: 1.7, keepHue: true, whiten: 0.1 });
  const up = new Mesh(new TorusGeometry(0.2, 0.05, 10, 24, Math.PI), wave);
  up.position.set(-0.2, 0.2, 0.24);
  const down = new Mesh(new TorusGeometry(0.2, 0.05, 10, 24, Math.PI), wave);
  down.position.set(0.2, 0.2, 0.24);
  down.rotation.z = Math.PI;
  g.add(body, up, down);
  g.rotation.set(0.1, -0.45, 0);
  return g;
}
