/**
 * The electromagnetic wave of step `maxwell` (view «Хвиля»): a dipole antenna on the left sends a wave along
 * +x — **E** (`amber`) oscillating vertically and **B** (`magenta`) horizontally, in phase, drawn as curves with
 * stems to the axis. In front of it (towards the viewer) lies the spectrum strip from radio (10⁶ Hz) to gamma (10²⁰ Hz) on a log scale;
 * a ring marks the chosen frequency. Wavelength on screen shrinks with frequency (not to scale; slowed).
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { RibbonLines } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC, type ColorLike } from '@/style';
import { glow } from '../world';

const L = 5.6;
const A = 0.55;
const F0 = 6;
const F1 = 20;
export const STRIP = { x0: -1.6, x1: 2.8, z: 1.0, y: 0.12 };

export interface WaveView {
  group: Group;
  /** Point on the strip at log₁₀ f (local). */
  stripAt(log10f: number, out: Vector3): Vector3;
  /** `front`: how far (units) the wave has run from the antenna; Infinity = the whole wave. */
  update(t: number, log10f: number, front: number): void;
}

/** Band edges in log₁₀ Hz and their colours (radio → gamma). */
const BANDS: [number, number, ColorLike][] = [
  [6, 8.48, 'violet.dark'],
  [8.48, 11.48, 'blue'],
  [11.48, 14.6, 'red.dark'],
  [14.6, 14.9, 'white'],
  [14.9, 16.48, 'violet'],
  [16.48, 19.48, 'sky.light'],
  [19.48, 20, 'mist'],
];

export function createWaveView(): WaveView {
  const g = new Group();
  const b = new Builder('wave-view');
  // dipole antenna: two rods with a feed box in the middle, on a stand
  b.box(0.5, 0.08, 0.5, { at: [-2.1, 0, 0], r: 0.03, c: ['ink', 'slate'] });
  b.cyl(0.03, 0.6, { at: [-2.1, 0.08, 0], seg: 10, slot: 'metal', c: 'steel' });
  b.box(0.16, 0.16, 0.16, { at: [-2.1, 0.62, 0], r: 0.03, c: 'ink' });
  b.cyl(0.035, 0.75, { at: [-2.1, 0.78, 0], seg: 12, slot: 'metal', c: 'mist' });
  b.cyl(0.035, 0.42, { at: [-2.1, 0.2, 0], seg: 12, slot: 'metal', c: 'mist', s: [1, 1, 1] });
  // spectrum strip: band boxes, a rainbow for the visible part
  const span = STRIP.x1 - STRIP.x0;
  const xOf = (lf: number): number => STRIP.x0 + ((lf - F0) / (F1 - F0)) * span;
  for (const [a, c, colr] of BANDS) {
    if (colr === 'white') {
      const rainbow: ColorLike[] = ['red', 'orange', 'yellow', 'green', 'sky', 'blue', 'violet'];
      const w = (xOf(c) - xOf(a)) / rainbow.length;
      rainbow.forEach((rc, k) => b.box(w, 0.1, 0.32, { at: [xOf(a) + w * (k + 0.5), STRIP.y, STRIP.z], r: 0, mid: true, slot: 'glow', c: rc }));
    } else b.box(xOf(c) - xOf(a) - 0.02, 0.08, 0.3, { at: [(xOf(a) + xOf(c)) / 2, STRIP.y, STRIP.z], r: 0.02, mid: true, c: colr });
  }
  b.box(span + 0.2, 0.06, 0.42, { at: [(STRIP.x0 + STRIP.x1) / 2, STRIP.y - 0.07, STRIP.z], r: 0.02, mid: true, c: 'ink' });
  g.add(b.build().group);
  const marker = new Mesh(new TorusGeometry(0.2, 0.025, 8, 32), glow('yellow', 1.5));
  marker.rotation.x = Math.PI / 2;
  g.add(marker);
  const mk = (color: ColorLike) =>
    new RibbonLines({ capacity: 1600, color, width: 0.03, minPixels: 1.6, intensity: 1.3, dashStrength: 0, base: 1, keepHue: true, endFade: [0.02, 0.18] });
  const eLine = mk(SEMANTIC.fieldE);
  const bLine = mk(SEMANTIC.fieldB);
  const axis = mk('mist');
  axis.setLines([{ points: [new Vector3(-2.1, 0.78, 0), new Vector3(-2.1 + L, 0.78, 0)] }]);
  axis.intensity = 0.5;
  g.add(eLine, bLine, axis);
  return {
    group: g,
    stripAt(lf, out) {
      return out.set(xOf(lf), STRIP.y + 0.08, STRIP.z);
    },
    update(t, lf, front) {
      // on-screen wavelength: 1,8 units at 10⁶ Hz down to 0,3 at 10¹⁸ Hz (log mapping, not to scale)
      const lam = 0.3 + (1.5 * (18 - Math.min(Math.max(lf, 6), 18))) / 12;
      const x0 = -2.1;
      const n = 220;
      const e: Vector3[] = [];
      const bb: Vector3[] = [];
      const stemsE: { points: Vector3[] }[] = [];
      const stemsB: { points: Vector3[] }[] = [];
      for (let k = 0; k <= n; k++) {
        const x = (k / n) * L;
        const ph = 2 * Math.PI * (x / lam - t * 0.5);
        // grows off the antenna, ends at the front (a soft 0,5-unit edge) and fades out over the last unit
        const env = Math.min(x / 0.4, 1) * Math.min(Math.max((front - x) / 0.5, 0), 1) * Math.min((L - x) / 1.0, 1);
        const amp = A * env * Math.sin(ph);
        e.push(new Vector3(x0 + x, 0.78 + amp, 0));
        bb.push(new Vector3(x0 + x, 0.78, amp));
        if (k % 5 === 0 && k > 0) {
          stemsE.push({ points: [new Vector3(x0 + x, 0.78, 0), new Vector3(x0 + x, 0.78 + amp, 0)] });
          stemsB.push({ points: [new Vector3(x0 + x, 0.78, 0), new Vector3(x0 + x, 0.78, amp)] });
        }
      }
      eLine.setLines([{ points: e }, ...stemsE]);
      bLine.setLines([{ points: bb }, ...stemsB]);
      marker.position.set(xOf(lf), STRIP.y + 0.12, STRIP.z);
      marker.scale.setScalar(1 + 0.1 * Math.sin(t * 5));
    },
  };
}
