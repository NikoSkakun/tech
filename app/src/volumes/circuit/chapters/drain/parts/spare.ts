/**
 * `life`'s battery change (VISUAL §5.8): a second instance of the stand's battery model (`createBattery`, fresh),
 * lying on the table in front of the board at the left, and the motion of the swap as pure functions of two
 * numbers, so «Назад» plays it backwards:
 *
 *   `carry` 0 … 1  the new battery from the table up over the cradle (the reader's hand; an arc, it turns from
 *                  its lie on the table into the cradle's line)
 *   `swap`  0 … 1  0–0.55 the dead one rises out of the clamps and leaves the picture in one calm arc, low
 *                  to the left and back (as the flashlight's housing does, owner 2026-11-19), and is gone; 0.42–0.82 the new one goes down into the cradle — only once the old one is clear of
 *                  it (one battery on the stand); the circuit opens as the old one leaves (0.04) and closes when the
 *                  new one seats (0.8)
 *
 * The stand's own battery is the dead one and stays the stand's (its band, its inside); the spare is the new one.
 */
import { Group, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3, type Object3D } from 'three';
import { BATTERY, boardToWorld, tameAll, type CircuitStage } from '@circuit/shared/stage';
import { createBattery, type BatteryModel } from '@circuit/shared/stage/battery';

/** Where the new battery lies (world: on the table in front of the board, left of the battery). */
const REST = new Vector3(-1.45, BATTERY.radius, 2.85);
const REST_YAW = -0.16;
/** Before `life` the new battery waits off the table at the left, out of the frame; it slides in on entry. */
const AWAY = REST.clone().add(new Vector3(-3.4, 0, -0.25));
/** Where the old battery ends (world): out of the picture, low to the left behind the table — the near half of
 *  the flashlight's housing goes the same way (`shared/stage/unfold.ts`); there it is hidden. */
const GONE = new Vector3(-10, -1.6, -3.4);
/** The yaw it turns into on its way out (the arc's direction: head first, calmly). */
const GONE_Q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5);
/** How high over the cradle a battery hangs before it goes down (board units along the face's normal), and how
 *  far toward the reader the new one waits there — clear of the old one rising out of the clamps. */
const LIFT = 1.0;
const AHEAD = 0.8;

const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1);
const smooth = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const span = (x: number, a: number, b: number): number => smooth((x - a) / (b - a));

/** Quadratic Bézier a → b with control c. */
function arc(a: Vector3, c: Vector3, b: Vector3, t: number, out: Vector3): Vector3 {
  const u = 1 - t;
  return out
    .copy(a)
    .multiplyScalar(u * u)
    .addScaledVector(c, 2 * u * t)
    .addScaledVector(b, t * t);
}

export interface Spare {
  model: BatteryModel;
  /** Invisible grab volume around the new battery (register it). */
  handle: Mesh;
  /** 0 waiting off the table … 1 lying in front of the stand. */
  presence: number;
  carry: number;
  swap: number;
  /** The circuit runs through the cradle (0 while one leaves and the other arrives). */
  readonly contact: number;
  /** The new battery is the one in the cradle. */
  readonly fresh: boolean;
  /** Anchors (world): the new battery, the dead one. */
  readonly anchors: { spare: Object3D; dead: Object3D };
  /** Screen rail of the hand: where the new battery lies and where it hangs over the cradle (world). */
  rest(out: Vector3): Vector3;
  over(out: Vector3): Vector3;
  update(): void;
}

export function createSpare(root: Object3D, stage: CircuitStage): Spare {
  const model = createBattery();
  model.charge = 1;
  model.group.name = 'drain:spare-battery';
  const group = new Group();
  group.add(model.group);
  root.add(group);
  tameAll(group);
  const handle = new Mesh(
    new SphereGeometry(0.62, 16, 10),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  handle.scale.set(1.7, 0.75, 0.75);
  handle.name = 'drain:spare-hit';
  model.group.add(handle);
  const frame = stage.base.frame;
  const old = stage.stand.battery;
  const frameQ = new Quaternion();
  const restQ = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), REST_YAW);
  const cradle = new Vector3();
  const above = new Vector3();
  const lift = new Vector3();
  const p = new Vector3();
  const c = new Vector3();
  const q = new Quaternion();
  const inv = new Quaternion();
  const out: Spare = {
    model,
    handle,
    presence: 0,
    carry: 0,
    swap: 0,
    get contact() {
      return out.swap < 0.04 || out.swap >= 0.8 ? 1 : 0;
    },
    get fresh() {
      return out.swap >= 0.8;
    },
    anchors: { spare: model.group, dead: old.group },
    rest: (v) => v.copy(REST),
    over: (v) => {
      frame.getWorldQuaternion(frameQ);
      lift.set(0, 1, 0).applyQuaternion(frameQ);
      return boardToWorld(BATTERY.x, BATTERY.y, BATTERY.z + AHEAD, v).addScaledVector(lift, LIFT);
    },
    update() {
      frame.getWorldQuaternion(frameQ);
      lift.set(0, 1, 0).applyQuaternion(frameQ);
      boardToWorld(BATTERY.x, BATTERY.y, BATTERY.z, cradle);
      boardToWorld(BATTERY.x, BATTERY.y, BATTERY.z + AHEAD, above).addScaledVector(lift, LIFT);
      // the new one: table → over the cradle (the hand), then down into it
      const k = smooth(out.carry);
      c.copy(REST)
        .lerp(above, 0.5)
        .add(new Vector3(0, 0.9, 0));
      arc(REST, c, above, k, p);
      p.add(
        c
          .copy(AWAY)
          .sub(REST)
          .multiplyScalar(1 - smooth(out.presence)),
      );
      group.visible = out.presence > 0.002;
      p.lerp(cradle, span(out.swap, 0.42, 0.82));
      q.copy(restQ).slerp(frameQ, smooth(out.carry * 1.25));
      group.position.copy(p);
      group.quaternion.copy(q);
      // the old one: up out of the clamps, then one arc out of the picture (level in the world by then), gone
      const up = span(out.swap, 0, 0.2);
      const go = span(out.swap, 0.16, 0.55);
      p.copy(cradle).addScaledVector(lift, LIFT * 0.85 * up);
      c.copy(p)
        .lerp(GONE, 0.35)
        .add(new Vector3(0, 0.9, 0));
      if (go > 0) arc(p.clone(), c, GONE, go, p);
      q.copy(frameQ).slerp(GONE_Q, go);
      old.group.visible = go < 1;
      // into the board frame the stand's battery lives in
      old.group.position.copy(frame.worldToLocal(p.clone()));
      inv.copy(frameQ).invert();
      old.group.quaternion.copy(inv.multiply(q));
    },
  };
  out.update();
  return out;
}
