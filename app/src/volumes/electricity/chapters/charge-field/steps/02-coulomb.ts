/**
 * Step 2 `coulomb` — «Закон Кулона». Two charged balls hover over the table; force arrows (length ∝ log F, sim:
 * `coulombPair`) point toward each other or apart, a dashed ruler shows r, the board plots F(r) with the
 * current point. «Порівняти з гравітацією» swaps the pair for the 40-floor logarithmic tower of forces.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtSci } from '@/content';
import { damp } from '@/engine/api';
import { createVectorArrow, RibbonLines } from '@/fx';
import { Builder } from '@/kit';
import { COULOMB_RANGES, coulombPair, gravityComparison } from '@electricity/sim/charge-field';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { docItems, docLabel } from '../content';
import { fmtSciUnit } from '../fmt';
import { DOC, L } from '../labels';
import { COULOMB, M, TABLE } from '../layout';
import { createChargeBall, type ChargeBall } from '../parts/charge-ball';
import { createForceTower } from '../parts/force-tower';

const R = COULOMB_RANGES;

/** Miniature of Coulomb's torsion balance (hotspot): glass cylinder, thread, beam with two balls. */
function torsionBalance(): Group {
  const b = new Builder('torsion-balance');
  b.cyl(0.62, 0.14, { seg: 28, bevel: 0.04, c: ['bg.plum', 'slate'] });
  b.cyl(0.5, 1.15, { seg: 28, slot: 'glass', c: 'sky', at: [0, 0.14, 0] });
  b.cyl(0.54, 0.08, { seg: 28, slot: 'metal', c: 'steel.light', at: [0, 1.29, 0] });
  b.cyl(0.09, 0.9, { seg: 12, slot: 'glass', c: 'sky', at: [0, 1.37, 0] });
  b.cyl(0.13, 0.1, { seg: 12, slot: 'metal', c: 'amber', at: [0, 2.27, 0] });
  b.rod([0, 0.72, 0], [0, 2.27, 0], 0.012, { slot: 'metal', c: 'white' });
  const beam = b.part('beam', { at: [0, 0.72, 0] });
  beam.rod([-0.36, 0, 0], [0.36, 0, 0], 0.02, { slot: 'metal', c: 'steel.light' });
  beam.sphere(0.08, { c: 'coral', at: [0.36, 0, 0] }).sphere(0.06, { c: 'mist', at: [-0.36, 0, 0] });
  b.sphere(0.08, { c: 'coral', at: [0.3, 0.72, 0.26] });
  return b.build().group;
}

