/**
 * The parts tray of the constructor (step 7): one model of every part kind on a plate in front of the board.
 * A tray item is carried with the pointer (mouse or one finger); over the board it snaps between the two
 * nearest neighbouring nodes and a glowing bar shows where it will land. The step decides what a drop means.
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { Builder } from '@/kit';
import { K } from '@/style';
import { BUILDER, gridNode, type PartKind } from '@electricity/sim/current';
import { GRID_PITCH } from './circuit-grid';
import { partBody } from './circuit-parts';
import { LEAD_Y } from './leads';

export const TRAY_KINDS: readonly PartKind[] = ['wire', 'resistor', 'lamp', 'switch', 'ammeter', 'source'];
const ITEM_PITCH = 0.82;
const HOME_YAW = Math.PI / 2; // on the tray parts lie front-to-back, so six fit across the table
const LIFT = 0.35; // a carried part floats this high above the table

export interface TrayItem {
  kind: PartKind;
  /** Carried model (follows the pointer while held). */
  model: Group;
  /** Invisible pick proxy at the item's home: register the pointer handlers on it. */
  hit: Mesh;
  home: Vector3;
}

export interface Snap {
  a: string;
  b: string;
  mid: Vector3;
  /** Rotation about Y that lays a body from `a` to `b`. */
  yaw: number;
}

export interface CircuitTray {
  group: Group;
  items: TrayItem[];
  /** The item being carried, or null. */
  held: TrayItem | null;
  /** Where the carried part would land, or null when it is not over a free gap. */
  snap: Snap | null;
  /** Active tool of the dock: its tray item is lifted and ringed. */
  active: PartKind | null;
  /** Until the first part is carried, the resistor hops now and then: a wordless "take me". */
  invite: boolean;
  /** Move the carried item to a table point (set-local); `nodePos` gives grid node positions. */
  carry(p: Vector3, nodePos: (n: string, out?: Vector3) => Vector3): void;
  update(dt: number, t: number): void;
}

function wireIcon(): Group {
  const b = new Builder('part-wire');
  b.cyl(0.055, 0.8, { at: [-0.4, LEAD_Y, 0], axis: 'x', seg: 12, slot: 'metal', c: 'amber' });
  b.sphere(0.09, { at: [-0.4, LEAD_Y, 0], seg: 12, slot: 'metal', c: 'mist' });
  b.sphere(0.09, { at: [0.4, LEAD_Y, 0], seg: 12, slot: 'metal', c: 'mist' });
  return b.build().group;
}

/** `z` = the tray's centre line (set-local), in front of the board's first row. */
export function createCircuitTray(z: number): CircuitTray {
  const group = new Group();
  group.name = 'circuit-tray';
  const plate = new Builder('tray-plate');
  const w = TRAY_KINDS.length * ITEM_PITCH + 0.3;
  plate.box(w, 0.06, 1.05, { at: [0, 0.0, 0], r: 0.05, c: ['ink', 'slate'] });
  plate.box(w + 0.08, 0.04, 1.13, { at: [0, -0.02, 0], r: 0.05, slot: 'metal', c: 'steel' });
  const plateModel = plate.build().group;
  plateModel.position.set(0, 0, z);
  group.add(plateModel);
  const cell = new BoxGeometry(ITEM_PITCH * 0.95, 0.9, 1.05);
  const items: TrayItem[] = TRAY_KINDS.map((kind, k) => {
    const home = new Vector3((k - (TRAY_KINDS.length - 1) / 2) * ITEM_PITCH, 0.06, z);
    const model = kind === 'wire' ? wireIcon() : partBody(kind).group;
    model.scale.setScalar(kind === 'source' || kind === 'switch' ? 0.95 : 1);
    model.position.copy(home);
    model.rotation.y = HOME_YAW;
    const hit = new Mesh(cell, K.flat('bg.deep'));
    hit.material.colorWrite = false; // pickable, never drawn
    hit.material.depthWrite = false;
    hit.position.copy(home).setY(0.4);
    group.add(model, hit);
    return { kind, model, hit, home };
  });
  // landing bar between two nodes, and the ring around the active tool's item
  const bar = new Mesh(
    new BoxGeometry(1, 0.05, 0.16),
    K.glow({ color: 'cyan', intensity: 1.6, falloff: 0, whiten: 0, keepHue: true }),
  );
  bar.visible = false;
  const mark = new Mesh(
    new BoxGeometry(ITEM_PITCH * 0.9, 0.02, 0.98),
    K.glass({ color: 'yellow', opacity: 0.25, edgeOpacity: 0.8 }),
  );
  mark.visible = false;
  group.add(bar, mark);
  const v = new Vector3();
  const u = new Vector3();

  const self: CircuitTray = {
    group,
    items,
    held: null,
    snap: null,
    active: null,
    invite: true,
    carry(p, nodePos) {
      const item = self.held;
      if (!item) return;
      // nearest gap between two neighbouring nodes, within reach of a finger
      let best: Snap | null = null;
      let d = 0.62;
      for (let c = 0; c < BUILDER.columns; c++)
        for (let r = 0; r < BUILDER.rows; r++)
          for (const [dc, dr] of [
            [1, 0],
            [0, 1],
          ] as const) {
            if (c + dc >= BUILDER.columns || r + dr >= BUILDER.rows) continue;
            const a = gridNode(c, r);
            const b = gridNode(c + dc, r + dr);
            nodePos(a, v).lerp(nodePos(b, u), 0.5);
            const k = Math.hypot(v.x - p.x, v.z - p.z);
            if (k < d) {
              d = k;
              best = { a, b, mid: v.clone().setY(0), yaw: dr ? -Math.PI / 2 : 0 };
            }
          }
      self.snap = best;
      if (best) {
        item.model.position.copy(best.mid).setY(0.12);
        item.model.rotation.y = best.yaw;
      } else {
        item.model.position.set(p.x, LIFT, p.z);
        item.model.rotation.y = HOME_YAW;
      }
    },
    update(dt, t) {
      const ease = 1 - Math.exp(-dt * 14);
      for (const item of items) {
        if (item === self.held) continue;
        const hop = self.invite && item.kind === 'resistor' ? 0.4 * Math.max(Math.sin(t * 2.1), 0) ** 12 : 0;
        const lift = (item.kind === self.active ? 0.1 + 0.03 * Math.sin(t * 4) : 0) + hop;
        item.model.position.lerp(v.copy(item.home).setY(item.home.y + lift), ease);
        item.model.rotation.y += (HOME_YAW - item.model.rotation.y) * ease;
      }
      const s = self.held ? self.snap : null;
      bar.visible = s !== null;
      if (s) {
        bar.position.copy(s.mid).setY(0.03);
        bar.rotation.y = s.yaw;
        bar.scale.x = GRID_PITCH;
      }
      const act = items.find((x) => x.kind === self.active);
      mark.visible = act !== undefined;
      if (act) mark.position.copy(act.home).setY(0.045);
    },
  };
  return self;
}
