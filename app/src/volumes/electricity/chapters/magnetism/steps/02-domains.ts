/**
 * Step 2 `domains` — where magnetism comes from. A big «crystal» of iron split into 40 domains (model М2:
 * Preisach-like switching thresholds, soft / hard domains, Curie point 770 °C). Left: a coil whose field H
 * sweeps the slab (`magenta` lines, density ∝ |H|); right: a burner and a thermometer. The magnifier upper
 * left shows one electron spinning with its magnetic moment. In front: copper and aluminium bars with small
 * compasses that keep pointing north (they are not ferromagnetic). Board: the hysteresis loop B(H).
 */
import { Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtPercent, fmtUnit } from '@/content';
import { createElectron, createGasFlame, createVectorArrow, type RibbonLine } from '@/fx';
import { Builder, levelTube } from '@/kit';
import { K, SEMANTIC, col } from '@/style';
import { DOMAINS, createDomains } from '@electricity/sim/magnetism';
import type { StepFactory } from '../chapter';
import { DOC } from '../labels';
import { OWN } from '../labels-own';
import { createBLines } from '../parts/b-lines';
import { COPPER, createCoil } from '../parts/coil';
import { createCompass } from '../parts/compass';
import { createDomainSlab } from '../parts/domain-slab';
import { glow, group } from '../world';

const ID = 'domains';
const W = 3.4;
const D = 2.0;
const SLAB_Y = 0.36;
const TRAIL = 600;

