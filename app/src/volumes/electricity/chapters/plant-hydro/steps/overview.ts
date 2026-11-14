/**
 * Step 1 `overview` — «Гідроелектростанція: вода, яку підняло Сонце». Orbital shot of the valley: the
 * reservoir glitters, foam pours from the spillway, the draft tubes churn the tailwater, the pumped-storage
 * bowl sits on the slope. Names of the structures appear one after another (callouts); each structure has a
 * hotspot card, and a click on the structure itself flies to the step that explains it. The slider «Рівень
 * водосховища» (0…100 % of the useful volume, default 85 %) is purely visual: the water drops and bares the banks.
 */
import { Vector3, type Object3D } from 'three';
import { POWERHOUSE, RESERVOIR, SWITCHYARD } from '../layout';
import { HOTSPOTS } from '../hotspots';
import { hot } from './hot';
import type { StepFactory, StepId } from './types';

/** Seconds between two names appearing. */
const STAGGER = 0.45;

/** A fixed world point as a callout / hotspot anchor. */
const at = (v: Vector3) => (): Vector3 => v;

export const overview: StepFactory = ({ ctx, ui, L, live, world, psh }) => {
  const { dam, powerhouse, fishLadder } = world;
  let since = 0;
  const after = (i: number) => (): boolean => ctx.clock.time - since > 0.6 + i * STAGGER;
  const active = (): boolean => ctx.stage.current === 'overview';
  // click on a structure → the step that explains it (tooltips repeat the callouts, nothing is hover-only)
  const link = (object: { group: Object3D }, tooltip: string, step: StepId): void =>
    void ctx.input.register(object.group, {
      tooltip,
      enabled: active,
      click: () => ctx.nav.goto('plant-hydro', step),
    });
  link(dam, L.cDam, 'dams');
  link(powerhouse, L.cPowerhouse, 'water-path');
  link(psh.model, L.cUpper, 'pumped-storage');
  link(fishLadder, L.cFish, 'reservoir-environment');
  const level = (): number =>
    RESERVOIR.dead + (ui.value<number>('ov.level') / 100) * (RESERVOIR.npr - RESERVOIR.dead);
  const lake = new Vector3(-120, 0, 10);
  const tail = new Vector3(POWERHOUSE.x1 + 40, 3, 20);
  const spill = dam.anchorWorld('spillway');
  return {
    id: 'overview',
    stage: {
      camera: 'overview',
      enter: (info) => (since = info.instant ? ctx.clock.time - 10 : ctx.clock.time),
    },
    ui: {
      honesty: ['notToScale'],
      controls: [
        { type: 'slider', id: 'ov.level', label: L.level, min: 0, max: 100, step: 1, unit: '%', value: 85 },
      ],
      callouts: [
        { anchor: () => lake.setY(live.level), text: L.cReservoir, priority: 0, visible: after(0) },
        {
          anchor: at(dam.anchorWorld('crest').add(new Vector3(0, 6, 40))),
          text: L.cDam,
          priority: 1,
          visible: after(1),
        },
        { anchor: at(spill), text: L.cSpillway, side: 'left', priority: 3, visible: after(2) },
        { anchor: at(powerhouse.anchorWorld('roof')), text: L.cPowerhouse, priority: 2, visible: after(3) },
        { anchor: at(tail), text: L.cTailwater, side: 'down', priority: 5, visible: after(4) },
        { anchor: at(psh.bowlTop), text: L.cUpper, priority: 4, visible: after(5) },
        {
          anchor: at(fishLadder.anchorWorld('mid')),
          text: L.cFish,
          side: 'down',
          priority: 6,
          visible: after(6),
        },
        {
          anchor: at(new Vector3(SWITCHYARD.x, SWITCHYARD.y + 12, SWITCHYARD.z)),
          text: L.cYard,
          side: 'right',
          priority: 7,
          visible: after(7),
        },
      ],
      hotspots: [
        hot(at(dam.anchorWorld('crest').add(new Vector3(0, 0, 12))), HOTSPOTS.overview.dam),
        hot(at(dam.anchorWorld('gate1')), HOTSPOTS.overview.spillway),
        hot(at(powerhouse.anchorWorld('unit2')), HOTSPOTS.overview.powerhouse),
        hot(at(psh.bowlTop.clone().add(new Vector3(-18, 0, 0))), HOTSPOTS.overview.upper),
        hot(at(fishLadder.anchorWorld('top')), HOTSPOTS.overview.fish),
      ],
    },
    update() {
      live.levelTarget = level();
    },
  };
};
