import { Group, Mesh, SphereGeometry, TorusGeometry } from 'three';
import { K } from '@/style';

/** Journey-map emblem of the UI sandbox: follows the convention of docs/UI_API.md §9 (unit sphere, static). */
export default function emblem(): Group {
  const g = new Group();
  const core = new Mesh(new SphereGeometry(0.5, 28, 20), K.toon({ color: 'coral', gloss: 0.5 }));
  const ring = new Mesh(
    new TorusGeometry(0.82, 0.07, 10, 48),
    K.glow({ color: 'cyan', intensity: 1.6, falloff: 0 }),
  );
  ring.rotation.x = 1.25;
  g.add(core, ring);
  return g;
}
