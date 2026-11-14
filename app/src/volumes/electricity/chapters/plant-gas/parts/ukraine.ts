/**
 * Hologram of Ukraine for step 10: the outline within its internationally recognised borders (Crimea
 * included; no front lines — DECISIONS §7), simplified to ≈ 60 points, as a thin translucent slab with a glowing
 * rim, and the large gas-fired CHP plants as `steel` pins (plantType.chp). Longitude / latitude are projected
 * with an equirectangular map at 48.5° N. The map lies flat in XZ (north = −Z), centred on its group.
 */
import { Group, Mesh, Vector3 } from 'three';
import { G } from '@/kit';
import { K } from '@/style';

/** Outline [lon, lat], clockwise from the west (Chop), simplified. */
const OUTLINE: readonly [number, number][] = [
  [22.15, 48.4], [22.6, 49.05], [22.7, 49.5], [23.4, 50.4], [24.1, 50.85], [23.7, 51.55], [24.4, 51.9], [25.8, 51.95],
  [27.0, 51.75], [28.0, 51.55], [28.7, 51.45], [29.4, 51.4], [30.2, 51.45], [30.6, 51.3], [30.95, 52.05], [31.8, 52.1],
  [32.4, 52.3], [33.2, 52.35], [34.1, 51.7], [34.4, 51.25], [35.4, 50.6], [36.1, 50.4], [37.5, 50.3], [38.2, 49.95],
  [39.2, 49.85], [40.15, 49.6], [39.7, 48.8], [39.8, 48.05], [38.8, 47.85], [38.25, 47.1], [37.4, 47.05], [36.2, 46.7],
  [35.3, 46.4], [34.8, 46.15], [35.1, 45.65], [35.4, 45.3], [36.6, 45.4], [35.4, 44.95], [34.4, 44.5], [33.5, 44.5],
  [33.6, 44.95], [33.0, 45.3], [32.5, 45.4], [33.4, 45.9], [33.6, 46.15], [32.6, 46.1], [31.6, 46.6], [30.8, 46.5],
  [30.2, 45.85], [29.7, 45.3], [28.9, 45.4], [28.3, 45.5], [28.7, 46.4], [30.0, 46.4], [29.7, 47.3], [29.1, 47.95],
  [27.8, 48.4], [26.6, 48.25], [25.1, 47.75], [24.0, 47.95], [22.9, 47.95],
];
const LON0 = 31.2;
const LAT0 = 48.4;
const COS = Math.cos((48.5 * Math.PI) / 180);
/** Projected width in degrees of longitude-equivalent (for scaling). */
const SPAN = (40.15 - 22.15) * COS;

export interface Plant {
  id: string;
  name: string;
  type: string;
  mw: number;
  lon: number;
  lat: number;
}

export interface UkraineMap {
  group: Group;
  /** World position of a plant pin's head. */
  pin(id: string, out?: Vector3): Vector3;
}

export function buildUkraineMap(width: number, plants: readonly Plant[]): UkraineMap {
  const k = width / SPAN;
  const xy = (lon: number, lat: number): [number, number] => [(lon - LON0) * COS * k, (lat - LAT0) * k];
  const group = new Group();
  group.name = 'ukraine-map';
  // extrude builds in XY: y = north; laid flat afterwards (north → −Z)
  const shape = OUTLINE.map(([lon, lat]) => xy(lon, lat));
  const slab = G.extrude(shape, 1.6, {});
  slab.rotateX(-Math.PI / 2);
  group.add(new Mesh(slab, K.glass({ color: 'blue', opacity: 0.62, edgeOpacity: 0.9 })));
  const rim = [...shape, shape[0]!].map(([x, y]) => new Vector3(x, 1.7, -y));
  group.add(new Mesh(G.tube(rim, 0.9, {}), K.glow({ color: 'sky', intensity: 1.9, whiten: 0, keepHue: true })));
  const pins = new Map<string, Vector3>();
  const head = G.sphere(2.4, 18);
  const stick = G.cyl(0.35, 9, { seg: 8, bevel: 0 });
  const steel = K.toon({ color: 'steel', emissive: 'steel', emissiveIntensity: 0.25 });
  plants.forEach((p, i) => {
    const [x, y] = xy(p.lon, p.lat);
    const dx = (i % 2) * 16; // two plants in one city stand side by side
    const s = new Mesh(stick, steel);
    s.position.set(x + dx, 1.6, -y);
    const h = new Mesh(head, steel);
    h.position.set(x + dx, 11, -y);
    group.add(s, h);
    pins.set(p.id, h.position.clone());
  });
  return {
    group,
    pin(id, out = new Vector3()) {
      return group.localToWorld(out.copy(pins.get(id) ?? new Vector3()));
    },
  };
}
