/**
 * A short world-anchored label with a constant on-screen size (a nuclide name, «Δm·c²», «4 eV»): `Text3D`
 * billboard on the overlay layer, so depth of field never blurs it. World text is for short labels only
 * (DECISIONS §57 a); sizes are px-equivalents, `chapter-check` fails below 16.
 */
import { toOverlay } from '@/engine/api';
import type { ColorLike } from '@/style';
import { Text3D } from '@/text';

export function createLabel(text: string, color: ColorLike = 'white', size = 19): Text3D {
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
    outline: { width: 0.12, color: 'bg.void' },
  });
  label.renderOrder = 20;
  toOverlay(label);
  return label;
}
