/**
 * HUD layer — the camera-space scene the UI kit (F2) builds on (STYLE_GUIDE §6).
 *
 * It is a separate `Scene` with its own perspective camera, rendered after depth of field: HUD objects
 * receive bloom, colour grade and grain, but are never blurred.
 *
 * Coordinates: the plane z = 0 of `root` is the "screen plane". On it, 1 unit = 1 px-equivalent at the 1080p
 * reference (see `metrics.pxPerUnit`), origin at the screen centre, +x right, +y up. Objects with z > 0 float
 * toward the viewer (they appear larger and shift with perspective — depth layering); small rotations give
 * the slight perspective tilt the style guide asks for.
 */
import {
  Color,
  Group,
  HemisphereLight,
  DirectionalLight,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import {
  DESKTOP_DEVICE,
  type DeviceState,
  type EdgeInsets,
  type FormFactor,
  type Orientation,
  type PointerKind,
} from './device';
import { Emitter, type Unsubscribe } from './events';
import type { Insets } from './camera/director';
import type { StyleRig } from './pipeline/pipeline';

export type HudLayout = 'wide' | 'narrow' | 'portrait';

/**
 * Which interface shell the HUD builds (F5, `docs/MOBILE.md`): `desk` — the desktop layouts (`layout` picks
 * wide / narrow / portrait, exactly as before); `sheet` — touch portrait: a bottom sheet with snap heights;
 * `side` — touch landscape: a collapsible side sheet. Desktops always get `desk`.
 */
export type HudShell = 'desk' | 'sheet' | 'side';

export interface HudMetrics {
  /** Size of the screen plane in HUD units. */
  readonly width: number;
  readonly height: number;
  /** CSS pixels per HUD unit (≈ viewport height / 1080, clamped, × the user's text-size setting). */
  readonly pxPerUnit: number;
  /** Viewport size in CSS px. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** `wide` (≥ 16:10): side panel right; `narrow`: panel docks to the bottom; `portrait`: stacked. */
  readonly layout: HudLayout;
  /** Safe margin (3 % of the short side) in HUD units. */
  readonly safeMargin: number;
  /** Device form factor, orientation and primary pointer (F5; `desktop` / `fine` on desktops). */
  readonly formFactor: FormFactor;
  readonly orientation: Orientation;
  readonly pointer: PointerKind;
  /** Interface shell for this device and orientation. */
  readonly shell: HudShell;
  /**
   * Device safe area (notch, rounded corners, home indicator; the on-screen keyboard is added to `bottom`) in
   * HUD units from each edge. All zero on desktops. Regions add `safeMargin` on top of it.
   */
  readonly safeArea: EdgeInsets;
}

/** Smallest `pxPerUnit` on touch devices: 1 HUD unit = 1 CSS px, so the 15-unit caption is ≥ 14 CSS px and a
 * 44-unit target is 44 CSS px (STYLE_GUIDE §6 minimums become real pixels). Desktops keep 0.7. */
export const TOUCH_MIN_PX_PER_UNIT = 1;
const DESK_MIN_PX_PER_UNIT = 0.7;

export function shellOf(device: Pick<DeviceState, 'formFactor' | 'orientation'>): HudShell {
  if (device.formFactor === 'desktop') return 'desk';
  return device.orientation === 'portrait' ? 'sheet' : 'side';
}

/** Vertical field of view of the HUD camera: narrow, so depth layering is subtle rather than fish-eyed. */
const HUD_FOV = 24;

export class HudLayer {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(HUD_FOV, 1, 10, 20000);
  /** Add HUD objects here (units and origin as described in the file header). */
  readonly root = new Group();
  /** Rim-light values used for K materials rendered in the HUD scene. */
  readonly rig: StyleRig = {
    rimColor: new Color(0.2, 0.25, 0.5),
    rimDir: new Vector3(-0.4, 0.5, 0.75).normalize(),
  };
  private current: HudMetrics = {
    width: 1920,
    height: 1080,
    pxPerUnit: 1,
    cssWidth: 1920,
    cssHeight: 1080,
    layout: 'wide',
    safeMargin: 32,
    formFactor: 'desktop',
    orientation: 'landscape',
    pointer: 'fine',
    shell: 'desk',
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  private device: DeviceState = DESKTOP_DEVICE;
  private readonly events = new Emitter<{ resize: HudMetrics; insets: Insets }>();
  private readonly insetsUnits = { left: 0, right: 0, top: 0, bottom: 0 };
  private textScale = 1;

  constructor() {
    this.scene.name = 'hud';
    this.root.name = 'hud-root';
    this.scene.add(this.root);
    // simple neutral rig so lit K materials (toon buttons, knobs) work in the HUD
    const key = new DirectionalLight(0xffffff, 1);
    key.position.set(-0.35, 0.6, 1);
    const fill = new HemisphereLight(new Color(0.5, 0.48, 0.85), new Color(0.3, 0.24, 0.6), 1);
    this.scene.add(key, fill);
  }

  get metrics(): HudMetrics {
    return this.current;
  }

  /** Subscribe to metric changes (window resize, text-size setting). */
  onResize(fn: (m: HudMetrics) => void): Unsubscribe {
    return this.events.on('resize', fn);
  }

  /**
   * The HUD reports the screen area its panels occupy, in HUD units measured from each viewport edge.
   * The camera director keeps the world subject inside the remaining free area.
   */
  setInsets(insets: Partial<{ left: number; right: number; top: number; bottom: number }>): void {
    Object.assign(this.insetsUnits, insets);
    this.events.emit('insets', this.insetFractions());
  }

  /** @internal The engine forwards insets to the camera director. */
  onInsets(fn: (insets: Insets) => void): Unsubscribe {
    return this.events.on('insets', fn);
  }

  /** Current insets as viewport fractions. */
  insetFractions(): Insets {
    const m = this.current;
    return {
      left: MathUtils.clamp(this.insetsUnits.left / m.width, 0, 0.8),
      right: MathUtils.clamp(this.insetsUnits.right / m.width, 0, 0.8),
      top: MathUtils.clamp(this.insetsUnits.top / m.height, 0, 0.8),
      bottom: MathUtils.clamp(this.insetsUnits.bottom / m.height, 0, 0.8),
    };
  }

  /** @internal */
  setTextScale(scale: number): void {
    if (scale === this.textScale) return;
    this.textScale = scale;
    this.setViewport(this.current.cssWidth, this.current.cssHeight);
  }

  /** @internal The device model changed (form factor, rotation, safe area, keyboard). */
  setDevice(device: DeviceState): void {
    this.device = device;
    this.setViewport(this.current.cssWidth, this.current.cssHeight);
  }

  /** @internal Viewport changed (CSS px). */
  setViewport(cssWidth: number, cssHeight: number): void {
    const w = Math.max(cssWidth, 1);
    const h = Math.max(cssHeight, 1);
    const d = this.device;
    const touch = d.formFactor !== 'desktop';
    // px-equivalent scale: proportional to the viewport, but never so small that 14-unit captions become
    // unreadable; on phones and tablets a unit is at least one CSS px (TOUCH_MIN_PX_PER_UNIT)
    const base = Math.min(h, (w * 9) / 16) / 1080;
    const floor = touch ? TOUCH_MIN_PX_PER_UNIT : DESK_MIN_PX_PER_UNIT;
    const pxPerUnit = MathUtils.clamp(base, floor, 3) * this.textScale;
    const width = w / pxPerUnit;
    const height = h / pxPerUnit;
    const aspect = w / h;
    this.current = {
      width,
      height,
      pxPerUnit,
      cssWidth: w,
      cssHeight: h,
      layout: aspect >= 1.6 ? 'wide' : aspect >= 1 ? 'narrow' : 'portrait',
      safeMargin: Math.min(width, height) * 0.03,
      formFactor: d.formFactor,
      orientation: d.orientation,
      pointer: d.pointer,
      shell: shellOf(d),
      safeArea: {
        top: d.safeArea.top / pxPerUnit,
        right: d.safeArea.right / pxPerUnit,
        bottom: (d.safeArea.bottom + d.keyboard) / pxPerUnit,
        left: d.safeArea.left / pxPerUnit,
      },
    };
    // place the camera so that the z = 0 plane spans exactly width × height units
    const distance = height / 2 / Math.tan(MathUtils.degToRad(HUD_FOV) / 2);
    this.camera.aspect = aspect;
    this.camera.near = distance * 0.1;
    this.camera.far = distance * 4;
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.events.emit('resize', this.current);
    this.events.emit('insets', this.insetFractions());
  }
}
