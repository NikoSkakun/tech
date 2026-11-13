import { Mesh, SphereGeometry, TorusGeometry } from 'three';
import { defineScene } from '@/engine/api';
import { K } from '@/style';
import { UiNode, conceal, hudSurface, reveal } from '@/ui3d';
import { cardsDemo } from './parts/cards';
import { createConsole } from './parts/console';
import { controlsDemo } from './parts/controls';
import { extrasDemo } from './parts/extras';
import { readoutsDemo } from './parts/readouts';
import { declareBoardStep } from './parts/step-board';
import { declareOverflowStep } from './parts/step-overflow';
import { declareStepUi } from './parts/step-ui';

export default defineScene((ctx) => {
  const { root, stage, camera } = ctx;
  const core = new Mesh(new SphereGeometry(1.2, 48, 32), K.toon({ color: 'coral', gloss: 0.5 }));
  const ring = new Mesh(new TorusGeometry(2.2, 0.08, 16, 96), K.glow({ color: 'cyan', intensity: 1.8 }));
  ring.rotation.x = 1.2;
  root.add(core, ring);
  camera.shots({ main: { position: [0, 1.5, 11], target: [0, 0, 0] } });
  const desk = createConsole(ctx);
  desk.surface.position.set(-5.2, 0.4, 0.4);
  desk.surface.rotation.y = 0.5;
  root.add(desk.surface);
  stage.define({
    controls: { camera: 'main' },
    readouts: { camera: 'main' },
    charts: { camera: 'main' },
    cards: { camera: 'main' },
    world: { camera: 'main', show: [desk.surface] },
    overflow: { camera: 'main' },
    board: { camera: 'main' },
  });

  const stepUiApi = declareStepUi(ctx, { core, ring });
  declareOverflowStep(ctx, stepUiApi);
  const boardStep = declareBoardStep(ctx, stepUiApi, { core });
  const ui = hudSurface(ctx);
  const readouts = readoutsDemo();
  const extras = extrasDemo();
  const pages: Record<string, UiNode> = {
    controls: controlsDemo(),
    readouts: readouts.node,
    charts: extras.node,
    cards: cardsDemo(),
  };
  const host = new UiNode({
    dir: 'stack',
    width: 'fill',
    height: 'fill',
    align: 'start',
    justify: 'center',
    pad: [40, 110, 0, 110],
  });
  for (const p of Object.values(pages)) {
    p.visible = false;
    host.add(p);
  }
  ui.root.add(host);

  let spin = 0;
  return {
    enterStep(stepId, info) {
      for (const [id, p] of Object.entries(pages)) {
        if (id === stepId) reveal(p, { instant: info.instant, dx: -30, dy: 0 });
        else conceal(p, { instant: info.instant, dx: -30, dy: 0 });
      }
    },
    update(_dt, t) {
      spin += (desk.speed() / 1500) * 0.4 * _dt;
      ring.rotation.z = spin;
      desk.update(t);
      core.position.y = Math.sin(t * 1.3) * 0.12;
      readouts.update(t);
      extras.update(t);
      boardStep.update();
    },
  };
});
