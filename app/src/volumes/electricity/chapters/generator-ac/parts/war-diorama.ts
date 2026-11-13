/**
 * Diorama of step 3 «Війна струмів»: two toy streets of the 1880s on the turntable. Left (x < 0): Edison's DC
 * station (brick, sign «1882») feeding its neighbourhood through two thick copper wires. Right (x > 0):
 * Westinghouse's AC station with a step-up transformer, a high-voltage line on poles running to the edge and a
 * step-down "barrel" transformer at the neighbourhood; the line continues to a far city silhouette. Each
 * neighbourhood (houses + street lamps) slides along its street to the chosen distance (`setDistance`).
 * Streets run along −Z from the stations at the front. Origin = centre of the turntable.
 */
import { CylinderGeometry, Group, Mesh } from 'three';
import { Builder, house, instanced, type KitModel } from '@/kit';
import { K } from '@/style';
import { COPPER } from '../world';

export const STREET_X = 2.25;
/** z of the stations' doors and of the far end of the streets. */
export const Z_NEAR = 1.55;
export const Z_FAR = -3.7;
const D_MIN = 0.2;
const D_MAX = 10;

/** Position along a street (z) for a distance in km (log scale: 0,2 km near the station … 10 km at the far end). */
export function streetZ(km: number): number {
  const f = Math.log(Math.max(D_MIN, Math.min(D_MAX, km)) / D_MIN) / Math.log(D_MAX / D_MIN);
  return Z_NEAR - 0.5 - f * (Z_NEAR - 0.5 - Z_FAR);
}

export interface Street {
  /** The neighbourhood that slides along the street. */
  cluster: Group;
  /** Glow material of its street-lamp heads (brightness ∝ lamp power). */
  lampGlow: ReturnType<typeof K.glow>;
}

export interface WarDiorama {
  group: Group;
  dc: Street & { wire: Mesh[]; wireMat: ReturnType<typeof K.metal>; station: KitModel };
  ac: Street & { station: KitModel; poleTransformer: Group; city: KitModel; line: Group };
  setDistance(km: number): void;
}

function station(kind: 'dc' | 'ac'): KitModel {
  const b = new Builder(`station-${kind}`);
  const wall = kind === 'dc' ? (['orange.dark', 'coral.dark'] as const) : (['slate', 'mist'] as const);
  b.box(1.5, 1.0, 1.1, { r: 0.05, c: [wall[0], wall[1]] });
  b.box(1.65, 0.12, 1.25, { r: 0.04, c: 'ink', at: [0, 1.0, 0] });
  b.box(1.3, 0.35, 0.9, { r: 0.06, c: kind === 'dc' ? 'coral.dark' : 'steel', at: [0, 1.12, 0] });
  b.cyl(0.12, 1.0, { c: ['slate', 'ink'], at: [0.45, 1.1, -0.25] }); // chimney / stack
  for (const x of [-0.45, 0, 0.45]) b.box(0.26, 0.4, 0.02, { r: 0.02, slot: 'window', c: 'bg.indigo', at: [x, 0.35, 0.56] });
  b.box(0.36, 0.55, 0.03, { r: 0.02, c: 'ink', at: [0, 0, 0.56] });
  b.box(0.7, 0.2, 0.04, { r: 0.03, c: 'white', at: [0, 0.75, 0.58] }); // sign plate (the year is a world tag)
  b.anchor('sign', 0, 0.85, 0.62);
  b.anchor('dynamo', 0, 0.55, 0.2);
  b.anchor('out', kind === 'dc' ? 0.6 : 0.75, 0.4, -0.55);
  return b.build();
}

/** A neighbourhood: three small houses (instanced kit houses) and three lamp posts with glowing heads. */
function neighbourhood(side: -1 | 1, glowColor: 'yellow'): Street {
  const cluster = new Group();
  const homes = instanced(house({ seed: side < 0 ? 3 : 8, lit: 1 }), [
    { at: [side * 0.9, 0, 0.1], ry: side * Math.PI / 2, s: 0.075 },
    { at: [side * 0.95, 0, -0.75], ry: side * Math.PI / 2, s: 0.07 },
    { at: [-side * 0.85, 0, -0.4], ry: -side * Math.PI / 2, s: 0.068 },
  ]);
  cluster.add(homes);
  const lampGlow = K.glow({ color: glowColor, intensity: 1.6, keepHue: true, whiten: 0.2 });
  const b = new Builder('lamps');
  for (const z of [0.35, -0.3, -0.95]) {
    b.cyl(0.035, 0.75, { c: 'ink', slot: 'metal', at: [side * 0.35, 0, z] });
    b.box(0.2, 0.05, 0.05, { r: 0.01, c: 'ink', at: [side * 0.27, 0.75, z] });
  }
  cluster.add(b.build().group);
  for (const z of [0.35, -0.3, -0.95]) {
    const head = new Mesh(new CylinderGeometry(0.07, 0.11, 0.12, 16), lampGlow);
    head.position.set(side * 0.2, 0.72, z);
    cluster.add(head);
  }
  return { cluster, lampGlow };
}

