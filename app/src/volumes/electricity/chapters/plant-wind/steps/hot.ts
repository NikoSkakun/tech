/**
 * Hotspots bound to the document by content id (`hotspots.ts`) and observable by the interaction test:
 * every marker gets a probe `hs.<id>` (`__app.locate` → where to tap) and reports the card it opened through `__app.read('hotspot')`. `watchHotspots(ctx)` is called once per
 * chapter instance, before the steps are built.
 */
import { Object3D, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { HotspotSpec } from '@/hud';

let watched: ChapterContext | null = null;
let opened = '';

export function watchHotspots(ctx: ChapterContext): void {
  watched = ctx;
  opened = '';
  ctx.qa.expose('hotspot', () => opened);
  ctx.onDispose(() => (watched = null));
}

/** A hotspot marker at `anchor` whose card shows the content hotspot `content` (its id). */
export function hot(anchor: HotspotSpec['anchor'], content: string, extra: Partial<HotspotSpec> = {}): HotspotSpec {
  // the marker sits on the object's origin (not its bounding-box centre): probe the same point
  watched?.qa.probe(`hs.${content}`, anchor instanceof Object3D || typeof anchor === 'function' ? anchor : new Vector3(...anchor), { origin: true });
  return { anchor, content, onOpen: () => (opened = content), ...extra };
}
