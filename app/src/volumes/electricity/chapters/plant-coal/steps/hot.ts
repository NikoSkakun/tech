/**
 * Hotspots bound to the document by content id (`hotspots.ts`) and observable by the interaction test: every
 * marker gets a probe `hs.<id>` (`__app.locate` → where to tap) and reports the card it opened through
 * `__app.read('hotspot')`. `createHot(ctx)` is called once per chapter instance (no module-level state).
 */
import { Object3D, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { HotspotSpec } from '@/hud';

export type Hot = (anchor: HotspotSpec['anchor'], content: string, extra?: Partial<HotspotSpec>) => HotspotSpec;

export function createHot(ctx: ChapterContext): Hot {
  let opened = '';
  ctx.qa.expose('hotspot', () => opened);
  return (anchor, content, extra = {}) => {
    // the marker sits on the object's origin (not its bounding-box centre): probe the same point
    const probe = anchor instanceof Object3D || typeof anchor === 'function' ? anchor : new Vector3(...anchor);
    ctx.qa.probe(`hs.${content}`, probe, { origin: true });
    return { anchor, content, onOpen: () => (opened = content), ...extra };
  };
}
