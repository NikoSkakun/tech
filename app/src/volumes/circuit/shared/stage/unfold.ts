/**
 * The unfolding of the flashlight into the stand (VISUAL.md §5.1) as ONE pure function of `u` ∈ 0…1, so the
 * reader can drag it, stop it and lead it back (`build/flashlight` plays it backwards). Six beats over 6 s:
 *
 *   1  0.0–0.8   the housing splits lengthwise, the halves slide apart by their diameter
 *   2  0.8–2.1   the housing leaves the picture: the far half (mirror and glass nested in it) rises over the back
 *                and out of the top, the near half runs off low to the left; out of the frame they are gone
 *   3  1.45–2.45 the mounts grow out of the board in a wave from left to right (every 55 ms)
 *   4  1.65–4.45 THE LOOP OPENS, one move. In the torch the parts stand in a row — spring, battery, slider, lamp —
 *                with the minus strip along the near wall, where the reader sees it. It first swings under the
 *                battery to the far side (`SWING`); parts and strips are then the stand's loop squashed flat, and it
 *                opens (`OPEN`): the row comes toward the reader into the cradle and the clamps; the minus strip
 *                unrolls behind it to the left and far sides (`unfurl.ts`); the lamp goes out of the head and round
 *                to the far right corner, turning upright, and makes one turn as it comes down into the socket — at
 *                the height that keeps the minus wire level, so it lands with the battery; the lamp strip unrolls
 *                between slider and lamp; the slider rides forward along the battery's top, steps down in front of
 *                «+» and glides onto its block. The short plus piece (under the battery in the torch,
 *                `unfold-plus.ts`) rounds into a wire first and takes the short way round the battery's far side to
 *                the slider; from then on it simply follows the slider, getting shorter, and is a short lead from
 *                «+» to the slider as that steps down. No strip goes over a part (owner 2026-11-19). The long
 *                strips round into wires while they are drawn out (`ROUND`)
 *   5  4.3–5.6   the sheath grows from the clamps along the laid wires; then (4.85–5.6) each staple's arch closes
 *                round its wire, one after another (`ARCH`)
 *   6  5.0–6.0   rest (camera, magnifier — `beat6` 0…1 is exported for them)
 *
 * No contact ever opens: every strip end is computed from the part it touches, so the lamp never has a reason
 * to go out — its light is parented to the filament and travels with it.
 */
