/**
 * Journey Map geometry (pure, unit-tested): where every chapter sits.
 *
 * Main-path chapters run left → right in journey order, and a node's height is its value on the volume's
 * journey axis (`VolumeManifest.journey.axis`). For electricity the axis is scale (log₁₀ m), so the map is a
 * "mountain of scale": the path climbs from the atom (10⁻¹⁰ m) to the continental grid (10⁶ m) and descends
 * to the house; plant types hang under the `plants` hub and labs under the house as satellites. Another
 * volume brings another axis (frequency, time, level of abstraction) and its own spacing hints.
 * Depth (z) meanders so that the camera gets parallax when it travels along the path.
 */
import type { JourneyAxis, JourneyLayout } from '@/engine/api';
import type { Journey, JourneyChapter } from '../journey';

export interface MapNode {
  readonly chapter: JourneyChapter;
  /** Index among all map nodes (journey order). */
  readonly index: number;
  /** Position in map units. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Platform radius in map units. */
  readonly radius: number;
  /** Index of the parent node for satellites, −1 for main-path nodes. */
  readonly parent: number;
  /** Position along the main path (satellites share their parent's). */
  readonly u: number;
}

export interface MapLayout {
  readonly nodes: readonly MapNode[];
  /** Main-path nodes in order. */
  readonly spine: readonly MapNode[];
  /** The journey axis the ruler shows (range, ticks, formatter). */
  readonly axis: JourneyAxis;
  /** Height of an axis value in map units (0 at `axis.origin`). */
  height(value: number): number;
  /** Ruler ticks from `axis.min` to `axis.max`: axis value and whether the tick is long (labelled). */
  readonly ticks: readonly { readonly value: number; readonly major: boolean }[];
  /** Name of the generic emblem of a chapter group (`VolumeManifest.journey.groups[].emblem`). */
  emblemOf(group: string): string;
  /** Height of the ground plane (below the lowest node). */
  readonly ground: number;
  readonly width: number;
  byId(id: string): MapNode | undefined;
}

/** Ruler ticks of an axis (pure): every `tick` from `min` to `max`, long every `majorEvery`-th. */
export function axisTicks(axis: JourneyAxis): { value: number; major: boolean }[] {
  const out: { value: number; major: boolean }[] = [];
  const n = Math.round((axis.max - axis.min) / axis.tick);
  for (let k = 0; k <= n; k++)
    out.push({ value: axis.min + k * axis.tick, major: k % axis.majorEvery === 0 });
  return out;
}

/** Geometry of a volume's journey: spacing from its layout hints (`MAP`), heights from its axis. */
export function layoutJourney(journey: Journey): MapLayout {
  const MAP: JourneyLayout = journey.volume.journey.layout;
  const axis = journey.volume.journey.axis;
  const scaleHeight = (value: number): number => (value - axis.origin) * MAP.dy;
  const roots = journey.roots;
  const n = roots.length;
  const nodes: MapNode[] = [];
  const spine: MapNode[] = [];
  const byId = new Map<string, MapNode>();
  roots.forEach((chapter, i) => {
    const node: MapNode = {
      chapter,
      index: nodes.length,
      x: (i - (n - 1) / 2) * MAP.dx,
      y: scaleHeight(chapter.axisValue),
      // two gentle waves along the journey; ends bend toward the viewer
      z: Math.sin(i * 0.95 + 0.4) * MAP.dz + Math.cos(i * 0.37) * MAP.dz * 0.5,
      radius: MAP.rootRadius,
      parent: -1,
      u: i,
    };
    nodes.push(node);
    spine.push(node);
    byId.set(chapter.id, node);
    const kids = journey.childrenOf(chapter.id);
    // satellites hang under their hub as a small tree: rows of up to five, centred, stepping toward the viewer
    const perRow = kids.length > 5 ? Math.ceil(kids.length / 2) : kids.length;
    kids.forEach((kid, k) => {
      const row = Math.floor(k / perRow);
      const inRow = row === 0 ? Math.min(perRow, kids.length) : kids.length - perRow;
      const col = k - row * perRow;
      const child: MapNode = {
        chapter: kid,
        index: nodes.length,
        x: node.x + (col - (inRow - 1) / 2) * MAP.orbit + (row % 2) * 18,
        y: node.y - 150 - row * 132,
        z: node.z + 90 + row * 80,
        radius: MAP.childRadius,
        parent: node.index,
        u: i,
      };
      nodes.push(child);
      byId.set(kid.id, child);
    });
  });
  const ys = nodes.map((m) => m.y);
  return {
    nodes,
    spine,
    axis,
    height: scaleHeight,
    ticks: axisTicks(axis),
    emblemOf: (group) => journey.volume.journey.groups.find((g) => g.id === group)?.emblem ?? 'generic',
    ground: Math.min(scaleHeight(axis.min), ...ys) - 40,
    width: Math.max(n - 1, 1) * MAP.dx,
    byId: (id) => byId.get(id),
  };
}

/** Catmull-Rom-like smooth point on the main path at parameter `u` (0 … spine.length − 1). */
export function pathPoint(layout: MapLayout, u: number): { x: number; y: number; z: number } {
  const s = layout.spine;
  const k = Math.min(Math.max(u, 0), s.length - 1);
  const i = Math.min(Math.floor(k), s.length - 2);
  const t = k - i;
  const p0 = s[Math.max(i - 1, 0)]!;
  const p1 = s[i]!;
  const p2 = s[Math.min(i + 1, s.length - 1)]!;
  const p3 = s[Math.min(i + 2, s.length - 1)]!;
  const cr = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), z: cr(p0.z, p1.z, p2.z, p3.z) };
}
