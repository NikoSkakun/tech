/**
 * Lines of the magnetic field **B** (`magenta`, STYLE_GUIDE §2.2): glowing ribbons whose dashes — the script's
 * «намистинки» — slide along the field (from N to S outside a magnet). Wraps `RibbonLines`; `fromSim` maps
 * the simulation's table-plane streamlines (metres, x east, y north) onto the world table at a height.
 */
import { Vector3 } from 'three';
import { RibbonLines, type RibbonLine } from '@/fx';
import { SEMANTIC, type ColorLike } from '@/style';
import { S } from '../world';

export interface BLines {
  mesh: RibbonLines;
  /** Replace the lines with sim streamlines drawn at height `h` (units); `extra` = more world lines. */
  fromSim(lines: readonly { points: readonly { x: number; y: number }[] }[], h: number, extra?: RibbonLine[]): void;
  set(lines: RibbonLine[]): void;
}

export function createBLines(capacity: number, o: { width?: number; intensity?: number; dashSpeed?: number; color?: ColorLike } = {}): BLines {
  const mesh = new RibbonLines({
    capacity,
    color: o.color ?? SEMANTIC.fieldB,
    width: o.width ?? 0.022,
    minPixels: 1.8,
    intensity: o.intensity ?? 1.3,
    dashRepeat: 2.2,
    dashSpeed: o.dashSpeed ?? 0.35,
    dashStrength: 0.7,
    base: 0.45,
    keepHue: true,
    endFade: [0.02, 0.02],
  });
  mesh.frustumCulled = false;
  return {
    mesh,
    fromSim(lines, h, extra = []) {
      const out: RibbonLine[] = lines
        .filter((l) => l.points.length > 2)
        .map((l) => ({ points: l.points.map((p) => new Vector3(p.x * S, h, -p.y * S)) }));
      mesh.setLines([...out, ...extra]);
    },
    set(lines) {
      mesh.setLines(lines);
    },
  };
}
