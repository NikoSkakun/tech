/**
 * Step 6 `rotating-field` — the stator fed by three phases: its field (magenta arrow and field lines, coral N /
 * blue S lobes) turns with no moving parts. A compass follows it; then a squirrel cage replaces the compass and
 * runs a little behind the field (slip). Pole pairs p = 1…4 (3·p coils), load 0…300 % of T_n (Г4
 * `inductionMotorPoint`; above 250 % the motor stalls), «Поміняти дві фази» reverses everything. Slowed ×50.
 */
import { ConeGeometry, Group, Mesh, Vector3 } from 'three';
import { fmtPercent, fmtUnit } from '@/content';
import { createVectorArrow, RibbonLines } from '@/fx';
import { G } from '@/kit';
import { INDUCTION_MOTOR, inductionMotorPoint, synchronousSpeedRpm } from '@electricity/sim/generator-ac';
import { K, SEMANTIC } from '@/style';
import type { StepFactory } from '../chapter';
import { doc, splitPair } from '../labels';
import { OWN } from '../labels-own';
import { CAGE, createCageRotor } from '../parts/cage-rotor';
import { BORE_Y, createStator, polar } from '../parts/stator';
import { group, roomy, tag } from '../world';

const ID = 'rotating-field';
const SLOW = 50;
const BORE = 0.8;

/** Field-line polylines in the bore for p pole pairs, unrotated: S lobes at j·2π/p, N lobes half-way between. */
function fieldLines(p: number): { points: Vector3[] }[] {
  const out: { points: Vector3[] }[] = [];
  if (p === 1) {
    for (const off of [-0.45, -0.15, 0.15, 0.45]) {
      const half = Math.sqrt(BORE * BORE - off * off) * 0.95;
      // B points from the N side (x < 0) to the S side (x > 0)
      out.push({ points: [new Vector3(-half, 0, -off), new Vector3(half, 0, -off)] });
    }
    return out;
  }
  for (let j = 0; j < p; j++) {
    const n = ((j + 0.5) * 2 * Math.PI) / p;
    for (const s of [n - Math.PI / p, n + Math.PI / p]) {
      for (const depth of [0.25, 0.45]) {
        const pts: Vector3[] = [];
        for (let i = 0; i <= 16; i++) {
          const u = i / 16;
          const a = n + (s - n) * u;
          const rr = BORE * 0.95 * (1 - depth * Math.sin(Math.PI * u));
          pts.push(new Vector3(Math.cos(a) * rr, 0, -Math.sin(a) * rr));
        }
        out.push({ points: pts });
      }
    }
  }
  return out;
}

