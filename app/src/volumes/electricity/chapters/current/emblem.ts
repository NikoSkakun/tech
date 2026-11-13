import { Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a closed loop of wire with a glowing lamp
 * on it and one electron running round — «електричне коло».
 */
export default function emblem(): Group {
  const g = new Group();
  const loop = new Mesh(
    new TorusGeometry(0.7, 0.1, 14, 56),
    K.toon({ color: 'steel', gloss: 0.4, rim: 1.2 }),
  );
  loop.rotation.x = 0.35;
  const lamp = new Mesh(
    new SphereGeometry(0.34, 28, 20),
    K.glow({ color: SEMANTIC.current, intensity: 1.7, falloff: 0.6 }),
  );
  lamp.position.set(0, 0.6, -0.2);
  const electron = new Mesh(
    new SphereGeometry(0.19, 20, 14),
    K.glow({ color: SEMANTIC.electron, intensity: 1.6, falloff: 0.4, whiten: 0, keepHue: true }),
  );
  electron.position.set(0.55, -0.44, 0.16);
  g.add(loop, lamp, electron);
  return g;
}
