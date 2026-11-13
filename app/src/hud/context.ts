/**
 * Shared context of the HUD modules: the engine, the one HUD surface, the region tree and a few services.
 */
import type { ChapterManifest, Engine, HudMetrics, Position, VolumeManifest } from '@/engine/api';
import type { ChapterContent } from '@/content';
import type { ToastOptions, UiNode, UiSurface } from '@/ui3d';
import type { SheetInsets, TouchSheet } from './touch/sheet';

/** Hooks of the touch shells (F5): installed by the sheet when a phone / tablet layout is first built. */
export interface TouchHooks {
  /** Area the sheet and the compact header take from the scene (HUD units from each edge). */
  insets: ((m: HudMetrics) => SheetInsets) | null;
  /** Show a card (an opened hotspot) inside the sheet; returns a function that removes it. */
  card: ((card: UiNode, onDismiss: () => void, opts?: { back?: boolean }) => () => void) | null;
  /** The sheet itself (QA hook, menu). */
  sheet: TouchSheet | null;
}

export type OverlayName = 'library' | 'map' | 'home' | 'settings' | 'glossary' | 'help' | 'menu';

export interface HudContext {
  readonly engine: Engine;
  readonly surface: UiSurface;
  /** Current HUD metrics (size in units, layout class, safe margin). */
  readonly metrics: HudMetrics;
  /** Volume of the chapter on screen (null before the first chapter). */
  readonly volume: VolumeManifest | null;
  /**
   * Is the library level part of the interface right now (volume name in the header, the way back to the
   * library, the glossary scope switch)? False while the library is a single published volume.
   */
  readonly libraryLevel: boolean;
  /**
   * The step loaded behind the landing screen of a first visit, not seen by the learner yet: it is neither
   * visited nor "the current step" for the map, home and library until the learner reaches it (`landing.ts`).
   */
  readonly unseenStep: Position | null;
  /** Manifest and content of the chapter on screen (content is null until loaded / when absent). */
  readonly chapter: ChapterManifest | null;
  readonly content: ChapterContent | null;
  /** Re-run the responsive layout before the next frame (a region changed size). */
  relayout(): void;
  toast(text: string, opts?: ToastOptions): () => void;
  /** Open one of the full-screen views / modal overlays (closes the one that is open). */
  open(name: OverlayName, arg?: unknown): void;
  /** Close the open overlay (Esc). Returns false if nothing was open. */
  close(): boolean;
  readonly overlay: OverlayName | null;
  /** Jump to a step through the engine (closes overlays first). `chapter`: short id or `volume/chapter`. */
  goto(chapter: string, stepId?: string): void;
  /** Touch shells (phones, tablets): see `TouchHooks`. All null on desktops. */
  readonly touch: TouchHooks;
}

/** A HUD region: owns a node, reacts to chapter / step / resize. All hooks are optional. */
export interface HudModule {
  readonly node: UiNode;
  /** The chapter on screen belongs to another volume than before (fires before `onChapter`). */
  onVolume?(volume: VolumeManifest): void;
  /** A new chapter is on screen (content may still be null; `onContent` follows). */
  onChapter?(manifest: ChapterManifest): void;
  onContent?(content: ChapterContent | null): void;
  onStep?(stepId: string, instant: boolean): void;
  /** Called from the responsive layout with the current metrics. */
  onLayout?(metrics: HudMetrics): void;
  /** Per-frame work (keep it tiny). */
  update?(dt: number): void;
}
