/**
 * The floor «жила дроту»: the copper core of the wire as the stand hands it over (docs: README «Hand-over») —
 * a horizontal cylinder seen at right angles, its diameter exactly the height of the 3 : 2 safe frame, the
 * sheath already gone. The dive scales it about the point of its surface the reader looks at, lets the lattice
 * show through (core-shader.ts) and dissolves it.
 */
import {
  Color,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { col, kGlobals } from '@/style';
import { CORE_FRAG, CORE_VERT } from './core-shader';
import { PITCH } from './layout';

/** Radius of the core at the hand-over, units: with the camera 19.7 away at fov 27° it fills the safe frame. */
export const CORE_R = 6.1;
/** Camera distance from the origin and field of view of every shot of the copper world. */
export const CAMERA_Z = 19.7;
export const CAMERA_FOV = 27;
/**
 * How strongly the metal's own surface (core-shader.ts `surface`: drawing lines, mottle) shows: ± this share of
 * its brightness. Without it the core was one flat orange from the end of the dissolve until the dots — the zoom
 * did not show at all (F-lens-wire, the owner's screenshot of 2026-11-25).
 */
const RELIEF = 0.4;

/**
 * The stand's exposed wire at the hand-over pose, as it reaches the screen (sRGB 0…255), in two lights, each
 * [lamp off, lamp on]:
 *  - `handed`: under the stand's own rig at the moment of the dissolve (`deep` 0.99 of the flight) — what the
 *    reader sees when the worlds are exchanged, and what the core is at depth 0. Since the stand's pass 4
 *    (2026-11-16) that is one even muted copper in both lamp states, a little brighter above with the lamp on;
 *  - `inside`: the same wire under the light of this floor (`copperEnv`), where the dive warms to.
 * Measured in the composed world on `_sandbox-circuit-copper-world` (`part-stand`, `part-stand-off`: the copper
 * world hidden); `qa/W2-circuit-copper/profile.sh` prints the stand's and the core's profiles side by side —
 * re-measure when the stand's wire or light changes.
 */
export const STAND_COPPER = {
  handed: {
    top: [
      [169, 75, 32],
      [222, 93, 36],
    ],
    lit: [
      [167, 74, 29],
      [200, 86, 34],
    ],
    mid: [
      [167, 74, 29],
      [177, 76, 31],
    ],
    shade: [
      [167, 74, 29],
      [171, 74, 30],
    ],
    glint: [
      [167, 74, 29],
      [243, 130, 80],
    ],
    rim: [
      [182, 84, 78],
      [222, 104, 112],
    ],
  },
  inside: {
    rim: [
      [200, 110, 76],
      [255, 158, 90],
    ],
    top: [
      [200, 110, 76],
      [255, 158, 90],
    ],
    lit: [
      [210, 104, 48],
      [254, 135, 47],
    ],
    mid: [
      [154, 70, 34],
      [188, 79, 32],
    ],
    shade: [
      [110, 42, 24],
      [130, 46, 22],
    ],
    glint: [
      [250, 190, 170],
      [255, 176, 118],
    ],
  },
} as const;

export interface Core {
  group: Group;
  /** How much the wire has grown since the hand-over (1 = hand-over size). */
  scale: number;
  /** z of the surface point the reader looks at. */
  surface: number;
  /** Stages of the metal turning into rows of atoms, each 0…1 (core-shader.ts): dots show in the metal; the
   *  metal becomes balls in the dark; the flat picture opens between the balls. */
  dots: number;
  balls: number;
  open: number;
  /** Scale of the lattice the dots must match. */
  latticeScale: number;
  /** 0…1 dissolve of the whole core (the composed world dissolves it over the stand's own wire); lamp 0…1. */
  fade: number;
  lamp: number;
  /** 0 = the wire as the stand hands it over … 1 = the same wire in the light of this floor (`STAND_COPPER`). */
  warmth: number;
  /** The camera in the frame of the copper world (set by `Copper.update` before `update`). */
  eye: Vector3;
  /** Call once per frame with the copper world's world matrix. */
  update(copperWorld: Matrix4): void;
}

export function createCore(): Core {
  const group = new Group();
  group.name = 'wire-core';
  const geometry = new CylinderGeometry(CORE_R, CORE_R, 600, 128, 1, true);
  geometry.rotateZ(Math.PI / 2); // along X: the wire runs left ↔ right
  // [handed over · lamp off, on; inside · lamp off, on], as linear colours
  const four = (part: keyof typeof STAND_COPPER.handed): Color[] =>
    [...STAND_COPPER.handed[part], ...STAND_COPPER.inside[part]].map(([r, g, b]) =>
      new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace),
    );
  const material = new ShaderMaterial({
    vertexShader: CORE_VERT,
    fragmentShader: CORE_FRAG,
    uniforms: {
      uTop: { value: four('top') },
      uLit: { value: four('lit') },
      uMid: { value: four('mid') },
      uShade: { value: four('shade') },
      uGlint: { value: four('glint') },
      uRim: { value: four('rim') },
      uWarmth: { value: 0 },
      uAtom: { value: col('coral') },
      uAtomShade: { value: col('coral.dark') },
      uDeep: { value: col('bg.deep').lerp(col('bg.indigo'), 0.35) },
      uWarm: { value: col('yellow.light').lerp(col('amber'), 0.25) },
      uCool: { value: col('sky') },
      uLamp: { value: 0 },
      uDots: { value: 0 },
      uBalls: { value: 0 },
      uOpen: { value: 0 },
      uPitch: { value: PITCH },
      uFade: { value: 1 },
      uRelief: { value: RELIEF },
      uRadius: { value: CORE_R },
      uEye: { value: new Vector3(0, 0, CAMERA_Z) },
      uToCopper: { value: new Matrix4() },
      uFromCopper: { value: new Matrix4() },
      uKTime: kGlobals.uKTime,
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'wire-core-metal';
  mesh.frustumCulled = false;
  group.add(mesh);
  const u = material.uniforms;
  const core: Core = {
    group,
    scale: 1,
    surface: 0.35,
    dots: 0,
    balls: 0,
    open: 0,
    latticeScale: 1,
    fade: 1,
    lamp: 0,
    warmth: 0,
    eye: u.uEye!.value as Vector3,
    update(copperWorld) {
      group.visible = core.fade > 0.004 && core.open < 0.999;
      if (!group.visible) return;
      // grow about the surface point on the line of sight: the axis sinks away behind it
      group.scale.setScalar(core.scale);
      group.position.set(0, 0, core.surface - CORE_R * core.scale);
      (u.uFromCopper!.value as Matrix4).copy(copperWorld);
      (u.uToCopper!.value as Matrix4).copy(copperWorld).invert();
      u.uDots!.value = core.dots;
      u.uBalls!.value = core.balls;
      u.uOpen!.value = core.open;
      u.uPitch!.value = PITCH * core.latticeScale;
      u.uFade!.value = core.fade;
      u.uRadius!.value = CORE_R * core.scale;
      u.uLamp!.value = core.lamp;
      u.uWarmth!.value = core.warmth;
    },
  };
  return core;
}
