/**
 * The highlighted unit cell of step 1: a `yellow` glowing cube frame around one cell of the copper block, and the
 * cell's share of atoms cut out of their spheres — 8 corner eighths and 6 face halves. `explode` lifts the cell
 * out of the block and pulls the pieces apart (the «вибухова» animation that counts 8·⅛ + 6·½ = 4 atoms).
 */
import {
  type BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  SphereGeometry,
  Vector3,
} from 'three';
import { G } from '@/kit';
import { K } from '@/style';

export interface UnitCell {
  group: Group;
  /** 0 = in place inside the block, 1 = lifted out and exploded. */
  explode: number;
  /** World-space anchors for callouts (local to `group`'s parent after `update`). */
  corner: Mesh;
  face: Mesh;
  update(t: number): void;
}

function octant(r: number): BufferGeometry {
  const shell = new SphereGeometry(r, 16, 8, Math.PI / 2, Math.PI / 2, 0, Math.PI / 2);
  const q = (): CircleGeometry => new CircleGeometry(r, 10, 0, Math.PI / 2);
  return G.mergeGeometries([
    shell.toNonIndexed(),
    q().toNonIndexed(),
    q()
      .rotateY(-Math.PI / 2)
      .toNonIndexed(),
    q()
      .rotateX(Math.PI / 2)
      .toNonIndexed(),
  ]);
}

function half(r: number): BufferGeometry {
  const shell = new SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cap = new CircleGeometry(r, 24).rotateX(Math.PI / 2);
  return G.mergeGeometries([shell.toNonIndexed(), cap.toNonIndexed()]);
}

/** `a` = cell edge, `r` = drawn atom radius (larger than the block's ions so the cut pieces read). */
export function createUnitCell(a: number, r: number, centre: Vector3): UnitCell {
  const group = new Group();
  group.name = 'unit-cell';
  const home = centre.clone();
  group.position.copy(home);
  const h = a / 2;
  // frame: 12 glowing edges
  const edges: BufferGeometry[] = [];
  for (const axis of [0, 1, 2])
    for (const u of [-h, h])
      for (const v of [-h, h]) {
        const e = new CylinderGeometry(0.022, 0.022, a + 0.044, 8);
        if (axis === 0) e.rotateZ(Math.PI / 2).translate(0, u, v);
        else if (axis === 1) e.translate(u, 0, v);
        else e.rotateX(Math.PI / 2).translate(u, v, 0);
        edges.push(e);
      }
  const frame = new Mesh(
    G.mergeGeometries(edges),
    K.glow({ color: 'yellow', whiten: 0, keepHue: true, intensity: 1.5 }),
  );
  group.add(frame);
  const mat = K.toon({ color: 'coral.dark', gloss: 0.5, rim: 1 });
  mat.side = DoubleSide;
  const oct = octant(r);
  const hemi = half(r);
  const pieces: { mesh: Mesh; home: Vector3; dir: Vector3 }[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        // the corner atom's eighth that lies inside the cell points toward the centre
        const m = new Mesh(oct, mat);
        m.scale.set(-sx, -sy, -sz);
        const p = new Vector3(sx * h, sy * h, sz * h);
        pieces.push({ mesh: m, home: p, dir: p.clone().normalize() });
      }
  const faces: [Vector3, [number, number, number]][] = [
    [new Vector3(h, 0, 0), [0, 0, Math.PI / 2]],
    [new Vector3(-h, 0, 0), [0, 0, -Math.PI / 2]],
    [new Vector3(0, h, 0), [Math.PI, 0, 0]],
    [new Vector3(0, -h, 0), [0, 0, 0]],
    [new Vector3(0, 0, h), [-Math.PI / 2, 0, 0]],
    [new Vector3(0, 0, -h), [Math.PI / 2, 0, 0]],
  ];
  for (const [p, rot] of faces) {
    const m = new Mesh(hemi, mat);
    m.rotation.set(rot[0], rot[1], rot[2]);
    pieces.push({ mesh: m, home: p, dir: p.clone().normalize() });
  }
  for (const p of pieces) {
    p.mesh.position.copy(p.home);
    group.add(p.mesh);
  }
  const lift = new Vector3(a * 2.3, a * 0.5, a * 1.7);
  const cell: UnitCell = {
    group,
    explode: 0,
    corner: pieces[7]!.mesh,
    face: pieces[12]!.mesh,
    update(t) {
      const e = cell.explode;
      const out = Math.min(e / 0.5, 1);
      const apart = Math.max((e - 0.4) / 0.6, 0);
      const ease = (x: number): number => x * x * (3 - 2 * x);
      group.position.copy(home).addScaledVector(lift, ease(out));
      group.scale.setScalar(1 + 0.8 * ease(out));
      group.rotation.y = 0.5 * ease(out) + 0.08 * Math.sin(t * 0.6) * out;
      for (const p of pieces) p.mesh.position.copy(p.home).addScaledVector(p.dir, a * 0.55 * ease(apart));
      frame.scale.setScalar(1 + 0.25 * ease(apart));
    },
  };
  return cell;
}
