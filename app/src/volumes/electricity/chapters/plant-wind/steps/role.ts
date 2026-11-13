/**
 * Step 11 `role` — «Плюси, мінуси і роль в енергосистемі». Dusk panorama with every aviation light blinking
 * in sync; a holographic balance of pros and challenges over the island; a console with the wind share of a
 * day (profiles of the `grid` chapter) and the frequency after the trip of a large unit — with wind that only
 * follows the grid versus wind that provides synthetic inertia (the course's one frequency model, DECISIONS
 * §9; a qualitative illustration). Three portals lead on to the hub, the solar chapter and the grid.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import { gridLoadMW, windOutputMW } from '@electricity/sim/core/S2-sim/profiles';
import { createFrequencyModel, islandScenario } from '@electricity/sim/grid';
import { PLANT_TYPE } from '@/style';
import { Chart } from '@/ui3d';
import { hotspotNames } from '../content';
import { FARM } from '../layout';
import { buildBalance, buildConsole, buildPortal, buildRadar } from '../parts';
import type { StepFactory } from './types';

/** Trip of a large unit in an island-scale system; H = stored kinetic energy per MVA of synchronous plant. */
const TRIP_MW = 1000;
const WINDOW_S = 30;
const INERTIA = { following: 2.2, forming: 5 } as const;
const HOURS = Array.from({ length: 25 }, (_, h) => h);

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
  const balance = buildBalance(270);
  balance.group.position.set(40, 182, -40);
  ctx.root.add(balance.group);
  const aBalance = ctx.stage.actor(balance.group, { appear: 'pop' });
  const radar = buildRadar();
  world.island.place(radar.group, FARM.x + 96, FARM.z - 52);
  const day = new Chart({ height: 120, x: { min: 0, max: 24, label: 't, h', ticks: [0, 6, 12, 18, 24] }, y: { min: 0, max: 20, label: 'P, GW' }, series: [{ id: 'load', color: 'mist' }, { id: 'wind', label: 'Wind', color: PLANT_TYPE.wind, kind: 'area' }] });
  day.setData('load', HOURS, HOURS.map((h) => gridLoadMW('winter', h) / 1000));
  const curves = { following: response(INERTIA.following), forming: response(INERTIA.forming) };
  const panel = buildConsole(ctx, {
    title: `${L.frequency}, Hz`,
    width: 500,
    unit: 0.24,
    chart: { height: 190, legend: true, x: { min: 0, max: WINDOW_S, label: 't, s' }, y: { min: 49.2, max: 50.05, label: 'f, Hz' }, series: [{ id: 'following', label: 'Grid-following', color: 'amber' }, { id: 'forming', label: 'Grid-forming', color: 'green' }] },
    extra: day,
  });
  panel.surface.position.set(300, 86, 150);
  ctx.root.add(panel.surface);
  const aPanel = ctx.stage.actor(panel.surface, { appear: 'pop' });
  // portals: hub, solar plants, the power system (targets from the document's cross-references)
  const gates = [
    { label: L.portalHub, to: ['plants', 'gallery'], color: 'violet', x: -110 },
    { label: L.portalSolar, to: ['plant-solar', 'overview'], color: 'amber', x: 20 },
    { label: L.portalGrid, to: ['grid', 'grid-intro'], color: 'cyan', x: 150 },
  ] as const;
  const portals = gates.map((gate) => {
    const m = buildPortal(gate.color);
    m.group.position.set(gate.x * 1.15, 96, 96);
    ctx.root.add(m.group);
    const hover = { v: 0 };
    ctx.input.register(m.group, {
      tooltip: gate.label,
      cursor: 'pointer',
      enabled: () => ctx.stage.current === 'role',
      hover: (over) => ctx.tweens.to(hover, { v: over ? 1 : 0 }, { duration: 0.12, onUpdate: () => m.group.scale.setScalar(1 + 0.12 * hover.v) }),
      click: () => {
        // the target chapter may not be built yet: stay here rather than navigate into nothing
        if (ctx.nav.chapter(gate.to[0])) void ctx.nav.goto(gate.to[0], gate.to[1]);
        else audio.play('error');
      },
    });
    return { ...gate, model: m };
  });
  const aPortals = portals.map((p) => ctx.stage.actor(p.model.group, { appear: 'pop' }));
  const mode = (): 'following' | 'forming' => (ui.value<string>('rl.mode') === 'forming' ? 'forming' : 'following');
  let tripAt = -1;
  let drawn = '';
  const [hsRepower, hsRadar] = hotspotNames('role');
  const tmp = new Vector3();
  return {
    id: 'role',
    stage: { camera: 'role', env: 'dusk', show: [aBalance, aPanel, ...aPortals], post: { bloomIntensity: 1.15 }, enter: () => (tripAt = -1) },
    ui: {
      honesty: ['simplified', 'notToScale'],
      controls: [
        { type: 'segmented', id: 'rl.mode', items: [{ id: 'following', label: 'Grid-following' }, { id: 'forming', label: 'Grid-forming' }], value: 'following' },
        { type: 'button', id: 'rl.trip', label: L.trip, icon: 'warning', primary: true, onClick: () => (tripAt = ctx.clock.time) },
      ],
      callouts: [
        { anchor: balance.anchor('pros'), text: L.pros, color: 'green', side: 'up' },
        { anchor: balance.anchor('cons'), text: L.cons, color: 'amber', side: 'up' },
        ...portals.map((p) => ({ anchor: p.model.group, text: p.label, color: p.color, side: 'down' as const })),
      ],
      hotspots: [
        { anchor: () => farm.fleet.hub(5, tmp), title: hsRepower! },
        { anchor: radar.anchor('top'), title: hsRadar! },
      ],
    },
    update(dt, t) {
      live.nightTarget = 1;
      const m = mode();
      if (m !== drawn) {
        drawn = m;
        // both answers stay on the chart; the chosen one is drawn, the other only as far as it has been «played»
        panel.chart.setData('following', curves.following.t, curves.following.f);
        panel.chart.setData('forming', curves.forming.t, curves.forming.f);
      }
      const played = tripAt < 0 ? 0 : Math.min(WINDOW_S, t - tripAt + 1);
      const c = curves[m];
      const i = Math.min(c.t.length - 1, Math.round(played * 10));
      panel.chart.setMarker('now', { x: c.t[i]!, y: c.f[i]!, color: m === 'forming' ? 'green' : 'amber', label: `${c.f[i]!.toFixed(2).replace('.', ',')} Hz` });
      // the wind band of the day breathes with the wind over the island
      const k = live.wind / 8;
      day.setData('wind', HOURS, HOURS.map((h) => (windOutputMW(9000, 'windy', h) / 1000) * k * (1 + 0.08 * Math.sin(t * 0.6 + h * 0.7))));
      balance.group.rotation.z = Math.sin(t * 0.5) * 0.035;
      balance.part('pros').rotation.z = balance.part('cons').rotation.z = -balance.group.rotation.z;
      radar.part('antenna').rotation.y += dt * 1.6;
      panel.surface.quaternion.copy(ctx.camera.camera.quaternion);
      for (const p of portals) p.model.group.rotation.y = Math.sin(t * 0.4 + p.x) * 0.25;
    },
  };
};
