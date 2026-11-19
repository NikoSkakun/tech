/**
 * Camera shots of the table floor and the hand-over pose of the dive (docs/requests/W1-circuit-stage.md §1,
 * README.md). World coordinates; the stage group is mounted at the world origin.
 */
import { Vector3 } from 'three';
import type { Shot } from '@/engine/api';
import { BOARD, LAMP, LENS, LOOP, WIRE } from './layout';
import { BOARD_Y } from './base';

const COS = Math.cos(BOARD.tilt);
const SIN = Math.sin(BOARD.tilt);

/** Board frame → world (the stage group at the origin). */
export function boardToWorld(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  return out.set(x, BOARD_Y + y * COS - z * SIN, y * SIN + z * COS);
}

const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

/** Vertical field of view of the 3 : 2 safe frame used by every shot of the table floor. */
export const STAGE_FOV = 27;

/**
 * The hand-over pose «жила дроту»: the camera looks across the near wire (wire axis = world +x, horizontal in
 * the frame) and the copper core fills the safe frame from top to bottom.
 */
export const HANDOVER = (() => {
  const spot = boardToWorld(LENS.wireSpot.x, LOOP.y, LENS.wireSpot.z);
  // perpendicular to the wire, 41.3° below the horizon — close to the main shot's direction, so the flight
  // through the ring is one straight push-in
  const direction = new Vector3(0, -0.66, -0.7513).normalize();
  // frame height at the axis = core diameter  ⇒  distance = core radius / tan(fov / 2)
  const distance = WIRE.core / Math.tan((STAGE_FOV * Math.PI) / 360);
  const position = spot.clone().addScaledVector(direction, -distance);
  return { spot, direction, distance, position, fov: STAGE_FOV } as const;
})();

/** Where the magnifier hangs when it is "in use" over the near wire: on the dive axis, facing the camera. */
export const LENS_OVER_WIRE = HANDOVER.spot.clone().addScaledVector(HANDOVER.direction, -2.2);

const standTarget: [number, number, number] = [0, 1.5, -0.1];
const lampWorld = boardToWorld(LAMP.x, LAMP.filamentY, LAMP.z);

/**
 * Depth of field for the two kinds of shot (use as a step's `post`; `mountStage` installs `stand` as the
 * chapter base): on the main shot the whole stand is sharp and the table's far arc and the room go
 * soft; on the lamp close-up only the lamp is sharp.
 */
export const STAGE_POST = {
  stand: { dofAperture: 1.5, dofRange: 2.7, dofMaxBlur: 9 },
  lamp: { dofAperture: 2.2, dofRange: 0.9, dofMaxBlur: 12 },
} as const;

export const STAGE_SHOTS = {
  /** The main shot «Стенд»: from the front and above, 52° to the board; every chapter starts and ends here. */
  stand: {
    position: [0, 8.05, 8.6],
    target: standTarget,
    fov: STAGE_FOV,
    fit: { center: [0, 1.35, 0], radius: 3.75 },
    orbit: { azimuth: 0.5, polar: 0.22, zoom: [0.8, 1.35] },
  },
  /** The flashlight in the dark (`prologue/click`): lower and closer, the beam runs across the frame. */
  flashlight: {
    position: [-0.6, 5.2, 8.6],
    target: [0.2, 1.45, 0.1],
    fov: STAGE_FOV,
    fit: { center: [0, 1.4, 0], radius: 3.4 },
    orbit: { azimuth: 0.5, polar: 0.2, zoom: [0.8, 1.3] },
  },
  /**
   * The crawl (`prologue/riddle`, `flow/snail`): the whole run of wire from the minus clamp round the left side
   * to the lamp, the lamp itself, the snail beside the wire and the magnifier on the wire's start with its handle
   * inside the frame; phones re-frame from `fit` (the whole stand with the lens above a half-height sheet).
   */
  crawl: {
    position: [-0.98, 8.48, 8.48],
    target: [-0.82, 1.26, -0.45],
    fov: STAGE_FOV,
    fit: { center: v3(boardToWorld(-0.4, 0.6, -0.15)), radius: 3.5 },
    orbit: { azimuth: 0.3, polar: 0.15, zoom: [0.85, 1.25] },
  },
  /** The lamp close up (chapter 6 starts its dive here). */
  lamp: {
    position: v3(lampWorld.clone().add(new Vector3(-1.8, 1.45, 4.0))),
    target: v3(lampWorld.clone().add(new Vector3(0, -0.22, 0))),
    fov: STAGE_FOV,
    fit: { center: v3(lampWorld), radius: 1.3 },
  },
  /** The magnifier in use over the near wire: the ring is 22–26 % of the frame height. */
  lens: {
    position: v3(HANDOVER.spot.clone().addScaledVector(HANDOVER.direction, -6.2)),
    target: v3(HANDOVER.spot),
    fov: STAGE_FOV,
    fit: { center: v3(LENS_OVER_WIRE), radius: 1.5 },
  },
  /** The hand-over pose (see `HANDOVER`). No orbit, no idle drift: the next floor continues this very frame. */
  handover: {
    position: v3(HANDOVER.position),
    target: v3(HANDOVER.spot),
    fov: STAGE_FOV,
    near: 0.01,
    far: 60,
    drift: 0,
    orbit: { enabled: false },
  },
} satisfies Record<string, Shot>;
