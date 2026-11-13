/**
 * A short world-anchored label with a constant on-screen size (a size name, a caption over a scope):
 * `Text3D` billboard on the overlay layer, so depth of field never blurs it (ENGINE_API §10). World text is
 * for *short labels* only (DECISIONS §57 a): names of things go to the step UI's callouts, anything to read
 * goes to the HUD board. Sizes are px-equivalents; `chapter-check` fails below 16.
 */
import { toOverlay } from '@/engine/api';
import type { ColorLike } from '@/style';
import { Text3D } from '@/text';

export function createLabel(text: string, color: ColorLike = 'white', size = 18): Text3D {
  const label = new Text3D(text, {
    font: 'display',
    size,
    color,
    anchorX: 'center',
    anchorY: 'bottom',
    billboard: true,
    screenSpace: true,
    depthTest: false,
    depthWrite: false,
  });
  label.renderOrder = 20;
  toOverlay(label);
  return label;
}
