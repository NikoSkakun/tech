/**
 * Step 7 `reservoir-environment` — «Водосховище, паводки й природа». Wide shot of the reservoir and the
 * spillway under a thunderstorm sky. The reservoir balance M6 (`createReservoir`, «1 s = 1 h») drives the world:
 * the reservoir level (+h over the normal level НПР: the dam crest is +4 m, where overtopping starts), the
 * spillway (its gates rise in «авто»), the turbines' discharge, the swollen mountain river and the rain.
 * «Приплив води», «Злива» (12 h rise, 12 h hold, 12 h fall), «Водоскид: авто/вручну» + the gate opening.
 * Calm details: the fish ladder with leaping fish, methane bubbles over a shallow bay, the sediment hotspot.
 * The card «до/після» of the Kakhovka reservoir: a schematic holographic map that drains smoothly.
 */
import { Vector3 } from 'three';
import { createRipples } from '@/fx';
import { createReservoir, RESERVOIR as M6 } from '@electricity/sim/plant-hydro';
import { splitCaption } from '../content';
import { HOTSPOTS } from '../hotspots';
import { DAM, RESERVOIR } from '../layout';
import { buildKakhovkaMap } from '../parts/kakhovka';
import { hot } from './hot';
import type { StepFactory } from './types';

const WINDOW_H = 48;