import { CatmullRomCurve3, CubicBezierCurve3, Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { BATTERY, BOARD, LAMP, LOOP, SHELF_WORLD, STAPLES, SWITCH } from './layout';
import { stapleArch } from './staple-arch';
import { BOARD_Y } from './base';
import { SLIDER_TRAVEL } from './small-parts';
import { PLACE, type Stand } from './stand';
import { MINUS_Y, TORCH, torchPath, type Torch, type TorchDims } from './torch';
import { BULB, THREAD_PITCH, type BulbDims } from './bulb';
import { WIRE_IDS, standPath, type WireId } from './wires';
import { resample } from './dyn-tube';
import { createPlusWay, onCan } from './unfold-plus';
import { createUnfurl, fitEndFlat, liftEnd } from './unfurl';

export const UNFOLD_SECONDS = 6;
/**
 * Recommended way to PLAY the unfolding as one move, without the reader's hand (`stand.playUnfold()`):
 * the timeline runs at constant speed — every beat has its own ease-in and ease-out, the first frame and the
 * last have zero velocity — stretched to `seconds`; the camera stays on `flashlight` through beats 1–2, starts
 * one move to `stand` when beat 3 begins (`cameraAt` of the progress) and arrives with the wires
 * (`cameraSeconds`, ease `cinematic`). The practicum plays the same backwards: `playUnfold(seconds, 0)`, camera
 * back to `flashlight` at progress 1 − `cameraAt` − cameraSeconds / seconds.
 */
export const UNFOLD_PLAY = { seconds: 7, cameraAt: 1.5 / 6, cameraSeconds: 3.6 } as const;
/** Beat boundaries in seconds — `beatOf(u)` and the showcase use them. */
export const BEATS = [0, 0.8, 1.6, 2.6, 3.8, 5.0, 6.0] as const;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const smooth = (x: number): number => x * x * (3 - 2 * x);
const inOut = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** Smoothstep with zero acceleration at both ends: the long moves start and stop without a visible moment. */
const calm = (x: number): number => x * x * x * (x * (6 * x - 15) + 10);
const backOut = (x: number): number => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
const hump = (x: number): number => Math.sin(Math.PI * clamp01(x));

/** Torch frame in the board frame: lying on the board, head to the right and a little toward the reader. */
const YAW = -0.52;
const HOVER_LIFT = 0.3;
/**
 * THE LOOP OPENS (owner 2026-11-19: «щоб він зробив анімацію провода гарно»; «тож доведи до ідеалу»). In the torch
 * the parts stand in a row — spring, battery, slider, lamp — with the minus strip along the near wall, where the
 * reader sees it. On the stand's loop that strip is on the other side of the row, so once the housing has gone it
 * first springs off the wall's line (`SPRING_OFF`) and swings under the battery to the far side (`SWING`): from then
 * on parts and strips are the stand's loop squashed flat, and it opens in one move (`OPEN`, s): the row comes toward
 * the reader, the minus strip unrolls behind it to the left and far sides (`unfurl.ts`), the lamp goes round to
 * the far right corner, the lamp strip unrolls between slider and lamp, the slider slides forward along the battery
 * and steps down in front of «+». No strip goes over a part.
 */
const OPEN = [1.9, 4.4] as const;
/** The minus strip swings under the battery, about the torch's axis (s): from the near wall to the far side. */
const SWING = [1.75, 2.5] as const;
/** … having sprung this far off the line the wall held it on (s): it passes clear of the plus strip under the can. */
const SPRING_OFF = [0.05, 1.65, 1.9] as const;
/** When the battery travels to its place (s). */
const BATTERY_MOVE = [2.0, 4.4] as const;
/** Height of the battery's arc on its way to the cradle. */
const BATTERY_ARC = 0.2;
/**
 * The lamp turns upright on its way to the socket (s) and screws into it in a beat of its own (`SCREW_BEAT`; the
 * strip ends wait at the rim over `LAMP_SCREW`).
 * How high it flies is not its own choice: it keeps the minus wire level — the wire's end on it at the height the
 * wire has along its whole length — so the lamp comes down into the socket as the battery comes down between its
 * clamps, wires and all in one move, and no wire end ever climbs to it.
 */
const LAMP_MOVE = [1.9, 3.55] as const;
const LAMP_SCREW = [3.6, 4.4] as const;
/**
 * Turns the lamp makes in the socket, one pitch of its thread per turn (`THREAD_PITCH`): the thread catches as its
 * lowest edge (local 0.11) reaches the rim (local `LAMP.socketY − PLACE.bulb.y` = 0.2), 0.09 above home — rounded to
 * two whole pitches, so the lamp ends turned as it started. A right-hand thread: going in, it turns clockwise seen
 * from the glass; played backwards it unscrews.
 */
const SCREW_TURNS = 2;
/**
 * The screwing in is its own beat (s): from the catch the lamp no longer follows the minus wire's level (which comes
 * down fast just then) but sinks the two pitches at a steady pace with soft ends — ≈ 0.93 s of the forward play,
 * ≈ 2.7 turns/s at most. It lands on the catch height softly (`SCREW_LAND`, how close the wire's level comes before
 * the lamp starts to slow on it). The strip ends keep the wire's level (they lie on the post's terminals).
 */
const SCREW_BEAT = [3.9, 4.7] as const;
const SCREW_LAND = 0.06;
/** Share of the screw beat over which the turning gathers speed, and again over which it stops. */
const SCREW_EASE = 0.2;
/** 0 … 1 at a steady speed with soft ends: the velocity ramps up over `a` of the way, holds, and ramps down. */
const steady = (x: number, a: number): number => {
  const v = 1 / (1 - a);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x < a) return (v * x * x) / (2 * a);
  if (x > 1 - a) return 1 - (v * (1 - x) ** 2) / (2 * a);
  return v * (x - a / 2);
};
/**
 * The lamp's way over the board: out of the head along the torch's axis (this far ahead is the curve's first
 * handle), then round to the far right corner, coming to the socket from the reader's side (the second handle,
 * from the socket) — the side the lamp strip follows it on; the minus wire comes to it from the left.
 */
