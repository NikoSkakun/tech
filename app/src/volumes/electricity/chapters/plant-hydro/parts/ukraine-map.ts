/**
 * Step 9: the hologram of Ukraine over the island — the land in its internationally recognised borders, the
 * Dnipro with the cascade of stations and the Dniester, small hydro stations in the Carpathians, and the bed of
 * the former Kakhovka reservoir as a dashed outline. Station pins are `blue` (ГЕС) / `sky` (ГАЕС, plant-type
 * colours); each has an invisible ≥ 44 px proxy for picking; the selected one wears a yellow ring.
 * No front lines and no images of destruction (DECISIONS §7). Map frame: the plate's XY plane, metres.
 */
import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { K, PLANT_TYPE } from '@/style';
import { G } from '@/kit';
import { DNIESTER, DNIPRO, STATIONS, UKRAINE } from '../stations';

const K_DEG = 13;
const LON0 = 31.2;
const LAT0 = 48.5;
export const mapXY = (lon: number, lat: number): [number, number] => [
  (lon - LON0) * 0.663 * K_DEG,
  (lat - LAT0) * K_DEG,
];

export interface UkraineMap {
  group: Group;
  /** Invisible picking proxies, one per station (index = STATIONS index). */
  proxies: Mesh[];
  setSelected(i: number): void;
  /** World position of a station pin top / of the Carpathian dots. */
  stationAt(i: number, out: Vector3): Vector3;
  carpathiansAt(out: Vector3): Vector3;
  update(t: number): void;
}

export function buildUkraineMap(): UkraineMap {
  const group = new Group();
  group.name = 'ukraine-map';
  const plate = new Mesh(new PlaneGeometry(190, 130), K.hologram({ size: [190, 130], accent: 'blue' }));
  plate.position.set(4, 4, -1);
  group.add(plate);
  const land = new Shape();
  UKRAINE.forEach(([lon, lat], i) => {
    const [x, y] = mapXY(lon, lat);
    if (i === 0) land.moveTo(x, y);
    else land.lineTo(x, y);
  });
  const fill = new Mesh(new ShapeGeometry(land), K.glass({ color: 'bg.violet', opacity: 0.55 }));
  group.add(fill);
  const line = (
    pts: readonly [number, number][],
    r: number,
    color: 'sky' | 'mist' | 'blue',
    z = 0.4,
    closed = false,
  ): void => {
    const v = pts.map(([lon, lat]) => new Vector3(...mapXY(lon, lat), z));
    if (closed) v.push(v[0]!.clone());
    group.add(new Mesh(G.tube(v, r, { seg: 6 }), K.glow({ color, intensity: 0.9, keepHue: true })));
  };
  line(UKRAINE, 0.45, 'mist', 0.3, true);
  line(DNIPRO, 0.75, 'sky');
  line(DNIESTER, 0.55, 'sky');
  // the former Kakhovka reservoir: a dashed outline around the river bed between DniproHES and Kakhovka
  const reach = DNIPRO.slice(11, 16);
  for (const side of [-1, 1]) {
    const off = reach.map(([lon, lat], i) => {
      const a = reach[Math.max(0, i - 1)]!;
      const b = reach[Math.min(reach.length - 1, i + 1)]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const n = Math.hypot(dx, dy) || 1;
      const w = 0.12 * Math.sin(((i + 0.5) / reach.length) * Math.PI) + 0.03;
      return new Vector3(...mapXY(lon - (dy / n) * w * side, lat + (dx / n) * w * side), 0.5);
    });
    const dense = G.roundPath(off, 2, 4);
    for (let i = 0; i < dense.length - 1; i += 2)
      group.add(
        new Mesh(G.rod(dense[i]!, dense[i + 1]!, 0.35, 6), K.glow({ color: 'mist', intensity: 0.7 })),
      );
  }
  // small hydro in the Carpathians
  for (const [lon, lat] of [
    [23.6, 48.3],
    [24.2, 48.1],
    [24.8, 48.35],
    [23.2, 48.6],
  ] as const) {
    const d = new Mesh(
      new CircleGeometry(0.9, 12),
      K.glow({ color: PLANT_TYPE.hydro, intensity: 1.1, keepHue: true }),
    );
    d.position.set(...mapXY(lon, lat), 0.6);
    group.add(d);
  }
  const proxyMat = new MeshBasicMaterial({ visible: false });
  const proxies: Mesh[] = [];
  const pins: Group[] = [];
  STATIONS.forEach((s, i) => {
    const pin = new Group();
    const [x, y] = mapXY(...s.lonLat);
    pin.position.set(x, y, 0.6);
    const color = s.type === 'ГЕС' ? PLANT_TYPE.hydro : PLANT_TYPE.pumpedStorage;
    const stem = new Mesh(new CylinderGeometry(0.35, 0.35, 5, 8), K.toon({ color: 'mist' }));
    stem.rotation.x = Math.PI / 2;
    stem.position.z = 2.5;
    const head = new Mesh(new SphereGeometry(1.8, 16, 12), K.glow({ color, intensity: 1.3, keepHue: true }));
    head.position.z = 5.2;
    const proxy = new Mesh(new SphereGeometry(5.5, 8, 6), proxyMat);
    proxy.position.z = 4;
    proxy.userData.station = i;
    pin.add(stem, head, proxy);
    group.add(pin);
    pins.push(pin);
    proxies.push(proxy);
  });
  const ring = new Mesh(
    new TorusGeometry(3, 0.45, 8, 32),
    K.glow({ color: 'yellow', intensity: 1.4, keepHue: true }),
  );
  group.add(ring);
  let selected = 0;
  return {
    group,
    proxies,
    setSelected(i) {
      selected = i;
    },
    stationAt(i, out) {
      return pins[i]!.localToWorld(out.set(0, 0, 6));
    },
    carpathiansAt(out) {
      return group.localToWorld(out.set(...mapXY(24, 48.0), 1));
    },
    update(t) {
      const p = pins[selected]!.position;
      ring.position.set(p.x, p.y, 5.2);
      ring.scale.setScalar(1 + 0.12 * Math.sin(t * 4));
    },
  };
}
