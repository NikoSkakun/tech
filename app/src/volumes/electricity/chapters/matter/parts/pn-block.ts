/**
 * `PNBlock` of step 8 (DECISIONS §50): a p bar (tinted `pink`, mobile `coral` holes) and an n bar (tinted `teal`,
 * `cyan` electrons) joined at x = 0. The depletion region |x| < W/2 holds only the fixed ions — «−» squares on the
 * p side, «+» squares on the n side — and the `amber` arrows of the built-in field (n → p). Above the block the
 * energy "hill" for electrons: high on the p side, its step ∝ the barrier. `flow` (0…1) sends carriers across
 * the junction, where they recombine (flash). Local frame: block centred on the origin, p at x < 0.
 */
import { Group, InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlash, createOrbs, createVectorArrow, RibbonLines } from '@/fx';
import { Builder, G } from '@/kit';
import { K, SEMANTIC } from '@/style';

export const BAR = 2.6;
const H = 1.3;
const D = 1.1;
const CARRIERS = 34;
const ION_COLS = 13;
const ION_ROWS = 4;

export interface PnBlock {
  group: Group;
  /** Depletion width, units. */
  width: number;
  /** Barrier height, V (draws the hill). */
  barrier: number;
  /** 0…1 crossing rate (forward current). */
  flow: number;
  ionAnchor: Vector3;
  hillTop: Vector3;
  update(dt: number, t: number): void;
}

function tile(color: 'coral.dark' | 'cyan.dark', plus: boolean): Builder {
  const b = new Builder(`ion-${color}`);
  b.box(0.2, 0.2, 0.06, { r: 0.03, c: color, mid: true });
  b.box(0.13, 0.03, 0.02, { r: 0, c: 'white', at: [0, 0, 0.035], mid: true });
  if (plus) b.box(0.03, 0.13, 0.02, { r: 0, c: 'white', at: [0, 0, 0.035], mid: true });
  return b;
}

