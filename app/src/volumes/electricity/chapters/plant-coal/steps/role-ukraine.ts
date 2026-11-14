/**
 * Step 11 `role-ukraine` — «Роль, рекорди, Україна». The whole island in the dusk; over it a map of Ukraine (in its
 * internationally recognised borders) with the large thermal plants as `slate` dots, area ∝ capacity; the board
 * shows the world's coal share by year (2000 → 2025, Ember; values before 2020 rounded, marked «≈»).
 * Interaction: tap a dot → the board names the plant with its capacity and only publicly confirmed facts with a
 * date («станом на 2026 р.»); scrub the bars → year and share; «Далі: газові станції» → `plant-gas`, «Назад до
 * галереї» → `plants/gallery` (both dark while those chapters are not in the build).
 */
import { Vector3 } from 'three';
import { fmtNumber, fmtPercent } from '@/content';
import { HOTSPOTS } from '../hotspots';
import { ISLAND, RIGS } from '../layout';
import { buildUkraineMap, type Station } from '../parts/ukraine-map';
import { crossTargets } from '../content';
import type { StepFactory } from './types';

/** Document, «Цифри і факти» and «Примітки щодо фактів» (design capacity, MW). */
const STATIONS: readonly (Station & { status: 'occupied' | 'occupiedPlain' | 'destroyed' | 'damaged' | null })[] = [
  { key: 'vuhlehirska', lon: 38.25, lat: 48.43, mw: 3600, status: 'occupied' },
  { key: 'zaporizka', lon: 34.65, lat: 47.5, mw: 3600, status: 'occupiedPlain' },
  { key: 'burshtynska', lon: 24.63, lat: 49.24, mw: 2300, status: 'damaged' },
  { key: 'zmiivska', lon: 36.35, lat: 49.6, mw: 2270, status: null },
  { key: 'trypilska', lon: 30.75, lat: 50.13, mw: 1800, status: 'destroyed' },
];
/** World share of coal in electricity generation, % (document; before 2020 rounded). */
const SHARE: readonly [number, number][] = [
  [2000, 39],
  [2005, 40],
  [2010, 40],
  [2015, 39],
  [2020, 35],
  [2025, 33],
];

export const roleUkraine: StepFactory = ({ ctx, L, hot }) => {
  const g = ISLAND.ground;
  const map = buildUkraineMap(new Vector3(RIGS.map.x, g + RIGS.map.y, RIGS.map.z), STATIONS);
  ctx.root.add(map.group);
  const name: Record<string, string> = { vuhlehirska: L.vuhlehirska, zaporizka: L.zaporizka, trypilska: L.trypilska, burshtynska: L.burshtynska, zmiivska: L.zmiivska };
  const status = { occupied: L.occupied, occupiedPlain: L.occupiedPlain, destroyed: L.destroyed, damaged: L.damaged2024 } as const;
  let picked: string | null = null;
  let year = 2025;
  const active = (): boolean => ctx.stage.current === 'role-ukraine';
  const pick = (key: string): void => {
    picked = key;
    map.select(key);
  };
  for (const s of STATIONS) ctx.input.register(map.dots.get(s.key)!, { tooltip: name[s.key], cursor: 'pointer', enabled: active, click: () => pick(s.key) });
  const card = (): string => {
    const s = STATIONS.find((x) => x.key === picked);
    if (!s) return L.pickStation;
    const facts = s.status ? `, ${status[s.status]}` : '';
    return `${name[s.key]} · ${fmtNumber(s.mw)} MW${facts} (${L.asOf})`;
  };
  const go = (address: string | undefined): void => {
    if (address && ctx.nav.locate(address)) void ctx.nav.open(address);
  };
  const gallery = crossTargets('role-ukraine').find((t) => t.includes('/plants/'));
  const gasStep = 'electricity/plant-gas';
  ctx.qa.expose('role', () => ({ picked, year }));
  for (const s of STATIONS) ctx.qa.probe(`station.${s.key}`, () => map.at(s.key));
  return {
    id: 'role-ukraine',
    stage: {
      camera: 'role-ukraine',
      show: [map.group],
      enter: () => {
        picked = null;
        map.select(null);
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { kind: 'simplified', text: L.mapNote }],
      controls: [
        { type: 'note', id: 'r.card', icon: 'pin', text: card, color: () => (picked ? 'yellow' : 'mist') },
        { type: 'button', id: 'r.gas', label: L.nextGas, icon: 'next', primary: true, disabled: () => !ctx.nav.locate(gasStep), onClick: () => go(gasStep) },
        { type: 'button', id: 'r.gallery', label: L.backToGallery, icon: 'arrowLeft', disabled: () => !gallery || !ctx.nav.locate(gallery), onClick: () => go(gallery) },
      ],
      board: {
        title: L.worldShare,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'r.share',
            chart: { height: 170, x: { min: 1997.5, max: 2027.5, ticks: SHARE.map(([y]) => y), label: '' }, y: { min: 0, max: 50, label: '%' }, series: [{ id: 'coal', color: 'plantType.coal', kind: 'bars' }], onScrub: (x) => (year = SHARE.reduce((a, [y]) => (Math.abs(y - x) < Math.abs(a - x) ? y : a), 2025)) },
            init: (c) => c.setData('coal', SHARE.map(([y]) => y), SHARE.map(([, v]) => v)),
            update: (c) => c.setMarker('pick', { x: year, y: SHARE.find(([y]) => y === year)![1], color: 'yellow', guides: false }),
          },
          { type: 'readout', id: 'r.year', label: L.share, text: () => `${year}: ${year < 2020 ? '≈ ' : ''}${fmtPercent(SHARE.find(([y]) => y === year)![1] / 100, 0)}` },
        ],
      },
      callouts: STATIONS.map((s, i) => ({ anchor: () => map.at(s.key), text: name[s.key]!, side: (s.lon < 31 ? 'left' : 'right') as 'left' | 'right', priority: i })),
      hotspots: [hot(() => map.at('zmiivska').add(new Vector3(0, 6, 0)), HOTSPOTS['role-ukraine'].marker)],
    },
    update(_dt, t) {
      map.group.rotation.y = Math.sin(t * 0.2) * 0.06;
    },
  };
};
