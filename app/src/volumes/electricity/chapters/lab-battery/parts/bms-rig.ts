/**
 * Step 9: one opened module of the home battery — sixteen LFP cells in a series string, a level glass above
 * each (its state of charge), sense wires up to the BMS board (`teal` PCB: controller, shunt, contactor,
 * pre-charge resistor and sixteen balancing resistors that glow while they bleed a cell).
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder } from '@/kit';
import { K, SEMANTIC, col } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';

export const BMS_CELLS = 16;
const PITCH = 0.36;
const CELL_H = 1.05;
const GLASS_H = 0.95;

export interface BmsRigState {
  /** 0…100 per cell. */
  socPct: readonly number[];
  /** Balancing current per cell, A (> 0 bleeds / gives, < 0 receives). */
  balancingA: readonly number[];
  /** Cell that ended the run (−1 = none): its glass flashes red. */
  stopCell: number;
  /** Index of the weaker cell (smaller capacity), −1 = none: marked amber. */
  weakCell: number;
  contactorClosed: boolean;
}

export interface BmsRig {
  group: Group;
  /** The 16 level glasses (pick / drag targets), left → right. */
  glasses: Mesh[];
  board: Group;
  /** Anchors on the board. */
  shunt: Group;
  contactor: Group;
  precharge: Group;
  /** Pack terminals (cable ends), in the rig's space. */
  plus: Vector3;
  canPort: Vector3;
  cellX(i: number): number;
  apply(state: BmsRigState, t: number): void;
}

