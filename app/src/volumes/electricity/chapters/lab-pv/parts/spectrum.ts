/**
 * The «спектр-веселка» of step 1: the AM1.5G spectrum as a row of chunky bars, one per wavelength band, each
 * in its own colour (`wavelengthToColor`; ultraviolet and infrared are drawn translucent). Heights are band
 * averages of the reference spectrum ASTM G173, rounded (W/m² per nm) — an illustrative histogram: they
 * reproduce the document's shares (≈ 5 % UV / 43 % visible / 52 % IR), not a measured curve.
 */
import { BoxGeometry, Group, Mesh, type Object3D } from 'three';
import { wavelengthToColor } from '@/fx';
import { Builder } from '@/kit';
import { K, type KToonMaterial } from '@/style';
import { shadows } from '../world';

/** Band centre [nm], band limits [nm] and mean spectral irradiance [W/m²·nm] at AM1.5G (rounded). */
export const AM15_BANDS: readonly { nm: number; from: number; to: number; w: number }[] = [
  { nm: 350, from: 300, to: 400, w: 0.46 },
  { nm: 450, from: 400, to: 500, w: 1.4 },
  { nm: 550, from: 500, to: 600, w: 1.51 },
  { nm: 650, from: 600, to: 700, w: 1.39 },
  { nm: 750, from: 700, to: 800, w: 1.17 },
  { nm: 850, from: 800, to: 900, w: 0.94 },
  { nm: 950, from: 900, to: 1000, w: 0.65 },
  { nm: 1050, from: 1000, to: 1100, w: 0.62 },
  { nm: 1200, from: 1100, to: 1300, w: 0.4 },
  { nm: 1400, from: 1300, to: 1500, w: 0.19 },
  { nm: 1650, from: 1500, to: 1800, w: 0.17 },
  { nm: 2100, from: 1800, to: 2500, w: 0.04 },
];

const BAR = 0.36;
const PITCH = 0.42;
const HEIGHT = 1.5; // of the tallest bar

export interface Spectrum {
  group: Group;
  /** One pick target per band (same order as `AM15_BANDS`). */
  bars: Mesh[];
  /** Zone markers for callouts. */
  anchors: { uv: Object3D; visible: Object3D; ir: Object3D };
  /** Top centre of a bar, in the group's frame. */
  top(i: number): [number, number, number];
  /** Lift the selected bar a little; idle shimmer. */
  update(selected: number, t: number): void;
}

export function createSpectrum(): Spectrum {
  const group = new Group();
  group.name = 'spectrum';
  const n = AM15_BANDS.length;
  const x = (i: number): number => (i - (n - 1) / 2) * PITCH;
  const base = new Builder('spectrum-base');
  base.box(n * PITCH + 0.3, 0.1, 0.8, { r: 0.04, slot: 'gloss', c: ['bg.indigo', 'slate'] });
  group.add(shadows(base.build().group, false));
  const peak = Math.max(...AM15_BANDS.map((b) => b.w));
  const heights = AM15_BANDS.map((b) => 0.08 + (b.w / peak) * HEIGHT);
  const seen = AM15_BANDS.map((b) => wavelengthToColor(b.nm).band === 'visible');
  const bars = AM15_BANDS.map((b, i) => {
    const { color, band } = wavelengthToColor(b.nm);
    const visible = band === 'visible';
    // invisible bands keep their conventional tint (violet-ish UV, orange IR) but are see-through
    const material: KToonMaterial = K.toon({ color: band === 'ir' ? 'orange' : band === 'uv' ? 'violet' : color, emissive: color, emissiveIntensity: visible ? 0.55 : 0.1, keepHue: true, rim: 0.6 });
    material.fade = visible ? 1 : 0.8;
    const bar = new Mesh(new BoxGeometry(BAR, 1, 0.5), material);
    bar.scale.y = heights[i]!;
    bar.position.set(x(i), 0.1 + heights[i]! / 2, 0);
    bar.castShadow = true;
    group.add(bar);
    return bar;
  });
  const anchor = (at: number, y: number): Object3D => {
    const o = new Group();
    o.position.set(at, y, 0.3);
    group.add(o);
    return o;
  };
  return {
    group,
    bars,
    anchors: { uv: anchor(x(0), heights[0]! + 0.2), visible: anchor(x(2), heights[2]! + 0.2), ir: anchor(x(8), heights[8]! + 0.2) },
    top: (i) => [x(i), 0.1 + heights[i]!, 0],
    update(selected, t) {
      bars.forEach((bar, i) => {
        const lift = i === selected ? 0.12 + Math.sin(t * 3) * 0.02 : 0;
        bar.position.y = 0.1 + heights[i]! / 2 + lift;
        (bar.material as KToonMaterial).emissiveIntensity = (seen[i] ? 0.55 : 0.1) + (i === selected ? 0.5 : 0);
      });
    },
  };
}
