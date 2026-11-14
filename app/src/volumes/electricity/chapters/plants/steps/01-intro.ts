/**
 * Step 1 `intro` — «Фабрики струму». The whole archipelago at golden hour: the hub with its machine hall, the
 * nine plant islands around it, each feeding the world ring through its own line (yellow pulses). A click on an
 * island selects it: the dock names the plant (its chapter's title and first sentence) and offers «Відкрити
 * розділ» — quiet for chapters that are not built yet.
 */
import { Vector3 } from 'three';
import type { StepFactory } from '../chapter';
import { doc, plantBlurb, plantTitle } from '../labels';
import { OWN } from '../labels-own';
import { RING } from '../layout';
import { PLANTS, PLANT_IDS, type PlantId } from '../plants-data';
import { group, roomy } from '../world';

const ID = 'intro';

export const intro: StepFactory = (hub) => {
  const { ctx, arch } = hub;
  const set = group(ID);
  hub.stageRoot.add(set);
  const picker = arch.picker;
  const built = (id: PlantId): boolean => ctx.nav.locate(PLANTS[id].route) !== null;
  const sel = (): PlantId | null => (hub.isCurrent(ID) ? picker.selected : null);
  const anchors = Object.fromEntries(PLANT_IDS.map((id) => [id, new Vector3()])) as Record<PlantId, Vector3>;
  const ringPoint = new Vector3(0, RING.y, RING.radius);
  ctx.qa.probe('ring', ringPoint);
  for (const id of PLANT_IDS) ctx.qa.probe(`isl-${id}`, () => arch.sats[id].group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.6, 0)));

  return {
    id: ID,
    turboSet: true,
    hall: true,
    shots: {
      [ID]: { position: [-36, 150, 300], target: [0, -8, 0], fov: 38, drift: 1.4, orbit: { azimuth: 0.9, polar: 0.3, zoom: [0.7, 1.3] }, fit: { center: [0, 0, 0], radius: 160 } },
    },
    stage: {
      show: [set],
      enter: () => {
        picker.selected = null;
      },
    },
    ui: {
      honesty: ['notToScale'],
      controls: [
        {
          type: 'note',
          id: 'isl1',
          icon: 'info',
          text: () => {
            const id = sel();
            return id ? `${plantTitle(id)}. ${plantBlurb(id)}` : OWN.pickIsland;
          },
          color: () => (sel() ? PLANTS[sel()!].color : 'mist'),
        },
        {
          type: 'button',
          id: 'open1',
          label: doc(ID, 0),
          icon: 'arrowRight',
          visible: () => sel() !== null,
          disabled: () => !built(sel() ?? 'coal'),
          hint: OWN.notBuilt,
          onClick: () => {
            const id = sel();
            if (id && built(id)) void ctx.nav.open(PLANTS[id].route);
          },
        },
      ],
      callouts: PLANT_IDS.map((id, i) => ({
        anchor: () => arch.satTop(id, anchors[id]),
        text: OWN[`isl_${id}`],
        color: PLANTS[id].color,
        side: 'up' as const,
        visible: () => roomy(hub) || i % 2 === 0 || picker.selected === id,
      })),
      hotspots: [{ anchor: () => ringPoint, content: 'grid' }],
    },
    probe: () => ({ selected: picker.selected, hovered: picker.hovered, built: picker.selected ? built(picker.selected) : null }),
    update() {
      if (!hub.isCurrent(ID)) return;
      picker.mode = 'select';
      arch.want.ring = 1;
      hub.sound.hum = 0.08;
      hub.sound.wind = 0.25;
    },
  };
};
