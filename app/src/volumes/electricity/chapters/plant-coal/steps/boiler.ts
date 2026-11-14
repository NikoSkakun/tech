/**
 * Step 4 `boiler` — «Котел: вогняна вежа». The boiler house opens (front halves slide apart, roof lifts): the tall
 * furnace with its water-wall tubes, the swirling tangential fire, platens, reheater and economizer in the
 * convective shaft, the air heater outside. A height scale (a person, a ten-storey block) stands beside it.
 * Seen from the north (the shell opens there), so east — the convective shaft, the air heater — is screen-left.
 * Interaction: «Показати шлях» (water and steam / flue gas / air) highlights one stream and thins the others;
 * «Без екранів» removes the water walls for 3 s — the casing glows red and the warning appears; the boiler type
 * switch shows the drum (drum boiler) or the separators (once-through).
 */
import { Group, Vector3 } from 'three';
import { applyHeat } from '@/fx';
import { Builder, people } from '@/kit';
import { col, type KToonMaterial } from '@/style';
import { HOTSPOTS } from '../hotspots';
import { BOILER, ISLAND } from '../layout';
import type { Medium } from '../parts/boiler-fx';
import type { StepFactory } from './types';

/** A ten-storey block (3 m per floor) and a person for the height scale. */
function buildScale(rng: Parameters<typeof people>[1]): Group {
  const b = new Builder('height-scale');
  b.box(9, 30, 9, { r: 0.4, c: ['steel', 'mist'] });
  for (let f = 0; f < 10; f++) for (const x of [-2.6, 0, 2.6]) b.box(1.6, 1.6, 0.2, { r: 0, slot: 'window', c: col('blue.dark').lerp(col('sky'), 0.3), at: [x, 1 + f * 3, 4.55] });
  b.box(9.6, 0.6, 9.6, { r: 0.1, slot: 'gloss', c: 'amber', at: [0, 30, 0] });
  const group = new Group();
  group.add(b.build().group, people([{ at: [7, 0, 4], ry: 0.6, hat: 'yellow', color: 'orange', action: 'idle', scale: 1.4 }], rng).group);
  return group;
}

export const boiler: StepFactory = ({ ctx, ui, L, plant, hot }) => {
  const { core, boilerFx, interior, gas } = plant;
  const g = ISLAND.ground;
  const origin = new Vector3(BOILER.x, g, BOILER.z);
  const at = (p: Vector3): (() => Vector3) => {
    const w = new Vector3(p.x, p.y, -p.z).add(origin); // interior is mirrored in z (parts/plant.ts)
    return () => w;
  };
  const aInterior = ctx.stage.actor(interior, { appear: 'fade' });
  const aTubes = ctx.stage.actor(core.tubes.group, { appear: 'grow' });
  const aDrum = ctx.stage.actor(core.drum.group, { appear: 'pop' });
  const aSep = ctx.stage.actor(core.separators.group, { appear: 'pop' });
  const scale = buildScale(ctx.random.fork('scale'));
  scale.position.set(BOILER.x + BOILER.w / 2 + 14, g, BOILER.z - BOILER.d / 2 - 12);
  scale.rotation.y = Math.PI;
  ctx.root.add(scale);
  // «Без екранів»: the casing behind the tubes heats up (orange → red)
  const wallMat = core.wall.mats.get('toon') as KToonMaterial;
  ctx.stage.param('wallHeat', 0, { duration: 0.8, onChange: (v) => applyHeat(wallMat, v) });
  let wallsOff = false;
  const path = (): Medium => ui.value<Medium>('b.path');
  const drumOn = (): boolean => ui.value<string>('b.type') === 'drum';
  const noWalls = (): void => {
    if (wallsOff) return;
    wallsOff = true;
    ctx.stage.toggle(aTubes, false);
    ctx.stage.setParam('wallHeat', 1);
    ctx.stage.scope.delay(3, () => {
      ctx.stage.toggle(aTubes, true);
      ctx.stage.setParam('wallHeat', 0);
      wallsOff = false;
    });
  };
  ctx.qa.expose('boiler', () => ({ path: path(), wallsOff, drum: ctx.stage.shown(aDrum), separators: ctx.stage.shown(aSep), tubes: core.tubes.group.visible }));
  const P = core.points;
  const T = (water: string, gasT: string, plain: string) => (): string => (path() === 'water' ? water : path() === 'gas' ? gasT : plain);
  return {
    id: 'boiler',
    stage: {
      camera: 'boiler',
      params: { boilerOpen: 1 },
      show: [aInterior, aTubes, aDrum, scale],
      enter: () => {
        wallsOff = false;
        boilerFx.show(path());
        const drum = drumOn();
        ctx.stage.toggle(aDrum, drum, { instant: true });
        ctx.stage.toggle(aSep, !drum, { instant: true });
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'simplified'],
      controls: [
        {
          type: 'segmented',
          id: 'b.path',
          label: L.showPath,
          value: 'water',
          items: [
            { id: 'water', label: L.pathWater },
            { id: 'gas', label: L.pathGas },
            { id: 'air', label: L.pathAir },
          ],
          onChange: (m) => boilerFx.show(m as Medium),
        },
        {
          type: 'segmented',
          id: 'b.type',
          label: L.boilerType,
          value: 'drum',
          items: [
            { id: 'drum', label: L.drum },
            { id: 'once', label: L.onceThrough },
          ],
          onChange: (v) => {
            ctx.stage.toggle(aDrum, v === 'drum');
            ctx.stage.toggle(aSep, v !== 'drum');
          },
        },
        { type: 'note', id: 'b.warn', icon: 'warning', color: 'ui.alarm', text: L.noWallsWarning, visible: () => wallsOff },
        { type: 'button', id: 'b.noWalls', label: L.noWalls, icon: 'warning', primary: true, disabled: () => wallsOff, onClick: noWalls },
      ],
      callouts: [
        { anchor: at(P.furnace), text: T(L.furnace, L.furnaceHot, L.furnace), side: 'right', priority: 0 },
        { anchor: at(P.platen), text: T(L.superheaterHot, L.furnaceExit, L.superheater), side: 'right', priority: 1 },
        { anchor: at(P.reheater), text: T(L.reheatHot, L.reheater, L.reheater), side: 'left', priority: 4 },
        { anchor: at(P.economizer), text: T(L.feedIn, L.gasEco, L.economizer), side: 'left', priority: 2 },
        { anchor: () => gas.marks.airHeater, text: T(L.airHeater, L.gasOut, L.airHot), side: 'left', priority: 3 },
        { anchor: at(P.walls), text: L.waterWalls, side: 'right', priority: 5, visible: () => !wallsOff },
        { anchor: at(P.drum), text: L.drumName, side: 'up', priority: 7, visible: drumOn },
        { anchor: () => scale.position.clone().add(new Vector3(0, 31, 0)), text: L.tenFloors, side: 'left', priority: 8 },
      ],
      hotspots: [
        hot(at(P.burner), HOTSPOTS.boiler.burner),
        hot(at(P.soot), HOTSPOTS.boiler.soot),
        hot(at(P.hopper), HOTSPOTS.boiler.hopper),
      ],
    },
  };
};
