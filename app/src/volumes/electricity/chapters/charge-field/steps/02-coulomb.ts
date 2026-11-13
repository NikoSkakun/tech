/**
 * Step 2 `coulomb` — «Закон Кулона». Two charged balls hover over the table; force arrows (length ∝ log F, sim:
 * `coulombPair`) point toward each other or apart, a dashed ruler shows r, the board plots F(r) with the
 * current point. «Порівняти з гравітацією» swaps the pair for the 40-floor logarithmic tower of forces.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, fmtScale, fmtSci } from '@/content';
import { damp } from '@/engine/api';
import { RibbonLines } from '@/fx';
import { Builder } from '@/kit';
import { SEMANTIC } from '@/style';
import { COULOMB_RANGES, coulombPair, gravityComparison } from '@electricity/sim/charge-field';
import type { Chart } from '@/ui3d';
import type { StepFactory } from '../chapter';
import { docItems, docLabel } from '../content';
import { fmtSciUnit, fmtTwoSig, forceScale } from '../fmt';
import { DOC, L } from '../labels';
import { COULOMB, M, TABLE } from '../layout';
import { SHOTS } from '../shots';
import { createChargeBall, type ChargeBall } from '../parts/charge-ball';
import { createForceArrow } from '../parts/force-arrow';
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
  const comparing = (): boolean => ui.value<boolean>('compare');
  const pairSet = new Group();
  const tower = createForceTower();
  const cmp = gravityComparison();
  ctx.root.add(pairSet, tower.group);
  // registered here, not on first use: a deep link to another step must find them hidden
  ctx.stage.actor(pairSet);
  ctx.stage.actor(tower.group);
  const balls: [ChargeBall, ChargeBall] = [
    createChargeBall({ reference: 20, base: COULOMB.ball }),
    createChargeBall({ reference: 20, base: COULOMB.ball, phase: 2 }),
  ];
  const arrows = balls.map(() => createForceArrow());
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
  balance.position.set(2.9, 0, -3.3);
  pairSet.add(...balls.map((b) => b.group), ...arrows.map((a) => a.group), ruler, balance);
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
  ctx.qa.expose('coulomb', () => ({
    ...sim(),
    compare: ui.value<boolean>('compare'),
    frame: ctx.camera.currentShot === SHOTS[FRAMES[frame]!] ? frame : -1,
    forceText: fmtTwoSig(sim().forceN * scale().perNewton, scale().unit),
    chartUnit: scale().unit,
  }));

  // The frame follows the pair: three shots, picked by how far the balls and their arrow tips reach from the
  // table centre. Hysteresis keeps the camera still while a ball is dragged around one threshold.
  const FRAMES = ['coulomb', 'coulombMid', 'coulombWide'] as const;
  const REACH = [2.35, 4.0] as const;
  const tip = new Vector3();
  let frame = 0;
  const reach = (): number => {
    const s = sim();
    const length = s.arrowLengthL0 * COULOMB.arrowL0;
    const toward = s.kind === 'attraction' ? 1 : -1;
    let far = 0;
    balls.forEach((ball, i) => {
      const p = pos[i]!;
      tip
        .copy(pos[1 - i]!)
        .sub(p)
        .setY(0)
        .normalize()
        .multiplyScalar(toward * length)
        .add(p);
      far = Math.max(far, Math.hypot(p.x, p.z) + ball.radius, Math.hypot(tip.x, tip.z));
    });
    return far;
  };
  const pickFrame = (from: number): number => {
    const far = reach();
    let next = far > REACH[1] ? 2 : far > REACH[0] ? 1 : 0;
    // step back in only when the pair is clearly inside the tighter frame
    if (next < from && far > REACH[next]! - 0.45) next = from;
    return next;
  };
  const setCompare = (compare: boolean, instant = false): void => {
    ctx.stage.toggle(pairSet, !compare, { instant });
    ctx.stage.toggle(tower.group, compare, { instant });
    frame = pickFrame(0);
    riding = false;
    rideNo++;
    void ctx.camera.go(compare ? 'gravity' : FRAMES[frame]!, { instant });
  };
  ui.onChange('compare', (v) => on() && setCompare(v === true));
  // The ride: the camera goes down the scale together with a carriage that names the decade it passes, so the
  // trip reads as "39 floors between the two forces" and not as a camera move for its own sake.
  let level = 0;
  let riding = false;
  /** Bumped whenever a ride starts or is cut short: timers of an older ride see a stale number and do nothing. */
  let rideNo = 0;
  const ride = (): void => {
    if (riding) return;
    const scope = ctx.stage.scope;
    const mine = ++rideNo;
    const top = Math.log10(cmp.electricN);
    level = top;
    riding = true;
    void ctx.camera.go('gravityTop', { duration: 1.2 });
    scope.delay(1.5, () => {
      if (mine !== rideNo) return;
      const opts = { duration: 4.5, ease: 'sine.inOut' } as const;
      void ctx.camera.go('gravityBottom', opts);
      scope.value(top, Math.log10(cmp.gravityN), opts, (v) => mine === rideNo && (level = v));
    });
    scope.delay(7.6, () => {
      if (mine !== rideNo) return;
      riding = false;
      void ctx.camera.go('gravity', { duration: 1.6 });
    });
  };

  const [attraction, repulsion] = docItems('coulomb', 1, '/');
  const dir = new Vector3();
  const tail = new Vector3();
  const rulerMid = new Vector3();
  const shown = [0, 0];
  let lateral = 0;
  let chartKey = '';
  // The board and the readout speak one unit: the one that suits the top of the chart for the current charges
  // (the chart is cut at the force for r = 2,5 cm, so that the 1/r² tail stays readable).
  const chartTopN = (): number => coulombPair(ui.value<number>('q1'), ui.value<number>('q2'), 0.025).forceN;
  const scale = (): ReturnType<typeof forceScale> => forceScale(chartTopN());
  const drawChart = (chart: Chart): void => {
    const s = sim();
    const key = `${s.q1NC}|${s.q2NC}`;
    if (key !== chartKey) {
      chartKey = key;
      const xs: number[] = [];
      const ys: number[] = [];
      const { unit, perNewton } = scale();
      for (let cm = 1; cm <= 20; cm += 0.25) {
        xs.push(cm);
        ys.push(coulombPair(s.q1NC, s.q2NC, cm / 100).forceN * perNewton);
      }
      chart.setAxis('y', { max: Math.max(chartTopN() * perNewton, 1), label: `F, ${unit}` });
      chart.setData('f', xs, ys);
    }
    chart.setMarker('now', { x: s.distanceM * 100, y: s.forceN * scale().perNewton });
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
            { label: L.coulomb.force, get: () => fmtTwoSig(sim().forceN * scale().perNewton, scale().unit) },
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
          anchor: () => rulerMid,
          text: () => `r = ${fmtNumber(sim().distanceM * 100, { digits: 1 })} cm`,
          side: 'down',
          visible: () => !ui.value<boolean>('compare'),
        },
        {
          anchor: tower.rider,
          text: () => fmtScale(tower.riderExp, 'N'),
          side: 'right',
          visible: () => ui.value<boolean>('compare') && riding,
        },
        {
          anchor: tower.electricTop,
          text: L.coulomb.electric,
          side: 'up',
          color: 'amber',
          visible: () => ui.value<boolean>('compare'),
        },
        {
          anchor: tower.gravityTop,
          text: L.coulomb.gravity,
          side: 'right',
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
      tower.ride(riding && comparing() ? level : null);
      const s = sim();
      const dist = pos[0].distanceTo(pos[1]);
      mid.copy(pos[0]).add(pos[1]).multiplyScalar(0.5);
      dir.copy(pos[1]).sub(pos[0]).normalize();
      // attraction: arrows that point at each other would overlap on the axis, so one runs above the pair
      // and the other below it — equal, opposite, each next to its own ball
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
          .addScaledVector(up, (i ? -1 : 1) * (r + COULOMB.arrowGap) * lateral);
        arrows[i]!.setRim(charges[i]! < 0 ? SEMANTIC.electron : SEMANTIC.proton);
        arrows[i]!.set(tail, hit.copy(dir).multiplyScalar(sign * shown[i]!));
      });
      rulerMid.copy(mid).setY(0.04);
      if (on() && !comparing()) {
        const next = pickFrame(frame);
        if (next !== frame) {
          frame = next;
          void ctx.camera.go(FRAMES[frame]!, { duration: 0.9 });
        }
      }
      ruler.setLines([
        { points: [pos[0].clone().setY(0.04), pos[1].clone().setY(0.04)] },
        { points: [pos[0].clone().setY(0.04), pos[0]] },
        { points: [pos[1].clone().setY(0.04), pos[1]] },
      ]);
      balance.rotation.y = 0.5 + 0.2 * Math.sin(t * 0.6);
    },
  };
};
