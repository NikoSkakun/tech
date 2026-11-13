/**
 * Keeps the device model (`device.ts`) live: viewport size, rotation, split-screen, the on-screen keyboard
 * (`visualViewport`), pointer / hover media queries and the safe-area insets. Everything here is plain DOM
 * plumbing that works without a secure context.
 */
import {
  NO_INSETS,
  classifyDevice,
  sameDevice,
  type DeviceState,
  type EdgeInsets,
  type FormFactor,
} from './device';

export interface DeviceOverrides {
  /** `?ff=` — force the form factor (QA, demos on a desktop browser). */
  formFactor: FormFactor | null;
  /** `?safe=top,right,bottom,left` — emulate safe-area insets in CSS px (device emulation has none). */
  safeArea: EdgeInsets | null;
}

/** Keyboards are taller than this; smaller differences are browser bars settling. */
const KEYBOARD_MIN_PX = 120;

export class DeviceMonitor {
  private current: DeviceState;
  private readonly probe: HTMLElement | null;
  private readonly coarse: MediaQueryList | null;
  private readonly hover: MediaQueryList | null;
  private readonly offs: (() => void)[] = [];

  constructor(
    private readonly win: Window,
    private readonly overrides: DeviceOverrides,
    private readonly onChange: (device: DeviceState) => void,
  ) {
    const mq = typeof win.matchMedia === 'function';
    this.coarse = mq ? win.matchMedia('(pointer: coarse)') : null;
    this.hover = mq ? win.matchMedia('(hover: hover)') : null;
    this.probe = overrides.safeArea ? null : this.createSafeAreaProbe();
    this.current = this.read();
    const refresh = (): void => void this.refresh();
    const listen = (target: EventTarget | null | undefined, type: string): void => {
      if (!target) return;
      target.addEventListener(type, refresh);
      this.offs.push(() => target.removeEventListener(type, refresh));
    };
    listen(win, 'resize');
    listen(win, 'orientationchange');
    listen(win.visualViewport, 'resize');
    listen(win.visualViewport, 'scroll');
    listen(this.coarse, 'change');
    listen(this.hover, 'change');
  }

  get state(): DeviceState {
    return this.current;
  }

  /** Re-read the browser state; notifies when something changed. Returns the current state. */
  refresh(): DeviceState {
    const next = this.read();
    if (!sameDevice(next, this.current)) {
      this.current = next;
      this.onChange(next);
    }
    return this.current;
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    this.probe?.remove();
  }

  private read(): DeviceState {
    const win = this.win;
    const width = win.innerWidth || win.document.documentElement.clientWidth || 1;
    const height = win.innerHeight || win.document.documentElement.clientHeight || 1;
    // on-screen keyboard: the part of the layout viewport the visual viewport no longer shows (iOS keeps the
    // layout viewport and shrinks the visual one; Android resizes both, then this is 0 and `height` shrank)
    const vv = win.visualViewport;
    let keyboard = 0;
    if (vv && Math.abs(vv.scale - 1) < 0.01) {
      const covered = height - vv.height - vv.offsetTop;
      if (covered > KEYBOARD_MIN_PX) keyboard = Math.round(covered);
    }
    return classifyDevice({
      width,
      height,
      coarse: this.coarse?.matches ?? false,
      hover: this.hover?.matches ?? true,
      safeArea: this.overrides.safeArea ?? this.readSafeArea(),
      keyboard,
      force: this.overrides.formFactor,
    });
  }

  /** An invisible element whose paddings are the `env(safe-area-inset-*)` values (0 where unsupported). */
  private createSafeAreaProbe(): HTMLElement | null {
    const doc = this.win.document;
    if (!doc.body) return null;
    const el = doc.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
      'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    doc.body.appendChild(el);
    return el;
  }

  private readSafeArea(): EdgeInsets {
    if (!this.probe) return NO_INSETS;
    const cs = this.win.getComputedStyle(this.probe);
    const px = (v: string): number => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    };
    return {
      top: px(cs.paddingTop),
      right: px(cs.paddingRight),
      bottom: px(cs.paddingBottom),
      left: px(cs.paddingLeft),
    };
  }
}

/** Parse `?safe=top,right,bottom,left` (CSS px; missing values are 0). */
export function parseSafeArea(value: string | null): EdgeInsets | null {
  if (value === null || value.trim() === '') return null;
  const n = value.split(',').map((s) => Math.max(0, Number(s) || 0));
  return { top: n[0] ?? 0, right: n[1] ?? 0, bottom: n[2] ?? 0, left: n[3] ?? 0 };
}
