/**
 * The chapter's holographic "oscilloscope strip" and phasor dial (`fx` Scope / plain polar screen) on a slim
 * hovering frame, with short world tags for the vertical range and the time window. Traces are drawn from
 * sample arrays (`setTrace`), newest value on the LEFT edge (next to the dial), older values flowing right.
 * Vertical scale: value 1 = `VALUE_H` × height/2 above the centre — the dial uses the same scale (`dialRadius`)
 * so the dashed guide from a phasor tip to the newest point of its curve is horizontal.
 */
import { Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createScope, createScreen, RibbonLines, type Scope } from '@/fx';
import { K, type ColorLike } from '@/style';
import type { Text3D } from '@/text';
import { tag } from '../world';

/** Fraction of the half-height that value 1 reaches on the scope (fx Scope draws ±0.8 of the half-height). */
export const VALUE_H = 0.8;

export interface HoloScope {
  group: Group;
  scope: Scope;
  width: number;
  height: number;
  /** Feed channel `i` with values −1…1, index 0 = newest (left edge). */
  setTrace(i: number, values: ArrayLike<number>): void;
  /** Local position of value `v` at the left edge (where the newest point is drawn). */
  leftPoint(v: number, out?: Vector3): Vector3;
  rangeTag: Text3D;
  timeTag: Text3D;
}

export function createHoloScope(o: { width: number; height: number; channels: readonly ColorLike[]; samples?: number; accent?: ColorLike; lineWidth?: number }): HoloScope {
  const group = new Group();
  group.name = 'holo-scope';
  const scope = createScope({ width: o.width, height: o.height, channels: o.channels, samples: o.samples ?? 200, accent: o.accent ?? 'teal', lineWidth: o.lineWidth ?? o.height * 0.018 });
  scope.frozen = true;
  group.add(scope);
  group.add(frame(o.width, o.height));
  const rangeTag = tag('', 18, 'mist', 'mono');
  rangeTag.position.set(-o.width / 2 + 0.7, o.height / 2 - 0.3, 0.05);
  const timeTag = tag('', 18, 'mist', 'mono');
  timeTag.position.set(o.width / 2 - 0.95, -o.height / 2 + 0.3, 0.05);
  group.add(rangeTag, timeTag);
  const flipped = new Float32Array(o.samples ?? 200);
  return {
    group,
    scope,
    width: o.width,
    height: o.height,
    setTrace(i, values) {
      // fx Scope draws index 0 at the left: our values already are newest-first
      const n = flipped.length;
      for (let k = 0; k < n; k++) flipped[k] = values[Math.min(values.length - 1, Math.round((k / (n - 1)) * (values.length - 1)))] ?? 0;
      scope.setSamples(i, flipped);
    },
    leftPoint(v, out = new Vector3()) {
      return out.set(-o.width / 2 * 0.94, Math.max(-1.15, Math.min(1.15, v)) * (o.height / 2) * VALUE_H, 0.03);
    },
    rangeTag,
    timeTag,
  };
}

/** A polar dial plate of radius `r` (no projection axis) for hand-made phasor arrows. */
export function createDial(size: number, accent: ColorLike = 'teal'): Group {
  const g = new Group();
  g.name = 'dial';
  g.add(createScreen({ width: size, height: size, accent, kind: 'polar' }));
  g.add(frame(size, size));
  return g;
}

/** Radius on a dial of `size` that matches value 1 of a scope of height `h` (keeps guides horizontal). */
export function dialRadius(h: number): number {
  return (h / 2) * VALUE_H;
}

/** Dashed guide line (phasor tip → curve). */
export function createGuide(color: ColorLike, width = 0.03): RibbonLines {
  const g = new RibbonLines({ capacity: 4, color, width, intensity: 0.9, dashRepeat: 4, dashStrength: 1, dashSpeed: 0, base: 0, endFade: [0, 0], minPixels: 1.4 });
  g.renderOrder = 3;
  return g;
}

/** Slim dark rim with a teal edge light around a screen of w × h. */
function frame(w: number, h: number): Group {
  const g = new Group();
  const rim = K.toon({ color: 'ink', rim: 1.2, emissive: 'teal', emissiveIntensity: 0.12 });
  const t = 0.07;
  const bars: [number, number, number, number][] = [
    [0, h / 2 + t / 2, w + 2 * t, t],
    [0, -h / 2 - t / 2, w + 2 * t, t],
    [-w / 2 - t / 2, 0, t, h],
    [w / 2 + t / 2, 0, t, h],
  ];
  for (const [x, y, bw, bh] of bars) {
    const m = new Mesh(new RoundedBoxGeometry(bw, bh, 0.08, 2, 0.03), rim);
    m.position.set(x, y, -0.01);
    g.add(m);
  }
  const back = new Mesh(new RoundedBoxGeometry(w + 0.1, h + 0.1, 0.04, 2, 0.02), K.toon({ color: 'bg.deep', rim: 0.4 }));
  back.position.z = -0.06;
  g.add(back);
  return g;
}
