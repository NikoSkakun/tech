/**
 * Step 2 `turns-ratio` — the ring has straightened into the laminated core of a teaching transformer (stage param
 * `coreMorph` = 1). Turn counters over both coils; the turns are wound on and off as N₁ / N₂ change and the
 * secondary wire thickens with its rated current. Under the transformer a console of six meters, on the right the
 * load (rheostat + lamp), on the left the 230 V supply. The board carries the two sines (U₁ `coral`, U₂ `sky`, one
 * phase) and the six readings. Model: Т1 (`teachingTransformer`); the protection latch is the chapter's (the model
 * returns the no-load solution once, the load stays open until R changes).
 */
import { Vector3 } from 'three';
import { fmtNumber, fmtSI, fmtUnit } from '@/content';
import { createHalo, createWire } from '@/fx';
import { STATUS, type Chart } from '@/ui3d';
import { TEACHING, teachingTransformer, type TeachingResult } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot } from '../labels';
import { OWN } from '../labels-own';
import { createLampStand, createSource } from '../parts/faraday-kit';
import { createMeterConsole, createRheostat } from '../parts/meter-console';
import { CY, LIMB_X } from '../parts/teaching';
import { group, mesh, tag } from '../world';
import { shareTeaching } from './shared-teaching';
import { BoxGeometry } from 'three';
import { K } from '@/style';

const ID = 'turns-ratio';
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** Display frequency of the flows and needles (50 Hz → 1 Hz, «сповільнено ×50»). */
const SLOW = 50;

