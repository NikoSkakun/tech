import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CameraDirector, REFRAME, type Shot } from '../camera/director';

/** A phone held upright with the sheet at half: the free area is 390 × 321 px (aspect 1.21). */
function phone(reframe: boolean): CameraDirector {
  const d = new CameraDirector();
  d.reframe = reframe;
  d.setViewport(390, 844);
  d.setInsets({ left: 0, right: 0, top: 0.12, bottom: 0.5 }, true);
  return d;
}

const base: Shot = { position: [0, 0, 10], target: [0, 0, 0], fov: 32, drift: 0 };

/** Half-height of the projected sphere's bounding box on screen, CSS px. */
function projectedRadius(d: CameraDirector, radius: number): number {
  const top = new Vector3(0, radius, 0).project(d.camera);
  const centre = new Vector3(0, 0, 0).project(d.camera);
  return ((top.y - centre.y) / 2) * 844;
}

describe('camera re-framing (F5)', () => {
  it('is off on desktops: the safe frame is contained exactly as before', () => {
    const d = phone(false);
    d.go({ ...base, fit: { center: [0, 0, 0], radius: 1 } }, { instant: true });
    expect(d.camera.frameZoom).toBe(1);
    const plain = phone(false);
    plain.go(base, { instant: true });
    expect(d.camera.projectionMatrix.elements).toEqual(plain.camera.projectionMatrix.elements);
  });

  it('without fit crops the frame toward the free area, never past the central square', () => {
    const d = phone(true);
    d.go(base, { instant: true });
    // free aspect 390 / 320.7 = 1.216 → zoom 1.5 / 1.216
    expect(d.camera.frameZoom).toBeCloseTo(1.5 / (390 / (844 * 0.38)), 3);
    const peek = phone(true);
    peek.setInsets({ top: 0.12, bottom: 0.2 }, true); // free area taller than wide
    peek.go(base, { instant: true });
    expect(peek.camera.frameZoom).toBeCloseTo(1.5 / REFRAME.autoAspect, 5);
  });

  it('with fit grows until the subject sphere touches the free area (or the frame covers it)', () => {
    const small = phone(true);
    small.setInsets({ top: 0.12, bottom: 0.2 }, true);
    small.go({ ...base, fit: { center: [0, 0, 0], radius: 0.8 } }, { instant: true });
    // a small subject does not pull the camera in beyond "cover": frame height = free height
    expect(small.camera.frameZoom).toBeCloseTo(1.5 / (390 / (844 * 0.68)), 3);
    const d = phone(true);
    d.setInsets({ top: 0.12, bottom: 0.2 }, true); // 390 × 574 free
    d.go({ ...base, fit: { center: [0, 0, 0], radius: 2 } }, { instant: true });
    const r = projectedRadius(d, 2);
    // the sphere spans the free width minus the margin on both sides
    expect(r).toBeGreaterThan((390 / 2) * (1 - REFRAME.margin) * 0.97);
    expect(r).toBeLessThanOrEqual((390 / 2) * (1 - REFRAME.margin) * 1.03);
    expect(d.camera.frameZoom).toBeGreaterThan(1.5);
  });

  it('pulls back, within limits, when the declared subject does not fit the safe frame', () => {
    const d = phone(true);
    d.go({ ...base, fit: { center: [0, 0, 0], radius: 3.5 } }, { instant: true });
    expect(d.camera.frameZoom).toBeLessThan(1);
    expect(d.camera.frameZoom).toBeGreaterThanOrEqual(REFRAME.min);
    const huge = phone(true);
    huge.go({ ...base, fit: { center: [0, 0, 0], radius: 40 } }, { instant: true });
    expect(huge.camera.frameZoom).toBe(REFRAME.min);
  });

  it('eases between framings instead of popping', () => {
    const d = phone(true);
    d.go(base, { instant: true });
    const before = d.camera.frameZoom;
    d.go({ ...base, fit: { center: [0, 0, 0], radius: 3.5 } }, { duration: 1 });
    d.update(1 / 60);
    expect(d.camera.frameZoom).toBeLessThan(before);
    expect(d.camera.frameZoom).toBeGreaterThan(before - 0.1);
    for (let i = 0; i < 240; i++) d.update(1 / 60);
    expect(d.camera.frameZoom).toBeLessThan(1);
  });

  it('a landscape free area that is wider than the frame is left alone', () => {
    const d = new CameraDirector();
    d.reframe = true;
    d.setViewport(844, 390);
    d.setInsets({ left: 0.05, right: 0.47, top: 0.16, bottom: 0.2 }, true);
    d.go(base, { instant: true });
    expect(d.camera.frameZoom).toBe(1);
  });
});
