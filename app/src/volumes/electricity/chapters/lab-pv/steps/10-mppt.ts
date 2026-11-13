/**
 * Step 10 `mppt` — the P-V curve is a mountain and the tracker is a climber on it. The simulation session
 * (`createMpptSim`: perturb-and-observe, cloud ramp, partial shading, global scan) runs in engine time; its
 * state places the climber, shapes the ridge, feeds the oscilloscope on the board and the readouts.
 */
import { Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { createBeam } from '@/fx';
import { createMpptSim } from '@electricity/sim/lab-pv';
import type { StepFactory } from '../chapter';
import { doc } from '../content';
import { L, fill } from '../labels';
import { createClimber } from '../parts/climber';
import { createMountain } from '../parts/mountain';
import { createMpptSet } from '../parts/mppt-set';
import { blip, sound } from '../sound';
import { group } from '../world';

const ID = 'mppt';
const SCAN_S = 2.4;
const FIXED_V = 30;

export const mppt: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const sim = createMpptSim();
  const mountain = createMountain();
  const climber = createClimber();
  const dressing = createMpptSet(ctx);
  mountain.group.position.set(0, 0, 0.9);
  mountain.group.add(climber.group, climber.flags);
  const rope = createBeam({ from: [0, 5, 0], to: [0, 1, 0], color: 'mist', width: 0.025, intensity: 0.9, ripple: 0 });
  rope.visible = false;
  mountain.group.add(rope);
  const set = group('set:mppt', 0, 0, 0, [mountain.group, dressing.group]);
  lab.stageRoot.add(set);

  let curveSeen: unknown = null;
  let lastIter = -1;
  let lastV = sim.state.vRefV;
  let lastP = sim.state.pW;
  let dir = 0;
  let improved = true;
  let x = sim.state.vRefV; // voltage the figure is drawn at (eased toward the reference)
  const scan = { t: -1, flags: [] as Vector3[], best: -1, hold: 0 };
  const fixed = (): boolean => ui.value<boolean>('fixed10');
  const vNow = (): number => (fixed() ? FIXED_V : sim.state.vRefV);
  const pNow = (): number => sim.curve().powerAt(vNow());
  const eta = (): number => (fixed() ? pNow() / Math.max(1, sim.state.pMppW) : sim.state.etaLast10s);
  const p = new Vector3();
  const p2 = new Vector3();

  const startScan = (): void => {
    if (scan.t >= 0) return;
    scan.t = 0;
    scan.hold = 0;
    const c = sim.curve();
    scan.flags = Array.from({ length: 41 }, (_, j) => mountain.at(c.vocV * (0.1 + (0.85 * j) / 40), new Vector3()).setZ(-0.25));
    scan.best = -1;
    blip('whooshUp', 0.4);
  };
  ctx.qa.probe('climber10', climber.body);
  ctx.qa.expose('mppt10', () => ({ v: vNow(), p: pNow(), pMpp: sim.state.pMppW, vMpp: sim.state.vMppV, g: sim.state.gWm2, eta: eta(), iterations: sim.state.iterations, cloud: sim.state.cloudActive, scanning: scan.t >= 0, time: sim.state.timeS }));

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.6, 4.4, 11.2], target: [0, 1.9, 0.2], frameAspect: 1.05, fov: 33, fit: { center: [0, 1.8, 0], radius: 3.8 }, orbit: { azimuth: 0.5, polar: 0.25 } },
    },
    stage: {
      show: [set],
      enter() {
        sim.reset();
        curveSeen = null;
        lastIter = -1;
        dir = 0;
        scan.t = -1;
        scan.hold = 0;
        x = sim.state.vRefV;
        climber.setFlags([], 0, -1);
      },
    },
    ui: {
      hint: L.hint10,
      honesty: [{ slowed: 10 }, 'illustrative'],
      board: {
        title: L.board10,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'scope10',
            chart: {
              height: 210,
              window: 12,
              x: { min: 0, max: 12, label: 't, s' },
              y: { min: 0, max: 45, label: 'U, V' },
              y2: { min: 0, max: 500, label: 'P, W' },
              series: [
                { id: 'pm', label: L.scopeMax, color: 'mist', axis: 'y2', dash: true, opacity: 0.6 },
                { id: 'p', label: L.scopeP, color: 'yellow', axis: 'y2', width: 3 },
                { id: 'v', label: L.scopeV, color: 'sky', kind: 'step' },
              ],
            },
            update: (chart) => {
              const t = sim.state.timeS;
              chart.push('v', t, vNow());
              chart.push('p', t, pNow());
              chart.push('pm', t, sim.state.pMppW);
            },
          },
          {
            type: 'stats',
            id: 'stats10',
            items: [
              { label: doc(ID, 5), get: () => eta() * 100, unit: '%', digits: 1, color: () => (eta() > 0.985 ? 'green' : eta() > 0.9 ? 'amber' : 'coral') },
              { label: L.pTrack, get: () => pNow(), unit: 'W', digits: 0, color: () => 'yellow' },
              { label: L.vRef, get: () => vNow(), unit: 'V', digits: 1, color: () => 'sky' },
            ],
          },
          { type: 'note', id: 'fixedNote10', icon: 'warning', color: 'amber', visible: fixed, text: () => fill(L.fixedNote, { p: fmtNumber(Math.round((1 - eta()) * 1000) / 10) }) },
          { type: 'toggle', id: 'shade10', label: doc(ID, 6), value: false, onChange: (on) => sim.set({ partialShading: on }) },
          { type: 'toggle', id: 'fixed10', label: L.fixed, value: false },
        ],
      },
      controls: [
        { type: 'slider', id: 'dv10', label: doc(ID, 1), min: 0.1, max: 3, step: 0.1, value: 0.5, unit: 'V', digits: 1 },
        { type: 'slider', id: 'hz10', label: doc(ID, 2), min: 1, max: 20, step: 1, value: 5, unit: 'Hz' },
        { type: 'toggle', id: 'run10', label: doc(ID, 0), value: true },
        { type: 'button', id: 'cloud10', label: doc(ID, 3), icon: 'play', primary: true, onClick: () => sim.startCloud() },
        { type: 'button', id: 'scan10', label: doc(ID, 7), icon: 'search', onClick: startScan },
      ],
      callouts: [
        { anchor: () => climber.group.localToWorld(p2.set(0, 1.9, 0)), text: () => `${fmtNumber(Math.round(vNow() * 10) / 10)} V · ${fmtNumber(Math.round(pNow()))} W`, side: 'up', color: 'cyan' },
        { anchor: dressing.anchors.inverter, text: L.inverter, side: 'up' },
        { anchor: dressing.lamp.ball, text: () => `${fmtNumber(Math.round(sim.state.gWm2))} W/m²`, side: 'left', color: 'yellow' },
      ],
      hotspots: [
        { anchor: climber.body, content: 'climber' },
        { anchor: dressing.anchors.pv1, content: 'two-mppt-inputs' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      const scanning = scan.t >= 0;
      sim.set({ deltaVV: ui.value<number>('dv10'), frequencyHz: ui.value<number>('hz10'), running: ui.value<boolean>('run10') && !fixed() && !scanning });
      sim.step(dt);
      const c = sim.curve();
      if (c !== curveSeen) {
        curveSeen = c;
        mountain.setCurve((v) => c.powerAt(v), c.vocV);
      }
      if (sim.state.iterations !== lastIter) {
        if (lastIter >= 0) {
          dir = Math.sign(sim.state.vRefV - lastV);
          improved = sim.state.pW >= lastP;
          blip('tick', 0.18, improved ? 1.25 : 0.8);
        }
        lastIter = sim.state.iterations;
        lastV = sim.state.vRefV;
        lastP = sim.state.pW;
      }
      if (scanning) {
        scan.t += dt;
        const u = Math.min(1, scan.t / SCAN_S);
        x = c.vocV * (0.1 + 0.85 * u);
        climber.setFlags(scan.flags, Math.floor(u * 40) + 1, -1);
        if (u >= 1) {
          const res = sim.globalScan();
          scan.best = res.samples.findIndex((s) => s.vV === res.best.vV);
          scan.t = -1;
          scan.hold = 3;
          lastIter = -1;
          ui.toast(fill(L.scanDone, { v: fmtNumber(Math.round(res.best.vV * 10) / 10), p: fmtNumber(Math.round(res.best.pW)) }), { icon: 'target', duration: 5 });
          blip('success', 0.4);
        }
      } else {
        x += (vNow() - x) * Math.min(1, dt * 12);
        if (scan.hold > 0) {
          scan.hold -= dt;
          climber.setFlags(scan.flags, scan.hold > 0 ? 41 : 0, scan.best);
        }
      }
      climber.place(mountain.at(x, p), scanning ? 1 : dir, t);
      // the arrow over the head shows the next move: same direction if power grew, the opposite one if it fell
      climber.decide(fixed() || scanning || !ui.value<boolean>('run10') ? 0 : improved ? dir : -dir, improved);
      rope.visible = scanning;
      if (scanning) {
        rope.from.set(p.x, 4.6, 0);
        rope.to.set(p.x, p.y + 0.6, 0);
      }
      dressing.set(sim.state.gWm2 / 1000, (1000 - sim.state.gWm2) / 700, t);
      sound.power = pNow() / 440;
    },
  };
};
