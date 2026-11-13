/**
 * Step 1 `magnet-field` — a bar magnet and its field. Centre: magnet A (N to the east); beside it magnet B,
 * which the user drags over the table (radius 0,4 m). Field lines **B** (model М1: two Gilbert charges per
 * magnet, RK4 lines from the N poles) are re-traced whenever a magnet moves; the compass carpet and the iron
 * filings follow the same field. «Зазирнути всередину» turns the bodies to glass and draws the lines inside
 * (S → N, closing every loop); «Розрізати магніт» splits A into two half magnets with new poles at the cut.
 */
import { Vector3 } from 'three';
import { audio } from '@/audio';
import type { RibbonLine } from '@/fx';
import { MAGNETS, barMagnet, createCompass as createNeedleFollower, cutMagnet, magnetField, magnetForce, magnetPoles, traceMagnetLines, type BarMagnet } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { MAGNET_H, MAGNET_W, createBarMagnet, type BarMagnetModel } from '../parts/bar-magnet';
import { createBLines } from '../parts/b-lines';
import { createCompass } from '../parts/compass';
import { createFilings } from '../parts/filings';
import { createGlobe } from '../parts/globe';
import { MEMORY_DEFLECTION, createMemory } from '../parts/memory';
import { S, group, simToWorld } from '../world';

const ID = 'magnet-field';
const LINE_H = MAGNET_H / 2;
const B_HOME = { x: 0.2, y: -0.11, angle: 0 };
const CUT_GAP = 0.04;
const LIMIT = MAGNETS.tableRadiusM;

