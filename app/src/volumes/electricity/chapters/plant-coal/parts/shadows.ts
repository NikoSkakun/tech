/**
 * Draw-call budget helper: every shadow caster is drawn twice (ENGINE_API §16). Small, thin or distant things
 * (belts, figures, the city on the horizon) do not need to cast; they still receive the shadows of the big shapes.
 */
import type { Mesh, Object3D } from 'three';

export function noShadow(...objects: Object3D[]): void {
  for (const o of objects) o.traverse((m) => void ((m as Mesh).isMesh && (m.castShadow = false)));
}
