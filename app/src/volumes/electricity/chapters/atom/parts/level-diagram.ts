/**
 * Energy-level diagram of hydrogen as a world console: shelves n = 1…N at their true heights
 * (E_n = −13,6 eV / n², so the upper levels crowd under the ionisation limit at 0 eV), an electron marker on
 * the current level and fading arrows for the latest jumps. Used by `models` (N = 3) and `ions-photons` (N = 6).
 */
import type { ChapterContext } from '@/engine/api';
import { fmtNumber } from '@/content';
import { levelEnergyEv } from '@electricity/sim/atom';
import type { ColorLike } from '@/style';
import { Label, UiNode, lit, rgba, worldSurface, type Painter, type UiSurface } from '@/ui3d';

const W = 250;
const H = 430;
const PAD_TOP = 46;
const PAD_BOTTOM = 26;
const SHELF_X0 = -W / 2 + 18;
const SHELF_X1 = 34;
/** Seconds an arrow stays visible. */
const ARROW_LIFE = 3.2;

interface Arrow {
  from: number;
  to: number;
  color: ColorLike;
  age: number;
  x: number;
}

class DiagramNode extends UiNode {
  /** Marker height as a continuous level value (eased); Infinity-like = above the limit. */
  marker = 1;
  ionised = 0;
  readonly arrows: Arrow[] = [];

  constructor(
    readonly levels: number,
    limitText: string,
  ) {
    super({ name: 'level-diagram', width: W, height: H, dir: 'stack' });
    const text = (n: number): string =>
      `n = ${n}   ${fmtNumber(Math.round(levelEnergyEv(n) * 100) / 100)} eV`;
    // label the well-separated levels; the crowded upper ones share one label
    const labelled = levels > 3 ? [1, 2, 3] : Array.from({ length: levels }, (_, i) => i + 1);
    for (const n of labelled)
      this.add(
        new Label(
          text(n),
          { font: 'mono', size: 15, color: 'mist', nowrap: true },
          {
            float: { ax: 0, ay: 0, px: 0, py: 1, dx: 18, dy: this.top(n) - 5 },
          },
        ),
      );
    if (levels > 3)
      this.add(
        new Label(
          `n = 4…${levels}`,
          { font: 'mono', size: 14, color: 'steel', nowrap: true },
          {
            float: { ax: 1, ay: 0, px: 1, py: 0.5, dx: -10, dy: this.top(5) },
          },
        ),
      );
    this.add(
      new Label(
        limitText,
        { size: 15, color: 'amber', nowrap: true },
        {
          float: { ax: 0, ay: 0, px: 0, py: 1, dx: 18, dy: PAD_TOP - 8 },
        },
      ),
    );
  }

  /** Distance of level n from the top edge (true energy scale: y ∝ −1/n²). */
  top(n: number): number {
    return PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) / (n * n);
  }

  override paint(p: Painter): void {
    const y = (n: number): number => this.bh / 2 - this.top(n);
    const limit = this.bh / 2 - PAD_TOP;
    p.panel(0, 0, this.bw, this.bh, {
      fill: rgba('bg.deep', 0.86),
      border: rgba('cyan', 0.45),
      bw: 1.5,
      r: 18,
    });
    p.line(SHELF_X0, limit, this.bw / 2 - 14, limit, 2, { fill: rgba('amber', 0.9), dash: 12 });
    for (let n = 1; n <= this.levels; n++) {
      const here = Math.max(0, 1 - Math.abs(this.marker - n) * 2) * (1 - this.ionised);
      p.line(SHELF_X0, y(n), SHELF_X1, y(n), n <= 3 ? 3 : 2, {
        fill: here > 0 ? lit(rgba('cyan'), 1 + here) : rgba('sky', n <= 3 ? 0.85 : 0.6),
      });
    }
    for (const a of this.arrows) {
      const alpha = Math.min(1, (ARROW_LIFE - a.age) / 0.8) * Math.min(1, a.age / 0.15);
      const c = rgba(a.color, alpha);
      const y0 = a.from > this.levels ? limit + 14 : y(a.from);
      const y1 = a.to > this.levels ? limit + 14 : y(a.to);
      const dir = Math.sign(y1 - y0);
      p.line(a.x, y0, a.x, y1, 3, { fill: lit(c, 1.5) });
      p.line(a.x, y1, a.x - 7, y1 - dir * 10, 3, { fill: lit(c, 1.5) });
      p.line(a.x, y1, a.x + 7, y1 - dir * 10, 3, { fill: lit(c, 1.5) });
    }
    // the electron: on its level, or free above the limit
    const level = Math.min(this.marker, this.levels);
    const my = y(level) * (1 - this.ionised) + (limit + 18) * this.ionised;
    p.circle(SHELF_X1 - 22, my + 9, 15, {
      fill: lit(rgba('cyan'), 1.6),
      border: rgba('white', 0.9),
      bw: 1.5,
      glow: 12,
      glowAlpha: 0.6,
    });
  }
}

export interface LevelDiagram {
  surface: UiSurface;
  /** Put the electron on level n (`'ionized'` = free, above the limit). */
  setLevel(n: number | 'ionized', instant?: boolean): void;
  /** Draw a fading arrow for a jump (levels above the diagram's range mean "from / to the continuum"). */
  transition(from: number, to: number, color: ColorLike): void;
  update(dt: number): void;
}

export function createLevelDiagram(ctx: ChapterContext, levels: number, limitText: string): LevelDiagram {
  const surface = worldSurface(ctx, { width: W, height: H, unit: 0.019, name: 'level-diagram' });
  const node = new DiagramNode(levels, limitText);
  surface.root.add(node);
  let slot = 0;
  return {
    surface,
    setLevel(n, instant = false) {
      const ionised = n === 'ionized' ? 1 : 0;
      const marker = n === 'ionized' ? node.marker : n;
      if (instant) {
        node.marker = marker;
        node.ionised = ionised;
        node.repaint();
      } else
        ctx.tweens.to(
          node,
          { marker, ionised },
          { duration: 0.45, ease: 'power2.inOut', onUpdate: () => node.repaint() },
        );
    },
    transition(from, to, color) {
      node.arrows.push({ from, to, color, age: 0, x: SHELF_X1 + 26 + (slot++ % 5) * 18 });
    },
    update(dt) {
      if (node.arrows.length === 0) return;
      for (const a of node.arrows) a.age += dt;
      while (node.arrows.length > 0 && node.arrows[0]!.age >= ARROW_LIFE) node.arrows.shift();
      node.repaint();
    },
  };
}
