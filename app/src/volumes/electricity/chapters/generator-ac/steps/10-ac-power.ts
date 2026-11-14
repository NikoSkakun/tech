/**
 * Step 10 `ac-power` — two mises-en-scène, one at a time (script: «Сцена-аналогія … Потім — реальне коло»).
 * 1. The barge analogy (default view): the rope pulls with S (white); only its part along the canal, P (yellow),
 *    moves the barge; Q (sky) just presses it to the bank. Drag the horse along its path to change φ
 *    (`bargeAnalogy`); the drawn rope keeps the exact angle for every φ (`parts/canal.ts`).
 * 2. The real circuit (shown when cos φ or the capacitors are touched): grid → line (its resistor glows with I²·R)
 *    → motor, with a capacitor bank in front of it and the motor's power triangle beside it. Yellow pulses =
 *    active energy to the motor; sky pulses rocking back and forth = reactive energy; with capacitors the rocking
 *    moves into the motor–bank loop and the line slims down (Г7 `powerCompensation`). The rope-angle control
 *    brings the analogy back.
 */
import { Group, Mesh, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fmtUnit } from '@/content';
import { applyHeat, createVectorArrow, createWire } from '@/fx';
import { G, motor } from '@/kit';
import { AC_POWER, bargeAnalogy, powerCompensation } from '@electricity/sim/generator-ac';
import { K, type KToonMaterial } from '@/style';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createCanal } from '../parts/canal';
import { createDial } from '../parts/holo-scope';
import { group, pickBox, roomy, tag } from '../world';

const ID = 'ac-power';
const CIRCUIT = `${ID}:circuit`;
const Z_LINE = -0.9;
const X_GRID = -2.9;
const X_MOTOR = 0.4;

