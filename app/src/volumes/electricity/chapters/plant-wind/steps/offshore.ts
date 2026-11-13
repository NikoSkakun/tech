/**
 * Step 10 `offshore` — «Морська ВЕС: велетні на воді». Golden hour over the sea block: the water clears and
 * shows the three kinds of foundation (monopile, jacket, floating with mooring lines), the inter-array cables
 * and the export link. «Глибина» moves the camera under the surface to the matching foundation; «Відстань до
 * берега» turns the AC substation into an HVDC platform beyond ≈ 80 km; «Порівняти розміри» raises yardsticks.
 */
import { Vector3 } from 'three';
import type { Wire } from '@/fx';
import { factoryHall } from '@/kit';
import { TURBINE_15MW, turbinePowerW } from '@electricity/sim/plant-wind';
import { HOTSPOTS } from '../hotspots';
import { SEA } from '../layout';
import { HVDC_FROM_KM, buildExportCables } from '../parts/export-cables';
import { buildSilhouettes } from '../parts/silhouettes';
import { hot } from './hot';
import type { StepFactory } from './types';

const SHOT: Record<string, string> = { wide: 'offshore', d20: 'off-mono', d50: 'off-jacket', d150: 'off-float' };

export const offshore: StepFactory = ({ ctx, ui, L, live, world, offshore: sea }) => {
  const g = sea.sea.group;
  const cables = buildExportCables(world, sea);
  ctx.root.add(cables.group);
  const aCables = ctx.stage.actor(cables.group, { appear: 'none' });
  const aArray = cables.array.map((w) => ctx.stage.actor(w, { appear: 'fade' }));
  // onshore converter / grid station where the cable lands
  const station = factoryHall({ length: 20, width: 12, height: 8, roof: 'flat', accent: 'violet' });
  station.group.scale.setScalar(0.6);
  world.island.place(station.group, cables.landing.x - 8, cables.landing.z + 2, 0.2);
  // yardsticks at the scale of the 15 MW turbine: its tip is ≈ 260 m above the sea
  const scale = (SEA.hubHeight + 11 + SEA.rotorDiameter / 2) / 260;
  const sticks = buildSilhouettes(scale);
  sticks.group.position.add(new Vector3(-84, 0.2, 77));
  g.add(sticks.group);
  const names = { eiffel: L.eiffel, motherland: L.motherland, a380: L.a380, person: L.person };
  const tops = sticks.items.map((it) => ({ text: names[it.id], at: new Vector3(), from: it }));
  const giant = new Vector3();
  const tipTop = new Vector3();
  // AC substation ↔ HVDC platform, and the yardsticks: sub-states of the step, switched by its controls
  // (`stage.setParam`: animated like a step change, restored by the next step entry)
  const pop = (o: { scale: Vector3; visible: boolean }, v: number): void => {
    o.visible = v > 0.01;
    o.scale.setScalar(Math.max(0.001, v));
  };
  ctx.stage.param('hvdc', 0, {
    duration: 0.5,
    onChange: (v) => {
      pop(sea.dc, v);
      pop(sea.ac, 1 - v);
      for (const w of cables.dc.children as Wire[]) w.material.fade = v;
      for (const w of cables.ac.children as Wire[]) w.material.fade = 1 - v;
    },
  });
  ctx.stage.param('yardsticks', 0, {
    duration: 0.5,
    onChange: (v) => {
      sticks.group.visible = v > 0.01;
      sticks.group.scale.set(1, Math.max(0.001, v), 1); // they rise out of the sea
    },
  });

  ctx.qa.expose('offshore', () => ({ hvdc: sea.dc.visible, ac: sea.ac.visible, yardsticks: sticks.group.visible }));
  const spot = (name: keyof typeof sea.spots) => (): Vector3 => g.localToWorld(sea.spots[name].clone());
  const dc = (): boolean => ui.value<number>('of.km') > HVDC_FROM_KM;
  const comparing = (): boolean => ui.value<boolean>('of.compare');
  let shown = { dc: false, comparing: false };
  const apply = (instant: boolean): void => {
    if (instant || dc() !== shown.dc) ctx.stage.setParam('hvdc', dc() ? 1 : 0, { instant });
    if (instant || comparing() !== shown.comparing) ctx.stage.setParam('yardsticks', comparing() ? 1 : 0, { instant });
    shown = { dc: dc(), comparing: comparing() };
  };
  return {
    id: 'offshore',
    stage: {
      camera: 'offshore',
      env: 'golden',
      // golden hour, but keep the sea blue: soften the preset's pull toward one warm hue
      envTune: { harmony: 0.2 },
      show: [aCables, ...aArray],
      params: { clarity: 0.5, windX: SEA.x, windY: 16, windZ: SEA.z, windLength: 380, windHeight: 60, windWidth: 230 },
      enter: (info) => {
        apply(true);
        ctx.camera.go(comparing() ? 'off-compare' : SHOT[ui.value<string>('of.depth')]!, { duration: info.instant ? 0 : undefined });
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'illustrative'],
      controls: [
        { type: 'segmented', id: 'of.depth', label: L.depth, items: [{ id: 'wide', label: '↔' }, { id: 'd20', label: '20 m' }, { id: 'd50', label: '50 m' }, { id: 'd150', label: '150 m' }], value: 'wide', onChange: (id) => ctx.camera.go(SHOT[id]!) },
        { type: 'slider', id: 'of.km', label: L.shoreDistance, min: 10, max: 200, step: 5, unit: 'km', value: 40, marks: [{ value: HVDC_FROM_KM, label: 'HVDC' }] },
        { type: 'note', id: 'of.link', text: () => (dc() ? L.exportDc : L.exportAc), icon: 'lightning', color: 'yellow' },
        { type: 'toggle', id: 'of.compare', label: L.compare, value: false, onChange: (on) => ctx.camera.go(on ? 'off-compare' : SHOT[ui.value<string>('of.depth')]!) },
      ],
      callouts: [
        { anchor: spot('monopile'), text: L.monopile, side: 'left' },
        { anchor: spot('jacket'), text: L.jacket, side: 'down' },
        { anchor: spot('floating'), text: L.floating, side: 'right' },
        { anchor: () => cables.group.localToWorld(giant.copy(cables.mid).setY(cables.mid.y + 6)), text: () => (dc() ? L.exportDc : L.exportAc), color: 'yellow', side: 'up' },
        // yardsticks for the 15 MW machine (tip ≈ 260 m above the sea)
        { anchor: () => g.localToWorld(tipTop.copy(sea.spots.transition).setY(SEA.hubHeight + 11 + SEA.rotorDiameter / 2 + 2)), text: L.turbine15, color: 'yellow', side: 'up', visible: comparing },
        ...tops.map((t) => ({ anchor: () => t.from.model.group.localToWorld(t.at.set(0, t.from.top, 0)), text: t.text, side: 'up' as const, visible: comparing })),
      ],
      hotspots: [
        hot(spot('transition'), HOTSPOTS.offshore.transition),
        hot(spot('scour'), HOTSPOTS.offshore.scour),
        hot(spot('platform'), HOTSPOTS.offshore.hvdc),
        hot(spot('mooring'), HOTSPOTS.offshore.mooring),
      ],
    },
    update() {
      apply(false);
      // looking at a foundation from under the surface needs clear water
      live.seaBoostTarget = ui.value<string>('of.depth') === 'wide' && !comparing() ? 0 : 0.5;
      // steadier, stronger wind over the sea (document): the farm runs near rated more often
      const power = turbinePowerW(TURBINE_15MW, live.wind * 1.15) / TURBINE_15MW.ratedW;
      cables.update(ui.value<number>('of.km'), power);
    },
  };
};
