/**
 * The constructor's board (step 7): 6×4 node "buttons" on the table top, the part views between them and the
 * live display of a solution — leads tinted by node potential (`blue` → `pink` → `coral`), pulses ∝ current in
 * the direction it really flows, lamp filaments by brightness, a chip with I and U at every part, current
 * balance chips at junctions, and the `yellow` ball of «Обійти контур».
 */
import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { fmtNumber, fmtUnit } from '@/content';
import { createOrbs } from '@/fx';
import { K, SEMANTIC, col, voltageRamp } from '@/style';
import type { Text3D } from '@/text';
import { BUILDER, gridNode, type BuilderSolution, type Part } from '@electricity/sim/current';
import { ALL_NODES, flowAB, junctions, nodeBalance, nodeXY } from '../sim-bindings/builder-edit';
import type { Mats } from '../world';
import { tag } from '../world';
import { createPartView, disposePartView, type PartView } from './circuit-parts';
import { LEAD_Y } from './leads';

export const GRID_PITCH = 1.15;
const signed = (x: number): string => `${x >= 0 ? '+' : '−'}${fmtNumber(Math.abs(x), { maxDigits: 2 })}`;

export interface CircuitGrid {
  group: Group;
  /** Invisible plane over the grid: register the pointer handlers on it. */
  pick: Mesh;
  nodePos(node: string, out?: Vector3): Vector3;
  /** Node / part under a point of the table (set-local), within reach of a finger. */
  nodeAt(p: Vector3): string | null;
  partAt(p: Vector3): string | null;
  /** First node of a placement in progress (highlight), or the selected part. */
  pending: string | null;
  selected: string | null;
  /** Position of the KVL ball along the table, or null. */
  ball: Vector3 | null;
  view(id: string): PartView | undefined;
  /** Rebuild the views when parts were added / removed. */
  sync(parts: readonly Part[]): void;
  /** Show a solution. */
  apply(parts: readonly Part[], s: BuilderSolution, t: number): void;
}

