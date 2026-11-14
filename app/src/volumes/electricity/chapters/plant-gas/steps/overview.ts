/**
 * Step 1 `overview` — «Газова електростанція: швидка і найефективніша». Orbit over the island: the combined-
 * cycle unit runs (haze over its stack, condenser fans), the peaker stands cold, 3 of 8 engines run. Names of
 * the facilities appear one after another as callouts. Hover a facility → `cyan` outline + its name; click →
 * it is selected (`yellow`), the dock names it and offers «Перейти до кроку…». «Режим острова»: night base ·
 * morning peak — the peaker starts (haze after 3 s), five more engines start, the island power counts up
 * from ≈ 520 to ≈ 940 MW (illustrative values of the document).
 */
import { Box3, Vector3, type Object3D } from 'three';
import { createOutline, type Outline } from '@/fx';
import content from '../content';
import { HOTSPOTS } from '../hotspots';
import { ENGINES, GAS, HRSG, PEAKER, STACK, TOWN, YARD } from '../layout';
import { BASE_LOAD, islandPowerMW } from '../sim-bindings/island';
import { hot } from './hot';
import type { StepFactory, StepId } from './types';

/** Callouts a phone shows first (three of them): spread over the island, west → east. */
const PHONE_ORDER = ['gas', 'ccgt', 'engines', 'hrsg', 'peaker', 'stack', 'town', 'yard'];

interface Facility {
  id: string;
  name: string;
  step: StepId;
  object: Object3D;
  label: Vector3;
}

