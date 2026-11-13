// Regression (B-plant-wind #9): a Text3D whose text outgrows its glyph buffer *during a draw* must not
// dispose the geometry being drawn; the next frame must draw a geometry large enough for the new text.
import { readFileSync } from 'node:fs';
import { type BufferGeometry, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { setFontData, type FontJson } from '../fonts';
import { Text3D } from '../text3d';

beforeAll(() => {
  const json = JSON.parse(
    readFileSync(new URL('../../../public/fonts/fonts.json', import.meta.url), 'utf8'),
  ) as FontJson;
  setFontData(json);
});

const renderer = {} as WebGLRenderer;
const scene = new Scene();
const camera = new PerspectiveCamera();

/** What WebGLRenderer does per draw: capture the geometry, call onBeforeRender, then draw that geometry. */
function draw(t: Text3D): { drawn: BufferGeometry; disposedMidDraw: boolean } {
  const drawn = t.geometry;
  let disposedMidDraw = false;
  const onDispose = () => (disposedMidDraw = true);
  drawn.addEventListener('dispose', onDispose);
  t.onBeforeRender(renderer, scene, camera, drawn);
  drawn.removeEventListener('dispose', onDispose);
  return { drawn, disposedMidDraw };
}

const quads = (g: BufferGeometry) => (g.getAttribute('position')?.count ?? 0) / 4;

describe('Text3D buffer growth', () => {
  it('grows without disposing the geometry that is being drawn', () => {
    const t = new Text3D('', { billboard: true });
    draw(t);
    const long = 'Швидкість вітру 12,5 m/s — потужність 3,4 MW'.repeat(3);
    t.text = long;
    const first = draw(t);
    expect(first.disposedMidDraw).toBe(false);
    // the next frame draws the new geometry, which holds every glyph of the new text
    const next = t.geometry;
    expect(next).not.toBe(first.drawn);
    expect(next.drawRange.count / 6).toBeGreaterThanOrEqual(100); // ≈ 120 visible glyphs
    expect(next.drawRange.count / 6).toBeLessThanOrEqual(quads(next));
    // the retired geometry is released on the following draw, not leaked
    let released = false;
    first.drawn.addEventListener('dispose', () => (released = true));
    const second = draw(t);
    expect(second.disposedMidDraw).toBe(false);
    expect(released).toBe(true);
  });

  it('keeps one geometry while the text fits', () => {
    const t = new Text3D('0123456789abcdefghij');
    const g = t.geometry;
    t.text = 'short';
    draw(t);
    expect(t.geometry).toBe(g);
  });

  it('has a colour setter that re-colours lazily', () => {
    const t = new Text3D('V', { color: 'white' });
    void t.metrics;
    const before = Array.from(t.geometry.getAttribute('aColor').array.slice(0, 3));
    t.color = 'red';
    expect(t.color).toBe('red');
    draw(t);
    const after = Array.from(t.geometry.getAttribute('aColor').array.slice(0, 3));
    expect(after).not.toEqual(before);
    expect(t.setColor('white')).toBe(t);
  });
});
