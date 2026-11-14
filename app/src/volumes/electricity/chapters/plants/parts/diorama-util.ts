/** Small helpers shared by the diorama recipes (`plant-dioramas*.ts`). */
import { GROUND, addPowerTransformer } from '@/kit';
import type { DioramaKit } from './plant-islands';

export type P = [number, number, number];

/** A point on the ground of the island. */
export const at = (k: DioramaKit, x: number, z: number): P => [x, k.y(x, z), z];

/** The substation corner every island shares: a step-up transformer whose HV side is the island's line port. */
export function yard(k: DioramaKit, x: number, z: number, ry = 0): P {
  k.b.frame({ at: at(k, x, z), rot: [0, ry, 0] }, () => addPowerTransformer(k.b, { hv: 330, lv: 20, fans: false }), 'tr.');
  const p = k.b.locate('tr.hv2');
  return [p.x, p.y + 2, p.z];
}

/** Flattened yard (gravel / concrete / dirt) for the island features. */
export function pad(x: number, z: number, w: number, d: number, y = 2, color = GROUND.gravel()) {
  return { type: 'pad' as const, x, z, w, d, corner: 4, y, blend: 6, color };
}
