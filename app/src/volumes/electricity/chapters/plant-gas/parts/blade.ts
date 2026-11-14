/**
 * Macro model of a first-stage turbine blade (step 5), drawn ≈ ×14 (real span ≈ 25 cm): a cambered aerofoil
 * of translucent metal on a fir-tree root and platform; inside, a serpentine cooling channel (`sky`); rows of
 * film-cooling holes on the leading edge and the pressure side; a thin ceramic coat (`mist` shell). Local
 * frame: span along +Y from the platform, chord along X (hot gas flows toward +X), pressure side toward +Z.
 */
import { Group, InstancedMesh, Matrix4, Mesh, Vector3, type BufferGeometry } from 'three';
import { G } from '@/kit';
import { K, type KGlassMaterial } from '@/style';

export const BLADE = { chord: 1.8, span: 3.2, thick: 0.52 } as const;

/** Aerofoil outline in the XZ plane (x along the chord, z toward the pressure side), closed. */
function profile(scale = 1): [number, number][] {
  const pts: [number, number][] = [];
  const N = 28;
  const c = BLADE.chord / 2;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // suction side, LE → TE
    const x = -c + 2 * c * t;
    const camber = 0.32 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
    const half = BLADE.thick * 0.5 * Math.sqrt(Math.sin(Math.PI * Math.min(1, t * 1.05))) * (1 - 0.75 * t);
    pts.push([x * scale, (-camber - half) * scale]);
  }
  for (let i = N - 1; i >= 1; i--) {
    const t = i / N; // pressure side, TE → LE
    const x = -c + 2 * c * t;
    const camber = 0.32 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
    const half = BLADE.thick * 0.5 * Math.sqrt(Math.sin(Math.PI * t)) * (1 - 0.75 * t);
    pts.push([x * scale, (-camber + half * 0.6) * scale]);
  }
  return pts;
}

/** Point on the pressure (+) or suction (−) surface at chord fraction t and height y (local). */
export function bladeSurface(t: number, y: number, side: 1 | -1, out = new Vector3()): Vector3 {
  const c = BLADE.chord / 2;
  const camber = 0.32 * Math.sin(Math.PI * t) * (1 - 0.3 * t);
  const half = BLADE.thick * 0.5 * Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * (1 - 0.75 * t);
  return out.set(-c + 2 * c * t, y, -camber + (side > 0 ? half * 0.6 : -half));
}

/** The extrusion may be centred on its depth: put its base on y = 0. */
function centreOnSpan(geo: BufferGeometry): void {
  geo.computeBoundingBox();
  const minY = geo.boundingBox?.min.y ?? 0;
  if (Math.abs(minY) > 1e-3) geo.translate(0, -minY, 0);
}

export interface Blade {
  group: Group;
  metal: KGlassMaterial;
  coat: Mesh;
  channel: Vector3[];
  holes: Vector3[];
}

export function buildBlade(): Blade {
  const group = new Group();
  group.name = 'macro-blade';
  // aerofoil: extruded outline along +Y (extrude goes along +Z, so build in XY and turn)
  const toShape = (s: number): [number, number][] => profile(s).map(([x, z]) => [x, -z] as [number, number]);
  const airfoil = G.extrude(toShape(1), BLADE.span, {});
  airfoil.rotateX(-Math.PI / 2);
  centreOnSpan(airfoil);
  const metal = K.glass({ color: 'amber', opacity: 0.5 });
  const body = new Mesh(airfoil, metal);
  group.add(body);
  const coatGeo = G.extrude(toShape(1.07), BLADE.span * 0.99, {});
  coatGeo.rotateX(-Math.PI / 2);
  centreOnSpan(coatGeo);
  const coat = new Mesh(coatGeo, K.glass({ color: 'mist', opacity: 0.28 }));
  coat.position.y = 0.01;
  group.add(coat);
  // platform and fir-tree root
  const steel = K.metal({ color: 'steel' });
  const platform = new Mesh(G.rbox(2.3, 0.22, 1.2, 0.06), steel);
  platform.position.set(0, -0.11, -0.05);
  group.add(platform);
  for (let k = 0; k < 4; k++) {
    const w = 0.9 - k * 0.14;
    const tooth = new Mesh(G.rbox(1.5, 0.2, w, 0.05), steel);
    tooth.position.set(0, -0.36 - k * 0.24, -0.05);
    group.add(tooth);
  }
  // serpentine cooling channel: up near the LE, down the middle, up near the TE, out at the tip
  const xs = [-0.55, -0.1, 0.35];
  const channel: Vector3[] = [new Vector3(-0.55, -0.9, -0.12)];
  xs.forEach((x, i) => {
    const t = (x + BLADE.chord / 2) / BLADE.chord;
    const zc = -0.32 * Math.sin(Math.PI * t) * (1 - 0.3 * t) - 0.04;
    const up = i % 2 === 0;
    channel.push(new Vector3(x, up ? 0.2 : BLADE.span - 0.25, zc), new Vector3(x, up ? BLADE.span - 0.25 : 0.2, zc));
  });
  channel.push(new Vector3(0.35, BLADE.span + 0.2, -0.1));
  const tube = new Mesh(G.tube(G.roundPath(channel, 0.25), 0.09, {}), K.toon({ color: 'sky', emissive: 'sky', emissiveIntensity: 0.25 }));
  group.add(tube);
  // film-cooling holes: a column on the leading edge and two on the pressure side
  const holes: Vector3[] = [];
  for (const t of [0.03, 0.22, 0.42])
    for (let k = 0; k < 9; k++) holes.push(bladeSurface(t, 0.3 + k * 0.33, t < 0.05 ? -1 : 1));
  const dots = new InstancedMesh(G.sphere(0.035, 8), K.toon({ color: 'ink' }), holes.length);
  const m4 = new Matrix4();
  holes.forEach((h, i) => dots.setMatrixAt(i, m4.makeTranslation(h.x, h.y, h.z)));
  group.add(dots);
  return { group, metal, coat, channel, holes };
}