export const turnsRatio: StepFactory = (tx) => {
  const { ui } = tx;
  const T = shareTeaching(tx);
  const base = mesh(new BoxGeometry(3.5, 0.2, 1.1), K.toon({ color: 'slate', gloss: 0.3 }), 0, 0.1, 0);
  const meters = createMeterConsole([-2.05, -1.35, -0.65, 0.65, 1.35, 2.05], ['coral', 'coral', 'coral', 'sky', 'sky', 'sky']);
  meters.group.position.set(0, 0, 1.55);
  const source = createSource();
  source.group.position.set(-3.25, 0, -0.1);
  source.setPower(1);
  source.setSupply(1);
  const rheo = createRheostat(1.5);
  rheo.group.position.set(3.15, 0, -0.35);
  const bulb = createLampStand();
  bulb.group.position.set(3.05, 0, 0.75);
  const halo = createHalo({ color: 'yellow', size: 1.1, intensity: 0 });
  halo.position.set(3.05, 0.78, 0.75);
  const lead = (x: number, top: boolean): Vector3 => new Vector3(x, CY + (top ? 0.56 : -0.56), 0.24);
  const w = (pts: Vector3[]): ReturnType<typeof createWire> => createWire(pts, { radius: 0.028, color: 'ink', repeat: 1.4, speed: 1.2, power: 0, detail: 14 });
  const wires = {
    p: w([new Vector3(-3.47, 0.98, -0.05), new Vector3(-3.1, 2.4, 0.2), lead(-LIMB_X, true)]),
    p2: w([new Vector3(-3.03, 0.98, -0.05), new Vector3(-2.2, 1.0, 0.3), lead(-LIMB_X, false)]),
    s: w([lead(LIMB_X, true), new Vector3(2.3, 2.4, 0.2), new Vector3(2.4, 0.55, -0.35)]),
    s2: w([new Vector3(3.9, 0.55, -0.35), new Vector3(3.8, 0.4, 0.6), new Vector3(3.22, 0.22, 0.87)]),
    s3: w([new Vector3(2.88, 0.22, 0.87), new Vector3(2.0, 0.5, 0.6), lead(LIMB_X, false)]),
  };
  const n1Tag = tag('', 22, 'coral');
  n1Tag.position.set(-LIMB_X - 0.75, CY + 0.75, 0.3);
  const n2Tag = tag('', 22, 'sky');
  n2Tag.position.set(LIMB_X + 0.75, CY + 0.75, 0.3);
  const vptTag = tag('', 21, 'mist', 'mono');
  vptTag.position.set(0, CY + 1.6, 0.3);
  const labels = ['U₁', 'I₁', 'P₁', 'U₂', 'I₂', 'P₂'].map((t, i) => {
    const m = tag(t, 21, i < 3 ? 'coral' : 'sky');
    m.position.copy(meters.face(i)).add(meters.group.position).add(new Vector3(0, -0.32, 0.1));
    return m;
  });
  const set = group(`set:${ID}`, 0, 0, 0, [base, meters.group, source.group, rheo.group, bulb.group, halo, ...Object.values(wires), n1Tag, n2Tag, vptTag, ...labels]);
  tx.stageRoot.add(set);

  let latched = false;
  const n1 = (): number => ui.value<number>('n1');
  const n2 = (): number => roundTen(ui.value<number>('n2'));
  const r = (): number => ui.value<number>('r2');
  const open = (): boolean => ui.value<boolean>('open2');
  const solve = (): TeachingResult =>
    teachingTransformer({ primaryTurns: n1(), secondaryTurns: n2(), loadOhm: r(), loadConnected: !open(), supply: 'ac' });
  // the controls exist only after `ui.define` (scene.ts): start from the model's defaults
  let res = teachingTransformer({ primaryTurns: 500, secondaryTurns: 50, loadOhm: 2.3, loadConnected: true, supply: 'ac' });
  let phase = 0;
  let chartKey = '';
  const at = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => tx.stageRoot.localToWorld(out.set(x, y, z));
  };
  const drawScope = (c: Chart): void => {
    const u2 = res.secondaryV * Math.SQRT2;
    const key = `${Math.round(u2 * 10)}`;
    if (key === chartKey) return;
    chartKey = key;
    const range = niceCeil(Math.max(325, u2) * 1.1);
    c.setAxis('y', { min: -range, max: range });
    const xs: number[] = [];
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 0; i <= 160; i++) {
      const tms = (i / 160) * 40;
      const s = Math.sin((tms / 20) * Math.PI * 2);
      xs.push(tms);
      a.push(325 * s);
      b.push(u2 * s);
    }
    c.setData('u1', xs, a);
    c.setData('u2', xs, b);
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.2, 2.7, 8.9],
        target: [0.1, 1.35, 0.4],
        fov: 30,
        frameAspect: 1.5,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.1, 1.5, 0.4], radius: 4.4 },
      },
    },
    stage: {
      show: [T.group, set],
      params: { coreMorph: 1 },
      enter: (info) => {
        T.setTurns(n1(), n2(), info.instant);
        chartKey = '';
      },
    },
    ui: {
      hint: OWN.hint2,
      honesty: [{ slowed: SLOW }, { kind: 'notToScale', text: OWN.turnsDrawn }, 'simplified'],
      controls: [
        { type: 'slider', id: 'n1', label: doc(ID, 0), min: 300, max: 1000, step: 50, value: TEACHING.n1Range.default, digits: 0 },
        { type: 'slider', id: 'n2', label: doc(ID, 1), min: 10, max: 2000, scale: 'log', step: 2, snaps: [50, 100, 1000], value: TEACHING.n2Range.default, format: (v) => fmtNumber(roundTen(v)) },
        {
          type: 'slider',
          id: 'r2',
          label: doc(ID, 4),
          min: 1,
          max: 1000,
          scale: 'log',
          step: 2,
          value: TEACHING.loadRangeOhm.default,
          unit: 'Ω',
          digits: 1,
          format: (v) => fmtUnit(v, 'Ω', { digits: v < 10 ? 1 : 0 }),
          onChange: () => {
            if (latched) {
              latched = false;
              ui.set('open2', false);
            }
          },
        },
        { type: 'toggle', id: 'open2', label: doc(ID, 6), value: false, onChange: () => tx.sound.relay() },
        { type: 'note', id: 'sat2', text: doc(ID, 3), icon: 'warning', color: STATUS.warning, visible: () => res.saturated },
        { type: 'note', id: 'over2', text: doc(ID, 5), icon: 'warning', color: STATUS.warning, visible: () => res.overload && !latched },
        { type: 'note', id: 'trip2', text: OWN.trip2, icon: 'warning', color: STATUS.alarm, visible: () => latched && open() },
        { type: 'readout', id: 'vpt2', label: cap(doc(ID, 2)), text: () => fmtUnit(res.voltsPerTurn, 'V', { digits: 2 }) },
      ],
      board: {
        title: OWN.board2,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'scope2',
            chart: {
              height: 170,
              x: { min: 0, max: 40, label: 't, ms' },
              y: { min: -400, max: 400, label: 'U, V' },
              series: [
                { id: 'u1', label: 'U₁', color: 'coral' },
                { id: 'u2', label: 'U₂', color: 'sky' },
              ],
            },
            init: (c) => {
              chartKey = ''; // a new chart instance on every entry of the step
              drawScope(c);
            },
            update: drawScope,
          },
          {
            type: 'stats',
            id: 'meters2',
            columns: 3,
            items: [
              { label: 'U₁', get: () => fmtUnit(TEACHING.primaryV, 'V', { digits: 0 }), color: () => 'coral' },
              { label: 'I₁', get: () => fmtUnit(res.primaryA, 'A', { digits: res.primaryA < 0.1 ? 3 : 2 }), color: () => (res.overload ? STATUS.warning : 'coral') },
              { label: 'P₁', get: () => fmtSI(res.inputW, 'W'), color: () => 'coral' },
              { label: 'U₂', get: () => fmtUnit(res.secondaryV, 'V', { digits: res.secondaryV < 100 ? 1 : 0 }), color: () => 'sky' },
              { label: 'I₂', get: () => fmtUnit(res.secondaryA, 'A', { digits: res.secondaryA < 10 ? 2 : 1 }), color: () => 'sky' },
              { label: 'P₂', get: () => fmtSI(res.outputW, 'W'), color: () => 'sky' },
            ],
          },
        ],
      },
      callouts: [
        { anchor: at(-3.25, 1.05, -0.1), text: OWN.mains2, side: 'up' },
        { anchor: at(3.15, 0.8, -0.35), text: () => (open() ? `${OWN.load2} · ${doc(ID, 7)}` : OWN.load2), side: 'up' },
        { anchor: at(0, 0.05, 0.6), text: OWN.laminated, side: 'down' },
      ],
      hotspots: [
        { anchor: at(LIMB_X + 0.5, CY - 0.4, 0.3), content: hot(ID, 0) },
        { anchor: at(1.35, 0.95, 1.7), content: hot(ID, 1) },
      ],
    },
    probe: () => ({
      n1: n1(),
      n2: n2(),
      r: r(),
      open: open(),
      latched,
      u2: res.secondaryV,
      i1: res.primaryA,
      i2: res.secondaryA,
      p1: res.inputW,
      p2: res.outputW,
      saturated: res.saturated,
      overload: res.overload,
      shownN2: T.secondary.shown,
    }),
    update(dt) {
      res = solve();
      if (res.tripped && !latched) {
        latched = true;
        ui.set('open2', true);
        tx.sound.breaker();
        res = solve();
      }
      T.setTurns(n1(), n2());
      T.update(dt);
      phase = (phase + (dt * 50 * Math.PI * 2) / SLOW) % (Math.PI * 2);
      const s = Math.sin(phase);
      const b = Math.min(res.fluxRelative, 1.25);
      T.flux.density = 1;
      T.flux.speed = 1.5 * b * Math.cos(phase);
      T.ePrimary.speed = Math.min(1.6, 0.25 + res.primaryA) * s * 0.9;
      T.eSecondary.speed = Math.min(1.6, res.secondaryA / 8) * s * 0.9;
      const pw = Math.min(1, res.outputW / 230);
      T.energy.density = 0.15 + 0.85 * pw;
      const hot2 = res.overload ? Math.min(1, (res.primaryA - TEACHING.overloadA) / 1.5 + 0.35) : 0;
      T.heat(hot2 + (res.saturated ? 0.25 : 0), hot2);
      const lampP = Math.min(1.2, (res.outputW / 230) * 0.9);
      bulb.lamp.setPower(lampP);
      halo.intensity = lampP * 0.6;
      wires.p.material.power = 0.2 + 0.7 * pw;
      for (const k of ['s', 's2', 's3'] as const) wires[k].material.power = 0.75 * pw;
      rheo.setSlider(Math.log(r()) / Math.log(1000));
      const amp = [TEACHING.primaryV / 500, res.primaryA / 4, res.inputW / 400, res.secondaryV / 500, res.secondaryA / 25, res.outputW / 400];
      amp.forEach((v, i) => meters.setNeedle(i, v * (0.97 + 0.03 * Math.abs(s))));
      n1Tag.text = `N₁ = ${fmtNumber(n1())}`;
      n2Tag.text = `N₂ = ${fmtNumber(n2())}`;
      vptTag.text = `${fmtNumber(res.voltsPerTurn, { digits: 2 })} V / ${OWN.turn}`;
      tx.sound.hum = 0.1 + 0.15 * Math.min(1, res.inputW / 230) + (res.saturated ? 0.2 : 0);
    },
  };
};

/** N₂ moves in steps of 10 turns (document: «крок 10»); the log slider gives two significant digits. */
const roundTen = (v: number): number => Math.max(10, Math.round(v / 10) * 10);

/** 1, 2, 5 × 10ⁿ ceiling for an axis range. */
function niceCeil(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
