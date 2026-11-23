/**
 * The volume's visual language (docs/volumes/water/VISUAL.md §1; STYLE_GUIDE §2.2 — the semantic table of `water`).
 *
 *   oxygen             `blue`, a glossy ball — water is blue in the library's core code («cold / water»)
 *   hydrogen           `white`
 *   the «−» side       `cyan` glow behind the oxygen (the library's colour of the electron and of negative charge)
 *   the «+» tips       `coral` glow on the hydrogens (the library's colour of positive charge)
 *   bridge (H-bond)    `mist` → white dots between a hydrogen and the neighbour's oxygen; bigger = stronger
 *   slow … fast        `blue` → `sky` → `yellow` → `orange` («heat» of the core code), only while «by speed» is on
 *   heat from the pad  `orange` strip under the sample; cold: `sky`
 *
 * Chemists paint oxygen red (the CPK convention). Here red would read as «plus» next to the volume `circuit`,
 * while the oxygen side of the molecule is the «minus» one — so oxygen is blue (PATH-NOTES, question 2).
 */
import type { Color } from 'three';
import { col } from '@/style';

/** Radii of the balls in the model's length unit (0.276 nm): 0.55 of the atoms' van der Waals radii. */
export const R_OXYGEN = 0.33;
export const R_HYDROGEN = 0.2;

export const WATER_COLORS = {
  oxygen: col('blue').lerp(col('sky'), 0.12),
  hydrogen: col('white'),
  bridge: col('mist').lerp(col('white'), 0.5),
  minus: col('cyan'),
  plus: col('coral'),
} as const;

const SLOW = col('blue').lerp(col('bg.plum'), 0.25);
const MEAN = col('sky');
const FAST = col('yellow');
const FASTEST = col('orange');

/** Colour of a molecule moving with `ratio` of the mean kinetic energy (1 = mean) — written into `out`. */
export function speedColor(ratio: number, out: Color): Color {
  if (ratio < 1) return out.copy(SLOW).lerp(MEAN, Math.max(0, ratio));
  if (ratio < 2.2) return out.copy(MEAN).lerp(FAST, (ratio - 1) / 1.2);
  return out.copy(FAST).lerp(FASTEST, Math.min(1, (ratio - 2.2) / 1.5));
}
