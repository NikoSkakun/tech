/**
 * Size analogies for the atom's true proportions (step `anatomy`): a toy stadium with a green pea on the
 * centre spot («горошина / стадіон») and a toy city with a football in its central square («м’яч / місто»).
 * Both are ~3 units across with their origin on the ground under the pea / ball.
 */
import {
  CylinderGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Rng } from '@/engine/api';
import { createHalo } from '@/fx';
import { K, col } from '@/style';

export interface Analogy {
  group: Group;
  /** The pea / ball — the stand-in for the nucleus. */
  marker: Mesh;
}

export function createStadium(): Analogy {
  const group = new Group();
  group.name = 'analogy-stadium';
  // bowl: closed lathe profile (outer wall up, stands down to the pitch) — a chunky ring of terraces
  const profile = [
    [0.86, 0],
    [1.62, 0],
    [1.7, 0.1],
    [1.66, 0.74],
    [1.56, 0.8],
    [1.44, 0.74],
    [0.9, 0.12],
    [0.86, 0],
  ].map(([x, y]) => new Vector2(x, y));
  const bowl = new Mesh(
    new LatheGeometry(profile, 72),
    K.toon({ gradient: { bottom: 'slate', top: 'mist', range: [0, 0.8] }, rim: 0.8 }),
  );
  const pitch = new Mesh(new CylinderGeometry(0.88, 0.88, 0.05, 64), K.toon({ color: 'green', rim: 0.3 }));
  pitch.position.y = 0.02;
  const lines = new Mesh(new TorusGeometry(0.2, 0.008, 6, 48), K.flat('white'));
  lines.rotation.x = Math.PI / 2;
  lines.position.y = 0.05;
  // terraces: three seat rows following the bowl's slope
  const seats = K.toon({ color: 'steel', rim: 0.5 });
  const rows = [0.25, 0.5, 0.75].map((k) => {
    const row = new Mesh(new TorusGeometry(0.9 + 0.54 * k, 0.03, 8, 72), seats);
    row.rotation.x = Math.PI / 2;
    row.position.y = 0.14 + 0.62 * k;
    return row;
  });
  // floodlight masts with glowing heads
  const mastMaterial = K.toon({ color: 'mist' });
  const lamp = K.glow({ color: 'white', intensity: 1.6, keepHue: true });
  const masts: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const mast = new Mesh(new CylinderGeometry(0.02, 0.03, 0.75, 8), mastMaterial);
    mast.position.set(Math.cos(a) * 1.72, 0.95, Math.sin(a) * 1.72);
    const head = new Mesh(new SphereGeometry(0.07, 12, 8), lamp);
    head.position.set(Math.cos(a) * 1.68, 1.36, Math.sin(a) * 1.68);
    masts.push(mast, head);
  }
  const marker = new Mesh(
    new SphereGeometry(0.06, 20, 14),
    K.glow({ color: 'green', intensity: 2, whiten: 0.3 }),
  );
  marker.position.y = 0.11;
  const halo = createHalo({ color: 'green', size: 0.5, intensity: 1.1 });
  halo.position.y = 0.11;
  for (const m of [bowl, pitch]) m.receiveShadow = true;
  group.add(bowl, pitch, lines, ...rows, ...masts, marker, halo);
  return { group, marker };
}

export function createCity(rng: Rng): Analogy {
  const group = new Group();
  group.name = 'analogy-city';
  const ground = new Mesh(
    new CylinderGeometry(1.75, 1.6, 0.14, 64),
    K.toon({ gradient: { bottom: 'bg.indigo', top: 'slate', range: [-0.07, 0.07] } }),
  );
  ground.position.y = -0.07;
  // blocks of the city: instanced rounded boxes on a street grid, leaving a central square free
  const cells: [number, number, number][] = [];
  const pitch = 0.4;
  for (let i = -4; i <= 4; i++)
    for (let j = -4; j <= 4; j++) {
      const x = i * pitch;
      const z = j * pitch;
      const d = Math.hypot(x, z);
      if (d > 1.55 || d < 0.3) continue;
      cells.push([x, z, rng.range(0.14, 0.34) + (d < 0.9 ? rng.range(0.1, 0.4) : 0)]);
    }
  const blocks = new InstancedMesh(
    new RoundedBoxGeometry(0.28, 1, 0.28, 3, 0.035),
    K.toon({ color: 'white', rim: 0.6 }),
    cells.length,
  );
  const m = new Matrix4();
  const shades = [col('steel'), col('mist'), col('slate'), col('sky')];
  cells.forEach(([x, z, h], i) => {
    m.makeScale(1, h, 1).setPosition(x, h / 2, z);
    blocks.setMatrixAt(i, m);
    blocks.setColorAt(i, shades[rng.int(0, 2 + (rng.next() < 0.15 ? 1 : 0))]!);
  });
  blocks.castShadow = true;
  const marker = new Mesh(new SphereGeometry(0.07, 20, 14), K.glow({ color: 'white', intensity: 1.8 }));
  marker.position.y = 0.08;
  const halo = createHalo({ color: 'white', size: 0.55, intensity: 1 });
  halo.position.y = 0.08;
  group.add(ground, blocks, marker, halo);
  return { group, marker };
}