export const coulombStep: StepFactory = ({ ctx, ui, world }) => {
  const on = (): boolean => ctx.stage.current === 'coulomb';
  const pairSet = new Group();
  const tower = createForceTower();
  ctx.root.add(pairSet, tower.group);
  // registered here, not on first use: a deep link to another step must find them hidden
  ctx.stage.actor(pairSet);
  ctx.stage.actor(tower.group);
  const balls: [ChargeBall, ChargeBall] = [
    createChargeBall({ reference: 20, base: 0.4 }),
    createChargeBall({ reference: 20, base: 0.4, phase: 2 }),
  ];
  const arrows = balls.map(() =>
    createVectorArrow({ color: 'white', radius: 0.075, headLength: 0.36, headRadius: 0.18, intensity: 1.15 }),
  );
  const ruler = new RibbonLines({
    capacity: 8,
    color: 'white',
    width: 0.035,
    intensity: 0.9,
    dashRepeat: 3,
    dashStrength: 1,
    dashSpeed: 0,
    base: 0,
    endFade: [0, 0],
  });
  const balance = torsionBalance();
  balance.position.set(TABLE.radius - 1.6, 0, -2.6);
  pairSet.add(...balls.map((b) => b.group), ...arrows, ruler, balance);
  const pos = [new Vector3(-0.75, COULOMB.y, 0), new Vector3(0.75, COULOMB.y, 0)] as const;
  const mid = new Vector3();
  const sim = (): ReturnType<typeof coulombPair> =>
    coulombPair(ui.value<number>('q1'), ui.value<number>('q2'), pos[0].distanceTo(pos[1]) / M);

  const up = new Vector3(0, 1, 0);
  const hit = new Vector3();
  balls.forEach((ball, i) => {
    const other = pos[1 - i]!;
    ctx.input.register(ball.proxy, {
      tooltip: L.coulomb.drag,
      cursor: 'grab',
      enabled: () => on() && !ui.value<boolean>('compare'),
      hover: (over) => ctx.stage.scope.to(ball, { hover: over ? 1 : 0 }, { duration: 0.12 }),
      dragStart: () => audio.play('click'),
      drag: (e) => {
        if (!e.planePoint(up, pos[i]!, hit)) return;
        hit.y = COULOMB.y;
        if (Math.hypot(hit.x, hit.z) > TABLE.play)
          hit.multiplyScalar(TABLE.play / Math.hypot(hit.x, hit.z)).setY(COULOMB.y);
        // r stays within 1…20 cm of the model; below 1 cm the ball meets a soft stop («упор»)
        const d = hit.sub(other);
        if (d.lengthSq() < 1e-6) d.set(i ? 1 : -1, 0, 0);
        pos[i]!.copy(other).add(d.clampLength(R.distanceM.min * M, R.distanceM.max * M));
      },
    });
  });
  ctx.qa.probe('ball-1', balls[0].proxy);
  ctx.qa.probe('ball-2', balls[1].proxy);
  ctx.qa.probe('tower-top', tower.electricTop);
  ctx.qa.expose('coulomb', () => ({ ...sim(), compare: ui.value<boolean>('compare') }));

  const setCompare = (compare: boolean, instant = false): void => {
    ctx.stage.toggle(pairSet, !compare, { instant });
    ctx.stage.toggle(tower.group, compare, { instant });
    void ctx.camera.go(compare ? 'gravity' : 'coulomb', { instant });
  };
  ui.onChange('compare', (v) => on() && setCompare(v === true));
  const ride = (): void => {
    const scope = ctx.stage.scope;
    void ctx.camera.go('gravityTop', { duration: 1.2 });
    scope.delay(1.5, () => void ctx.camera.go('gravityBottom', { duration: 4.5, ease: 'sine.inOut' }));
    scope.delay(7.2, () => void ctx.camera.go('gravity', { duration: 1.6 }));
  };

  const cmp = gravityComparison();
  const [attraction, repulsion] = docItems('coulomb', 1, '/');
  const dir = new Vector3();
  const side = new Vector3();
  const tail = new Vector3();
  const shown = [0, 0];
  let lateral = 0;
  let chartKey = '';
  const drawChart = (chart: Chart): void => {
    const s = sim();
    const key = `${s.q1NC}|${s.q2NC}`;
    if (key !== chartKey) {
      chartKey = key;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let cm = 1; cm <= 20; cm += 0.25) {
        xs.push(cm);
        ys.push(coulombPair(s.q1NC, s.q2NC, cm / 100).forceN * 1e3);
      }
      chart.setAxis('y', { max: Math.max(coulombPair(s.q1NC, s.q2NC, 0.025).forceN * 1e3, 1e-3) });
      chart.setData('f', xs, ys);
    }
    chart.setMarker('now', { x: s.distanceM * 100, y: s.forceN * 1e3 });
  };

  return {
    id: 'coulomb',
    stage: {
      show: [world.top.object, pairSet],
      camera: 'coulomb',
      enter(info) {
        chartKey = '';
        setCompare(ui.value<boolean>('compare'), info.instant);
      },
    },
    ui: {
      hint: L.coulomb.drag,
      honesty: [
        { text: DOC.logArrows, visible: () => !ui.value<boolean>('compare') },
        { kind: 'notToScale', text: L.coulomb.sizes, visible: () => !ui.value<boolean>('compare') },
        { kind: 'notToScale', visible: () => ui.value<boolean>('compare') },
      ],
      controls: [
        {
          type: 'slider',
          id: 'q1',
          label: L.coulomb.q1,
          min: R.chargeNC.min,
          max: R.chargeNC.max,
          step: R.chargeNC.step,
          value: R.chargeNC.default1,
          unit: 'nC',
          digits: 0,
          visible: () => !ui.value<boolean>('compare'),
        },
        {
          type: 'slider',
          id: 'q2',
          label: L.coulomb.q2,
          min: R.chargeNC.min,
          max: R.chargeNC.max,
          step: R.chargeNC.step,
          value: R.chargeNC.default2,
          unit: 'nC',
          digits: 0,
          visible: () => !ui.value<boolean>('compare'),
        },
        { type: 'toggle', id: 'compare', label: docLabel('coulomb', 2), value: false },
        {
          type: 'stats',
          id: 'coulombStats',
          visible: () => !ui.value<boolean>('compare'),
          items: [
            { label: L.coulomb.r, get: () => `${fmtNumber(sim().distanceM * 100, { digits: 1 })} cm` },
            { label: L.coulomb.force, get: () => (sim().forceN > 0 ? fmtSciUnit(sim().forceN, 'N') : '0 N') },
            {
              label: L.coulomb.kind,
              get: () => ({ attraction, repulsion, none: L.coulomb.none })[sim().kind] ?? '',
              color: () => (sim().kind === 'attraction' ? 'amber' : 'mist'),
            },
          ],
        },
        {
          type: 'stats',
          id: 'gravityStats',
          visible: () => ui.value<boolean>('compare'),
          items: [
            { label: L.coulomb.electric, get: () => fmtSciUnit(cmp.electricN, 'N'), color: () => 'amber' },
            { label: L.coulomb.gravity, get: () => fmtSciUnit(cmp.gravityN, 'N') },
            { label: L.coulomb.ratio, get: () => fmtSci(cmp.ratio, 1) },
          ],
        },
        {
          type: 'button',
          id: 'ride',
          label: L.coulomb.ride,
          icon: 'chevronDown',
          visible: () => ui.value<boolean>('compare'),
          onClick: ride,
        },
      ],
      board: {
        title: L.coulomb.chart,
        size: 'sm',
        visible: () => !ui.value<boolean>('compare'),
        children: [
          {
            type: 'chart',
            id: 'forceChart',
            chart: {
              height: 190,
              x: { min: 0, max: 20, label: 'r, cm' },
              y: { min: 0, max: 6, label: 'F, mN' },
              series: [{ id: 'f', color: 'amber' }],
              legend: false,
            },
            update: drawChart,
          },
        ],
      },
      callouts: [
        {
          anchor: () => mid,
          text: () => `r = ${fmtNumber(sim().distanceM * 100, { digits: 1 })} cm`,
          side: 'down',
          visible: () => !ui.value<boolean>('compare'),
        },
        {
          anchor: tower.electricTop,
          text: L.coulomb.electric,
          side: 'left',
          color: 'amber',
          visible: () => ui.value<boolean>('compare'),
        },
        {
          anchor: tower.gravityTop,
          text: L.coulomb.gravity,
          side: 'down',
          visible: () => ui.value<boolean>('compare'),
        },
      ],
      hotspots: [
        {
          anchor: [balance.position.x, 2.5, balance.position.z],
          content: 'torsion-balance',
          visible: () => !ui.value<boolean>('compare'),
        },
        {
          anchor: () => mid.clone().setY(COULOMB.y + 1.5),
          content: 'force-graph',
          visible: () => !ui.value<boolean>('compare'),
        },
      ],
    },
    update(dt, t) {
      tower.update(dt, t);
      const s = sim();
      const dist = pos[0].distanceTo(pos[1]);
      mid.copy(pos[0]).add(pos[1]).multiplyScalar(0.5);
      dir.copy(pos[1]).sub(pos[0]).normalize();
      side.set(-dir.z, 0, dir.x);
      // attraction: the two arrows would overlap on the axis, so they slide apart sideways
      lateral = damp(lateral, s.kind === 'attraction' ? 1 : 0, 8, dt);
      const charges = [s.q1NC, s.q2NC];
      balls.forEach((ball, i) => {
        ball.set(charges[i]!);
        ball.limit = dist * 0.46;
        ball.group.position.copy(pos[i]!);
        ball.update(dt, t);
        const sign = (s.kind === 'attraction' ? 1 : -1) * (i ? -1 : 1);
        shown[i] = damp(shown[i]!, s.arrowLengthL0 * COULOMB.arrowL0, 9, dt);
        const r = Math.min(ball.radius, ball.limit);
        tail
          .copy(pos[i]!)
          .addScaledVector(dir, sign * r * (1 - lateral))
          .addScaledVector(side, (i ? -1 : 1) * 0.3 * lateral);
        arrows[i]!.visible = shown[i]! > 0.02;
        arrows[i]!.set(tail, hit.copy(dir).multiplyScalar(sign * Math.max(shown[i]!, 0.02)));
      });
      ruler.setLines([
        { points: [pos[0].clone().setY(0.04), pos[1].clone().setY(0.04)] },
        { points: [pos[0].clone().setY(0.04), pos[0]] },
        { points: [pos[1].clone().setY(0.04), pos[1]] },
      ]);
      balance.rotation.y = 0.5 + 0.2 * Math.sin(t * 0.6);
    },
  };
};
