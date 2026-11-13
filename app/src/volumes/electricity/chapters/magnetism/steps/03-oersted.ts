/**
 * Step 3 `oersted` — a current makes a magnetic field. A vertical wire passes through a horizontal card disc
 * with two rings of compasses (8 at 6 cm, 12 at 12 cm). Each needle follows B_wire + B_Earth (model М3,
 * B_E = 20 μT north); a probe needle rides a rail due north of the wire (r slider or drag) and reads
 * B = μ₀I/(2πr) and tan α = B_wire/B_E. Electrons run down the wire (`cyan`), the conventional current up
 * (`yellow` arrow); `magenta` rings show B (brightness ∝ I). A holographic right hand shows the grip rule.
 * On a non-instant entry the step opens with the memory of `current/dc-ac`: the wire lies horizontally
 * over a compass, then stands up through the disc.
 */
import { Vector3 } from 'three';
import { fmtNumber, fmtUnit } from '@/content';
import { createFlow, createVectorArrow, type RibbonLine } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { OERSTED_STEP, compassAngleFromNorth, oerstedProbe } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { COPPER } from '../parts/coil';
import { addCompassBody, createNeedles } from '../parts/compass';
import { createGripHand } from '../parts/hand';
import { createMemory } from '../parts/memory';
import { createSupply } from '../parts/supply';
import { S, group } from '../world';

const ID = 'oersted';
const DISC_Y = 0.95;
const WIRE_TOP = 2.6;
const RINGS = [
  { r: 0.6, n: 8 },
  { r: 1.2, n: 12 },
];
const B_RINGS = [0.3, 0.45, 0.65, 0.9, 1.45];
/** The step opens with the current on (its most telling state; the script's default is 0 A). */
const OPEN_CURRENT = 8;

