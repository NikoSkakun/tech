/**
 * Gallery of `@/fx`: one stand per effect family. It doubles as the visual regression scene of the library
 * (contact sheets in /srv/electricity/qa/F3-fx) and as usage examples for chapter builders.
 */
import { audio } from '@/audio';
import { defineScene } from '@/engine/api';
import { createCharactersExhibit } from './parts/characters';
import { createDramaExhibit } from './parts/drama';
import type { Exhibit } from './parts/exhibit';
import { createFieldsExhibit } from './parts/fields';
import { createFlowExhibit } from './parts/flow';
import { createInductionExhibit } from './parts/induction';
import { createMachineExhibit } from './parts/machine';
import { createSignalsExhibit } from './parts/signals';
import { createThermalExhibit } from './parts/thermal';

export default defineScene(async (ctx) => {
  const { root, stage, camera } = ctx;
  ctx.env.setScale(7);
  ctx.env.setShadow({ extent: 8, center: [0, 1, 0], softness: 3 });

  const exhibits: Record<string, Exhibit> = {};
  const add = async (id: string, make: () => Exhibit): Promise<void> => {
    const exhibit = make();
    exhibits[id] = exhibit;
    root.add(exhibit.group);
    await ctx.breathe();
  };
  await add('characters', () => createCharactersExhibit(ctx));
  await add('fields', () => createFieldsExhibit(ctx));
  await add('induction', () => createInductionExhibit(ctx));
  await add('flow', () => createFlowExhibit(ctx));
  await add('thermal', () => createThermalExhibit(ctx));
  await add('machine', () => createMachineExhibit(ctx));
  await add('signals', () => createSignalsExhibit(ctx));
  await add('drama', () => createDramaExhibit(ctx));

  camera.shots({
    characters: { position: [0, 2.0, 15.5], target: [0, 1.55, 0], fov: 30, orbit: { azimuth: 0.5, polar: 0.25 } },
    fields: { position: [0, 4.6, 15.5], target: [0, 2.5, 0], fov: 30, orbit: { azimuth: 0.6, polar: 0.3 } },
    induction: { position: [2.5, 4.4, 15], target: [0, 2.3, 0], fov: 30, orbit: { azimuth: 0.7, polar: 0.3 } },
    flow: { position: [1.4, 3.2, 13.4], target: [0.5, 2.15, 0], fov: 30, orbit: { azimuth: 0.6, polar: 0.3 } },
    thermal: { position: [1.0, 4.6, 16.5], target: [0, 2.2, 0], fov: 30, orbit: { azimuth: 0.6, polar: 0.3 } },
    machine: { position: [3.8, 4.6, 11.2], target: [0.2, 1.75, 0], fov: 30, orbit: { azimuth: 0.8, polar: 0.35 } },
    signals: { position: [0.8, 3.6, 17.5], target: [0, 2.5, 0], fov: 30, orbit: { azimuth: 0.5, polar: 0.25 } },
    drama: { position: [1.3, 3.2, 13.6], target: [0.5, 2.0, 0], fov: 30, orbit: { azimuth: 0.6, polar: 0.3 } },
  });
  stage.define({
    characters: {
      show: [exhibits.characters!.group],
      camera: 'characters',
      post: { dofAperture: 0.5, bloomIntensity: 1.1 },
    },
    fields: { show: [exhibits.fields!.group], camera: 'fields', post: { dofAperture: 0.35 } },
    induction: { show: [exhibits.induction!.group], camera: 'induction', post: { dofAperture: 0.35 } },
    flow: { show: [exhibits.flow!.group], camera: 'flow', post: { dofAperture: 0.4 } },
    thermal: { show: [exhibits.thermal!.group], camera: 'thermal', post: { dofAperture: 0.3 } },
    machine: { show: [exhibits.machine!.group], camera: 'machine', post: { dofAperture: 0.3 } },
    signals: { show: [exhibits.signals!.group], camera: 'signals', post: { dofAperture: 0.25 } },
    drama: { show: [exhibits.drama!.group], camera: 'drama', post: { dofAperture: 0.35 } },
  });

  return {
    enterStep(stepId, info) {
      audio.stopLoops(); // each stand re-requests its own loops in update()
      exhibits[stepId]?.enter?.(info);
    },
    update(dt, t) {
      const current = stage.current;
      if (current) exhibits[current]?.update?.(dt, t);
    },
  };
});
