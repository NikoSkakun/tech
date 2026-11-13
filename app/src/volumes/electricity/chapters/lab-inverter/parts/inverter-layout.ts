/**
 * Layout of the opened inverter «ЛІ-6» lying on the bench — one place for every position, so the model, the
 * energy wires, the callouts and the camera shots agree. Model space: origin = centre of the tray floor,
 * +X = "downstream" (PV on the left, AC terminals on the right), +Z toward the viewer, units ≈ 10 cm.
 *
 * Order of the stages is the real one (technical honesty): PV inputs → boost stage (MPPT) → DC link → H-bridge
 * on the heat sink → LC filter → relays → AC terminals; the 48 V battery port feeds the DC link through an
 * isolated DC/DC converter with a high-frequency transformer; the control board sits above the front-right.
 */
import { Vector3 } from 'three';

export const TRAY = { w: 6.7, d: 3.9, wall: 0.34, floor: 0.08 } as const;
/** Height of the "river" of busbars / energy wires above the tray origin. */
export const RIVER_Y = 0.17;

const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** Centres of the stages on the tray floor (y = 0) and a height for their callout / hotspot anchors. */
export const STAGE = {
  pvA: { at: v(-3.0, 0, -1.0), top: 0.35 },
  pvB: { at: v(-3.0, 0, -0.4), top: 0.35 },
  chokeA: { at: v(-2.2, 0, -1.0), top: 0.5 },
  chokeB: { at: v(-2.2, 0, -0.4), top: 0.5 },
  boost: { at: v(-1.52, 0, -0.7), top: 0.8 },
  link: { at: v(-0.62, 0, -0.62), top: 0.95 },
  bridge: { at: v(0.82, 0, -1.02), top: 1.0 },
  drivers: { at: v(0.82, 0, -0.62), top: 0.3 },
  filterL: { at: v(1.98, 0, -0.95), top: 0.75 },
  filterC: { at: v(2.62, 0, -1.25), top: 0.7 },
  relayGrid: { at: v(2.62, 0, -0.42), top: 0.6 },
  relayBackup: { at: v(2.62, 0, 0.12), top: 0.6 },
  ac: { at: v(3.02, 0, 0.72), top: 0.4 },
  bat: { at: v(-3.0, 0, 1.1), top: 0.4 },
  dcdc: { at: v(-2.1, 0, 1.1), top: 0.35 },
  transformer: { at: v(-1.15, 0, 1.1), top: 0.85 },
  rectifier: { at: v(-0.3, 0, 1.1), top: 0.7 },
  control: { at: v(1.25, 0.62, 1.0), top: 0.25 },
} as const;
export type StageName = keyof typeof STAGE;

/** X positions of the four bridge switches S1…S4 on the heat sink (the legs are S1/S2 and S3/S4). */
export const SWITCH_X = [0.22, 0.62, 1.02, 1.42] as const;
export const SWITCH_Z = -1.08;

const Y = RIVER_Y;
/**
 * Current paths (model space). `pvA` / `pvB` end in the DC link, `out` starts there and ends at the AC
 * terminals, `bat` runs battery → DC link (played backwards while charging), `backup` branches to the second
 * relay. Used by the energy wires and the «Рентген» view.
 */
export const PATHS = {
  pvA: [v(-3.75, Y + 0.1, -1.0), v(-3.0, Y, -1.0), v(-2.2, Y, -1.0), v(-1.52, Y, -0.95), v(-1.05, Y, -0.8)],
  pvB: [v(-3.75, Y + 0.1, -0.4), v(-3.0, Y, -0.4), v(-2.2, Y, -0.4), v(-1.52, Y, -0.45), v(-1.05, Y, -0.5)],
  link: [v(-1.05, Y, -0.65), v(-0.2, Y, -0.65), v(0.2, Y, -0.8)],
  out: [
    v(0.2, Y, -0.8),
    v(1.45, Y, -0.8),
    v(1.98, Y, -0.95),
    v(2.3, Y, -0.85),
    v(2.62, Y, -0.42),
    v(3.02, Y, 0.55),
    v(3.75, Y + 0.1, 0.55),
  ],
  backup: [v(2.62, Y, -0.42), v(2.62, Y, 0.12), v(3.02, Y, 0.9), v(3.75, Y + 0.1, 0.9)],
  bat: [
    v(-3.75, Y + 0.1, 1.1),
    v(-3.0, Y, 1.1),
    v(-2.1, Y, 1.1),
    v(-1.15, Y, 1.1),
    v(-0.3, Y, 1.1),
    v(-0.3, Y, 0.3),
    v(-0.62, Y, -0.1),
  ],
} as const;
export type PathName = keyof typeof PATHS;

/** Lift of the cover above the tray: closed / opened (hanging on its holographic cables). */
export const COVER_Y = { closed: 0.36, open: 3.25 } as const;
/** Opened, the cover also moves back (−Z) and tips its face toward the viewer (rotation about X, rad). */
export const COVER_BACK = -2.3;
export const COVER_TILT = 0.75;
