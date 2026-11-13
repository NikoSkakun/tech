/**
 * Step 1 `charge` — «Електричний заряд». Two neutral samples made of atoms hover over the table; the learner
 * moves electrons from one to the other (drag "brush" or buttons). Counters show n and q = n·e (sim:
 * `chargeTransfer`), the sum stays exactly zero, and the quantisation ruler's marker hops only from tick to tick.
 */
import { Group, Mesh, IcosahedronGeometry, SphereGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { toOverlay } from '@/engine/api';
import { createOrbs, createPulseRings } from '@/fx';
import { chargeTransfer, type ChargeTransfer } from '@electricity/sim/charge-field';
import { K } from '@/style';
import { Text3D } from '@/text';
import { clamp, type StepFactory } from '../chapter';
import { fmtCount, fmtPrefixed } from '../fmt';
import { L } from '../labels';
import { CUBES, TABLE } from '../layout';
import { createQuantRuler } from '../parts/quant-ruler';
import { createSampleCube, MAX_BALANCE, type SampleCube } from '../parts/sample-cube';

const PORTIONS = { one: 1, kilo: 1000, giga: 1e9 } as const;
type Portion = keyof typeof PORTIONS;
const N_MAX = 1e12; // 160 nC: more than any rubbed balloon carries
const FLIGHT_S = 0.75;
const STREAM = 7;

export const chargeStep: StepFactory = ({ ctx, ui, world }) => {
  const on = (): boolean => ctx.stage.current === 'charge';
  const set = new Group();
  set.name = 'step-charge';
  ctx.root.add(set);

  const left = createSampleCube(0);
  const right = createSampleCube(2.1);
  left.group.position.x = -CUBES.x;
  right.group.position.x = CUBES.x;
  const ruler = createQuantRuler();
  ruler.group.position.set(0, CUBES.rulerY, CUBES.rulerZ);
  ruler.group.rotation.x = -0.35;
  const stream = createOrbs({ kind: 'electron', count: STREAM, radius: 0.1 });
  const brush = new Group();
  brush.add(
    createPulseRings({ color: 'cyan', size: 1.5, amount: 2, intensity: 1.2 }),
    createOrbs({ kind: 'electron', radius: 0.13 }),
  );
  brush.visible = false;
  // Σq chip between the samples, and the amber pebble of the first hotspot on the rim of the table
  const sum = new Text3D('Σq = 0', {
    font: 'mono',
    size: 21,
    anchorX: 'center',
    anchorY: 'middle',
    color: 'green',
    billboard: true,
    screenSpace: true,
  });
  sum.position.set(0, CUBES.y + 1.75, 0);
  toOverlay(sum);
  const amber = new Mesh(
    new IcosahedronGeometry(0.42, 3),
    K.glass({ color: 'amber', opacity: 0.72, edgeOpacity: 1 }),
  );
  amber.scale.set(1.25, 0.72, 0.95);
  amber.position.set(-TABLE.radius + 1.5, 0.3, 2.9);
  amber.add(
    new Mesh(
      new SphereGeometry(0.16, 16, 12),
      K.glow({ color: 'amber', whiten: 0.1, keepHue: true, intensity: 1.5 }),
    ),
  );
  set.add(left.group, right.group, ruler.group, stream, brush, sum, amber);

  /* ------------------------------------------------------------------------------------- state */
  let n = 0; // electrons moved left → right
  const flight = { age: FLIGHT_S, dir: 1 as 1 | -1 };
  const from = new Vector3();
  const to = new Vector3();
  const portion = (): number => PORTIONS[ui.value<Portion>('portion')];
  const drawn = (): number =>
    n === 0 ? 0 : Math.sign(n) * clamp(Math.round(1 + 2 * Math.log10(Math.abs(n))), 1, MAX_BALANCE);
  const apply = (): void => {
    left.setBalance(-drawn());
    right.setBalance(drawn());
    ruler.set(n, portion());
  };
  const transfer = (dir: 1 | -1): void => {
    const next = clamp(n + dir * portion(), -N_MAX, N_MAX);
    if (next === n) return;
    n = next;
    flight.age = 0;
    flight.dir = dir;
    audio.play('tick', { pitch: dir > 0 ? 1.25 : 0.9, gain: 0.7 });
    apply();
  };
  ui.onChange('portion', apply);

  /* ------------------------------------------------------------------------------- drag "brush" */
  const normal = new Vector3(0, 0, 1);
  const through = new Vector3(0, CUBES.y, 0.4);
  const hit = new Vector3();
  const grab = (cube: SampleCube, dir: 1 | -1): void => {
    ctx.input.register(cube.body, {
      tooltip: L.charge.brush,
      cursor: 'grab',
      enabled: on,
      hover: (over) => ctx.stage.scope.to(cube, { hover: over ? 1 : 0 }, { duration: 0.12 }),
      dragStart: () => audio.play('click'),
      drag: (e) => {
        if (!e.planePoint(normal, through, hit)) return;
        brush.visible = true;
        brush.position.copy(hit);
      },
      dragEnd: () => {
        brush.visible = false;
        // released over the other sample → one portion goes there
        if (hit.x * dir > 0.9) transfer(dir);
      },
    });
  };
  grab(left, 1);
  grab(right, -1);

  const read = (): ChargeTransfer => chargeTransfer(n);
  ctx.qa.probe('cube-left', left.body);
  ctx.qa.probe('cube-right', right.body);
  ctx.qa.expose('charge', () => ({ ...read(), drawn: drawn(), portion: portion() }));

  return {
    id: 'charge',
    stage: {
      show: [world.top.object, set],
      camera: 'charge',
      enter() {
        brush.visible = false;
        flight.age = FLIGHT_S;
        apply();
      },
    },
    ui: {
      hint: L.charge.brush,
      honesty: [{ kind: 'illustrative', text: L.charge.drawn }, 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'portion',
          label: L.charge.portion,
          value: 'kilo',
          items: [
            { id: 'one', label: '1 e⁻' },
            { id: 'kilo', label: '1000 e⁻' },
            { id: 'giga', label: '10⁹ e⁻' },
          ],
        },
        { type: 'button', id: 'toLeft', label: L.charge.toLeft, onClick: () => transfer(-1) },
        { type: 'button', id: 'toRight', label: L.charge.toRight, primary: true, onClick: () => transfer(1) },
        {
          type: 'button',
          id: 'chargeReset',
          label: L.charge.reset,
          icon: 'resetView',
          onClick: () => ((n = 0), apply()),
        },
      ],
      // The four numbers stand on a board, not in the dock: at 1280×720 the dock's height comes out of the text
      // panel, and with them in the dock the first page of the step had to be scrolled.
      board: {
        title: L.capacitor.board,
        size: 'sm',
        children: [
          {
            type: 'stats',
            id: 'chargeStats',
            columns: 2,
            items: [
              { label: L.charge.moved, get: () => fmtCount(n) },
              { label: L.charge.sum, get: () => fmtPrefixed(read().totalChargeC, 'C'), color: () => 'green' },
              {
                label: L.charge.left,
                get: () => fmtPrefixed(read().leftChargeC, 'C', { sign: true }),
                color: () => (n > 0 ? 'coral' : n < 0 ? 'cyan' : 'mist'),
              },
              {
                label: L.charge.right,
                get: () => fmtPrefixed(read().rightChargeC, 'C', { sign: true }),
                color: () => (n < 0 ? 'coral' : n > 0 ? 'cyan' : 'mist'),
              },
            ],
          },
        ],
      },
      callouts: [
        { anchor: left.group, text: () => `q = ${fmtCount(n, true)} e`, side: 'left', color: 'mist' },
        { anchor: right.group, text: () => `q = ${fmtCount(-n, true)} e`, side: 'right', color: 'mist' },
        { anchor: ruler.marker, text: () => `${L.charge.tick}: ${fmtCount(portion())} e`, side: 'up' },
      ],
      hotspots: [
        { anchor: amber, content: 'amber' },
        { anchor: [0, CUBES.y + 2.25, 0], content: 'sum-chip' },
      ],
    },
    update(dt, t) {
      left.update(dt, t);
      right.update(dt, t);
      ruler.update(dt, t);
      amber.rotation.y = t * 0.25;
      // the electrons in flight: a staggered arc from one sample to the other
      flight.age = Math.min(flight.age + dt, FLIGHT_S + 0.3);
      (flight.dir > 0 ? left : right).port(from);
      (flight.dir > 0 ? right : left).port(to);
      for (let i = 0; i < STREAM; i++) {
        const u = clamp(flight.age / FLIGHT_S - i * 0.05, 0, 1);
        const k = u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0;
        stream.setPosition(
          i,
          from.x + (to.x - from.x) * u,
          from.y + 1.1 * Math.sin(u * Math.PI) + 0.12 * Math.sin(i * 2.3),
          from.z + 0.12 * Math.cos(i * 1.7),
          k,
        );
      }
      stream.commit();
    },
  };
};
