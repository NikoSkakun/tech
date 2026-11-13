import { BoxGeometry, Group, Mesh, SphereGeometry } from 'three';
import { G } from '@/kit';
import { K, col } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): a tilted solar module — frame, a grid of
 * blue cells — with a small glowing sun above its corner.
 */
export default function emblem(): Group {
  const g = new Group();
  const frame = new Mesh(new BoxGeometry(1.02, 0.07, 1.34), K.metal({ color: 'mist', specular: 0.7 }));
  // 3 × 4 cells in one merged geometry, lying just above the frame plate
  const cells: [number, number, number, number][] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) cells.push([(i - 1) * 0.31, (j - 1.5) * 0.31, 0.27, 0.27]);
  const glass = new Mesh(
    G.quads(cells, 0.04),
    K.toon({ color: col('bg.indigo').lerp(col('blue'), 0.55), gloss: 0.8, rim: 1.2 }),
  );
  const panel = new Group();
  panel.add(frame, glass);
  panel.rotation.set(0.95, 0, 0);
  panel.rotation.y = -0.35;
  panel.position.set(-0.08, -0.22, 0);
  const sun = new Mesh(
    new SphereGeometry(0.24, 24, 16),
    K.glow({ color: 'yellow', intensity: 1.8, whiten: 0.35 }),
  );
  sun.position.set(0.52, 0.62, 0.1);
  g.add(panel, sun);
  return g;
}
