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
import { hotspotNames } from '../content';
import { SEA } from '../layout';
import { buildExportCables, buildSilhouettes, createBadge, createSwitch, HVDC_FROM_KM } from '../parts';
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
  const link = createBadge(L.exportAc, 'yellow', 18, 48);
  link.position.copy(cables.mid).add(new Vector3(0, 9, 0));
  cables.group.add(link);
  // yardsticks at the scale of the 15 MW turbine: its tip is ≈ 260 m above the sea
  const scale = (SEA.hubHeight + 11 + SEA.rotorDiameter / 2) / 260;
  const sticks = buildSilhouettes(scale);
  sticks.group.position.add(new Vector3(-84, 0.2, 77));
  g.add(sticks.group);
  const names = { eiffel: L.eiffel, motherland: L.motherland, a380: L.a380, person: L.person };
  for (const it of sticks.items) {
    const tag = createBadge(names[it.id], 'white', 16);
    tag.position.set(0, it.top + 1.4, 0);
    it.model.group.add(tag);
  }
  const giant = createBadge(L.turbine15, 'yellow', 17);
  giant.position.copy(sea.spots.transition).setY(SEA.hubHeight + 11 + SEA.rotorDiameter / 2 + 2);
  g.add(giant);
  // AC substation ↔ HVDC platform, and the yardsticks: switched by controls inside the step
  const pop = (o: { scale: Vector3; visible: boolean }, v: number): void => {
    o.visible = v > 0.01;
    o.scale.setScalar(Math.max(0.001, v));
  };
  const hvdc = createSwitch(ctx.tweens, (v) => {
    pop(sea.dc, v);
    pop(sea.ac, 1 - v);
    for (const w of cables.dc.children as Wire[]) w.material.fade = v;
    for (const w of cables.ac.children as Wire[]) w.material.fade = 1 - v;
  });
  const compare = createSwitch(ctx.tweens, (v) => {
    sticks.group.visible = v > 0.01;
    sticks.group.scale.set(1, Math.max(0.001, v), 1); // they rise out of the sea
    giant.fade = v;
  });

  const spot = (name: keyof typeof sea.spots) => (): Vector3 => g.localToWorld(sea.spots[name].clone());
  const hs = hotspotNames('offshore');
  const dc = (): boolean => ui.value<number>('of.km') > HVDC_FROM_KM;
  const comparing = (): boolean => ui.value<boolean>('of.compare');
  const apply = (instant: boolean): void => {
    hvdc.set(dc(), instant);
    compare.set(comparing(), instant);
    const text = dc() ? L.exportDc : L.exportAc;
    if (link.text !== text) link.text = text;
  };
  return {
    id: 'offshore',
    stage: {
      camera: 'offshore',
      env: 'golden',
      show: [aCables, ...aArray],
      params: { clarity: 0.5, windX: SEA.x, windY: 16, windZ: SEA.z, windLength: 380, windHeight: 60, windWidth: 230 },
      enter: (info) => {
        // golden hour, but keep the sea blue: soften the preset's pull toward one warm hue
        ctx.env.tune({ harmony: 0.2 }, { duration: info.instant ? 0 : 1.6 });
        apply(info.instant);
        ctx.camera.go(comparing() ? 'off-compare' : SHOT[ui.value<string>('of.depth')]!, { duration: info.instant ? 0 : undefined });
      },
      leave: () => {
        hvdc.set(false, true);
        compare.set(false, true);
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', 'illustrative'],
      controls: [
        { type: 'segmented', id: 'of.depth', label: L.depth, items: [{ id: 'wide', label: '↔' }, { id: 'd20', label: '20 m' }, { id: 'd50', label: '50 m' }, { id: 'd150', label: '150 m' }], value: 'wide', onChange: (id) => ctx.camera.go(SHOT[id]!) },
        { type: 'slider', id: 'of.km', label: L.shoreDistance, min: 10, max: 200, step: 5, unit: 'km', value: 40, marks: [{ value: HVDC_FROM_KM, label: 'HVDC' }] },
        { type: 'toggle', id: 'of.compare', label: L.compare, value: false, onChange: (on) => ctx.camera.go(on ? 'off-compare' : SHOT[ui.value<string>('of.depth')]!) },
      ],
      callouts: [
        { anchor: spot('monopile'), text: L.monopile, side: 'left' },
        { anchor: spot('jacket'), text: L.jacket, side: 'down' },
        { anchor: spot('floating'), text: L.floating, side: 'right' },
      ],
      hotspots: [
        { anchor: spot('transition'), title: hs[0]! },
        { anchor: spot('scour'), title: hs[1]! },
        { anchor: spot('platform'), title: hs[2]! },
        { anchor: spot('mooring'), title: hs[3]! },
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
