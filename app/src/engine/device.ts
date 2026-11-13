/**
 * Device model (DECISIONS §57): what kind of device the app runs on right now — form factor, orientation,
 * primary pointer, safe area, pixel budget. Derived from the viewport and the `pointer` / `hover` media
 * queries only (no user-agent sniffing), kept live by `DeviceMonitor` (`device-monitor.ts`), stored in the
 * engine store (`store.get().device`) and readable as `engine.device` / `ctx.device`.
 *
 * Desktop is the primary target: a fine primary pointer always means `desktop`, whatever the window size, so
 * nothing changes there. Only touch-first devices get the phone / tablet adaptation.
 */

export type FormFactor = 'desktop' | 'tablet' | 'phone';
export type Orientation = 'portrait' | 'landscape';
export type PointerKind = 'fine' | 'coarse';

/** Insets in CSS px from each viewport edge. */
export interface EdgeInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface DeviceState {
  readonly formFactor: FormFactor;
  readonly orientation: Orientation;
  /** Primary pointer: `coarse` = a finger. Touch targets and gestures follow it. */
  readonly pointer: PointerKind;
  /** The primary pointer can hover (mouse, trackpad). Nothing may depend on it on touch devices. */
  readonly hover: boolean;
  /** Notches, rounded corners, home indicator (`env(safe-area-inset-*)`), CSS px. */
  readonly safeArea: EdgeInsets;
  /** CSS px of the bottom of the layout viewport covered by the on-screen keyboard (0 when closed). */
  readonly keyboard: number;
  /** Upper bound of pixels rendered per frame (`Infinity` on desktop: the tier's DPR cap alone decides). */
  readonly pixelBudget: number;
  /** Visible viewport, CSS px. */
  readonly width: number;
  readonly height: number;
  /** The form factor comes from `?ff=` (QA), not from the device. */
  readonly forced: boolean;
}

/** What `classifyDevice` needs to know — gathered from the browser by `DeviceMonitor`. */
export interface DeviceProbe {
  width: number;
  height: number;
  /** `(pointer: coarse)` matches. */
  coarse: boolean;
  /** `(hover: hover)` matches. */
  hover: boolean;
  safeArea: EdgeInsets;
  keyboard: number;
  /** `?ff=phone|tablet|desktop`. */
  force: FormFactor | null;
}

/**
 * Thresholds (CSS px of the viewport's short side, touch-first devices only):
 * below 600 → phone (Android's `sw600dp` boundary; every current phone is ≤ 480, small tablets start at 600);
 * up to 1100 → tablet (12.9″ tablets are 1024); larger touch screens are treated as desktops with a coarse
 * pointer. A split-screen tablet narrower than 600 px gets the phone layout — it has a phone's room.
 */
export const DEVICE_THRESHOLDS = { phoneMaxShort: 600, tabletMaxShort: 1100 } as const;

/**
 * Pixels rendered per frame at most (before dynamic resolution). Phone: 1.0 MP — 390×844 at DPR ≈ 1.74: SDF
 * text stays sharp and the frame costs a third of a DPR-3 buffer (on the Intel proxy the whole frame is
 * fill-bound: 1.32 MP measured 13 ms, see docs/reports/F5-mobile.md). Tablet: 2.0 MP — 820×1180 at DPR ≈ 1.45.
 */
export const PIXEL_BUDGET: Record<FormFactor, number> = { phone: 1.0e6, tablet: 2.0e6, desktop: Infinity };

export const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function isFormFactor(v: unknown): v is FormFactor {
  return v === 'desktop' || v === 'tablet' || v === 'phone';
}

/** Pure classification — unit-tested (`__tests__/device.test.ts`). */
export function classifyDevice(p: DeviceProbe): DeviceState {
  const width = Math.max(p.width, 1);
  const height = Math.max(p.height, 1);
  const short = Math.min(width, height);
  let formFactor: FormFactor = 'desktop';
  if (p.force) formFactor = p.force;
  else if (p.coarse && short < DEVICE_THRESHOLDS.phoneMaxShort) formFactor = 'phone';
  else if (p.coarse && short <= DEVICE_THRESHOLDS.tabletMaxShort) formFactor = 'tablet';
  // a forced form factor brings its pointer along, so layouts and hit sizes are consistent in QA
  const coarse = p.force ? p.force !== 'desktop' : p.coarse;
  return {
    formFactor,
    orientation: height > width ? 'portrait' : 'landscape',
    pointer: coarse ? 'coarse' : 'fine',
    hover: p.force ? p.force === 'desktop' : p.hover && !p.coarse,
    safeArea: p.safeArea,
    keyboard: Math.max(0, p.keyboard),
    pixelBudget: PIXEL_BUDGET[formFactor],
    width,
    height,
    forced: p.force !== null,
  };
}

export function sameDevice(a: DeviceState, b: DeviceState): boolean {
  return (
    a.formFactor === b.formFactor &&
    a.orientation === b.orientation &&
    a.pointer === b.pointer &&
    a.hover === b.hover &&
    a.keyboard === b.keyboard &&
    a.width === b.width &&
    a.height === b.height &&
    a.forced === b.forced &&
    a.safeArea.top === b.safeArea.top &&
    a.safeArea.right === b.safeArea.right &&
    a.safeArea.bottom === b.safeArea.bottom &&
    a.safeArea.left === b.safeArea.left
  );
}

/** The state before the browser has been asked (and in unit tests): a desktop. */
export const DESKTOP_DEVICE: DeviceState = classifyDevice({
  width: 1920,
  height: 1080,
  coarse: false,
  hover: true,
  safeArea: NO_INSETS,
  keyboard: 0,
  force: null,
});

/** Largest device pixel ratio that keeps `cssWidth × cssHeight × dpr²` within the device's pixel budget. */
export function budgetDpr(device: DeviceState, cssWidth: number, cssHeight: number): number {
  if (!Number.isFinite(device.pixelBudget)) return Infinity;
  return Math.sqrt(device.pixelBudget / Math.max(cssWidth * cssHeight, 1));
}
