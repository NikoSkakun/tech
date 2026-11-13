/**
 * Stylised world map of mains frequencies (step 2): rough continent outlines (equirectangular, lon/lat in
 * degrees) on a dark plate, 50 Hz zones `teal`, 60 Hz zones `violet`; a magnified inset shows Japan split in
 * half (east 50 Hz, west 60 Hz). Outlines are deliberately coarse — a toy map, not cartography.
 */
import { Group, Mesh, Shape, ShapeGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { K } from '@/style';
import { tag } from '../world';

type Poly = readonly (readonly [number, number])[];
const HZ50 = 'teal';
const HZ60 = 'violet';

const AREAS: readonly [Poly, 50 | 60][] = [
  // North America (60 Hz)
  [[[-168, 66], [-140, 70], [-95, 72], [-80, 62], [-60, 55], [-55, 47], [-70, 43], [-76, 35], [-81, 25], [-97, 26], [-97, 18], [-87, 15], [-78, 8], [-85, 10], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 60]], 60],
  // north of South America and Brazil (60 Hz)
  [[[-78, 8], [-72, 12], [-60, 10], [-50, 2], [-35, -7], [-40, -22], [-48, -28], [-53, -33], [-57, -30], [-58, -20], [-65, -12], [-70, -15], [-76, -14], [-81, -5], [-80, 1]], 60],
  // southern cone (50 Hz)
  [[[-53, -33], [-58, -38], [-65, -42], [-68, -52], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-65, -12], [-58, -20], [-57, -30]], 50],
  // Europe
  [[[-10, 36], [-9, 43], [-2, 44], [-5, 48], [-2, 51], [5, 53], [8, 57], [5, 62], [15, 69], [28, 71], [40, 67], [45, 60], [40, 48], [30, 45], [28, 41], [22, 37], [15, 38], [10, 44], [3, 42], [-5, 36]], 50],
  // Africa
  [[[-17, 21], [-10, 30], [-5, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 11], [40, -3], [40, -15], [35, -25], [20, -35], [17, -28], [12, -10], [9, 4], [-8, 4], [-17, 14]], 50],
  // Asia
  [[[40, 67], [60, 70], [80, 73], [110, 76], [140, 72], [170, 68], [180, 66], [170, 60], [160, 55], [140, 52], [135, 43], [127, 40], [122, 30], [110, 20], [105, 10], [100, 2], [95, 15], [90, 22], [80, 8], [72, 20], [60, 25], [50, 30], [45, 40], [40, 48], [45, 60]], 50],
  // Australia
  [[[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [132, -32], [115, -34]], 50],
  // 60 Hz islands inside the 50 Hz world: Saudi Arabia, South Korea, Taiwan, the Philippines
  [[[36, 28], [39, 22], [43, 15], [52, 18], [56, 22], [50, 26], [48, 30], [39, 32]], 60],
  [[[126, 34.5], [129.5, 35], [129.8, 38], [127, 38.8], [125.5, 37]], 60],
  [[[120.2, 22.3], [121.9, 24.5], [121.5, 25.4], [120, 23.6]], 60],
  [[[120, 15], [122, 18.5], [124.5, 12], [126.5, 7], [122, 6.5]], 60],
];
// Japan: east of the Fuji line 50 Hz, west 60 Hz (inset)
const JAPAN_EAST: Poly = [[138.6, 35.1], [140.9, 35.7], [141.8, 39], [141.6, 41.4], [143.5, 42.5], [145.3, 43.3], [141.8, 45.4], [139.8, 42.3], [139.9, 39.5], [137.9, 36.8]];
const JAPAN_WEST: Poly = [[130.2, 31.3], [131.7, 32.9], [134.8, 33.6], [136.8, 34.3], [138.6, 35.1], [137.9, 36.8], [136.1, 36.3], [132.6, 35.3], [130.9, 34.2], [129.7, 33.3]];

export interface WorldMap {
  group: Group;
  /** Local point of the Japan inset (anchor for a callout). */
  japan: Group;
}

export function createWorldMap(width = 3.6): WorldMap {
  const group = new Group();
  group.name = 'world-map';
  const h = width * 0.5;
  const sx = width / 2 / 180;
  const sy = h / 2 / 80;
  const plate = new Mesh(new RoundedBoxGeometry(width + 0.3, h + 0.3, 0.08, 3, 0.08), K.toon({ color: 'bg.deep', rim: 0.6, emissive: 'teal', emissiveIntensity: 0.05 }));
  plate.position.z = -0.05;
  group.add(plate);
  const mat50 = K.toon({ color: HZ50, emissive: HZ50, emissiveIntensity: 0.35, keepHue: true });
  const mat60 = K.toon({ color: HZ60, emissive: HZ60, emissiveIntensity: 0.35, keepHue: true });
  const shape = (poly: Poly, cx = 0, cy = 0, k = 1): ShapeGeometry =>
    new ShapeGeometry(new Shape(poly.map(([lon, lat]) => new Vector2((lon - cx) * sx * k, (lat - 20 - cy) * sy * k))));
  AREAS.forEach(([poly, hz], i) => {
    const m = new Mesh(shape(poly), hz === 50 ? mat50 : mat60);
    m.position.z = 0.002 * (i + 1);
    group.add(m);
  });
  // Japan inset: a round lens in the lower right, Japan ×4 around its own centre
  const japan = new Group();
  japan.position.set(width * 0.36, -h * 0.28, 0.06);
  const lens = new Mesh(new RoundedBoxGeometry(0.95, 0.95, 0.04, 4, 0.3), K.toon({ color: 'ink', rim: 0.8, emissive: 'mist', emissiveIntensity: 0.08 }));
  japan.add(lens);
  for (const [poly, mat] of [[JAPAN_EAST, mat50], [JAPAN_WEST, mat60]] as const) {
    const m = new Mesh(shape(poly, 137.5, 18.5, 3.6), mat);
    m.position.z = 0.03;
    japan.add(m);
  }
  group.add(japan);
  const t50 = tag('50 Hz', 18, HZ50, 'mono');
  t50.position.set(-width * 0.36, -h * 0.36, 0.1);
  const t60 = tag('60 Hz', 18, HZ60, 'mono');
  t60.position.set(-width * 0.02, -h * 0.36, 0.1);
  group.add(t50, t60);
  return { group, japan };
}
