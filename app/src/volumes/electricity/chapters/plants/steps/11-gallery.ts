/**
 * Step 11 `gallery` — «Галерея станцій». The nine islands leave their circle and line up on an arc in front of
 * the camera (stage poses). Each has a plaque hotspot (its chapter's title and the document's key numbers) and a
 * name callout in its plant colour; a click opens the plant chapter (quiet while that chapter is not built).
 * «Порівняти» opens the comparison table (`COMPARE_ROWS`, sortable by any column, two filters).
 */
import { Vector3 } from 'three';
import { COMPARE_ROWS, sortRows, type CompareKey, type CompareRow, type Range } from '@electricity/sim/plants';
import type { StepFactory } from '../chapter';
import { doc, fact, plantTitle } from '../labels';
import { LISTS, OWN } from '../labels-own';
import { GALLERY, facing, galleryPosition } from '../layout';
import { ISLAND_SCALE } from '../parts/plant-islands';
import { PLANTS, PLANT_IDS, TRANSMISSION_ROUTE, type PlantId } from '../plants-data';
import { group } from '../world';

const ID = 'gallery';
const KEYS: readonly CompareKey[] = ['cfPct', 'etaPct', 'co2Median', 'lcoeUsd', 'rampPctPerMin', 'coldStartMin'];
const CAMERA: [number, number, number] = [0, 86, 405];

const range = (r: Range | null, nd: string): string => (r ? (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) : nd);
function start(r: Range | null, nd: string): string {
  if (!r) return nd;
  const [a, b] = r;
  if (b < 60) return `${a}–${b} min`;
  if (b <= 1000) return `${Math.round(a / 60)}–${Math.round(b / 60)} h`;
  return OWN.dayPlus;
}

export const gallery: StepFactory = (hub) => {
  const { ctx, ui, arch } = hub;
  const set = group(ID);
  hub.stageRoot.add(set);
  const poses: Record<string, { position: [number, number, number]; rotation: [number, number, number]; scale: number }> = {};
  for (const id of PLANT_IDS) {
    const g = arch.sats[id].group;
    ctx.stage.pose(`sat-${id}`, g);
    const p = galleryPosition(id);
    poses[`sat-${id}`] = { position: p, rotation: [0, facing(p, CAMERA) - Math.PI / 4, 0], scale: ISLAND_SCALE * GALLERY.scale };
  }
  const built = (id: PlantId): boolean => ctx.nav.locate(PLANTS[id].route) !== null;
  const nextBuilt = (): boolean => ctx.nav.locate(TRANSMISSION_ROUTE) !== null;
  const v = Object.fromEntries(PLANT_IDS.map((id) => [id, new Vector3()])) as Record<PlantId, Vector3>;
  const plaque = (id: PlantId): Vector3 => arch.sats[id].group.getWorldPosition(v[id]).add(new Vector3(0, -16, 10));
  for (const id of PLANT_IDS) ctx.qa.probe(`gal-${id}`, () => arch.sats[id].group.getWorldPosition(new Vector3()).add(new Vector3(0, 0.6, 0)));
  const compare = (): boolean => ui.value<boolean>('cmp11');
  const sortKey = (): CompareKey => ui.value<CompareKey>('sort11');
  const rows = (): CompareRow[] => {
    let r = sortRows(COMPARE_ROWS, sortKey(), sortKey() !== 'coldStartMin' && sortKey() !== 'co2Median' && sortKey() !== 'lcoeUsd');
    if (ui.value<boolean>('disp11')) r = r.filter((x) => x.dispatchable !== 'no');
    if (ui.value<boolean>('low11')) r = r.filter((x) => x.lowCarbon);
    return r;
  };
  const weather = (r: CompareRow): boolean => r.id.startsWith('wind') || r.id === 'solarPv';
  const cell = (r: CompareRow): string[] => [
    LISTS.compareNames[COMPARE_ROWS.indexOf(r)] ?? r.id,
    range(r.cfPct, OWN.nd),
    range(r.etaPct, OWN.nd),
    r.co2Median !== null ? `${r.co2Median}` : r.co2Range ? `≈ ${range(r.co2Range, OWN.nd)}` : OWN.nd,
    range(r.lcoeUsd, OWN.nd),
    weather(r) ? OWN.weather : range(r.rampPctPerMin, OWN.nd),
    weather(r) ? OWN.weather : start(r.coldStartMin, OWN.nd),
    LISTS.dispatch[['yes', 'no', 'partly'].indexOf(r.dispatchable)] ?? '',
  ];

  return {
    id: ID,
    noLines: true,
    hall: true,
    turboSet: true,
    shots: {
      [ID]: { position: CAMERA, target: [0, 34, 92], fov: 40, drift: 0.4, fit: { center: [0, 40, 90], radius: 180 } },
    },
    stage: {
      show: [set],
      poses,
      duration: 1.6,
      enter: () => {
        arch.picker.onOpen = (id) => {
          if (built(id)) void ctx.nav.open(PLANTS[id].route);
        };
      },
    },
    ui: {
      honesty: ['notToScale'],
      controls: [
        { type: 'toggle', id: 'cmp11', label: doc(ID, 0), value: false, onChange: () => hub.sound.click() },
        { type: 'segmented', id: 'sort11', label: OWN.sortBy, items: KEYS.map((k, i) => ({ id: k, label: LISTS.compareCols[i + 1] ?? k })), value: 'co2Median', visible: () => compare() },
        { type: 'toggle', id: 'disp11', label: doc(ID, 2), value: false, visible: () => compare() },
        { type: 'toggle', id: 'low11', label: doc(ID, 3), value: false, visible: () => compare() },
        { type: 'button', id: 'next11', label: OWN.nextTransmission, icon: 'arrowRight', disabled: () => !nextBuilt(), hint: OWN.notBuilt, onClick: () => nextBuilt() && void ctx.nav.open(TRANSMISSION_ROUTE) },
      ],
      board: {
        title: doc(ID, 1),
        size: 'lg',
        visible: () => compare(),
        children: [{ type: 'table', id: 'tbl11', head: [...LISTS.compareCols], rows: () => rows().map(cell) }],
      },
      callouts: PLANT_IDS.map((id, i) => ({
        anchor: () => arch.satTop(id, new Vector3()),
        text: OWN[`isl_${id}`],
        color: built(id) ? PLANTS[id].color : 'steel',
        side: 'up' as const,
        priority: i,
      })),
      hotspots: PLANT_IDS.map((id, i) => ({ anchor: () => plaque(id), title: plantTitle(id), text: fact(ID, i) })),
    },
    probe: () => ({ compare: compare(), sort: sortKey(), rows: rows().map((r) => r.id), hovered: arch.picker.hovered, poseX: arch.sats.coal.group.position.x }),
    update() {
      if (!hub.isCurrent(ID)) return;
      arch.picker.mode = 'open';
      arch.want.ring = 0.6;
    },
  };
};
