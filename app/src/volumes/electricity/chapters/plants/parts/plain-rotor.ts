/**
 * Plain-steel rotor for the kit turbogenerator. The script of step 2 says «сталевий ротор з обмотками збудження,
 * полюси не позначаємо»; the kit always paints the pole faces N coral / S blue as exact per-vertex colours, so the
 * built rotor can be re-tinted in place. Stopgap until the kit has a `poles: false` option
 * (`docs/requests/P-plants.md`).
 */
import type { Mesh, Object3D } from 'three';
import { col, SEMANTIC } from '@/style';

/** Re-tint the N / S pole faces under `rotor` (the kit part `rotor`) to the forging's steel; call once after building. */
export function plainRotor(rotor: Object3D): number {
  const marks = [col(SEMANTIC.proton), col('blue')];
  const steel = col('steel.light');
  let n = 0;
  rotor.traverse((o) => {
    const attr = (o as Mesh).geometry?.getAttribute('color');
    if (!attr) return;
    let hit = false;
    for (let i = 0; i < attr.count; i++) {
      const r = attr.getX(i), g = attr.getY(i), b = attr.getZ(i);
      if (!marks.some((m) => Math.abs(r - m.r) + Math.abs(g - m.g) + Math.abs(b - m.b) < 1e-3)) continue;
      attr.setXYZ(i, steel.r, steel.g, steel.b);
      hit = true;
      n++;
    }
    if (hit) attr.needsUpdate = true;
  });
  return n;
}
