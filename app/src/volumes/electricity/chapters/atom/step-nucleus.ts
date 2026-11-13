/**
 * Step 3 `nucleus` — «Ядро: протони, нейтрони і сильна взаємодія». The Cu-63 cluster fills the frame; one
 * highlighted proton can be dragged out: a lime "strong" spring holds it, a coral Coulomb arrow pushes it
 * away, and the dock plots both forces against the distance r (sim §1: `nucleonForces`). Released beyond the
 * crossover (≈ 4,45 fm) the proton flies off; «Прибрати нейтрони» shows why a nucleus needs neutrons.
 */
import { Group, Mesh, Object3D, SphereGeometry, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import type { DragInfo } from '@/engine/api';
import { createGluons, createPulseRings, createSparks, createTrail, createVectorArrow } from '@/fx';
import { hud } from '@/hud';
import {
  FORCE_CHART_RANGE_N,
  FORCE_CROSSOVER_FM,
  NUCLEON_DISTANCE_RANGE_FM,
  coulombForceN,
  nucleonForces,
  strongForceN,
} from '@electricity/sim/atom';
import { K } from '@/style';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import { hotspotName } from './content';
import { L } from './labels';
import { createIsotopeCard } from './parts/isotope-card';
import { NUCLEON_RADIUS, SPACING } from './parts/nucleus';

/** Local units per femtometre: touching nucleon centres are the hard core r₀ = 1,0 fm apart. */
const FM = NUCLEON_RADIUS * SPACING;
/** Arrow length per decade of force (log scale, document: «стрілки масштабуються логарифмічно»). */
const ARROW_PER_DECADE = 0.42;

export const nucleusStep: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const nucleus = world.nucleus;
  const on = (): boolean => stage.current === 'nucleus';

  /* ------------------------------------------------------------- objects in the cluster's local space */
  const local = new Group();
  local.name = 'nucleus-interaction';
  nucleus.group.add(local);
  // strong-force threads: short coils bridging neighbours, lifted onto the cluster's surface to be seen
  const pairs = nucleus.touchingPairs(14);
  for (const pair of pairs) for (const p of pair) p.setLength(p.length() + NUCLEON_RADIUS * 0.92);
  const threads = createGluons({
    count: pairs.length,
    amplitude: 0.07,
    width: 0.035,
    restLength: FM,
    turns: 3,
  });
  const spring = createGluons({ count: 1, amplitude: 0.15, width: 0.07, restLength: FM * 1.4, turns: 5 });
  const hero = new Object3D();
  const ring = createPulseRings({ color: 'cyan', size: 2.1, amount: 2, intensity: 1.3 });
  const grip = new Mesh(new SphereGeometry(NUCLEON_RADIUS * 1.25, 16, 12), K.flat('cyan'));
  grip.material.colorWrite = false; // invisible pick proxy around the impostor proton
  grip.material.depthWrite = false;
  hero.add(ring, grip);
  const trail = createTrail(hero, { color: 'coral', duration: 0.6, width: 0.34, intensity: 1.6 });
  const coulombArrow = createVectorArrow({
    color: 'coral',
    radius: 0.07,
    headLength: 0.36,
    headRadius: 0.17,
  });
  const sparks = createSparks(ctx, { count: 90, color: ['white', 'coral', 'red'], size: 0.14 });
  local.add(threads, spring, hero, trail, coulombArrow, sparks);
  const localActor = stage.actor(local, { appear: 'none' });

  const card = createIsotopeCard(ctx, { mass: 63, charge: 29, symbol: 'Cu' });
  card.position.set(-5.3, 3.8, 0);
  ctx.root.add(card);

  /* ------------------------------------------------------------------------------------ interaction */
  // mode: idle → drag → (spring back | fly → return) ; burst = «Прибрати нейтрони»
  const state = { index: 0, mode: 'idle' as 'idle' | 'drag' | 'fly' | 'burst', r: 1, hover: 0, burst: 0 };
  const rest = new Vector3();
  const near = new Vector3();
  const pos = new Vector3();
  const dir = new Vector3();
  const normal = new Vector3();
  const through = new Vector3();
  const offset = (): Vector3 => nucleus.protonOffset[state.index]!;

  const pickHero = (): void => {
    offset().set(0, 0, 0);
    // the outermost proton toward the viewer's upper right — easy to see and to pull into free space
    dir.set(0.72, 0.32, 0.62).applyQuaternion(nucleus.group.quaternion.clone().invert());
    state.index = nucleus.outermost('p', dir);
    state.mode = 'idle';
    state.burst = 0;
    nucleus.neutronScale = 1;
    for (const o of nucleus.protonOffset) o.set(0, 0, 0);
    trail.reset();
  };

  const onDrag = (e: DragInfo): void => {
    nucleus.group.localToWorld(through.copy(pos));
    if (!e.planePoint(ctx.camera.camera.getWorldDirection(normal), through, through)) return;
    nucleus.group.worldToLocal(through);
    // keep the centre distance to the nearest nucleon within the model's range: outside every hard core
    // (r ≥ 1,0 fm) and no farther than 6 fm
    nucleus.rest('p', state.index, rest);
    through
      .sub(rest)
      .clampLength(0, (NUCLEON_DISTANCE_RANGE_FM.max + 2) * FM)
      .add(rest);
    const d = nucleus.nearest(through, state.index, near);
    if (d < NUCLEON_DISTANCE_RANGE_FM.min * FM)
      through
        .sub(near)
        .setLength(NUCLEON_DISTANCE_RANGE_FM.min * FM)
        .add(near);
    else if (d > NUCLEON_DISTANCE_RANGE_FM.max * FM)
      through
        .sub(near)
        .setLength(NUCLEON_DISTANCE_RANGE_FM.max * FM)
        .add(near);
    offset().copy(through).sub(rest);
  };

  const release = (): void => {
    const forces = nucleonForces(state.r);
    if (!forces.escapesOnRelease) {
      state.mode = 'idle';
      audio.play('tick', { pitch: 0.8 });
      scope.to(offset(), { x: 0, y: 0, z: 0 }, { duration: 0.7, ease: 'elastic.out' });
      return;
    }
    // Coulomb wins: the proton shoots away, then the step state restores itself after 1,5 s
    state.mode = 'fly';
    audio.play('zap', { gain: 0.6 });
    hud()?.toast(L.nucleus.escape, { icon: 'info', duration: 7, maxWidth: 520 });
    const away = dir.copy(offset()).normalize().multiplyScalar(34);
    scope
      .timeline()
      .to(offset(), { x: away.x, y: away.y, z: away.z }, { duration: 0.9, ease: 'power2.in' })
      .wait(1.5)
      .call(() => trail.reset())
      .to(offset(), { x: 0, y: 0, z: 0 }, { duration: 0.8, ease: 'back.out' })
      .call(() => (state.mode = 'idle'));
  };

  const burst = (): void => {
    if (state.mode !== 'idle') return;
    state.mode = 'burst';
    audio.play('spark', { gain: 0.7 });
    sparks.burst([0, 0, 0], 70, [0, 1, 0], Math.PI);
    scope
      .timeline()
      .to(nucleus, { neutronScale: 0 }, { duration: 0.25, ease: 'power2.in' })
      .to(state, { burst: 1 }, { duration: 0.9, ease: 'power3.out' })
      .wait(0.8)
      .to(state, { burst: 0 }, { duration: 0.8, ease: 'back.out' })
      .to(nucleus, { neutronScale: 1 }, { duration: 0.45, ease: 'back.out' })
      .call(() => (state.mode = 'idle'));
  };

  ctx.input.register(grip, {
    tooltip: L.nucleus.drag,
    cursor: 'grab',
    enabled: () => on() && (state.mode === 'idle' || state.mode === 'drag'),
    hover: (over) => scope.to(state, { hover: over ? 1 : 0 }, { duration: 0.12 }),
    dragStart: (e) => {
      state.mode = 'drag';
      audio.play('click');
      onDrag(e);
    },
    drag: onDrag,
    dragEnd: release,
  });

  /* ------------------------------------------------------------------------------- stage & step UI */
  let scope = ctx.tweens;
  const spots = { proton: 0, neutron: 0 };
  ctx.camera.shots({
    nucleus: {
      position: [0.4, 0.9, 17.5],
      target: [0.4, 0.1, 0],
      frameAspect: 1.25,
      orbit: { azimuth: 0.3, polar: 0.2 },
    },
  });
  stage.define({
    nucleus: {
      show: [world.nucleusActor, world.cloudActor, localActor, card],
      // a little smaller and left of centre: room on the right to pull the proton past the crossover (4,45 fm)
      poses: { nucleus: { scale: 1.2, position: [-1.9, -0.4, 0] } },
      params: { cloudSpread: 3.4, cloudGlow: 0.1, scaleExp: -14 },
      camera: 'nucleus',
      post: { aoIntensity: 0.7 },
      enter(info) {
        scope = info.scope;
        pickHero();
        const inverse = nucleus.group.quaternion.clone().invert();
        spots.proton = nucleus.outermost('p', dir.set(-0.8, 0.1, 0.6).applyQuaternion(inverse));
        spots.neutron = nucleus.outermost('n', dir.set(-0.2, -0.75, 0.6).applyQuaternion(inverse));
      },
      leave() {
        pickHero();
        audio.loop('buzz').set({ gain: 0 });
      },
    },
  });

  const worldOf = (kind: 'p' | 'n', index: () => number) => {
    const v = new Vector3();
    return (): Vector3 => nucleus.group.localToWorld(nucleus.local(kind, index(), v));
  };
  const rs = Array.from({ length: 80 }, (_, i) => 1 + (5 * i) / 79);
  const force = (v: number): string => fmtNumber(v >= 100 ? Math.round(v) : Math.round(v * 10) / 10);
  let plotted = -1;
  ui.define({
    nucleus: {
      hint: L.nucleus.hint,
      honesty: ['simplified'],
      controls: [
        {
          type: 'chart',
          id: 'forces',
          hint: L.nucleus.pair,
          chart: {
            height: 178,
            x: {
              min: NUCLEON_DISTANCE_RANGE_FM.min,
              max: NUCLEON_DISTANCE_RANGE_FM.max,
              label: L.nucleus.chartX,
            },
            y: { ...FORCE_CHART_RANGE_N, log: true, label: L.nucleus.chartY },
            series: [
              { id: 'strong', label: L.nucleus.strong, color: 'lime' },
              { id: 'coulomb', label: L.nucleus.coulomb, color: 'coral' },
            ],
          },
          init: (chart) => {
            chart.setData(
              'strong',
              rs,
              rs.map((r) => Math.max(strongForceN(r), FORCE_CHART_RANGE_N.min)),
            );
            chart.setData('coulomb', rs, rs.map(coulombForceN));
            // where the two curves cross, a released proton no longer springs back
            chart.setMarker('x', {
              x: FORCE_CROSSOVER_FM,
              y: coulombForceN(FORCE_CROSSOVER_FM),
              color: 'white',
              guides: false,
            });
          },
          update: (chart) => {
            if (Math.abs(state.r - plotted) < 0.004) return;
            plotted = state.r;
            const f = nucleonForces(state.r);
            // the two forces at the current distance, in newtons, right on the curves
            chart.setMarker('s', {
              x: f.distanceFm,
              y: Math.max(f.strongN, 1),
              color: 'lime',
              label: `${force(f.strongN)} N`,
            });
            chart.setMarker('c', {
              x: f.distanceFm,
              y: f.coulombN,
              color: 'coral',
              label: `${force(f.coulombN)} N`,
              guides: false,
            });
          },
        },
        {
          type: 'button',
          id: 'removeNeutrons',
          label: L.nucleus.removeNeutrons,
          icon: 'lightning',
          onClick: burst,
        },
      ],
      callouts: [
        {
          anchor: anchorWhen(ctx, () => on() && state.mode === 'idle', hero),
          text: L.nucleus.drag,
          color: 'cyan',
          side: 'right',
        },
      ],
      hotspots: [
        { anchor: worldOf('p', () => spots.proton), title: hotspotName('nucleus', 0) },
        { anchor: worldOf('n', () => spots.neutron), title: hotspotName('nucleus', 1) },
        { anchor: [-3.7, 2.8, 0], title: hotspotName('nucleus', 2) },
      ],
    },
  });

  qaProbe(ctx, 'nucleus.hero', () => hero.getWorldPosition(new Vector3()));
  qaProbe(ctx, 'nucleus.r', () => state.r);
  qaProbe(ctx, 'nucleus.mode', () => state.mode);

  /* -------------------------------------------------------------------------------------- per frame */
  const a = new Vector3();
  const b = new Vector3();
  return {
    update(_dt, t) {
      world.nucleusSpin = 0; // hold the cluster still so the proton can be grabbed
      if (state.burst > 0) {
        // without neutrons the 29 protons fly apart along their radii (Coulomb repulsion wins)
        for (let i = 0; i < nucleus.protonCount; i++)
          nucleus.protonOffset[i]!.copy(nucleus.rest('p', i, a))
            .normalize()
            .multiplyScalar(state.burst * (3.2 + (i % 5) * 0.55));
      }
      nucleus.local('p', state.index, pos);
      hero.position.copy(pos);
      const d = nucleus.nearest(pos, state.index, near);
      if (state.mode !== 'burst')
        state.r = Math.min(Math.max(d / FM, NUCLEON_DISTANCE_RANGE_FM.min), NUCLEON_DISTANCE_RANGE_FM.max);
      const f = nucleonForces(state.r);
      dir.copy(pos).sub(near).normalize();
      const live = state.mode === 'drag' || state.mode === 'idle' ? 1 : 0;
      const pulled = live * Math.min(Math.max((state.r - 1.06) / 0.4, 0), 1);
      coulombArrow.visible = pulled > 0.01;
      const side = NUCLEON_RADIUS * 1.15;
      coulombArrow.set(
        a.copy(pos).addScaledVector(dir, side),
        b.copy(dir).multiplyScalar(ARROW_PER_DECADE * Math.log10(f.coulombN) * pulled),
      );
      // the spring thins out as the strong force fades with distance
      const hold = Math.min(Math.log10(Math.max(f.strongN, 1)) / 4.4, 1);
      spring.setEnds(0, [near.x, near.y, near.z], [pos.x, pos.y, pos.z], pulled > 0 ? 0.25 + 0.75 * hold : 0);
      spring.commit();
      pairs.forEach(([p0, p1], k) => {
        const flicker = Math.max(0, Math.sin(t * (1.6 + k * 0.23) + k * 1.9));
        threads.setEnds(
          k,
          [p0.x, p0.y, p0.z],
          [p1.x, p1.y, p1.z],
          state.burst > 0.02 ? 0 : 0.25 + 0.75 * flicker,
        );
      });
      threads.commit();
      ring.intensity = state.mode === 'idle' ? 1.2 + state.hover : state.mode === 'drag' ? 0.5 : 0;
      audio.loop('buzz').set({ gain: state.mode === 'drag' ? 0.12 * hold : 0, pitch: 0.7 + 0.1 * state.r });
    },
  };
};
