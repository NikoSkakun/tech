/**
 * Step 10 `role` — «Роль газу в системі, рекорди, Україна». The island in daylight; over it a hologram of
 * Ukraine (internationally recognised borders, no front lines — DECISIONS §7) with the big gas-fired CHP plants
 * as `steel` pins (plantType.chp); a tap on a pin opens its card: name, type, design electric capacity, «станом
 * на 2026 р.» — the current operating state is not shown. Board: records and figures read from the step's
 * facts. «Далі: атомна станція» → `plant-nuclear`, «Назад до галереї» → `plants/gallery`.
 */
import { Vector3 } from 'three';
import { fmtUnit } from '@/content';
import raw from '@electricity/content/generated/plant-gas.json';
import { crossTargets } from '../content';
import { HOTSPOTS } from '../hotspots';
import { fill } from '../labels';
import { MAP } from '../layout';
import { buildUkraineMap, type Plant } from '../parts/ukraine';
import { hot } from './hot';
import type { StepFactory } from './types';

export const role: StepFactory = ({ ctx, L, isl, shell }) => {
  // design electric capacities of the document (step 10, «Інтерактив»)
  const plants: Plant[] = [
    { id: 'kyiv5', name: L.kyiv5, type: L.chpType, mw: 700, lon: 30.62, lat: 50.4 },
    { id: 'kyiv6', name: L.kyiv6, type: L.chpType, mw: 500, lon: 30.62, lat: 50.4 },
    { id: 'kharkiv5', name: L.kharkiv5, type: L.chpType, mw: 540, lon: 36.23, lat: 49.99 },
  ];
  const map = buildUkraineMap(MAP.width, plants);
  map.group.position.set(MAP.x, MAP.y, MAP.z);
  map.group.rotation.x = 0.35; // tilted toward the viewer so the outline reads from the island shot
  ctx.root.add(map.group);
  const facts = (raw.steps.find((s) => s.id === 'role')?.facts.items ?? []).flatMap((f) => f.text.replace(/\.$/, '').split('; '));
  const gallery = crossTargets('крок 10').find((t) => t.endsWith('plants/gallery')) ?? 'electricity/plants/gallery';
  const nuclear = 'electricity/plant-nuclear';
  const open = (address: string): void => void ctx.nav.open(address);
  ctx.qa.expose('role', () => ({ nuclear: !!ctx.nav.locate(nuclear), gallery: !!ctx.nav.locate(gallery) }));
  return {
    id: 'role',
    stage: { camera: 'role', show: [...shell.outside, map.group] },
    ui: {
      honesty: ['notToScale', { text: L.mapNote }],
      controls: [
        { type: 'button', id: 'role.next', label: L.nextNuclear, icon: 'arrowRight', primary: true, disabled: () => !ctx.nav.locate(nuclear), onClick: () => open(nuclear) },
        { type: 'button', id: 'role.gallery', label: L.backToGallery, icon: 'arrowLeft', disabled: () => !ctx.nav.locate(gallery), onClick: () => open(gallery) },
      ],
      board: {
        title: L.records,
        size: 'md',
        children: [{ type: 'table', id: 'role.facts', rows: facts.map((f) => [f]) }],
      },
      callouts: plants.map((p, i) => ({ anchor: () => map.pin(p.id).add(new Vector3(0, 4, 0)), text: p.name, side: (['left', 'down', 'right'] as const)[i], priority: i })),
      hotspots: [
        ...plants.map((p) => hot(() => map.pin(p.id), `plant-${p.id}`, { content: undefined, title: p.name, text: fill(L.plantCard, p.type, fmtUnit(p.mw, 'MW'), L.asOf) })),
        hot(() => isl.ccgt.stack.anchorWorld('top'), HOTSPOTS.role.bridge),
      ],
    },
  };
};
