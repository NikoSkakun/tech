/**
 * Step 1 hero: a galvanic (Daniell-type) cell — glass beaker split by a porous divider, two metal rods, an
 * outer wire with a lamp. Electrons (`cyan`) run through the wire from the anode (−, left) to the cathode
 * (+, right); inside, cations leave the anode, cations plate the cathode and anions cross the divider.
 * Everything scales with the EMF of the chosen pair; charging reverses every direction.
 */
import {
  CapsuleGeometry,
  CylinderGeometry,
  type Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { damp, type ChapterContext } from '@/engine/api';
import { createBubbles, createFlow, createHalo, curveThrough, type Flow } from '@/fx';
import { K, SEMANTIC, col, type ColorLike } from '@/style';
import type { Mats } from '../world';
import { group, mesh } from '../world';

export interface DaniellLook {
  /** Rod colour and the colour of its ions in solution. */
  anode: { rod: ColorLike; ion: ColorLike; reactive: boolean };
  cathode: { rod: ColorLike; ion: ColorLike; reactive: boolean };
  /** EMF, V (drives speeds and the lamp). */
  emfV: number;
}

export interface DaniellCell {
  group: Group;
  anodeRod: Mesh;
  cathodeRod: Mesh;
  lamp: Group;
  minusKnob: Mesh;
  plusKnob: Mesh;
  divider: Mesh;
  beaker: Mesh;
  set(look: DaniellLook, instant?: boolean): void;
  /** true = an outer source pushes the electrons backwards. */
  charging: boolean;
  update(dt: number, t: number): void;
}

const ROD_X = 0.62;
const LIQUID_TOP = 1.36;

export function createDaniellCell(ctx: ChapterContext, mats: Mats): DaniellCell {
  const g = group('daniell');
  /* ------------------------------------------------------------------------------- glass and liquids */
  const beaker = new Mesh(new CylinderGeometry(1.3, 1.3, 1.75, 64, 1, true), mats.glass);
  beaker.position.y = 0.9;
  beaker.renderOrder = 4;
  const rim = mesh(new TorusGeometry(1.3, 0.035, 10, 96), mats.light, 0, 1.775, 0, false);
  rim.rotation.x = Math.PI / 2;
  const base = mesh(new CylinderGeometry(1.34, 1.38, 0.08, 64), mats.light, 0, 0.04, 0);
  const liquid = (side: -1 | 1) => {
    const m = K.glass({ color: 'sky', opacity: 0.34, edgeOpacity: 0.5 });
    // half cylinder on one side of the divider (x = sin θ · r): θ ∈ (0, π) is x > 0
    const half = new Mesh(
      new CylinderGeometry(1.22, 1.22, LIQUID_TOP - 0.1, 48, 1, false, side > 0 ? 0 : Math.PI, Math.PI),
      m,
    );
    half.position.y = 0.1 + (LIQUID_TOP - 0.1) / 2;
    half.renderOrder = 2;
    return half;
  };
  const liquidA = liquid(-1);
  const liquidC = liquid(1);
  const divider = mesh(new RoundedBoxGeometry(0.07, 1.55, 2.42, 2, 0.03), mats.white, 0, 0.86, 0, false);
  const pores = new InstancedMesh(new SphereGeometry(0.035, 10, 8), mats.dark, 2 * 5 * 7);
  const m4 = new Matrix4();
  let n = 0;
  for (const sx of [-1, 1])
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 7; j++)
        pores.setMatrixAt(
          n++,
          m4.makeTranslation(sx * 0.036, 0.3 + i * 0.26, -0.9 + j * 0.3 + (i % 2) * 0.15),
        );
  g.add(base, liquidA, liquidC, divider, pores, beaker, rim);

  /* ----------------------------------------------------------------------------------- electrodes */
  const rodGeometry = new CapsuleGeometry(0.16, 1.55, 8, 32);
  const anodeMat = K.metal({ color: 'slate', specular: 0.6 });
  const cathodeMat = K.metal({ color: 'orange', specular: 0.8 });
  const anodeRod = mesh(rodGeometry, anodeMat, -ROD_X, 1.25, 0);
  const cathodeRod = mesh(rodGeometry, cathodeMat, ROD_X, 1.25, 0);
  const bar = mesh(new RoundedBoxGeometry(2.3, 0.1, 0.24, 3, 0.04), mats.dark, 0, 1.93, 0);
  const knob = new SphereGeometry(0.11, 20, 14);
  // DC pole code: − blue on the anode, + coral on the cathode
  const minusKnob = mesh(knob, mats.minus, -ROD_X, 2.25, 0);
  const plusKnob = mesh(knob, mats.plus, ROD_X, 2.25, 0);
  g.add(anodeRod, cathodeRod, bar, minusKnob, plusKnob);

  /* -------------------------------------------------------------------- outer circuit: wire and lamp */
  const wirePts = [
    new Vector3(-ROD_X, 2.3, 0),
    new Vector3(-ROD_X - 0.05, 2.95, 0),
    new Vector3(-0.3, 3.38, 0),
    new Vector3(0.3, 3.38, 0),
    new Vector3(ROD_X + 0.05, 2.95, 0),
    new Vector3(ROD_X, 2.3, 0),
  ];
  const wire = new Mesh(
    new TubeGeometry(curveThrough(wirePts), 96, 0.075, 14, false),
    K.glass({ color: 'orange', opacity: 0.16, edgeOpacity: 0.6 }),
  );
  wire.renderOrder = 3;
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: wirePts,
    count: 22,
    radius: 0.052,
    speed: 0.6,
    endFade: 0.04,
  });
  const lamp = group('lamp', 0, 3.4, 0);
  const bulbMat = K.glow({ color: SEMANTIC.photon, intensity: 0.6, whiten: 0.5 });
  const halo = createHalo({ color: 'yellow', size: 1.5, intensity: 0 });
  lamp.add(mesh(new SphereGeometry(0.2, 28, 20), bulbMat, 0, 0.2, 0, false), halo);
  lamp.add(mesh(new CylinderGeometry(0.11, 0.13, 0.16, 20), mats.steel, 0, 0, 0));
  halo.position.y = 0.2;
  g.add(wire, electrons, lamp);

  /* ------------------------------------------------------------------------------ ions in solution */
  const lanes = (x0: number, x1: number): Vector3[][] =>
    [0.42, 0.74, 1.06].flatMap((y, i) =>
      [-0.42, 0.42].map((z, j) => [
        new Vector3(x0, y + j * 0.12, z * (1 - i * 0.2)),
        new Vector3((x0 + x1) / 2, y + 0.1 - j * 0.16, z * 1.25),
        new Vector3(x1, y + 0.04, z * (0.7 + i * 0.2)),
      ]),
    );
  const ionFlow = (paths: Vector3[][], color: ColorLike, glyph: 'plus' | 'minus', count: number): Flow =>
    createFlow(ctx, {
      kind: 'ion',
      color,
      glyph,
      paths: paths.map((path) => ({ path })),
      count,
      exactCount: true,
      radius: 0.075,
      spread: 0.05,
      wobble: 0.025,
      speed: 0.3,
      endFade: 0.22,
      halo: false,
    });
  const leaving = ionFlow(lanes(-ROD_X + 0.2, -0.12), 'steel', 'plus', 12); // cations born at the anode
  const plating = ionFlow(lanes(0.12, ROD_X - 0.2), 'orange', 'plus', 12); // cations landing on the cathode
  const crossing = ionFlow(lanes(0.5, -0.5), 'mist', 'minus', 8); // anions through the porous divider
  const bubbles = ([-1, 1] as const).map((side) => {
    const b = createBubbles(ctx, {
      size: [0.5, 1.1, 1.2],
      count: ctx.quality.count(26, 8),
      radius: 0.045,
      rise: 0.7,
    });
    b.position.set(side * ROD_X, 0.75, 0);
    b.rate = 0;
    return b;
  });
  g.add(leaving, plating, crossing, ...bubbles);

  /* ---------------------------------------------------------------------------------------- state */
  const state = { emf: 1.1, drive: 1, lamp: 0.5 };
  const paint = (target: { r: number; g: number; b: number }, to: ColorLike, instant: boolean): void => {
    const c = col(to);
    if (instant) Object.assign(target, { r: c.r, g: c.g, b: c.b });
    else ctx.tweens.to(target, { r: c.r, g: c.g, b: c.b }, { duration: 0.5, ease: 'power2.out' });
  };
  const cell: DaniellCell = {
    group: g,
    anodeRod,
    cathodeRod,
    lamp,
    minusKnob,
    plusKnob,
    divider,
    beaker,
    charging: false,
    set(look, instant = false) {
      state.emf = look.emfV;
      paint(anodeMat.color, look.anode.rod, instant);
      paint(cathodeMat.color, look.cathode.rod, instant);
      // the solution takes a pale tint of the dissolved ions (copper sulphate blue, etc.)
      paint(liquidA.material.color, col('sky').lerp(col(look.anode.ion), 0.35), instant);
      paint(liquidC.material.color, col('sky').lerp(col(look.cathode.ion), 0.5), instant);
      leaving.setColor(look.anode.ion);
      plating.setColor(look.cathode.ion);
      bubbles[0]!.rate = look.anode.reactive ? 1 : 0;
      bubbles[1]!.rate = look.cathode.reactive ? 1 : 0;
    },
    update(dt) {
      // flow speeds ∝ EMF (toy scale: 1 V ≈ 0.55 units/s for electrons); charging reverses every stream
      state.drive = damp(state.drive, cell.charging ? -1 : 1, 5, dt);
      const k = Math.min(Math.max(state.emf, 0.08), 4.6) * state.drive;
      electrons.speed = 0.55 * k;
      leaving.speed = 0.14 * k;
      plating.speed = 0.14 * k;
      crossing.speed = 0.1 * k;
      // the lamp shines with the power it gets (∝ ℰ² into a fixed filament); off while an outer source charges
      const power = cell.charging ? 0.05 : Math.min((state.emf / 2.2) ** 2, 1.6);
      state.lamp = damp(state.lamp, power, 6, dt);
      bulbMat.intensity = 0.45 + 2.3 * state.lamp;
      halo.intensity = 0.9 * state.lamp;
    },
  };
  return cell;
}
