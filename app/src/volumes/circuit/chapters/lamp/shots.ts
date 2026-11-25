/**
 * The chapter's own shots beside the stage's (`stand`, …), the lamp's (`lampInside`, `lampCoil`, …) and the
 * battery's (`battery`, …). World coordinates; the stand is mounted at the origin.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import {
  BATTERY,
  LAMP,
  LAMP_SHOTS,
  SWITCH,
  STAGE_FOV,
  STAGE_SHOTS,
  boardToWorld,
  lampLensPose,
  type LensPose,
} from '@circuit/shared/stage';

type V = [number, number, number];
const v3 = (v: Vector3): V => [v.x, v.y, v.z];
const at = (s: Shot): Vector3 => new Vector3(...(s.position as V));
const aim = (s: Shot): Vector3 => new Vector3(...(s.target as V));

/** `lampInside`'s line of sight, from the lamp toward its camera (unit). */
const insideDir = at(LAMP_SHOTS.lampInside).sub(aim(LAMP_SHOTS.lampInside)).normalize();
const insideAim = aim(LAMP_SHOTS.lampInside);

/**
 * `inside`, the door: the lamp with the magnifier laid on its glass, seen along `lampInside`'s line from farther
 * back — the stop between the stand plan and the lamp close up, so the push-in is one straight move.
 */
const door: Shot = {
  position: v3(insideAim.clone().addScaledVector(insideDir, 6.6)),
  target: v3(insideAim.clone().add(new Vector3(0, 0.12, 0))),
  fov: 30,
  // the rail's own framing at this distance (6.6 × 0.24): the lens leg ends on exactly this frame
  fit: { center: v3(insideAim.clone().add(new Vector3(0, 0.12, 0))), radius: 6.6 * 0.24 },
};

/**
 * `inside` down there: the whole lamp from the opened base to the crown, as large as the frame allows — the coil's
 * turns must read and the bottom contact must show in the opened wedge. The aim sits a little below the lamp's
 * middle so the base, where the reader's hand works, stands clear above the focus ring pinned at the bottom of the
 * screen (F-ring-dock).
 */
const wholeAim = insideAim.clone().add(new Vector3(0, -0.12, 0));
const whole: Shot = {
  position: v3(wholeAim.clone().addScaledVector(insideDir, 3.05)),
  target: v3(wholeAim),
  fov: 34,
  near: 0.05,
  fit: { center: v3(wholeAim), radius: 0.96 },
};

/** The magnifier on the lamp's glass, facing the door's camera (board frame). */
export const GLASS_POSE: LensPose = lampLensPose(1.7, door.position as V, 1.18);

/** `energy`: the battery's section and the switch beside it, the lamp's light on the board in the corner. */
const energyAim = boardToWorld((BATTERY.minusX + SWITCH.outX) / 2, 0.42, BATTERY.z - 0.1);
const energyView = new Vector3(-0.08, 0.78, 0.62).normalize();
const energy: Shot = {
  position: v3(energyAim.clone().addScaledVector(energyView, 7.2)),
  target: v3(energyAim),
  fov: STAGE_FOV,
  // the battery and the switch fill a phone's scene strip; on a desk the reframing keeps the wider view
  fit: { center: v3(energyAim), radius: 1.85 },
};

/** `handover`: the stand plan from a little higher (VISUAL §5.4): both wires read as two lines to the lamp. */
const standHigh: Shot = {
  ...STAGE_SHOTS.stand,
  position: [0, 8.95, 7.95],
};

/** `hot-spot`: the stand plan framed on the loop itself — on a phone the lens's whole way fills the scene strip. */
const standTight: Shot = {
  ...STAGE_SHOTS.stand,
  fit: { center: [0.1, 1.15, -0.05], radius: 3.05 },
};

/** `glow`: `lampCoil`, framed for a phone with room under the coil for the temperature read-out. */
const coilAim = aim(LAMP_SHOTS.lampCoil);
const glowCoil: Shot = {
  ...LAMP_SHOTS.lampCoil,
  fit: { center: v3(coilAim.clone().add(new Vector3(0, -0.16, 0))), radius: 0.4 },
};

/** The lamp's globe centre (world): callouts and probes. */
export const GLOBE = boardToWorld(LAMP.x, LAMP.filamentY, LAMP.z);

export const LAMP_CHAPTER_SHOTS = {
  lampDoor: door,
  lampWhole: whole,
  standHigh,
  standTight,
  glowCoil,
  energy,
} satisfies Record<string, Shot>;
