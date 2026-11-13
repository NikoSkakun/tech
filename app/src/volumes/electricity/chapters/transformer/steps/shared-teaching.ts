/**
 * The teaching transformer of steps 1–2 (`tx.share`): one object listed in both steps' `show`. The stage param
 * `coreMorph` (0 = Faraday's ring, 1 = rectangular laminated core) is declared per step, so stepping 1 → 2 plays the
 * scripted «кільце розпрямляється» as an ordinary stage tween and deep links land on the right shape.
 */
import { applyHeat } from '@/fx';
import type { Tx } from '../chapter';
import { createTeaching, type Teaching } from '../parts/teaching';

export interface SharedTeaching extends Teaching {
  /** Turns of both windings (real counts); wire thickness ∝ √(rated current) of each winding. */
  setTurns(n1: number, n2: number, instant?: boolean): void;
  /** Heat glow of the windings 0…1 (DC overheating, overload). */
  heat(primary: number, secondary: number): void;
}

/** Visual wire radius for a rated current (A): thick low-voltage wire, thin high-voltage wire. */
export const wireRadius = (amps: number): number => Math.min(0.05, Math.max(0.008, 0.012 * Math.sqrt(amps)));

export function shareTeaching(tx: Tx): SharedTeaching {
  return tx.share('teaching', () => {
    const t = createTeaching(tx.ctx);
    tx.stageRoot.add(t.group);
    tx.ctx.stage.param('coreMorph', 0, { duration: 1.6, ease: 'power2.inOut', onChange: (v) => t.setMorph(v) });
    let turns = [0, 0];
    const shared: SharedTeaching = Object.assign(t, {
      setTurns(n1: number, n2: number, instant = false) {
        if (!instant && turns[0] === n1 && turns[1] === n2) return;
        turns = [n1, n2];
        // model Т1 is rated 1 A on the primary: the secondary's rated current is N₁/N₂ amperes
        t.primary.set(n1, wireRadius(1), instant);
        t.secondary.set(n2, wireRadius(n1 / n2), instant);
        t.refreshCoilPaths();
      },
      heat(primary: number, secondary: number) {
        // capped below the white-hot end of the ramp: copper should read orange → red, not white
        applyHeat(t.primaryMat, primary, 1.1);
        applyHeat(t.secondaryMat, secondary, 1.1);
      },
    });
    return shared;
  });
}
