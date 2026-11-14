/**
 * Step 5 `lorentz` — the Lorentz force and the Ampère force. Part A (left): an electron-beam tube between
 * Helmholtz coils; the beam bends into an arc of r = m·v/(|q|·B), v = √(2eU/m), and closes into a circle
 * when 2r fits in the 15 cm bulb; arrows v (`cyan`), B (`magenta`), F (`white`) ride on the beam. Part B
 * (right): the Ampère swing — a copper bar in a horseshoe magnet deflects by tan β = B·I·L/(m·g), and a
 * holographic left hand turns with the force. A segmented switch chooses the part (camera + controls).
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSci, fmtUnit } from '@/content';
import { createFlow, createHalo, createVectorArrow } from '@/fx';
import { SEMANTIC } from '@/style';
import { AMPERE_SWING, BEAM, ampereSwingAngle, electronBeam } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { COIL_R, beamPath, createBeamTube } from '../parts/beam-tube';
import { createBLines } from '../parts/b-lines';
import { createLeftHand } from '../parts/hand';
import { GAP_Y, createSwing } from '../parts/swing';
import { createSupply } from '../parts/supply';
import { S, group } from '../world';

const ID = 'lorentz';
const TUBE = new Vector3(-1.45, 1.5, -0.1);
const SWING = new Vector3(1.55, 0, -0.1);
/** Largest drawn swing angle (rad): the bar, 1,2 units below the pivot, keeps 0,4 units of gap each way. */
const SWING_MAX = Math.asin(0.33);