const LAMP_WAY = [1.4, new Vector3(-0.2, 0, 1.05)] as const;
/** How far out of the socket's rim the lamp's strip ends wait while the lamp sinks into it. */
const RIM_WAIT = 0.1;
/** The share of the lamp strip, from the lamp back, over which it comes down from the slider's height to the lamp's. */
const LAMP_SWEEP = 0.62;
/** The wire ends leave the spring and the «+» plate for the clamps' terminals over this last share of the battery's way. */
const CLAMP_FROM = 0.68;
/** How much farther in front of the «+» nub the plus piece's end sits as a round wire than as a flat strip. */
const NUB_ROOM = 0.014;
/**
 * The slider's way (s), in the battery's own frame: it rides forward along the battery's top like a bead, level,
 * until it is clear of the «+» end; steps down in front of it (`SLIDER_STEP`: between these distances from the
 * battery's centre) and glides on, low, onto its block.
 */
const SLIDER_MOVE = [2.25, 4.3] as const;
const SLIDER_STEP = [1.06, 1.9] as const;
/** It comes over its block this much above it and sets down over this last stretch of its way: its wires clear the block. */
const SLIDER_SET = [0.07, 0.19] as const;
/** The strips round into wires as they are drawn out (s), before the long sweep across the board. */
const ROUND = [2.6, 3.9] as const;
/**
 * … the short plus piece first: once the housing has gone it rounds (`PLUS_ROUND`, s) and then draws itself the
 * short way round the battery to the slider (`PLUS_SETTLE`, s; `unfold-plus.ts`) — round before it slants, for a
 * flat strip cannot lie on a slant. A round wire needs more room between the battery and the slider than the flat
 * strip did: the slider rises off the battery by the difference as it rounds (`plusRoom`).
 */
const PLUS_ROUND = [1.75, 2.15] as const;
const PLUS_SETTLE = [2.0, 2.75] as const;
/** The sheath grows from the clamps once the wires lie (s). */
const COVER = [4.3, 5.0] as const;
/**
 * The staples' arches (`staple-arch.ts`): the first begins as the wires have lain on them,
 * each sweeps round the wire in `each` s, the next `step` s later.
 */
const ARCH = { at: 4.85, step: 0.1, each: 0.35 };
/** Rings the plus piece is drawn with while it lies round the battery (`WireShape.rings`). */
const PLUS_RINGS = 96;
/** Points per strip while it moves (the finished stand uses the exact paths). */
const SAMPLES: Record<WireId, number> = { m: 164, p1: 90, p2: 90 };

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const quat = (axis: Vector3, angle: number): Quaternion => new Quaternion().setFromAxisAngle(axis, angle);

interface Pose {
  p: Vector3;
  q: Quaternion;
}
const pose = (p: Vector3, q = new Quaternion()): Pose => ({ p, q });

/** World pose → board frame (the shelf is level in the world, the board frame is tilted). */
function fromWorld(p: Vector3, q: Quaternion): Pose {
  const inv = quat(X, -BOARD.tilt);
  return {
    p: p
      .clone()
      .sub(new Vector3(0, BOARD_Y, 0))
      .applyQuaternion(inv),
    q: inv.clone().multiply(q),
  };
}

export interface Unfold {
  /** `u` 0 = flashlight … 1 = stand; `open` 0 = slider closed … 1 = open. */
  set(u: number, open: number): void;
  /** Progress of beat 6 (0…1) for the things that arrive last. */
  readonly beat6: number;
  /** Index 0…5 of the beat `u` is in. */
  beatOf(u: number): number;
  /** 1 while the lamp sits in the mirror (the flashlight has a beam) … 0 once the mirror has left. */
  readonly beam: number;
  /** Direction of the flashlight's axis in the board frame. */
  readonly axis: Vector3;
}

