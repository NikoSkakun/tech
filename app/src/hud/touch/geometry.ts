/**
 * Geometry of the touch shells (F5, `docs/MOBILE.md`), in HUD units — on phones and tablets one unit is one
 * CSS px. Pure functions of the HUD metrics, shared by the sheet, the header, the navigator and the QA hook.
 *
 * `sheet` shell (portrait): a bottom sheet with three snap heights
 *   peek — grip, step title, tabs, navigation row (the scene keeps everything above);
 *   half — plus a reading window, about half the screen (the camera frames the subject above it);
 *   full — up to the compact header (reading mode; the framing stays that of `half`).
 * `side` shell (landscape): a side sheet on the right, open or collapsed to its grip.
 */
import type { HudMetrics } from '@/engine/api';

export type SheetSnap = 'peek' | 'half' | 'full';
export const SHEET_SNAPS: readonly SheetSnap[] = ['peek', 'half', 'full'];

export const TOUCH = {
  /** Compact header: one row of 44-unit targets. */
  headerH: 48,
  /** Gap between the screen edge (after the safe area) and the header row / floating buttons. */
  edge: 8,
  /** Grip strip at the top of the bottom sheet (the drag handle). */
  gripH: 20,
  tabsH: 42,
  /** Navigation row at the bottom of the bottom sheet. */
  navH: 52,
  /** Horizontal padding of the sheet's content. */
  padX: 16,
  /** The bottom sheet never gets wider than this (tablets): lines stay readable. */
  sheetMaxW: 620,
  /** Reading window of `half` is at least this tall. */
  halfMinView: 150,
  /** Side sheet: width range and the width of its grip strip. */
  sideMinW: 320,
  sideMaxW: 440,
  sideGrip: 22,
} as const;

export interface SheetGeometry {
  /** Sheet width and its left edge (centred on tablets). */
  width: number;
  left: number;
  /** Height of the sheet per snap, measured from the bottom edge of the screen (safe area included). */
  peek: number;
  half: number;
  full: number;
  /** Height of the scrolling view per snap. */
  view: Record<SheetSnap, number>;
  /** Bottom safe area under the navigation row. */
  safeBottom: number;
}

/** Top edge (from the top of the screen) below which the HUD may place things: safe area + header row. */
export function touchTop(m: HudMetrics): number {
  return m.safeArea.top + TOUCH.edge + TOUCH.headerH;
}

/**
 * Bottom-sheet geometry. `titleH`: height of the step title block (1–2 lines), which belongs to the sheet's
 * fixed head together with the grip and the tabs.
 */
export function sheetGeometry(m: HudMetrics, titleH: number, hasTabs: boolean): SheetGeometry {
  const width = Math.min(m.width, TOUCH.sheetMaxW);
  const safeBottom = m.safeArea.bottom;
  const head = TOUCH.gripH + titleH + (hasTabs ? TOUCH.tabsH + 8 : 0) + 6;
  const peek = head + TOUCH.navH + safeBottom;
  const full = Math.max(m.height - touchTop(m) - 6, peek + TOUCH.halfMinView);
  // about half the screen; on tall tablets a little less, so the scene keeps the larger part
  const want = Math.min(Math.round(m.height * 0.5), 480 + safeBottom);
  const half = Math.min(Math.max(want, peek + TOUCH.halfMinView), full);
  const chrome = head + TOUCH.navH + safeBottom;
  return {
    width,
    left: (m.width - width) / 2,
    peek,
    half,
    full,
    view: { peek: 0, half: half - chrome, full: full - chrome },
    safeBottom,
  };
}

/** Width of the side sheet (landscape), without the right safe area. */
export function sideWidth(m: HudMetrics): number {
  return Math.round(Math.min(Math.max(m.width * 0.42, TOUCH.sideMinW), TOUCH.sideMaxW));
}

/** The snap a released sheet settles on: the nearest one, biased by the release velocity (units / s, up > 0). */
export function settleSnap(height: number, velocity: number, g: SheetGeometry): SheetSnap {
  const projected = height + velocity * 0.18;
  let best: SheetSnap = 'half';
  let dist = Infinity;
  for (const s of SHEET_SNAPS) {
    const d = Math.abs(g[s] - projected);
    if (d < dist) {
      dist = d;
      best = s;
    }
  }
  return best;
}
