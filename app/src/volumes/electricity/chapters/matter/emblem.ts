import { CylinderGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { G } from '@/kit';
import { K, SEMANTIC } from '@/style';

/**
 * Journey-map emblem (UI_API §9: unit sphere, static, ≤ 3 meshes): the copper unit cell of the chapter — a
 * `yellow` cube frame, `coral.dark` ion cores in its corners and face centres, and a few `cyan` electrons of the
 * sea between them.
 */
export default function emblem(): Group {
  const g = new Group();
  const h = 0.5;
  const sites: Vector3[] = [];
  for (const x of [-h, h]) for (const y of [-h, h]) for (const z of [-h, h]) sites.push(new Vector3(x, y, z));
  for (const s of [-h, h]) sites.push(new Vector3(s, 0, 0), new Vector3(0, s, 0), new Vector3(0, 0, s));
  const ions = G.mergeGeometries(sites.map((p) => new SphereGeometry(0.15, 24, 16).translate(p.x, p.y, p.z)));
  const edges: CylinderGeometry[] = [];
  for (const a of [0, 1, 2])
    for (const u of [-h, h])
      for (const v of [-h, h]) {
        const e = new CylinderGeometry(0.025, 0.025, 2 * h, 8);
        if (a === 0) e.rotateZ(Math.PI / 2).translate(0, u, v);
        else if (a === 1) e.translate(u, 0, v);
        else e.rotateX(Math.PI / 2).translate(u, v, 0);
        edges.push(e);
      }
  const sea = [
    [0.25, 0.27, 0.2],
    [-0.27, -0.2, 0.25],
    [0.2, -0.28, -0.24],
    [-0.22, 0.24, -0.27],
  ].map(([x, y, z]) => new SphereGeometry(0.07, 16, 12).translate(x!, y!, z!));
  g.add(
    new Mesh(ions, K.toon({ color: 'coral.dark', gloss: 0.6, rim: 1.2 })),
    new Mesh(G.mergeGeometries(edges), K.glow({ color: 'yellow', whiten: 0, keepHue: true, intensity: 1.4 })),
    new Mesh(
      G.mergeGeometries(sea),
      K.glow({ color: SEMANTIC.electron, whiten: 0, keepHue: true, intensity: 1.5 }),
    ),
  );
  g.rotation.set(0.45, 0.6, 0);
  return g;
}
