/**
 * Step 1 `overview` — «Вугільна ТЕС з висоти пташиного польоту». Wide orbital shot of the island: the train on
 * its loop, belts running, plumes over the towers, furnace glow in the boiler-house windows, `yellow` pulses on
 * the outgoing line. Callouts name the buildings in technological order; five hotspots carry the document cards.
 * Interaction: touch / click a building → it is selected (yellow ground rings; hover = cyan rings + its name),
 * the dock names it and «Перейти до кроку…» opens the step that explains it. «Час доби» (0–24 h, 19 h) blends the
 * sky and switches the lit windows — purely atmospheric.
 */
import { Group, type Object3D, Vector3 } from 'three';
import { createPulseRings } from '@/fx';
import { BOILER, DUMPER, GAS, HALL, ISLAND, YARD } from '../layout';
import { HOTSPOTS } from '../hotspots';
import type { StepFactory, StepId } from './types';

interface Building {
  key: string;
  label: string;
  target: Object3D;
  /** Ground point (rings) and label point. */
  base: Vector3;
  top: Vector3;
  radius: number;
  step: StepId;
}

/** Sky preset and lit windows for an hour of the day (document: day, golden hour, dusk, night). */
export function skyFor(hour: number): { preset: 'day' | 'golden' | 'dusk' | 'night'; night: number } {
  const h = ((hour % 24) + 24) % 24;
  const preset = h >= 8 && h < 16.5 ? 'day' : (h >= 6.5 && h < 8) || (h >= 16.5 && h < 18.5) ? 'golden' : h >= 18.5 && h < 20.5 ? 'dusk' : h >= 5 && h < 6.5 ? 'dusk' : 'night';
  const ramp = (a: number, b: number, x: number): number => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const night = h < 12 ? 1 - ramp(5, 8, h) : ramp(17, 21, h);
  return { preset, night };
}

export const overview: StepFactory = ({ ctx, ui, L, live, plant, hot }) => {
  const g = ISLAND.ground;
  const { main, gas, site, yard } = plant;
  const v = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);
  const tower0 = site.towers[0]!;
  const list: Building[] = [
    { key: 'boiler', label: L.boilerHouse, target: main.shell.group, base: v(BOILER.x, g, BOILER.z), top: v(BOILER.x - 10, g + BOILER.h * 0.8, BOILER.z + BOILER.d / 2), radius: 34, step: 'boiler' },
    { key: 'hall', label: L.turbineHall, target: main.hall.group, base: v(HALL.x, g, HALL.z), top: v(HALL.x - 24, g + HALL.height, HALL.z + HALL.width / 2), radius: 48, step: 'turbine' },
    { key: 'stack', label: L.stackName, target: gas.chimney.group, base: v(GAS.stack.x, g, GAS.z), top: v(GAS.stack.x, g + GAS.stack.h * 0.7, GAS.z), radius: 14, step: 'flue-gas' },
    { key: 'gas', label: L.gasCleaning, target: gas.body.group, base: gas.marks.esp.clone().setY(g), top: gas.marks.esp.clone().setY(g + 30), radius: 30, step: 'flue-gas' },
    { key: 'towers', label: L.towers, target: tower0.group, base: tower0.group.position.clone(), top: tower0.group.position.clone().add(v(-20, 40, 10)), radius: 36, step: 'feedwater' },
    { key: 'yard', label: L.coalYard, target: yard.models[2]!.group, base: v(YARD.x, g, YARD.z), top: v(YARD.x - 20, g + 14, YARD.z + 8), radius: 60, step: 'coal-to-dust' },
    { key: 'dumper', label: L.carDumper, target: yard.dumper.group, base: v(DUMPER.x, g, DUMPER.z + 16), top: v(DUMPER.x, g + 18, DUMPER.z + 22), radius: 22, step: 'coal-to-dust' },
    { key: 'switchyard', label: L.switchyard, target: site.yardGroup, base: site.points.gantry.clone().setY(g), top: site.points.gantry.clone().add(v(-6, 4, 0)), radius: 26, step: 'turbine' },
    // the pond lies behind the main building from the overview camera: selectable, but no callout
    { key: 'pond', label: L.ashPond, target: site.pond.group, base: site.points.pond, top: site.points.pond.clone().add(v(0, 4, 0)), radius: 44, step: 'ash-co2' },
  ];
  // ground rings: cyan under the hovered building, yellow under the selected one
  const rings = new Group();
  const hoverRing = createPulseRings({ color: 'cyan', size: 1, billboard: false, intensity: 1.6 });
  const pickRing = createPulseRings({ color: 'yellow', size: 1, billboard: false, intensity: 1.6 });
  for (const r of [hoverRing, pickRing]) {
    r.rotation.x = -Math.PI / 2;
    r.visible = false;
    rings.add(r);
  }
  ctx.root.add(rings);
  let hovered: Building | null = null;
  let picked: Building | null = null;
  const place = (ring: typeof hoverRing, b: Building | null): void => {
    ring.visible = !!b;
    if (b) {
      ring.position.copy(b.base).add(v(0, 0.6, 0));
      ring.scale.setScalar(b.radius * 2.4);
    }
  };
  const active = (): boolean => ctx.stage.current === 'overview';
  for (const b of list) {
    ctx.input.register(b.target, {
      tooltip: b.label,
      enabled: active,
      hover: (over) => {
        hovered = over ? b : hovered === b ? null : hovered;
        place(hoverRing, hovered);
      },
      click: () => {
        picked = b;
        place(pickRing, b);
      },
    });
  }
  ctx.qa.expose('overview', () => ({ picked: picked?.key ?? null, step: picked?.step ?? null }));
  ctx.qa.probe('ov.boiler', () => list[0]!.top);
  const stepTitle = (id: StepId): string => ctx.manifest.steps.find((s) => s.id === id)?.title ?? id;
  let appliedHour = -1;
  return {
    id: 'overview',
    stage: {
      camera: 'overview',
      show: [rings],
      enter: () => {
        appliedHour = -1;
        picked = null;
        hovered = null;
        place(pickRing, null);
        place(hoverRing, null);
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale'],
      controls: [
        { type: 'slider', id: 'ov.hour', label: L.timeOfDay, min: 0, max: 24, step: 0.5, value: 19, unit: 'h', digits: 1 },
        { type: 'note', id: 'ov.pick', icon: 'hand', text: () => (picked ? `${picked.label} → ${stepTitle(picked.step)}` : L.pickBuilding) },
        { type: 'button', id: 'ov.go', label: L.goToStep, icon: 'next', primary: true, disabled: () => !picked, onClick: () => picked && void ctx.nav.goto('plant-coal', picked.step) },
      ],
      callouts: list.filter((b) => b.key !== 'pond').map((b, i) => ({ anchor: () => b.top, text: b.label, priority: i })),
      hotspots: [
        hot(() => gas.marks.stackTop.clone().setY(ISLAND.ground + GAS.stack.h * 0.42), HOTSPOTS.overview.stack),
        hot(() => site.points.towerTops[1]!, HOTSPOTS.overview.tower),
        hot(() => main.points.boilerTop, HOTSPOTS.overview.boiler),
        hot(() => main.points.hallRoof, HOTSPOTS.overview.hall),
        hot(() => site.points.gantry, HOTSPOTS.overview.yard),
      ],
    },
    update() {
      const hour = ui.value<number>('ov.hour');
      const sky = skyFor(hour);
      if (hour !== appliedHour) {
        ctx.env.set(sky.preset, { duration: appliedHour < 0 ? 0 : 1.6 });
        appliedHour = hour;
      }
      live.nightTarget = sky.night;
    },
  };
};