export const overview: StepFactory = ({ ctx, ui, L, live, isl, shell }) => {
  const { ccgt, gas, peaker, engines, town, yard } = isl;
  const y = ccgt.floorY;
  const list: Facility[] = [
    { id: 'ccgt', name: L.mainHall, step: 'gas-turbine', object: ccgt.hall.group, label: new Vector3(-64, y + 26, 0) },
    { id: 'hrsg', name: L.hrsgName, step: 'combined-cycle', object: ccgt.hrsg.group, label: new Vector3((HRSG.x0 + HRSG.x1) / 2, y + 30, 0) },
    { id: 'stack', name: L.stack, step: 'emissions-hydrogen', object: ccgt.stack.group, label: new Vector3(STACK.x, y + STACK.height, 0) },
    { id: 'gas', name: L.gasStation, step: 'natural-gas', object: gas.models[1]!.group, label: new Vector3(GAS.station.x, y + 8, GAS.station.z) },
    { id: 'peaker', name: L.peaker, step: 'flexibility', object: peaker.model.group, label: new Vector3(PEAKER.x, y + 16, PEAKER.z) },
    { id: 'engines', name: L.engineHall, step: 'gas-engines', object: engines.hall.group, label: new Vector3(ENGINES.x, y + 22, ENGINES.z) },
    { id: 'town', name: L.town, step: 'gas-engines', object: town.group, label: new Vector3(TOWN.x, y + 16, TOWN.z) },
    { id: 'yard', name: L.substation, step: 'role', object: yard.group, label: new Vector3(YARD.x, y + 14, YARD.z) },
  ];
  const active = (): boolean => ctx.stage.current === 'overview';
  const outlines = new Map<string, Outline>();
  let selected: Facility | null = null;
  let hovered: string | null = null;
  for (const f of list) {
    const o = createOutline(f.object, { width: 2.5 });
    o.amount = 0;
    outlines.set(f.id, o);
    ctx.onDispose(() => o.dispose());
    ctx.input.register(f.object, {
      tooltip: f.name,
      cursor: 'pointer',
      enabled: active,
      hover: (over) => (hovered = over ? f.id : hovered === f.id ? null : hovered),
      click: () => (selected = f),
    });
  }
  const stepTitle = (id: StepId): string => content.steps.find((s) => s.id === id)?.title ?? id;
  let since = 0;
  let peakAt = -1;
  const peak = (): boolean => ui.value<string>('ov.mode') === 'peak';
  // night base under a night sky with lit windows; the morning peak at sunrise
  const sky = (on: boolean, instant = false): void => ctx.env.set(on ? 'golden' : 'night', { duration: instant ? 0 : 2 });
  // QA (qa/interaction.mjs): what the step shows, and where each facility can be clicked
  ctx.qa.expose('overview', () => ({ selected: selected?.id ?? null, peakerOn: live.peakerTarget, engines: live.enginesTarget }));
  // a point on each facility's body (bounding-box centre) where a click lands on it
  // (registered only while the step is on screen)
  const box = new Box3();
  const picks = list.map((f) => [f.id, box.setFromObject(f.object).getCenter(new Vector3())] as const);
  let unprobe: (() => void)[] = [];
  const probe = (on: boolean): void => {
    for (const off of unprobe) off();
    unprobe = on ? picks.map(([id, c]) => ctx.qa.probe(`fac.${id}`, c)) : [];
  };
  return {
    id: 'overview',
    stage: {
      camera: 'overview',
      show: [...shell.outside],
      enter: (info) => {
        since = info.instant ? 10 : 0;
        selected = null;
        peakAt = peak() ? -10 : -1;
        sky(peak(), info.instant);
        probe(true);
      },
      leave: () => probe(false),
    },
    ui: {
      honesty: ['notToScale', 'illustrative'],
      controls: [
        {
          type: 'segmented',
          id: 'ov.mode',
          label: L.islandMode,
          items: [
            { id: 'base', label: L.modeBase },
            { id: 'peak', label: L.modePeak },
          ],
          value: 'base',
          onChange: (v) => {
            peakAt = v === 'peak' ? since : -1;
            sky(v === 'peak');
          },
        },
        { type: 'readout', id: 'ov.power', label: L.islandPower, unit: 'MW', digits: 0, get: () => islandPowerMW(live) },
        { type: 'note', id: 'ov.sel', icon: 'info', text: () => (selected ? `${selected.name} → ${stepTitle(selected.step)}` : ''), visible: () => selected !== null },
        { type: 'button', id: 'ov.go', label: L.goToStep, icon: 'arrowRight', disabled: () => selected === null, onClick: () => void (selected && ctx.nav.goto('plant-gas', selected.step)) },
      ],
      callouts: list.map((f, i) => ({ anchor: () => f.label, text: f.name, priority: PHONE_ORDER.indexOf(f.id), visible: () => since > 0.6 + i * 0.35 })),
      hotspots: [
        hot(() => ccgt.hrsg.anchorWorld('drum.hp'), HOTSPOTS.overview.hrsg),
        hot(() => new Vector3(PEAKER.x - 6, y + 11, PEAKER.z), HOTSPOTS.overview.peaker),
        hot(() => new Vector3(ENGINES.x + 20, y + 14, ENGINES.z), HOTSPOTS.overview.engines),
        hot(() => gas.route[gas.outlet]!.clone().add(new Vector3(0, 6, 0)), HOTSPOTS.overview.gasStation),
      ],
    },
    update(dt) {
      since += dt;
      const on = peak();
      // base: the CCGT at ≈ 60 % (490 MW), 3 engines; peak: CCGT full, the peaker after 3 s, all 8 engines
      live.gtTarget = on ? 1 : BASE_LOAD;
      live.stTarget = on ? 1 : BASE_LOAD;
      live.enginesTarget = on ? 8 : 3;
      live.peakerTarget = on && since - peakAt > 3 ? 1 : 0;
      live.nightTarget = on ? 0 : 1;
      for (const [id, o] of outlines) {
        const want = selected?.id === id ? 1 : hovered === id ? 0.9 : 0;
        o.amount += (want - o.amount) * Math.min(1, dt * 10);
        o.setSelected(selected?.id === id);
      }
    },
  };
};