export const oerstedStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  // card disc on three legs, compass bodies, the rail of the probe (due north = −z)
  const b = new Builder('oersted-disc');
  b.cyl(1.55, 0.04, { at: [0, DISC_Y - 0.04, 0], seg: 72, c: 'white' });
  b.ring(1.55, 0.025, { at: [0, DISC_Y, 0], seg: 72, axis: 'y', c: 'mist' });
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5;
    b.cyl(0.04, DISC_Y - 0.04, { at: [Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35], seg: 10, slot: 'metal', c: 'steel' });
  }
  b.box(0.08, 0.012, 1.42, { at: [0.0, DISC_Y, -0.82], r: 0, c: 'slate' });
  const supply = createSupply(0.75);
  supply.group.position.set(1.85, 0, 1.25);
  supply.group.rotation.y = -0.45;
  supply.group.updateMatrix();
  const term = (o: { position: Vector3 }): Vector3 => o.position.clone().applyMatrix4(supply.group.matrix);
  const plusAt = term(supply.plus);
  const minusAt = term(supply.minus);
  const ringNeedles: { x: number; z: number }[] = [];
  for (const ring of RINGS)
    for (let k = 0; k < ring.n; k++) {
      const a = ((k + 0.5) / ring.n) * Math.PI * 2;
      const p = { x: Math.cos(a) * ring.r, z: Math.sin(a) * ring.r };
      ringNeedles.push(p);
      addCompassBody(b, 0.16, [p.x, DISC_Y, p.z]);
    }
  // the wire: up through the disc to a gantry, back down a post to the supply
  b.cyl(0.05, 0.1, { at: [0, 0, 0], seg: 16, c: 'ink' });
  b.tube([new Vector3(0, 0.05, 0), new Vector3(0, WIRE_TOP, 0), new Vector3(0.12, WIRE_TOP + 0.15, -0.09), new Vector3(1.75, WIRE_TOP + 0.15, -1.3)], 0.03, { slot: 'metal', c: COPPER, seg: 10 });
  b.cyl(0.06, WIRE_TOP + 0.2, { at: [1.86, 0, -1.38], seg: 12, slot: 'metal', c: 'steel' });
  b.tube([new Vector3(1.75, WIRE_TOP + 0.15, -1.3), new Vector3(1.78, 0.08, -1.3), new Vector3(2.3, 0.06, 0.1), new Vector3(minusAt.x + 0.1, 0.06, minusAt.z - 0.25), minusAt], 0.03, { slot: 'metal', c: COPPER, seg: 10 });
  b.tube([new Vector3(0, 0.05, 0), new Vector3(0.6, 0.05, 0.45), new Vector3(plusAt.x - 0.15, 0.05, plusAt.z - 0.2), plusAt], 0.03, { slot: 'metal', c: COPPER, seg: 10 });
  const rig = b.build();
  const needles = createNeedles(ringNeedles.length, 0.16);
  needles.mesh.position.y = DISC_Y + 0.16 * 0.36;
  const probe = createNeedles(1, 0.13);
  probe.mesh.position.y = DISC_Y + 0.07;
  const pb = new Builder('probe-cart');
  pb.cyl(0.07, 0.05, { seg: 20, slot: 'metal', c: 'amber' });
  pb.cyl(0.02, 0.06, { at: [0, 0.04, 0], seg: 8, slot: 'metal', c: 'mist' });
  const cart = pb.build();
  cart.group.position.y = DISC_Y;
  const rings = createBLines(B_RINGS.length * 98, { width: 0.025, intensity: 1.4, dashSpeed: 0.45 });
  rings.mesh.position.y = DISC_Y + 0.12;
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: [new Vector3(0, WIRE_TOP - 0.1, 0), new Vector3(0, 0.15, 0)],
    count: ctx.quality.count(36, 12),
    radius: 0.045,
    speed: 0,
    spread: 0.0,
  });
  const arrow = createVectorArrow({ color: SEMANTIC.current, radius: 0.03, headLength: 0.16, headRadius: 0.07, intensity: 1.5 });
  const hand = createGripHand(0.15);
  hand.position.y = 1.95;
  set.add(rig.group, supply.group, needles.mesh, probe.mesh, cart.group, rings.mesh, electrons, arrow, hand);
  // the memory of `current/dc-ac`: a horizontal wire over a compass, needle swung ≈ 79° (5 A at 1 cm)
  const memory = createMemory();
  memory.group.position.set(-2.4, 0, 0.9);
  set.add(memory.group);

  /* ------------------------------------------------------------------------------------- state */
  const current = (): number => ui.value<number>('i3');
  const rProbe = (): number => ui.value<number>('r3') / 100;
  const heading = new Float32Array(ringNeedles.length + 1).fill(Math.PI / 2);
  const vel = new Float32Array(ringNeedles.length + 1);
  const omega = 1 / 0.12;
  let ringKey = '';
  let dragging = false;
  /** Heading (from east) of a needle at world (x, z) on the disc: B_wire + B_E (М3). */
  const target = (x: number, z: number, i: number): number => Math.PI / 2 + compassAngleFromNorth(i, x / S, -z / S);
  const follow = (k: number, aim: number, dt: number): number => {
    const err = Math.atan2(Math.sin(aim - heading[k]!), Math.cos(aim - heading[k]!));
    vel[k] = vel[k]! + (omega * omega * err - 2 * omega * vel[k]!) * dt;
    heading[k] = heading[k]! + vel[k]! * dt;
    return heading[k]!;
  };
  function ringLines(i: number): void {
    const key = `${Math.sign(i)}:${Math.abs(i) > 0.01}`;
    if (key === ringKey) return;
    ringKey = key;
    const lines: RibbonLine[] = B_RINGS.map((r) => {
      const pts: Vector3[] = [];
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2 * Math.sign(i || 1);
        // counter-clockwise seen from above for an upward current (sim: B ∝ (−y, x))
        pts.push(new Vector3(Math.cos(a) * r, 0, -Math.sin(a) * r));
      }
      return { points: pts, closed: true };
    });
    rings.set(lines);
  }
  const tableNormal = new Vector3(0, 1, 0);
  const through = new Vector3();
  ctx.input.register(cart.group, {
    tooltip: OWN.probe,
    cursor: 'grab',
    enabled: () => bench.isCurrent(ID),
    dragStart: () => (dragging = true),
    drag: (e) => {
      const p = e.planePoint(tableNormal, cart.group.getWorldPosition(through));
      if (!p) return;
      set.worldToLocal(p);
      const { min, max, step } = OERSTED_STEP.probeRangeM;
      const r = Math.min(Math.max(-p.z / S, min), max);
      ui.set('r3', Math.round(r / step) * step * 100, { notify: true });
    },
    dragEnd: () => (dragging = false),
  });
  ctx.qa.probe('probe3', cart.group);
  ctx.qa.probe('wire3', hand);
  ctx.qa.expose(ID, () => {
    const p = oerstedProbe(current(), rProbe());
    return {
      currentA: current(),
      rM: rProbe(),
      fieldMicroT: p.fieldMicroT,
      alphaDeg: (p.angleRad * 180) / Math.PI,
      probeHeadingDeg: (heading[ringNeedles.length]! * 180) / Math.PI,
      westRing6Deg: (heading[3]! * 180) / Math.PI,
      ringsOn: rings.mesh.visible,
      memory: memory.group.visible,
    };
  });
  const v = new Vector3();
  const up = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [1.2, 4.7, 4.6],
        target: [0.2, 1.05, -0.05],
        fov: 34,
        frameAspect: 1.3,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0.3, 1.2, 0], radius: 2.3 },
      },
      [`${ID}:memory`]: {
        position: [-1.2, 2.6, 3.4],
        target: [-2.4, 0.3, 0.9],
        fov: 32,
        fit: { center: [-2.4, 0.3, 0.9], radius: 1.2 },
      },
    },
    stage: {
      show: [set],
      camera: `${ID}:memory`,
      enter: (info) => {
        heading.fill(Math.PI / 2);
        vel.fill(0);
        ringKey = '';
        // a 2,4 s memory of the previous chapter, then the wire "stands up" through the disc
        const stand = (): void => {
          ctx.stage.toggle(memory.group, false);
          void ctx.camera.go(ID, { duration: info.instant ? 0 : 1.8 });
        };
        if (info.instant || ctx.reducedMotion) stand();
        else info.scope.delay(2.4, stand);
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'illustrative'],
      controls: [
        { type: 'slider', id: 'i3', label: DOC.wireI, ...OERSTED_STEP.currentRangeA, value: OPEN_CURRENT, unit: 'A', digits: 1 },
        {
          type: 'slider',
          id: 'r3',
          label: DOC.probeR,
          min: 1,
          max: 15,
          step: 0.5,
          value: OERSTED_STEP.probeRangeM.default * 100,
          unit: 'cm',
          digits: 1,
        },
        { type: 'readout', id: 'b3', label: OWN.fieldB, text: () => fmtUnit(oerstedProbe(current(), rProbe()).fieldMicroT, 'μT', { digits: 0 }) },
        {
          type: 'readout',
          id: 'a3',
          label: OWN.deflection,
          text: () => fmtUnit((oerstedProbe(current(), rProbe()).angleRad * 180) / Math.PI, '°', { digits: 1 }),
        },
        { type: 'note', id: 'chip3', text: OWN.chip, icon: 'ruler' },
      ],
      callouts: [
        {
          anchor: () => cart.group.getWorldPosition(v).setY(v.y + 0.1),
          text: () => `${fmtNumber(oerstedProbe(current(), rProbe()).fieldMicroT, { digits: 0 })} μT`,
          color: SEMANTIC.fieldB,
          side: 'left',
          visible: () => Math.abs(current()) > 0.01 && !dragging,
        },
        {
          anchor: () => arrow.tip.getWorldPosition(v),
          text: OWN.conventional,
          color: SEMANTIC.current,
          side: 'right',
          visible: () => Math.abs(current()) > 0.01,
        },
        { anchor: supply.knobAnchor, text: OWN.supply, side: 'right' },
      ],
      hotspots: [
        { anchor: () => cart.group.getWorldPosition(v).setY(v.y + 0.25), content: 0 },
        { anchor: () => hand.getWorldPosition(v).setY(v.y + 0.35), content: 1, visible: () => Math.abs(current()) > 0.01 },
      ],
    },
    update(dt, t) {
      const i = current();
      const h = Math.min(dt, 0.05);
      ringNeedles.forEach((p, k) => needles.set(k, p.x, 0, p.z, follow(k, target(p.x, p.z, i), h)));
      needles.commit();
      const pr = rProbe() * S;
      cart.group.position.set(0, DISC_Y, -pr);
      probe.set(0, 0, 0.05, -pr, follow(ringNeedles.length, target(0, -pr, i), h));
      probe.commit();
      // field rings: brightness ∝ |I|, outer rings fade where B_wire is weak (B ∝ 1/r)
      ringLines(i);
      rings.mesh.visible = Math.abs(i) > 0.01;
      rings.mesh.intensity = 0.35 + 1.1 * Math.min(Math.abs(i) / 12, 1);
      rings.mesh.dashSpeed = 0.2 + 0.5 * Math.min(Math.abs(i) / 10, 1);
      // electrons drift down for an upward conventional current (slowed for the eye)
      electrons.speed = -0.06 * i;
      electrons.density = Math.abs(i) > 0.01 ? 1 : 0.35;
      const s = Math.sign(i) || 1;
      arrow.visible = Math.abs(i) > 0.01;
      arrow.set([0.2, 1.75 - 0.35 * s, 0], up.set(0, 0.7 * s, 0));
      hand.visible = Math.abs(i) > 0.01;
      hand.rotation.set(s > 0 ? 0 : Math.PI, 0.6 + t * 0.15, 0);
      supply.level = i / 20;
      supply.update(t);
      memory.update(t);
      bench.live.buzz = Math.min(Math.abs(i) / 20, 1) * 0.6;
    },
  };
};