export function createCircuitGrid(mats: Mats): CircuitGrid {
  const g = new Group();
  g.name = 'circuit-grid';
  const pos = (node: string, out = new Vector3()): Vector3 => {
    const [c, r] = nodeXY(node);
    return out.set(
      (c - (BUILDER.columns - 1) / 2) * GRID_PITCH,
      LEAD_Y,
      (r - (BUILDER.rows - 1) / 2) * GRID_PITCH,
    );
  };
  // node buttons (one instanced mesh) and the highlight ring
  const nodes = new InstancedMesh(new CylinderGeometry(0.1, 0.12, 0.08, 20), mats.chrome, ALL_NODES.length);
  const m4 = new Matrix4();
  const v = new Vector3();
  ALL_NODES.forEach((n, k) => nodes.setMatrixAt(k, m4.makeTranslation(pos(n, v).x, 0.04, v.z)));
  nodes.receiveShadow = true;
  const ringMat = K.glow({ color: 'cyan', intensity: 1.5, falloff: 0, whiten: 0, keepHue: true });
  const ring = new Mesh(new TorusGeometry(0.24, 0.03, 8, 32).rotateX(Math.PI / 2), ringMat);
  const pick = new Mesh(
    new PlaneGeometry(BUILDER.columns * GRID_PITCH + 0.6, BUILDER.rows * GRID_PITCH + 0.6).rotateX(
      -Math.PI / 2,
    ),
    K.flat('bg.deep'),
  );
  pick.position.y = 0.02;
  pick.material.colorWrite = false; // pickable, never drawn
  pick.material.depthWrite = false;
  const selRing = new Mesh(
    new CircleGeometry(0.62, 40).rotateX(-Math.PI / 2),
    K.glass({ color: 'yellow', opacity: 0.22, edgeOpacity: 0.7 }),
  );
  const ball = createOrbs({ kind: 'pulse', count: 1, radius: 0.16, color: SEMANTIC.current });
  const balance: Text3D[] = Array.from({ length: 4 }, () => tag('', 16, 'lime', 'mono'));
  g.add(nodes, ring, selRing, pick, ball, ...balance);

  const views = new Map<string, PartView>();
  let structure = '';
  const tint = new Color();
  const neutral = col('steel').lerp(col('slate'), 0.55);
  const warm = col('orange');
  const hot = col('yellow');
  const self: CircuitGrid = {
    group: g,
    pick,
    nodePos: pos,
    pending: null,
    selected: null,
    ball: null,
    nodeAt(p) {
      let best: string | null = null;
      let d = 0.42;
      for (const n of ALL_NODES) {
        const q = pos(n, v);
        const k = Math.hypot(q.x - p.x, q.z - p.z);
        if (k < d) [best, d] = [n, k];
      }
      return best;
    },
    partAt(p) {
      let best: string | null = null;
      let d = 0.55;
      for (const view of views.values()) {
        const k = Math.hypot(view.mid.x - p.x, view.mid.z - p.z);
        if (k < d) [best, d] = [view.id, k];
      }
      return best;
    },
    view: (id) => views.get(id),
    sync(parts) {
      const key = parts.map((p) => `${p.id}:${p.kind}:${p.a}:${p.b}`).join('|');
      if (key === structure) return;
      structure = key;
      for (const [id, view] of views) {
        // a preset may reuse an id for another part: the view must match kind and both nodes
        if (parts.some((p) => p.id === id && `${p.kind}:${p.a}:${p.b}` === view.key)) continue;
        disposePartView(view);
        views.delete(id);
      }
      for (const p of parts) {
        if (views.has(p.id)) continue;
        const view = createPartView(p, pos(p.a), pos(p.b));
        views.set(p.id, view);
        g.add(view.group);
      }
    },
    apply(parts, s, t) {
      const emf = Math.max(...parts.filter((p) => p.kind === 'source').map((p) => p.emfV ?? 0), 1e-6);
      for (const p of parts) {
        const view = views.get(p.id);
        const r = s.parts.get(p.id);
        if (!view || !r) continue;
        const i = flowAB(p, s);
        const mag = Math.abs(i);
        view.halves.forEach((lead, k) => {
          // potential ramp, relative to the largest EMF on the table; floating nodes stay neutral grey
          const phi = s.potentials.get(k === 0 ? p.a : p.b) ?? null;
          lead.tint(phi === null ? neutral : voltageRamp(Math.min(Math.max(phi / emf, 0), 1), tint));
          lead.drive(
            Math.sign(i) * Math.min(0.35 + 0.8 * mag, 4) * (mag > 1e-4 ? 1 : 0),
            mag > 1e-4 ? Math.min(0.45 + 0.35 * mag, 2.2) : 0,
          );
        });
        if (view.glow) {
          const b = r.burnt ? 0 : r.brightness;
          view.glow.setColor(tint.copy(r.burnt ? col('ink', tint) : warm).lerp(hot, b));
          view.glow.intensity = r.burnt ? 0.05 : 0.3 + 2.6 * b * (1 + 0.03 * Math.sin(t * 9 + view.mid.x));
        }
        if (view.blade) view.blade.rotation.z = p.closed === false ? -0.9 : 0;
        if (view.label) {
          const text =
            p.kind === 'source'
              ? r.tripped
                ? '0 V'
                : fmtUnit(p.emfV ?? 0, 'V', { maxDigits: 1 })
              : p.kind === 'ammeter'
                ? fmtUnit(mag, 'A', { maxDigits: 2 })
                : p.kind === 'switch'
                  ? ''
                  : r.burnt
                    ? '✗'
                    : `${fmtUnit(mag, 'A', { maxDigits: 2 })}\n${fmtUnit(Math.abs(r.voltageV), 'V', { maxDigits: 1 })}`;
          if (text !== view.shown) view.label.text = view.shown = text;
        }
      }
      ring.visible = self.pending !== null;
      if (self.pending) ring.position.copy(pos(self.pending, v)).setY(0.12);
      ringMat.intensity = 1.4 + 0.5 * Math.sin(t * 6);
      const sel = self.selected ? views.get(self.selected) : undefined;
      selRing.visible = sel !== undefined;
      if (sel) selRing.position.set(sel.mid.x, 0.03, sel.mid.z);
      ball.visible = self.ball !== null;
      if (self.ball) {
        ball.setPosition(0, self.ball.x, 0.3, self.ball.z);
        ball.commit();
      }
      // Kirchhoff's current law at the junctions: «ΣI: +3 −1 −2 = 0»
      const js = junctions(parts, s);
      balance.forEach((label, k) => {
        const node = js[k];
        label.visible = node !== undefined;
        if (!node) return;
        // on the side of the node away from the board's middle row, where no branch runs
        const up = nodeXY(node)[1] < (BUILDER.rows - 1) / 2;
        label.position.copy(pos(node, v)).setY(0.12).z += up ? -0.42 : 0.42;
        const text = `ΣI: ${nodeBalance(parts, s, node).map(signed).join(' ')} = 0`;
        if (label.text !== text) label.text = text;
      });
    },
  };
  return self;
}

export { gridNode };
