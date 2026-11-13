/**
 * Step 2 «циліндр повітря»: the air that will pass through the rotor, cut into slices of length v·1 s — one
 * slice goes through the rotor every second. A faster wind makes every slice longer (more mass per second:
 * ρ·A·v) *and* the molecules inside faster (more energy per kilogram: ½·v²) — the picture of v·v² = v³.
 * Drawn to the hero's scale and in real time: a slice of 8 m/s wind is 8 m of the 170 m machine.
 * Local frame: +X = downwind, origin = centre of the rotor disc.
 */
import { CircleGeometry, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createOrbs, type Orbs } from '@/fx';
import { K, col } from '@/style';

const SLICES = 44;
const MOLECULES = 260;

export interface AirColumn {
  group: Group;
  /** Slice length = distance the air travels in one second, toy metres. */
  slice: number;
  /** Radius of the swept disc, toy metres. */
  radius: number;
  /** Length of the column shown upstream of the rotor, toy metres. */
  readonly length: number;
  update(dt: number): void;
}

export function buildAirColumn(ctx: ChapterContext, length: number): AirColumn {
  const group = new Group();
  group.name = 'air-column';
  // the shell: `sky` at 15 % opacity (document), both faces so the far wall reads through the near one
  const shell = new Mesh(
    new CylinderGeometry(1, 1, 1, 64, 1, true).rotateZ(Math.PI / 2).translate(-0.5, 0, 0),
    K.toon({ color: 'sky', opacity: 0.15, highlight: 0, rim: 0.6, side: DoubleSide }),
  );
  shell.material.depthWrite = false;
  shell.renderOrder = 3;
  // slice faces: thin discs marching toward the rotor, one per second
  const disc = new CircleGeometry(1, 56).rotateY(Math.PI / 2);
  const faceMat = K.toon({ color: col('sky').lerp(col('white'), 0.35), opacity: 0.2, highlight: 0, rim: 0, side: DoubleSide });
  faceMat.depthWrite = false;
  const faces = new InstancedMesh(disc, faceMat, SLICES);
  faces.renderOrder = 3;
  faces.frustumCulled = false;
  const ringMat = K.glow({ color: col('sky').lerp(col('white'), 0.7), intensity: 0.95, whiten: 0 });
  const rims = new InstancedMesh(new CylinderGeometry(1, 1, 0.012, 64, 1, true).rotateZ(Math.PI / 2), ringMat, SLICES);
  rims.frustumCulled = false;
  // molecules: unit-disc coordinates, advected with the wind on the CPU
  const rng = ctx.random.fork('air');
  const n = ctx.quality.count(MOLECULES, 110);
  const orbs: Orbs = createOrbs({ kind: 'blob', count: n, radius: 0.34, color: 'white', shade: 'sky' });
  const mol = Array.from({ length: n }, () => {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 0.94;
    return { u: rng.next(), y: Math.cos(a) * r, z: Math.sin(a) * r, s: rng.range(0.6, 1.3) };
  });
  group.add(shell, faces, rims, orbs);

  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  let phase = 0; // 0…1 within the slice that is entering the rotor
  const column: AirColumn = {
    group,
    slice: 3,
    radius: 30,
    length,
    update(dt) {
      const { slice, radius } = column;
      shell.scale.set(length, radius, radius);
      // one slice per second, whatever the wind: the slice length carries the speed
      phase = (phase + dt) % 1;
      const visible = slice > length / SLICES; // thinner slices would smear into one haze
      const count = visible ? Math.min(SLICES, Math.ceil(length / Math.max(slice, 1e-3)) + 1) : 0;
      for (let i = 0; i < SLICES; i++) {
        const x = -(i - phase) * slice;
        const on = i < count && x <= 0 && x >= -length;
        m.compose(p.set(on ? x : 0, on ? 0 : -9999, 0), q, s.setScalar(radius));
        faces.setMatrixAt(i, m);
        m.compose(p, q, s.set(0.16 / 0.012, radius, radius)); // a 16 cm hoop
        rims.setMatrixAt(i, m);
      }
      faces.instanceMatrix.needsUpdate = true;
      rims.instanceMatrix.needsUpdate = true;
      // molecules travel one slice per second
      const du = (slice * dt) / length;
      for (let i = 0; i < n; i++) {
        const k = mol[i]!;
        k.u = (k.u + du) % 1;
        const edge = Math.min(1, k.u * 12, (1 - k.u) * 12); // grow in at the far end, vanish into the rotor
        orbs.setPosition(i, (k.u - 1) * length, k.y * radius, k.z * radius, k.s * edge);
      }
      orbs.commit();
    },
  };
  return column;
}
