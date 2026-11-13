/**
 * Step 9 `voltage-ladder` — the bridge to the grid chapters: a tall ladder under a dusk sky, rungs coloured by
 * voltage from 750 kV (`coral`) down to the house at 230 V (`blue`), a transformer icon on each rung, the generator
 * on its 24 kV ledge and a 750 kV line running off into the distance from the top. A `yellow` energy pulse climbs
 * from the generator to the top rung, runs out along the line and back, and walks down rung by rung to the house;
 * each rung lights as it passes. Tap a rung (or pick it in the dock) for its typical power and place.
 * «Далі: магістральні мережі →» opens `transmission/plant-exit` when that chapter is available.
 */
import { Vector3 } from 'three';
import { createOrbs, createTrail } from '@/fx';
import type { StepFactory } from '../chapter';
import { doc, hot } from '../labels';
import { OWN, OWN_LISTS } from '../labels-own';
import { LADDER, RUNGS, createLadder } from '../parts/ladder';
import { group } from '../world';

const ID = 'voltage-ladder';
const NEXT = 'electricity/transmission/plant-exit';
/** One trip of the pulse, seconds. */
const TRIP = 9;

export const voltageLadder: StepFactory = (tx) => {
  const { ui, ctx } = tx;
  const ladder = createLadder();
  const pulse = createOrbs({ kind: 'pulse', color: 'yellow', count: 1, radius: 0.16 });
  const head = group('pulse-head');
  head.add(pulse);
  const trail = createTrail(head, { color: 'yellow', duration: 0.7, width: 0.12 });
  const set = group(`set:${ID}`, 0, 0, 0, [ladder.group, head, trail]);
  tx.stageRoot.add(set);

  const pts = ladder.route();
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1]! + pts[i]!.distanceTo(pts[i - 1]!));
  const total = lens[lens.length - 1]!;
  const along = (u: number, out: Vector3): Vector3 => {
    const d = u * total;
    let i = 1;
    while (i < lens.length - 1 && lens[i]! < d) i++;
    const k = (d - lens[i - 1]!) / Math.max(1e-6, lens[i]! - lens[i - 1]!);
    return out.copy(pts[i - 1]!).lerp(pts[i]!, Math.min(1, Math.max(0, k)));
  };
  const rungId = (): string => ui.value<string>('rung9');
  const sel = (): number => Math.max(0, RUNGS.findIndex((r) => r.id === rungId()));
  ladder.rungs.forEach((g, i) => {
    ctx.qa.probe(`rung-${RUNGS[i]!.id}`, () => g.localToWorld(new Vector3(0.25, 0, 0.2)));
    ctx.input.register(g, {
      tooltip: OWN_LISTS.rungNames9[i]!,
      cursor: 'pointer',
      click: () => ui.set('rung9', RUNGS[i]!.id, { notify: true }),
      enabled: () => tx.isCurrent(ID),
    });
  });
  let u = 0;
  const glow = RUNGS.map(() => 0);
  const at = (x: number, y: number, z: number): (() => Vector3) => {
    const out = new Vector3();
    return () => tx.stageRoot.localToWorld(out.set(x, y, z));
  };
  const goNext = (): void => {
    if (ctx.nav.locate(NEXT)) void ctx.nav.open(NEXT);
    else ui.toast(OWN.notYet9, { icon: 'info' });
  };

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [-0.4, 3.0, 9.4],
        target: [0.5, 2.55, 0],
        fov: 32,
        frameAspect: 1.0,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0.4, 2.6, 0], radius: 3.2 },
      },
    },
    stage: {
      show: [set],
      envTune: { top: 'bg.deep', mid: 'bg.plum', bottom: 'bg.void', keyColor: 'amber.light', rimColor: 'pink', rimIntensity: 0.6 },
      enter: () => {
        u = 0;
        trail.reset();
      },
    },
    ui: {
      hint: OWN.hint9,
      honesty: ['notToScale'],
      controls: [
        { type: 'segmented', id: 'rung9', items: RUNGS.map((r, i) => ({ id: r.id, label: OWN_LISTS.rungShort9[i]! })), value: '110', onChange: () => tx.sound.click(1.2) },
        { type: 'note', id: 'about9', text: () => OWN_LISTS.rungFacts9[sel()]!, icon: 'info' },
        { type: 'button', id: 'next9', label: doc(ID, 0), icon: 'arrowRight', primary: true, onClick: goNext },
      ],
      callouts: [
        { anchor: at(-2.2, 2.85, 0), text: OWN.gen9, side: 'left' },
        { anchor: at(LADDER.x + LADDER.half + 1.0, 1.2, 0.3), text: OWN.house9, side: 'right' },
        { anchor: () => tx.stageRoot.localToWorld(new Vector3(LADDER.x - LADDER.half - 0.1, RUNGS[sel()]!.y, 0.3)), text: () => OWN_LISTS.rungNames9[sel()]!, color: 'yellow', side: 'left' },
      ],
      hotspots: [
        { anchor: at(LADDER.x - 0.6, RUNGS[0]!.y + 0.1, 0.3), content: hot(ID, 0) },
        { anchor: at(LADDER.x - 0.6, RUNGS[5]!.y + 0.1, 0.3), content: hot(ID, 1) },
      ],
    },
    probe: () => ({ rung: rungId(), u, lit: glow.map((g) => (g > 0.5 ? 1 : 0)).join('') }),
    update(dt) {
      u = (u + dt / TRIP) % 1;
      along(u, head.position);
      ladder.rungs.forEach((g, i) => {
        const near = Math.abs(u - ladder.marks[i]!) < 0.035 ? 1 : 0;
        glow[i]! += (Math.max(near, i === sel() ? 0.6 : 0) - glow[i]!) * Math.min(1, dt * 8);
        g.scale.set(1 + 0.05 * glow[i]!, 1 + 0.35 * glow[i]!, 1 + 0.2 * glow[i]!);
      });
      tx.sound.hum = 0.06;
    },
  };
};
