/**
 * Step 1 `overview` — «Вітер, що крутить генератори». Wide shot of the island: streaks of wind over the
 * hills, every rotor turning, the offshore farm on the horizon; above the hero the chain wind → rotor → grid.
 * Interaction: limited orbit (±35°, in the shot), tooltips on the turbines, the «День / Ніч» switch.
 */
import { Vector3 } from 'three';
import { hotspotNames } from '../content';
import { setMood } from '../sound';
import { buildChainIcons, PLATFORM } from '../parts';
import type { StepFactory } from './types';

export const overview: StepFactory = ({ ctx, ui, L, live, hero, farm, grid, offshore }) => {
  const icons = buildChainIcons(ctx, 0.17);
  icons.surface.position.copy(hero.hub).add(new Vector3(0, hero.radius + 16, 0));
  ctx.root.add(icons.surface);
  const aIcons = ctx.stage.actor(icons.surface, { appear: 'pop' });
  const active = (): boolean => ctx.stage.current === 'overview';
  for (const target of [hero.group, farm.fleet.group])
    ctx.input.register(target, { tooltip: L.turbineTip, enabled: active });

  const [hsTurbine, hsSubstation, hsOffshore] = hotspotNames('overview');
  const platform = offshore.sea.group.localToWorld(new Vector3(PLATFORM[0], 18, PLATFORM[1]));
  const setNight = (on: boolean, instant = false): void => {
    ctx.env.set(on ? 'night' : 'day', { duration: instant ? 0 : 1.8 });
    setMood(on);
  };
  return {
    id: 'overview',
    stage: {
      camera: 'overview',
      show: [aIcons],
      enter: (info) => setNight(ui.value<boolean>('ov.night'), info.instant),
    },
    ui: {
      reset: true,
      honesty: ['notToScale'],
      controls: [{ type: 'toggle', id: 'ov.night', label: L.dayNight, value: false, onChange: (on) => setNight(on) }],
      hotspots: [
        { anchor: () => hero.hub, title: hsTurbine! },
        { anchor: () => grid.transformer, title: hsSubstation! },
        { anchor: () => platform, title: hsOffshore! },
      ],
    },
    update(dt) {
      live.nightTarget = ui.value<boolean>('ov.night') ? 1 : 0;
      icons.surface.quaternion.copy(ctx.camera.camera.quaternion); // face the viewer
      icons.update(dt, hero.turbine.rotorSpeed, live.wind);
    },
  };
};