export function createBmsRig(mats: Mats): BmsRig {
  const g = group('bms-rig');
  const x = (i: number): number => (i - (BMS_CELLS - 1) / 2) * PITCH;
  /* --------------------------------------------------------------------------------------- cells */
  g.add(mesh(new RoundedBoxGeometry(BMS_CELLS * PITCH + 0.5, 0.12, 1.5, 3, 0.05), mats.dark, 0, 0.06, 0));
  const cells = new InstancedMesh(
    new RoundedBoxGeometry(PITCH * 0.86, CELL_H, 1.1, 2, 0.04),
    K.toon({ color: 'white', gloss: 0.5 }),
    BMS_CELLS,
  );
  const m4 = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  const p = new Vector3();
  const blue = col('sky').lerp(col('blue'), 0.35);
  for (let i = 0; i < BMS_CELLS; i++)
    cells.setMatrixAt(i, m4.compose(p.set(x(i), 0.12 + CELL_H / 2, 0), q, one));
  cells.castShadow = true;
  g.add(cells);
  // series links: + of one cell to − of the next, alternating front / back like a real string
  const b = new Builder('links');
  for (let i = 0; i < BMS_CELLS; i++) {
    const front = i % 2 === 0 ? 0.32 : -0.32;
    b.cyl(0.05, 0.05, { at: [x(i), 0.12 + CELL_H, front], seg: 10, slot: 'metal', c: SEMANTIC.dcPlus });
    b.cyl(0.05, 0.05, { at: [x(i), 0.12 + CELL_H, -front], seg: 10, slot: 'metal', c: SEMANTIC.dcMinus });
    if (i + 1 < BMS_CELLS)
      b.box(PITCH * 1.2, 0.03, 0.14, {
        at: [x(i) + PITCH / 2, 0.12 + CELL_H + 0.05, front],
        r: 0,
        slot: 'metal',
        c: 'orange',
      });
    // sense wire from the cell to the board's connector row
    b.rod([x(i), 0.12 + CELL_H + 0.06, -0.1], [x(i) * 0.42, 2.02, -1.02], 0.012, { seg: 5, c: 'slate' });
  }
  g.add(b.build().group);

  /* -------------------------------------------------------------------------------------- glasses */
  const glassGeometry = new CylinderGeometry(0.115, 0.115, GLASS_H, 18, 1, true);
  const glasses = Array.from({ length: BMS_CELLS }, (_, i) => {
    const glass = new Mesh(glassGeometry, mats.glass);
    glass.position.set(x(i), 0.12 + CELL_H + 0.2 + GLASS_H / 2, 0.36);
    glass.renderOrder = 4;
    g.add(glass);
    return glass;
  });
  const levelGeometry = new CylinderGeometry(0.085, 0.085, 1, 14);
  levelGeometry.translate(0, 0.5, 0);
  const levels = new InstancedMesh(
    levelGeometry,
    K.glow({ color: 'white', intensity: 1.45, keepHue: true, whiten: 0.08, falloff: 0 }),
    BMS_CELLS,
  );
  levels.frustumCulled = false;
  g.add(levels);

  /* ---------------------------------------------------------------------------------------- board */
  const board = group('bms-board', 0, 2.0, -1.2);
  board.rotation.x = -0.32;
  const pcb = new Builder('pcb');
  pcb.box(3.3, 1.5, 0.07, { at: [0, 0, 0], r: 0.04, slot: 'gloss', c: ['teal.dark', 'teal'] });
  pcb.box(0.56, 0.56, 0.08, { at: [-0.25, 0.62, 0.07], r: 0.03, c: 'ink' }); // the controller — the "brain"
  for (let k = 0; k < 6; k++)
    for (const sx of [-1, 1])
      pcb.box(0.06, 0.04, 0.03, {
        at: [-0.25 + sx * 0.31, 0.68 + k * 0.08, 0.05],
        r: 0,
        slot: 'metal',
        c: 'mist',
      });
  for (let k = 0; k < 3; k++)
    pcb.box(0.22, 0.3, 0.1, { at: [0.5 + k * 0.28, 0.66, 0.07], r: 0.02, c: 'slate' }); // MOSFETs
  pcb.sphere(0.04, { at: [-1.5, 1.36, 0.06], seg: 10, slot: 'glow', c: 'lime' });
  board.add(pcb.build().group);
  const shunt = group('shunt', -1.15, 0.82, 0.08);
  shunt.add(
    mesh(new RoundedBoxGeometry(0.5, 0.16, 0.08, 2, 0.02), mats.steel),
    mesh(new BoxGeometry(0.1, 0.22, 0.1), mats.copper, -0.26, 0, 0),
    mesh(new BoxGeometry(0.1, 0.22, 0.1), mats.copper, 0.26, 0, 0),
  );
  const contactor = group('contactor', 1.25, 1.02, 0.1);
  contactor.add(mesh(new RoundedBoxGeometry(0.46, 0.5, 0.26, 3, 0.05), mats.light));
  const arm = mesh(new RoundedBoxGeometry(0.3, 0.05, 0.08, 2, 0.02), mats.copper, 0, 0.3, 0.06);
  contactor.add(arm);
  const precharge = group('precharge', 0.72, 1.24, 0.1);
  const res = mesh(new CylinderGeometry(0.06, 0.06, 0.4, 14), K.toon({ color: 'amber', gloss: 0.4 }));
  res.rotation.z = Math.PI / 2;
  precharge.add(res);
  board.add(shunt, contactor, precharge);
  // sixteen balancing resistors along the lower edge
  const bleed = new InstancedMesh(
    new RoundedBoxGeometry(0.11, 0.2, 0.07, 1, 0.02),
    K.glow({ color: 'white', intensity: 1.6, keepHue: true, whiten: 0, falloff: 0 }),
    BMS_CELLS,
  );
  for (let i = 0; i < BMS_CELLS; i++) bleed.setMatrixAt(i, m4.compose(p.set(x(i) * 0.5, 0.22, 0.07), q, one));
  board.add(bleed);
  g.add(board);

  /* ---------------------------------------------------------------------------------------- apply */
  const lime = col('lime');
  const red = col('red');
  const amber = col('amber');
  const orange = col('orange');
  const off = col('slate').multiplyScalar(0.6);
  const give = col('sky');
  const c = new Color();
  const s = new Vector3();
  return {
    group: g,
    glasses,
    board,
    shunt,
    contactor,
    precharge,
    plus: new Vector3(x(BMS_CELLS - 1) + 0.3, 0.12 + CELL_H, 0),
    canPort: new Vector3(1.72, 2.5, -1.35),
    cellX: x,
    apply(state, t) {
      for (let i = 0; i < BMS_CELLS; i++) {
        // level = SOC; the cell that tripped the BMS flashes red, the weak cell is marked amber
        const soc = Math.min(Math.max(state.socPct[i]! / 100, 0), 1.04);
        levels.setMatrixAt(
          i,
          m4.compose(p.set(x(i), 0.12 + CELL_H + 0.2, 0.36), q, s.set(1, Math.max(soc * GLASS_H, 0.01), 1)),
        );
        const flash = i === state.stopCell ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
        levels.setColorAt(i, c.copy(lime).lerp(red, flash));
        cells.setColorAt(i, c.copy(blue).lerp(amber, i === state.weakCell ? 0.55 : 0));
        // balancing: passive bleeding glows orange (heat); active transfer marks giver orange and receiver sky
        const bal = state.balancingA[i]!;
        bleed.setColorAt(
          i,
          bal > 0 ? c.copy(orange).multiplyScalar(0.8 + 0.2 * Math.sin(t * 5 + i)) : bal < 0 ? give : off,
        );
      }
      levels.instanceMatrix.needsUpdate = true;
      for (const m of [levels, cells, bleed]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
      // contactor: the copper bridge drops onto the contacts when closed
      arm.position.y += ((state.contactorClosed ? 0.2 : 0.32) - arm.position.y) * 0.3;
    },
  };
}
