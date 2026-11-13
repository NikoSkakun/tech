/**
 * Direct manipulation of step 7: painting shade onto half-cells with the pointer (press / drag across the
 * glass; starting on a painted cell erases) and dragging the silhouettes over the module. Both write into the
 * `ShadeState`, which is the model's input.
 */
import { Mesh, PlaneGeometry, Vector3 } from 'three';
import type { DragInfo, PointerInfo } from '@/engine/api';
import { K } from '@/style';
import type { Lab } from '../chapter';
import { L } from '../labels';
import { M, cellAt } from '../parts/lm440-layout';
import type { Rig } from '../parts/rig';
import { createSilhouettes, localToMm, type ShadeKind, type Silhouette } from '../parts/shade-tools';
import type { ShadeState } from '../sim-bindings/shade-state';

export const SHADE_KINDS: readonly ShadeKind[] = ['leaf', 'stripe', 'snow', 'bird'];

export interface ShadeTools {
  items: Record<ShadeKind, Silhouette>;
  /** Pick proxy over the glass (QA probe target). */
  glass: Mesh;
  /** Push the visible silhouettes into the shade state. */
  sync(shown: (kind: ShadeKind) => boolean): void;
  /** Half-cell centre in world space (for QA probes and callouts). */
  cellWorld(cell: number, out?: Vector3): Vector3;
}

export function createShadeTools(lab: Lab, rig: Rig, shade: ShadeState, enabled: () => boolean, shown: (kind: ShadeKind) => boolean): ShadeTools {
  const { ctx } = lab;
  const module = rig.module;
  const silhouettes = createSilhouettes();
  module.group.add(silhouettes.group);
  const glass = new Mesh(new PlaneGeometry(M.iw, M.il).rotateX(-Math.PI / 2), K.flat('cyan'));
  glass.material.colorWrite = false;
  glass.material.depthWrite = false;
  glass.position.y = 0.008;
  module.group.add(glass);

  const p = new Vector3();
  const n = new Vector3();
  const through = new Vector3();
  /** Pointer → point on the glass plane in the module frame, or null. */
  const onGlass = (e: PointerInfo | DragInfo): Vector3 | null => {
    module.group.updateWorldMatrix(true, false);
    through.setFromMatrixPosition(module.group.matrixWorld);
    n.set(0, 1, 0).transformDirection(module.group.matrixWorld);
    const denom = e.ray.direction.dot(n);
    if (Math.abs(denom) < 1e-5) return null;
    const k = through.clone().sub(e.ray.origin).dot(n) / denom;
    return k > 0 ? module.group.worldToLocal(p.copy(e.ray.origin).addScaledVector(e.ray.direction, k)) : null;
  };

  let erasing = false;
  const brush = (e: PointerInfo | DragInfo, first: boolean): void => {
    const hit = onGlass(e);
    if (!hit) return;
    const cell = cellAt(hit.x, hit.z);
    if (cell < 0) return;
    if (first) erasing = shade.isPainted(cell);
    shade.paint(cell, !erasing);
  };
  ctx.input.register(glass, {
    tooltip: L.paintTip,
    cursor: 'crosshair',
    enabled,
    press: (e) => brush(e, true),
    drag: (e) => brush(e, false),
  });

  const sync = (isShown: (kind: ShadeKind) => boolean): void => {
    for (const kind of SHADE_KINDS) silhouettes.items[kind].mesh.visible = isShown(kind);
    shade.setShapes(SHADE_KINDS.filter(isShown).map((kind) => silhouettes.items[kind].shape()));
  };
  for (const kind of SHADE_KINDS) {
    const s = silhouettes.items[kind];
    ctx.input.register(s.mesh, {
      tooltip: L.shapeTip,
      cursor: 'grab',
      enabled,
      drag: (e) => {
        const hit = onGlass(e);
        if (!hit) return;
        const [x, y] = localToMm(hit.x, hit.z);
        s.moveTo(x, y);
        sync(shown);
      },
    });
  }

  return {
    items: silhouettes.items,
    glass,
    sync,
    cellWorld: (cell, out = new Vector3()) => module.group.localToWorld(module.cellCentre(cell, out)),
  };
}
