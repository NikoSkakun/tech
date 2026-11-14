/**
 * Step 5 `fuel` — «Паливо: таблетка → твел → ТВЗ». The fuel at real size, staged by one level (`fuel-zoom.ts`):
 * the «Масштаб» slider (log) runs pellet → rod → assembly → core, and the parts gather on cue. Entering the
 * step plays the assembly once (pellet → core). A tap on the pellet shows the «≈ 0,6 t вугілля» chip;
 * «Порівняти» brings the 0,7 m³ coal heap (rod level) or a year of uranium beside a coal wagon (core level).
 * «Карта зони» turns the core to a top view coloured by age; «Перевантаження» plays the (illustrative) reload.
 */
import { Vector3 } from 'three';
import { damp } from '@/engine/api';
import { HOTSPOTS } from '../hotspots';
import { HALL_TUNE, INNER_POST } from '../looks';
import { AGE_COLORS, buildFuelZoom } from '../parts/fuel-zoom';
import { hot, probe } from './hot';
import type { StepFactory } from './types';

const LEVEL_IDS = ['lvPellet', 'lvRod', 'lvFa', 'lvCore'] as const;

export const fuel: StepFactory = ({ ctx, ui, L, inner }) => {
  const set = inner.sets.fuel;
  const rng = ctx.random.fork('fuel-ages');
  const zoom = buildFuelZoom(() => rng.next());
  set.add(zoom.group);
  let levelTarget = 0;
  let chip = false;
  let compare = false;
  const level = (): number => ui.value<number>('fu.scale');
  const map = (): boolean => ui.value<boolean>('fu.map');
  // a point of the exhibit (real metres) → world, through the exhibit's live scale / centring / tilt
  const exhibit = zoom.group.children[0]!;
  const real = exhibit.children[0]!;
  const w = (p: Vector3): Vector3 => real.localToWorld(p.clone());
  ctx.input.register(zoom.models.pellets, {
    cursor: 'pointer',
    tooltip: L.coalChip,
    enabled: () => ctx.stage.current === 'fuel' && zoom.level < 0.9,
    click: () => (chip = !chip),
  });
  probe('fuel.pellet', () => w(zoom.at.pellet));
  ctx.qa.expose('fuel', () => ({ level: zoom.level, tilt: zoom.tilt, chip, compare, reload: zoom.reload, ages: zoom.ages.join('') }));
  const nameOf = (v: number): string => L[`${LEVEL_IDS[Math.min(3, Math.round(v))]!}Short` as 'lvPelletShort'];
  return {
    id: 'fuel',
    stage: {
      camera: 'fuel',
      envTune: HALL_TUNE,
      post: INNER_POST,
      enter: (info) => {
        chip = false;
        compare = false;
        zoom.reload = -1;
        zoom.level = info.instant ? 2 : 0;
        // the assembly plays once: pellet → rod → assembly → core
        if (!info.instant) ui.set('fu.scale', 0);
        info.scope.delay(info.instant ? 0 : 1.2, () => ui.set('fu.scale', 2));
      },
    },
    ui: {
      honesty: ['notToScale', { kind: 'illustrative', visible: () => zoom.reload >= 0 || map() }],
      controls: [
        {
          type: 'slider',
          id: 'fu.scale',
          label: L.scale,
          min: 0,
          max: 3,
          step: 0.01,
          value: 2,
          format: nameOf,
          marks: [0, 1, 2, 3].map((v) => ({ value: v, label: nameOf(v) })),
        },
        { type: 'button', id: 'fu.compare', label: L.compare, icon: 'scale', onClick: () => (compare = !compare) },
        { type: 'toggle', id: 'fu.map', label: L.coreMap, value: false, onChange: (on) => on && ui.set('fu.scale', 3) },
        { type: 'button', id: 'fu.reload', label: L.reload, icon: 'play', visible: map, onClick: () => zoom.reload < 0 && (zoom.reload = 0) },
      ],
      board: {
        title: L.scale,
        size: 'sm',
        children: [
          { type: 'readout', id: 'fu.lv', label: L.lvCoreShort, text: () => L[LEVEL_IDS[Math.min(3, Math.round(zoom.level))]!] },
          { type: 'stats', id: 'fu.pellet', columns: 2, visible: () => zoom.level < 1.5, items: [{ label: L.pelletHeat, get: () => L.pelletHeatValue }, { label: L.pelletElectric, get: () => L.pelletElectricValue }] },
          { type: 'note', id: 'fu.coal', text: L.coalChip, icon: 'info', color: 'amber', visible: () => chip || (compare && zoom.level < 2) },
          { type: 'stats', id: 'fu.core', columns: 1, visible: () => zoom.level >= 1.5, items: [{ label: L.rodsInCore, get: () => L.rodsInCoreValue }] },
          { type: 'stats', id: 'fu.year', columns: 2, visible: () => compare && zoom.level >= 2, items: [{ label: L.yearFuel, get: () => L.yearFuelValue }, { label: L.yearCoal, get: () => L.yearCoalValue }] },
          { type: 'note', id: 'fu.a0', text: L.ageFresh, icon: 'dot', color: AGE_COLORS[0], visible: map },
          { type: 'note', id: 'fu.a1', text: L.ageMid, icon: 'dot', color: AGE_COLORS[1], visible: map },
          { type: 'note', id: 'fu.a2', text: L.ageOld, icon: 'dot', color: AGE_COLORS[2], visible: map },
        ],
      },
      callouts: [
        { anchor: () => w(zoom.at.pellet), text: () => (chip ? L.coalChip : L.lvPellet), side: 'left', visible: () => zoom.level < 0.7, priority: 0 },
        { anchor: () => w(zoom.at.plenum), text: L.lvRod, side: 'right', visible: () => zoom.level > 0.7 && zoom.level < 1.5, priority: 0 },
        { anchor: () => w(zoom.at.guides), text: L.lvFa, side: 'right', visible: () => zoom.level >= 1.5 && zoom.level < 2.5 && !map(), priority: 0 },
        { anchor: () => w(zoom.at.core), text: L.lvCore, side: 'right', visible: () => zoom.level >= 2.5 && zoom.tilt < 0.5, priority: 0 },
        { anchor: () => w(zoom.at.heap.clone().add(new Vector3(0, 0.5, 0))), text: L.heap, side: 'right', visible: () => compare && zoom.level > 0.6 && zoom.level < 2, priority: 1 },
        { anchor: () => w(zoom.at.wagon.clone().add(new Vector3(0, 4, 0))), text: L.wagons, side: 'up', visible: () => zoom.level > 3.2, priority: 1 },
      ],
      hotspots: [
        hot(() => w(zoom.at.grid), HOTSPOTS.fuel.grid, { visible: () => zoom.level > 1.4 && zoom.level < 2.6 && !map() }),
        hot(() => w(zoom.at.plenum), HOTSPOTS.fuel.plenum, { visible: () => zoom.level > 0.8 && zoom.level < 1.6 }),
        hot(() => w(zoom.at.guides.clone().add(new Vector3(0.05, 0.05, 0))), HOTSPOTS.fuel.guides, { visible: () => zoom.level > 1.5 && zoom.level < 2.6 && !map() }),
      ],
    },
    update(dt) {
      levelTarget = compare && level() >= 2 ? 3.6 : compare && level() < 1 ? 1 : level();
      zoom.level = damp(zoom.level, levelTarget, 1.6, dt);
      zoom.tilt = damp(zoom.tilt, map() ? 1 : 0, 2, dt);
      zoom.compare = damp(zoom.compare, compare ? 1 : 0, 3, dt);
      zoom.update(dt);
    },
  };
};
