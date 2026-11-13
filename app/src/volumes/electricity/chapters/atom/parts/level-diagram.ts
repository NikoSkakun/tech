/**
 * Energy-level diagram of hydrogen as a world console: shelves n = 1…N at their true heights
 * (E_n = −13,6 eV / n², so the upper levels crowd under the ionisation limit at 0 eV), an electron marker on
 * the current level and fading arrows for the latest jumps. Used by `models` (N = 3) and `ions-photons` (N = 6).
 *
 * World text costs screen: a console keeps 15 px-eq at ≥ 16 px of a 720p window, so the diagram is drawn on
 * few px-eq — level number left, energy right, arrows in the lane between them.
 */
import type { ChapterContext } from '@/engine/api';
import { fmtNumber } from '@/content';
import { levelEnergyEv } from '@electricity/sim/atom';
import type { ColorLike } from '@/style';
import { Label, UiNode, lit, rgba, type Painter } from '@/ui3d';
import { createConsole, type PinnedConsole } from './console';

const W = 200;
const PAD_TOP = 34;
const PAD_BOTTOM = 14;
/** Height of the energy axis per diagram size: room for the labels of n = 2 and n = 3 under the limit. */
const AXIS = { few: 216, many: 236 } as const;
/** The lane of the jump arrows: x of the first arrow and the pitch of the next ones (4 slots). */
const LANE_X = -18;
const LANE_PITCH = 13;
const MARKER_X = -W / 2 + 68;
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
  /** Marker height as a continuous level value (eased). */
  marker = 1;
  ionised = 0;
  readonly arrows: Arrow[] = [];
  private readonly axis: number;

  constructor(
    readonly levels: number,
    limitText: string,
  ) {
    const axis = levels > 3 ? AXIS.many : AXIS.few;
    super({ name: 'level-diagram', width: W, height: PAD_TOP + axis + PAD_BOTTOM, dir: 'stack' });
    this.axis = axis;
    // label the well-separated levels; the crowded upper ones share one caption
    const labelled = levels > 3 ? [1, 2, 3] : Array.from({ length: levels }, (_, i) => i + 1);
    for (const n of labelled) {
      const dy = this.top(n) - 4;
      this.add(
        new Label(
          `n = ${n}`,
          { font: 'mono', size: 17, color: 'white', nowrap: true },
          { float: { ax: 0, ay: 0, px: 0, py: 1, dx: 2, dy } },
        ),
        new Label(
          `${fmtNumber(Math.round(levelEnergyEv(n) * 100) / 100)} eV`,
          { font: 'mono', size: 15, color: 'mist', nowrap: true },
          { float: { ax: 1, ay: 0, px: 1, py: 1, dx: -2, dy } },
        ),
      );
    }
    this.add(
      new Label(
        limitText,
        { size: 15, color: 'amber', nowrap: true },
        { float: { ax: 0, ay: 0, px: 0, py: 1, dx: 2, dy: PAD_TOP - 6 } },
      ),
    );
  }

  /** Distance of level n from the top edge (true energy scale: y ∝ −1/n²). */
  top(n: number): number {
    return PAD_TOP + this.axis / (n * n);
  }

  override paint(p: Painter): void {
    const y = (n: number): number => this.bh / 2 - this.top(n);
    const limit = this.bh / 2 - PAD_TOP;
    const x0 = -this.bw / 2;
    const x1 = this.bw / 2;
    p.line(x0, limit, x1, limit, 2, { fill: rgba('amber', 0.9), dash: 10 });
    for (let n = 1; n <= this.levels; n++) {
      const here = Math.max(0, 1 - Math.abs(this.marker - n) * 2) * (1 - this.ionised);
      // n ≥ 4 crowd under the limit: short ticks in the arrow lane, clear of the captions of n = 3
      const short = n > 3;
      p.line(
        short ? LANE_X - 14 : x0,
        y(n),
        short ? LANE_X + 3 * LANE_PITCH + 14 : x1,
        y(n),
        short ? 1.6 : 3,
        {
          fill: here > 0 ? lit(rgba('cyan'), 1 + here) : rgba('sky', n <= 3 ? 0.85 : 0.55),
        },
      );
    }
    for (const a of this.arrows) {
      const alpha = Math.min(1, (ARROW_LIFE - a.age) / 0.8) * Math.min(1, a.age / 0.15);
      const c = lit(rgba(a.color, alpha), 1.5);
      const y0 = a.from > this.levels ? limit + 10 : y(a.from);
      const y1 = a.to > this.levels ? limit + 10 : y(a.to);
      const dir = Math.sign(y1 - y0);
      p.line(a.x, y0, a.x, y1, 3, { fill: c });
      p.line(a.x, y1, a.x - 6, y1 - dir * 9, 3, { fill: c });
      p.line(a.x, y1, a.x + 6, y1 - dir * 9, 3, { fill: c });
    }
    // the electron: on its level, or free above the limit
    const level = Math.min(this.marker, this.levels);
    const my = y(level) * (1 - this.ionised) + (limit + 14) * this.ionised;
    p.circle(MARKER_X, my, 13, {
      fill: lit(rgba('cyan'), 1.6),
      border: rgba('white', 0.9),
      bw: 1.5,
      glow: 10,
      glowAlpha: 0.6,
    });
  }
}

export interface LevelDiagramOptions {
  name: string;
  /** Number of levels drawn (3 in `models`, 6 in `ions-photons`). */
  levels: number;
  /** Caption of the dashed 0 eV line. */
  limitText: string;
  /** Top-centre of the console in the world, and its world units per px-eq. */
  top: readonly [number, number, number];
  unit: number;
}

export interface LevelDiagram {
  console: PinnedConsole;
  /** Put the electron on level n (`'ionized'` = free, above the limit). */
  setLevel(n: number | 'ionized', instant?: boolean): void;
  /** Draw a fading arrow for a jump (levels above the diagram's range mean "from / to the continuum"). */
  transition(from: number, to: number, color: ColorLike): void;
  update(dt: number): void;
}

export function createLevelDiagram(ctx: ChapterContext, opts: LevelDiagramOptions): LevelDiagram {
  const node = new DiagramNode(opts.levels, opts.limitText);
  const console3d = createConsole(ctx, {
    name: opts.name,
    width: W + 44,
    unit: opts.unit,
    top: opts.top,
    twin: true, // the dock's «Рівень n» / «Енергія E_n» readouts
    children: [node],
  });
  let slot = 0;
  return {
    console: console3d,
    setLevel(n, instant = false) {
      const ionised = n === 'ionized' ? 1 : 0;
      const marker = n === 'ionized' ? node.marker : n;
      if (instant) {
        node.marker = marker;
        node.ionised = ionised;
        node.repaint();
      } else
        ctx.stage.scope.to(
          node,
          { marker, ionised },
          { duration: 0.45, ease: 'power2.inOut', onUpdate: () => node.repaint() },
        );
    },
    transition(from, to, color) {
      node.arrows.push({ from, to, color, age: 0, x: LANE_X + (slot++ % 4) * LANE_PITCH });
    },
    update(dt) {
      console3d.pin();
      if (node.arrows.length === 0) return;
      for (const a of node.arrows) a.age += dt;
      while (node.arrows.length > 0 && node.arrows[0]!.age >= ARROW_LIFE) node.arrows.shift();
      node.repaint();
    },
  };
}
