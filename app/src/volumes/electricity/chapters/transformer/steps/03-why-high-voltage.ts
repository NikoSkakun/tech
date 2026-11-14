/**
 * Step 3 `why-high-voltage` — the «100 km» strip: station on the left, city on the right, a three-phase line of the
 * chosen voltage class between them. The voltage stops 10…750 kV swap the supports (poles → ever taller towers with
 * longer strings); the wires run cold or glow `orange`→`red` with the losses per metre, heat shimmer rises from
 * them, `cyan` electrons crowd the conductor in proportion to the current and `yellow` pulses carry the power. At
 * ΔU > 15 % the line «cannot» carry the power: the city goes dark. The board: P_loss(U) ∝ 1/U² with the operating
 * point, and the numbers. Model: Т2 (`transmission`).
 */
import { Vector3 } from 'three';
import { fmtNumber, fmtPercent, fmtSI, fmtUnit } from '@/content';
import { createFlow, createHeatShimmer } from '@/fx';
import { col } from '@/style';
import { STATUS, type Chart } from '@/ui3d';
import { TRANSMISSION, transmission } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot } from '../labels';
import { OWN } from '../labels-own';
import { createLineDiorama, type ClassKV } from '../parts/line-diorama';
import { group } from '../world';

const ID = 'why-high-voltage';
/** Diorama metres → world units (214 m strip → 11,8 units). */
const S = 0.055;
const YAW = 0.38;
const MIST = col('mist').lerp(col('steel'), 0.3);
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export const whyHighVoltage: StepFactory = (tx) => {
  const { ui, ctx } = tx;
  const d = createLineDiorama();
  const dio = group('line-diorama', 0, 0.05, 0, [d.group]);
  dio.scale.setScalar(S);
  // the strip runs from the station (front left) away to the city (back right): the near supports are big, and
  // the whole 214 m fits the free part of the frame between the board and the panel
  dio.rotation.y = YAW;
  const path0 = d.phasePath(110);
  const electrons = createFlow(ctx, { kind: 'electron', paths: [{ path: path0, closed: false }], count: 120, radius: 0.6, speed: 0, spread: 0.5, name: 'line-e' });
  const shimmer = createHeatShimmer({ width: 110, height: 22, intensity: 0 });
  shimmer.position.set(0, 30, 0);
  let dark = 0;
  d.group.add(electrons, shimmer);
  const set = group(`set:${ID}`, 0, 0, 0, [dio]);
  tx.stageRoot.add(set);

  const U = (): ClassKV => ui.value<number>('u3') as ClassKV;
  const P = (): number => ui.value<number>('p3');
  const res = (): ReturnType<typeof transmission> => transmission(P(), U());
  let shown: ClassKV | 0 = 0;
  let grow = 1;
  let curveKey = '';
  const at = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => d.group.localToWorld(out.set(x, y, z));
  };
  const showClass = (kv: ClassKV, instant: boolean): void => {
    if (kv === shown) return;
    for (const [k, g] of d.lines) g.visible = k === kv;
    electrons.setPaths([{ path: d.phasePath(kv), closed: false }]);
    shown = kv;
    grow = instant ? 1 : 0;
  };
  const drawCurve = (c: Chart): void => {
    const key = `${P()}|${U()}`;
    if (key === curveKey) return;
    curveKey = key;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let u = 10; u <= 760; u *= 1.06) {
      xs.push(u);
      ys.push(Math.min(2000, transmission(P(), u).lossFraction * 100));
    }
    c.setData('loss', xs, ys);
    const r = res();
    c.setMarker('op', { x: U(), y: Math.min(2000, r.lossFraction * 100), label: r.impossible ? doc(ID, 5) : fmtPercent(r.lossFraction, r.lossFraction < 0.01 ? 2 : 1) });
  };
  const impossibleText = (): string => doc(ID, 6).replace('…', fmtNumber(P()));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [-0.4, 2.8, 9.0],
        target: [0.3, 0.95, -0.4],
        fov: 32,
        frameAspect: 1.6,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.4, 1.0, 0], radius: 5.6 },
      },
    },
    stage: {
      show: [set],
      envTune: { top: 'bg.deep', mid: 'bg.violet', keyColor: 'amber.light', rimColor: 'pink', rimIntensity: 0.5 },
      enter: (info) => {
        shown = 0;
        showClass(U(), info.instant);
        curveKey = '';
      },
    },
    ui: {
      hint: OWN.hint3,
      honesty: ['notToScale', { kind: 'simplified', text: doc(ID, 10) }],
      controls: [
        { type: 'slider', id: 'u3', label: doc(ID, 1), min: 10, max: 750, stops: [...TRANSMISSION.voltagesKV], scale: 'log', value: 110, unit: 'kV', digits: 0, onChange: (v) => (showClass(v as ClassKV, false), tx.sound.click(0.8 + v / 900)) },
        { type: 'slider', id: 'p3', label: doc(ID, 7), min: TRANSMISSION.powerRangeMW.min, max: TRANSMISSION.powerRangeMW.max, step: TRANSMISSION.powerRangeMW.step, value: TRANSMISSION.powerRangeMW.default, unit: 'MW', digits: 0 },
        { type: 'note', id: 'no3', text: impossibleText, icon: 'warning', color: STATUS.alarm, visible: () => res().impossible },
        {
          type: 'stats',
          id: 'line3',
          columns: 2,
          items: [
            { label: OWN.current3, get: () => fmtUnit(res().currentA, 'A', { digits: 0 }), color: () => 'cyan' },
            { label: OWN.loss3, get: () => (res().impossible ? doc(ID, 5) : `${fmtSI(res().lossW, 'W')} · ${fmtPercent(res().lossFraction, res().lossFraction < 0.01 ? 2 : 1)}`), color: () => (res().impossible ? STATUS.alarm : res().lossFraction > 0.05 ? STATUS.warning : STATUS.ok) },
            { label: OWN.drop3, get: () => fmtPercent(res().dropFraction, 1), color: () => (res().impossible ? STATUS.alarm : 'white') },
            { label: OWN.station3, get: () => (res().impossible ? '—' : fmtSI(res().stationW, 'W')), color: () => 'yellow' },
          ],
        },
      ],
      board: {
        title: doc(ID, 8),
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'curve3',
            chart: {
              height: 170,
              x: { min: 10, max: 750, log: true, label: 'U, kV' },
              y: { min: 0.01, max: 2000, log: true, label: OWN.lossAxis },
              series: [{ id: 'loss', label: OWN.lossCurve, color: 'orange' }],
            },
            init: (c) => {
              curveKey = '';
              drawCurve(c);
            },
            update: drawCurve,
          },
        ],
      },
      callouts: [
        { anchor: at(d.plantAt.x + 4, 16, 0), text: () => (res().impossible ? OWN.plant3 : `${cap(doc(ID, 4))} = ${fmtSI(res().stationW, 'W')}`), side: 'up' },
        {
          anchor: at(d.cityAt.x + 4, 52, -2),
          text: () => (res().impossible ? `${OWN.city3} · ${doc(ID, 5)}` : `${cap(doc(ID, 3))} = ${fmtSI(P() * 1e6, 'W')}`),
          side: 'up',
        },
      ],
      hotspots: [
        { anchor: at(d.plantAt.x + 10, 8, 10), content: hot(ID, 0) },
        { anchor: at(d.cityAt.x - 18, 8, 16), content: hot(ID, 1) },
        { anchor: () => d.group.localToWorld(new Vector3(-26, d.topOf(U()) + 1.5, 0)), content: hot(ID, 2) },
        { anchor: at(0, 4, 26), title: doc(ID, 9), text: OWN.howWeCount },
      ],
    },
    probe: () => {
      const r = res();
      return { U: U(), P: P(), I: r.currentA, lossW: r.lossW, drop: r.dropFraction, impossible: r.impossible, shown, cityNight: d.city.night };
    },
    update(dt) {
      const r = res();
      grow = Math.min(1, grow + dt * 2.5);
      const line = d.lines.get(U());
      if (line) line.scale.y = 0.55 + 0.45 * (1 - Math.pow(1 - grow, 3));
      // wire temperature colour (Т2: 20 °C cold … 70 °C = the 110 kV case), red when the line cannot carry it
      const heat = r.impossible ? 1 : (r.wireTemperatureC - 20) / 50;
      const c = r.impossible ? col('red') : MIST.clone().lerp(col('orange'), Math.min(1, heat));
      d.wire.color.lerp(c, Math.min(1, dt * 4));
      // a hot conductor glows by itself (toon shading alone washes orange out to pale pink)
      d.wire.emissive.copy(d.wire.color);
      d.wire.emissiveIntensity += ((r.impossible ? 0.9 : 0.6 * Math.min(1, Math.max(0, heat))) - d.wire.emissiveIntensity) * Math.min(1, dt * 4);
      d.wire.power = r.impossible ? 0.15 : 0.25 + 0.6 * Math.min(1, P() / 300);
      shimmer.intensity = Math.min(1, heat) * 0.9;
      // electrons: density and drift ∝ current (the 10 kV case, 5774 A, is the full crowd)
      const share = Math.min(1, r.currentA / 1650);
      electrons.density = 0.08 + 0.92 * share;
      electrons.speed = 3 + 25 * share;
      dark += ((r.impossible ? 1 : 0) - dark) * Math.min(1, dt * 3);
      d.setDark(dark);
      tx.sound.buzz = r.impossible ? 0.25 : Math.min(0.3, heat * 0.25);
      tx.sound.buzzPitch = 1.4;
    },
  };
};
