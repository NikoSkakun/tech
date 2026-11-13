/**
 * The power transformer of steps 4–6 assembled from separately fading layers (each its own kit model, so its
 * own materials fade): tank (walls, cover, stiffeners, nameplate) with a faint glass ghost that stays when the tank
 * is removed, oil (amber glass volume + convection orbs: up past the windings, along under the cover, down through
 * the radiators, back along the floor), HV windings (cut open at the front), LV windings, and the core. Metres;
 * the step scales the group. Handles drive the moving parts of the exterior (fans, Buchholz float, knife
 * switches, thermometer needles).
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K, col } from '@/style';
import { TANK } from '../world';
import { ACTIVE, addCore, addLimbWindings, limbX } from './active-part';
import { COVER, TK, createExterior } from './power-exterior';

export type LayerId = 'tank' | 'oil' | 'hv' | 'lv' | 'core';
export const LAYER_IDS: readonly LayerId[] = ['tank', 'oil', 'hv', 'lv', 'core'];
/** Front window of the cutaway windings (rad). */
const CUT = 1.7;

export interface PowerTransformer {
  group: Group;
  exterior: KitModel;
  layers: Record<LayerId, Group>;
  /** Faint glass outline of the tank, shown while the tank layer is off. */
  ghost: Mesh;
  oilFlow: Flow;
  /** Point in model metres → the group's local frame is the same (anchors for callouts). */
  anchor(name: string): Vector3;
  update(dt: number, s: { fans: boolean; thermo: number[]; blades: number; float: number }): void;
}

function tankLayer(): KitModel {
  const b = new Builder('power-tank');
  const { L, W, H, y0 } = TK;
  b.box(L, H, W, { r: 0.18, seg: 2, slot: 'gloss', c: [TANK.clone().multiplyScalar(0.78), TANK], at: [0, y0, 0] });
  b.box(L + 0.24, 0.14, W + 0.24, { r: 0.05, slot: 'gloss', c: TANK, at: [0, COVER - 0.07, 0] });
  for (let i = 0; i <= 6; i++) {
    const x = -L / 2 + 0.4 + (i / 6) * (L - 0.8);
    for (const z of [-1, 1]) b.box(0.14, H * 0.84, 0.12, { r: 0.04, slot: 'gloss', c: TANK.clone().multiplyScalar(0.88), at: [x, y0 + H * 0.06, z * (W / 2 + 0.03)] });
  }
  b.box(0.9, 0.55, 0.04, { r: 0.02, slot: 'gloss', c: 'ink', at: [-1.9, y0 + H * 0.45, W / 2 + 0.1] });
  b.box(0.7, 0.06, 0.02, { r: 0, slot: 'flat', c: 'mist', at: [-1.9, y0 + H * 0.45 + 0.35, W / 2 + 0.13] });
  b.cyl(0.18, 0.08, { axis: 'z', seg: 14, slot: 'gloss', c: 'red', at: [2.4, y0 + 0.35, W / 2 + 0.05] });
  return b.build();
}

function activeLayer(name: string, fn: (b: Builder) => void): KitModel {
  const b = new Builder(name);
  b.frame({ at: [0, TK.y0, 0] }, () => fn(b));
  return b.build();
}

/** Convection loops (metres): up beside the windings, under the cover to an end, down a radiator, back on the floor. */
function oilPaths(): { path: Vector3[]; closed: boolean }[] {
  const y0 = TK.y0 + 0.35;
  const y1 = COVER - 0.35;
  const loops: { path: Vector3[]; closed: boolean }[] = [];
  for (let k = 0; k < 3; k++) {
    const x = limbX(k) + 0.6;
    const z = ACTIVE.hv[1] + 0.22;
    loops.push({ closed: true, path: [new Vector3(x, y0, z), new Vector3(x, y1, z), new Vector3(-TK.L / 2 - 0.3, y1 + 0.05, z * 0.4), new Vector3(-TK.L / 2 - 1.0, y1 - 0.2, z * 0.2), new Vector3(-TK.L / 2 - 1.0, y0 + 0.2, z * 0.2), new Vector3(-TK.L / 2 - 0.3, y0 - 0.1, z * 0.4)] });
    loops.push({ closed: true, path: [new Vector3(limbX(k) - 0.6, y0, -z), new Vector3(limbX(k) - 0.6, y1, -z), new Vector3(limbX(k), y1, -TK.W / 2 - 1.0), new Vector3(limbX(k), y0 + 0.2, -TK.W / 2 - 1.0), new Vector3(limbX(k) - 0.3, y0 - 0.1, -z)] });
  }
  return loops;
}

export function createPowerTransformer(ctx: ChapterContext): PowerTransformer {
  const group = new Group();
  group.name = 'power-transformer';
  const exterior = createExterior();
  const tank = tankLayer();
  const core = activeLayer('power-core', (b) => addCore(b));
  const lv = activeLayer('power-lv', (b) => [0, 1, 2].forEach((k) => addLimbWindings(b, limbX(k), 'lv', CUT * 0.75)));
  const hv = activeLayer('power-hv', (b) => [0, 1, 2].forEach((k) => addLimbWindings(b, limbX(k), 'hv', CUT)));
  const oilBox = new Mesh(new BoxGeometry(TK.L - 0.25, TK.H - 0.45, TK.W - 0.25), K.glass({ color: 'amber', opacity: 0.16, edgeOpacity: 0.35 }));
  oilBox.position.set(0, TK.y0 + (TK.H - 0.45) / 2 + 0.05, 0);
  const oilFlow = createFlow(ctx, { kind: 'blob', color: col('amber').lerp(col('orange'), 0.2), paths: oilPaths(), count: 150, radius: 0.075, speed: 0.6, spread: 0.12, name: 'oil' });
  const oil = new Group();
  oil.add(oilBox, oilFlow);
  const ghost = new Mesh(new BoxGeometry(TK.L + 0.06, TK.H + 0.06, TK.W + 0.06), K.glass({ color: 'sky', opacity: 0.05, edgeOpacity: 0.45 }));
  ghost.position.set(0, TK.y0 + TK.H / 2, 0);
  const layers = { tank: tank.group, oil, hv: hv.group, lv: lv.group, core: core.group };
  group.add(exterior.group, ...Object.values(layers), ghost);
  const fanSpin = [0, 0, 0, 0];
  let fanSpeed = 0;
  return {
    group,
    exterior,
    layers,
    ghost,
    oilFlow,
    anchor: (name) => exterior.anchorLocal(name),
    update(dt, s) {
      fanSpeed += ((s.fans ? 9 : 0) - fanSpeed) * Math.min(1, dt * 1.5);
      fanSpin.forEach((a, i) => {
        fanSpin[i] = a + fanSpeed * dt * (i % 2 ? 1.07 : 1);
        const p = exterior.part(`fan${i}`);
        if (i < 2) p.rotation.x = fanSpin[i]!;
        else p.rotation.z = fanSpin[i]!;
      });
      s.thermo.forEach((c, i) => (exterior.part(`thermo${i}`).rotation.z = 1.2 - (Math.min(120, Math.max(0, c)) / 120) * 2.4));
      for (let i = 0; i < 3; i++) exterior.part(`blade${i}`).rotation.x = -s.blades * 1.15;
      exterior.part('float').position.y = TK.y0 + TK.H + 0.82 - s.float * 0.12;
    },
  };
}
