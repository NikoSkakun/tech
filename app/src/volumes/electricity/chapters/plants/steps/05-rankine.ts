/**
 * Step 5 `rankine` — «Цикл Ренкіна: вода → пара → вода». The studio holds the Rankine loop (pump → boiler →
 * turbine → condenser) with water and steam flowing in glass pipes; a hero blob runs the loop and the board's
 * T–s chart moves its state point in step. «Крок за кроком» walks the hero through one machine per press.
 * «Перегрів» / «Проміжний перегрів» change the contour and the readouts (plants sim M2, `rankine()`), «Прибрати
 * конденсатор» vents the steam to the sky (the cycle opens; efficiency ×0,67…0,73).
 */
import { Vector3 } from 'three';
import { createOrbs } from '@/fx';
import { rankine } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createRankineRig, LEG_ORDER, type Leg } from '../parts/rankine-rig';
import { STUDIO_TUNE } from '../shots';
import { along, DOME, rankineContour } from '../sim-bindings/ts-diagram';
import { group, tag } from '../world';

const ID = 'rankine';
/** Seconds the hero needs for each leg when the loop runs by itself. */
const LEG_S: Record<Leg, number> = { pump: 1.2, boiler: 4, turbine: 1.6, condenser: 3.2 };

export const rankineStep: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, 0, 0, 4);
  set.scale.setScalar(1.05);
  hub.stageRoot.add(set);
  const rig = createRankineRig(ctx);
  set.add(rig.group);
  const hero = createOrbs({ kind: 'pulse', count: 1, radius: 0.55, color: 'yellow' });
  set.add(hero);
  const aSh = ctx.stage.actor(rig.parts.superheater, { appear: 'grow' });
  const aRh = ctx.stage.actor(rig.parts.reheater, { appear: 'fade' });
  const aCond = ctx.stage.actor(rig.parts.condenser, { appear: 'grow' });
  const pumpTag = tag('', 18, 'white', 'mono');
  pumpTag.position.copy(rig.at.pump).add(new Vector3(0, 1.2, 1.4));
  const turbTag = tag('', 18, 'yellow', 'mono');
  turbTag.position.copy(rig.at.turbine).add(new Vector3(-0.6, -5.4, 2));
  set.add(pumpTag, turbTag);

  const sh = (): boolean => ui.value<boolean>('sh5') || ui.value<boolean>('rh5');
  const rh = (): boolean => ui.value<boolean>('rh5');
  const cond = (): boolean => !ui.value<boolean>('nocond5');
  const r = () => rankine(sh(), rh(), cond());
  // hero position: leg index + fraction; `stepping` = the button took over (the hero stops at each leg's end)
  const st = { leg: 0, u: 0, stepping: false };
  const legIndex = (): number => st.leg % 4;
  const sync = (instant: boolean): void => {
    if (ctx.stage.shown(aSh) !== sh()) ctx.stage.toggle(aSh, sh(), { instant });
    if (ctx.stage.shown(aRh) !== rh()) ctx.stage.toggle(aRh, rh(), { instant });
    if (ctx.stage.shown(aCond) !== cond()) ctx.stage.toggle(aCond, cond(), { instant });
  };
  const p = new Vector3();
  ctx.qa.probe('hero', () => set.localToWorld(p.copy(hero.position)));

  return {
    id: ID,
    noLines: true,
    shots: {
      [ID]: { position: [-0.5, 10, 31], target: [-0.5, 6.8, 4], fov: 40, drift: 0.4, fit: { center: [-1, 7.5, 4], radius: 16 } },
    },
    stage: {
      show: [set],
      env: 'dusk',
      envTune: STUDIO_TUNE,
      enter: (info) => {
        Object.assign(st, { leg: 0, u: 0, stepping: false });
        sync(info.instant);
      },
    },
    ui: {
      honesty: [{ kind: 'simplified', text: doc(ID, 10) }, 'notToScale'],
      controls: [
        { type: 'toggle', id: 'sh5', label: doc(ID, 5), value: false, onChange: () => hub.sound.click(1.1) },
        { type: 'toggle', id: 'rh5', label: doc(ID, 6), value: false, onChange: () => hub.sound.click(1.2) },
        { type: 'toggle', id: 'nocond5', label: doc(ID, 12), value: false, onChange: () => hub.sound.relay() },
        {
          type: 'stats',
          id: 'read5',
          columns: 2,
          items: [
            { label: doc(ID, 8), get: () => 100 * r().shownEta, unit: '%', digits: 0, color: () => (cond() ? 'green' : 'red') },
            { label: doc(ID, 9), get: () => 100 * r().moisture, unit: '%', digits: 0, color: () => (r().moistureWarning ? 'amber' : 'mist') },
          ],
        },
        { type: 'readout', id: 'water5', label: doc(ID, 13), text: () => (cond() ? OWN.makeupClosed : OWN.makeupOpen), color: () => (cond() ? 'green' : 'red') },
        { type: 'note', id: 'leg5', icon: 'info', text: () => doc(ID, 1 + legIndex()), visible: () => st.stepping },
        {
          type: 'button',
          id: 'step5',
          label: doc(ID, 0),
          icon: 'play',
          primary: true,
          onClick: () => {
            if (!st.stepping) Object.assign(st, { stepping: true, leg: 0, u: 0 });
            else Object.assign(st, { leg: st.leg + 1, u: 0 });
            hub.sound.click(1 + 0.1 * legIndex());
          },
        },
      ],
      board: {
        title: OWN.tsBoard,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'ts5',
            chart: {
              height: 210,
              x: { min: 0, max: 9, label: 's, kJ/(kg·K)' },
              y: { min: 0, max: 600, label: 't, °C' },
              series: [
                { id: 'dome', color: 'mist', dash: true },
                { id: 'cycle', color: 'orange', width: 3 },
              ],
            },
            init: (c) => c.setData('dome', DOME.map((q) => q[0]), DOME.map((q) => q[1])),
            update: (c) => {
              const k = rankineContour(r().config);
              c.setData('cycle', k.pts.map((q) => q[0]), k.pts.map((q) => q[1]));
              const i = legIndex();
              const [s, t] = along(k.pts, k.legs[i]!, i === 3 ? k.pts.length - 1 : k.legs[i + 1]!, st.u);
              c.setMarker('state', { x: s, y: t, color: 'yellow', label: `${i + 1}→${(i + 1) % 4 + 1}` });
            },
          },
        ],
      },
      callouts: [
        { anchor: () => set.localToWorld(rig.at.boiler.clone()), text: OWN.boiler, side: 'up', priority: 1 },
        { anchor: () => set.localToWorld(rig.at.turbine.clone().add(new Vector3(0, 0.4, 0))), text: OWN.turbine, side: 'up', priority: 2 },
        { anchor: () => set.localToWorld(rig.at.pump.clone().add(new Vector3(0, -1.2, 1.4))), text: OWN.pump, side: 'down', priority: 3 },
        { anchor: () => set.localToWorld(rig.at.condenser.clone().add(new Vector3(0, -1.6, 0))), text: OWN.condenser, side: 'down', priority: 3, visible: () => cond() },
        { anchor: () => set.localToWorld(rig.at.generator.clone()), text: OWN.generatorShort, side: 'right', priority: 4 },
      ],
      hotspots: [
        { anchor: () => set.localToWorld(rig.at.pump.clone()), content: 'pump' },
        { anchor: () => set.localToWorld(rig.at.condenser.clone()), content: 'condenser', visible: () => cond() },
      ],
    },
    probe: () => ({ eta: r().shownEta, moisture: r().moisture, config: r().config, condenser: cond(), leg: LEG_ORDER[legIndex()], u: st.u, stepping: st.stepping }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      sync(false);
      const leg = LEG_ORDER[legIndex()]!;
      if (!st.stepping || st.u < 1) st.u += dt / LEG_S[leg];
      if (st.u >= 1 && !st.stepping) {
        st.u = 0;
        st.leg++;
      }
      rig.curves[leg].getPoint(Math.min(1, st.u), p);
      hero.setPosition(0, p.x, p.y, p.z);
      hero.commit();
      rig.parts.rotor.rotation.x += dt * 6;
      const res = r();
      rig.droplets.density = res.moistureWarning ? 1 : res.moisture > 0.05 ? 0.3 : 0;
      rig.flows.condenser.density = cond() ? 1 : 0;
      rig.vent.setEmitting(!cond());
      pumpTag.text = `w = ${Math.round(res.pumpKJkg)} kJ/kg`;
      turbTag.text = `w = ${Math.round(res.turbineKJkg / 10) * 10} kJ/kg`;
      arch.want.ring = 0.3;
      hub.sound.fire = 0.25;
      hub.sound.steam = cond() ? 0.15 : 0.45;
      hub.sound.turbine = 0.22;
      hub.sound.turbinePitch = 0.7 + 0.3 * res.eta;
    },
  };
};
