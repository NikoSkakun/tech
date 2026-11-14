/**
 * Light-grey porcelain for kit models. The script wants light-grey bushings («світло-сірі пагоди»); the kit draws
 * porcelain brown and writes it as exact per-vertex colours (`insulatorColor('porcelain')`), so a built model can be
 * re-tinted in place. Stopgap until the kit has a grey porcelain kind (`docs/requests/P-transformer.md`). Kept out
 * of `world.ts` so the Journey Map emblem (which imports `world.ts`) does not pull the kit in.
 */
import type { Mesh, Object3D } from 'three';
import { insulatorColor } from '@/kit';
import { col } from '@/style';

/** Light-grey bushing porcelain (the same tint as the step 4 transformer's own bushings). */
export const PORCELAIN = col('mist').lerp(col('white'), 0.35);

/** Re-tint brown porcelain to `PORCELAIN` in every mesh under `root`; call once, after building, on chapter-owned models. */
export function greyPorcelain(root: Object3D): void {
  const brown = insulatorColor('porcelain');
  root.traverse((o) => {
    const attr = (o as Mesh).geometry?.getAttribute('color');
    if (!attr) return;
    let hit = false;
    for (let i = 0; i < attr.count; i++) {
      const d = Math.abs(attr.getX(i) - brown.r) + Math.abs(attr.getY(i) - brown.g) + Math.abs(attr.getZ(i) - brown.b);
      if (d > 1e-3) continue;
      attr.setXYZ(i, PORCELAIN.r, PORCELAIN.g, PORCELAIN.b);
      hit = true;
    }
    if (hit) attr.needsUpdate = true;
  });
}
