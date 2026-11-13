/**
 * A small world-anchored text badge with a constant on-screen size (efficiency of a unit, power of a farm
 * turbine, a size label): `Text3D` billboard on the overlay layer, so depth of field never blurs it
 * (ENGINE_API §10). For the static names of things use the step UI's callouts instead.
 */
import { toOverlay } from '@/engine/api';
import type { ColorLike } from '@/style';
import { Text3D } from '@/text';

/**
 * `reserve` = the longest text (in characters) the badge will ever show. Workaround for an engine issue: a
 * `Text3D` whose text outgrows its glyph buffer *after* its first render disappears for good, so the buffer
 * is sized once, up front (see docs/requests/B-plant-wind.md).
 */
export function createBadge(text: string, color: ColorLike = 'white', size = 19, reserve = 0): Text3D {
  const badge = new Text3D(reserve > text.length ? 'M'.repeat(reserve) : text, {
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
  badge.renderOrder = 20;
  if (reserve > text.length) {
    badge.sync();
    badge.text = text;
  }
  toOverlay(badge);
  return badge;
}