export const magnetFieldStep: StepFactory = (bench) => {
  const { ctx, ui, carpet } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  const magA = createBarMagnet(1);
  const halves = [createBarMagnet(0.5), createBarMagnet(0.5)] as const;
  const magB = createBarMagnet(1);
  const all: BarMagnetModel[] = [magA, ...halves, magB];
  const lines = createBLines(4 * MAGNETS.seedsPerPole * (MAGNETS.lineMaxSteps + 2) + 64);
  lines.mesh.position.y = 0.002;
  const filings = createFilings(ctx.random.fork('filings'), 1400, 2.5);
  const compass = createCompass(0.42);
  compass.group.position.set(-2.3, 0, 1.55);
  const globe = createGlobe(0.3);
  globe.group.position.set(2.3, 1.5, -1.7);
  // the opening memory of `current/dc-ac`: the compass under the wire, current switching off
  const memory = createMemory();
  memory.group.position.set(-4.0, 0, 0.4);
  set.add(...all.map((m) => m.group), lines.mesh, filings.group, compass.group, globe.group, memory.group);

  /* ------------------------------------------------------------------------------------- state */
  const st = { bx: B_HOME.x, by: B_HOME.y, bAngle: B_HOME.angle, split: 0, peek: 0, cut: false, dragging: false };
  const a = barMagnet(0, 0, 0);
  const needle = createNeedleFollower();
  const magnets = (): BarMagnet[] => {
    const b = barMagnet(st.bx, st.by, st.bAngle);
    if (!st.cut) return [a, b];
    const [h1, h2] = cutMagnet(a, CUT_GAP * st.split);
    return [h1, h2, b];
  };
  let key = '';
  let list = magnets();
  const inside = (m: BarMagnet, x: number, y: number, pad: number): boolean => {
    const c = Math.cos(m.angleRad);
    const s = Math.sin(m.angleRad);
    const u = (x - m.x) * c + (y - m.y) * s;
    const v = -(x - m.x) * s + (y - m.y) * c;
    return Math.abs(u) < m.lengthM / 2 + pad && Math.abs(v) < MAGNET_W / S / 2 + pad;
  };
  const underAny = (wx: number, wz: number, pad: number): boolean => list.some((m) => inside(m, wx / S, -wz / S, pad));
  const fieldAt = (wx: number, wz: number, out: { x: number; y: number }, earth: boolean): void => {
    const b = magnetField(list, wx / S, -wz / S, earth);
    out.x = b.x;
    out.y = b.y;
  };
  filings.field = (x, z, out) => fieldAt(x, z, out, false);
  filings.mask = (x, z) => underAny(x, z, 0.006) || Math.hypot(x - compass.group.position.x, z - compass.group.position.z) < 0.5;

  /** Re-trace the field lines when the arrangement changed (М1: ≤ 3 magnets × 14 seeds × ≤ 400 RK4 steps). */
  function refresh(): void {
    list = magnets();
    const k = `${st.bx.toFixed(4)},${st.by.toFixed(4)},${st.bAngle.toFixed(3)},${st.cut},${st.split.toFixed(3)},${st.peek > 0.02}`;
    if (k === key) return;
    key = k;
    const extra: RibbonLine[] = [];
    if (st.peek > 0.02)
      for (const m of list) {
        // inside the body the lines run S → N and close the loops outside
        const [n, s] = magnetPoles(m);
        for (const off of [-0.35, 0, 0.35]) {
          const ox = -Math.sin(m.angleRad) * off * (MAGNET_W / S / 2);
          const oy = Math.cos(m.angleRad) * off * (MAGNET_W / S / 2);
          extra.push({
            points: [simToWorld(s.position.x + ox, s.position.y + oy, LINE_H), simToWorld(n.position.x + ox, n.position.y + oy, LINE_H)],
          });
        }
      }
    lines.fromSim(traceMagnetLines(list), LINE_H, extra);
  }

  /* ------------------------------------------------------------------------------- interaction */
  const tableNormal = new Vector3(0, 1, 0);
  const onTable = new Vector3();
  const local = new Vector3();
  const clampB = (x: number, y: number): [number, number] => {
    const r = Math.hypot(x, y);
    const k = r > LIMIT - 0.06 ? (LIMIT - 0.06) / r : 1;
    const bx = x * k;
    let by = y * k;
    // keep B off magnet A's body (A sits at the origin, along x)
    if (Math.abs(bx) < 0.1 && Math.abs(by) < 0.035) by = by >= 0 ? 0.035 : -0.035;
    return [bx, by];
  };
  /** Nearest pole pair between B and the other magnets: distance (m) and the vector from B's pole to it. */
  const nearest = (): { d: number; dx: number; dy: number } => {
    const bPoles = magnetPoles(barMagnet(st.bx, st.by, st.bAngle));
    let best = { d: Infinity, dx: 0, dy: 0 };
    for (const m of list.slice(0, -1))
      for (const p of magnetPoles(m))
        for (const q of bPoles) {
          const dx = p.position.x - q.position.x;
          const dy = p.position.y - q.position.y;
          const d = Math.hypot(dx, dy);
          if (d < best.d) best = { d, dx, dy };
        }
    return best;
  };
  let snap: ReturnType<typeof ctx.tweens.to> | null = null;
  /** Released close (< 8 cm between poles): the magnets snap together or spring apart (М1 pole forces). */
  function settleRelease(): void {
    const n = nearest();
    if (n.d > MAGNETS.snapDistanceM) return;
    const bMag = barMagnet(st.bx, st.by, st.bAngle);
    const f = list.slice(0, -1).reduce((acc, m) => {
      const v = magnetForce(m, bMag);
      return { x: acc.x + v.x, y: acc.y + v.y };
    }, { x: 0, y: 0 });
    const attract = f.x * n.dx + f.y * n.dy > 0;
    const [tx, ty] = attract
      ? clampB(st.bx + n.dx * (1 - 0.004 / n.d), st.by + n.dy * (1 - 0.004 / n.d))
      : clampB(st.bx - (n.dx / n.d) * 0.1, st.by - (n.dy / n.d) * 0.1);
    audio.play(attract ? 'click' : 'toggle', { pitch: attract ? 0.7 : 1.3 });
    snap = ctx.stage.scope.to(st, { bx: tx, by: ty }, { duration: attract ? 0.35 : 0.6, ease: attract ? 'power3.in' : 'back.out' });
  }
  ctx.input.register(magB.body, {
    tooltip: OWN.magnetB,
    cursor: 'grab',
    enabled: () => bench.isCurrent(ID),
    dragStart: () => ((st.dragging = true), snap?.kill()),
    drag: (e) => {
      const p = e.planePoint(tableNormal, bench.top.getWorldPosition(onTable), local);
      if (!p) return;
      bench.top.worldToLocal(p);
      [st.bx, st.by] = clampB(p.x / S, -p.z / S);
    },
    dragEnd: () => ((st.dragging = false), settleRelease()),
  });
  const flip = (): void => {
    audio.play('whooshUp', { gain: 0.4 });
    ctx.stage.scope.to(st, { bAngle: st.bAngle + Math.PI }, { duration: 0.55, ease: 'back.out' });
  };
  const toggleCut = (): void => {
    st.cut = !st.cut;
    if (st.cut) {
      st.split = 0;
      audio.play('spark', { gain: 0.5 });
      ctx.stage.scope.to(st, { split: 1 }, { duration: 0.7, ease: 'back.out' });
    } else {
      audio.play('click');
      st.split = 0;
    }
  };
  ui.onChange('peek1', (on) => ctx.stage.scope.to(st, { peek: on ? 1 : 0 }, { duration: 0.6, ease: 'power2.inOut' }));
  ctx.qa.probe('magnetB1', magB.body);
  ctx.qa.probe('nPole1', magA.n);
  ctx.qa.expose(ID, () => ({
    b: [st.bx, st.by],
    bAngle: st.bAngle,
    cut: st.cut,
    magnets: list.length,
    peek: st.peek,
    lines: key,
    carpetEast: carpet.headingAt(1.2, 0),
    compassDeg: (compass.heading * 180) / Math.PI,
  }));
  const v = new Vector3();

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.5, 5.4, 4.3],
        target: [0.3, 0, 0.25],
        fov: 34,
        frameAspect: 1.4,
        orbit: { azimuth: 0.8, polar: 0.3 },
        fit: { center: [0.2, 0.3, 0.2], radius: 2.7 },
      },
      [`${ID}:memory`]: { position: [-2.6, 2.4, 3.2], target: [-4.0, 0.35, 0.4], fov: 32, fit: { center: [-4.0, 0.4, 0.4], radius: 1.2 } },
    },
    stage: {
      show: [set, carpet.group],
      camera: `${ID}:memory`,
      enter: (info) => {
        // memory of the previous chapter: rings fade, the needle swings back north, then the camera turns to the table
        const toTable = (): void => {
          ctx.stage.toggle(memory.group, false);
          void ctx.camera.go(ID, { duration: info.instant ? 0 : 2.0 });
        };
        memory.field = 1;
        memory.needle = MEMORY_DEFLECTION;
        if (info.instant || ctx.reducedMotion) toTable();
        else {
          info.scope.to(memory, { field: 0 }, { duration: 0.8, delay: 0.5, ease: 'power2.in' });
          info.scope.to(memory, { needle: 0 }, { duration: 1.4, delay: 0.7, ease: 'power3.out' });
          info.scope.delay(2.5, toTable);
        }
        Object.assign(st, { bx: B_HOME.x, by: B_HOME.y, bAngle: B_HOME.angle, split: 0, cut: false, peek: 0 });
        key = '';
        refresh();
        carpet.layout(0, 0, 4.6);
        carpet.field = (x, z, out) => fieldAt(x, z, out, true);
        carpet.mask = (x, z) => underAny(x, z, 0.008) || Math.hypot(x - compass.group.position.x, z - compass.group.position.z) < 0.5;
        if (info.instant) carpet.settle();
        else carpet.field(0, 0, { x: 0, y: 0 });
        filings.drop(ctx.clock.time + 0.6, info.instant);
        needle.reset(Math.PI / 2);
      },
    },
    ui: {
      reset: true,
      hint: OWN.dragMagnet,
      honesty: ['simplified'],
      controls: [
        { type: 'toggle', id: 'peek1', label: DOC.peek, value: false },
        { type: 'button', id: 'flip1', label: DOC.flip, icon: 'resetView', onClick: flip },
        { type: 'button', id: 'cut1', label: DOC.cut, icon: 'lightning', primary: true, onClick: toggleCut, visible: () => !st.cut },
        { type: 'button', id: 'glue1', label: DOC.glue, icon: 'link', onClick: toggleCut, visible: () => st.cut },
      ],
      callouts: [
        {
          anchor: () => magB.group.getWorldPosition(v).setZ(v.z + 0.35),
          text: OWN.dragMagnet,
          color: 'cyan',
          side: 'down',
          visible: () => !st.dragging,
        },
      ],
      hotspots: [
        { anchor: () => (st.cut ? halves[0].n : magA.n).getWorldPosition(v), content: 'n-pole' },
        { anchor: () => (st.cut ? halves[1].s : magA.s).getWorldPosition(v), content: 's-pole' },
        { anchor: compass.top, content: 2 },
        { anchor: () => globe.group.getWorldPosition(v).setY(v.y + 0.45), content: 3 },
      ],
    },
    update(dt, t) {
      refresh();
      // place the models from the arrangement on screen
      const [h1, h2] = cutMagnet(a, CUT_GAP * st.split);
      const place = (model: BarMagnetModel, m: BarMagnet, on: boolean): void => {
        model.group.visible = on;
        simToWorld(m.x, m.y, 0, model.group.position);
        model.group.rotation.y = m.angleRad;
        model.peek = st.peek;
        model.update();
      };
      place(magA, a, !st.cut);
      place(halves[0], h1, st.cut);
      place(halves[1], h2, st.cut);
      place(magB, barMagnet(st.bx, st.by, st.bAngle), true);
      filings.update(dt, t);
      // the table compass: a hero needle following the same field (М1 follower)
      const p = compass.group.position;
      const b = magnetField(list, p.x / S, -p.z / S, true);
      compass.heading = needle.step(Math.atan2(b.y, b.x), Math.min(dt, 0.05));
      compass.update();
      globe.update(t);
      memory.update(t);
    },
  };
};