export function createPnBlock(ctx: ChapterContext): PnBlock {
  const group = new Group();
  for (const [x, color] of [
    [-BAR / 2, 'pink'],
    [BAR / 2, 'teal'],
  ] as const) {
    const bar = new Mesh(
      G.rbox(BAR - 0.02, H, D, 0.08, 2),
      K.glass({ color, opacity: 0.22, edgeOpacity: 0.8 }),
    );
    bar.position.x = x;
    bar.renderOrder = 2;
    group.add(bar);
  }
  // metal contacts at both ends
  const cb = new Builder('contacts');
  for (const s of [-1, 1])
    cb.box(0.14, H + 0.1, D + 0.1, {
      r: 0.04,
      slot: 'metal',
      c: 'steel',
      at: [s * (BAR + 0.07), 0, 0],
      mid: true,
    });
  group.add(cb.build().group);
  const ionGeo = (c: 'coral.dark' | 'cyan.dark', plus: boolean) => tile(c, plus).geometry('toon');
  const n = ION_COLS * ION_ROWS;
  const minus = new InstancedMesh(ionGeo('cyan.dark', false), K.toon({ vertexColors: true }), n);
  const plus = new InstancedMesh(ionGeo('coral.dark', true), K.toon({ vertexColors: true }), n);
  const holes = createOrbs({ kind: 'hole', count: CARRIERS, radius: 0.1 });
  const electrons = createOrbs({ kind: 'electron', count: CARRIERS, radius: 0.08 });
  const arrows = [-0.35, 0, 0.35].map((y) => {
    const a = createVectorArrow({ color: SEMANTIC.fieldE });
    a.position.set(0, y, D / 2 + 0.12);
    a.scale.setScalar(0.5);
    group.add(a);
    return a;
  });
  const hill = new RibbonLines({ capacity: 64, color: 'sky', width: 0.06, intensity: 1.3 });
  const flash = createFlash({ size: 0.8, color: 'yellow' });
  group.add(minus, plus, holes, electrons, hill, flash);
  const m = new Matrix4();
  const rnd = (): number => ctx.random.next();
  const mk = (side: -1 | 1) =>
    Array.from({ length: CARRIERS }, () => ({
      pos: new Vector3(
        side * (0.6 + rnd() * (BAR - 0.8)),
        (rnd() - 0.5) * (H - 0.3),
        (rnd() - 0.5) * (D - 0.3),
      ),
      vel: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.35),
      cross: false,
    }));
  const hs = mk(-1);
  const es = mk(1);
  const hillPts = Array.from({ length: 48 }, () => new Vector3());
  let acc = 0;
  const tmpA = new Vector3();
  const tmpB = new Vector3();
  const block: PnBlock = {
    group,
    width: 1,
    barrier: 0.71,
    flow: 0,
    ionAnchor: new Vector3(),
    hillTop: new Vector3(),
    update(dt, t) {
      const w = block.width;
      // fixed ions: a grid over both bars, shown only inside the depletion region
      for (let c = 0; c < ION_COLS; c++)
        for (let r = 0; r < ION_ROWS; r++) {
          const i = c * ION_ROWS + r;
          const x = ((c + 0.5) / ION_COLS) * BAR;
          const y = ((r + 0.5) / ION_ROWS - 0.5) * (H - 0.25);
          const inP = x < w / 2 ? 1 : 0;
          m.makeScale(inP, inP, inP).setPosition(-x, y, D / 2 - 0.05);
          minus.setMatrixAt(i, m);
          m.makeScale(inP, inP, inP).setPosition(x, y, D / 2 - 0.05);
          plus.setMatrixAt(i, m);
        }
      minus.instanceMatrix.needsUpdate = true;
      plus.instanceMatrix.needsUpdate = true;
      block.ionAnchor.set(w / 2 - 0.1, 0.3, D / 2);
      // arrows are drawn at half scale: origin and vector in their own (doubled) units
      for (const a of arrows) a.set(tmpA.set(w + 0.5, 0, 0), tmpB.set(-(w + 0.5) * 2, 0, 0));
      // carriers wander outside the depletion region; with flow some cross and recombine
      acc += block.flow * 8 * dt;
      const move = (list: typeof hs, side: -1 | 1): void => {
        for (const c of list) {
          if (c.cross) {
            c.pos.x -= side * 1.4 * dt;
            if (side * c.pos.x < -(w / 2 + 0.35)) {
              flash.position.copy(c.pos);
              flash.fire();
              c.cross = false;
              c.pos.set(side * (BAR - 0.15), (rnd() - 0.5) * (H - 0.3), (rnd() - 0.5) * (D - 0.3));
            }
            continue;
          }
          c.vel.x += (rnd() - 0.5) * dt * 2;
          c.vel.y += (rnd() - 0.5) * dt * 2;
          c.vel.setLength(0.35);
          c.pos.addScaledVector(c.vel, dt);
          const lo = w / 2 + 0.12;
          if (side * c.pos.x < lo) c.pos.x = side * lo + side * 0.01;
          if (side * c.pos.x > BAR - 0.12) c.pos.x = side * (BAR - 0.12);
          if (Math.abs(c.pos.y) > H / 2 - 0.14) c.vel.y *= -1;
          if (Math.abs(c.pos.z) > D / 2 - 0.14) c.vel.z *= -1;
          c.pos.y = Math.max(Math.min(c.pos.y, H / 2 - 0.14), -H / 2 + 0.14);
          c.pos.z = Math.max(Math.min(c.pos.z, D / 2 - 0.14), -D / 2 + 0.14);
        }
      };
      while (acc >= 1) {
        acc -= 1;
        const pick = (list: typeof hs): void => {
          const c =
            list.find((x) => !x.cross && Math.abs(x.pos.x) < w / 2 + 0.6) ?? list.find((x) => !x.cross);
          if (c) c.cross = true;
        };
        pick(hs);
        pick(es);
      }
      move(hs, -1);
      move(es, 1);
      hs.forEach((c, i) => holes.setPosition(i, c.pos.x, c.pos.y, c.pos.z));
      es.forEach((c, i) => electrons.setPosition(i, c.pos.x, c.pos.y, c.pos.z));
      holes.commit();
      electrons.commit();
      // the hill for electrons: high over p, low over n, the step spread over the depletion width
      const top = H / 2 + 0.35;
      const hgt = 0.25 + 1.1 * (block.barrier / 0.71) * 0.6;
      hillPts.forEach((p, k) => {
        const x = -BAR + (2 * BAR * k) / (hillPts.length - 1);
        p.set(x, top + hgt * 0.5 * (1 - Math.tanh((2.2 * x) / Math.max(w, 0.15))), 0);
      });
      hill.setLines([{ points: hillPts }]);
      block.hillTop.set(-BAR * 0.6, top + hgt, 0);
      flash.intensity = 2 + Math.sin(t * 9);
    },
  };
  return block;
}