export const reservoirEnvironment: StepFactory = ({ ctx, ui, L, live, world, fx }) => {
  const res = createReservoir(800);
  const mode = splitCaption(L.spillMode, '/'); // «Водоскид» · [авто, вручну]
  const auto = (): boolean => ui.value<string>('re.mode') === 'auto';
  const history: { t: number; q: number; h: number }[] = [];
  let tModel = 0;
  const map = buildKakhovkaMap();
  map.group.scale.setScalar(0.24);
  map.group.position.set(118, 150, 52);
  ctx.root.add(map.group);
  ctx.stage.actor(map.group, { appear: 'fade' }); // shown by its toggle (`stage.toggle`)
  let drain = 0;
  const ripples = createRipples({ size: 10, color: 'white', rings: 3, intensity: 0.8 });
  ripples.rotation.x = -Math.PI / 2;
  ripples.position.set(-150, RESERVOIR.npr + 0.3, 70);
  ctx.root.add(ripples);
  const aRipples = ctx.stage.actor(ripples, { appear: 'fade' });
  const st = () => res.state;
  let pushed = -1;
  ctx.qa.expose('res', () => ({ ...res.state, drain, map: map.group.visible }));
  return {
    id: 'reservoir-environment',
    stage: {
      camera: 'reservoir-environment',
      show: [aRipples],
      // a thunderstorm day: the day preset under a low grey-blue sky, a dimmer key light, denser haze
      envTune: {
        top: 'slate',
        mid: 'steel',
        bottom: 'steel.light',
        sunGlow: 0.08,
        sunColor: 'mist',
        clouds: 1,
        cloudColor: 'steel',
        keyIntensity: 0.72,
        keyColor: 'mist',
        rimColor: 'steel.light',
        fogColor: 'steel.light',
        fogDensity: 0.008,
      },
      enter: () => {
        tModel = 0;
        pushed = -1;
        history.length = 0;
        res.set({
          inflowM3s: ui.value<number>('re.qin'),
          auto: auto(),
          gate: ui.value<number>('re.gate') / 100,
        });
        ctx.stage.toggle(map.group, ui.value<boolean>('re.kakhovka'));
      },
    },
    ui: {
      honesty: [{ kind: 'simplified', text: L.stormModel }, 'notToScale'],
      controls: [
        {
          type: 'slider',
          id: 're.qin',
          label: L.inflow,
          min: 500,
          max: 20000,
          scale: 'log',
          step: 2,
          unit: 'm³/s',
          value: 800,
          onChange: (q) => res.set({ inflowM3s: Number(q) }),
        },
        {
          type: 'segmented',
          id: 're.mode',
          label: mode.label,
          value: 'auto',
          items: [
            { id: 'auto', label: mode.items[0] ?? L.auto },
            { id: 'manual', label: mode.items[1] ?? L.manual },
          ],
          onChange: () => res.set({ auto: auto() }),
        },
        {
          type: 'slider',
          id: 're.gate',
          label: L.gateOpen,
          min: 0,
          max: 100,
          step: 1,
          unit: '%',
          value: 0,
          disabled: () => auto(),
          onChange: (g) => res.set({ gate: Number(g) / 100 }),
        },
        {
          type: 'toggle',
          id: 're.kakhovka',
          label: L.kakhovka,
          value: false,
          onChange: (on) => ctx.stage.toggle(map.group, Boolean(on)),
        },
        {
          type: 'segmented',
          id: 're.ka',
          label: L.beforeAfter,
          value: 'before',
          items: [
            { id: 'before', label: L.before },
            { id: 'after', label: L.after },
          ],
          visible: () => ui.value<boolean>('re.kakhovka'),
        },
        {
          type: 'note',
          id: 're.forced',
          text: L.forced,
          icon: 'warning',
          color: 'amber',
          visible: () => st().status === 'forced',
        },
        {
          type: 'note',
          id: 're.over',
          text: L.overtop,
          icon: 'warning',
          color: 'red',
          visible: () => st().status === 'overtopping',
        },
        {
          type: 'button',
          id: 're.storm',
          label: L.storm,
          icon: 'play',
          primary: true,
          onClick: () => res.startStorm(),
        },
      ],
      board: {
        title: L.inflowChart,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 're.stats',
            columns: 2,
            items: [
              {
                label: L.levelRel,
                unit: 'm',
                digits: 2,
                get: () => st().levelM,
                color: () =>
                  st().status === 'overtopping' ? 'red' : st().status === 'forced' ? 'amber' : 'green',
              },
              { label: L.power, unit: 'MW', digits: 0, get: () => st().powerMW },
              { label: L.qTurb, unit: 'm³/s', digits: 0, get: () => st().turbineM3s },
              { label: L.qSpill, unit: 'm³/s', digits: 0, get: () => st().spillM3s },
            ],
          },
          {
            type: 'chart',
            id: 're.chart',
            chart: {
              height: 140,
              window: WINDOW_H,
              x: { min: 0, max: WINDOW_H, label: 't, h' },
              y: { min: 0, max: 20000, label: 'Q, m³/s' },
              y2: { min: 0, max: 5, label: 'h, m' },
              series: [
                { id: 'q', label: L.inflow, color: 'sky', kind: 'area' },
                { id: 'h', label: L.levelRel, color: 'blue', axis: 'y2' },
              ],
            },
            update: (c) => {
              const last = history[history.length - 1];
              if (last && last.t !== pushed) {
                pushed = last.t;
                c.push('q', last.t, last.q);
                c.push('h', last.t, last.h);
              }
            },
          },
        ],
      },
      callouts: [
        { anchor: () => world.dam.anchorWorld('spillway'), text: L.cSpillway, side: 'left', priority: 0 },
        {
          anchor: () => world.dam.anchorWorld('chute').add(new Vector3(14, 0, 0)),
          text: L.stilling,
          side: 'down',
          priority: 2,
        },
        { anchor: () => world.fishLadder.anchorWorld('mid'), text: L.cFish, side: 'down', priority: 1 },
        { anchor: () => ripples.position, text: L.methane, side: 'up', priority: 3 },
        {
          anchor: () => map.group.localToWorld(map.label.clone()),
          text: L.kakhovka,
          side: 'up',
          priority: 4,
          visible: () => ui.value<boolean>('re.kakhovka'),
        },
      ],
      hotspots: [
        hot(() => world.fishLadder.anchorWorld('top'), HOTSPOTS['reservoir-environment'].fish),
        hot(() => new Vector3(DAM.faceX + 2, 10, 30), HOTSPOTS['reservoir-environment'].flushing),
      ],
    },
    update(dt) {
      // «1 s = 1 h»: the model runs in steps of ≤ 10 s of model time inside `step`
      res.step(dt * 3600);
      tModel += dt;
      const s = st();
      if (history.length === 0 || tModel - history[history.length - 1]!.t >= 0.25)
        history.push({ t: tModel, q: s.inflowM3s, h: s.levelM });
      if (history.length > 400) history.shift();
      live.levelTarget = RESERVOIR.npr + s.levelM;
      live.spillTarget = Math.min(1, s.spillM3s / 12000);
      live.turbineTarget = s.turbineM3s / M6.turbineMaxM3s;
      live.stormTarget = Math.min(1, Math.max(0, (s.inflowM3s - 1500) / 6000));
      live.mountainRainTarget = live.stormTarget;
      fx.setInflow(Math.min(1, (s.inflowM3s - 500) / 11500));
      drain += ((ui.value<string>('re.ka') === 'after' ? 1 : 0) - drain) * Math.min(1, dt * 0.6);
      map.setDrain(drain);
      map.group.quaternion.copy(ctx.camera.camera.quaternion);
    },
  };
};
