/**
 * Step 11 `role` — «Плюси, мінуси і роль в енергосистемі». A calm dusk panorama of both farms, every aviation
 * light flashing in sync — and one experiment the whole diorama answers to: a large unit of the system trips.
 * With wind that only follows the grid the frequency falls fast and deep; with grid-forming converters
 * (synthetic inertia) the rotors of the farm give up a little of their spin, and the fall is slower and
 * shallower. The frequency is the course's one frequency model (`@electricity/sim/grid`, DECISIONS §9) — a
 * qualitative illustration (chip «спрощено»); the board shows f(t) and the wind share of a day.
 * Three portals lead on (hub, solar plants, the power system); a portal to a chapter that is not built yet
 * stays dark and silent.
 *
 * The document's balance of «Плюси» / «Мінуси» cards is not built: it has no per-card copy (request filed);
 * the pros and challenges are the step's own panel pages.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { gridLoadMW, windOutputMW } from '@electricity/sim/core/S2-sim/profiles';
import { createFrequencyModel, islandScenario } from '@electricity/sim/grid';
import { PLANT_TYPE, col } from '@/style';
import { STATUS } from '@/ui3d';
import { crossTargets } from '../content';
import { HOTSPOTS } from '../hotspots';
import { FARM } from '../layout';
import { buildPortal, buildRadar } from '../parts/role-props';
import { hot } from './hot';
import type { StepFactory } from './types';

/** Trip of a large unit in an island-scale system; H = stored kinetic energy per MVA of synchronous plant. */
const TRIP_MW = 1000;
const WINDOW_S = 30;
const INERTIA = { following: 2.2, forming: 5 } as const;
/** The 30 s after the trip are played in 10 s (chip «прискорено ×3»). */
const SPEED = 3;
/** How much of its spin a rotor visibly gives up per hertz of frequency drop (exaggerated to be seen). */
const SPIN_PER_HZ = 0.45;
const HOURS = Array.from({ length: 25 }, (_, h) => h);
/** Yaw that turns a gate toward the camera of the `role` shot (south-west of the island). */
const FACING = -0.75;
type Mode = keyof typeof INERTIA;

function response(inertiaH: number): { t: number[]; f: number[] } {
  const model = createFrequencyModel(islandScenario({ inertiaH }));
  const t: number[] = [];
  const f: number[] = [];
  for (let i = 0; i <= WINDOW_S * 10; i++) {
    if (i === 10) model.addEvent(TRIP_MW); // the unit trips at t = 1 s
    t.push(i / 10);
    f.push(model.state.fHz);
    model.step(0.1);
  }
  return { t, f };
}

