/**
 * Step 7 `shading` — paint shade onto half-cells (or drop a leaf, a chimney stripe, snow, a bird) and watch
 * the P-V curve grow humps while the bypass diodes take over. One model sample (module or string of ten, with
 * or without diodes, at the global maximum or short-circuited) drives the chart, the section table, the cell
 * brightness, the electron routes, the diode glow and the hot spot.
 */
import { Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { LM440, optimiserPowerW } from '@electricity/sim/lab-pv';
import type { StepFactory } from '../chapter';
import { doc, docPair } from '../content';
import { L, fill } from '../labels';
import { diodeSpot } from '../parts/lm440-layout';
import { EASEL_TILT, createRig } from '../parts/rig';
import { createStringRow } from '../parts/string-row';
import type { BenchSample } from '../sim-bindings/bench-model';
import { hotCellOf } from '../sim-bindings/bench-model';
import { createShadeState } from '../sim-bindings/shade-state';
import { blip, sound } from '../sound';
import { curveChart } from '../ui-bits/curve-chart';
import { SHADE_KINDS, createShadeTools } from './07-shading-tools';

const ID = 'shading';
const P_CLEAR = 439.9; // W, the unshaded module at STC (document §M1)

export const shading: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const rig = lab.share('rig', () => createRig(ctx));
  const shade = createShadeState();
  const shapeOn = (kind: string): boolean => ui.value<boolean>(`sh-${kind}`);
  const tools = createShadeTools(lab, rig, shade, () => lab.isCurrent(ID), shapeOn);
  const foot = rig.centre.clone().addScaledVector(rig.normal, -0.45);
  foot.y = 0.02;
  const row = createStringRow(EASEL_TILT, foot);
  lab.stageRoot.add(row.group, row.optimisers);
  const rowActor = ctx.stage.actor(row.group);
  const optActor = ctx.stage.actor(row.optimisers);

  let sample: BenchSample | null = null;
  let applied = { string: false, opt: false, shapes: '' };
  let shadeSeen = -1;
  let diodesOpen = 0;
  let optimised = 0;
  let optKey = '';
  const isString = (): boolean => ui.value<string>('scope7') === 'string';
  const modules = (): number => (isString() ? 10 : 1);
  const lossPct = (): number => (sample ? (1 - sample.analysis.mpp.pW / (P_CLEAR * modules())) * 100 : 0);
  const hotW = (): number => sample?.hot.reduce((m, h) => Math.max(m, h.pHotW), 0) ?? 0;
  const [moduleLabel, stringLabel] = docPair(ID, 5);
  const v = new Vector3();
  const hotAnchor = (): Vector3 => {
    const h = sample?.hot[0];
    const cell = h ? hotCellOf(h.section, shade.total) : -1;
    return cell >= 0 ? tools.cellWorld(cell, v) : rig.module.group.getWorldPosition(v);
  };
  const diodeAnchor = (s: number) => (): Vector3 => rig.module.group.localToWorld(diodeSpot(s, v));

  ctx.qa.probe('glass7', tools.glass);
  for (const c of [0, 13, 40, 70, 107]) ctx.qa.probe(`cell7-${c}`, () => tools.cellWorld(c, new Vector3()));
  for (const k of SHADE_KINDS) ctx.qa.probe(`shape7-${k}`, tools.items[k].mesh);
  ctx.qa.expose('shade7', () => ({
    shaded: shade.count(),
    p: sample?.analysis.mpp.pW ?? 0,
    op: sample ? { v: sample.op.vV, i: sample.op.iA, p: sample.op.pW } : null,
    maxima: sample?.analysis.localMaxima.length ?? 0,
    diodes: sample?.diode.map((d) => d > 0.01) ?? [],
    hot: sample?.hot.map((h) => ({ w: h.pHotW, colour: h.colour })) ?? [],
    sectionG: sample?.sectionG ?? [],
    modules: modules(),
    optimised,
  }));

  return {
    id: ID,
    shots: {
      [ID]: { position: [0.7, 4.6, 8.6], target: [-0.7, 2.5, -0.5], frameAspect: 0.8, fov: 33, fit: { center: [-0.7, 2.4, -0.5], radius: 3.0 }, orbit: { azimuth: 0.5, polar: 0.25 } },
      'shading-string': { position: [1.2, 6.2, 12.4], target: [0, 1.6, 0.9], frameAspect: 1.05, fov: 34, fit: { center: [0, 1.6, 0.8], radius: 4.4 } },
    },
    stage: {
      show: [rig.group],
      enter() {
        applied = { string: false, opt: false, shapes: '' };
        shadeSeen = -1; // another step may have used the shared model meanwhile
      },
    },
    ui: {
      hint: L.hint7,
      honesty: [{ kind: 'simplified', text: L.shadeModel }, { kind: 'notToScale', text: L.stringNote, visible: isString }],
      board: {
        title: L.board7,
        size: 'md',
        children: [
          curveChart('chart7', () => sample, { flags: true, height: 220 }),
          {
            type: 'stats',
            id: 'stats7',
            items: [
              { label: L.pNow, get: () => sample?.op.pW ?? 0, unit: 'W', digits: 0, color: () => 'yellow' },
              { label: L.loss, get: () => -lossPct(), unit: '%', digits: 0, color: () => (lossPct() > 1 ? 'coral' : 'green') },
              { label: L.hotW, get: () => hotW(), unit: 'W', digits: 0, color: () => (hotW() > 80 ? 'red' : hotW() > 1 ? 'orange' : 'white') },
            ],
          },
          {
            type: 'table',
            id: 'sections7',
            head: [L.section, L.lightCol, 'U, V', L.diodeCol],
            rows: () =>
              [0, 1, 2].map((s) => [
                `${s + 1}`,
                `${fmtNumber(Math.round((sample?.sectionG[s] ?? 1000) / 10))} %`,
                fmtNumber(Math.round((sample?.sectionV[s] ?? 0) * 10) / 10),
                !ui.value<boolean>('bypass7') ? L.diodeOff : (sample?.diode[s] ?? 0) > 0.01 ? L.diodeOpen : L.diodeClosed,
              ]),
            highlight: () => sample?.diode.findIndex((d) => d > 0.01) ?? -1,
          },
          { type: 'segmented', id: 'op7', label: L.opMode, items: [{ id: 'mpp', label: L.opMpp }, { id: 'short', label: L.opShort }], value: 'mpp' },
          { type: 'toggle', id: 'opt7', label: doc(ID, 6), value: false },
          { type: 'note', id: 'optNote7', icon: 'info', color: 'teal', text: () => fill(L.withOpt, { p: fmtNumber(Math.round(optimised)), note: doc(ID, 7) }), visible: () => ui.value<boolean>('opt7') },
        ],
      },
      controls: [
        ...SHADE_KINDS.map((kind, i) => ({ type: 'toggle' as const, id: `sh-${kind}`, label: doc(ID, i), value: false })),
        { type: 'toggle', id: 'bypass7', label: doc(ID, 4), value: true },
        { type: 'segmented', id: 'scope7', items: [{ id: 'module', label: moduleLabel }, { id: 'string', label: stringLabel }], value: 'module' },
        { type: 'button', id: 'clear7', label: L.clear, icon: 'close', onClick: () => (shade.clear(), SHADE_KINDS.forEach((k) => ui.set(`sh-${k}`, false))) },
      ],
      callouts: [
        ...[0, 1, 2].map((s) => ({ anchor: diodeAnchor(s), text: L.diodeCallout, color: 'amber' as const, side: 'up' as const, visible: () => (sample?.diode[s] ?? 0) > 0.01 })),
        { anchor: hotAnchor, text: () => fill(L.hotCallout, { w: fmtNumber(Math.round(hotW())) }), color: 'red', side: 'left', visible: () => hotW() > 1 },
      ],
      hotspots: [
        { anchor: diodeAnchor(1), content: 'bypass-diode', visible: () => (sample?.diode[1] ?? 0) < 0.01 },
        { anchor: hotAnchor, content: 'hot-cell', visible: () => hotW() > 1 },
        { anchor: () => row.optimisers.localToWorld(v.copy(foot).setY(foot.y + 0.25)), content: 'optimizer', visible: () => ui.value<boolean>('opt7') },
      ],
    },
    update(_dt, t) {
      if (!lab.isCurrent(ID)) return;
      // sub-states the controls ask for (the stage reverts them on the next step entry)
      const shapes = SHADE_KINDS.map((k) => (shapeOn(k) ? '1' : '0')).join('');
      if (shapes !== applied.shapes) tools.sync(shapeOn);
      const opt = ui.value<boolean>('opt7');
      if (isString() !== applied.string) {
        ctx.stage.toggle(rowActor, isString());
        void ctx.camera.go(isString() ? 'shading-string' : ID, { duration: 1.4 });
      }
      if (opt !== applied.opt) ctx.stage.toggle(optActor, opt);
      applied = { string: isString(), opt, shapes };

      const bypass = ui.value<boolean>('bypass7');
      const load = ui.value<string>('op7') === 'short' ? ({ kind: 'short' } as const) : ({ kind: 'mpp' } as const);
      if (shade.version !== shadeSeen) rig.model.touchShade();
      shadeSeen = shade.version;
      sample = rig.model.sample({ g: 1000, tc: 25, shade: shade.total, bypass, modules: modules(), load });
      rig.show(sample, t, { tint: 0.4, sections: true, photons: 0.3 });
      row.wire.material.power = isString() ? Math.min(1, sample.op.pW / 4400) : 0;
      row.wire.material.speed = 0.4 + 1.6 * (sample.op.iA / LM440.iscA);
      const key = `${shade.version}|${modules()}`;
      if (opt && key !== optKey) {
        optKey = key;
        optimised = optimiserPowerW({ modules: Array.from({ length: modules() }, (_, m) => (m === 0 ? sample!.sectionG : [1000, 1000, 1000])), tcC: 25, bypass: true });
      }
      const open = sample.diode.filter((d) => d > 0.01).length;
      if (open !== diodesOpen) blip('relay', 0.5, open > diodesOpen ? 1.1 : 0.8);
      diodesOpen = open;
      sound.power = sample.op.pW / (440 * modules());
      sound.hot = Math.min(1, hotW() / 200);
    },
  };
};
