/**
 * Sun and moon discs and distant hill / mountain silhouettes (STYLE_GUIDE §2.3: layered distant silhouettes).
 * The engine's sky already paints a sun glow and far silhouettes; these are the *modelled* ones for shots that
 * need a readable sun (solar chapters) or mountains with a snow line (hydro). Units: metres.
 */
import { Mesh } from 'three';
import { K, col, type ColorLike } from '@/style';
import { bandGeometry } from '../core/bands';
import { Builder, type KitModel } from '../core/builder';
import * as G from '../core/geo';
import { noise2 } from '../core/noise';

/** Glowing sun: bright core, soft additive halo. Place it far away along the key-light direction. */
export function sunDisc(o: { radius?: number; color?: ColorLike } = {}): KitModel {
  const r = o.radius ?? 12;
  const b = new Builder('sun');
  b.attach(new Mesh(G.sphere(r, 28), K.glow({ color: o.color ?? 'yellow', intensity: 2.6, falloff: 0.6, edge: 0.85, fog: false })));
  for (const [k, opacity] of [
    [1.5, 0.3],
    [2.3, 0.12],
  ] as const) {
    b.attach(new Mesh(G.sphere(r * k, 24), K.glow({ color: o.color ?? 'yellow', intensity: 1.2, falloff: 2.4, additive: true, opacity })));
  }
  b.anchor('centre');
  return b.build();
}

/** Moon with a few flat craters and a faint halo. `phase` 0 = full … 0.8 = thin crescent (a dark disc slides over). */
export function moonDisc(o: { radius?: number; phase?: number } = {}): KitModel {
  const r = o.radius ?? 9;
  const b = new Builder('moon');
  b.attach(new Mesh(G.sphere(r, 28), K.glow({ color: 'white', core: 'white', intensity: 1.5, falloff: 0.5, edge: 0.82, fog: false })));
  b.attach(new Mesh(G.sphere(r * 1.6, 24), K.glow({ color: 'sky.light', intensity: 0.9, falloff: 2.6, additive: true, opacity: 0.22 })));
  const crater = col('mist').lerp(col('white'), 0.35);
  for (const [x, y, k] of [
    [-0.35, 0.3, 0.2],
    [0.25, -0.15, 0.26],
    [0.1, 0.5, 0.11],
    [-0.2, -0.45, 0.14],
  ] as const) {
    const z = Math.sqrt(1 - x * x - y * y);
    b.cyl(r * k, r * 0.02, { slot: 'flat', c: crater, seg: 16, bevel: 0, at: [x * r, y * r, z * r * 1.002], rot: [Math.PI / 2 - y * 0.9, 0, -x * 0.9] });
  }
  const phase = o.phase ?? 0;
  if (phase > 0) {
    // a disc of night sky sliding over the moon gives the crescent
    const shade = new Mesh(G.sphere(r * 1.02, 28), K.flat('bg.indigo', { fog: false }));
    shade.position.set(-(1 - phase) * r * 1.9 + r * 0.05, r * 0.08, r * 0.3);
    b.attach(shade);
  }
  b.anchor('centre');
  const model = b.build();
  return model;
}

export interface HillsOptions {
  /** Distance of the ring from the origin. Default 220. */
  radius?: number;
  count?: number;
  /** Height range. Default [25, 60]. */
  height?: readonly [number, number];
  /** Arc covered, radians (default: full circle) and where it starts. */
  arc?: number;
  start?: number;
  /** `hills` = soft green mounds, `mountains` = steeper peaks with a crisp snow cap. */
  kind?: 'hills' | 'mountains';
  seed?: number;
  /** Lowest point of the mounds (they are sunk so the bases hide in the fog / sea of clouds). */
  base?: number;
}

/** Ring of distant mounds or snow-capped peaks, merged into one mesh. */
export function hills(o: HillsOptions = {}): KitModel {
  const b = new Builder('hills');
  const radius = o.radius ?? 220;
  const count = o.count ?? 14;
  const [h0, h1] = o.height ?? [25, 60];
  const seed = o.seed ?? 1;
  const mountains = o.kind === 'mountains';
  const tones = mountains
    ? [col('violet').lerp(col('slate'), 0.5), col('blue.dark').lerp(col('steel'), 0.4), col('violet.dark').lerp(col('steel'), 0.3)]
    : [col('teal').lerp(col('blue'), 0.35), col('green').lerp(col('teal'), 0.6), col('teal.dark').lerp(col('green'), 0.3)];
  for (let i = 0; i < count; i++) {
    const a = (o.start ?? 0) + ((i + noise2(i, seed) * 0.7) / count) * (o.arc ?? Math.PI * 2);
    const h = h0 + (h1 - h0) * noise2(i * 3.7, seed + 1);
    const r = h * (mountains ? 0.85 : 1.9) * (0.8 + noise2(i * 1.9, seed + 2) * 0.5);
    const d = radius * (0.9 + noise2(i * 5.1, seed + 3) * 0.35);
    const at: [number, number, number] = [Math.cos(a) * d, o.base ?? -h * 0.25, Math.sin(a) * d];
    const tone = tones[i % tones.length]!;
    const profile: G.Pt[] = mountains
      ? G.fillet([[r, 0], [r * 0.45, h * 0.55], [r * 0.12, h * 0.94], [0, h]], [0, r * 0.5, r * 0.12, 0], 4)
      : [[r, 0], [r * 0.9, h * 0.3], [r * 0.62, h * 0.72], [r * 0.3, h * 0.94], [0, h]];
    const place = { slot: 'matte', at, s: [1, 1, 0.8 + noise2(i, seed + 4) * 0.4], rot: [0, a, 0] } as const;
    if (!mountains) {
      b.lathe(profile, { seg: 20, c: [tone.clone().multiplyScalar(0.78), tone], crease: 85, ...place });
      continue;
    }
    // crisp wavy rock and snow lines: the peak is cut along iso-lines of "altitude + angular wobble"
    const wob = (x: number, z: number): number => Math.sin(Math.atan2(z, x) * 5 + i) * 0.05 + Math.sin(Math.atan2(z, x) * 11 + i * 2) * 0.025;
    const snowLine = 0.6 + noise2(i * 2.3, seed + 5) * 0.14;
    b.add(
      bandGeometry(G.lathe(profile, { seg: 36, crease: 85 }), (x, y, z) => y / h + wob(x, z), [[0.3, tone.clone().multiplyScalar(0.8)], [snowLine, tone]], col('white')),
      place,
    );
  }
  return b.build();
}
