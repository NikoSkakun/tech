/**
 * Step 7 card «до/після»: a holographic schematic map of the lower Dnipro — the river from Zaporizhzhia to the
 * sea and the Kakhovka reservoir along it (an elongated lake, schematic outline from approximate coordinates).
 * `drain` 0 → 1 empties the reservoir smoothly: the water shape narrows to the river channel and a dashed
 * outline of the former reservoir stays. No front lines, no images of destruction (DECISIONS §7).
 * Map units: km (x east from 34,2° E, y north from 47,2° N); the plate is scaled into the scene.
 */
import { BufferGeometry, Group, Mesh, PlaneGeometry, Shape, ShapeGeometry, Vector3 } from 'three';
import { K } from '@/style';
import { G } from '@/kit';

const ll = (lon: number, lat: number): [number, number] => [(lon - 34.2) * 75, (lat - 47.2) * 111];
/** Centre line of the reservoir (NE → SW) with its half-width in km. */
const LAKE: readonly [number, number, number][] = [
  [...ll(35.12, 47.78), 1.5],
  [...ll(34.95, 47.64), 3.5],
  [...ll(34.6, 47.55), 8],
  [...ll(34.3, 47.5), 11],
  [...ll(34.0, 47.38), 10],
  [...ll(33.75, 47.15), 7],
  [...ll(33.5, 46.92), 4],
  [...ll(33.37, 46.77), 1.5],
];
/** The river below the dam to the estuary, and above the reservoir to Zaporizhzhia. */
const RIVER: readonly [number, number][] = [
  ll(35.2, 47.95),
  ll(35.12, 47.78),
  ...LAKE.slice(1, -1).map(([x, y]) => [x, y] as [number, number]),
  ll(33.37, 46.77),
  ll(33.0, 46.68),
  ll(32.6, 46.62),
  ll(32.2, 46.55),
];

function outline(scale: number): [number, number][] {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  LAKE.forEach(([x, y, w], i) => {
    const a = LAKE[Math.max(0, i - 1)]!;
    const b = LAKE[Math.min(LAKE.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1;
    const ww = Math.max(0.6, w * scale);
    left.push([x - (dy / n) * ww, y + (dx / n) * ww]);
    right.push([x + (dy / n) * ww, y - (dx / n) * ww]);
  });
  return [...left, ...right.reverse()];
}

export interface KakhovkaMap {
  group: Group;
  /** 0 = the full reservoir (before 06.06.2023), 1 = emptied. */
  setDrain(d: number): void;
  label: Vector3;
}

export function buildKakhovkaMap(): KakhovkaMap {
  const group = new Group();
  group.name = 'kakhovka-map';
  const plate = new Mesh(new PlaneGeometry(230, 160), K.hologram({ size: [230, 160], accent: 'sky' }));
  plate.position.set(-20, 0, -0.5);
  group.add(plate);
  const river = new Mesh(
    G.tube(
      RIVER.map(([x, y]) => new Vector3(x, y, 0.2)),
      1.4,
      { seg: 6 },
    ),
    K.glow({ color: 'sky', intensity: 0.9, keepHue: true }),
  );
  group.add(river);
  const water = new Mesh(new BufferGeometry(), K.glow({ color: 'blue', intensity: 0.8, keepHue: true }));
  group.add(water);
  // the dashed outline of the former reservoir (stays after it drained)
  const dash = outline(1);
  const dashes = new Group();
  for (let i = 0; i < dash.length; i++) {
    const a = dash[i]!;
    const b = dash[(i + 1) % dash.length]!;
    for (let k = 0; k < 4; k += 2) {
      const p = new Vector3(a[0] + ((b[0] - a[0]) * k) / 4, a[1] + ((b[1] - a[1]) * k) / 4, 0.4);
      const q = new Vector3(a[0] + ((b[0] - a[0]) * (k + 1)) / 4, a[1] + ((b[1] - a[1]) * (k + 1)) / 4, 0.4);
      dashes.add(new Mesh(G.rod(p, q, 0.5, 6), K.glow({ color: 'mist', intensity: 0.7 })));
    }
  }
  group.add(dashes);
  let drawn = -1;
  return {
    group,
    label: new Vector3(...ll(34.3, 47.5), 2),
    setDrain(d) {
      const k = Math.round(d * 60) / 60;
      if (k === drawn) return;
      drawn = k;
      water.geometry.dispose();
      const s = new Shape();
      outline(1 - 0.92 * k).forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
      water.geometry = new ShapeGeometry(s);
      dashes.visible = k > 0.05;
    },
  };
}
