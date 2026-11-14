/**
 * Step 3 `coal-to-dust` — «Від грудки до пилу». Entered with a transition, the camera travels with the coal: the
 * rotary car dumper turns a gondola over (≈ 160°) into the hopper → the yard belt and the stacker-reclaimer → the
 * crusher and the gallery to the bunkers → the mill in cutaway (×3). «Пройти шляхом вугілля» replays the trip.
 * Interaction: «Тонкість помелу» (share < 75 μm, 40…90 %, 75 %) → unburnt loss (model M1, illustrative) and the
 * sparks of unburnt coal in the furnace window; «Порівняти з волосиною» shows the magnifier.
 */
import { Vector3 } from 'three';
import { unburntLossPct } from '@electricity/sim/plant-coal';
import { fmtPercent } from '@/content';
import { createFlow } from '@/fx';
import { HOTSPOTS } from '../hotspots';
import { DUMPER, ISLAND, RIGS } from '../layout';
import { buildMill } from '../parts/mill';
import { SIDING_Z } from '../parts/yard';
import type { StepFactory } from './types';

/** Seconds at each stop of the trip and the moves between them. */
const TRIP = [
  ['dust-dumper', 1.6, 3.4],
  ['dust-yard', 2.2, 3.2],
  ['dust-gallery', 2.2, 2.8],
  ['coal-to-dust', 2.2, 0],
] as const;

export const coalToDust: StepFactory = ({ ctx, ui, L, plant, hot }) => {
  const g = ISLAND.ground;
  const { yard } = plant;
  const mill = buildMill(ctx, new Vector3(RIGS.mill.x, g, RIGS.mill.z));
  ctx.root.add(mill.group);
  const aLens = ctx.stage.actor(mill.lens, { appear: 'pop' });
  // coal pouring from the inverted gondola into the receiving hopper
  const drumCentre = new Vector3(DUMPER.x, g + 5.2, SIDING_Z);
  const pour = createFlow(ctx, { kind: 'blob', color: 'ink', paths: [drumCentre.clone().add(new Vector3(0, -1, 0)), drumCentre.clone().add(new Vector3(0, -4.6, 0)), yard.hopper.clone()], count: ctx.quality.count(24, 10), radius: 0.5, speed: 6, spread: 2.4, halo: false });
  ctx.root.add(pour);
  let trips = 0;
  const trip = (): void => {
    trips++;
    const scope = ctx.stage.scope;
    let delay = 0;
    for (const [shot, move, hold] of TRIP) {
      scope.delay(delay, () => ctx.camera.go(shot, { duration: move }));
      delay += move + hold;
    }
  };
  const fineness = (): number => ui.value<number>('d.fine');
  ctx.qa.expose('dust', () => ({ fineness: fineness(), unburnt: unburntLossPct(fineness()), lens: ctx.stage.shown(aLens), trips }));
  return {
    id: 'coal-to-dust',
    stage: {
      camera: 'coal-to-dust',
      show: [mill.group, pour],
      enter: (info) => {
        ctx.stage.toggle(aLens, ui.value<boolean>('d.hair'), { instant: true });
        if (!info.instant) trip();
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { enlarged: 3, text: L.millEnlarged }, 'illustrative', { enlarged: 40000, visible: () => ui.value<boolean>('d.hair') }],
      controls: [
        { type: 'slider', id: 'd.fine', label: L.fineness, min: 40, max: 90, step: 5, value: 75, unit: '%', digits: 0 },
        { type: 'readout', id: 'd.loss', label: L.unburnt, get: () => unburntLossPct(fineness()), unit: '%', digits: 1, color: (v) => (v > 1.5 ? 'ui.warning' : 'ui.ok') },
        { type: 'toggle', id: 'd.hair', label: L.hair, value: false, onChange: (on) => ctx.stage.toggle(aLens, on) },
        { type: 'button', id: 'd.trip', label: L.walkTheCoal, icon: 'play', onClick: trip },
      ],
      callouts: [
        { anchor: () => mill.points.air, text: L.hotAir, side: 'left', priority: 1 },
        { anchor: () => mill.points.pipes, text: L.dustToBurners, side: 'up', priority: 2 },
        { anchor: () => mill.points.window, text: () => `${L.unburnt.split(' (')[0]} · ${fmtPercent(unburntLossPct(fineness()) / 100, 1)}`, side: 'right', priority: 0 },
        { anchor: () => mill.points.hair, text: L.hairLabel, side: 'up', priority: 3, visible: () => ui.value<boolean>('d.hair') },
        { anchor: () => mill.points.dust, text: L.dust, side: 'down', priority: 4, visible: () => ui.value<boolean>('d.hair') },
      ],
      hotspots: [
        hot(() => yard.dumper.anchorWorld('hopper').add(new Vector3(0, 12, 0)), HOTSPOTS['coal-to-dust'].dumper),
        hot(() => yard.stacker.anchorWorld('bucket'), HOTSPOTS['coal-to-dust'].stacker),
        hot(() => mill.points.classifier, HOTSPOTS['coal-to-dust'].classifier),
      ],
    },
    update(dt, t) {
      // the dumper turns a gondola over every 12 s: up 3 s, hold 2 s, back 3 s, rest 4 s
      const c = t % 12;
      const turn = c < 3 ? c / 3 : c < 5 ? 1 : c < 8 ? 1 - (c - 5) / 3 : 0;
      const ease = turn * turn * (3 - 2 * turn);
      yard.setDrum(ease * 2.8);
      pour.density = c > 2.6 && c < 5.6 ? 1 : 0;
      yard.setStacker(Math.sin(t * 0.08));
      mill.unburnt = unburntLossPct(fineness()) / 100;
      mill.update(dt, t);
    },
  };
};