export const acPower: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0);
  hall.stageRoot.add(set);
  const analogy = group('analogy');
  const circuit = group('circuit');
  set.add(analogy, circuit);
  const canal = createCanal();
  canal.group.position.set(-0.9, 0.2, 1.35);
  analogy.add(canal.group);
  const arrow = (c: string) => {
    const a = createVectorArrow({ color: c, radius: 0.05, headLength: 0.24, headRadius: 0.11, intensity: 1.6 });
    canal.group.add(a);
    return a;
  };
  const aS = arrow('white');
  const aP = arrow('yellow');
  const aQ = arrow('sky');
  const tS = tag('S', 22, 'white');
  const tP = tag('P', 22, 'yellow');
  const tQ = tag('Q', 22, 'sky');
  canal.group.add(tS, tP, tQ);
  const horseHit = pickBox(1.5, 1.4, 0.9, 0, 0.7, 0);
  canal.horse.add(horseHit);
  ctx.qa.probe('horse', () => canal.horse.localToWorld(new Vector3(0, 0.6, 0)));
  ctx.qa.probe('rope-90', () => canal.group.localToWorld(new Vector3(canal.bow.x + 0.2, 0, -2.6)));

  // ---------------------------------------------------------------- the real circuit
  // power triangle plate beside the motor (its subject)
  const tri = group('triangle', X_MOTOR + 2.0, 2.15, Z_LINE - 0.5);
  tri.rotation.y = -0.25;
  tri.scale.setScalar(0.72);
  tri.add(createDial(2.0));
  const triP = createVectorArrow({ color: 'yellow', radius: 0.035, headLength: 0.16, headRadius: 0.07, intensity: 1.5 });
  const triQ = createVectorArrow({ color: 'sky', radius: 0.035, headLength: 0.16, headRadius: 0.07, intensity: 1.5 });
  const triS = createVectorArrow({ color: 'white', radius: 0.04, headLength: 0.16, headRadius: 0.07, intensity: 1.5 });
  const triPhi = tag('φ', 18, 'mist');
  tri.add(triP, triQ, triS, triPhi);
  // grid box + meter, line with a lossy resistor, motor, capacitor bank
  const gridBox = new Mesh(new RoundedBoxGeometry(0.9, 1.5, 0.6, 3, 0.08), K.toon({ gradient: { bottom: 'slate', top: 'mist', range: [0, 1.5] }, gloss: 0.3 }));
  gridBox.position.set(X_GRID, 0.75, Z_LINE);
  const meterBox = new Mesh(new RoundedBoxGeometry(0.42, 0.55, 0.22, 2, 0.05), K.toon({ color: 'white', gloss: 0.4 }));
  meterBox.position.set(X_GRID + 0.75, 0.95, Z_LINE + 0.1);
  const meterScreen = new Mesh(G.box(0.3, 0.12, 0.02), K.glow({ color: 'teal', intensity: 1.2, keepHue: true, whiten: 0 }));
  meterScreen.position.set(X_GRID + 0.75, 1.05, Z_LINE + 0.22);
  const gridTag = tag('~ 230 V', 20, 'yellow');
  gridTag.position.set(X_GRID, 1.85, Z_LINE);
  const resistorMat = K.toon({ color: 'steel', gloss: 0.3 }) as unknown as KToonMaterial;
  const resistor = new Mesh(G.capsule(0.13, 0.9, 16).rotateZ(Math.PI / 2), resistorMat as unknown as ReturnType<typeof K.toon>);
  resistor.position.set(-1.25, 0.55, Z_LINE);
  const lossTag = tag('', 18, 'orange', 'mono');
  lossTag.position.set(-1.25, 0.95, Z_LINE);
  const drive = motor({ scale: 1.3, cut: 1.5 });
  drive.group.position.set(X_MOTOR, 0, Z_LINE - 0.1);
  drive.group.rotation.y = -Math.PI / 2;
  const bank = new Group();
  bank.position.set(X_MOTOR + 1.75, 0, Z_LINE + 0.45);
  const cab = new Mesh(new RoundedBoxGeometry(1.5, 0.22, 0.6, 2, 0.05), K.toon({ color: 'slate' }));
  cab.position.y = 0.11;
  bank.add(cab);
  const cans = [0, 1, 2, 3].map((i) => {
    const m = K.toon({ color: 'sky', gloss: 0.5, emissive: 'sky', emissiveIntensity: 0 });
    const can = new Mesh(G.cyl(0.15, 0.5, { seg: 24, bevel: 0.03 }), m);
    can.position.set(-0.54 + i * 0.36, 0.22, 0);
    can.castShadow = true;
    bank.add(can);
    return m;
  });
  const lineCurve = [new Vector3(X_GRID + 0.45, 0.55, Z_LINE), new Vector3(X_MOTOR - 0.7, 0.55, Z_LINE)];
  const line = createWire(lineCurve, { radius: 0.06, color: 'ink', repeat: 1.2, speed: 1.4, power: 0.8 });
  const lineQ = createWire(lineCurve.map((p) => p.clone().add(new Vector3(0, 0, 0.16))), { radius: 0.035, color: 'slate', pulseColor: 'sky', repeat: 2.2, speed: 0, power: 0 });
  const local = createWire([new Vector3(X_MOTOR - 0.7, 0.4, Z_LINE + 0.15), new Vector3(X_MOTOR - 0.7, 0.4, Z_LINE + 0.9), new Vector3(X_MOTOR + 1.0, 0.4, Z_LINE + 0.9), new Vector3(X_MOTOR + 1.0, 0.4, Z_LINE + 0.45)], { radius: 0.035, color: 'slate', pulseColor: 'sky', repeat: 2.2, speed: 0, power: 0 });
  for (const m of [gridBox, meterBox, resistor]) m.castShadow = true;
  circuit.add(tri, gridBox, meterBox, meterScreen, gridTag, resistor, lossTag, drive.group, bank, line, lineQ, local);
  const heat = [resistorMat];
  ctx.stage.actor(circuit);

  // one mise-en-scène at a time: the dock control touched decides which one the camera shows
  let view: 'canal' | 'circuit' = 'canal';
  const show = (v: typeof view): void => {
    if (view === v || !hall.isCurrent(ID)) return;
    view = v;
    ctx.stage.toggle(analogy, v === 'canal');
    ctx.stage.toggle(circuit, v === 'circuit');
    void ctx.camera.go(v === 'canal' ? ID : CIRCUIT, { duration: 1.4 });
  };
  const onCircuit = (): boolean => view === 'circuit';
  ui.onChange('phi10', () => show('canal'));
  ui.onChange('pf10', () => show('circuit'));
  ui.onChange('cap10', () => show('circuit'));

  // ------------------------------------------------------------------ state
  const st = { tv: 0, walk: 0 };
  const phi = (): number => (ui.value<number>('phi10') * Math.PI) / 180;
  const comp = () => powerCompensation(ui.value<number>('pf10'), ui.value<number>('cap10') * 1e-6);
  const before = () => powerCompensation(ui.value<number>('pf10'), 0);
  const q1Max = powerCompensation(AC_POWER.pfRange.min, 0).reactiveBeforeVar;
  const ground = new Vector3(0, 1, 0);
  const through = new Vector3();
  const hit = new Vector3();
  ctx.input.register(horseHit, {
    tooltip: OWN.horseHint,
    cursor: 'grab',
    enabled: () => hall.isCurrent(ID) && !onCircuit(),
    dragStart: () => canal.group.localToWorld(through.set(0, 0, 0)),
    drag: (e) => {
      const q = e.planePoint(ground, through, hit);
      if (!q) return;
      const l = canal.group.worldToLocal(q.clone());
      const a = Math.atan2(-l.z, l.x - canal.bow.x);
      ui.set('phi10', Math.round(Math.max(0, Math.min(80, (a * 180) / Math.PI))), { notify: true });
    },
  });
  const mid = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.6, 4.6, 7.6], target: [0.4, 0.5, 0.4], fov: 34, fit: { center: [0.4, 0.5, 0.4], radius: 3.3 } },
      [CIRCUIT]: { position: [0.0, 3.4, 6.0], target: [0.0, 1.0, -0.8], fov: 34, fit: { center: [0.0, 1.0, -0.8], radius: 3.4 } },
    },
    stage: {
      show: [analogy],
      enter: () => {
        view = 'canal';
      },
    },
    ui: {
      honesty: ['illustrative', { slowed: 50 }],
      controls: [
        { type: 'slider', id: 'phi10', label: OWN.ropeAngle, min: 0, max: 80, step: 1, value: 37, unit: '°' },
        { type: 'slider', id: 'pf10', label: doc(ID, 0), min: AC_POWER.pfRange.min, max: AC_POWER.pfRange.max, step: AC_POWER.pfRange.step, value: AC_POWER.pfRange.default, digits: 2 },
        { type: 'slider', id: 'cap10', label: doc(ID, 1), min: 0, max: 80, step: 2, value: 0, unit: 'μF' },
        {
          type: 'stats',
          id: 'read10',
          columns: 3,
          items: [
            { label: 'I', get: () => fmtUnit(comp().currentA, 'A', { digits: 2 }) },
            { label: 'S', get: () => fmtUnit(comp().apparentAfterVA, 'VA', { digits: 0 }) },
            { label: 'Q', get: () => fmtUnit(comp().reactiveAfterVar, 'var', { digits: 0 }), color: () => 'sky' },
            { label: 'P', get: () => fmtUnit(AC_POWER.activeW, 'W', { digits: 0 }), color: () => 'yellow' },
            { label: 'cos φ', get: () => `${comp().powerFactorAfter.toFixed(3).replace('.', ',')}${comp().capacitive ? ` (${OWN.capacitiveShort})` : ''}` },
            { label: OWN.lineLoss, get: () => fmtUnit(comp().lineLossW, 'W', { digits: 1 }), color: () => 'orange' },
          ],
        },
        { type: 'note', id: 'over10', icon: 'warning', color: 'amber', text: doc(ID, 2), visible: () => comp().capacitive && comp().reactiveAfterVar < -60 },
      ],
      callouts: [
        { anchor: () => drive.group.localToWorld(mid.set(0, 1.2, 0)), text: OWN.motor15, side: 'up', visible: onCircuit },
        { anchor: () => resistor.getWorldPosition(mid), text: OWN.lineResistance, side: 'down', visible: () => onCircuit() && roomy(hall) },
      ],
      hotspots: [
        { anchor: () => meterBox.getWorldPosition(mid), content: 'meter', visible: onCircuit },
        { anchor: () => bank.localToWorld(mid.set(0.7, 0.6, 0)), content: 'capacitor-bank', visible: onCircuit },
        { anchor: () => tri.localToWorld(mid.set(0.6, 0.6, 0.1)), content: 'power-triangle', visible: onCircuit },
      ],
    },
    probe: () => {
      const c = comp();
      const b = bargeAnalogy(ui.value<number>('phi10'));
      return { view, phi: ui.value<number>('phi10'), ropeDeg: (canal.ropeAngle() * 180) / Math.PI, P: b.active, Q: b.reactive, I: c.currentA, Q2: c.reactiveAfterVar, pf: c.powerFactorAfter, capacitive: c.capacitive, loss: c.lineLossW, water: canal.water.speed, lineQ: lineQ.material.power, local: local.material.power };
    },
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      st.tv += dt;
      // analogy
      const b = bargeAnalogy(ui.value<number>('phi10'));
      canal.setRope(phi());
      const k = 1.5;
      const o = canal.bow.clone().add(new Vector3(0, 0.15, 0));
      aS.set(o, new Vector3(Math.cos(phi()) * k, 0, -Math.sin(phi()) * k));
      aP.set(o.clone().add(new Vector3(0, 0.02, 0)), new Vector3(b.active * k, 0, 0));
      aQ.set(o.clone().add(new Vector3(0, 0.04, 0)), new Vector3(0, 0, -b.reactive * k));
      tS.position.copy(o).add(new Vector3(Math.cos(phi()) * k * 1.12, 0.14, -Math.sin(phi()) * k * 1.12));
      tP.position.copy(o).add(new Vector3(b.active * k + 0.2, 0.1, 0.14));
      tQ.position.copy(o).add(new Vector3(-0.2, 0.1, -b.reactive * k));
      canal.water.speed = -0.6 * b.active; // the barge moves forward: water flows back past it
      st.walk += dt * (1 + 4 * b.active);
      canal.legs.forEach((l, i) => (l.rotation.z = Math.sin(st.walk * 3 + (i % 2 ? Math.PI : 0)) * 0.35 * b.active));
      canal.barge.position.y = Math.sin(st.tv * 1.7) * 0.02;
      // power triangle of the motor after compensation (S scaled to the plate)
      const c = comp();
      const sMax = before().apparentBeforeVA;
      const sc = 1.3 / Math.max(1, sMax);
      const p0 = new Vector3(-0.75, -0.55, 0.05);
      triP.set(p0, new Vector3(AC_POWER.activeW * sc, 0, 0));
      triQ.set(p0.clone().add(new Vector3(AC_POWER.activeW * sc, 0, 0.01)), new Vector3(0, c.reactiveAfterVar * sc, 0));
      triS.set(p0.clone().setZ(0.07), new Vector3(AC_POWER.activeW * sc, c.reactiveAfterVar * sc, 0));
      triPhi.position.copy(p0).add(new Vector3(0.35, c.reactiveAfterVar >= 0 ? 0.1 : -0.1, 0.06));
      // circuit: active pulses, reactive rocking, line heat ∝ I²·R
      const qLine = Math.abs(c.reactiveAfterVar) / q1Max;
      const qLocal = Math.min(c.capacitorVar, before().reactiveBeforeVar) / q1Max;
      const rock = Math.sin(st.tv * 2 * Math.PI); // 100 Hz energy swing shown at 1 Hz
      lineQ.material.power = Math.min(1, qLine * 1.4);
      lineQ.material.speed = rock * 1.2 * (c.capacitive ? -1 : 1);
      local.material.power = Math.min(1, qLocal * 1.4);
      local.material.speed = -rock * 1.2;
      line.material.speed = 1.4;
      for (const m of heat) applyHeat(m, Math.min(1, (c.lineLossW / 33.2) * 0.85));
      lossTag.text = `I²·R = ${fmtUnit(c.lineLossW, 'W', { digits: 1 })}`;
      const lit = Math.round(ui.value<number>('cap10') / 20);
      cans.forEach((m, i) => (m.emissiveIntensity = i < lit ? 0.6 : 0));
      drive.speed = 9;
      drive.update?.(dt, st.tv);
      hall.sound.hum = 0.08 + 0.2 * (c.currentA / 10);
      hall.sound.turbine = 0.12;
      hall.sound.turbinePitch = 0.5;
    },
  };
};
