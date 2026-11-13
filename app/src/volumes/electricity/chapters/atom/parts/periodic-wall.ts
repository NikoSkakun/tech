/**
 * PeriodicWall — the periodic table as a holographic wall behind the atom (step `shells`): tiles 1…36 are
 * live "candy" buttons coloured by block (s / p / d) that lift on hover and report the hovered / tapped
 * element; periods 5–7 are dimmed placeholders, except Ag and Au which light up for the «Група 11» hint.
 * A world console (`worldSurface`): one draw call for all tiles, crisp symbols at any zoom.
 */
import type { ChapterContext } from '@/engine/api';
import { ELEMENTS, GROUP_11 } from '@electricity/sim/atom';
import {
  Control,
  Label,
  UiNode,
  lit,
  mixRgba,
  rgba,
  worldSurface,
  type Painter,
  type UiSurface,
} from '@/ui3d';

const TILE = 46;
const PITCH = 52;
const COLS = 18;
const ROWS = 7;
/** Block colours: s-block, p-block, d-block (not particle semantics — just three families). */
const BLOCK = { s: 'pink', p: 'sky', d: 'violet' } as const;

/** Row / column (0-based) of element Z ≤ 36 in the 18-column table, and its block. */
function place(z: number): { row: number; col: number; block: keyof typeof BLOCK } {
  if (z === 1) return { row: 0, col: 0, block: 's' };
  if (z === 2) return { row: 0, col: 17, block: 's' };
  const row = z <= 10 ? 1 : z <= 18 ? 2 : 3;
  const i = z - (row === 1 ? 3 : row === 2 ? 11 : 19);
  if (row < 3) return i < 2 ? { row, col: i, block: 's' } : { row, col: i + 10, block: 'p' };
  return { row, col: i, block: i < 2 ? 's' : i < 12 ? 'd' : 'p' };
}

class Tile extends Control {
  selected = 0;
  highlighted = 0;
  constructor(
    readonly element: number,
    symbol: string,
    private readonly block: keyof typeof BLOCK,
    private readonly pick: (z: number) => void,
    live: boolean,
  ) {
    super({ name: `tile-${element}`, width: TILE, height: TILE, dir: 'stack' });
    this.lift = 10;
    this.add(
      new Label(
        String(element),
        { font: 'mono', size: 14, color: 'white', nowrap: true },
        { float: { ax: 0, ay: 0, dx: 5, dy: 3 } },
      ),
    );
    this.add(
      new Label(
        symbol,
        { font: 'display', size: 19, color: 'white', nowrap: true },
        { float: { ax: 0.5, ay: 1, dy: -4 } },
      ),
    );
    if (!live) this.opacity = 0.32;
    this.on({ tooltip: symbol });
  }
  protected override activate(): void {
    this.pick(this.element);
  }
  set(props: { selected?: number; highlighted?: number }): void {
    this.tween({ ...props }, { duration: 0.2 });
  }
  override paint(p: Painter): void {
    const tone = rgba(BLOCK[this.block]);
    const glow = Math.max(this.hoverT, this.selected, this.highlighted);
    p.panel(0, 0, this.bw, this.bh, {
      r: 11,
      fill: mixRgba(mixRgba(rgba('bg.indigo'), tone, 0.62), lit(tone, 1.25), 0.5 * glow),
      fill2: mixRgba(rgba('bg.deep'), tone, 0.4),
      border: mixRgba(
        mixRgba(tone, rgba('white'), 0.35 + 0.5 * this.hoverT),
        rgba('yellow'),
        Math.max(this.selected, this.highlighted),
      ),
      bw: 1.5 + 1.5 * Math.max(this.selected, this.highlighted),
      glow: 12 * glow,
      glowAlpha: 0.55,
    });
  }
}

export interface PeriodicWall {
  surface: UiSurface;
  /** Element whose tile the pointer is over right now (0 = none). */
  hovered(): number;
  select(z: number): void;
  /** Light up Cu, Ag, Au. */
  setGroup11(on: boolean): void;
}

export function createPeriodicWall(ctx: ChapterContext, onPick: (z: number) => void): PeriodicWall {
  const width = COLS * PITCH;
  const height = ROWS * PITCH;
  const surface = worldSurface(ctx, { width, height, unit: 0.0165, mode: 'scene', name: 'periodic-wall' });
  const tiles = new Map<number, Tile>();
  const taken = new Set<string>();
  const at = (row: number, col: number) => ({
    float: { ax: 0, ay: 0, px: 0, py: 0, dx: col * PITCH + 3, dy: row * PITCH + 3 },
  });

  // dim placeholders for periods 5–7 (painted by the backdrop node), live tiles on top
  class Backdrop extends UiNode {
    override paint(p: Painter): void {
      for (let row = 4; row < ROWS; row++)
        for (let col = 0; col < COLS; col++) {
          if (taken.has(`${row}:${col}`)) continue;
          const x = -this.bw / 2 + col * PITCH + 3 + TILE / 2;
          const y = this.bh / 2 - row * PITCH - 3 - TILE / 2;
          p.panel(x, y, TILE, TILE, { r: 11, fill: rgba('slate', 0.2), border: rgba('steel', 0.25), bw: 1 });
        }
    }
  }
  const backdrop = new Backdrop({ width, height, dir: 'stack' });
  for (const el of ELEMENTS.filter((e) => e.z <= 36)) {
    const { row, col, block } = place(el.z);
    const tile = new Tile(el.z, el.symbol, block, onPick, true);
    tile.float = at(row, col).float;
    tiles.set(el.z, tile);
    backdrop.add(tile);
  }
  // Ag (period 5) and Au (period 6) sit under Cu in group 11 (column index 10)
  GROUP_11.filter((g) => g.z > 36).forEach((g, i) => {
    const tile = new Tile(g.z, g.symbol, 'd', onPick, false);
    tile.float = at(4 + i, 10).float;
    taken.add(`${4 + i}:10`);
    tiles.set(g.z, tile);
    backdrop.add(tile);
  });
  surface.root.add(backdrop);

  let selected = 0;
  return {
    surface,
    hovered() {
      for (const [z, tile] of tiles) if (z <= 36 && tile.hoverT > 0.5) return z;
      return 0;
    },
    select(z) {
      if (z === selected) return;
      tiles.get(selected)?.set({ selected: 0 });
      tiles.get(z)?.set({ selected: 1 });
      selected = z;
    },
    setGroup11(on) {
      for (const g of GROUP_11) {
        const tile = tiles.get(g.z)!;
        tile.set({ highlighted: on ? 1 : 0 });
        if (g.z > 36) tile.opacity = on ? 1 : 0.32;
      }
    },
  };
}
