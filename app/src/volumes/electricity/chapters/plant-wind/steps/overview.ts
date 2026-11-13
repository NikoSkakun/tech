/**
 * Step 1 `overview` — «Вітер, що крутить генератори». Wide shot of the island: streaks of wind over the
 * hills, every rotor turning, the offshore farm on the horizon; above the hero the chain wind → rotor → grid.
 * Interaction: limited orbit (±35°, in the shot), the «День / Ніч» switch, and the scripted fly-around
 * («камера повільно облітає острів на 20°, потім наближається до турбіни») — played when the step is entered
 * with a transition and on demand with «Обліт острова» (a deep link opens the establishing shot at once).
 */
import { Vector3 } from 'three';
import { HOTSPOTS } from '../hotspots';
import { buildChainIcons } from '../parts/chain-icons';
import { PLATFORM } from '../parts/offshore';
import { setMood } from '../sound';
import { hot } from './hot';
import type { StepFactory } from './types';

/** Seconds: swing to the start of the arc, the 20° arc, the approach to the hero. */
const FLY = { settle: 1.4, arc: 7, approach: 4.5 } as const;

export const overview: StepFactory = ({ ctx, ui, L, live, hero, farm, grid, offshore }) => {
  const icons = buildChainIcons(ctx, 0.17);
  icons.surface.position.copy(hero.hub).add(new Vector3(0, hero.radius + 16, 0));
  ctx.root.add(icons.surface);
  const aIcons = ctx.stage.actor(icons.surface, { appear: 'pop' });
  const active = (): boolean => ctx.stage.current === 'overview';
  // desktop nicety; the same words stand on the hero's callout, so nothing is hover-only
  for (const target of [hero.group, farm.group]) ctx.input.register(target, { tooltip: L.turbineTip, enabled: active });

  const towerMid = hero.base.clone().lerp(hero.hub, 0.55);
  const platform = offshore.sea.group.localToWorld(new Vector3(PLATFORM[0], 18, PLATFORM[1]));
  const setNight = (on: boolean, instant = false): void => {
    ctx.env.set(on ? 'night' : 'day', { duration: instant ? 0 : 1.8 });
    setMood(on);
  };
  const fly = (): void => {
    const scope = ctx.stage.scope; // dies with the step: a half-flown arc never moves the next step's camera
    ctx.camera.go('overview-arc', { duration: FLY.settle });
    scope.delay(FLY.settle + 0.1, () => ctx.camera.go('overview', { duration: FLY.arc }));
    scope.delay(FLY.settle + FLY.arc + 0.6, () => ctx.camera.go('overview-hero', { duration: FLY.approach }));
  };
  return {
    id: 'overview',
    stage: {
      camera: 'overview',
      show: [aIcons],
      enter: (info) => {
        setNight(ui.value<boolean>('ov.night'), info.instant);
        if (!info.instant) fly();
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale'],
      controls: [
        { type: 'toggle', id: 'ov.night', label: L.dayNight, value: false, onChange: (on) => setNight(on) },
        { type: 'button', id: 'ov.fly', label: L.flyAround, icon: 'play', onClick: fly },
      ],
      callouts: [{ anchor: () => towerMid, text: L.turbineTip, side: 'left' }],
      hotspots: [
        hot(() => hero.hub, HOTSPOTS.overview.turbine),
        hot(() => grid.transformer, HOTSPOTS.overview.substation),
        hot(() => platform, HOTSPOTS.overview.offshore),
      ],
    },
    update(dt) {
      live.nightTarget = ui.value<boolean>('ov.night') ? 1 : 0;
      icons.surface.quaternion.copy(ctx.camera.camera.quaternion); // face the viewer
      icons.update(dt, hero.turbine.rotorSpeed, live.wind);
    },
  };
};