export const rotatingField: StepFactory = (hall) => {
  const { ctx, ui } = hall;
  const set = group(ID, 0, 0.16, 0.2);
  hall.stageRoot.add(set);
  const machine = group('machine');
  machine.scale.setScalar(1.45);
  set.add(machine);
  const stators = [1, 2, 3, 4].map((p) => {
    const s = createStator(p);
    machine.add(s.group);
    ctx.stage.actor(s.group, { appear: 'fade' });
    return s;
  });
  // field: lines + N/S lobes + arrow(s), all in a group that turns with the field angle
  const field = group('field', 0, BORE_Y, 0);
  machine.add(field);
  const lineSets = [1, 2, 3, 4].map((p) => {
    const l = new RibbonLines({ capacity: 400, color: SEMANTIC.fieldB, width: 0.045, intensity: 1.3, dashRepeat: 3, dashStrength: 0.8, dashSpeed: 0.8, keepHue: true });
    l.setLines(fieldLines(p));
    l.position.y = 0.42;
    field.add(l);
    return l;
  });
  const lobeGeo = G.sphere(0.17, 16);
  const lobes = [1, 2, 3, 4].map((p) => {
    const g = new Group();
    for (let j = 0; j < p; j++) {
      const sA = (j * 2 * Math.PI) / p;
      const nA = ((j + 0.5) * 2 * Math.PI) / p;
      const sM = new Mesh(lobeGeo, K.glow({ color: SEMANTIC.poleS, intensity: 1.5, keepHue: true, whiten: 0 }));
      sM.position.copy(polar(BORE + 0.05, sA, 0.35));
      const nM = new Mesh(lobeGeo, K.glow({ color: SEMANTIC.poleN, intensity: 1.5, keepHue: true, whiten: 0 }));
      nM.position.copy(polar(BORE + 0.05, nA, 0.35));
      g.add(sM, nM);
    }
    field.add(g);
    return g;
  });
  const bArrow = createVectorArrow({ color: SEMANTIC.fieldB, radius: 0.05, headLength: 0.26, headRadius: 0.12, intensity: 1.6 });
  bArrow.set(new Vector3(-0.55, 0.42, 0), new Vector3(1.1, 0, 0));
  field.add(bArrow);

  // compass on a pivot (needle N end coral follows B)
  const compass = group('compass', 0, BORE_Y + 0.05, 0);
  const needle = new Group();
  const nCone = new Mesh(new ConeGeometry(0.11, 0.55, 4).rotateZ(-Math.PI / 2).translate(0.275, 0, 0), K.toon({ color: SEMANTIC.poleN, gloss: 0.6 }));
  const sCone = new Mesh(new ConeGeometry(0.11, 0.55, 4).rotateZ(Math.PI / 2).translate(-0.275, 0, 0), K.toon({ color: SEMANTIC.poleS, gloss: 0.6 }));
  needle.add(nCone, sCone);
  const dish = new Mesh(G.cyl(0.62, 0.08, { seg: 48 }), K.toon({ color: 'mist', gloss: 0.3 }));
  dish.position.y = -0.12;
  const pin = new Mesh(G.cyl(0.05, 0.4, { seg: 12 }), K.metal({ color: 'steel' }));
  pin.position.y = -0.5;
  compass.add(dish, pin, needle);
  machine.add(compass);
  ctx.stage.actor(compass);

  const cage = createCageRotor();
  cage.group.position.y = BORE_Y;
  machine.add(cage.group);
  ctx.stage.actor(cage.group);
  const tags = { field: tag('', 20, SEMANTIC.fieldB, 'mono'), rotor: tag('', 20, 'orange', 'mono'), slip: tag('', 20, 'white', 'mono') };
  // one row just beyond the far rim of the stator («над ротором … між ними — ковзання»), inside the close shot
  tags.field.position.set(-1.9, 1.7, -2.55);
  tags.rotor.position.set(1.9, 1.7, -2.55);
  tags.slip.position.set(0, 1.7, -2.55);
  const tagGroup = group('indicators', 0, 0, 0, [tags.field, tags.rotor, tags.slip]);
  set.add(tagGroup);
  ctx.stage.actor(tagGroup, { appear: 'fade' });

  // ------------------------------------------------------------------ state
  const st = { field: 0, rotor: 0, rotorRpm: 0, needle: 0, dir: 1 as 1 | -1, stalled: false, dotPhase: 0, tv: 0 };
  const cageMode = (): boolean => ui.value<string>('mode6') === 'cage';
  const p = (): number => Math.round(ui.value<number>('p6'));
  const load = (): number => ui.value<number>('load6');
  const point = () => inductionMotorPoint(cageMode() ? load() : 0, p());
  const ns = (): number => synchronousSpeedRpm(50, p());
  const currents = new Float32Array(CAGE.bars);
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
  const restart = (): void => {
    st.rotorRpm = 0;
    st.stalled = false;
  };
  const sync = (instant: boolean): void => {
    stators.forEach((s, i) => {
      const want = i + 1 === p();
      if (ctx.stage.shown(s.group) !== want) ctx.stage.toggle(s.group, want, { instant });
    });
    if (ctx.stage.shown(compass) === cageMode()) ctx.stage.toggle(compass, !cageMode(), { instant });
    if (ctx.stage.shown(cage.group) !== cageMode()) ctx.stage.toggle(cage.group, cageMode(), { instant });
    if (ctx.stage.shown(tagGroup) !== cageMode()) ctx.stage.toggle(tagGroup, cageMode(), { instant });
    lineSets.forEach((l, i) => (l.visible = i + 1 === p()));
    lobes.forEach((l, i) => (l.visible = i + 1 === p()));
    bArrow.visible = p() === 1;
  };
  const mid = new Vector3();
  const zoneText = (): string => (st.stalled ? doc(ID, 7) : point().zone === 'overload' ? `${OWN.zoneOverload} (${doc(ID, 5)})` : OWN.zoneNormal);

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.3, 8.0, 5.0], target: [0, 1.45, 0.3], fov: 34, fit: { center: [0, 1.45, 0.3], radius: 2.75 } },
    },
    stage: {
      show: [set, stators[0]!.group, compass],
      enter: (info) => {
        st.field = 0;
        st.needle = 0;
        st.dir = 1;
        restart();
        if (cageMode()) st.rotorRpm = point().speedRpm; // a deep link opens on a running motor
        sync(info.instant);
      },
    },
    ui: {
      honesty: [{ slowed: SLOW }],
      controls: [
        {
          type: 'segmented',
          id: 'mode6',
          items: splitPair(doc(ID, 0)).map((label, i) => ({ id: i === 0 ? 'compass' : 'cage', label })),
          value: 'compass',
          onChange: (v) => {
            ui.set('p6', v === 'cage' ? 2 : 1);
            restart();
            hall.sound.relay();
          },
        },
        { type: 'slider', id: 'p6', label: doc(ID, 1), min: 1, max: 4, step: 1, value: 1 },
        { type: 'slider', id: 'load6', label: doc(ID, 4), min: 0, max: 300, step: 5, value: 100, unit: '%', visible: () => cageMode() },
        {
          type: 'stats',
          id: 'read6',
          columns: 3,
          items: [
            { label: 'n_s', get: () => fmtUnit(ns(), 'rpm', { digits: 0 }), color: () => SEMANTIC.fieldB },
            { label: 'n', get: () => (cageMode() ? fmtUnit(Math.abs(st.rotorRpm), 'rpm', { digits: 0 }) : '—'), color: () => 'orange' },
            { label: 's', get: () => (cageMode() && !st.stalled ? fmtPercent(point().slip ?? 0, 1) : '—') },
          ],
        },
        {
          type: 'note',
          id: 'zone6',
          icon: 'warning',
          text: zoneText,
          color: () => (st.stalled ? 'red' : point().zone === 'overload' ? 'amber' : 'green'),
          visible: () => cageMode(),
        },
        {
          type: 'button',
          id: 'swap6',
          label: doc(ID, 9),
          icon: 'resetView',
          onClick: () => {
            st.dir = st.dir > 0 ? -1 : 1;
            hall.sound.relay();
            ui.toast(st.dir > 0 ? OWN.dirCcw : OWN.dirCw, { icon: 'resetView' });
          },
        },
        {
          type: 'button',
          id: 'reset6',
          label: doc(ID, 8),
          icon: 'resetView',
          primary: true,
          visible: () => st.stalled,
          onClick: () => {
            ui.set('load6', 100);
            restart();
          },
        },
      ],
      callouts: [
        { anchor: () => machine.localToWorld(polar(1.7, 0.4, BORE_Y + 0.3, mid)), text: OWN.statorCoils, side: 'right', visible: () => roomy(hall) },
      ],
      hotspots: [
        { anchor: () => cage.group.localToWorld(mid.copy(cage.bar0)), content: 'cage-bars', visible: () => cageMode() },
        { anchor: () => tags.slip.getWorldPosition(mid).add(new Vector3(0, -0.3, 0.25)), content: 'slip-indicator', visible: () => cageMode() },
        { anchor: () => machine.localToWorld(polar(1.45, 2.2, BORE_Y + 0.4, mid)), content: 'stator' },
      ],
    },
    probe: () => ({
      mode: ui.value<string>('mode6'),
      p: p(),
      ns: ns(),
      n: point().speedRpm,
      rotorRpm: st.rotorRpm,
      slip: point().slip,
      stalled: st.stalled,
      dir: st.dir,
      field: st.field,
      needle: st.needle,
      shownStator: stators.findIndex((s) => ctx.stage.shown(s.group)) + 1,
    }),
    update(dt) {
      if (!hall.isCurrent(ID)) return;
      sync(false);
      st.tv += dt;
      const nsr = ns();
      st.field += (st.dir * 2 * Math.PI * (nsr / 60) * dt) / SLOW;
      field.rotation.y = st.field;
      // compass: a damped follower of the field direction
      st.needle += wrap(st.field - st.needle) * Math.min(1, dt * 14);
      needle.rotation.y = st.needle;
      // cage: rotor speed eases toward the model's operating point (fixed 1,5 s start ramp, Г4 note)
      const pt = point();
      if (cageMode() && pt.stalled && !st.stalled) {
        st.stalled = true;
        hall.sound.error();
      }
      const target = cageMode() && !st.stalled ? st.dir * pt.speedRpm : 0;
      const rate = (nsr / INDUCTION_MOTOR.startRampS) * (st.stalled ? 1.6 : 1);
      st.rotorRpm += Math.max(-rate * dt, Math.min(rate * dt, target - st.rotorRpm));
      st.rotor += (2 * Math.PI * (st.rotorRpm / 60) * dt) / SLOW;
      cage.group.rotation.y = st.rotor;
      // bar currents: ∝ slip of the bar relative to the field, sign alternating with the field pattern
      const slipNow = Math.min(1, Math.abs(st.dir * nsr - st.rotorRpm) / nsr / 0.14);
      for (let k = 0; k < CAGE.bars; k++) currents[k] = Math.sin(p() * (cage.barAngle(k) + st.rotor - st.field)) * (0.15 + 0.85 * slipNow);
      st.dotPhase += dt * (0.4 + 1.2 * slipNow);
      cage.setCurrents(currents, st.dotPhase);
      // coil glow follows the phase currents (electrical angle = p × field angle)
      const s = stators[p() - 1]!;
      const we = p() * st.field;
      s.coilMats.forEach((m, j) => (m.emissiveIntensity = 0.1 + 0.7 * Math.abs(Math.cos(we - st.dir * (s.phaseOf[j]! * 2 * Math.PI) / 3))));
      tags.field.text = `${OWN.fieldTag}: ${fmtUnit(nsr, 'rpm', { digits: 0 })}`;
      tags.rotor.text = `${OWN.rotorTag}: ${fmtUnit(Math.abs(st.rotorRpm), 'rpm', { digits: 0 })}`;
      tags.slip.text = `${OWN.slipTag} ${st.stalled ? '—' : fmtPercent(Math.max(0, 1 - Math.abs(st.rotorRpm) / nsr), 1)}`;
      hall.sound.hum = 0.12 + 0.25 * slipNow;
      hall.sound.turbine = cageMode() ? 0.1 + 0.25 * Math.abs(st.rotorRpm) / 3000 : 0;
      hall.sound.turbinePitch = 0.3 + Math.abs(st.rotorRpm) / 3000;
      hall.sound.buzz = st.stalled ? 0.4 : 0;
    },
  };
};
