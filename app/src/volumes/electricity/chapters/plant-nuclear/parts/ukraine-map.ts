/**
 * The hologram over the island in step 12: a stylised map of Ukraine in its internationally recognised borders
 * (DECISIONS §7: Crimea included, no front lines), simplified to ~70 points of longitude / latitude, with the
 * five nuclear plants: unit bars in `violet` (plantType.nuclear; VVER-440 shorter than VVER-1000), a ring at
 * the foot coloured by status (operating `green`, occupied `amber`, shut down `steel`), and a small arch at
 * Chornobyl. Also a share donut (`setShare`): the violet sector = the share of nuclear power.
 */
import { Group, Mesh, RingGeometry, Shape, ShapeGeometry, Vector2, Vector3 } from 'three';
import { RibbonLines } from '@/fx';
import { Builder } from '@/kit';
import { K, PLANT_TYPE } from '@/style';

/** Simplified outline (lon, lat), clockwise from the north-west corner. */
const OUTLINE: readonly [number, number][] = [
  [23.6, 51.6], [25.2, 51.95], [27.0, 51.6], [28.6, 51.55], [30.2, 51.5], [30.6, 51.3], [31.5, 52.1], [32.2, 52.1], [33.2, 52.35],
  [34.1, 51.7], [34.4, 51.25], [35.4, 51.05], [36.2, 50.45], [37.4, 50.4], [38.2, 50.0], [39.4, 49.85], [40.1, 49.6], [39.7, 48.8],
  [40.0, 48.25], [39.8, 47.85], [38.3, 47.6], [38.2, 47.1], [37.3, 46.9], [36.0, 46.65], [35.2, 46.4], [34.8, 46.1], [35.4, 45.55],
  [36.6, 45.45], [36.4, 45.1], [35.4, 45.0], [34.4, 44.6], [33.6, 44.55], [33.5, 45.1], [32.5, 45.4], [33.6, 45.9], [33.4, 46.1],
  [32.0, 46.4], [31.5, 46.6], [30.8, 46.5], [30.2, 45.9], [29.7, 45.4], [28.3, 45.4], [28.2, 45.5], [28.9, 46.0], [30.0, 46.4],
  [29.6, 46.9], [29.9, 47.4], [29.2, 47.9], [28.4, 48.2], [27.6, 48.45], [26.6, 48.25], [25.4, 47.9], [24.4, 47.95], [23.2, 48.1],
  [22.6, 48.1], [22.15, 48.4], [22.6, 49.1], [22.7, 49.5], [23.5, 50.4], [24.1, 50.85],
];

export type PlantId = 'rivne' | 'khmelnytskyi' | 'south' | 'zaporizhzhia' | 'chornobyl';
export type Status = 'operating' | 'occupied' | 'shut';
export interface PlantSpot {
  id: PlantId;
  lon: number;
  lat: number;
  /** Unit sizes: 440 / 1000 (VVER) or 'rbmk'. */
  units: (440 | 1000 | 'rbmk')[];
  status: Status;
}
export const PLANTS: readonly PlantSpot[] = [
  { id: 'rivne', lon: 25.89, lat: 51.33, units: [440, 440, 1000, 1000], status: 'operating' },
  { id: 'khmelnytskyi', lon: 26.65, lat: 50.3, units: [1000, 1000], status: 'operating' },
  { id: 'south', lon: 31.22, lat: 47.82, units: [1000, 1000, 1000], status: 'operating' },
  { id: 'zaporizhzhia', lon: 34.59, lat: 47.51, units: [1000, 1000, 1000, 1000, 1000, 1000], status: 'occupied' },
  { id: 'chornobyl', lon: 30.1, lat: 51.39, units: ['rbmk', 'rbmk', 'rbmk', 'rbmk'], status: 'shut' },
];
const STATUS_COLOR = { operating: 'green', occupied: 'amber', shut: 'steel' } as const;

/** Map metres per degree (map plane: x east, −z north). */
const KX = 12.2;
const KZ = 18.5;
export const project = (lon: number, lat: number): Vector3 => new Vector3((lon - 31) * KX, 0, -(lat - 48.6) * KZ);

export interface UkraineMap {
  group: Group;
  spots: Record<PlantId, Vector3>;
  bars: Record<PlantId, Group>;
  setShare(fraction: number): void;
  donut: Group;
}

export function buildUkraineMap(): UkraineMap {
  const group = new Group();
  const shape = new Shape(OUTLINE.map(([lon, lat]) => {
    const p = project(lon, lat);
    return new Vector2(p.x, -p.z);
  }));
  const land = new Mesh(new ShapeGeometry(shape), K.glass({ color: 'violet', opacity: 0.55, edgeOpacity: 0.6 }));
  land.rotation.x = -Math.PI / 2;
  group.add(land);
  const edge = new RibbonLines({ capacity: OUTLINE.length + 4, color: 'sky.light', width: 1.4, intensity: 1.6 });
  edge.setLines([{ points: OUTLINE.map(([lon, lat]) => project(lon, lat).setY(0.2)), closed: true }]);
  group.add(edge);
  const spots = {} as Record<PlantId, Vector3>;
  const bars = {} as Record<PlantId, Group>;
  for (const p of PLANTS) {
    const at = project(p.lon, p.lat);
    spots[p.id] = at;
    const b = new Builder(`npp-${p.id}`);
    b.ring(4.2, 0.45, { seg: 40, slot: 'glow', c: STATUS_COLOR[p.status], at: [0, 0.3, 0] });
    p.units.forEach((u, i) => {
      const h = u === 440 ? 8 : u === 1000 ? 15 : 11;
      const c = p.status === 'shut' ? 'steel' : PLANT_TYPE.nuclear;
      b.box(1.6, h, 1.6, { r: 0.3, slot: 'gloss', c: [`${c}.dark` as never, c as never], at: [-((p.units.length - 1) * 2.1) / 2 + i * 2.1, 0.3, 0] });
    });
    if (p.id === 'chornobyl') b.lathe([[3.2, 0], [3.0, 2.6], [2.0, 4], [0.02, 4.4]], { seg: 24, slot: 'metal', c: 'mist', at: [0, 0.3, 3.5] });
    const m = b.build();
    m.group.position.copy(at);
    m.group.scale.setScalar(1.4);
    bars[p.id] = m.group;
    group.add(m.group);
  }
  // share donut, right of the map
  const donut = new Group();
  const back = new Mesh(new RingGeometry(9, 14, 64), K.toon({ color: 'slate' }));
  const sector = new Mesh(new RingGeometry(9.2, 13.8, 64, 1, 0, Math.PI), K.glow({ color: PLANT_TYPE.nuclear, intensity: 1.3, whiten: 0, keepHue: true }));
  sector.position.z = 0.1;
  donut.add(back, sector);
  donut.position.set(80, 12, 72); // over the Black Sea, south-east of Crimea
  group.add(donut);
  return {
    group,
    spots,
    bars,
    donut,
    setShare(f) {
      sector.geometry.dispose();
      sector.geometry = new RingGeometry(9.2, 13.8, 64, 1, Math.PI / 2 - f * Math.PI * 2, f * Math.PI * 2);
    },
  };
}
