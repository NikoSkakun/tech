/**
 * Step 4 «мініатюра лопаті з підсвіченою закруткою»: the blade laid out from root (left) to tip (right) as a
 * row of its sections, each drawn in the same view as the big specimen (plane of rotation horizontal, wind from
 * below) and turned to its own setting angle θ(r) = φ(r) − α from the simulation (`bladeSection`): near
 * the root the chord leans into the wind, at the tip it lies almost in the plane of rotation. The section
 * the «Позиція вздовж лопаті» slider points at is drawn bright and slides along — the twist grows before the
 * eyes. Sizes follow the kit blade's chord law, so the row also reads as the blade's planform.
 */
import { Group, Vector3 } from 'three';
import { RibbonLines, type RibbonLine } from '@/fx';
import { bladeChord } from '@/kit';
import { bladeSection } from '@electricity/sim/plant-wind';
import { createLabel } from './label';
import { sectionOutline } from './section';

const STATIONS = [0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
/** Length of the miniature, toy metres, and how much its chords are exaggerated to stay readable. */
const LENGTH = 20;
const CHORD_GAIN = 2.5;

export interface TwistView {
  group: Group;
  /** Local position of the highlighted section (callout anchor). */
  readonly marker: Vector3;
  /** Move the highlighted section to r/R; all sections take the setting angle for angle of attack `alphaDeg`. */
  set(rOverR: number, alphaDeg: number): void;
}

export function buildTwistView(labels: { root: string; tip: string }): TwistView {
  const group = new Group();
  group.name = 'twist-view';
  const unit = sectionOutline(12);
  /** Outline of the section at r/R, turned to its setting angle, at its place along the row. */
  const section = (r: number, alphaDeg: number): Vector3[] => {
    const chord = bladeChord(r, LENGTH, 1.5) * CHORD_GAIN;
    // same view as the specimen (plane of rotation horizontal): the chord rises by θ = φ(r) − α
    const rot = ((bladeSection(r).phiDeg - alphaDeg) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    return unit.map(([x, y]) => new Vector3(r * LENGTH + (x * cos - y * sin) * chord, (x * sin + y * cos) * chord, 0));
  };
  const look = { dashStrength: 0, base: 1, hotCore: 0, blend: 'normal' } as const;
  const row = new RibbonLines({ capacity: (STATIONS.length + 1) * (unit.length + 1) + 4, color: 'mist', width: 0.1, minPixels: 1.7, intensity: 1.05, endFade: [0, 0], ...look });
  // the pitch axis all sections are threaded on
  const axis: RibbonLine = { points: [new Vector3(STATIONS[0]! * LENGTH - 2.5, 0, 0), new Vector3(LENGTH + 1.5, 0, 0)], brightness: 0.4 };
  const active = new RibbonLines({ capacity: unit.length + 4, color: 'cyan', width: 0.16, minPixels: 2.4, intensity: 1.3, endFade: [0, 0], ...look });
  row.renderOrder = active.renderOrder = 5;
  const root = createLabel(labels.root, 'mist', 16);
  root.position.set(STATIONS[0]! * LENGTH - 1, -3.6, 0);
  const tip = createLabel(labels.tip, 'mist', 16);
  tip.position.set(LENGTH, -3.6, 0);
  group.add(row, active, root, tip);
  const marker = new Vector3();
  return {
    group,
    marker,
    set(rOverR, alphaDeg) {
      const r = Math.min(1, Math.max(0.1, rOverR));
      row.setLines([...STATIONS.map((s): RibbonLine => ({ points: section(s, alphaDeg), closed: true, brightness: 0.9 })), axis]);
      active.setLines([{ points: section(r, alphaDeg), closed: true }]);
      marker.set(r * LENGTH, bladeChord(r, LENGTH, 1.5) * CHORD_GAIN * 0.75 + 0.4, 0);
    },
  };
}
