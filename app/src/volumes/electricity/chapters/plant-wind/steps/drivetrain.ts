/**
 * Step 6 `drivetrain` — «Мультиплікатор чи прямий привод». The hero nacelle is rebuilt between three drive
 * trains (DFIG / direct-drive PMSG / medium-speed PMSG, parts/nacelle-rig.ts). Readouts from the simulation's
 * `drivetrain(id, v)`: rotor and generator speed, the raw frequency that floats with the wind, 50 Hz at the
 * output; two scopes show the same thing as waveforms (parts/scopes.ts).
 */
import { fmtNumber, fmtPercent, fmtUnit } from '@/content';
import { DRIVETRAINS, drivetrain as model, type DrivetrainId } from '@electricity/sim/plant-wind';
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { hotspotNames } from '../content';
import { HERO } from '../layout';
import { addFieldArcs, buildScopes, createBadge, SCOPE_SLOWDOWN } from '../parts';
import type { StepFactory } from './types';

const IDS: readonly DrivetrainId[] = ['A_DFIG', 'B_DIRECT', 'C_MEDIUM'];
/** Illustrative counters of the document («умовні»): relative nacelle mass and number of moving parts. */
const MASS = { A_DFIG: 1, B_DIRECT: 1.35, C_MEDIUM: 1.1 } as const;
const MOVING = { A_DFIG: 9, B_DIRECT: 2, C_MEDIUM: 5 } as const;

export const drivetrain: StepFactory = ({ ctx, ui, L, live, hero, rig }) => {
  const scopes = buildScopes(L.scopeRaw, L.scopeGrid);
  // above the nacelle, turned to the viewer every frame
  scopes.group.position.copy(hero.base).add(new Vector3(1.6, HERO.hubHeight + 4.3, 0));
  ctx.root.add(scopes.group);
  const aScopes = ctx.stage.actor(scopes.group, { appear: 'pop' });
  // the document's «умовні» counters, as one line under the scopes
  const facts = createBadge('', 'white', 16, 96);
  facts.position.set(0, -1.75, 0);
  const speeds = createBadge('', 'yellow', 18, 96);
  speeds.position.set(0, -1.3, 0);
  scopes.group.add(facts, speeds);
  const fields = [addFieldArcs(hero.room.model.part('rotB'), 1.92, 1.1, 28), addFieldArcs(hero.room.model.part('rotC'), 1.56, -1.95, 22)];
  let shown: DrivetrainId | '' = '';
  const id = (): DrivetrainId => ui.value<DrivetrainId>('dt.set');
  const state = (): ReturnType<typeof model> => model(id(), ui.value<number>('dt.v'));
  const [hsDcLink, hsSlipRings] = hotspotNames('drivetrain');
  const far = hero.room.at('transformer'); // slip rings exist only in the DFIG: park the marker otherwise
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
        { type: 'segmented', id: 'dt.set', items: IDS.map((k) => ({ id: k, label: DRIVETRAINS[k].label.replace(' PMSG', '') })), value: 'A_DFIG', onChange: (k) => (rig.setVariant(k as DrivetrainId), audio.play('relay')) },
        { type: 'slider', id: 'dt.v', label: L.v, min: 3, max: 25, step: 0.5, unit: 'm/s', digits: 1, value: 8 },
        { type: 'toggle', id: 'dt.field', label: L.fieldB, value: true },
      ],
      hotspots: [
        { anchor: hero.room.at('dcLink'), title: hsDcLink! },
        { anchor: () => (id() === 'A_DFIG' ? hero.room.at('slipRings') : far).getWorldPosition(scopes.tmp), title: hsSlipRings! },
      ],
    },
    update(dt) {
      live.windTarget = ui.value<number>('dt.v');
      live.coverTarget = 1;
      const s = state();
      scopes.group.quaternion.copy(ctx.camera.camera.quaternion);
      if (shown !== id()) {
        shown = id();
        facts.text = `${L.converterShare}: ${fmtPercent(s.converterShare)} · ${L.movingParts}: ${MOVING[id()]} · ${L.nacelleMass}: ×${fmtNumber(MASS[id()], { digits: 2 })}`;
      }
      const rpm = `${fmtUnit(s.rotorRpm, 'rpm', { digits: 1 })} → ${fmtUnit(s.generatorRpm, 'rpm', { digits: 0 })} · ${L.rawHz}: ${fmtUnit(s.rawFrequencyHz, 'Hz', { digits: 1 })} → ${L.outHz}: ${fmtUnit(s.outputHz, 'Hz', { digits: 2 })}`;
      if (speeds.text !== rpm) speeds.text = rpm;
      const on = ui.value<boolean>('dt.field') ? 1 : 0;
      for (const f of fields) f.fade += (on - f.fade) * Math.min(1, dt * 5);
      scopes.update(dt, s.rawFrequencyHz, s.outputHz);
    },
  };
};
