/**
 * Icons for the DOM interface from the very same signed-distance definitions as the WebGL icon atlas
 * (`@/ui3d/core/icons`): each icon is rasterised once into an alpha mask (PNG data URL) and used as a CSS
 * `mask-image` over `currentColor` — one icon set, two renderers, no image files.
 */
import { ICON_GRID, iconDistance, type IconName } from '@/ui3d/core/icons';

/** Raster size of a mask: crisp up to 48 CSS px at DPR 2 (4K HUD icons are ≤ 48 px). */
const SIZE = 96;
const cache = new Map<IconName, string>();

function maskUrl(name: IconName): string {
  const hit = cache.get(name);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(SIZE, SIZE);
  const unit = ICON_GRID.design / SIZE; // design units per mask pixel
  for (let py = 0; py < SIZE; py++)
    for (let px = 0; px < SIZE; px++) {
      const d = iconDistance(name, (px + 0.5) * unit, (py + 0.5) * unit);
      const a = Math.min(Math.max(0.5 - d / unit, 0), 1); // one-pixel analytic edge
      const o = (py * SIZE + px) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
  const url = `url(${canvas.toDataURL('image/png')})`;
  cache.set(name, url);
  return url;
}

/** `<i class="ic">` showing `name` in the current text colour; size via CSS (`--ic`, units). */
export function icon(name: IconName, cls = ''): HTMLElement {
  const el = document.createElement('i');
  el.className = cls ? `ic ${cls}` : 'ic';
  el.setAttribute('aria-hidden', 'true');
  setIcon(el, name);
  return el;
}

export function setIcon(el: HTMLElement, name: IconName): void {
  if (el.dataset.icon === name) return;
  el.dataset.icon = name;
  const url = maskUrl(name);
  el.style.maskImage = url;
  el.style.webkitMaskImage = url;
}
