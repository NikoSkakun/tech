/**
 * The lab's close-up cells are the kit's detailed cells (`cylinderCellDetailed`, `prismaticCellDetailed`) at
 * the giant scale of this chapter: a 21700 is 0.72 units across and 2.4 tall (≈ ×34), a 100 Ah LFP brick
 * 0.95 × 1.26 × 0.4 (×6). Poles follow the DC code (+ `coral`, − `blue`).
 */
import { CYLINDER_CELL_FORMATS, cylinderCellDetailed, prismaticCellDetailed, type KitModel } from '@/kit';
import type { ColorLike } from '@/style';

export type CylinderFormat = keyof typeof CYLINDER_CELL_FORMATS;

/** Enlargement of the hero cylinder: its radius becomes 0.36 units. */
export const HERO_SCALE = 0.36 / CYLINDER_CELL_FORMATS['21700'][0];
/** Size of the 21700 hero in lab units (the header parts sit on `headerY`). */
export const HERO = { radius: 0.36, height: 2.4, headerY: 2.18 } as const;

const ratio = (f: CylinderFormat): readonly [number, number] => [
  CYLINDER_CELL_FORMATS[f][0] / CYLINDER_CELL_FORMATS['21700'][0],
  CYLINDER_CELL_FORMATS[f][1] / CYLINDER_CELL_FORMATS['21700'][1],
];
/** Real proportions of the cylindrical formats relative to the 21700 hero: [radial, axial]. */
export const CYLINDER_FORMATS: Record<CylinderFormat, readonly [number, number]> = {
  '18650': ratio('18650'),
  '21700': ratio('21700'),
  '4680': ratio('4680'),
};

/**
 * Giant cylindrical cell with a window onto the jelly roll and a header that comes apart.
 * Parts: `gasket`, `cid`, `ptc`, `vent`, `cap` (explode along +Y). Anchors: `top`, `plus`, `minus`, `window`.
 * `size` scales the whole model (1 = hero size).
 */
export function heroCell(wrap: ColorLike = 'teal', format: CylinderFormat = '21700', size = 1): KitModel {
  return cylinderCellDetailed({ format, wrap, scale: HERO_SCALE * size });
}

/** Giant 100 Ah LFP brick with busbar studs, nuts and vent; `cut` opens the front onto the electrode stack. */
export function lfpBrick(cut = false): KitModel {
  return prismaticCellDetailed({ scale: 6, cut });
}