export const lorentzStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const tube = createBeamTube();
  tube.group.position.copy(TUBE);
  const beamLine = createBLines(200, { width: 0.03, intensity: 1.7, dashSpeed: 1.6, color: SEMANTIC.electron });
  const beam = new Group();
  beam.position.copy(TUBE);
  const flow = createFlow(ctx, {
    kind: 'electron',
    paths: beamPath(Infinity, 1).points,
    count: ctx.quality.count(26, 10),
    radius: 0.03,
    speed: 0.9,
  });
  const spot = createHalo({ color: 'cyan', size: 0.35, intensity: 1.4 });
  const fieldA = createBLines(9 * 4, { width: 0.02, intensity: 1.1, dashSpeed: 0.3 });
  const arrows = {
    v: createVectorArrow({ color: 'cyan', radius: 0.02, headLength: 0.1, headRadius: 0.045 }),
    b: createVectorArrow({ color: SEMANTIC.fieldB, radius: 0.02, headLength: 0.1, headRadius: 0.045 }),
    f: createVectorArrow({ color: 'white', radius: 0.02, headLength: 0.1, headRadius: 0.045 }),
  };
  beam.add(beamLine.mesh, flow, spot, fieldA.mesh, arrows.v, arrows.b, arrows.f);
  // part B
  const swing = createSwing();
  swing.group.position.copy(SWING);
  const gapLines = createBLines(5 * 8, { width: 0.022, intensity: 1.3, dashSpeed: 0.3 });
  const hand = createLeftHand(0.11);
  const supply = createSupply(0.55);
  supply.group.position.set(SWING.x + 1.3, 0, SWING.z + 0.35);
  supply.group.rotation.y = -0.7;
  set.add(tube.group, beam, swing.group, gapLines.mesh, hand, supply.group);
  // B of the Helmholtz pair: 3×3 straight lines along +z through the bulb
  const zLines = [];
  for (const x of [-0.45, 0, 0.45])
    for (const y of [-0.4, 0.05, 0.5]) zLines.push({ points: [new Vector3(x, y, -COIL_R * 0.8), new Vector3(x, y, COIL_R * 0.9)] });
  fieldA.set(zLines);

  /* ------------------------------------------------------------------------------------- state */
  const partB = (): boolean => ui.value<string>('part5') === 'b';
  const fieldT = (): number => ui.value<number>('b5') / 1000;
  const voltage = (): number => ui.value<number>('u5');
  const proton = (): boolean => ui.value<string>('q5') === 'proton';
  const swingI = (): number => ui.value<number>('i5');
  const st = { flip: 0, beta: 0 };
  const beamNow = () => electronBeam(voltage(), fieldT(), proton() ? 'proton' : 'electron');
  let beamKey = '';
  let path = beamPath(Infinity, 1);
  function retrace(): void {
    const e = beamNow();
    const key = `${e.radiusM.toFixed(5)}:${e.turnSign}`;
    if (key === beamKey) return;
    beamKey = key;
    path = beamPath(e.radiusM * S, e.turnSign);
    beamLine.set([{ points: path.points, closed: path.closed }]);
    flow.setPaths([{ path: path.points, closed: path.closed }]);
    flow.setColor(e.turnSign > 0 ? 'cyan' : 'coral');
    spot.visible = !path.closed;
    spot.position.copy(path.end);
    // v, B, F on the electron a fifth of the way along the beam
    const k = Math.min(Math.floor(path.points.length * 0.22), path.points.length - 2);
    const p = path.points[k]!;
    const tangent = path.points[k + 1]!.clone().sub(p).normalize();
    const toCentre = new Vector3(0, 0, 0);
    if (Number.isFinite(e.radiusM) && fieldT() > 0) toCentre.set(-tangent.y, tangent.x, 0).multiplyScalar(e.turnSign);
    arrows.v.set(p, tangent.clone().multiplyScalar(0.42));
    arrows.b.set(p, [0, 0, 0.42]);
    arrows.f.visible = toCentre.lengthSq() > 0;
    if (arrows.f.visible) arrows.f.set(p, toCentre.multiplyScalar(0.36));
    arrows.b.visible = fieldT() > 0;
  }
  const gapSet = (down: boolean) =>
    [-0.15, 0, 0.15].flatMap((z) =>
      [-0.25, 0.05, 0.35].map((x) => {
        const a = new Vector3(SWING.x + x + 0.1, GAP_Y + 0.3, SWING.z + z);
        const b = new Vector3(SWING.x + x + 0.1, GAP_Y - 0.3, SWING.z + z);
        return { points: down ? [a, b] : [b, a] };
      }),
    );
  let gapKey = '';
  const goPart = (b: boolean): void => void ctx.camera.go(b ? `${ID}:b` : ID, { duration: 1.4 });
  ui.onChange('part5', (v) => goPart(v === 'b'));
  ui.onChange('flip5', (on) => {
    audio.play('whooshUp', { gain: 0.4 });
    ctx.stage.scope.to(st, { flip: on ? 1 : 0 }, { duration: 0.7, ease: 'back.out' });
  });
  ctx.qa.probe('bulb5', tube.bulb);
  ctx.qa.probe('bar5', swing.bar);
  ctx.qa.expose(ID, () => {
    const e = beamNow();
    return { radiusCm: e.radiusM * 100, closed: path.closed, speed: e.speedMPerS, energyEv: e.energyEv, turn: e.turnSign, betaDeg: (st.beta * 180) / Math.PI, flipped: st.flip > 0.5, part: partB() ? 'b' : 'a', drawnDeg: (swing.pendulum.rotation.z * 180) / Math.PI };
  });
  const v = new Vector3();
  // the part label sits left of the front coil (upper-left of the ring), beside the apparatus
  const partAOffset = new Vector3(-COIL_R * 0.78, COIL_R * 0.62, COIL_R / 2);

  return {
    id: ID,
    shots: {
      [ID]: {
        // nearly along the coils' axis: both coils ring the bulb instead of crossing it, the beam circle is
        // the hero; a slight angle keeps the B lines (along z) readable as lines
        position: [-0.85, 2.45, 4.9],
        target: [-1.45, 2.0, -0.1],
        fov: 32,
        frameAspect: 1.2,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [-1.45, 1.95, -0.1], radius: 1.45 },
      },
      [`${ID}:b`]: {
        position: [2.9, 2.7, 4.6],
        target: [1.55, 1.05, -0.1],
        fov: 32,
        frameAspect: 1.2,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [1.7, 1.1, 0], radius: 1.7 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        beamKey = '';
        gapKey = '';
        st.flip = 0;
        st.beta = 0;
        swing.magnet.rotation.x = 0;
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { slowed: 1e8, text: OWN.beamSlowed }],
      controls: [
        {
          type: 'segmented',
          id: 'part5',
          items: [
            { id: 'a', label: OWN.partA },
            { id: 'b', label: OWN.partB },
          ],
          value: 'a',
        },
        { type: 'slider', id: 'b5', label: DOC.beamB, min: 0, max: 2, step: 0.05, value: 1, unit: 'mT', digits: 2, visible: () => !partB() },
        { type: 'slider', id: 'u5', label: DOC.accelU, ...BEAM.voltageRangeV, value: BEAM.voltageRangeV.default, unit: 'V', visible: () => !partB() },
        {
          type: 'segmented',
          id: 'q5',
          label: DOC.charge,
          items: [
            { id: 'electron', label: OWN.particles[0] },
            { id: 'proton', label: OWN.particles[1] },
          ],
          value: 'electron',
          visible: () => !partB(),
        },
        { type: 'readout', id: 'v5', label: OWN.speedV, text: () => `${fmtSci(beamNow().speedMPerS, 2)} m/s`, visible: () => !partB() },
        {
          type: 'readout',
          id: 'r5',
          label: OWN.radiusR,
          text: () => (fieldT() > 0 ? fmtUnit(beamNow().radiusM * 100, 'cm', { digits: 1 }) : '∞'),
          visible: () => !partB(),
        },
        { type: 'readout', id: 'e5', label: DOC.energy, text: () => fmtUnit(beamNow().energyEv, 'eV'), visible: () => !partB() },
        { type: 'slider', id: 'i5', label: DOC.swingI, ...AMPERE_SWING.currentRangeA, value: 0, unit: 'A', digits: 1, visible: partB },
        { type: 'toggle', id: 'flip5', label: DOC.flipMagnet, value: false, visible: partB },
        { type: 'readout', id: 'beta5', label: OWN.swingAngle, text: () => fmtUnit((st.beta * 180) / Math.PI, '°', { digits: 1 }), visible: partB },
        {
          type: 'readout',
          id: 'f5',
          label: OWN.force,
          text: () => `${fmtNumber(AMPERE_SWING.fieldT * Math.abs(swingI()) * AMPERE_SWING.lengthM, { digits: 3 })} N`,
          visible: partB,
        },
      ],
      callouts: [
        { anchor: () => tube.group.getWorldPosition(v).add(partAOffset), text: OWN.partA, side: 'left', visible: () => !partB() },
        {
          anchor: () => beam.localToWorld(v.copy(path.end)),
          text: DOC.positive,
          color: 'coral',
          side: 'right',
          visible: () => !partB() && proton(),
        },
        { anchor: () => swing.group.getWorldPosition(v).setY(2.35), text: OWN.partB, side: 'up', visible: partB },
      ],
      hotspots: [
        { anchor: () => tube.group.getWorldPosition(v).add(new Vector3(COIL_R * 0.72, COIL_R * 0.72, COIL_R / 2)), content: 'helmholtz-coils', visible: () => !partB() },
        { anchor: () => beam.localToWorld(v.copy(path.points[Math.floor(path.points.length / 2)]!)), content: 'electron-beam', visible: () => !partB() },
        { anchor: () => swing.bar.getWorldPosition(v).setZ(v.z + 0.35), content: 'crossbar', visible: partB },
      ],
    },
    update(dt, t) {
      retrace();
      flow.speed = 0.9 * (proton() ? 0.4 : 1);
      spot.intensity = 1.2 + 0.2 * Math.sin(t * 9);
      // the swing: damped pendulum toward β (a stage-sized 0,25 s settle; no physics beyond the angle). The
      // drawn angle saturates smoothly at SWING_MAX so the bar stays in the gap (true β up to 37° at 5 A is
      // in the readout; small angles are drawn true): β_drawn = β_max·tanh(β/β_max)
      const target = ampereSwingAngle(swingI(), st.flip > 0.5);
      st.beta += (target - st.beta) * Math.min(dt * 3, 1);
      swing.pendulum.rotation.z = SWING_MAX * Math.tanh(st.beta / SWING_MAX) + Math.sin(t * 3.1) * 0.01 * Math.min(Math.abs(swingI()), 1);
      swing.magnet.rotation.x = st.flip * Math.PI;
      const down = st.flip < 0.5;
      const gk = `${down}`;
      if (gk !== gapKey) {
        gapKey = gk;
        gapLines.set(gapSet(down));
      }
      // left hand beside the bar: B into the palm, fingers along I, thumb = force
      const i = swingI();
      hand.visible = partB() && Math.abs(i) > 0.05;
      swing.bar.getWorldPosition(v);
      set.worldToLocal(v);
      hand.position.set(v.x + 0.1, v.y + 0.75, v.z + 0.35);
      hand.rotation.set(down ? 0 : Math.PI, i >= 0 ? 0 : Math.PI, 0, 'ZYX');
      supply.level = i / 5;
      supply.update(t);
      bench.live.buzz = partB() ? Math.abs(i) / 5 * 0.4 : fieldT() > 0 ? 0.25 : 0.1;
    },
  };
};
