/**
 * Step 11: a stylised map of Ukraine in its internationally recognised borders (Crimea included; no front lines,
 * no damage imagery — DECISIONS §7) floating over the island, with the large thermal plants of the document as
 * `slate` dots (`plantType.coal`), dot area ∝ design capacity. The outline is a simplified polygon of ≈ 50 points
 * (lon / lat, equirectangular with cos φ₀) — a diagram, not a survey map.
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import { Builder, G, type KitModel } from '@/kit';
import { K, PLANT_TYPE, col, type KToonMaterial } from '@/style';

/** Border, clockwise from the north-west corner (lon, lat). */
const OUTLINE: readonly (readonly [number, number])[] = [
  [23.6, 51.5], [25.3, 51.95], [27.2, 51.65], [28.7, 51.45], [30.2, 51.5], [30.6, 51.3], [31.2, 52.05], [32.2, 52.1],
  [33.3, 52.35], [34.1, 51.85], [34.4, 51.25], [35.4, 50.6], [36.3, 50.3], [37.6, 50.3], [38.2, 50.05], [39.2, 49.85],
  [40.1, 49.6], [40.0, 49.0], [39.7, 48.6], [39.9, 48.2], [39.7, 47.8], [38.3, 47.6], [38.2, 47.1], [37.4, 47.0],
  [36.8, 46.7], [35.8, 46.6], [35.2, 46.3], [34.8, 46.15], [35.4, 45.75], [36.0, 45.65], [36.6, 45.4], [36.4, 45.2],
  [35.5, 45.0], [34.9, 44.8], [34.1, 44.45], [33.5, 44.55], [33.4, 45.05], [32.5, 45.35], [33.2, 45.75], [33.6, 46.15],
  [32.6, 46.05], [31.7, 46.25], [31.5, 46.6], [30.7, 46.45], [30.2, 45.85], [29.7, 45.25], [28.8, 45.3], [28.2, 45.5],
  [28.6, 46.3], [29.6, 46.5], [29.9, 47.4], [29.2, 47.95], [28.2, 48.25], [27.5, 48.45], [26.6, 48.25], [25.2, 47.9],
  [24.0, 47.95], [22.9, 48.0], [22.6, 49.1], [22.7, 49.5], [24.1, 50.4], [23.6, 51.5],
];

export interface Station {
  key: string;
  lon: number;
  lat: number;
  mw: number;
}

export interface UkraineMap {
  group: Group;
  dots: Map<string, Mesh>;
  /** World position of a station dot. */
  at(key: string): Vector3;
  select(key: string | null): void;
}

const LON0 = 31.2;
const LAT0 = 48.4;
/** Metres per degree of latitude on the map. */
const K_DEG = 12;

function project(lon: number, lat: number): [number, number] {
  return [(lon - LON0) * K_DEG * Math.cos((LAT0 * Math.PI) / 180), (lat - LAT0) * K_DEG];
}

export function buildUkraineMap(at: Vector3, stations: readonly Station[]): UkraineMap {
  const group = new Group();
  group.position.copy(at);
  group.rotation.x = -0.12; // leans back toward the camera of the step
  const pts = OUTLINE.slice(0, -1).map(([lon, lat]) => project(lon, lat));
  const b = new Builder('ukraine-map');
  b.add(G.extrude(pts, 2.4, { bevel: 0.5 }), { slot: 'gloss', c: col('mist').lerp(col('white'), 0.3) });
  b.add(G.extrude(pts, 1.2), { slot: 'matte', c: col('sky').lerp(col('steel'), 0.5), at: [0.6, -0.8, -1.4], s: [1.01, 1.01, 1] });
  const map: KitModel = b.build();
  group.add(map.group);
  const dots = new Map<string, Mesh>();
  const mats = new Map<string, KToonMaterial>();
  for (const s of stations) {
    const [x, y] = project(s.lon, s.lat);
    // own material per dot: the selected one glows `yellow` (UI selection colour)
    const mat = K.toon({ color: PLANT_TYPE.coal, gloss: 0.6, emissive: 'yellow', emissiveIntensity: 0 });
    mats.set(s.key, mat);
    const m = new Mesh(new SphereGeometry(1, 24, 16), mat);
    m.scale.setScalar(3.2 * Math.sqrt(s.mw / 1000));
    m.position.set(x, y, 1.6);
    m.name = `station-${s.key}`;
    group.add(m);
    dots.set(s.key, m);
  }
  return {
    group,
    dots,
    at(key) {
      return dots.get(key)!.getWorldPosition(new Vector3());
    },
    select(key) {
      for (const [k, mat] of mats) mat.emissiveIntensity = k === key ? 0.9 : 0;
    },
  };
}
