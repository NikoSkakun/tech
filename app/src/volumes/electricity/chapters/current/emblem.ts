import { Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a closed copper loop with a glowing lamp
 * sitting in it and one electron on the wire — «електричне коло».
 */
export default function emblem(): Group {
  const g = new Group();
  const loop = new Mesh(
    new TorusGeometry(0.7, 0.1, 14, 56),
    K.toon({ color: 'orange', gloss: 0.7, rim: 1.2 }), // copper: reads as a wire on the dark map
  );
  loop.rotation.x = 0.35;
  const lamp = new Mesh(
    new SphereGeometry(0.34, 28, 20),
    K.glow({ color: SEMANTIC.current, intensity: 1.7, falloff: 0.6 }),
  );
  lamp.position.set(0, 0.68, 0.24); // sits on the loop, in the circuit
  const electron = new Mesh(
    new SphereGeometry(0.19, 20, 14),
    K.glow({ color: SEMANTIC.electron, intensity: 1.6, falloff: 0.4, whiten: 0, keepHue: true }),
  );
  electron.position.set(0.5, -0.46, -0.15); // on the wire
  g.add(loop, lamp, electron);
  return g;
}
