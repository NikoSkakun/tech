/**
 * Look of the electrode metals of step 1 (the potentials themselves come from `@electricity/sim/lab-battery`).
 * `rod` — colour of the solid metal; `ion` — colour of its ions in solution (Li⁺ is `lime` course-wide).
 */
import { REACTS_WITH_WATER, STANDARD_POTENTIALS_V, type Electrode } from '@electricity/sim/lab-battery';
import type { ColorLike } from '@/style';

export const METAL_LOOK: Record<Electrode, { rod: ColorLike; ion: ColorLike }> = {
  Li: { rod: 'mist', ion: 'lime' },
  K: { rod: 'mist.light', ion: 'violet.light' },
  Na: { rod: 'white', ion: 'amber' },
  Mg: { rod: 'steel.light', ion: 'mist' },
  Al: { rod: 'mist', ion: 'sky.light' },
  Zn: { rod: 'slate', ion: 'steel' },
  Fe: { rod: 'steel', ion: 'teal.light' },
  Pb: { rod: 'slate.dark', ion: 'steel.light' },
  H: { rod: 'steel.light', ion: 'white' },
  Cu: { rod: 'orange', ion: 'blue' },
  Ag: { rod: 'white', ion: 'mist.light' },
  Au: { rod: 'yellow', ion: 'amber.light' },
};

/** Metals from the most negative E° (bottom rung) to the most positive (top rung). */
export const LADDER: readonly Electrode[] = (Object.keys(STANDARD_POTENTIALS_V) as Electrode[]).sort(
  (a, b) => STANDARD_POTENTIALS_V[a] - STANDARD_POTENTIALS_V[b],
);

export const reactive = (m: Electrode): boolean => REACTS_WITH_WATER.includes(m);
