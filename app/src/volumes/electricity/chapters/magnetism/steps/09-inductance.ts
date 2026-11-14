/**
 * Step 9 `inductance` — self-induction. Two parallel branches on one 12 V source behind the main switch S1:
 * lamp L1 + resistor, and lamp L2 + a big iron-core coil with the breaker S2 and a neon lamp across the coil.
 * Model М7 (`createRlCircuit`): S1 on → L1 at once, L2 over τ = L/R; S1 off → both fade together with τ' = L/2R
 * (L1's current reverses); breaking S2 → |ℰ| ≈ L·I₀/Δt: spark at S2 and the neon flashes above 80 V.
 * Wires carry `yellow` pulses ∝ current (direction = sign), the coil grows `magenta` loops ∝ I₂. Board: I₁, I₂
 * and u_L over the last 1,5 s. Click S1 / S2 in the scene, or use the dock.
 */
import { Mesh, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtUnit } from '@/content';
import { createArc, createSparks, createWire } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { createRlCircuit } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { createCoil } from '../parts/coil';
import { createLamp } from '../parts/lamp';
import { createBreaker, createKnifeSwitch } from '../parts/rl-board';
import { createSupply } from '../parts/supply';
import { group } from '../world';

const ID = 'inductance';
const Y = 0.07;
const X1 = -0.3;
const X2 = 1.25;
const ZT = -1.35;
const ZB = 1.35;
const p = (x: number, z: number): Vector3 => new Vector3(x, Y, z);

