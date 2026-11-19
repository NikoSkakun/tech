/**
 * The chapter's own camera shot and magnifier poses (world for shots, board frame for the lens, as everywhere in
 * the stage). `poles`: the battery from the stand's own direction, closer — both ends and the lens over either of
 * them in one frame, so moving the lens from «−» to «+» needs no camera move.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import {
  BATTERY,
  BATTERY_SHOTS,
  GAUGE_HOME,
  STAGE_FOV,
  STAGE_SHOTS,
  boardToWorld,
  worldDirToBoard,
  worldToBoard,
  type LensPose,
} from '@circuit/shared/stage';

type Vec = [number, number, number];
const v3 = (v: Vector3): Vec => [v.x, v.y, v.z];

/** The stand shot's view direction (world, from the target toward the camera). */
const STAND_VIEW = new Vector3(...STAGE_SHOTS.stand.position)
  .sub(new Vector3(...STAGE_SHOTS.stand.target))
  .normalize();
/** A little steeper than the stand shot: the lens hangs above the battery without hiding the clamps. */
export const POLES_VIEW = STAND_VIEW.clone()
  .add(new Vector3(0, 0.12, 0))
  .normalize();
/** Centre of the battery's can (world). */
export const BATTERY_CENTRE = boardToWorld(BATTERY.x, BATTERY.y, BATTERY.z);
/** The two ends where the lens is laid (world): the minus cap's face and the plus nub. */
export const POLE_END = {
  minus: boardToWorld(BATTERY.x - BATTERY.length / 2 - 0.02, BATTERY.y, BATTERY.z),
  plus: boardToWorld(BATTERY.x + BATTERY.length / 2 + 0.09, BATTERY.y, BATTERY.z),
} as const;
export type PoleId = keyof typeof POLE_END;

/** Distance from the camera to the battery in the `poles` shot, and how far the lens hangs toward the camera. */
const POLES_DISTANCE = 6.6;
const LENS_LIFT = 1.15;

/** Between the battery and the meter on the table, a little toward the battery (world). */
const METER_LOOK = BATTERY_CENTRE.clone()
  .lerp(GAUGE_HOME.clone().setY(0.45), 0.45)
  .add(new Vector3(0.15, 0, 0));
/** A little steeper than the stand plan: the meter's face, leaning back, is seen nearly square. */
const METER_VIEW = STAND_VIEW.clone()
  .add(new Vector3(0, 0.18, 0))
  .normalize();

export const CHAPTER_SHOTS = {
  poles: {
    position: v3(BATTERY_CENTRE.clone().addScaledVector(POLES_VIEW, POLES_DISTANCE)),
    target: v3(BATTERY_CENTRE.clone().add(new Vector3(0.1, 0.55, -0.2))),
    fov: STAGE_FOV,
    fit: { center: v3(BATTERY_CENTRE.clone().add(new Vector3(0.05, 0.5, 0.35))), radius: 1.45 },
    orbit: { azimuth: 0.25, polar: 0.12, zoom: [0.85, 1.2] },
  },
  /**
   * The battery cut open (`inside`, `balance`): the stage's `battery` shot; on phones it is framed a little lower,
   * so the pole scale has room under the battery above the bottom sheet.
   */
  cut: {
    ...BATTERY_SHOTS.battery,
    fit: { center: v3(BATTERY_CENTRE.clone().add(new Vector3(0, -0.3, 0.15))), radius: 1.18 },
  },
  /**
   * The battery and the meter together (`voltage`): the battery with its «1.5 V» in the upper half, both clamps,
   * the meter large below and left of it on the table, the probes' way between them; the needle, the scale and the
   * number read at 1280×720. Phones frame the same two things.
   */
  meter: {
    position: v3(METER_LOOK.clone().addScaledVector(METER_VIEW, 6.1)),
    target: v3(METER_LOOK),
    fov: STAGE_FOV,
    fit: { center: v3(METER_LOOK), radius: 1.55 },
    orbit: { azimuth: 0.3, polar: 0.12, zoom: [0.85, 1.2] },
  },
} satisfies Record<string, Shot>;

/** The lens over one end of the battery: on the line to the `poles` camera, facing it, the handle down-right. */
export function poleLensPose(pole: PoleId): LensPose {
  const end = POLE_END[pole];
  const spot = end.clone().addScaledVector(POLES_VIEW, LENS_LIFT);
  const facing = worldDirToBoard(POLES_VIEW.clone());
  const handle = new Vector3(0.55, -0.55, 0.62);
  handle.addScaledVector(facing, -handle.dot(facing)).normalize();
  return { position: worldToBoard(spot), facing, handle, scale: 1 };
}
