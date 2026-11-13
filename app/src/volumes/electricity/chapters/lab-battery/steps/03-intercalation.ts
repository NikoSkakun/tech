/**
 * Step 3 `intercalation` — the micro-world between two electrodes. The podium disappears, the backdrop goes
 * deep; ions rock between the oxide and the graphite while electrons take the outer wire.
 * Models: `socRatePctPerS` (dSOC/dt = I/Q, shown ×600) and `platingRisk` (§M3).
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { platingRisk, socRatePctPerS } from '@electricity/sim/lab-battery';
import type { StepFactory } from '../lab';
import { L } from '../labels';
import { note } from '../notes';
import { createRingGauge } from '../parts/rings';
import { createRockingChair } from '../parts/rocking-chair';
import { frame } from '../shots';
import { group } from '../world';

const ID = 'intercalation';
/** Time lapse of the SOC: at 0,5 C a full charge (2 h) takes 12 s on screen. */
const SPEED = 600;
/** «Швидко на морозі»: 3 C at −5 °C. */
const COLD = { cRate: 3, tC: -5 } as const;

export const intercalation: StepFactory = (lab) => {
  const { ctx, ui, mats } = lab;
  const chair = createRockingChair(ctx, mats);
  const ring = createRingGauge(ctx, { size: 1.25, caption: L.soc });
  ring.surface.position.set(0, 4.05, 0.2);
  const set = group(`set:${ID}`, 0, -0.3, 0, [chair.group, ring.surface]);
  lab.stageRoot.add(set);

  let soc = 0.3;
  const cold = (): boolean => ui.value<boolean>('cold3');
  const cRate = (): number => (cold() ? COLD.cRate : ui.value<number>('current3'));
  const direction = (): number => {
    const mode = ui.value<string>('mode3');
    return mode === 'charge' ? 1 : mode === 'discharge' ? -1 : 0;
  };
  ui.onChange('cold3', (on) => {
    if (on) ui.set('current3', COLD.cRate);
    audio.play(on ? 'error' : 'toggle', { gain: 0.5 });
  });
  ctx.input.register(chair.ions, { tooltip: L.ionTip, cursor: 'help' });
  const v = new Vector3();

  return {
    id: ID,
    noPodium: true,
    shots: {
      [ID]: frame([0, 2.45, 0], 11.2, 7.3, {
        azimuth: 0.38,
        elevation: 0.15,
        orbit: { azimuth: 0.8, polar: 0.35 },
      }),
    },
    stage: {
      show: [chair.group, ring.surface],
      // the micro-world: the studio backdrop goes deep and the floor disappears
      envTune: { top: 'bg.void', mid: 'bg.deep', bottom: 'bg.void', floor: 0, bokeh: 0.9, motes: 0.8 },
      post: { bloomIntensity: 1.15 },
    },
    ui: {
      hint: L.hint3,
      honesty: ['notToScale', 'illustrative', { sped: SPEED }],
      controls: [
        {
          type: 'segmented',
          id: 'mode3',
          items: [
            { id: 'charge', label: L.charge },
            { id: 'discharge', label: L.discharge },
            { id: 'pause', label: L.pause },
          ],
          value: 'charge',
        },
        {
          type: 'slider',
          id: 'current3',
          label: L.current,
          min: 0.1,
          max: 3,
          step: 0.1,
          unit: 'C',
          digits: 1,
          value: 0.5,
        },
        { type: 'toggle', id: 'cold3', label: L.fastCold, value: false },
        {
          type: 'readout',
          id: 'ions3',
          label: L.ionsInAnode,
          digits: 0,
          format: (n) => `${Math.round(n)} / ${chair.ionCount}`,
          get: () => chair.inAnode(),
        },
        note('plating3', L.platingSee7, 'alarm', cold),
      ],
      callouts: [
        {
          anchor: () => chair.graphite.getWorldPosition(v).set(v.x - 3.4, v.y + 3.25, v.z + 1.1),
          text: L.graphite,
          side: 'up',
        },
        {
          anchor: () => chair.oxide.getWorldPosition(v).set(v.x + 3.4, v.y + 3.25, v.z + 1.1),
          text: L.oxide,
          color: 'violet',
          side: 'up',
        },
        {
          anchor: () => chair.fence.getWorldPosition(v).set(v.x, v.y + 0.3, v.z + 1.3),
          text: L.separator,
          side: 'down',
        },
        // the document's hover hint, always on screen (touch screens have no hover — DECISIONS §57 b)
        { anchor: () => chair.crossing(v), text: L.ionTip, color: 'lime', side: 'right' },
        {
          anchor: () => chair.lamp.getWorldPosition(v).setX(v.x - 2.4),
          text: L.electrons,
          color: 'cyan',
          side: 'up',
        },
        {
          anchor: () => chair.cu.getWorldPosition(v).set(v.x, v.y - 1.6, v.z + 1.2),
          text: L.cuFoil,
          color: 'orange',
          side: 'down',
        },
        {
          anchor: () => chair.al.getWorldPosition(v).set(v.x, v.y - 1.6, v.z + 1.2),
          text: L.alFoil,
          side: 'down',
        },
      ],
      hotspots: [
        {
          anchor: () => chair.graphite.getWorldPosition(v).set(v.x - 2.9, v.y + 1.4, v.z + 1.15),
          content: 'graphite-layers',
        },
        {
          anchor: () => chair.oxide.getWorldPosition(v).set(v.x + 2.9, v.y + 1.3, v.z + 1.15),
          content: 'cathode-crystal',
        },
      ],
    },
    probe: () => ({
      soc,
      current: chair.state.current,
      plating: chair.state.plating,
      inAnode: chair.inAnode(),
    }),
    update(dt, t) {
      // dSOC/dt = I/Q (time-lapse ×600); at the ends the chair rocks back by itself
      const dir = lab.isCurrent(ID) ? direction() : 0;
      const c = cRate();
      soc += (dir * socRatePctPerS(c) * SPEED * dt) / 100;
      if (soc >= 1 && dir > 0) ui.set('mode3', 'discharge');
      if (soc <= 0 && dir < 0) ui.set('mode3', 'charge');
      soc = Math.min(Math.max(soc, 0), 1);
      chair.state.soc = soc;
      chair.state.current = dir * c;
      chair.state.plating = cold() && platingRisk(COLD.tC, c) === 'red';
      chair.update(dt, t);
      ring.set(soc);
      audio
        .loop('hum')
        .set({ gain: lab.isCurrent(ID) ? 0.05 * Math.abs(dir) * Math.min(c, 2) : 0, pitch: 1 });
    },
  };
};