export const inductanceStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const board = new Builder('rl-board');
  board.box(4.9, 0.05, 3.4, { at: [0.05, -0.04, 0], r: 0.03, c: 'slate' });
  const supply = createSupply(0.7);
  supply.group.position.set(-2.05, 0, 0);
  supply.group.rotation.y = Math.PI / 2;
  const s1 = createKnifeSwitch(0.8);
  s1.group.position.set(-1.25, 0, ZT);
  const l1 = createLamp(1);
  l1.group.position.set(X1, 0, -0.45);
  l1.group.rotation.y = Math.PI / 2;
  const l2 = createLamp(1);
  l2.group.position.set(X2, 0, 0.12);
  l2.group.rotation.y = Math.PI / 2;
  board.box(0.22, 0.2, 0.62, { at: [X1, 0, 0.55], r: 0.08, c: 'amber' });
  for (const z of [0.38, 0.5, 0.62]) board.box(0.235, 0.21, 0.05, { at: [X1, 0, z], r: 0.02, c: z === 0.5 ? 'red' : 'ink' });
  const s2 = createBreaker(0.45);
  s2.group.position.set(X2, 0, 0.92);
  s2.group.rotation.y = Math.PI / 2;
  const coil = createCoil({ r: 0.25, len: 0.7, turns: 13, wire: 0.032, formerColor: 'ink' });
  coil.group.position.set(X2, 0.32, -0.78);
  coil.group.rotation.y = Math.PI / 2;
  const core = new Mesh(new Builder('core').cyl(0.16, 0.95, { axis: 'z', at: [0, 0, -0.5], seg: 24, slot: 'metal', c: 'steel' }).geometry('metal'), bench.mats.steel);
  core.position.set(X2, 0.32, -0.78);
  for (const z of [-1.21, -0.35]) board.box(0.44, 0.18, 0.1, { at: [X2, 0.0, z], r: 0.03, c: 'ink' });
  const neon = createLamp(0.75, true);
  neon.group.position.set(2.1, 0, -0.78);
  neon.group.rotation.y = -Math.PI / 2;
  // a small ignition coil in the corner (hotspot): primary terminals, tall secondary tower
  board.cyl(0.2, 0.75, { at: [2.15, 0, 0.75], seg: 24, c: 'ink' });
  board.cyl(0.08, 0.2, { at: [2.15, 0.75, 0.75], seg: 14, c: 'red' });
  board.cyl(0.05, 0.08, { at: [2.0, 0.72, 0.9], seg: 10, slot: 'metal', c: 'amber' });
  const boardModel = board.build();
  const loops = createBLines(5 * 66, { width: 0.022, intensity: 1.3, dashSpeed: 0.35 });
  const loopSet = [0.5, 0.65, 0.82, 1.0].map((ry) => {
    const pts: Vector3[] = [];
    for (let k = 0; k <= 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      // a flattened loop through the core (along z) closing outside, in the vertical x = X2 plane
      pts.push(new Vector3(X2, 0.32 + Math.sin(a) * ry * 0.36, -0.78 + Math.cos(a) * ry * 0.85));
    }
    return { points: pts, closed: true };
  });
  loops.set(loopSet);
  const arc = createArc({ from: [0, 0, 0], to: [0, 0.2, 0], color: 'yellow', branches: 1 });
  const sparks = createSparks(ctx, { color: 'yellow', size: 0.035 });
  // wires: segment currents I_src = I₁ + I₂ (left), I₂ (to branch 2), I₁ (branch 1), I₂ (branch 2)
  const w = (pts: Vector3[]) => createWire(pts, { radius: 0.03, color: 'ink', repeat: 3, speed: 0, power: 0 });
  const wires = {
    src: w([p(-2.0, -0.35), p(-2.0, ZT), p(-1.7, ZT)]),
    top1: w([p(-0.8, ZT), p(X1, ZT)]),
    top2: w([p(X1, ZT), p(X2, ZT)]),
    b1: w([p(X1, ZT), p(X1, ZB)]),
    b2: w([p(X2, ZT), p(X2, ZB)]),
    bot2: w([p(X2, ZB), p(X1, ZB)]),
    ret: w([p(X1, ZB), p(-2.0, ZB), p(-2.0, 0.35)]),
    neon: w([p(X2, -1.21), p(2.1, -1.21), p(2.1, -0.35), p(X2, -0.35)]),
  };
  set.add(boardModel.group, supply.group, s1.group, l1.group, l2.group, s2.group, coil.group, core, neon.group, loops.mesh, arc, sparks, ...Object.values(wires));

  /* ------------------------------------------------------------------------------------- state */
  const sim = createRlCircuit();
  const st = { t: 0, s1: 0, s2: 0, spark: false, neonGlow: 0, arcHold: 0 };
  const s1On = (): boolean => ui.value<string>('s19') === 'on';
  const apply = (): void =>
    sim.set({ s1On: s1On(), ironCore: ui.value<boolean>('core9'), breakTimeS: ui.value<number>('dt9') / 1000 });
  const setS2 = (closed: boolean): void => {
    sim.set({ s2Closed: closed });
    audio.play(closed ? 'click' : 'breaker', { gain: 0.5 });
  };
  ui.onChange('s19', () => (apply(), audio.play('relay')));
  ui.onChange('core9', apply);
  ui.onChange('dt9', apply);
  ctx.input.register(s1.group, { tooltip: 'S1', cursor: 'pointer', enabled: () => bench.isCurrent(ID), click: () => ui.set('s19', s1On() ? 'off' : 'on', { notify: true }) });
  ctx.input.register(s2.group, {
    tooltip: 'S2',
    cursor: 'pointer',
    enabled: () => bench.isCurrent(ID),
    click: () => (sim.params.s2Closed ? s1On() && setS2(false) : setS2(true)),
  });
  ctx.qa.probe('s1-9', s1.hit);
  ctx.qa.probe('s2-9', s2.hit);
  ctx.qa.expose(ID, () => ({ ...sim.state, s1On: s1On(), s2Closed: sim.params.s2Closed }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.2, 5.4, 5.1],
        target: [0.05, 0.3, 0.15],
        fov: 34,
        frameAspect: 1.2,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.05, 0.4, 0.1], radius: 2.7 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        sim.set({ s1On: s1On(), s2Closed: true });
        apply();
        for (let k = 0; k < 60; k++) sim.step(0.02);
        st.t = 0;
        st.spark = false;
      },
    },
    ui: {
      reset: true,
      honesty: [{ kind: 'simplified', text: DOC.rlSimplified }, 'illustrative'],
      board: {
        title: 'I(t), u_L(t)',
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'chart9',
            chart: {
              height: 200,
              window: 1.5,
              x: { min: 0, max: 1.5, label: 't, s' },
              y: { min: -1.5, max: 1.5, label: 'I, A' },
              y2: { min: -30, max: 30, label: 'u_L, V' },
              series: [
                { id: 'i1', label: 'I₁', color: 'yellow' },
                { id: 'i2', label: 'I₂', color: 'orange' },
                { id: 'u', label: 'u_L', color: SEMANTIC.fieldB, axis: 'y2' },
              ],
            },
            update: (chart) => {
              chart.push('i1', st.t, sim.state.i1A);
              chart.push('i2', st.t, sim.state.i2A);
              chart.push('u', st.t, Math.max(-30, Math.min(30, sim.state.inductorV)));
            },
          },
        ],
      },
      controls: [
        {
          type: 'segmented',
          id: 's19',
          label: 'S1',
          items: [
            { id: 'off', label: DOC.s1[1]! },
            { id: 'on', label: DOC.s1[0]! },
          ],
          value: 'on',
        },
        { type: 'toggle', id: 'core9', label: DOC.ironCore, value: true },
        { type: 'slider', id: 'dt9', label: DOC.breakTime, min: 0.1, max: 10, step: 0.1, value: 1, unit: 'ms', digits: 1 },
        { type: 'readout', id: 'peak9', label: `${OWN.peak} (${DOC.withoutLimiter})`, text: () => fmtUnit(sim.state.breakEmfDisplayV, 'V', { digits: 0 }) },
        { type: 'readout', id: 'w9', label: 'W = L·I²/2', text: () => fmtUnit(sim.state.storedJ, 'J', { digits: 2 }) },
        { type: 'button', id: 'break9', label: DOC.breakS2, icon: 'lightning', primary: true, onClick: () => setS2(false), visible: () => sim.params.s2Closed, disabled: () => !s1On() },
        { type: 'button', id: 'join9', label: DOC.rejoin, icon: 'link', onClick: () => setS2(true), visible: () => !sim.params.s2Closed },
      ],
      callouts: [
        { anchor: l1.top, text: OWN.lamp1, side: 'up' },
        // L2 stands in front of the coil: its label goes left, over the empty board, not onto the coil
        { anchor: l2.top, text: OWN.lamp2, side: 'left' },
        // under the neon lamp, over the board's free right edge (above, it crowded the coil's label at 720p)
        // (phones show three tags: the neon lamp's is the one dropped — it overlapped L2 in landscape)
        { anchor: () => neon.top.getWorldPosition(v).setY(v.y - 0.45), text: OWN.neon, side: 'down', priority: 3 },
        { anchor: () => coil.group.getWorldPosition(v).setY(v.y + 0.45), text: OWN.coilL, color: SEMANTIC.fieldB, side: 'up', priority: 0 },
      ],
      hotspots: [
        { anchor: s2.gap, content: 'contact-spark' },
        { anchor: () => l1.top.getWorldPosition(v).setX(v.x - 0.3), content: 'lamp-l1-off' },
        { anchor: () => set.localToWorld(v.set(2.15, 1.0, 0.75)), content: 'ignition-coil' },
      ],
    },
    update(dt, t) {
      const h = Math.min(dt, 0.05);
      st.t += h;
      sim.step(h);
      const s = sim.state;
      st.s1 += ((s1On() ? 0 : 1) - st.s1) * Math.min(dt * 12, 1);
      st.s2 += ((sim.params.s2Closed ? 0 : 1) - st.s2) * Math.min(dt * 14, 1);
      s1.open = st.s1;
      s1.update();
      s2.open = st.s2;
      s2.update();
      l1.brightness = s.lamp1;
      l2.brightness = s.lamp2;
      l1.update();
      l2.update();
      // the real flash lasts Δt + 30 ms; keep a short afterglow so the eye catches it
      st.neonGlow = Math.max(s.neonLit ? 1.2 : 0, st.neonGlow - dt * 2.5);
      st.arcHold = s.spark ? 0.3 : Math.max(st.arcHold - dt, 0);
      neon.brightness = st.neonGlow;
      neon.update();
      // pulses: speed ∝ segment current (sign = direction along the drawn wire), brightness ∝ |I|
      const drive = (wire: ReturnType<typeof createWire>, i: number): void => {
        wire.material.speed = 1.6 * i * 3;
        wire.material.power = Math.min(Math.abs(i) / 1.2, 1);
      };
      const src = s.i1A + s.i2A;
      drive(wires.src, src);
      drive(wires.top1, src);
      drive(wires.ret, src);
      drive(wires.top2, s.i2A);
      drive(wires.b1, s.i1A);
      drive(wires.b2, sim.params.s2Closed ? s.i2A : 0);
      drive(wires.bot2, s.i2A);
      drive(wires.neon, st.neonGlow);
      loops.mesh.visible = Math.abs(s.i2A) > 0.01;
      loops.mesh.intensity = 0.4 + 1.1 * Math.min(Math.abs(s.i2A) / 1.2, 1);
      // spark across S2 while the branch is torn
      s2.gap.getWorldPosition(v);
      set.worldToLocal(v);
      arc.from.set(v.x, v.y - 0.08, v.z - 0.2);
      arc.to.set(v.x, v.y + 0.06, v.z + 0.2);
      arc.visible = st.arcHold > 0;
      arc.power = Math.min(s.breakEmfDisplayV / 1200, 1) * Math.min(st.arcHold / 0.15, 1);
      if (s.spark && !st.spark) {
        sparks.burst([v.x, v.y, v.z], 10 + Math.round(Math.min(s.breakEmfDisplayV / 60, 30)), [0, 1, 0], 0.9);
        audio.play('spark', { gain: Math.min(0.3 + s.breakEmfDisplayV / 2000, 0.9) });
      }
      st.spark = s.spark;
      bench.live.hum = st.neonGlow * 0.5;
      bench.live.humPitch = 1.6;
      bench.live.buzz = Math.min(Math.abs(s.i2A) / 1.2, 1) * 0.25;
      void t;
    },
  };
};
