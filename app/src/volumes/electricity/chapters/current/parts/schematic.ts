/**
 * Circuit diagram of step 5 in standard symbols (IEC 60617 look): a cell (long thin line = «+», short thick =
 * «−»), a switch, a fuse (rectangle with the conductor through it) and a lamp (circle with a cross), drawn on
 * the HUD board and kept in sync with the 3D circuit: the same component order, switch state, blown fuse,
 * jumper position. A diagram shows connections, not the real placement.
 */
import { UiNode, lit, rgba, type Painter } from '@/ui3d';

export type SchematicPart = 'switch' | 'fuse' | 'lamp';
export interface SchematicState {
  /** Components on the top rail, left → right as on the table. */
  order: readonly SchematicPart[];
  closed: boolean;
  fuseInstalled: boolean;
  fuseBlown: boolean;
  /** 0…1. */
  lamp: number;
  jumper: 'none' | 'lamp' | 'battery';
  /** Current flows in the main loop. */
  live: boolean;
  /** Short-circuit current flows somewhere. */
  short: boolean;
}

export class Schematic extends UiNode {
  private state: SchematicState = {
    order: ['lamp', 'fuse', 'switch'],
    closed: false,
    fuseInstalled: true,
    fuseBlown: false,
    lamp: 0,
    jumper: 'none',
    live: false,
    short: false,
  };
  private key = '';

  constructor(height = 170) {
    super({ width: 'fill', height });
  }

  set(next: SchematicState): void {
    const key = `${next.order.join()}|${next.closed}|${next.fuseInstalled}|${next.fuseBlown}|${Math.round(next.lamp * 10)}|${next.jumper}|${next.live}|${next.short}`;
    if (key === this.key) return;
    this.key = key;
    this.state = next;
    this.repaint();
  }

  override paint(p: Painter): void {
    const s = this.state;
    const W = Math.min(this.w - 48, 440);
    const H = this.h - 56;
    const x0 = -W / 2;
    const x1 = W / 2;
    const top = H / 2;
    const bot = -H / 2;
    const idle = rgba('mist', 0.9);
    const wire =
      s.short && s.jumper !== 'battery' ? lit(rgba('red'), 1.5) : s.live ? lit(rgba('yellow'), 1.5) : idle;
    const hot = lit(rgba('red'), 1.6);
    const T = 3;
    const seg = (ax: number, ay: number, bx: number, by: number, c = wire, w = T): void =>
      p.line(ax, ay, bx, by, w, { fill: c });
    // rails and the cell (bottom, «+» on the right like the holder on the table)
    seg(x0, bot, x0, top);
    seg(x1, bot, x1, top);
    seg(x0, bot, -9, bot);
    seg(9, bot, x1, bot);
    seg(9, bot - 20, 9, bot + 20, wire, 3);
    seg(-9, bot - 10, -9, bot + 10, wire, 7);
    seg(22, bot + 20, 34, bot + 20, rgba('coral'), 2.5);
    seg(28, bot + 14, 28, bot + 26, rgba('coral'), 2.5);
    seg(-34, bot + 20, -22, bot + 20, rgba('sky'), 2.5);
    const xs = [x0 + W / 6, 0, x1 - W / 6];
    const half = W / 6;
    s.order.forEach((part, k) => {
      const cx = xs[k]!;
      const a = cx - half;
      const b = cx + half;
      if (part === 'switch') {
        seg(a, top, cx - 22, top);
        seg(cx + 22, top, b, top);
        p.circle(cx - 22, top, 9, { fill: wire });
        p.circle(cx + 22, top, 9, { fill: wire });
        // blade hinged on the right contact; open = lifted 30°
        if (s.closed) seg(cx + 22, top, cx - 22, top);
        else seg(cx + 22, top, cx - 16, top + 24);
      } else if (part === 'fuse') {
        seg(a, top, cx - 28, top);
        seg(cx + 28, top, b, top);
        if (!s.fuseInstalled) seg(cx - 28, top, cx + 28, top);
        else {
          const c = s.fuseBlown ? hot : wire;
          p.rect(cx, top, 56, 22, { r: 3, border: c, bw: T, fill: rgba('bg.deep', 0.6) });
          if (s.fuseBlown) {
            seg(cx - 28, top, cx - 7, top, c);
            seg(cx + 7, top, cx + 28, top, c);
          } else seg(cx - 28, top, cx + 28, top);
        }
      } else {
        const r = 19;
        seg(a, top, cx - r, top);
        seg(cx + r, top, b, top);
        p.circle(cx, top, 2 * r, {
          fill: lit(rgba('yellow', 0.15 + 0.85 * s.lamp), 1 + 0.8 * s.lamp),
          border: wire,
          bw: T,
          glow: 14 * s.lamp,
          glowAlpha: 0.5,
        });
        const d = r * 0.7;
        seg(cx - d, top - d, cx + d, top + d, s.lamp > 0.5 ? rgba('bg.deep') : wire, 2.5);
        seg(cx - d, top + d, cx + d, top - d, s.lamp > 0.5 ? rgba('bg.deep') : wire, 2.5);
        if (s.jumper === 'lamp') {
          // the bypass: a plain wire in parallel with the lamp
          const c = s.short ? hot : rgba('orange');
          seg(a + 10, top, a + 10, top - 36, c);
          seg(a + 10, top - 36, b - 10, top - 36, c);
          seg(b - 10, top - 36, b - 10, top, c);
        }
      }
    });
    if (s.jumper === 'battery') {
      const c = s.short ? hot : rgba('orange');
      seg(-70, bot, -70, bot + 44, c);
      seg(-70, bot + 44, 70, bot + 44, c);
      seg(70, bot + 44, 70, bot, c);
    }
  }
}
