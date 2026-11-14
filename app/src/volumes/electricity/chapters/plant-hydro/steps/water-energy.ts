/**
 * Step 2 `water-energy` — «Скільки енергії в падаючій воді». Wide view from the south: the sun lifts vapour
 * from the bay, clouds sail to the western mountains and rain into the reservoir (`water-cycle`, `water-fx`);
 * on the south bank stands the «водяний ліфт» (`lift`): 1 m³ of water at the head H above a turbine and a
 * column of water whose thickness grows with the flow Q. Sliders H, Q, η (M1: P = η·ρ·g·Q·H), presets of the
 * document, the power counting up, «Скільки осель живить» (P / 0,34 kW, «оцінка»), the 1000 MW note.
 */
import { Vector3 } from 'three';
import { damp } from '@/engine/api';
import { fmtNumber } from '@/content';
import { energyPerCubicMetreKWh, homesForPowerMW, hydroPowerMW } from '@electricity/sim/plant-hydro';
import { HOTSPOTS } from '../hotspots';
import { buildLift, rulerY } from '../parts/lift';
import { buildWaterCycle } from '../parts/water-cycle';
import { LIFT } from '../shots';
import { hot } from './hot';
import type { StepFactory } from './types';

const PRESETS = {
  gorges: [80.6, 966, 0.92],
  dnipro: [35, 300, 0.9],
  pelton: [1000, 10, 0.9],
  small: [20, 2, 0.85],
} as const;

export const waterEnergy: StepFactory = ({ ctx, ui, L, live, world }) => {
  const cycle = buildWaterCycle(ctx);
  ctx.root.add(cycle.group);
  const aCycle = ctx.stage.actor(cycle.group, { appear: 'fade' });
  const lift = buildLift();
  lift.group.position.set(LIFT[0], world.y(LIFT[0], LIFT[2]), LIFT[2]);
  lift.group.rotation.y = 0.15;
  ctx.root.add(lift.group);
  const aLift = ctx.stage.actor(lift.group, { appear: 'grow' });
  const H = (): number => ui.value<number>('we.h');
  const Q = (): number => ui.value<number>('we.q');
  const eta = (): number => ui.value<number>('we.eta');
  const power = (): number => hydroPowerMW(eta(), Q(), H());
  let shown = hydroPowerMW(...([0.92, 966, 80.6] as const)); // controls are defined after the factories run
  const preset = (id: string): void => {
    const p = PRESETS[id as keyof typeof PRESETS];
    if (!p) return;
    ui.set('we.h', p[0]);
    ui.set('we.q', p[1]);
    ui.set('we.eta', p[2]);
  };
  const cubeAt = new Vector3();
  ctx.qa.expose('we', () => ({ power: power(), shown }));
  const v = new Vector3();
  return {
    id: 'water-energy',
    stage: {
      camera: 'water-energy',
      show: [aCycle, aLift],
      enter: (info) => info.instant && (shown = power()),
    },
    ui: {
      honesty: ['notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'we.h',
          label: L.head,
          min: 2,
          max: 1900,
          scale: 'log',
          step: 3,
          unit: 'm',
          value: 80.6,
          format: (x) => `${fmtNumber(x, { maxDigits: x < 10 ? 1 : x < 100 ? 1 : 0 })} m`,
        },
        {
          type: 'slider',
          id: 'we.q',
          label: L.flow,
          min: 1,
          max: 1000,
          scale: 'log',
          step: 3,
          unit: 'm³/s',
          value: 966,
        },
        {
          type: 'slider',
          id: 'we.eta',
          label: L.eta,
          min: 0.7,
          max: 0.95,
          step: 0.01,
          digits: 2,
          value: 0.92,
        },
        {
          type: 'segmented',
          id: 'we.preset',
          label: L.preset,
          value: 'gorges',
          items: [
            { id: 'gorges', label: L.presetGorges },
            { id: 'dnipro', label: L.presetDnipro },
            { id: 'pelton', label: L.presetPelton },
            { id: 'small', label: L.presetSmall },
          ],
          onChange: (id) => preset(String(id)),
        },
      ],
      board: {
        title: 'P = η·ρ·g·Q·H',
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'we.stats',
            columns: 2,
            items: [
              { label: L.power, unit: 'MW', digits: 1, get: () => shown },
              { label: `${L.homes} · ${L.estimate}`, unit: '', digits: 0, get: () => homesForPowerMW(shown) },
            ],
          },
          {
            type: 'readout',
            id: 'we.e1',
            label: L.energyCube,
            unit: 'kWh',
            digits: 3,
            get: () => energyPerCubicMetreKWh(H()),
          },
          {
            type: 'note',
            id: 'we.big',
            text: L.over1000,
            icon: 'warning',
            color: 'amber',
            visible: () => power() > 1000,
          },
        ],
      },
      callouts: [
        {
          anchor: () => lift.cubeAt(cubeAt),
          text: () => `${L.cube} · H = ${fmtNumber(H(), { maxDigits: 1 })} m`,
          side: 'left',
          priority: 0,
        },
        { anchor: () => cycle.sunAt, text: L.cycleSun, priority: 2 },
        { anchor: () => cycle.cloudAt(v), text: L.cycleClouds, priority: 3 },
        { anchor: () => cycle.rainAt, text: L.cycleRain, priority: 4 },
      ],
      hotspots: [
        hot(
          () => lift.group.localToWorld(new Vector3(0, rulerY(H()) + 6, 0)),
          HOTSPOTS['water-energy'].netHead,
        ),
      ],
    },
    update(dt) {
      live.mountainRainTarget = 1;
      // the count-up: the number runs toward the new power instead of jumping
      shown = damp(shown, power(), 4, dt);
      lift.set(H(), Q());
      lift.update(dt, 0);
      cycle.update(dt);
    },
  };
};
