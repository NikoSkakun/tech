/**
 * Step 6 `losses-efficiency` — the two «pockets» of losses side by side. Left: a slice of a disc winding whose
 * copper glows `orange` with the load losses P_k·β². Right: a steel bar end-on — a pack of sheets of thickness d or
 * one solid block — with the `cyan` eddy loops in its face (big and bright in a solid block, thin and faint per
 * sheet), the bar glowing `red` when solid; above it a window of domains flipping with the field (hysteresis).
 * «Послухати» plays the 100 Hz hum with its overtones and shows the sound rings; «перенапруга +10 %» makes it
 * louder (magnetostriction ∝ B²). The board: η(β) of the old and the modern 400 kVA transformer with the operating
 * point, and the loss readings. Model: Т5 (`transformerEfficiency`, `optimumLoad`, `eddyLossWPerKg`).
 */
import { CylinderGeometry, Vector3 } from 'three';
import { fmtNumber, fmtPercent, fmtSI, fmtUnit } from '@/content';
import { applyHeat, createPulseRings } from '@/fx';
import { STATUS, type Chart } from '@/ui3d';
import { EDDY_SHEET, eddyLossWPerKg, optimumLoad, transformerEfficiency, type TransformerGeneration } from '@electricity/sim/transformer';
import type { StepFactory } from '../chapter';
import { doc, hot, splitCaps } from '../labels';
import { OWN } from '../labels-own';
import { createDomains } from '../parts/domains';
import { BAR, createEddyBar, createWindingSlice } from '../parts/eddy-bar';
import { group, mesh, tag } from '../world';

const ID = 'losses-efficiency';
/** Field display: 50 Hz shown at 1 Hz («сповільнено ×50»). */
const SLOW = 50;
const BAR_X = 1.35;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const WIND_X = -2.0;