/** Pole transformer «barrel» on a short pole (used at the station and at the neighbourhood). */
function barrel(b: Builder, at: [number, number, number], size = 1): void {
  b.frame({ at, s: size }, () => {
    b.cyl(0.04, 1.15, { c: 'wireBrown', at: [0, 0, 0] });
    b.cyl(0.16, 0.36, { c: ['steel', 'mist'], slot: 'metal', at: [0.12, 0.6, 0] });
    b.cyl(0.17, 0.04, { c: 'slate', slot: 'metal', at: [0.12, 0.96, 0] });
    for (const dx of [0.05, 0.19]) b.cyl(0.025, 0.12, { c: 'white', slot: 'gloss', at: [dx, 1.0, 0] });
  });
}

export function createWarDiorama(): WarDiorama {
  const group = new Group();
  group.name = 'war-diorama';
  const ground = new Builder('streets');
  for (const side of [-1, 1] as const) {
    ground.box(1.25, 0.04, Z_NEAR - Z_FAR + 0.4, { r: 0.02, c: 'ink', at: [side * STREET_X, 0, (Z_NEAR + Z_FAR) / 2 - 0.2] });
    for (let z = Z_NEAR - 0.6; z > Z_FAR; z -= 0.45) ground.box(0.05, 0.01, 0.22, { r: 0, c: 'mist', at: [side * STREET_X, 0.04, z] });
  }
  ground.box(0.14, 0.18, Z_NEAR - Z_FAR + 1.2, { r: 0.06, c: 'bg.violet', at: [0, 0, (Z_NEAR + Z_FAR) / 2] });
  group.add(ground.build().group);

  // --- DC street
  const dcStation = station('dc');
  dcStation.group.position.set(-STREET_X, 0, Z_NEAR + 0.75);
  const dcStreet = neighbourhood(-1, 'yellow');
  const wireMat = K.metal({ color: COPPER, specular: 0.8 });
  const wire = [-0.18, 0.18].map((dx) => {
    const m = new Mesh(new CylinderGeometry(0.05, 0.05, 1, 12).rotateX(Math.PI / 2).translate(0, 0, -0.5), wireMat);
    m.position.set(-STREET_X + 0.62 + dx, 0.42, Z_NEAR);
    m.castShadow = true;
    return m;
  });
  const dcPoles = new Builder('dc-poles');
  for (let z = Z_NEAR - 0.3; z > Z_FAR; z -= 0.9) dcPoles.cyl(0.04, 0.42, { c: 'wireBrown', at: [-STREET_X + 0.62, 0, z] });
  group.add(dcStation.group, dcStreet.cluster, ...wire, dcPoles.build().group);

  // --- AC street: step-up transformer, HV line on poles to the edge, step-down barrel at the neighbourhood
  const acStation = station('ac');
  acStation.group.position.set(STREET_X, 0, Z_NEAR + 0.75);
  const acStreet = neighbourhood(1, 'yellow');
  const lb = new Builder('hv-line');
  barrel(lb, [STREET_X - 0.62, 0, Z_NEAR + 0.15], 1);
  for (let z = Z_NEAR - 0.55; z > Z_FAR - 0.3; z -= 0.75) {
    lb.cyl(0.035, 1.25, { c: 'wireBrown', at: [STREET_X - 0.62, 0, z] });
    lb.box(0.36, 0.04, 0.04, { r: 0.01, c: 'wireBrown', at: [STREET_X - 0.62, 1.2, z] });
  }
  for (const dx of [-0.15, 0.15]) lb.rod([STREET_X - 0.62 + dx, 1.25, Z_NEAR + 0.15], [STREET_X - 0.62 + dx, 1.25, Z_FAR - 1.4], 0.012, { c: 'ink' });
  const line = lb.build().group;
  const poleTransformer = new Group();
  const pt = new Builder('pole-transformer');
  barrel(pt, [-0.62, 0, 0.75], 1);
  poleTransformer.add(pt.build().group);
  acStreet.cluster.add(poleTransformer);
  // the far city the line runs to (lit windows)
  const cb = new Builder('city', { windowGlow: 'yellow' });
  const towers: [number, number, number][] = [[-0.9, 1.1, 0], [-0.4, 1.7, 0.1], [0.15, 1.3, -0.1], [0.6, 2.0, 0], [1.1, 1.2, 0.1]];
  for (const [x, h, z] of towers) {
    cb.box(0.42, h, 0.4, { r: 0.04, c: ['bg.indigo', 'slate'], at: [x, 0, z] });
    for (let y = 0.25; y < h - 0.15; y += 0.3) for (const dx of [-0.1, 0.1]) cb.box(0.08, 0.12, 0.01, { r: 0, slot: 'window', at: [x + dx, y, z + 0.205] });
  }
  const city = cb.build();
  city.night = 1;
  city.group.position.set(STREET_X + 0.6, 0, Z_FAR - 1.15);
  group.add(acStation.group, acStreet.cluster, line, city.group);

  const setDistance = (km: number): void => {
    const z = streetZ(km);
    dcStreet.cluster.position.set(-STREET_X, 0.02, z);
    acStreet.cluster.position.set(STREET_X, 0.02, z);
    const len = Math.max(0.05, Z_NEAR - (z + 0.4));
    for (const m of wire) m.scale.set(1, 1, len);
  };
  setDistance(1);
  return {
    group,
    dc: { ...dcStreet, wire, wireMat, station: dcStation },
    ac: { ...acStreet, station: acStation, poleTransformer, city, line },
    setDistance,
  };
}
