/**
 * Step 8 `losses` — losses in the wires and why voltage is raised. A source feeds a 2 kW heater in a cottage
 * through a long extension cord. At 12 V almost everything heats the cord (it glows, heat rises off it, the
 * cottage stays dark); at 230 V and above nearly all the power arrives. The board's energy ribbon shows the
 * split. Model: `lineLosses` (§8: R_line = ρ·2L/A, load rated 2 kW at the chosen voltage, DC).
 */
import { Vector3 } from 'three';
import { fmtPercent, fmtUnit } from '@/content';
import { boxEmitter, createHeatShimmer, createParticles } from '@/fx';
import { house } from '@/kit';
import { LOSSES, lineLosses, type LineLosses } from '@electricity/sim/current';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createCord } from '../parts/cord';
import { anchorIn, createLead } from '../parts/leads';
import { Sankey } from '../parts/sankey';
import { createSupply } from '../parts/supply';
import { group } from '../world';

const ID = 'losses';

export const lossesStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`, 0.1, 0, 0.3);
  bench.top.add(set);
  const supply = createSupply();
  supply.group.position.set(-2.55, 0, 0.3);
  supply.group.rotation.y = Math.PI / 2; // posts toward the cord: «+» at the back, «−» in front
  const cottage = house({ width: 7, depth: 6, floors: 1, seed: 11 });
  cottage.group.scale.setScalar(0.17);
  cottage.group.position.set(3.0, 0, -1.85);
  cottage.group.rotation.y = -0.35;
  set.add(supply.group, cottage.group);
  const entry = new Vector3(2.5, 0.075, -1.3);
  const cord = createCord(anchorIn(set, supply.plus), anchorIn(set, supply.minus), entry);
  const drop = createLead([entry.clone().add(new Vector3(0.07, 0, 0.07)), new Vector3(2.8, 0.3, -1.5)], {
    bend: 0,
    radius: 0.06,
  });
  const shimmer = createHeatShimmer({ width: 3.9, height: 1.1, lines: 8, intensity: 0 });
  shimmer.position.set(0, 0.2, 1.0);
  const heat = createParticles(ctx, {
    count: 70,
    emitter: boxEmitter([3.9, 0.05, 3.2]),
    sprite: 'soft',
    color: ['orange', 'red'],
    life: [1.2, 2.2],
    speed: [0.25, 0.6],
    size: [0.03, 0.07, 0.02],
    gravity: [0, 0.35, 0],
    intensity: 1.6,
  });
  heat.position.set(0, 0.1, 0.8);
  set.add(cord.group, drop.mesh, shimmer, heat);

  /* ------------------------------------------------------------------------------------- state */
  const ribbon = new Sankey(LOSSES.ratedW);
  const volts = (): number => Number(ui.value<string>('u8'));
  const model = (): LineLosses =>
    lineLosses(volts(), Number(ui.value<string>('a8')), ui.value<number>('len8'));
  const span = LOSSES.lengthRangeM;
  ctx.qa.expose('losses', () => ({ ...model(), volts: volts(), rows: cord.rows, night: cottage.night }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.4, 8.4, 8.8],
        target: [0.1, 0.4, 0.5],
        fov: 30,
        frameAspect: 1.2,
        orbit: { azimuth: 0.7, polar: 0.3 },
        fit: { center: [0, 0.5, 0], radius: 4.7 },
      },
    },
    stage: { show: [supply.group, cottage.group, cord.group, drop.mesh, shimmer, heat] },
    ui: {
      hint: OWN.hintLosses,
      honesty: [{ kind: 'simplified', text: DOC.dcChip }, 'notToScale'],
      board: {
        title: OWN.ribbon,
        size: 'sm',
        children: [
          { type: 'custom', id: 'sankey8', node: ribbon },
          {
            type: 'stats',
            id: 'out8',
            columns: 2,
            items: [
              { label: OWN.sent, get: () => fmtUnit(model().loadW + model().lossW, 'W', { digits: 0 }) },
              {
                label: OWN.lost,
                get: () => fmtUnit(model().lossW, 'W', { maxDigits: model().lossW < 10 ? 1 : 0 }),
                color: () => 'orange',
              },
              {
                label: OWN.arrived,
                get: () => fmtUnit(model().loadW, 'W', { maxDigits: model().loadW < 10 ? 1 : 0 }),
                color: () => 'yellow',
              },
              { label: OWN.lineCurrent, get: () => fmtUnit(model().currentA, 'A', { maxDigits: 2 }) },
              { label: OWN.loadVoltage, get: () => fmtUnit(model().loadV, 'V', { maxDigits: 1 }) },
              {
                label: OWN.efficiency,
                get: () => fmtPercent(model().efficiency, 1),
                color: () =>
                  model().efficiency > 0.9 ? 'green' : model().efficiency > 0.5 ? 'amber' : 'red',
              },
            ],
          },
        ],
      },
      controls: [
        {
          type: 'segmented',
          id: 'u8',
          label: OWN.sourceVoltage,
          items: LOSSES.voltagesV.map((u, k) => ({ id: String(u), label: DOC.voltages[k]! })),
          value: '12',
        },
        {
          type: 'segmented',
          id: 'a8',
          label: OWN.area,
          items: LOSSES.crossSectionsMm2.map((a) => ({ id: String(a), label: fmtUnit(a, 'mm²') })),
          value: '1.5',
        },
        { type: 'slider', id: 'len8', label: OWN.cordLength, ...span, value: span.default, unit: 'm' },
      ],
      callouts: [
        {
          anchor: () => cottage.group.getWorldPosition(v).setY(v.y + 1.0),
          text: () => `${OWN.heater} ${fmtUnit(volts(), 'V')} · 2 kW`,
          side: 'up',
        },
        { anchor: supply.side, text: () => `${OWN.source} ${fmtUnit(volts(), 'V')}`, side: 'up' },
      ],
      hotspots: [
        { anchor: () => set.localToWorld(v.copy(cord.mid)).setY(v.y + 0.1), content: 'hot-extension-cord' },
        { anchor: () => set.localToWorld(v.copy(entry)).setY(v.y + 0.25), content: 'sankey-ribbon' },
      ],
    },
    update(dt, t) {
      const on = bench.isCurrent(ID);
      const m = model();
      cord.setLength((ui.value<number>('len8') - span.min) / (span.max - span.min));
      const sent = m.loadW + m.lossW;
      // cord: pulses ∝ power sent, speed ∝ current, colour ∝ loss per metre (≈ 6 W/m glows red)
      const k = on ? Math.min(m.lossPerMetreW / 6, 1) : 0;
      cord.drive(on ? 0.4 + m.currentA / 8 : 0, on ? 0.3 + 1.9 * (sent / LOSSES.ratedW) : 0, k, t);
      drop.drive(on ? 0.4 + m.currentA / 8 : 0, on ? 0.2 + 2.0 * (m.loadW / LOSSES.ratedW) : 0);
      shimmer.intensity = 1.6 * k;
      heat.rate = on ? Math.min((m.lossW / 500) * 1.0, 1) : 0;
      // the heater's glow fills the cottage windows
      cottage.night = on ? m.heaterBrightness : 0;
      supply.set(volts(), on ? m.currentA : 0);
      supply.update(t);
      ribbon.set(m.loadW, m.lossW);
      bench.live.hum = on ? 0.3 + 0.5 * Math.min(sent / LOSSES.ratedW, 1) : 0;
      void dt;
    },
  };
};