export const domainsStep: StepFactory = (bench) => {
  const { ctx, ui } = bench;
  const set = group(`set:${ID}`);
  bench.top.add(set);
  // pedestal + slab
  const pb = new Builder('pedestal');
  pb.box(W + 0.3, SLAB_Y - 0.02, D + 0.3, { r: 0.08, c: ['ink', 'slate'] });
  pb.box(W + 0.1, 0.03, D + 0.1, { at: [0, SLAB_Y - 0.04, 0], r: 0.01, slot: 'metal', c: 'steel' });
  const pedestal = pb.build();
  const slab = createDomainSlab(ctx.random.fork('domains'), W, D, DOMAINS.count);
  slab.group.position.y = SLAB_Y;
  const crystal = group('crystal', 0, 0, -0.15, [pedestal.group, slab.group]);
  // the coil that applies H (axis along x, left of the slab) and its field across the slab
  const coil = createCoil({ r: 0.36, len: 0.7, turns: 9, wire: 0.032 });
  coil.group.position.set(-W / 2 - 0.62, 0.56, -0.15);
  const hLines = createBLines(8 * 40, { width: 0.03, intensity: 1.4, dashSpeed: 0.8 });
  // burner + thermometer on the right
  const burner = new Builder('burner');
  burner.cyl(0.26, 0.12, { seg: 28, slot: 'metal', c: 'steel' });
  burner.cyl(0.08, 0.3, { at: [0, 0.12, 0], seg: 16, slot: 'metal', c: 'mist' });
  const burnerModel = burner.build();
  burnerModel.group.position.set(W / 2 + 0.5, 0, 0.45);
  const flame = createGasFlame({ height: 0.7, width: 0.28 });
  flame.position.set(W / 2 + 0.5, 0.42, 0.45);
  const thermo = levelTube({ height: 1.3, radius: 0.08, color: 'orange', level: 0, ticks: 9 });
  thermo.group.position.set(W / 2 + 0.5, 0, -0.65);
  // copper and aluminium bars that do not care
  const bars = new Builder('bars');
  bars.box(0.9, 0.14, 0.28, { at: [-0.65, 0, 0], r: 0.04, slot: 'metal', c: COPPER });
  bars.box(0.9, 0.14, 0.28, { at: [0.65, 0, 0], r: 0.04, slot: 'metal', c: 'mist' });
  const barModel = bars.build();
  barModel.group.position.set(-0.75, 0, 1.55);
  const smallCompasses = [-1.25, 0.05].map((x) => {
    const c = createCompass(0.18);
    c.group.position.set(x - 0.15, 0, 2.05);
    return c;
  });
  // the magnifier with one spinning electron
  const lupa = new Group();
  lupa.position.set(1.05, 0.95, 1.55);
  lupa.scale.setScalar(0.72);
  const rim = new Mesh(new TorusGeometry(0.55, 0.05, 12, 64), K.metal({ color: 'amber', specular: 0.8 }));
  const lens = new Mesh(new Builder('lens').cyl(0.53, 0.02, { seg: 48, axis: 'z' }).geometry('toon'), K.glass({ color: 'sky', opacity: 0.1, edgeOpacity: 0.5 }));
  lens.position.z = -0.01;
  const electron = createElectron({ radius: 0.15 });
  const spinRing = new Mesh(new TorusGeometry(0.26, 0.012, 6, 48, Math.PI * 1.6), glow('cyan', 1.2));
  spinRing.rotation.x = Math.PI / 2;
  const moment = createVectorArrow({ color: SEMANTIC.fieldB, radius: 0.025, headLength: 0.12, headRadius: 0.06, intensity: 1.4 });
  moment.set([0, 0.18, 0], [0, 0.28, 0]);
  const spinner = new Group();
  spinner.add(electron, spinRing, moment);
  spinner.rotation.set(0.3, 0, -0.25);
  lupa.add(rim, lens, spinner);
  lupa.lookAt(new Vector3(0, 6, 9));
  set.add(crystal, coil.group, hLines.mesh, burnerModel.group, flame, thermo.group, barModel.group, ...smallCompasses.map((c) => c.group), lupa);

  /* ------------------------------------------------------------------------------------- state */
  const model = createDomains(5);
  let state = model.update(0, 20);
  const trail = { xs: [] as number[], ys: [] as number[] };
  let lastAligned = 0;
  let lastKey = '';
  const hot = col('orange');
  const hotter = col('red');
  const h = (): number => ui.value<number>('h2') / 100;
  const temp = (): number => ui.value<number>('t2');
  const pushTrail = (x: number, y: number): void => {
    trail.xs.push(x);
    trail.ys.push(y);
    if (trail.xs.length > TRAIL) {
      trail.xs.shift();
      trail.ys.shift();
    }
  };
  /** Straight H lines across the slab, direction = sign of h. */
  const hLineSet = (sign: number): RibbonLine[] =>
    [-0.75, -0.4, -0.05, 0.3, 0.65].map((z) => {
      const pts = [];
      for (let k = 0; k <= 30; k++) pts.push(new Vector3(-W / 2 - 1.0 + ((W + 1.3) * k) / 30, SLAB_Y + 0.2, z - 0.15));
      return { points: sign < 0 ? pts.reverse() : pts };
    });
  const v = new Vector3();

  ctx.qa.probe('slab2', slab.group);
  ctx.qa.expose(ID, () => ({
    h: h(),
    temperatureC: temp(),
    magnetization: state.magnetization,
    aligned: Array.from(state.aligned).filter((a) => a !== 0).length,
    aboveCurie: state.aboveCurie,
    trail: trail.xs.length,
  }));

  return {
    id: ID,
    shots: {
      [ID]: {
        position: [0.1, 4.6, 4.9],
        target: [0, 0.45, 0.3],
        fov: 34,
        frameAspect: 1.25,
        orbit: { azimuth: 0.6, polar: 0.3 },
        fit: { center: [0, 0.6, 0.3], radius: 2.9 },
      },
    },
    stage: {
      show: [set],
      enter: () => {
        model.reset();
        state = model.update(0, 20);
        trail.xs.length = 0;
        trail.ys.length = 0;
        pushTrail(0, 0);
        lastAligned = 0;
        lastKey = '';
      },
    },
    ui: {
      reset: true,
      honesty: ['notToScale', { kind: 'simplified', text: DOC.simplified }],
      board: {
        title: OWN.loopTitle,
        size: 'sm',
        children: [
          {
            type: 'chart',
            id: 'loop2',
            chart: {
              height: 210,
              x: { min: -100, max: 100, label: 'H, %' },
              y: { min: -100, max: 100, label: 'M/M_s, %' },
              series: [{ id: 'loop', label: OWN.magnetization, color: SEMANTIC.fieldB }],
            },
            update: (chart) => {
              const k = `${trail.xs.length}:${trail.xs[trail.xs.length - 1]}:${trail.ys[trail.ys.length - 1]}`;
              if (k === lastKey) return;
              lastKey = k;
              chart.setData('loop', trail.xs.map((x) => x * 100), trail.ys.map((y) => y * 100));
              chart.setMarker('now', { x: h() * 100, y: state.magnetization * 100 });
            },
          },
        ],
      },
      controls: [
        { type: 'slider', id: 'h2', label: DOC.fieldH, min: -100, max: 100, step: 1, value: 0, unit: '%' },
        { type: 'slider', id: 't2', label: DOC.temperature, ...DOMAINS.temperatureRange, value: 20, unit: '°C' },
        {
          type: 'readout',
          id: 'm2',
          label: OWN.magnetization,
          text: () => `${state.magnetization > 0.005 ? '+' : ''}${fmtPercent(state.magnetization, 0)}`,
        },
        { type: 'note', id: 'curie2', text: `${DOC.curie} · ${fmtUnit(DOMAINS.curieC, '°C')}`, icon: 'warning', color: 'red', visible: () => state.aboveCurie },
      ],
      callouts: [
        { anchor: () => coil.group.getWorldPosition(v).setY(v.y + 0.55), text: OWN.coil, color: SEMANTIC.fieldB, side: 'up' },
        { anchor: thermo.anchor('top'), text: OWN.burner, color: 'orange', side: 'up' },
        { anchor: () => barModel.group.getWorldPosition(v).setZ(v.z + 0.05), text: OWN.copperAl, side: 'right' },
      ],
      hotspots: [
        { anchor: () => lupa.getWorldPosition(v).setY(v.y - 0.62), content: 'electron-spin' },
        { anchor: () => slab.group.localToWorld(v.copy(slab.wallPoint).setY(0.06)), content: 'domain-wall' },
        { anchor: () => slab.group.localToWorld(v.set(W / 2 - 0.25, 0.06, D / 2 - 0.2)), content: 'hysteresis-loop' },
      ],
    },
    update(dt, t) {
      const hv = h();
      const tc = temp();
      state = model.update(hv, tc);
      const last = trail.xs.length - 1;
      if (Math.abs(trail.xs[last]! - hv) > 0.004 || Math.abs(trail.ys[last]! - state.magnetization) > 0.004) pushTrail(hv, state.magnetization);
      // Barkhausen: quiet clicks when domains snap over
      const aligned = Array.from(state.aligned).reduce((n, a) => n + Math.abs(a), 0);
      if (aligned !== lastAligned && bench.isCurrent(ID)) audio.play('tick', { gain: 0.25, pitch: 0.8 + 0.6 * ((aligned * 7) % 5) / 5 });
      lastAligned = aligned;
      const heat = Math.min(Math.max((tc - 20) / (DOMAINS.curieC - 20), 0), 1.2);
      slab.update(dt, t, state.angles, hv, state.jitter * 0.6, state.aboveCurie ? 1 : 0);
      // coil field: lines brighten with |H|, run with its sign; electrons hint the current
      hLines.mesh.visible = Math.abs(hv) > 0.01;
      hLines.mesh.intensity = 0.4 + 1.1 * Math.abs(hv);
      if (hLines.mesh.visible && Math.sign(hv) !== (hLines.mesh.userData.sign ?? 0)) {
        hLines.set(hLineSet(Math.sign(hv)));
        hLines.mesh.userData.sign = Math.sign(hv);
      }
      flame.power = Math.min(heat * 1.2, 1);
      flame.visible = tc > 25;
      thermo.level = (tc - 20) / (DOMAINS.temperatureRange.max - 20);
      thermo.setColor(hot.clone().lerp(hotter, Math.min(heat, 1)));
      spinner.rotation.y = t * 2.2;
      for (const c of smallCompasses) {
        c.heading = Math.PI / 2 + 0.03 * Math.sin(t * 5 + c.group.position.x * 3);
        c.update();
      }
      bench.live.buzz = 0.25 * Math.abs(hv);
    },
  };
};
