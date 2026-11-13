/**
 * Step 5 `nacelle` — «Гондола в розрізі». The cover petals swing open over the machine room of the hero
 * (parts/nacelle*.ts): colour-coded units in the true order of the power path, the slow main shaft and the
 * fast shaft behind the gearbox, a technician for scale. Ten hotspots; the «Шлях енергії» button walks the
 * energy through the units with their efficiencies; «Розріз / Зовнішній вигляд» closes the cover again.
 */
import { audio } from '@/audio';
import type { TweenScope } from '@/engine/api';
import { people } from '@/kit';
import { hotspotNames } from '../content';
import { buildEnergyPath, NAC } from '../parts';
import type { StepFactory } from './types';

export const nacelle: StepFactory = ({ ctx, ui, L, live, hero, rig, world }) => {
  const room = hero.room;
  const k = hero.k;
  const path = buildEnergyPath(ctx, room, k, L.total);
  hero.nacelle.add(path.group);
  // the technician, at the scale of the machine (a 6 MW nacelle is the size of a bus)
  const crew = people([{ at: [1.75 * k, NAC.floor * k, -4.9 * k], ry: -1.9, scale: 0.34, hat: 'yellow', color: 'orange', action: 'work' }], ctx.random.fork('crew'));
  hero.nacelle.add(crew.group);
  world.alive.push(crew);
  const aCrew = ctx.stage.actor(crew.group, { appear: 'pop' });

  const names = hotspotNames('nacelle');
  const anchors = [
    room.at('hub'),
    room.at('pitch'),
    room.at('mainBearing'),
    room.at('gearboxA'),
    room.at('brake'),
    room.at('generatorA'),
    room.at('converter'),
    room.at('yaw'),
    room.at('sensors'),
    room.at('cooling'),
  ];
  let played = false;
  // the walk-through runs on its own tween scope, so leaving the step (or closing the cover) cancels the
  // badges that are still waiting for their turn
  let scope: TweenScope | null = null;
  const stop = (): void => {
    scope?.killAll();
    scope = null;
    path.reset();
    played = false;
  };
  return {
    id: 'nacelle',
    stage: {
      camera: 'nacelle',
      show: [aCrew],
      post: { dofAperture: 0.5, tiltAmount: 0 },
      enter: (info) => {
        rig.setVariant('A_DFIG', info.instant);
        stop();
      },
      leave: stop,
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { slowed: 7 }],
      controls: [
        { type: 'toggle', id: 'nc.cut', label: L.cutaway, value: true },
        {
          type: 'button',
          id: 'nc.path',
          label: L.energyPath,
          icon: 'lightning',
          primary: true,
          onClick: () => {
            stop();
            ui.set('nc.cut', true);
            scope = ctx.tweens.scope();
            path.play(scope);
            audio.play('zap', { gain: 0.5 });
            played = true;
          },
        },
      ],
      hotspots: names.map((title, i) => ({ anchor: anchors[i]!, title })),
    },
    update() {
      live.coverTarget = ui.value<boolean>('nc.cut') ? 1 : 0;
      if (played && live.coverTarget === 0) stop();
    },
  };
};
