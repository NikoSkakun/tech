/**
 * What every area of the DOM interface gets from the core (`mount(dom)` in `step/`, `chrome/`, `dock/` …):
 * the HUD shell, the layer root and its five layers, the WebGL parts it may take over (hybrid flag, HUD_DOM §16)
 * and the region helper that places an element and reports it for the camera insets.
 */
import type { DomModule } from '@/hud/context';
import type { ChromeRegion } from '@/hud/debug';
import type { Hud, InsetSpec } from '@/hud/shell';
import type { UiNode } from '@/ui3d';

/** The five paint layers of the WebGL surface (`UI.layer`), bottom to top (HUD_DOM §3). */
export const DOM_LAYERS = ['world', 'chrome', 'popups', 'modal', 'tip'] as const;
export type DomLayer = (typeof DOM_LAYERS)[number];

/**
 * WebGL regions of the HUD plugin that a DOM area may take over. Hybrid rule: an area that draws a region in
 * the DOM `claim`s it and switches the WebGL node off (`visible = false` gives its room back; `opacity = 0`
 * keeps its box for regions placed relative to it).
 */
export interface WebglParts {
  readonly header: UiNode;
  readonly system: UiNode;
  readonly navigator: UiNode;
  /** The step column (step panel + control dock) and the board (`hud/dock.ts`, `hud/board.ts`). */
  readonly column: UiNode;
  readonly board: UiNode;
  /** The chapter spine of the volume on screen (null before the first volume's views exist). */
  spine(): UiNode | null;
}

/** Names of interface regions an area can claim (one owner each). */
export type RegionName =
  | ChromeRegion
  | 'step-panel'
  | 'tooltips'
  | 'toasts'
  | 'hints'
  | 'loading'
  | 'annotations'
  | `overlay:${string}`;

export interface RegionOptions {
  /** Layer the element goes into (default `chrome`). */
  layer?: DomLayer;
  /** Counts toward the camera's free area (same rules as `Hud.mount`). */
  inset?: InsetSpec;
  /** A chrome region (`data-region`): compared by `__ui.overlaps()`. */
  region?: ChromeRegion;
}

export interface DomHud {
  readonly hud: Hud;
  /** `#kd-hud` — tokens, `--u`, `--safe`, `--accent` live here. */
  readonly root: HTMLElement;
  readonly layers: Readonly<Record<DomLayer, HTMLElement>>;
  readonly webgl: WebglParts;
  /**
   * Place a region: append `mod.el` to its layer, give it the shell's hooks (`onChapter`, `onStep`, `update` …)
   * and, with `inset`, let its layout box frame the camera. Returns a function that removes it again.
   */
  region(mod: DomModule, opts?: RegionOptions): () => void;
  /** Record that the DOM draws this region now (throws if another area claimed it first). */
  claim(name: RegionName): void;
  /** Is the region drawn by the DOM? */
  claimed(name: RegionName): boolean;
}
