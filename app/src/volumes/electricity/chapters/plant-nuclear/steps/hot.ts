/**
 * Hotspots bound to the document by content id (`hotspots.ts`) and observable by the interaction test: every
 * marker gets a probe `hs.<id>` (`__app.locate` → where to tap) and reports the card it opened through
 * `__app.read('hotspot')`. `watchHotspots(ctx)` is called once per chapter instance, before the steps are built.
 */
import { Object3D, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { HotspotSpec } from '@/hud';

let watched: ChapterContext | null = null;
let opened = '';
/** The step whose factory runs now (kept for diagnostics of probes per step). */
export let building = '';
export function buildingStep(id: string): void {
  building = id;
}

/**
 * A QA probe registered for the step being built. It always reports the real point (as the pilots' probes do):
 * `chapter-check`'s DPR comparison treats a probe that answers null at both ratios as a difference.
 */
export function probe(name: string, get: () => Vector3 | Object3D, opts?: { origin?: boolean }): void {
  watched?.qa.probe(name, get, opts);
}

export function watchHotspots(ctx: ChapterContext): void {
  watched = ctx;
  opened = '';
  ctx.qa.expose('hotspot', () => opened);
  ctx.onDispose(() => (watched = null));
}

/** A hotspot marker at `anchor` whose card shows the content hotspot `content` (its id). */
export function hot(anchor: HotspotSpec['anchor'], content: string, extra: Partial<HotspotSpec> = {}): HotspotSpec {
  const get = anchor instanceof Object3D ? () => anchor : typeof anchor === 'function' ? anchor : () => new Vector3(...anchor);
  probe(`hs.${content}`, get, { origin: true });
  return { anchor, content, onOpen: () => (opened = content), ...extra };
}
