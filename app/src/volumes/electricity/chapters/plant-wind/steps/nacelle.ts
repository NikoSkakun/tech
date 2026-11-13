/**
 * Step 5 `nacelle` — «Гондола в розрізі». The cover petals swing open over the machine room of the hero
 * (parts/nacelle*.ts): colour-coded units in the true order of the power path, the slow main shaft and the
 * fast shaft behind the gearbox, a technician for scale. Ten hotspots; the «Шлях енергії» button walks the
 * energy through the units with their efficiencies; «Розріз / Зовнішній вигляд» closes the cover again.
 */
import { audio } from '@/audio';
import { people } from '@/kit';
import { STATUS } from '@/ui3d';
import { HOTSPOTS } from '../hotspots';
import { PATH_UNITS, buildEnergyPath } from '../parts/energy-path';
import { NAC } from '../parts/nacelle';
import { hot } from './hot';
import type { StepFactory } from './types';

export const nacelle: StepFactory = ({ ctx, ui, L, live, hero, rig, world }) => {
  const room = hero.room;
  const k = hero.k;
  const path = buildEnergyPath(ctx, k);
  hero.nacelle.add(path.group);
  // the technician, at the scale of the machine (a 6 MW nacelle is the size of a bus)
  const crew = people([{ at: [1.75 * k, NAC.floor * k, -4.9 * k], ry: -1.9, scale: 0.34, hat: 'yellow', color: 'orange', action: 'work' }], ctx.random.fork('crew'));
  hero.nacelle.add(crew.group);
  world.alive.push(crew);
  const aCrew = ctx.stage.actor(crew.group, { appear: 'pop' });

  const h = HOTSPOTS.nacelle;
  const spots: [string, string][] = [
    ['hub', h.hub],
    ['pitch', h.pitch],
    ['mainBearing', h.shaft],
    ['gearboxA', h.gearbox],
    ['brake', h.brake],
    ['generatorA', h.generator],
    ['converter', h.converter],
    ['yaw', h.yaw],
    ['sensors', h.sensors],
    ['cooling', h.cooling],
  ];
  const open = (): boolean => ui.value<boolean>('nc.cut');
  return {
    id: 'nacelle',
    stage: {
      camera: 'nacelle',
      show: [aCrew],
      post: { dofAperture: 0.5, tiltAmount: 0 },
      enter: (info) => {
        rig.setVariant('A_DFIG', info.instant);
        path.reset();
      },
      leave: () => path.reset(),
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { slowed: 7 }],
      controls: [
        { type: 'toggle', id: 'nc.cut', label: L.cutaway, value: true },
        { type: 'note', id: 'nc.total', text: L.total, icon: 'lightning', color: STATUS.ok, visible: () => path.revealed > PATH_UNITS.length },
        {
          type: 'button',
          id: 'nc.path',
          label: L.energyPath,
          icon: 'lightning',
          primary: true,
          onClick: () => {
            ui.set('nc.cut', true);
            // on the step's own scope: leaving the step cancels the units still waiting for their turn
            path.play(ctx.stage.scope);
            audio.play('zap', { gain: 0.5 });
          },
        },
      ],
      // efficiency of every unit the energy has reached so far
      callouts: [
        ...PATH_UNITS.map((u, i) => ({ anchor: room.at(u.anchor), text: u.label, color: 'yellow' as const, side: 'up' as const, visible: () => path.revealed > i && open() })),
        { anchor: crew.group, text: L.technician, color: 'mist', side: 'down', visible: open },
      ],
      hotspots: spots.map(([anchor, content]) => hot(room.at(anchor), content)),
    },
    update() {
      live.coverTarget = open() ? 1 : 0;
      if (path.revealed && !open()) path.reset();
    },
  };
};