export const lossesEfficiency: StepFactory = (tx) => {
  const { ui, ctx } = tx;
  const plinth = (x: number): ReturnType<typeof mesh> => mesh(new CylinderGeometry(1.25, 1.35, 0.3, 48), tx.mats.plinth, x, 0.15, 0);
  const slice = createWindingSlice();
  slice.model.group.position.set(WIND_X, 0.3, 0);
  slice.model.group.rotation.y = 0.35;
  const bar = createEddyBar(ctx);
  bar.group.position.set(BAR_X, 0.3, 0);
  const domains = createDomains();
  domains.group.position.set(BAR_X, 2.55, 0.1);
  const rings = createPulseRings({ color: 'mist', size: 4.2, amount: 3, intensity: 0 });
  rings.position.set(BAR_X, 0.9, 0);
  const pkTag = tag('', 21, 'orange');
  pkTag.position.set(WIND_X, 2.95, 0.2);
  const set = group(`set:${ID}`, 0, 0, 0, [plinth(WIND_X), plinth(BAR_X), slice.model.group, bar.group, domains.group, rings, pkTag]);
  tx.stageRoot.add(set);

  const beta = (): number => ui.value<number>('beta6') / 100;
  const gen = (): TransformerGeneration => (ui.value<string>('gen6') === 'old' ? 'old' : 'modern');
  const d = (): number => ui.value<number>('d6');
  const solid = (): boolean => ui.value<boolean>('solid6');
  const over = (): boolean => ui.value<boolean>('over6');
  let listen = 0;
  let phase = 0;
  let curveKey = '';
  const eta = (): ReturnType<typeof transformerEfficiency> => transformerEfficiency(gen(), beta());
  const eddy = (): ReturnType<typeof eddyLossWPerKg> => eddyLossWPerKg(d());
  const eddyText = (): string => {
    const e = eddy();
    return `${fmtNumber(e.wPerKg, { digits: e.wPerKg < 1 ? 3 : 1 })} W/kg${e.estimateOnly ? ` (${doc(ID, 6)})` : ''}`;
  };
  const at = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => tx.stageRoot.localToWorld(out.set(x, y, z));
  };
  const drawCurves = (c: Chart): void => {
    const key = `${gen()}|${Math.round(beta() * 100)}`;
    if (key === curveKey) return;
    if (!curveKey.startsWith(gen())) {
      const xs: number[] = [];
      const ys: Record<TransformerGeneration, number[]> = { old: [], modern: [] };
      for (let i = 2; i <= 120; i += 2) {
        xs.push(i);
        for (const g of ['old', 'modern'] as const) ys[g].push(transformerEfficiency(g, i / 100).efficiency * 100);
      }
      c.setData('old', xs, ys.old);
      c.setData('modern', xs, ys.modern);
    }
    curveKey = key;
    const e = eta();
    c.setMarker('op', beta() > 0.01 ? { x: beta() * 100, y: e.efficiency * 100, label: fmtPercent(e.efficiency, 2) } : null);
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [-0.2, 3.1, 7.8],
        target: [-0.3, 1.45, 0],
        fov: 32,
        frameAspect: 1.35,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [-0.3, 1.5, 0], radius: 3.3 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        curveKey = '';
        listen = 0;
        bar.set(d(), solid());
      },
    },
    ui: {
      hint: OWN.hint6,
      honesty: [{ slowed: SLOW }, { kind: 'notToScale', text: OWN.sheets6 }, 'simplified'],
      controls: [
        { type: 'slider', id: 'beta6', label: doc(ID, 0), min: 0, max: 120, step: 1, value: 50, unit: '%', digits: 0 },
        { type: 'segmented', id: 'gen6', items: splitCaps(doc(ID, 1)).map((label, i) => ({ id: i === 0 ? 'old' : 'modern', label })), value: 'old' },
        {
          type: 'slider',
          id: 'd6',
          label: doc(ID, 3),
          min: EDDY_SHEET.thicknessRangeMm.min,
          max: EDDY_SHEET.thicknessRangeMm.max,
          step: EDDY_SHEET.thicknessRangeMm.step,
          value: EDDY_SHEET.thicknessRangeMm.default,
          unit: 'mm',
          digits: 2,
          disabled: () => solid(),
          onChange: (v) => bar.set(v, solid()),
        },
        { type: 'toggle', id: 'solid6', label: doc(ID, 4), value: false, onChange: (v) => bar.set(d(), v) },
        { type: 'toggle', id: 'over6', label: OWN.over6, value: false },
        { type: 'note', id: 'hot6', text: doc(ID, 8), icon: 'warning', color: STATUS.alarm, visible: () => solid() },
        { type: 'button', id: 'listen6', label: doc(ID, 9), icon: 'soundOn', onClick: () => (listen = 6) },
      ],
      board: {
        title: OWN.board6,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'eta6',
            chart: {
              height: 160,
              x: { min: 0, max: 120, label: 'β, %' },
              y: { min: 97.6, max: 99.6, label: 'η, %' },
              series: [
                { id: 'old', label: OWN.oldGen, color: 'orange' },
                { id: 'modern', label: OWN.newGen, color: 'green' },
              ],
            },
            init: (c) => {
              curveKey = '';
              drawCurves(c);
            },
            update: drawCurves,
          },
          {
            type: 'stats',
            id: 'loss6',
            columns: 2,
            items: [
              { label: OWN.p0, get: () => fmtSI(eta().noLoadKW * 1000, 'W'), color: () => 'amber' },
              { label: 'P_k·β²', get: () => fmtSI(eta().loadLossKW * 1000, 'W'), color: () => 'orange' },
              { label: OWN.eta, get: () => (beta() > 0 ? fmtPercent(eta().efficiency, 2) : '—'), color: () => STATUS.ok },
              { label: OWN.perYear, get: () => fmtUnit(optimumLoad(gen()).annualNoLoadKWh, 'kWh', { digits: 0 }) },
              { label: cap(doc(ID, 5)), get: () => (solid() ? '—' : eddyText()), color: () => (solid() ? STATUS.alarm : 'cyan') },
            ],
          },
        ],
      },
      callouts: [
        { anchor: at(WIND_X, 0.6, 0.7), text: OWN.copperLoss, color: 'orange', side: 'down' },
        { anchor: at(BAR_X, 0.45, 1.0), text: () => (solid() ? OWN.solidBar : `${OWN.sheetsBar} · ${eddyText()}`), color: 'cyan', side: 'down' },
      ],
      hotspots: [
        { anchor: at(BAR_X - 0.55, 1.3, BAR.len / 2 + 0.3), content: hot(ID, 0) },
        { anchor: at(BAR_X + 0.75, 2.95, 0.15), content: hot(ID, 1) },
        { anchor: at(BAR_X + 0.95, 1.4, 0.4), content: hot(ID, 2) },
      ],
    },
    probe: () => ({ beta: beta(), gen: gen(), d: d(), solid: solid(), over: over(), eta: eta().efficiency, eddy: eddy().wPerKg, sheets: bar.sheets, listen, flips: domains.flips }),
    update(dt) {
      phase = (phase + (dt * 50 * Math.PI * 2) / SLOW) % (Math.PI * 2);
      const b = beta();
      const e = eddy();
      applyHeat(slice.copper, Math.min(1, b * b * 0.85));
      // eddy brightness ∝ loss per sheet: thin sheets barely glow, a solid block blazes
      const lossLevel = solid() ? 1 : Math.min(1, e.wPerKg / 6);
      bar.loops.dashSpeed = 0.6 + 2.2 * lossLevel;
      bar.loops.intensity = solid() ? 1.5 : 0.15 + 1.2 * lossLevel;
      applyHeat(bar.steel, solid() ? 0.8 : Math.min(0.6, e.wPerKg / 50), 1.15);
      const field = Math.sin(phase);
      bar.flux.speed = 0.9 * field;
      domains.setField(field, dt);
      const k = over() ? 1.21 : 1; // magnetostriction ∝ B², +10 % voltage → ×1,21
      listen = Math.max(0, listen - dt);
      const heard = listen > 0 ? Math.min(1, listen, 6 - listen + 0.3) : 0;
      rings.intensity = 1.1 * heard * k;
      bar.group.scale.y = 1 + 0.004 * k * Math.abs(field) * (1 + heard);
      pkTag.text = `P_{k}·β² = ${fmtSI(eta().loadLossKW * 1000, 'W')}`;
      // «Послухати»: the 100 Hz hum (mains loop at pitch 2) plus the 100 Hz rasp with its 200/300 Hz overtones
      tx.sound.hum = 0.08 + heard * 0.55 * k;
      tx.sound.humPitch = 2;
      tx.sound.buzz = heard * 0.55 * k;
      tx.sound.buzzPitch = 1;
    },
  };
};
