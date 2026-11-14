/**
 * Step 12 `role-ukraine` — «Роль АЕС, Україна, плюси і мінуси». Back over the island: a hologram of Ukraine in
 * its internationally recognised borders with the five plants (unit bars `violet`, status rings: operating
 * `green`, ZNPP `amber` — occupied, cold shutdown, not producing; Chornobyl `steel` with the confinement arch).
 * Tap a plant (or pick it in the dock) for its card — units, first unit, status «станом на …». «Частка АЕС»:
 * Ukraine / France / world on a violet donut. «Далі: ГЕС» and «Назад до галереї» open the linked steps when
 * those chapters exist. Board: the card, the pros and cons, the record line.
 */
import { Vector3 } from 'three';
import { crossTargets } from '../content';
import { HOTSPOTS } from '../hotspots';
import { PLANTS, buildUkraineMap, type PlantId } from '../parts/ukraine-map';
import { hot, probe } from './hot';
import type { StepFactory } from './types';

const KEY: Record<PlantId, 'Rivne' | 'Khmelnytskyi' | 'South' | 'Zaporizhzhia' | 'Chornobyl'> = { rivne: 'Rivne', khmelnytskyi: 'Khmelnytskyi', south: 'South', zaporizhzhia: 'Zaporizhzhia', chornobyl: 'Chornobyl' };
const FIRST: Record<PlantId, string> = { rivne: '1980', khmelnytskyi: '1987', south: '1982', zaporizhzhia: '1984', chornobyl: '1977' };
const SHARE = { ua: 0.5, fr: 0.67, world: 0.09 } as const;
type Share = keyof typeof SHARE;
export const MAP_AT = new Vector3(-10, 165, 30);

export const roleUkraine: StepFactory = ({ ctx, ui, L, actors, live }) => {
  const map = buildUkraineMap();
  map.group.position.copy(MAP_AT);
  map.group.rotation.x = 1.0; // the far (northern) edge lifts toward the camera
  ctx.root.add(map.group);
  const aMap = ctx.stage.actor(map.group, { appear: 'grow' });
  const pick = (): PlantId => ui.value<PlantId>('ru.plant');
  const share = (): Share => ui.value<Share>('ru.share');
  const active = (): boolean => ctx.stage.current === 'role-ukraine';
  for (const p of PLANTS) ctx.input.register(map.bars[p.id], { cursor: 'pointer', tooltip: L[`np${KEY[p.id]}`], enabled: active, click: () => ui.set('ru.plant', p.id, { notify: true }) });
  const w = (p: Vector3): Vector3 => map.group.localToWorld(p.clone());
  const status = (id: PlantId): string => (id === 'zaporizhzhia' ? `${L.occupied}; ${L.coldShutdown}` : id === 'chornobyl' ? L.stShut : L.stOperating);
  const [hydro, gallery] = crossTargets('крок 12');
  const exists = (a: string | undefined): boolean => !!a && !!ctx.nav.locate(a);
  for (const p of PLANTS) probe(`npp.${p.id}`, () => w(map.spots[p.id].clone().add(new Vector3(0, 6, 0))));
  ctx.qa.expose('role', () => ({ plant: pick(), share: share() }));
  let shown = -1;
  return {
    id: 'role-ukraine',
    stage: { camera: 'role-ukraine', show: [actors.front, aMap] },
    ui: {
      reset: true,
      honesty: ['notToScale', { text: L.asOfDate }],
      controls: [
        { type: 'segmented', id: 'ru.plant', label: L.plant, items: PLANTS.map((p) => ({ id: p.id, label: L[`ab${KEY[p.id]}`] })), value: 'zaporizhzhia' },
        { type: 'segmented', id: 'ru.share', label: L.share.title, items: [{ id: 'ua', label: L.share.items[0]! }, { id: 'fr', label: L.share.items[1]! }, { id: 'world', label: L.share.items[2]! }], value: 'ua' },
        { type: 'button', id: 'ru.hydro', label: L.nextHydro, icon: 'arrowRight', primary: true, disabled: () => !exists(hydro), onClick: () => void (hydro && ctx.nav.open(hydro)) },
        { type: 'button', id: 'ru.gallery', label: L.backGallery, icon: 'arrowLeft', disabled: () => !exists(gallery), onClick: () => void (gallery && ctx.nav.open(gallery)) },
      ],
      board: {
        title: L.plant,
        size: 'md',
        children: [
          { type: 'table', id: 'ru.card', rows: () => [[L.plant, L[`np${KEY[pick()]}`]], [L.fUnits, L[`units${KEY[pick()]}`]], [L.fFirst, FIRST[pick()]], [L.fStatus, status(pick())], ['', L.asOfDate]], highlight: () => (pick() === 'zaporizhzhia' ? 3 : -1) },
          { type: 'stats', id: 'ru.share', columns: 3, items: (['ua', 'fr', 'world'] as const).map((k) => ({ label: L[k === 'ua' ? 'shareUa' : k === 'fr' ? 'shareFr' : 'shareWorld'], get: () => `≈ ${Math.round(SHARE[k] * 100)} %`, color: () => (share() === k ? 'violet' : 'mist') })) },
          { type: 'table', id: 'ru.pc', head: [L.pros, L.cons], rows: [['≈ 12 g CO₂/kWh', '175–255 $/MWh'], ['КВВП > 80 %', 'ВЯП'], ['мало палива', 'рідкісні тяжкі аварії']] },
          { type: 'note', id: 'ru.rec', text: L.record, icon: 'star', color: 'violet' },
        ],
      },
      callouts: [
        ...PLANTS.map((p, i) => ({ anchor: () => w(map.spots[p.id].clone().add(new Vector3(0, 16, 0))), text: p.id === 'zaporizhzhia' ? `${L.npZaporizhzhia} · ${L.occupied}` : L[`np${KEY[p.id]}`], side: 'up' as const, priority: p.id === 'zaporizhzhia' ? 0 : i + 1, color: p.status === 'occupied' ? ('amber' as const) : undefined })),
        { anchor: () => w(map.spots.zaporizhzhia.clone().add(new Vector3(0, 2, 6))), text: L.coldShutdown, side: 'left', color: 'amber', priority: 0 },
      ],
      hotspots: [hot(() => w(map.spots.zaporizhzhia.clone().add(new Vector3(6, 4, 0))), HOTSPOTS['role-ukraine'].znpp)],
    },
    update(_dt, t) {
      const k = share();
      if (shown !== SHARE[k]) map.setShare((shown = SHARE[k]));
      // billboard the donut: camera rotation expressed in the (tilted) map frame
      map.donut.quaternion.copy(map.group.quaternion).invert().multiply(ctx.camera.camera.quaternion);
      for (const p of PLANTS) map.bars[p.id].scale.setScalar(p.id === pick() ? 1.25 + 0.05 * Math.sin(t * 3) : 1);
      live.powerTarget = 0.9;
    },
  };
};
