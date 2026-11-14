/**
 * Hotspots bound to the document by content id (`hotspots.ts`) and observable by the interaction test: every
 * marker gets a probe `hs.<id>` (`__app.locate` → where to tap) and reports the card it opened through
 * `__app.read('hotspot')`. `watchHotspots(ctx)` is called once per chapter instance, before the steps are built;
 * the scene calls `hotspotsOf(step)` before each step factory and `activateHotspots(step)` on every step entry,
 * so only the probes of the step on screen exist (an off-step marker would project far off screen and jitter).
 */
import { Object3D, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import type { HotspotSpec } from '@/hud';

let watched: ChapterContext | null = null;
let opened = '';
/** Step whose factory is running: the hotspots it binds belong to it. */
let owner = '';
const entries: { step: string; name: string; get: () => Object3D | Vector3 }[] = [];
let active: (() => void)[] = [];

export function watchHotspots(ctx: ChapterContext): void {
  watched = ctx;
  opened = '';
  entries.length = 0;
  active = [];
  ctx.qa.expose('hotspot', () => opened);
  ctx.onDispose(() => (watched = null));
}

/** Called by the scene before each step factory runs: the hotspots it binds belong to step `id`. */
export function hotspotsOf(id: string): void {
  owner = id;
}

/** Called by the scene on every step entry: register the probes of that step only. */
export function activateHotspots(step: string): void {
  for (const off of active) off();
  const ctx = watched;
  active = ctx ? entries.filter((e) => e.step === step).map((e) => ctx.qa.probe(e.name, e.get, { origin: true })) : [];
}

/** A hotspot marker at `anchor` whose card shows the content hotspot `content` (its id). */
export function hot(anchor: HotspotSpec['anchor'], content: string, extra: Partial<HotspotSpec> = {}): HotspotSpec {
  // the marker sits on the object's origin (not its bounding-box centre): probe the same point
  const get = (): Object3D | Vector3 => (anchor instanceof Object3D ? anchor : typeof anchor === 'function' ? anchor() : new Vector3(...anchor));
  entries.push({ step: owner, name: `hs.${content}`, get });
  return { anchor, content, onOpen: () => (opened = content), ...extra };
}
