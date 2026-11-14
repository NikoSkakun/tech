/**
 * Pointer interaction with the plant islands (steps `intro` and `gallery`): hover lifts the island's pulse ring
 * in `cyan` (the affordance colour), a click selects it (`yellow` ring) or opens its chapter. One registration
 * per island for the whole chapter; the step on screen says what a click does through `mode` (a "wanted this
 * frame" field: `begin()` resets it to `none`, which also disables picking).
 */
import { Vector3, type Object3D } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createPulseRings } from '@/fx';
import { plantTitle } from '../labels';
import { PLANT_IDS, type PlantId } from '../plants-data';
import type { PlantIsland } from './plant-islands';

export type PickMode = 'none' | 'select' | 'open';

export interface IslandPicker {
  mode: PickMode;
  hovered: PlantId | null;
  selected: PlantId | null;
  /** Called on a click in `open` mode. */
  onOpen: ((id: PlantId) => void) | null;
  /** Called on a click in `select` mode (after `selected` changed). */
  onSelect: ((id: PlantId) => void) | null;
  begin(): void;
  update(dt: number): void;
}

export function createIslandPicker(ctx: ChapterContext, sats: Record<PlantId, PlantIsland>, parent: Object3D): IslandPicker {
  const hoverRing = createPulseRings({ size: 46, color: 'cyan', amount: 2, billboard: false });
  const selectRing = createPulseRings({ size: 50, color: 'yellow', amount: 3, billboard: false });
  for (const r of [hoverRing, selectRing]) {
    r.rotation.x = -Math.PI / 2;
    r.fade = 0;
    parent.add(r);
  }
  const p: IslandPicker = {
    mode: 'none',
    hovered: null,
    selected: null,
    onOpen: null,
    onSelect: null,
    begin() {
      p.mode = 'none';
    },
    update(dt) {
      const k = Math.min(1, dt * 8);
      const place = (ring: typeof hoverRing, id: PlantId | null, on: boolean): void => {
        ring.fade += ((on && id ? 1 : 0) - ring.fade) * k;
        if (!id) return;
        const g = sats[id].group;
        ring.position.copy(g.getWorldPosition(tmp)).add(lift);
        ring.scale.setScalar(g.scale.x / 0.3);
      };
      place(hoverRing, p.hovered, p.mode !== 'none' && p.hovered !== p.selected);
      place(selectRing, p.selected, p.mode === 'select');
    },
  };
  const tmp = new Vector3();
  const lift = new Vector3(0, 1.2, 0);
  for (const id of PLANT_IDS) {
    ctx.input.register(sats[id].group, {
      tooltip: plantTitle(id),
      cursor: 'pointer',
      enabled: () => p.mode !== 'none',
      hover: (over) => {
        if (over) p.hovered = id;
        else if (p.hovered === id) p.hovered = null;
      },
      click: () => {
        if (p.mode === 'select') {
          p.selected = id;
          p.onSelect?.(id);
        } else if (p.mode === 'open') p.onOpen?.(id);
      },
    });
  }
  return p;
}
