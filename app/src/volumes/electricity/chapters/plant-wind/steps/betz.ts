/**
 * Step 3 `betz` — «Межа Беца». Side view of the rotor inside its stream tube (parts/stream-tube.ts), driven
 * by the actuator-disc model M2 (`actuatorDisk`). Slider a with a soft magnet at 1/3; three presets: the rotor
 * does not brake at all, brakes completely (a wall), the Betz optimum. Chart C_p(a) with the working point.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { BETZ_A, BETZ_CP, TURBINE_6MW, actuatorDisk, turbinePowerW } from '@electricity/sim/plant-wind';
import { STATUS } from '@/ui3d';
import { hotspotNames } from '../content';
import { HERO, WIND } from '../layout';
import { buildConsole, buildStreamTube } from '../parts';
import type { StepFactory } from './types';

const AS = Array.from({ length: 51 }, (_, i) => i * 0.01);

export const betz: StepFactory = ({ ctx, ui, L, live, hero }) => {
  const tube = buildStreamTube(ctx, hero.radius);
  tube.group.position.copy(hero.hub);
  ctx.root.add(tube.group);
  const aTube = ctx.stage.actor(tube.group, { appear: 'fade' });
  const disk = (): ReturnType<typeof actuatorDisk> => actuatorDisk(ui.value<number>('bz.a'));
  let applied = -1;
  let wasBest = false;
  let block = 0; // preset (б): target of `tube.block`
  const preset = (a: number, wall: boolean): void => {
    ui.set('bz.a', a);
    block = wall ? 1 : 0;
  };
  ui.onChange('bz.a', () => (block = 0));
  const cp = (): number => (block ? 0 : disk().cp);
  // C_p(a) with the working point, on a hologram under the upstream half of the tube
  const panel = buildConsole(ctx, {
    title: 'C_p(a) = 4·a·(1 − a)²',
    width: 400,
    unit: 0.105,
    chart: { height: 170, x: { min: 0, max: 0.5, label: 'a' }, y: { min: 0, max: 0.65, label: 'C_p' }, series: [{ id: 'cp', color: 'sky', kind: 'area' }, { id: 'limit', color: 'green', width: 1.4 }] },
  });
  panel.chart.setData('cp', AS, AS.map((a) => 4 * a * (1 - a) ** 2));
  panel.chart.setData('limit', [0, 0.5], [BETZ_CP, BETZ_CP]);
  panel.surface.position.copy(hero.hub).add(new Vector3(-46, -34, 24));
  ctx.root.add(panel.surface);
  const aPanel = ctx.stage.actor(panel.surface, { appear: 'pop' });
  const [hsTube] = hotspotNames('betz');
  const top = new Vector3();
  return {
    id: 'betz',
    stage: {
      camera: 'betz',
      show: [aTube, aPanel],
      params: { windX: hero.hub.x + 20, windY: hero.hub.y - 50, windZ: hero.hub.z - 30, windLength: 300, windHeight: 100, windWidth: 150 },
      enter: () => (block = 0),
    },
    ui: {
      honesty: ['simplified', 'notToScale'],
      hint: L.aHint,
      controls: [
        { type: 'slider', id: 'bz.a', label: L.a, min: 0, max: 0.45, step: 0.01, digits: 2, value: 0.1, snaps: [BETZ_A], hint: L.aHint, marks: [{ value: BETZ_A, label: '1/3' }] },
        { type: 'readout', id: 'bz.cp', label: L.cp, digits: 3, get: cp, color: () => (disk().atBetz && !block ? STATUS.ok : 'white') },
        { type: 'readout', id: 'bz.vr', label: L.vRotor, unit: '%', digits: 0, get: () => (block ? 0 : disk().vRotorRel * 100) },
        { type: 'readout', id: 'bz.vw', label: L.vWake, unit: '%', digits: 0, get: () => (block ? 0 : disk().vWakeRel * 100) },
        { type: 'button', id: 'bz.free', label: L.presetFree, onClick: () => preset(0, false) },
        { type: 'button', id: 'bz.block', label: L.presetBlock, onClick: () => preset(0.45, true) },
        { type: 'button', id: 'bz.betz', label: L.presetBetz, primary: true, onClick: () => preset(BETZ_A, false) },
      ],
      hotspots: [{ anchor: () => tube.group.localToWorld(top.set(tube.downstream * 0.55, tube.radiusAt(tube.downstream * 0.55), 0)), title: hsTube! }],
    },
    update(dt) {
      const d = disk();
      const best = d.atBetz && !block;
      if (best && !wasBest) audio.play('success', { gain: 0.6 }); // the point clicks onto the Betz optimum
      wasBest = best;
      panel.chart.setMarker('now', { x: d.a, y: cp(), color: best ? 'green' : 'yellow', label: best ? L.betzChip : undefined });
      panel.surface.quaternion.copy(ctx.camera.camera.quaternion);
      if (d.a !== applied) {
        tube.set(d);
        applied = d.a;
      }
      tube.block = Math.min(1, Math.max(0, tube.block + (block ? dt : -dt) * 1.4));
      tube.speed = live.wind / HERO.realPerToy; // real time at the hero's scale
      tube.update(dt);
      // illustrative rotor response: no braking → it spins freely without torque; a wall does not turn at all
      live.heroManual = true;
      const free = 1 - Math.min(1, d.a / BETZ_A);
      const rpm = block ? 0 : 7.2 + 4.5 * free;
      live.heroRpm += (rpm - live.heroRpm) * Math.min(1, dt * 2);
      live.heroPitch += (0 - live.heroPitch) * Math.min(1, dt * 2);
      // electrical output ∝ C_p (the default wind of the diorama, 8 m/s, gives P at C_p ≈ 0.47)
      live.heroPower = (turbinePowerW(TURBINE_6MW, WIND.speed) / TURBINE_6MW.ratedW) * Math.min(1.2, cp() / 0.47);
    },
  };
};
