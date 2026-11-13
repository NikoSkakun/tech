/**
 * Step 9 `array` — twelve modules on the roof become strings. Tap modules to move them between string A,
 * string B and "not connected"; the design temperatures move the three voltages of every string along the
 * inverter's MPPT input scale (hot V_mp, STC V_mp, cold V_oc) and `checkString` raises the warnings.
 * «Паралель» puts both strings on one input; «Морозний ранок» plays the sunrise in which V_oc climbs.
 */
import { Mesh, SphereGeometry, Vector3 } from 'three';
import { fmtNumber } from '@/content';
import { createHalo } from '@/fx';
import { LI6_MPPT_INPUT, analyseString, uniformString, type ArrayWarning } from '@electricity/sim/lab-pv';
import { K, type ColorToken } from '@/style';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { cap, doc } from '../content';
import { L, fill } from '../labels';
import { createDcGear } from '../parts/dc-gear';
import { ARRAY, createRoofArray } from '../parts/roof-array';
import { createRoofWorld } from '../parts/roof-world';
import { createStringDesign, worst } from '../sim-bindings/string-design';
import { blip, sound } from '../sound';
import { ROOF_ENV } from './08-orientation';

const ID = 'array';
const FROST_S = 8;
const LANES: readonly ColorToken[] = ['teal', 'violet'];