export function createUnfold(stand: Stand, torch: Torch, T: TorchDims = TORCH, B: BulbDims = BULB): Unfold {
  // the lying torch rests on its tail cap and on the rim of its wider head, so it points up a little
  const rim = T.head + 0.035;
  const PITCH = Math.atan2(rim - 0.4, T.front - 0.05 + 1.8);
  const TORCH_AT = new Vector3(-0.95, 0.4 + 1.8 * Math.tan(PITCH), -0.6);
  const qA = quat(Y, YAW).multiply(quat(Z, PITCH));
  const qH = quat(Y, YAW);
  const carrier = new Matrix4();
  const carrierQ = new Quaternion();
  const carrierP = new Vector3();
  const one = new Vector3(1, 1, 1);
  const setCarrier = (t: number): void => {
    const h = smooth(ramp(t, 0.8, 1.5));
    carrierQ.copy(qA).slerp(qH, h);
    carrierP.copy(TORCH_AT).addScaledVector(Y, HOVER_LIFT * h);
    carrier.compose(carrierP, carrierQ, one);
  };
  const inTorch = (local: Vector3, out: Vector3): Vector3 => out.copy(local).applyMatrix4(carrier);

  // where the housing goes: out of the picture, and then it is gone (owner 2026-11-19: «нехай частини ліхтарика
  // анімуються кудись за межі сцени і зникають»). The far half rises on and on over the back of the board, above
  // the top edge of both shots (`flashlight`, `stand`); the near half runs off low to the left. Both keep the pose
  // they turn into (round side up, head to the left), so the motion reads as one calm continuation.
  const turn = quat(Y, Math.PI);
  const away = {
    far: fromWorld(new Vector3(0.8, 5.4, SHELF_WORLD.z - 5.6), quat(X, -Math.PI / 2).multiply(turn)),
    near: fromWorld(new Vector3(-11, -1.8, -4.6), quat(X, Math.PI / 2 - 0.05).multiply(turn)),
  };
  /** The mirror and the glass nest in the head of the far half and leave with it (board frame, from its pose). */
  const nest = {
    mirror: pose(new Vector3(), new Quaternion()),
    glass: pose(new Vector3(), new Quaternion()),
  };

  // attachment points of the strip ends: local to the part that carries them, in the torch and on the stand
  const term = (x: number, z: number): Vector3 => new Vector3(x, LOOP.y, z);
  const INSET = 0.07;
  const bulbUp = quat(Z, -Math.PI / 2); // bulb local +y → torch +x
  const local = {
    bulbT: new Vector3(T.bulbX, 0, 0),
    battT: new Vector3(T.batteryX, 0, 0),
    springT: new Vector3(T.springX, 0, 0),
    sliderT: new Vector3(T.sliderX, T.body - 0.005, 0),
  };
  const paths = Object.fromEntries(
    WIRE_IDS.map((id) => [
      id,
      {
        torch: resample(torchPath(id, T, B), SAMPLES[id]),
        stand: resample(standPath(id), SAMPLES[id]),
        out: [] as Vector3[],
      },
    ]),
  ) as Record<WireId, { torch: Vector3[]; stand: Vector3[]; out: Vector3[] }>;
  const state = { beat6: 0, beam: 1, axis: new Vector3(1, 0, 0) };
  const tmp = new Vector3();
  const tmpQ = new Quaternion();
  const a = new Vector3();
  const b = new Vector3();

  /** Move `object` between two poses with an arc of height `lift` (board frame up). */
  const place = (object: Object3D, from: Pose, to: Pose, e: number, lift: number): void => {
    object.position
      .copy(from.p)
      .lerp(to.p, e)
      .addScaledVector(Y, lift * hump(e));
    object.quaternion.copy(from.q).slerp(to.q, e);
  };
  const torchPose = (localP: Vector3, localQ?: Quaternion): Pose => {
    const q = carrierQ.clone();
    if (localQ) q.multiply(localQ);
    return { p: inTorch(localP, new Vector3()), q };
  };

  /* ---------------------------------------------------------------- beats 1–2: the housing leaves */
  const route = new CatmullRomCurve3(
    [new Vector3(), new Vector3(-6.0, -1.0, 0.4), new Vector3(-8.6, -1.4, -2.2), away.near.p.clone()],
    false,
    'catmullrom',
    0.5,
  );
  const housing = (t: number): void => {
    const apart = inOut(ramp(t, 0, 0.8)) * T.head * 2;
    // the far half slides straight aside, then rises in one long arc over the back of the board and out of the
    // top of the frame; the near half — the one that would come at the reader — opens only a little toward the
    // reader and mostly slides back along the torch's axis, tail first, away from the camera
    const kFar = inOut(ramp(t, 0.8, 2.1));
    place(torch.far, torchPose(tmp.set(0, 0, -apart)), away.far, kFar, 1.2);
    // the near half must never cross the picture: it slides on the way it already goes (to the front left),
    // drops below the level of the face beside the board — out of the flashlight shot — and runs on, low, to the
    // left and back (Catmull-Rom through two low points)
    const from = torchPose(tmp.set(-1.15 * apart, 0, 0.5 * apart));
    const kNear = inOut(ramp(t, 0.86, 1.9));
    route.points[0]!.copy(from.p);
    route.getPoint(kNear, torch.near.position);
    torch.near.quaternion.copy(from.q).slerp(away.near.q, kNear);
    // mirror and glass first slide forward off the lamp, then fly into the head of the far half and leave with it
    nest.mirror.p.copy(torch.far.position);
    nest.mirror.q.copy(torch.far.quaternion);
    nest.glass.p.set(T.glassX, 0, 0).applyQuaternion(torch.far.quaternion).add(torch.far.position);
    nest.glass.q.copy(torch.far.quaternion);
    const off = smooth(ramp(t, 0.8, 1.05));
    place(torch.mirror, torchPose(tmp.set(off * 1.25, 0, 0)), nest.mirror, inOut(ramp(t, 1.02, 1.6)), 1.1);
    place(
      torch.glass,
      torchPose(tmp.set(T.glassX + off * 1.6, 0, 0)),
      nest.glass,
      inOut(ramp(t, 0.98, 1.56)),
      1.3,
    );
    // out of the picture they are gone — not lying anywhere in the scene (and back the same way)
    torch.far.visible = torch.mirror.visible = torch.glass.visible = kFar < 1;
    torch.near.visible = kNear < 1;
  };

  /* ------------------------------------------------ the strip ends: each on the part it touches */
  const bulbP = new Vector3();
  const bulbQ = new Quaternion();
  const sliderP = new Vector3();
  const sliderQ = new Quaternion();
  /** Progress of each part's move, and of the contacts that slide from a part onto its terminal at the end. */
  const e = { batt: 0, slider: 0, bulb: 0, screw: 0, open: 0, swing: 0, settle: 0, roundPlus: 0, clampK: 0, blockK: 0 };
  const first = (id: WireId): Vector3 => paths[id].torch[0]!;
  const last = (id: WireId): Vector3 => paths[id].torch[paths[id].torch.length - 1]!;
  const unBulb = bulbUp.clone().invert();
  // strip ends, local to the part they touch: [in the torch, on the stand]
  const ends = {
    ma: [first('m').clone().sub(local.springT), term(BATTERY.minusX + INSET, LOOP.near).sub(PLACE.spring)],
    mb: [
      last('m').clone().sub(local.bulbT).applyQuaternion(unBulb),
      term(LAMP.x - LAMP.term + INSET, LOOP.far).sub(PLACE.bulb),
    ],
    p1a: [first('p1').clone().sub(local.battT), term(BATTERY.plusX - INSET, LOOP.near).sub(PLACE.battery)],
    p1b: [last('p1').clone().sub(local.sliderT), term(SWITCH.inX + INSET, LOOP.near).sub(PLACE.slider)],
    p2a: [first('p2').clone().sub(local.sliderT), term(SWITCH.outX - INSET, LOOP.near).sub(PLACE.slider)],
    p2b: [
      last('p2').clone().sub(local.bulbT).applyQuaternion(unBulb),
      term(LAMP.x, LAMP.z + LAMP.term - INSET).sub(PLACE.bulb),
    ],
  } as const;
  const wrap = (x: number): number => x - Math.PI * 2 * Math.round(x / (Math.PI * 2));
  /** Where the end `key` is when its part stands at `p`, `q` and the end has gone `k` of its way to the terminal. */
  const end = (key: keyof typeof ends, p: Vector3, q: Quaternion, k: number, out: Vector3): Vector3 => {
    out.copy(ends[key][0]).lerp(ends[key][1], k);
    // the lamp's two ends go round its base to the side of their terminals as the lamp turns upright (while it
    // lies, that side is up), and down to the terminals' level under it
    if (key === 'mb' || key === 'p2b') {
      const kh = smooth(ramp(k, 0.35, 0.95));
      const [from, to] = ends[key];
      if (key === 'mb') {
        // round the lamp's thread with the strip as that swings under (the lamp's own axis is the torch's then), and
        // on round its base the same way to the post's terminal
        const a0 = Math.atan2(from.z, from.x);
        const under = a0 - SWING_ANGLE;
        const a = a0 + (under - a0) * e.swing + wrap(Math.atan2(to.z, to.x) - under) * kh;
        const r = Math.hypot(from.x, from.z) + (Math.hypot(to.x, to.z) - Math.hypot(from.x, from.z)) * kh;
        out.x = r * Math.cos(a);
        out.z = r * Math.sin(a);
      } else {
        out.x = from.x + (to.x - from.x) * kh;
        out.z = from.z + (to.z - from.z) * kh;
      }
      // the post's terminals sit under the cup's rim: while the lamp sinks, the ends wait just outside the rim and
      // tuck in under it only at the bottom
      const r = Math.hypot(out.x, out.z);
      const wait = (RIM_WAIT * kh * (1 - smooth(ramp(e.screw, 0.6, 1)))) / Math.max(r, 1e-6);
      out.x += out.x * wait;
      out.z += out.z * wait;
    }
    return out.applyQuaternion(q).add(p);
  };
  // the minus strip's swing under the battery: a turn about the torch's own axis, from its place on the near wall
  // to the same place on the far side; the stand's loop is unrolled from there (`home` of its unfurl)
  const wallAt = Math.atan2(MINUS_Y, T.body - T.wall - 0.012);
  const SWING_ANGLE = Math.PI + 2 * wallAt;
  const swungQ = new Quaternion();
  const swing = (k: number): Quaternion => swungQ.copy(carrierQ).multiply(tmpQ.setFromAxisAngle(X, SWING_ANGLE * k));
  /** How each long strip unrolls from the torch onto the stand (`unfurl.ts`). */
  const unfurl = {
    m: createUnfurl(
      paths.m.torch,
      paths.m.stand,
      qH.clone().multiply(quat(X, SWING_ANGLE)),
      resample(torchPath('m', T, B, true), SAMPLES.m),
      X,
    ),
    p2: createUnfurl(paths.p2.torch, paths.p2.stand, qH, resample(torchPath('p2', T, B, true), SAMPLES.p2), Y),
  };
  // how far each point of the minus strip springs off the line the wall held it on (torch frame)
  const sprung = resample(torchPath('m', T, B, false, SPRING_OFF[0]), SAMPLES.m).map((p, i) =>
    p.sub(paths.m.torch[i]!),
  );
  const upM = new Vector3();
  /**
   * The minus wire, laid as far as it has swung and unrolled (the lamp takes its height from its end, `parts`):
   * sprung off the wall's line while it passes under the battery, back on its own line as it leaves the row behind.
   */
  const layMinus = (t: number): void => {
    const spring = stand.spring.group;
    const out = paths.m.out;
    const q = swing(e.swing);
    unfurl.m.lay(end('ma', spring.position, spring.quaternion, e.clampK, a), q, e.open, out, upM);
    const off = smooth(ramp(t, SPRING_OFF[1], SPRING_OFF[2])) * (1 - smooth(ramp(e.open, 0.1, 0.4)));
    if (off <= 0) return;
    for (let i = 0; i < out.length; i++) out[i]!.add(tmp.copy(sprung[i]!).applyQuaternion(q).multiplyScalar(off));
  };
  /* ----------------------------------------------- beats 3–4: mounts grow, the loop opens (the parts) */
  // the slider's way in the battery's frame (`SLIDER_MOVE`)
  const sliderFrom = new Vector3(T.sliderX - T.batteryX, T.body - 0.005, 0);
  const sliderTo = PLACE.slider.clone().sub(PLACE.battery);
  // how far the slider rises off the battery for the round plus wire to pass under it (its contact, 0.066 under the
  // slider, at the wire's place on the can)
  const plusRoom = Math.max(0, onCan(1) + 0.003 - Math.hypot(ends.p1b[0].y + sliderFrom.y, ends.p1b[0].z));
  const lampWay = new CubicBezierCurve3(
    new Vector3(),
    new Vector3(),
    PLACE.bulb.clone().add(LAMP_WAY[1]),
    PLACE.bulb.clone(),
  );
  // in the order the loop runs: up the left side, along the far side, down the right
  const arches = STAPLES.map((_, i) => stapleArch(stand.mounts[`staple${i}`]!));
  const parts = (t: number, open: number): void => {
    stand.mountOrder.forEach((name, i) => {
      const g = backOut(ramp(t, 1.45 + i * 0.055, 1.83 + i * 0.055));
      const m = stand.mounts[name]!;
      m.visible = g > 1e-3;
      m.scale.setScalar(Math.max(g, 1e-3));
    });
    // the staples' arches close round the wire once it lies in them, one after another along the loop
    arches.forEach((arch, i) =>
      arch.set(smooth(ramp(t, ARCH.at + i * ARCH.step, ARCH.at + i * ARCH.step + ARCH.each))),
    );
    e.open = calm(ramp(t, ...OPEN));
    e.batt = calm(ramp(t, ...BATTERY_MOVE));
    const battery = stand.battery.group;
    place(battery, torchPose(local.battT), pose(PLACE.battery), e.batt, BATTERY_ARC);
    place(stand.spring.group, torchPose(local.springT), pose(PLACE.spring), e.batt, BATTERY_ARC);
    const len = T.springLength + (PLACE.springLength - T.springLength) * e.batt;
    stand.spring.group.scale.set(len / stand.spring.length, 1, 1);
    // the wire ends on the spring and on the «+» plate slide onto the clamps' terminals only as the battery comes
    // down between the clamps; those on the slider onto the block's terminals as it comes down on the block
    e.clampK = smooth(ramp(e.batt, CLAMP_FROM, 1));

    // the slider rides on the battery: forward along its top, over the «+» end, down in front of it to its block
    e.slider = calm(ramp(t, ...SLIDER_MOVE));
    e.blockK = smooth(ramp(e.slider, 0.6, 1));
    sliderP.copy(sliderFrom).lerp(sliderTo, e.slider);
    e.roundPlus = smooth(ramp(t, ...PLUS_ROUND));
    e.settle = calm(ramp(t, ...PLUS_SETTLE));
    const stepped = smooth(ramp(sliderP.x, ...SLIDER_STEP));
    const set = smooth(ramp(sliderP.x, sliderTo.x - SLIDER_SET[1], sliderTo.x));
    const room = plusRoom * e.roundPlus;
    sliderP.y = sliderFrom.y + room + (sliderTo.y + SLIDER_SET[0] * (1 - set) - sliderFrom.y - room) * stepped;
    sliderP.applyQuaternion(battery.quaternion).add(battery.position);
    sliderQ.copy(battery.quaternion);
    stand.slider.quaternion.copy(sliderQ);
    // open = back along the slider's own −x: toward the flashlight's tail in the torch, to the left on the
    // stand — the same local direction all the way, so the hand-over never makes it jump
    stand.slider.position
      .copy(sliderP)
      .addScaledVector(tmp.copy(X).applyQuaternion(sliderQ), -clamp01(open) * SLIDER_TRAVEL);

    // the lamp: out of the head and round to the far right corner (`LAMP_WAY`), turning upright; one turn as it
    // comes down into the socket. Its height keeps the minus wire level (`LAMP_MOVE`): the wire's end on it stays
    // at the height the wire is laid at
    const travel = calm(ramp(t, ...LAMP_MOVE));
    const screw = smooth(ramp(t, ...LAMP_SCREW));
    e.screw = screw;
    e.bulb = travel;
    e.swing = calm(ramp(t, ...SWING));
    const from = torchPose(local.bulbT, bulbUp);
    bulbQ.copy(from.q).slerp(tmpQ.identity(), travel);
    lampWay.v0.copy(from.p);
    lampWay.v1.copy(from.p).addScaledVector(state.axis, LAMP_WAY[0]);
    lampWay.getPoint(travel, bulbP);
    layMinus(t);
    bulbP.y = 0;
    bulbP.y = paths.m.out[paths.m.out.length - 1]!.y - end('mb', bulbP, bulbQ, e.bulb, b).y;
    // in the socket the lamp sinks on its own beat (`SCREW_BEAT`) once the wire's level comes to the catch: its
    // height over home is the higher of the wire's level and the beat's, the two blended softly over `SCREW_LAND`
    // (a smooth max whose width shrinks with the beat, so the lamp ends exactly home). The wires keep `bulbP`.
    const reach = THREAD_PITCH * SCREW_TURNS;
    let h = Math.max(bulbP.y - PLACE.bulb.y, 0);
    if (travel >= 1) {
      const beat = reach * (1 - steady(ramp(t, ...SCREW_BEAT), SCREW_EASE));
      const k = (SCREW_LAND * beat) / reach;
      const d = h - beat;
      h = beat + (d >= k ? d : d > -k ? (d + k) ** 2 / (4 * k) : 0);
    }
    stand.bulb.group.position.copy(bulbP);
    stand.bulb.group.position.y = PLACE.bulb.y + h;
    if (travel < 1) stand.bulb.group.position.y = bulbP.y;
    // the turn about its own axis follows its height over home, one pitch per turn (+ about its up axis is
    // counter-clockwise seen from the glass): the angle falls to 0 as it sinks, clockwise. Out of the thread's reach
    // it is `SCREW_TURNS` whole turns, i.e. none — the flight and the closed flashlight do not change
    const sunk = travel < 1 ? 0 : 1 - clamp01(h / reach);
    const turn = t >= SCREW_BEAT[1] ? 0 : Math.PI * 2 * SCREW_TURNS * (1 - sunk);
    stand.bulb.group.quaternion.copy(bulbQ).multiply(tmpQ.setFromAxisAngle(Y, turn));
  };

  /* ------------------------------------------- beats 4–5: the strips unroll, then become the wires */
  const up = new Vector3();
  /** The plus piece (`unfold-plus.ts`): under the battery in the torch, then a short wire that follows the slider. */
  const plusWay = createPlusWay();
  const wires = (t: number): void => {
    if (t >= UNFOLD_SECONDS - 1e-6) return stand.wires.setStand();
    const round = smooth(ramp(t, ...ROUND));
    const cover = smooth(ramp(t, ...COVER));
    const battery = stand.battery.group;
    for (const id of WIRE_IDS) {
      const out = paths[id].out;
      if (id === 'm') {
        // laid in `parts` (the lamp stands by it); brought to the lamp whole, in the board's plane
        fitEndFlat(out, end('mb', bulbP, bulbQ, e.bulb, b));
        up.copy(upM);
      } else if (id === 'p2') {
        unfurl.p2.lay(end('p2a', sliderP, sliderQ, e.blockK, a), carrierQ, e.open, out, up);
        // brought to the lamp in the board's plane; its height changes only past the battery's «+» end, which
        // its first stretch runs over
        end('p2b', bulbP, bulbQ, e.bulb, b);
        fitEndFlat(out, b);
        liftEnd(out, b.y - out[out.length - 1]!.y, LAMP_SWEEP);
      } else {
        const n = SAMPLES.p1;
        for (let i = 0; i < n; i++) out[i] ??= new Vector3();
        // (a round wire lies on the «+» nub its own radius off it; on the clamp's terminal it is the stand's)
        end('p1a', battery.position, battery.quaternion, e.clampK, out[0]!).addScaledVector(
          tmp.copy(X).applyQuaternion(battery.quaternion),
          NUB_ROOM * e.roundPlus * (1 - e.clampK),
        );
        end('p1b', sliderP, sliderQ, e.blockK, out[n - 1]!);
        up.copy(plusWay.apply(out, battery, e.roundPlus, e.settle));
      }
      if (id === 'p1')
        // (round the battery it has more bends than its 28 rings on the stand can draw: finer ones until it is the
        // stand's straight piece again — bare copper still, so the change of rings does not show)
        stand.wires.setShape(id, {
          path: out,
          round: e.roundPlus,
          cover,
          copper: 1,
          up,
          rings: t < BATTERY_MOVE[1] ? PLUS_RINGS : undefined,
        });
      else stand.wires.setShape(id, { path: out, round, cover, copper: 1, up });
    }
  };

  return {
    get beat6() {
      return state.beat6;
    },
    get beam() {
      return state.beam;
    },
    axis: state.axis,
    beatOf(u) {
      const t = clamp01(u) * UNFOLD_SECONDS;
      let i = 0;
      while (i < 5 && t >= BEATS[i + 1]!) i++;
      return i;
    },
    set(u, open) {
      const t = clamp01(u) * UNFOLD_SECONDS;
      setCarrier(t);
      state.beat6 = smooth(ramp(t, 5.0, 6.0));
      state.beam = 1 - smooth(ramp(t, 0.8, 1.02));
      state.axis.copy(X).applyQuaternion(carrierQ);
      housing(t);
      parts(t, open);
      wires(t);
    },
  };
}
