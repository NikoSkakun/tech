import { describe, expect, it } from 'vitest';
import {
  DESKTOP_DEVICE,
  NO_INSETS,
  PIXEL_BUDGET,
  budgetDpr,
  classifyDevice,
  sameDevice,
  type DeviceProbe,
} from '../device';
import { parseSafeArea } from '../device-monitor';
import { parseFlags } from '../app';
import { HudLayer, shellOf } from '../hud';
import { QUALITY_PROFILES, isQualityTier } from '../quality';

const probe = (over: Partial<DeviceProbe>): DeviceProbe => ({
  width: 1920,
  height: 1080,
  coarse: false,
  hover: true,
  safeArea: NO_INSETS,
  keyboard: 0,
  force: null,
  ...over,
});

describe('device model', () => {
  it('a fine pointer is a desktop at any window size', () => {
    for (const [width, height] of [[1920, 1080], [390, 844], [800, 1200], [3840, 2160]] as const) {
      const d = classifyDevice(probe({ width, height }));
      expect(d.formFactor).toBe('desktop');
      expect(d.pointer).toBe('fine');
      expect(d.pixelBudget).toBe(Infinity);
    }
  });

  it('classifies touch devices by the short side of the viewport', () => {
    const touch = (width: number, height: number) =>
      classifyDevice(probe({ width, height, coarse: true, hover: false }));
    expect(touch(390, 844).formFactor).toBe('phone');
    expect(touch(360, 800).formFactor).toBe('phone');
    expect(touch(844, 390).formFactor).toBe('phone');
    expect(touch(844, 390).orientation).toBe('landscape');
    expect(touch(820, 1180).formFactor).toBe('tablet');
    expect(touch(1180, 820).formFactor).toBe('tablet');
    expect(touch(600, 960).formFactor).toBe('tablet');
    expect(touch(1024, 1366).formFactor).toBe('tablet');
    // split-screen tablet: a phone's room → the phone layout
    expect(touch(400, 1180).formFactor).toBe('phone');
    // a large touch screen is a desktop with a coarse pointer
    const wall = touch(1920, 1200);
    expect(wall.formFactor).toBe('desktop');
    expect(wall.pointer).toBe('coarse');
    expect(touch(390, 844).hover).toBe(false);
  });

  it('?ff= forces the form factor and its pointer', () => {
    const d = classifyDevice(probe({ width: 390, height: 844, force: 'phone' }));
    expect(d).toMatchObject({ formFactor: 'phone', pointer: 'coarse', hover: false, forced: true });
    const desk = classifyDevice(probe({ width: 390, height: 844, coarse: true, hover: false, force: 'desktop' }));
    expect(desk).toMatchObject({ formFactor: 'desktop', pointer: 'fine', hover: true });
    expect(parseFlags('?ff=tablet&safe=47,0,34').formFactor).toBe('tablet');
    expect(parseFlags('?ff=tablet&safe=47,0,34').safeArea).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });
    expect(parseFlags('?ff=watch').formFactor).toBeNull();
    expect(parseSafeArea(null)).toBeNull();
  });

  it('pixel budget caps the DPR of phones and tablets only', () => {
    const phone = classifyDevice(probe({ width: 390, height: 844, coarse: true }));
    expect(phone.pixelBudget).toBe(PIXEL_BUDGET.phone);
    expect(budgetDpr(phone, 390, 844)).toBeGreaterThan(1.7);
    expect(budgetDpr(phone, 390, 844)).toBeLessThan(1.8);
    expect(budgetDpr(DESKTOP_DEVICE, 3840, 2160)).toBe(Infinity);
  });

  it('sameDevice compares every field that matters', () => {
    const a = classifyDevice(probe({ width: 390, height: 844, coarse: true }));
    expect(sameDevice(a, classifyDevice(probe({ width: 390, height: 844, coarse: true })))).toBe(true);
    expect(sameDevice(a, classifyDevice(probe({ width: 844, height: 390, coarse: true })))).toBe(false);
    expect(sameDevice(a, classifyDevice(probe({ width: 390, height: 844, coarse: true, keyboard: 300 })))).toBe(false);
  });
});

describe('HUD metrics follow the device', () => {
  it('desktop metrics are what they always were', () => {
    const hud = new HudLayer();
    hud.setViewport(1280, 720);
    expect(hud.metrics.pxPerUnit).toBeCloseTo(0.7, 5);
    expect(hud.metrics).toMatchObject({ layout: 'wide', shell: 'desk', formFactor: 'desktop', pointer: 'fine' });
    hud.setViewport(800, 1200);
    expect(hud.metrics.pxPerUnit).toBeCloseTo(0.7, 5);
    expect(hud.metrics).toMatchObject({ layout: 'portrait', shell: 'desk' });
    expect(hud.metrics.safeArea).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('on phones and tablets one unit is one CSS px and the shell follows the orientation', () => {
    const hud = new HudLayer();
    const safeArea = { top: 47, right: 0, bottom: 34, left: 0 };
    hud.setDevice(classifyDevice(probe({ width: 390, height: 844, coarse: true, safeArea })));
    hud.setViewport(390, 844);
    expect(hud.metrics).toMatchObject({ pxPerUnit: 1, width: 390, height: 844, shell: 'sheet', formFactor: 'phone' });
    expect(hud.metrics.safeArea).toEqual(safeArea);
    hud.setDevice(classifyDevice(probe({ width: 844, height: 390, coarse: true, keyboard: 200 })));
    hud.setViewport(844, 390);
    expect(hud.metrics).toMatchObject({ pxPerUnit: 1, shell: 'side' });
    expect(hud.metrics.safeArea.bottom).toBe(200);
    expect(shellOf({ formFactor: 'tablet', orientation: 'portrait' })).toBe('sheet');
    expect(shellOf({ formFactor: 'desktop', orientation: 'portrait' })).toBe('desk');
  });
});

describe('mobile quality tier', () => {
  it('exists next to the unchanged desktop tiers', () => {
    expect(isQualityTier('mobile')).toBe(true);
    const m = QUALITY_PROFILES.mobile;
    expect(m).toMatchObject({ msaa: 0, aoSamples: 0, dofTaps: 0, fxaa: true, lowDetail: true, bloomScale: 0.25 });
    // the direct world pass is valid only without AO, DOF and MSAA — and never on a desktop tier
    expect(m.directWorld).toBe(true);
    for (const tier of ['low', 'medium', 'high', 'ultra'] as const)
      expect(QUALITY_PROFILES[tier].directWorld).toBe(false);
    expect(m.shadowMapSize).toBeLessThan(QUALITY_PROFILES.high.shadowMapSize);
    for (const tier of ['low', 'medium', 'high', 'ultra'] as const)
      expect(QUALITY_PROFILES[tier]).toMatchObject({ bloomScale: 0.5, lowDetail: false });
    expect(QUALITY_PROFILES.high).toMatchObject({ maxDpr: 1.5, msaa: 4, aoSamples: 10, dofTaps: 28, bloomLevels: 6 });
  });
});