export const arrayStep: StepFactory = (lab) => {
  const { ctx, ui } = lab;
  const world = lab.share('roof', () => createRoofWorld(ctx));
  lab.stageRoot.add(world.group);
  const array = createRoofArray();
  world.slope.add(array.group);
  const house = world.house.group;
  house.updateMatrixWorld(true);
  const edge = (s: 0 | 1): Vector3 => house.worldToLocal(array.group.localToWorld(array.centre(s ? 11 : 5, new Vector3()).add(new Vector3(1.1, 0, 0))));
  const gear = createDcGear([edge(0), edge(1)], new Vector3(6.4, 0.3, 5.0), -0.35);
  const sun = new Mesh(new SphereGeometry(0.9, 28, 20), K.glow({ color: 'orange', intensity: 1.8, whiten: 0.4 }));
  sun.add(createHalo({ color: 'orange', size: 6, intensity: 0.8 }));
  sun.visible = false;
  house.add(gear.group, sun);
  const own = [array.group, gear.group];
  // step 10's transition dives into this inverter
  lab.share('inverter9', () => gear.anchors.inverter);

  const design = createStringDesign(ARRAY.count, ARRAY.cols);
  const tMin = (): number => ui.value<number>('tmin9');
  const tMax = (): number => ui.value<number>('tmax9');
  const parallel = (): boolean => ui.value<boolean>('par9');
  const report = (s: 0 | 1) => design.report(s, tMin(), tMax(), parallel());
  const frost = { t: -1, voc: 0 };
  let seen = -1;
  const TEXT: Partial<Record<ArrayWarning, string>> = {
    overvoltage: L.warnOver,
    'below-mppt-window-hot': doc(ID, 3),
    'below-start-voltage': doc(ID, 4),
    'above-mppt-window': L.warnAbove,
    'short-circuit-current': L.warnCurrent,
    'operating-current-clipping': L.warnCurrent,
    'mixed-orientation': doc(ID, 5),
  };
  const verdict = (s: 0 | 1): string => {
    const r = report(s);
    if (!r.n) return L.notConnected;
    const w = worst(r.check.warnings);
    return w ? (TEXT[w] ?? L.ok) : L.ok;
  };
  const p = new Vector3();
  const q = new Vector3();
  /** A point half a module beyond module `i`, away from module `j` of the other row (array → world). */
  const outside = (i: number, j: number): Vector3 => {
    array.centre(i, p);
    array.centre(j, q);
    return array.group.localToWorld(p.addScaledVector(q.sub(p), -0.75));
  };
  ctx.input.register(array.proxy, {
    tooltip: L.clickTip,
    cursor: 'pointer',
    enabled: () => lab.isCurrent(ID),
    click: (e) => {
      if (!e.point) return;
      design.cycle(array.moduleAt(array.group.worldToLocal(p.copy(e.point))));
      blip('relay', 0.4);
    },
  });
  for (let i = 0; i < ARRAY.count; i++) ctx.qa.probe(`mod9-${i}`, () => array.group.localToWorld(array.centre(i, new Vector3())));
  ctx.qa.expose('array9', () => ({ a: report(0), b: report(1), assign: [...design.assign], parallel: parallel(), frost: frost.t, vocNow: frost.voc }));

  const markers = (chart: Chart): void => {
    for (const s of [0, 1] as const) {
      const r = report(s);
      const y = 2 - s;
      const on = r.n > 0;
      chart.setMarker(`hot${s}`, on ? { x: r.check.vmpHotV, y, color: 'orange', guides: false, ...(s === 0 ? { label: L.hotShort } : {}) } : null);
      chart.setMarker(`stc${s}`, on ? { x: r.check.vmpStcV, y, color: LANES[s]!, guides: false } : null);
      chart.setMarker(`cold${s}`, on ? { x: r.check.vocColdV, y, color: 'sky', guides: false, ...(s === 0 ? { label: L.coldShort } : {}) } : null);
    }
    chart.setMarker('now', frost.t >= 0 ? { x: frost.voc, y: 2, color: 'white', guides: true, label: L.nowShort } : null);
  };

  return {
    id: ID,
    noPodium: true,
    shots: {
      [ID]: { position: [4.6, 8.5, 7.3], target: [1.7, 3.05, 1.2], frameAspect: 0.85, fov: 30, fit: { center: [1.7, 3.05, 1.2], radius: 3.4 }, orbit: { azimuth: 0.8, polar: 0.3 } },
    },
    stage: {
      show: [world.group, ...own],
      envTune: ROOF_ENV,
      post: { bloomIntensity: 0.85 },
      enter() {
        frost.t = -1;
        seen = -1;
        sun.visible = false;
      },
    },
    ui: {
      hint: L.hint9,
      honesty: [{ kind: 'notToScale', text: L.enlarged9 }],
      board: {
        title: L.board9,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'window9',
            chart: {
              height: 150,
              x: { min: 0, max: 600, label: 'U, V' },
              y: { min: 0, max: 3 },
              series: [
                { id: 'window', label: L.windowSeries, color: 'green', kind: 'area', opacity: 0.45 },
                { id: 'start', label: L.startSeries, color: 'amber', width: 3 },
                { id: 'limit', label: L.limitSeries, color: 'red', kind: 'area', opacity: 0.6 },
              ],
            },
            init: (chart) => {
              const w = LI6_MPPT_INPUT;
              chart.setData('window', [w.windowMinV, w.windowMinV, w.windowMaxV, w.windowMaxV], [0, 3, 3, 0]);
              chart.setData('start', [w.startV, w.startV], [0, 3]);
              chart.setData('limit', [w.maxDcV, w.maxDcV, 600, 600], [0, 3, 3, 0]);
            },
            update: markers,
          },
          {
            type: 'table',
            id: 'strings9',
            head: [L.stringCol, L.modulesN, L.vocCold, L.vmpHot],
            rows: () => ([0, 1] as const).map((s) => [s ? 'B' : 'A', `${report(s).n}`, `${fmtNumber(Math.round(report(s).check.vocColdV))} V`, `${fmtNumber(Math.round(report(s).check.vmpHotV))} V`]),
          },
          ...([0, 1] as const).map((s) => ({
            type: 'note' as const,
            id: `verdict9-${s}`,
            icon: 'info' as const,
            text: () => `${s ? L.stringB : L.stringA}: ${verdict(s)}`,
            color: () => (report(s).check.severity === 'red' ? 'red' : report(s).check.severity === 'amber' && report(s).n ? 'amber' : 'green') as ColorToken,
          })),
        ],
      },
      controls: [
        { type: 'slider', id: 'tmin9', label: doc(ID, 1), min: -35, max: 0, step: 1, value: -20, unit: '°C' },
        { type: 'slider', id: 'tmax9', label: doc(ID, 2), min: 50, max: 80, step: 1, value: 70, unit: '°C' },
        { type: 'toggle', id: 'par9', label: doc(ID, 6), value: false },
        { type: 'button', id: 'frost9', label: cap(doc(ID, 7)), icon: 'play', primary: true, onClick: () => ((frost.t = 0), (sun.visible = true)) },
        { type: 'button', id: 'reset9', label: doc(ID, 0), icon: 'resetView', onClick: () => design.reset() },
      ],
      callouts: [
        // string tags off the modules: A where its cable leaves the roof, B below its row
        { anchor: () => array.group.localToWorld(array.centre(5, p).setX(p.x + 0.75)), text: () => `${L.stringA} · ${report(0).n} × 39,4 V`, color: 'teal', side: 'down' },
        { anchor: () => outside(9, 3), text: () => `${L.stringB} · ${report(1).n} × 39,4 V`, color: 'violet', side: 'down' },
        { anchor: gear.anchors.inverter, text: L.mpptInputs, side: 'left' },
        { anchor: gear.anchors.isolator, text: L.dcBox, side: 'up' },
      ],
      hotspots: [
        { anchor: gear.anchors.isolator, content: 'dc-isolator' },
        { anchor: gear.anchors.spd, content: 'spd' },
        { anchor: () => array.group.localToWorld(array.centre(11, p).add(new Vector3(0.5, 0, 0.8))), content: 'earthing' },
      ],
    },
    update(dt, t) {
      if (!lab.isCurrent(ID)) return;
      world.update(dt, t);
      if (design.version !== seen) array.setStrings(design.assign);
      seen = design.version;
      if (frost.t >= 0) {
        frost.t += dt;
        const u = Math.min(1, frost.t / FROST_S);
        // sunrise on a frosty morning: cells at the design minimum, light growing — V_oc climbs with ln(G)
        const g = 20 + 980 * u * u;
        frost.voc = analyseString(uniformString(g, tMin(), Math.max(1, design.count(0))), 60).vocV;
        sun.position.set(15, -1 + 9 * u, 5 - 3 * u);
        if (u >= 1 && frost.t - dt < FROST_S) ui.toast(fill(L.frostDone, { v: fmtNumber(Math.round(frost.voc)) }), { icon: 'info', duration: 6 });
        if (frost.t > FROST_S + 4) {
          frost.t = -1;
          sun.visible = false;
        }
      }
      ([0, 1] as const).forEach((s) => {
        const r = report(s);
        gear.wires[s].material.power = r.n > 0 && r.check.severity !== 'red' ? 0.9 : 0.15;
      });
      sound.power = 0.6;
      sound.wind = 0.4;
    },
  };
};
