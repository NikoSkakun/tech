/**
 * Step 6 `drivetrain` — «Мультиплікатор чи прямий привод». The hero nacelle is rebuilt between three drive
 * trains (DFIG / direct-drive PMSG / medium-speed PMSG, parts/nacelle-rig.ts). Readouts from the simulation's
 * `drivetrain(id, v)`: rotor and generator speed, the raw frequency that floats with the wind, 50 Hz at the
 * output — on the HUD board, with the document's illustrative counters; two scopes over the nacelle show the
 * same thing as waveforms (parts/scopes.ts).
 */
import { fmtNumber, fmtPercent } from '@/content';
import { drivetrain as model, type DrivetrainId } from '@electricity/sim/plant-wind';
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { HOTSPOTS } from '../hotspots';
import { HERO } from '../layout';
import { addFieldArcs } from '../parts/field-arcs';
import { SCOPE_SLOWDOWN, buildScopes } from '../parts/scopes';
import { hot } from './hot';
import type { StepFactory } from './types';

const IDS: readonly DrivetrainId[] = ['A_DFIG', 'B_DIRECT', 'C_MEDIUM'];
/** Illustrative counters of the document («умовні»): relative nacelle mass and number of moving parts. */
const MASS = { A_DFIG: 1, B_DIRECT: 1.35, C_MEDIUM: 1.1 } as const;
const MOVING = { A_DFIG: 9, B_DIRECT: 2, C_MEDIUM: 5 } as const;

export const drivetrain: StepFactory = ({ ctx, ui, L, live, hero, rig }) => {
  const scopes = buildScopes();
  // above the nacelle, turned to the viewer every frame
  scopes.group.position.copy(hero.base).add(new Vector3(1.6, HERO.hubHeight + 4.3, 0));
  ctx.root.add(scopes.group);
  const aScopes = ctx.stage.actor(scopes.group, { appear: 'pop' });
  const fields = [addFieldArcs(hero.room.model.part('rotB'), 1.92, 1.1, 28), addFieldArcs(hero.room.model.part('rotC'), 1.56, -1.95, 22)];
  const id = (): DrivetrainId => ui.value<DrivetrainId>('dt.set');
  const state = (): ReturnType<typeof model> => model(id(), ui.value<number>('dt.v'));
  const names: Record<DrivetrainId, string> = { A_DFIG: L.driveDfig, B_DIRECT: L.driveDirect, C_MEDIUM: L.driveMedium };
  const full: Record<DrivetrainId, string> = { A_DFIG: L.driveDfigFull, B_DIRECT: L.driveDirectFull, C_MEDIUM: L.driveMediumFull };
  const tmp = new Vector3();
  return {
    id: 'drivetrain',
    stage: {
      camera: 'drivetrain',
      show: [aScopes],
      post: { dofAperture: 0.5, tiltAmount: 0 },
      enter: (info) => rig.setVariant(id(), info.instant),
    },
    ui: {
      honesty: ['illustrative', { slowed: SCOPE_SLOWDOWN }],
      controls: [
        { type: 'segmented', id: 'dt.set', items: IDS.map((k) => ({ id: k, label: names[k] })), value: 'A_DFIG', onChange: (k) => (rig.setVariant(k as DrivetrainId), audio.play('relay')) },
        { type: 'slider', id: 'dt.v', label: L.v, min: 3, max: 25, step: 0.5, unit: 'm/s', digits: 1, value: 8 },
      ],
      callouts: [
        { anchor: scopes.raw, text: L.scopeRaw, color: 'amber', side: 'up' },
        { anchor: scopes.grid, text: L.scopeGrid, color: 'green', side: 'up' },
      ],
      hotspots: [
        hot(hero.room.at('dcLink'), HOTSPOTS.drivetrain.dcLink),
        // slip rings exist only in the doubly-fed machine
        hot(() => hero.room.at('slipRings').getWorldPosition(tmp), HOTSPOTS.drivetrain.slipRings, { visible: () => id() === 'A_DFIG' }),
      ],
      board: {
        title: L.driveBoard,
        size: 'sm',
        children: [
          { type: 'note', id: 'dt.name', text: () => full[id()], icon: 'info' },
          {
            type: 'stats',
            id: 'dt.speeds',
            columns: 2,
            items: [
              { label: L.rotorRpm, unit: 'rpm', digits: 1, get: () => state().rotorRpm },
              { label: L.genRpm, unit: 'rpm', digits: 0, get: () => state().generatorRpm },
              { label: L.rawHz, unit: 'Hz', digits: 1, get: () => state().rawFrequencyHz, color: () => 'amber' },
              { label: L.outHz, unit: 'Hz', digits: 2, get: () => state().outputHz, color: () => 'green' },
            ],
          },
          {
            type: 'table',
            id: 'dt.facts',
            rows: () => [
              [L.converterShare, fmtPercent(state().converterShare)],
              [L.movingParts, String(MOVING[id()])],
              [L.nacelleMass, `×${fmtNumber(MASS[id()], { digits: 2 })}`],
            ],
          },
          { type: 'toggle', id: 'dt.field', label: L.fieldB, value: true },
        ],
      },
    },
    update(dt) {
      live.windTarget = ui.value<number>('dt.v');
      live.coverTarget = 1;
      const s = state();
      scopes.group.quaternion.copy(ctx.camera.camera.quaternion);
      const on = ui.value<boolean>('dt.field') ? 1 : 0;
      for (const f of fields) f.fade += (on - f.fade) * Math.min(1, dt * 5);
      scopes.update(dt, s.rawFrequencyHz, s.outputHz);
    },
  };
};
