/**
 * World annotations of the current step (declared through `stepUi`): callouts and hotspots are projected
 * with this frame's world camera, kept inside the area the HUD leaves free, faded when occluded, and
 * hotspot markers open a card with the text from the step's content.
 */
import { Raycaster, Vector3, type Object3D } from 'three';
import { termName, type Hotspot } from '@/content';
import {
  AnnotationLayer,
  Card,
  conceal,
  reveal,
  type HotspotMarker,
  type Projected,
  type UiNode,
} from '@/ui3d';
import type { Hud } from './shell';
import { holds } from './dock-build';
import { onReadingLevel, stepCopy } from './level';
import type { Anchor, HotspotSpec, StepUiSpec } from './step-ui-types';

const _v = new Vector3();
const _dir = new Vector3();

export function mountAnnotations(hud: Hud): (spec: StepUiSpec | null) => void {
  const layer = new AnnotationLayer();
  hud.world.add(layer);
  const ray = new Raycaster();
  let card: { node: UiNode; marker: HotspotMarker } | null = null;
  let checks: (() => void)[] = [];
  let turn = 0;
  let last = hud.engine.clock.time;

  const camera = (): Object3D | null => hud.engine.runtime.director?.camera ?? null;
  const worldOf = (a: Anchor, out: Vector3): Vector3 => {
    if (typeof a === 'function') return out.copy(a());
    if (Array.isArray(a)) return out.set(a[0] as number, a[1] as number, a[2] as number);
    return (a as Object3D).getWorldPosition(out);
  };
  const projector = (a: Anchor) => (): Projected => {
    const cam = hud.engine.runtime.director?.camera;
    if (!cam) return { x: 0, y: 0, visible: false };
    worldOf(a, _v).applyMatrix4(cam.matrixWorldInverse);
    const front = _v.z < 0;
    _v.applyMatrix4(cam.projectionMatrix);
    const m = hud.metrics;
    return { x: (_v.x * m.width) / 2, y: (_v.y * m.height) / 2, visible: front };
  };
  /** Occlusion test, throttled: one anchor per frame, round robin. */
  const occluder = (a: Anchor, objects: readonly Object3D[] | undefined): (() => boolean) | undefined => {
    if (!objects || objects.length === 0) return undefined;
    let hidden = false;
    checks.push(() => {
      const cam = camera();
      if (!cam) return;
      const from = cam.getWorldPosition(new Vector3());
      const to = worldOf(a, new Vector3());
      const dist = from.distanceTo(to);
      ray.set(from, _dir.copy(to).sub(from).normalize());
      ray.far = dist * 0.985;
      hidden = ray.intersectObjects(objects as Object3D[], true).length > 0;
    });
    return () => hidden;
  };
  const closeCard = (): void => {
    if (!card) return;
    const c = card;
    card = null;
    c.marker.open = false;
    conceal(c.node, { onDone: () => c.node.detach() });
  };
  // an open hotspot card shows the copy of the level it was opened at: close it when the level changes
  onReadingLevel(hud.engine, closeCard);

  hud.surface.beforeFlush = () => {
    const now = hud.engine.clock.time;
    // the fades are exact for any dt, so a scripted `__app.step(dt, n)` (one render after n steps) lands
    // where real time would (no half-faded ghosts in `?freeze` shots)
    const dt = Math.min(Math.max(now - last, 0), 1);
    last = now;
    if (layer.children.length === 0) return;
    if (checks.length > 0) checks[turn++ % checks.length]!();
    const m = hud.metrics;
    const f = hud.engine.hud.insetFractions();
    const pad = 12;
    layer.update(dt, {
      left: -m.width / 2 + f.left * m.width + pad,
      right: m.width / 2 - f.right * m.width - pad,
      top: m.height / 2 - f.top * m.height - pad,
      bottom: -m.height / 2 + f.bottom * m.height + pad,
    });
  };

  /** The content hotspot a spec binds to (index, id, international name or full name). */
  const contentOf = (h: HotspotSpec): Hotspot | undefined => {
    const list = stepCopy(hud.engine, hud.content, hud.engine.store.get().stepId ?? '')?.hotspots ?? [];
    const key = h.content ?? h.title;
    if (typeof key === 'number') return list[key];
    if (key === undefined) return undefined;
    return list.find((x) => x.id === key || x.international === key || x.name === key || x.title === key);
  };

  /** What a content hotspot shows as its title (§54 display name). */
  const display = (x: Hotspot | undefined): string =>
    x ? (x.title ?? (termName({ international: x.international, ukrainian: x.ukrainian }) || x.name)) : '';

  return (spec) => {
    closeCard();
    checks = [];
    layer.set(
      (spec?.callouts ?? []).map((c) => {
        const text = c.text;
        const when = c.visible;
        return {
          project: projector(c.anchor),
          text: typeof text === 'function' ? text() : text,
          label: typeof text === 'function' ? text : undefined,
          color: c.color,
          side: c.side,
          occluded: occluder(c.anchor, c.occluders),
          hidden: when === undefined ? undefined : () => !holds(when),
        };
      }),
      (spec?.hotspots ?? []).map((h) => {
        const when = h.visible;
        return {
          project: projector(h.anchor),
          title: h.title ?? display(contentOf(h)),
          occluded: occluder(h.anchor, h.occluders),
          hidden: when === undefined ? undefined : () => !holds(when),
          onPick: (marker: HotspotMarker) => {
            const same = card?.marker === marker;
            closeCard();
            if (same) return;
            const bound = contentOf(h);
            const m = hud.metrics;
            const right = marker.x < m.width / 2 - hud.engine.hud.insetFractions().right * m.width - 470;
            const node = new Card({
              kicker: 'Гаряча точка',
              icon: 'info',
              title: h.title ?? display(bound),
              body: h.text ?? bound?.text ?? '',
              width: 400,
              visible: false,
              onClose: closeCard,
              float: {
                ax: 0.5,
                ay: 0.5,
                px: right ? 0 : 1,
                py: 0.5,
                dx: marker.x + (right ? 34 : -34),
                dy: -Math.min(Math.max(marker.y, -m.height / 2 + 200), m.height / 2 - 200),
              },
            });
            hud.popups.add(node);
            marker.open = true;
            card = { node, marker };
            reveal(node, { dx: right ? -16 : 16, dy: 0 });
            h.onOpen?.();
          },
        };
      }),
      hud.metrics.pxPerUnit,
    );
  };
}
