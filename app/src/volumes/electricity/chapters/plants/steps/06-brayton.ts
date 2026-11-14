/**
 * Step 6 `brayton` — «Цикл Брайтона: повітря, стиснення, полум’я». The gas turbine with its casing lifted: air in,
 * compression, the combustor ring, hot gas through the turbine and out of the exhaust. A thick yellow stream runs
 * back along the shaft to the compressor (its share of the turbine work), a thinner one to the generator.
 * The slider sets the pressure ratio r: ideal η_B (plants sim M3) and the T–s contour of air follow; the real
 * machine's numbers (TIT 1600 °C) come from plant-gas M1 / M3. «Підключити котел-утилізатор» adds the
 * heat-recovery boiler with a small Rankine loop: the exhaust cools and the efficiency jumps (combined cycle).
 */
import { Vector3 } from 'three';
import { STACK_TEMP_K, combinedCycle, gasTurbine } from '@electricity/sim/plant-gas';
import { braytonIdealEfficiency } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc } from '../labels';
import { OWN } from '../labels-own';
import { createBraytonRig } from '../parts/brayton-rig';
import { STUDIO_TUNE } from '../shots';
import { braytonContour } from '../sim-bindings/ts-diagram';
import { group } from '../world';

const ID = 'brayton';
const TIT_C = 1600;

export const brayton: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID, -6, 0, 4);
  set.scale.setScalar(1.25);
  hub.stageRoot.add(set);
  const rig = createBraytonRig(ctx);
  set.add(rig.group);
  const aHrsg = ctx.stage.actor(rig.hrsg, { appear: 'grow', inDuration: 0.9 });
  const r = (): number => ui.value<number>('r6');
  const hrsg = (): boolean => ui.value<boolean>('hrsg6');
  const gt = () => gasTurbine(r(), TIT_C);
  const cc = () => combinedCycle({ pressureRatio: r(), titC: TIT_C, levels: 3, hrsg: true, firingMW: 0 });
  const eta = (): number => (hrsg() ? cc().eta : gt().eta);
  const sync = (instant: boolean): void => {
    if (ctx.stage.shown(aHrsg) !== hrsg()) ctx.stage.toggle(aHrsg, hrsg(), { instant });
  };
  const w = (p: Vector3): Vector3 => set.localToWorld(p.clone());
  ctx.qa.probe('compressor', () => w(rig.at.compressor));

  return {
    id: ID,
    noLines: true,
    shots: {
      [ID]: { position: [0, 9, 29], target: [0, 4.4, 4], fov: 38, drift: 0.4, fit: { center: [2, 5, 4], radius: 19 } },
    },
    stage: {
      show: [set],
      env: 'dusk',
      envTune: STUDIO_TUNE,
      enter: (info) => sync(info.instant),
    },
    ui: {
      honesty: ['simplified', 'notToScale', { slowed: 100 }],
      controls: [
        { type: 'slider', id: 'r6', label: OWN.pressureRatio, min: 4, max: 40, step: 1, value: 20 },
        { type: 'toggle', id: 'hrsg6', label: doc(ID, 1), value: false, onChange: () => hub.sound.relay() },
        {
          type: 'stats',
          id: 'read6',
          columns: 2,
          items: [
            { label: 'η_B = 1 − r^(−0,286)', get: () => 100 * braytonIdealEfficiency(r()), unit: '%', digits: 1, color: () => 'amber' },
            { label: OWN.etaReal, get: () => 100 * eta(), unit: '%', digits: 0, color: () => (hrsg() ? 'green' : 'mist') },
            { label: doc(ID, 0), get: () => 100 * gt().compressorShare, unit: '%', digits: 0, color: () => 'yellow' },
            { label: OWN.exhaustT, get: () => (hrsg() ? STACK_TEMP_K[3] - 273.15 : gt().t4C), unit: '°C', digits: 0, color: () => (hrsg() ? 'sky' : 'orange') },
          ],
        },
      ],
      board: {
        title: OWN.tsAirBoard,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'ts6',
            chart: { height: 200, x: { min: -0.1, max: 2.2, label: 's, kJ/(kg·K)' }, y: { min: 0, max: 1700, label: 't, °C' }, series: [{ id: 'cycle', color: 'orange', width: 3 }] },
            update: (c) => {
              const k = braytonContour(r(), TIT_C);
              c.setData('cycle', k.map((q) => q[0]), k.map((q) => q[1]));
            },
          },
        ],
      },
      callouts: [
        { anchor: () => w(rig.at.combustor.clone().add(new Vector3(0, 2.6, 0))), text: OWN.combustor, side: 'up', priority: 1 },
        { anchor: () => w(rig.at.turbine.clone().add(new Vector3(0, 2.4, 0))), text: OWN.gasTurbineName, side: 'up', priority: 2 },
        { anchor: () => w(rig.at.generator), text: OWN.generatorShort, side: 'left', priority: 3 },
        { anchor: () => w(rig.at.exhaust.clone().add(new Vector3(7, 9.6, 0))), text: OWN.hrsg, side: 'right', visible: () => hrsg(), priority: 2 },
      ],
      hotspots: [{ anchor: () => w(rig.at.compressor), content: 'compressor' }],
    },
    probe: () => ({ r: r(), etaIdeal: braytonIdealEfficiency(r()), eta: eta(), share: gt().compressorShare, hrsg: hrsg(), hrsgShown: ctx.stage.shown(aHrsg) }),
    update(dt) {
      if (!hub.isCurrent(ID)) return;
      sync(false);
      // shaft ≈ 3000 rpm shown ×100 slower
      rig.gt.speed = (2 * Math.PI * 50) / 100;
      rig.gt.update(dt, 0);
      rig.gen.part('rotor').rotation.x -= rig.gt.speed * dt;
      const g = gt();
      rig.toCompressor.density = Math.min(1, g.compressorShare * 1.6);
      rig.toGenerator.density = Math.max(0.1, 1 - g.compressorShare);
      rig.exhaust.density = hrsg() ? 0 : 1;
      rig.cooled.density = hrsg() ? 1 : 0;
      rig.shimmer.visible = !hrsg();
      rig.mini.parts.rotor.rotation.x += dt * 4;
      arch.want.ring = 0.3;
      hub.sound.fire = 0.35;
      hub.sound.turbine = 0.4;
      hub.sound.turbinePitch = 0.8 + r() / 100;
      hub.sound.steam = hrsg() ? 0.15 : 0;
    },
  };
};
