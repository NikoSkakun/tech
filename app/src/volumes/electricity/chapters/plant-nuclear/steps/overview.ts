/**
 * Step 1 `overview` — «Атомна станція: тепло без вогню». Morning, wide orbit of the island: plumes over the
 * towers, fountains of the spray ponds, yellow pulses on the 750 kV line, the stack lights blinking. Callouts
 * name the buildings one after another (staggered on entry); three hotspots carry the document's cards.
 * «Зазирнути всередину» dives the camera onto the dome, then opens step 2 (the scale transition inward).
 */
import type { Vector3 } from 'three';
import { HOTSPOTS } from '../hotspots';
import { hot } from './hot';
import type { StepFactory } from './types';

/** Seconds between two callouts appearing on entry. */
const STAGGER = 0.45;

export const overview: StepFactory = ({ ctx, L, plant, actors }) => {
  const { at, site } = plant;
  let shown = 99; // how many callouts are visible (staggered reveal on entry)
  const names: [() => Vector3, string, 'left' | 'right' | 'up'][] = [
    [() => at.containment, L.containment, 'left'],
    [() => at.hall, L.turbineHall, 'right'],
    [() => at.tower, L.coolingTower, 'up'],
    [() => site.at.ponds, L.sprayPonds, 'left'],
    [() => at.switchyard, L.switchyard, 'right'],
    [() => site.at.diesels, L.dieselHouse, 'left'],
    [() => site.at.dry, L.dryStorage, 'left'],
  ];
  const dive = (): void => {
    const scope = ctx.stage.scope;
    ctx.camera.go('overview-dive', { duration: 1.8 });
    scope.delay(1.9, () => ctx.nav.goto('plant-nuclear', 'fission'));
  };
  return {
    id: 'overview',
    stage: {
      camera: 'overview',
      show: [actors.front],
      enter: (info) => {
        shown = info.instant ? names.length : 0;
        if (!info.instant) names.forEach((_, i) => info.scope.delay(0.8 + i * STAGGER, () => (shown = i + 1)));
      },
    },
    ui: {
      honesty: ['notToScale'],
      controls: [{ type: 'button', id: 'ov.inside', label: L.lookInside, icon: 'play', primary: true, onClick: dive }],
      callouts: names.map(([anchor, text, side], i) => ({ anchor, text, side, priority: i, visible: () => shown > i })),
      hotspots: [
        hot(() => site.at.ponds, HOTSPOTS.overview.ponds),
        hot(() => site.at.diesels, HOTSPOTS.overview.diesels),
        hot(() => site.at.dry, HOTSPOTS.overview.dry),
      ],
    },
  };
};
