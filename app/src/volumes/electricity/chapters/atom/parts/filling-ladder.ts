/**
 * Filling ladder — the subshells 1s … 4p as rungs in order of energy (Madelung: 1s 2s 2p 3s 3p 4s 3d 4p) with
 * one slot per electron. `filled` electrons of a filling sequence (sim `fillingSequence`) sit in their slots;
 * the step drops them in one by one. Shows that 4s fills before 3d (and copper's 3d¹⁰ 4s¹ exception).
 */
import type { ChapterContext } from '@/engine/api';
import type { Subshell } from '@electricity/sim/atom';
import { Label, UiNode, lit, rgba, type Painter } from '@/ui3d';
import { createConsole, type PinnedConsole } from './console';

const RUNGS: readonly [number, number][] = [
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [4, 0],
  [3, 2],
  [4, 1],
];
const LETTER = ['s', 'p', 'd', 'f'];
/** Compact on purpose: world text is large on screen (console.ts), so the ladder is drawn on few px-eq. */
const W = 244;
const ROW = 23;
const H = RUNGS.length * ROW + 8;

class LadderNode extends UiNode {
  sequence: Subshell[] = [];
  filled = 0;
  constructor() {
    super({ name: 'filling-ladder', width: W, height: H, dir: 'stack' });
    RUNGS.forEach(([n, l], i) =>
      this.add(
        new Label(
          `${n}${LETTER[l]}`,
          { font: 'mono', size: 17, color: l === 2 ? 'violet.light' : 'mist', nowrap: true },
          {
            float: { ax: 0, ay: 1, px: 0, py: 0.5, dx: 2, dy: -(4 + ROW * (i + 0.5)) },
          },
        ),
      ),
    );
  }
  override paint(p: Painter): void {
    const occupied = new Map<string, number>();
    for (let i = 0; i < Math.min(Math.floor(this.filled), this.sequence.length); i++) {
      const s = this.sequence[i]!;
      occupied.set(`${s.n}:${s.l}`, s.electrons);
    }
    RUNGS.forEach(([n, l], i) => {
      const y = -this.bh / 2 + 4 + ROW * (i + 0.5);
      const capacity = 2 * (2 * l + 1);
      const have = occupied.get(`${n}:${l}`) ?? 0;
      for (let k = 0; k < capacity; k++) {
        const x = -this.bw / 2 + 50 + k * 20.5;
        const on = k < have;
        p.circle(
          x,
          y,
          on ? 15 : 12,
          on
            ? { fill: lit(rgba('cyan'), 1.5), border: rgba('white', 0.8), bw: 1.2, glow: 8, glowAlpha: 0.5 }
            : { fill: rgba('bg.void', 0.6), border: rgba(l === 2 ? 'violet' : 'steel', 0.7), bw: 1.2 },
        );
      }
    });
  }
}

export interface FillingLadder {
  console: PinnedConsole;
  /** Restart the animation for a filling sequence. */
  play(sequence: Subshell[]): void;
  /** Advance; returns the subshell that has just started filling (for sounds / captions), if any. */
  update(dt: number): Subshell | null;
}

export function createFillingLadder(
  ctx: ChapterContext,
  opts: { top: readonly [number, number, number]; unit: number },
): FillingLadder {
  const node = new LadderNode();
  const console3d = createConsole(ctx, {
    name: 'filling-ladder',
    width: W + 44,
    unit: opts.unit,
    top: opts.top,
    billboard: false,
    children: [node],
  });
  let pause = 0;
  return {
    console: console3d,
    play(sequence) {
      node.sequence = sequence;
      node.filled = 0;
      pause = 0.4;
      node.repaint();
    },
    update(dt) {
      console3d.pin();
      if (node.filled >= node.sequence.length) return null;
      if (pause > 0) {
        pause -= dt;
        return null;
      }
      const before = Math.floor(node.filled);
      node.filled = Math.min(node.filled + dt / 0.04, node.sequence.length); // ≈ 40 ms per electron
      const now = Math.floor(node.filled);
      if (now === before) return null;
      node.repaint();
      const next = node.sequence[now];
      // a beat before every new subshell, a longer one where 3d follows 4s (the non-obvious order)
      if (next && next.electrons === 1) pause = next.n === 3 && next.l === 2 ? 1.1 : 0.22;
      return next && next.electrons === 1 ? next : null;
    },
  };
}
