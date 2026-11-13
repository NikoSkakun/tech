/**
 * Step 7 `induction` — Faraday's law. A flat copper coil (axis vertical) on a ring stand, wired to a
 * centre-zero galvanometer and a red LED. The user drags a small cylindrical magnet (N down) up and down
 * through it — or the coil instead of the magnet. Model М5 (`createInduction`): Φ(z) of a dipole through the
 * coil, ℰ = −N·dΦ/dt, damped galvanometer, LED at ℰ ≥ 1,8 V; «Автомат» drops the magnet from 10 cm. A
 * translucent `magenta` disc in the coil plane glows ∝ Φ; the magnet carries its dipole lines; `cyan`
 * electrons run in the winding ∝ ℰ; the board plots Φ(t) and ℰ(t) over the last 3 s. Drawn ×2 (chip).
 */
import { Group, Mesh, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { createFlow, createHalo, type RibbonLine } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { INDUCTION, coilFlux, createInduction, magnetMoment, type MagnetGrade } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { createCoil } from '../parts/coil';
import { createGalvanometer } from '../parts/galvanometer';
import { S, glow, group } from '../world';

const ID = 'induction';
/** Drawing scale of the apparatus (coil, magnet and travel alike), honesty chip «збільшено ×2». */
const K2 = 2;
const U = S * K2;
const COIL_Y = 2.25;
const COIL_X = -0.6;
const A = INDUCTION.coilRadiusM * U;
const MAG = 0.005 * U;

export const inductionStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  // coil on a ring stand
  const coilHolder = new Group();
  const coil = createCoil({ r: A + 0.06, len: 0.3, turns: 16, wire: 0.03, formerColor: 'slate' });
  coil.group.rotation.z = Math.PI / 2;
  const fluxMat = glow(SEMANTIC.fieldB, 0);
  const fluxDisc = new Mesh(new Builder('disc').cyl(A - 0.01, 0.008, { seg: 40 }).geometry('toon'), fluxMat);
  coilHolder.add(coil.group, fluxDisc);
  const electrons = createFlow(ctx, {
    kind: 'electron',
    paths: coil.path.map((p) => new Vector3(-p.y, p.x, p.z)),
    count: ctx.quality.count(40, 14),
    radius: 0.026,
    speed: 0,
  });
  coilHolder.add(electrons);
  const sb = new Builder('ring-stand');
  sb.box(0.7, 0.08, 0.7, { at: [COIL_X - 1.2, 0, -0.2], r: 0.03, c: ['ink', 'slate'] });
  sb.cyl(0.05, COIL_Y + 0.3, { at: [COIL_X - 1.2, 0.08, -0.2], seg: 12, slot: 'metal', c: 'steel' });
  const stand = sb.build();
  const arm = new Builder('arm');
  arm.rod([-1.2, 0, -0.2], [-A - 0.12, 0, 0], 0.035, { slot: 'metal', c: 'steel' });
  coilHolder.add(arm.build().group);
  coilHolder.position.set(COIL_X, COIL_Y, 0);
  // the magnet: Ø10×10 mm cylinder ×2, N half (bottom) coral, S half (top) blue, with its dipole lines
  const magnet = new Group();
  const mb = new Builder('nd-magnet');
  mb.cyl(MAG, MAG, { at: [0, -MAG, 0], seg: 28, slot: 'gloss', c: SEMANTIC.poleN, bevel: 0.01 });
  mb.cyl(MAG, MAG, { at: [0, 0, 0], seg: 28, slot: 'gloss', c: SEMANTIC.poleS, bevel: 0.01 });
  magnet.add(mb.build().group);
  const dipole = createBLines(16 * 62, { width: 0.016, intensity: 1.0, dashSpeed: 0.25 });
  const lines: RibbonLine[] = [];
  for (let m = 0; m < 4; m++) {
    const phi = (m / 4) * Math.PI * 2 + 0.4;
    for (const L of [0.35, 0.6, 0.95, 1.4]) {
      const pts: Vector3[] = [];
      const th0 = Math.asin(Math.min(Math.sqrt((MAG * 1.2) / L), 1));
      // moment points down (N at the bottom): outside the magnet the field runs from the bottom up around
      for (let k = 0; k <= 60; k++) {
        const th = th0 + ((Math.PI - 2 * th0) * k) / 60;
        const r = L * Math.sin(th) ** 2;
        pts.push(new Vector3(r * Math.sin(th) * Math.cos(phi), -r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)));
      }
      lines.push({ points: pts });
    }
  }
  dipole.set(lines);
  magnet.add(dipole.mesh);
  // galvanometer + LED on the right, leads from the coil
  const galvo = createGalvanometer(1.05);
  galvo.group.position.set(1.35, 0, 0.1);
  galvo.group.rotation.y = -0.25;
  const lb = new Builder('led');
  lb.cyl(0.14, 0.08, { seg: 20, c: 'ink' });
  lb.cyl(0.075, 0.1, { at: [0, 0.08, 0], seg: 20, slot: 'glass', c: 'red' });
  lb.dome(0.075, 0.08, { at: [0, 0.18, 0], seg: 20, slot: 'glass', c: 'red' });
  const ledModel = lb.build();
  ledModel.group.position.set(0.45, 0, 0.75);
  const ledHalo = createHalo({ color: 'red', size: 0.5, intensity: 0 });
  ledHalo.position.set(0.45, 0.24, 0.75);
  const leadB = new Builder('leads');
  const c0 = new Vector3(COIL_X + A + 0.08, COIL_Y - 0.15, 0.05);
  leadB.tube([c0, new Vector3(COIL_X + A + 0.5, COIL_Y - 0.4, 0.1), new Vector3(0.6, 0.1, 0.4), new Vector3(0.45, 0.06, 0.65)], 0.02, { slot: 'metal', c: 'coral' });
  leadB.tube([c0.clone().setY(COIL_Y + 0.12), new Vector3(COIL_X + A + 0.7, COIL_Y + 0.2, -0.1), new Vector3(1.0, 1.4, -0.2), new Vector3(1.0, 1.05, -0.05)], 0.02, { slot: 'metal', c: 'blue' });
  const leads = leadB.build();
  set.add(coilHolder, stand.group, magnet, galvo.group, ledModel.group, ledHalo, leads.group);

  /* ------------------------------------------------------------------------------------- state */
  const sim = createInduction();
  const st = { zMag: 0.05, zCoil: 0, dragging: false, pointer: 0, t: 0, lit: false };
  const grade = (): MagnetGrade => (ui.value<string>('grade7') === 'ferrite' ? 'ferrite' : 'neodymium');
  const coilMode = (): boolean => ui.value<string>('move7') === 'coil';
  const phiMax = (): number => coilFlux('neodymium', 0);
  const apply = (): void => sim.set({ turns: ui.value<number>('n7'), grade: grade() });
  ui.onChange('n7', apply);
  ui.onChange('grade7', apply);
  const { min: zMin, max: zMax } = INDUCTION.zRangeM;
  const clampZ = (z: number): number => Math.min(Math.max(z, zMin), zMax);
  const through = new Vector3();
  const plane = new Vector3(0, 0, 1);
  const dragOn = (target: Group, which: 'mag' | 'coil') =>
    ctx.input.register(target, {
      tooltip: OWN.dragUpDown,
      cursor: 'ns-resize',
      enabled: () => bench.isCurrent(ID) && coilMode() === (which === 'coil'),
      dragStart: () => (st.dragging = true),
      drag: (e) => {
        const p = e.planePoint(plane, target.getWorldPosition(through));
        if (!p) return;
        set.worldToLocal(p);
        const z = (p.y - COIL_Y) / U;
        // only the relative position matters: keep z_rel = z_mag − z_coil inside ±10 cm
        if (which === 'mag') st.zMag = clampZ(z - st.zCoil) + st.zCoil;
        else st.zCoil = st.zMag - clampZ(st.zMag - z);
      },
      dragEnd: () => (st.dragging = false),
    });
  dragOn(magnet, 'mag');
  dragOn(coilHolder, 'coil');
  const autoDrop = (): void => {
    st.zCoil = 0;
    st.zMag = zMax;
    sim.drag(zMax, 1 / 60);
    sim.startAutoDrop();
    audio.play('whooshDown', { gain: 0.4 });
  };
  ctx.qa.probe('magnet7', magnet);
  ctx.qa.probe('coil7', coilHolder);
  ctx.qa.expose(ID, () => ({
    zRel: sim.state.zM,
    v: sim.state.vMPerS,
    fluxWb: sim.state.fluxWb,
    emfV: sim.state.emfV,
    needle: sim.state.needle,
    led: sim.state.ledBrightness,
    auto: sim.state.autoDropping,
    turns: ui.value<number>('n7'),
    moment: magnetMoment(grade()),
  }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.9, 3.7, 6.6],
        target: [0.15, 2.05, 0.1],
        fov: 34,
        frameAspect: 1.15,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.1, 2.1, 0.1], radius: 2.7 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        st.zMag = 0.05;
        st.zCoil = 0;
        st.dragging = false;
        apply();
        sim.drag(st.zMag, 1);
        sim.drag(st.zMag, 1);
      },
    },
    ui: {
      reset: true,
      hint: OWN.dragUpDown,
      honesty: [{ enlarged: K2 }],
      board: {
        title: `${OWN.fluxPhi} · ${OWN.emfE}`,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'chart7',
            chart: {
              height: 200,
              window: 3,
              x: { min: 0, max: 3, label: 't, s' },
              y: { min: 0, max: 40, label: 'Φ, μWb' },
              y2: { min: -3, max: 3, label: 'ЕРС, V' },
              series: [
                { id: 'phi', label: OWN.fluxPhi, color: SEMANTIC.fieldB },
                { id: 'emf', label: OWN.emfE, color: SEMANTIC.current, axis: 'y2' },
              ],
            },
            update: (chart) => {
              chart.push('phi', st.t, sim.state.fluxWb * 1e6);
              chart.push('emf', st.t, sim.state.emfV);
            },
          },
        ],
      },
      controls: [
        { type: 'slider', id: 'n7', label: DOC.coilTurns, ...INDUCTION.turnsRange, value: INDUCTION.turnsRange.default, digits: 0 },
        {
          type: 'segmented',
          id: 'grade7',
          label: OWN.magnetGrade,
          items: [
            { id: 'ferrite', label: OWN.grades[0] },
            { id: 'neodymium', label: OWN.grades[1] },
          ],
          value: 'neodymium',
        },
        {
          type: 'segmented',
          id: 'move7',
          label: DOC.move.title,
          items: [
            { id: 'magnet', label: DOC.move.items[0]! },
            { id: 'coil', label: DOC.move.items[1]! },
          ],
          value: 'magnet',
        },
        { type: 'readout', id: 'emf7', label: OWN.emfE, text: () => fmtUnit(sim.state.emfV, 'V', { digits: 2 }) },
        { type: 'readout', id: 'phi7', label: OWN.fluxPhi, text: () => fmtUnit(sim.state.fluxWb * 1e6, 'μWb', { digits: 1 }) },
        { type: 'button', id: 'auto7', label: DOC.autoDrop, icon: 'play', primary: true, onClick: autoDrop },
      ],
      callouts: [
        {
          anchor: () => (coilMode() ? coilHolder : magnet).getWorldPosition(v).setX(v.x - 0.55),
          text: OWN.dragUpDown,
          color: 'cyan',
          side: 'left',
          visible: () => !st.dragging && !sim.state.autoDropping && Math.abs(sim.state.emfV) < 0.02,
        },
      ],
      hotspots: [
        { anchor: galvo.face, content: 0 },
        { anchor: () => coilHolder.getWorldPosition(v).setX(v.x + A * 0.5).setY(v.y + 0.02), content: 1 },
        { anchor: () => ledModel.group.getWorldPosition(v).setY(v.y + 0.35), content: 'led' },
      ],
    },
    update(dt, t) {
      const h = Math.min(dt, 0.05);
      st.t += h;
      if (h <= 0) {
        /* frozen tick: nothing moves */
      } else if (st.dragging) sim.drag(st.zMag - st.zCoil, h);
      else {
        sim.step(h);
        if (sim.state.autoDropping || Math.abs(sim.state.zM - (st.zMag - st.zCoil)) > 1e-6) st.zMag = sim.state.zM + st.zCoil;
      }
      magnet.position.set(COIL_X, COIL_Y + st.zMag * U, 0);
      coilHolder.position.y = COIL_Y + st.zCoil * U;
      const s = sim.state;
      galvo.deflection = s.needle;
      galvo.update();
      fluxMat.intensity = 1.5 * Math.min(s.fluxWb / phiMax(), 1);
      fluxDisc.visible = s.fluxWb > phiMax() * 0.01;
      electrons.speed = -0.6 * Math.max(-1, Math.min(1, s.emfV / 1.0));
      electrons.density = Math.abs(s.emfV) > 0.01 ? 1 : 0.35;
      ledHalo.intensity = s.ledBrightness * 2.2;
      if (s.ledBrightness > 0.05 && !st.lit) audio.play('tick', { gain: 0.4, pitch: 1.6 });
      st.lit = s.ledBrightness > 0.05;
      dipole.mesh.intensity = grade() === 'neodymium' ? 1.3 : 0.6;
      bench.live.buzz = Math.min(Math.abs(s.emfV) / 1.5, 1) * 0.5;
      void t;
    },
  };
};
