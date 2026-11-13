/**
 * Step 4 diagram: the blade slice (parts/blade-section.ts) in the flow (parts/flow-lines.ts) with the
 * velocity triangle and the forces on it, on a dark hologram plate.
 *
 * It is the view along the blade, drawn the way a wing is drawn: the plane of rotation lies horizontal, the
 * blade moves to the left, the wind comes from below — so the apparent wind streams in from the left and the
 * lift points up. (`view` is the physical frame — X = wind direction, Y = direction the blade moves — turned a
 * quarter turn; all vectors are built in that frame.) Angles and coefficients come from the simulation
 * (M3: `bladeSection`, `airfoil`); this file only draws them.
 *
 *   relative wind  w = (v_a, −ω·r)          inflow angle φ from the rotor plane
 *   chord (LE→TE)  c = (sin θ, −cos θ)      θ = φ − α  (setting angle: pitch + twist)
 *   lift ⊥ w toward the suction side, drag ∥ w — both drawn to one scale (length ∝ coefficient).
 */
import { Group, Vector3 } from 'three';
import { createVectorArrow, type VectorArrow } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { SEMANTIC, type ColorLike } from '@/style';
import { buildBladeSection } from './blade-section';
import { buildFlowLines, type FlowLines } from './flow-lines';
import { CHORD } from './section';

export interface AirfoilState {
  /** Angle of attack α and inflow angle φ, degrees. */
  alphaDeg: number;
  phiDeg: number;
  cl: number;
  cd: number;
  /** Share of the attached-flow lift that is left (1 below the stall). */
  liftShare: number;
  /** Speeds as multiples of the wind speed v: axial v_a and tangential ω·r. */
  axialRel: number;
  tangentialRel: number;
}

export interface Airfoil {
  /** Holder (hologram plate, upright); add the twist row here. */
  group: Group;
  /** Rotating frame of the section (chord along its +X). */
  foil: Group;
  section: KitModel;
  /** Hologram plate; anchor `plane` = right end of the plane-of-rotation line. */
  plate: KitModel;
  arrows: Record<'v' | 'omega' | 'rel' | 'lift' | 'drag' | 'drive', VectorArrow>;
  flow: FlowLines;
  /** Point above the suction side where the flow separates (section frame, toy metres) — callout anchor. */
  readonly stallPoint: Vector3;
  set(s: AirfoilState): void;
  update(dt: number): void;
}

/** Arrow lengths: toy metres per unit of v, and per unit of force coefficient. */
const V_SCALE = 1;
const F_SCALE = 4.6;
/** Shortest arrow that still reads as an arrow (a drag of C_D ≈ 0.01 would be 5 cm long). */
const STUB = 0.55;
/** The hologram plate (holder frame, toy metres): centre and size; it also carries the twist row. */
export const PLATE = { x: 1.8, y: -3.4, w: 27.5, h: 27.6, z: -7.4 } as const;

export function buildAirfoil(): Airfoil {
  const group = new Group();
  group.name = 'airfoil-diagram';
  // the white streamlines need something darker than the day sky behind them
  const pb = new Builder('flow-plate');
  pb.box(PLATE.w, PLATE.h, 0.3, { r: 1.5, slot: 'flat', c: 'bg.indigo', at: [PLATE.x, PLATE.y - PLATE.h / 2, PLATE.z] });
  const hw = PLATE.w / 2 - 0.5;
  const hh = PLATE.h / 2 - 0.5;
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => new Vector3(PLATE.x + x!, PLATE.y + y!, PLATE.z + 0.25));
  pb.tube([...corners, corners[0]!], 0.07, { seg: 5, closed: true, slot: 'glow', c: 'sky' });
  // the plane of rotation through the pitch axis: the line every angle of the diagram is measured from
  pb.rod([-10.5, 0, PLATE.z + 0.3], [14, 0, PLATE.z + 0.3], 0.035, { seg: 5, slot: 'glow', c: 'slate' });
  pb.anchor('plane', 12.6, 0, PLATE.z + 0.3);
  const plate = pb.build();
  group.add(plate.group);

  const view = new Group();
  view.rotation.z = Math.PI / 2;
  group.add(view);
  const foil = new Group();
  view.add(foil);
  const section = buildBladeSection();
  foil.add(section.group);
  const flow = buildFlowLines();
  flow.group.position.z = 0.32; // in the plane of the cut, just in front of its face
  foil.add(flow.group);

  const arrow = (color: ColorLike, radius = 0.13): VectorArrow =>
    createVectorArrow({ color, radius, headLength: radius * 6.5, headRadius: radius * 2.7, intensity: 1.3 });
  const arrows = {
    v: arrow('sky'),
    omega: arrow('mist'),
    rel: arrow('white', 0.16),
    lift: arrow(SEMANTIC.ok, 0.2),
    drag: arrow(SEMANTIC.alarm, 0.2),
    drive: arrow(SEMANTIC.current, 0.2),
  };
  view.add(...Object.values(arrows));
  const o = new Vector3();
  const d = new Vector3();
  const stallPoint = new Vector3();
  const rad = Math.PI / 180;
  return {
    group,
    foil,
    section,
    plate,
    arrows,
    flow,
    stallPoint,
    set(s) {
      const phi = s.phiDeg * rad;
      const theta = (s.phiDeg - s.alphaDeg) * rad;
      foil.rotation.z = theta - Math.PI / 2;
      // velocity triangle, tail to head, drawn upwind of the leading edge: v_a then −ω·r, and their sum
      const va = s.axialRel * V_SCALE;
      const wr = s.tangentialRel * V_SCALE;
      const start = o.set(-CHORD * 0.62 - va, CHORD * 0.36 + wr, 0.6);
      arrows.v.set(start, d.set(va, 0, 0));
      arrows.omega.set(start.clone().add(d), new Vector3(0, -wr, 0));
      arrows.rel.set(start, new Vector3(va, -wr, 0));
      // forces at the aerodynamic centre (quarter chord): lift ⊥ w, drag ∥ w, and what is left to turn the rotor
      const w = new Vector3(Math.sin(phi), -Math.cos(phi), 0);
      const n = new Vector3(Math.cos(phi), Math.sin(phi), 0);
      const centre = new Vector3(-0.05 * CHORD * Math.sin(theta), 0.05 * CHORD * Math.cos(theta), 0.7);
      arrows.lift.set(centre, n.clone().multiplyScalar(Math.sign(s.cl || 1) * Math.max(STUB, Math.abs(s.cl) * F_SCALE)));
      arrows.drag.set(centre, w.clone().multiplyScalar(Math.max(STUB, s.cd * F_SCALE)));
      // the share of lift and drag along the direction of motion (+Y of the frame): this is what turns the rotor
      const drive = s.cl * Math.sin(phi) - s.cd * Math.cos(phi);
      const pull = drive * F_SCALE * 2.2;
      arrows.drive.set(centre.clone().add(new Vector3(-1.3, 0, 0.1)), new Vector3(0, Math.sign(pull || 1) * Math.max(STUB, Math.min(4.5, Math.abs(pull))), 0));
      flow.shape(s.alphaDeg, s.liftShare);
      const at = Math.min(0.9, flow.attached + 0.25);
      stallPoint.set((at - 0.3) * CHORD, 0.2 * CHORD, 0.4);
    },
    update: (dt) => flow.update(dt),
  };
}
