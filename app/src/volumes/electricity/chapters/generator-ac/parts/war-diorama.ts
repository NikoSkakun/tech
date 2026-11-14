/**
 * Diorama of step 3 «Війна струмів»: two toy streets of the 1880s on the turntable. Left (x < 0): Edison's DC
 * station (brick, sign «1882») feeding its neighbourhood through two thick copper wires. Right (x > 0):
 * Westinghouse's AC station with a step-up transformer, a high-voltage line on poles and a step-down "barrel"
 * transformer at the neighbourhood; the line continues to a far city silhouette.
 * The comparison is the subject, so the two neighbourhoods (houses + street lamps) stand at the FRONT and stay
 * put; the stations sit up the streets behind them and slide back to the chosen distance (`setDistance`) — the
 * farther the station, the dimmer the DC lamps. Origin = centre of the turntable; the streets run along −Z.
 */
import { CylinderGeometry, Group, Mesh } from 'three';
import { Builder, house, instanced, type KitModel } from '@/kit';
import { K } from '@/style';
import { COPPER } from '../world';

export const STREET_X = 2.25;
/** z of the neighbourhoods (front) and of the far end of the streets. */
export const Z_NEAR = 1.6;
export const Z_FAR = -3.4;
const D_MIN = 0.2;
const D_MAX = 10;
/** Gap between the neighbourhood and the nearest station position. */
const HOME_GAP = 1.75;
const LAMP_Z = [0.45, -0.25, -0.95];

/** Station position along a street (z) for a distance in km (log scale: 0,2 km just behind the houses … 10 km). */
export function streetZ(km: number): number {
  const f = Math.log(Math.max(D_MIN, Math.min(D_MAX, km)) / D_MIN) / Math.log(D_MAX / D_MIN);
  return Z_NEAR - HOME_GAP - f * (Z_NEAR - HOME_GAP - Z_FAR);
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
    { at: [side * 1.0, 0, 0.2], ry: side * Math.PI / 2, s: 0.1 },
    { at: [side * 1.05, 0, -0.8], ry: side * Math.PI / 2, s: 0.094 },
    { at: [-side * 0.95, 0, -0.35], ry: -side * Math.PI / 2, s: 0.09 },
  ]);
  cluster.add(homes);
  const lampGlow = K.glow({ color: glowColor, intensity: 1.6, keepHue: true, whiten: 0.2 });
  const b = new Builder('lamps');
  for (const z of LAMP_Z) {
    b.cyl(0.045, 0.95, { c: 'ink', slot: 'metal', at: [side * 0.38, 0, z] });
    b.box(0.26, 0.06, 0.06, { r: 0.01, c: 'ink', at: [side * 0.28, 0.95, z] });
  }
  cluster.add(b.build().group);
  for (const z of LAMP_Z) {
    const head = new Mesh(new CylinderGeometry(0.09, 0.15, 0.16, 16), lampGlow);
    head.position.set(side * 0.18, 0.9, z);
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


/** x of the AC high-voltage line (between the street and the divider, so it passes the station). */
export const LINE_X = STREET_X - 0.85;
const STREET_FRONT = Z_NEAR + 1.0;
const STREET_BACK = Z_FAR - 0.3;

export function createWarDiorama(): WarDiorama {
  const group = new Group();
  group.name = 'war-diorama';
  const ground = new Builder('streets');
  const len = STREET_FRONT - STREET_BACK;
  for (const side of [-1, 1] as const) {
    ground.box(1.25, 0.04, len, { r: 0.02, c: 'ink', at: [side * STREET_X, 0, (STREET_FRONT + STREET_BACK) / 2] });
    for (let z = STREET_FRONT - 0.3; z > STREET_BACK; z -= 0.45) ground.box(0.05, 0.01, 0.22, { r: 0, c: 'mist', at: [side * STREET_X, 0.04, z] });
  }
  ground.box(0.14, 0.18, len, { r: 0.06, c: 'bg.violet', at: [0, 0, (STREET_FRONT + STREET_BACK) / 2] });
  group.add(ground.build().group);

  // --- DC street: two thick copper wires on short posts from the station to the houses
  const dcStation = station('dc');
  const dcStreet = neighbourhood(-1, 'yellow');
  dcStreet.cluster.position.set(-STREET_X, 0.02, Z_NEAR);
  const wireMat = K.metal({ color: COPPER, specular: 0.8 });
  const wireEnd = Z_NEAR - 0.5;
  const wire = [-0.18, 0.18].map((dx) => {
    const m = new Mesh(new CylinderGeometry(0.05, 0.05, 1, 12).rotateX(Math.PI / 2).translate(0, 0, -0.5), wireMat);
    m.position.set(-STREET_X + 0.62 + dx, 0.42, wireEnd);
    m.castShadow = true;
    return m;
  });
  const postGeo = new CylinderGeometry(0.04, 0.04, 0.42, 8).translate(0, 0.21, 0);
  const postMat = K.toon({ color: 'wireBrown' });
  const posts: Mesh[] = [];
  for (let z = wireEnd - 0.3; z > Z_FAR; z -= 0.9) {
    const p = new Mesh(postGeo, postMat);
    p.position.set(-STREET_X + 0.62, 0, z);
    posts.push(p);
  }
  group.add(dcStation.group, dcStreet.cluster, ...wire, ...posts);

  // --- AC street: step-up barrel at the station, HV line on poles (on to the far city), step-down barrel at the
  // houses
  const acStation = station('ac');
  const stepUp = new Builder('step-up');
  barrel(stepUp, [LINE_X - STREET_X - 0.12, 0, 0.75], 1);
  acStation.group.add(stepUp.build().group);
  const acStreet = neighbourhood(1, 'yellow');
  acStreet.cluster.position.set(STREET_X, 0.02, Z_NEAR);
  const lb = new Builder('hv-line');
  const lineFrom = Z_NEAR - 1.3;
  for (let z = lineFrom - 0.6; z > STREET_BACK; z -= 0.75) {
    lb.cyl(0.035, 1.25, { c: 'wireBrown', at: [LINE_X, 0, z] });
    lb.box(0.36, 0.04, 0.04, { r: 0.01, c: 'wireBrown', at: [LINE_X, 1.2, z] });
  }
  for (const dx of [-0.15, 0.15]) lb.rod([LINE_X + dx, 1.25, lineFrom], [LINE_X + dx, 1.25, Z_FAR - 1.0], 0.012, { c: 'ink' });
  const line = lb.build().group;
  const poleTransformer = new Group();
  const pt = new Builder('pole-transformer');
  barrel(pt, [LINE_X - STREET_X - 0.12, 0, lineFrom - Z_NEAR], 1);
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
  city.group.position.set(STREET_X + 0.1, 0, Z_FAR - 1.0);
  city.group.scale.setScalar(0.85);
  group.add(acStation.group, acStreet.cluster, line, city.group);

  const setDistance = (km: number): void => {
    const z = streetZ(km);
    dcStation.group.position.set(-STREET_X, 0, z);
    acStation.group.position.set(STREET_X, 0, z);
    const front = z + 0.55;
    for (const m of wire) m.scale.set(1, 1, Math.max(0.05, wireEnd - front));
    for (const p of posts) p.visible = p.position.z > front;
  };
  setDistance(1);
  return {
    group,
    dc: { ...dcStreet, wire, wireMat, station: dcStation },
    ac: { ...acStreet, station: acStation, poleTransformer, city, line },
    setDistance,
  };
}