export const role: StepFactory = ({ ctx, ui, L, live, world, farm }) => {
  const radar = buildRadar();
  world.island.place(radar.group, FARM.x + 96, FARM.z - 52);
  const curves = { following: response(INERTIA.following), forming: response(INERTIA.forming) };
  const nadir = { following: Math.min(...curves.following.f), forming: Math.min(...curves.forming.f) };
  // portals: hub, solar plants, the power system — full addresses from the document's cross-references
  const [toHub, toSolar, toGrid] = crossTargets('портали');
  const gates = [
    { label: L.portalHub, to: toHub!, color: 'violet' },
    { label: L.portalSolar, to: toSolar!, color: PLANT_TYPE.solar },
    { label: L.portalGrid, to: toGrid!, color: 'cyan' },
  ] as const;
  const portals = gates.map((gate, i) => {
    const built = ctx.nav.locate(gate.to) !== null;
    const m = buildPortal(built ? gate.color : 'slate', 13, built);
    // a signpost column above the west of the island, facing the camera of the `role` shot: the labels have
    // the free width of the frame to their right, one line each
    m.group.position.set(-100, 184 - i * 37, -106);
    m.group.rotation.y = FACING;
    ctx.root.add(m.group);
    const hover = { v: 0 };
    ctx.input.register(m.group, {
      tooltip: gate.label,
      cursor: built ? 'pointer' : 'default',
      enabled: () => ctx.stage.current === 'role',
      hover: (over) => ctx.tweens.to(hover, { v: over && built ? 1 : 0 }, { duration: 0.12, onUpdate: () => m.group.scale.setScalar(1 + 0.12 * hover.v) }),
      // a chapter that is not built yet: the gate is dark and does nothing (no error sound)
      click: () => void (built && ctx.nav.open(gate.to)),
    });
    ctx.qa.probe(`portal${i}`, m.group, { origin: true });
    return { ...gate, built, model: m };
  });
  const aPortals = portals.map((p) => ctx.stage.actor(p.model.group, { appear: 'pop' }));
  ctx.qa.expose('portals', () => portals.map((p) => ({ to: p.to, built: p.built })));
  const mode = (): Mode => (ui.value<string>('rl.mode') === 'forming' ? 'forming' : 'following');
  let tripAt = -1;
  /** Model seconds played since the button (−1 = nothing running). */
  let played = 0;
  const sampleAt = (m: Mode): number => curves[m].f[Math.min(curves[m].t.length - 1, Math.round(played * 10))]!;
  const hub = new Vector3();
  ctx.qa.expose('role', () => ({ played, f: sampleAt(mode()), spinDip: live.spinDip, lineDim: live.lineDim }));
  return {
    id: 'role',
    stage: {
      camera: 'role',
      env: 'dusk',
      // a quiet blue hour instead of the preset's magenta wash: the lights and the yellow line carry the frame
      envTune: { top: 'bg.deep', mid: col('blue').lerp(col('bg.indigo'), 0.45), bottom: 'bg.void', stars: 0.6, harmony: 0.14, harmonyColor: 'blue', gradeTintAmount: 0.1, sunGlow: 0.3, cloudColor: col('slate').lerp(col('blue'), 0.3) },
      show: aPortals,
      post: { bloomIntensity: 1.1 },
      enter: () => {
        tripAt = -1;
        played = 0;
      },
    },
    ui: {
      honesty: [{ kind: 'simplified', text: L.simplifiedChip }, 'notToScale', { sped: SPEED }],
      controls: [
        { type: 'segmented', id: 'rl.mode', items: [{ id: 'following', label: L.gridModes[0] }, { id: 'forming', label: L.gridModes[1] }], value: 'following' },
        // a gate to a chapter that does not exist yet is dark; say so where it can be read without hovering
        { type: 'note', id: 'rl.locked', text: L.notBuilt, icon: 'lock', color: 'mist', visible: () => portals.some((p) => !p.built) },
        {
          type: 'button',
          id: 'rl.trip',
          label: L.trip,
          icon: 'warning',
          primary: true,
          onClick: () => {
            tripAt = ctx.clock.time;
            audio.play('breaker');
          },
        },
      ],
      board: {
        title: `${L.frequency}, Hz`,
        size: 'md',
        children: [
          {
            type: 'chart',
            id: 'rl.f',
            chart: { height: 170, legend: true, x: { min: 0, max: WINDOW_S, label: 't, s' }, y: { min: 48.7, max: 50.1, label: 'f, Hz', ticks: [49, 49.5, 50] }, series: [{ id: 'following', label: L.gridModes[0], color: 'amber' }, { id: 'forming', label: L.gridModes[1], color: 'green' }] },
            init: (chart) => {
              chart.setData('following', curves.following.t, curves.following.f);
              chart.setData('forming', curves.forming.t, curves.forming.f);
            },
            update: (chart) => chart.setMarker('now', { x: played, y: sampleAt(mode()), color: mode() === 'forming' ? 'green' : 'amber' }),
          },
          {
            type: 'stats',
            id: 'rl.res',
            columns: 2,
            items: [
              { label: L.frequency, unit: 'Hz', digits: 2, get: () => sampleAt(mode()), color: () => (sampleAt(mode()) < 49.8 ? STATUS.warning : 'white') },
              { label: L.nadir, unit: 'Hz', digits: 2, get: () => nadir[mode()] },
            ],
          },
          {
            type: 'chart',
            id: 'rl.day',
            chart: { height: 116, legend: true, x: { min: 0, max: 24, label: 't, h', ticks: [0, 6, 12, 18, 24] }, y: { min: 0, max: 20, label: 'P, GW', ticks: [0, 10, 20] }, series: [{ id: 'load', label: L.load, color: 'mist' }, { id: 'wind', label: L.windBand, color: PLANT_TYPE.wind, kind: 'area' }] },
            init: (chart) => chart.setData('load', HOURS, HOURS.map((h) => gridLoadMW('winter', h) / 1000)),
            // the wind band of the day breathes with the wind over the island
            update: (chart, t) => chart.setData('wind', HOURS, HOURS.map((h) => (windOutputMW(9000, 'windy', h) / 1000) * (live.wind / 8) * (1 + 0.08 * Math.sin(t * 0.6 + h * 0.7)))),
          },
        ],
      },
      callouts: portals.map((p) => ({ anchor: p.model.group, text: p.label, color: p.built ? p.color : 'mist', side: 'right' as const })),
      hotspots: [
        hot(() => farm.hub(5, hub), HOTSPOTS.role.repowering),
        hot(radar.anchor('top'), HOTSPOTS.role.radar),
      ],
    },
    update(dt, t) {
      live.nightTarget = 1;
      played = tripAt < 0 ? 0 : Math.min(WINDOW_S, 1 + (t - tripAt) * SPEED);
      const drop = 50 - sampleAt(mode());
      // grid-forming wind lends the grid a part of its rotors' kinetic energy: they slow down with the frequency
      live.spinDipTarget = mode() === 'forming' ? Math.min(0.6, drop * SPIN_PER_HZ) : 0;
      // the line out of the yard dims with the frequency dip — the same shortage, seen on the conductors
      live.lineDim = Math.min(0.7, drop * 1.6);
      radar.part('antenna').rotation.y += dt * 1.6;
      portals.forEach((p, i) => (p.model.group.rotation.y = FACING + Math.sin(t * 0.4 + i * 1.9) * 0.22));
    },
  };
};
