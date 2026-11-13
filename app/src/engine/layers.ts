/**
 * Render layers of the world scene.
 *
 * Objects on `OVERLAY_LAYER` are drawn after depth of field (and after ambient occlusion), on top of the
 * world, with the world camera: world-anchored labels, callout lines, hotspot markers, affordance outlines.
 * They stay crisp whatever the focus distance is, are never occluded by scene geometry, and take part in
 * chapter transitions like the rest of the world image.
 */
import { Box3, type BufferGeometry, type Object3D } from 'three';

export const WORLD_LAYER = 0;
export const OVERLAY_LAYER = 1;

/**
 * Move an object and its current descendants to the overlay layer (three.js layers are not inherited, so call
 * this after the subtree is built). Returns the object.
 */
export function toOverlay<T extends Object3D>(object: T): T {
  object.traverse((o) => o.layers.set(OVERLAY_LAYER));
  return object;
}

const _box = new Box3();

/**
 * World-space bounds of the *visible world-layer* meshes under `object`. Unlike `Box3.setFromObject` it
 * ignores overlay-layer objects (labels are laid out in px-equivalent units, their raw geometry is huge),
 * invisible helpers (pick proxies) and non-mesh nodes. Returns an empty box if nothing qualifies.
 */
export function worldBounds(object: Object3D, out = new Box3()): Box3 {
  out.makeEmpty();
  object.updateWorldMatrix(true, true);
  const visit = (o: Object3D): void => {
    if (!o.visible) return;
    const geometry = (o as Object3D & { geometry?: BufferGeometry; isMesh?: boolean }).geometry;
    const material = (o as Object3D & { material?: { colorWrite?: boolean } | { colorWrite?: boolean }[] })
      .material;
    const drawn = Array.isArray(material)
      ? material.some((m) => m.colorWrite !== false)
      : material?.colorWrite !== false;
    if (
      geometry &&
      drawn &&
      (o.layers.mask & (1 << WORLD_LAYER)) !== 0 &&
      (o as { isMesh?: boolean }).isMesh
    ) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (geometry.boundingBox && !geometry.boundingBox.isEmpty()) {
        out.union(_box.copy(geometry.boundingBox).applyMatrix4(o.matrixWorld));
      }
    }
    for (const child of o.children) visit(child);
  };
  visit(object);
  return out;
}
