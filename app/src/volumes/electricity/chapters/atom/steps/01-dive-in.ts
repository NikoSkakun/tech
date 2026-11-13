/**
 * Step 1 `dive-in` — «Усе складається з атомів». One continuous zoom from a copper wire (10⁻² m) through its
 * cut face (10⁻³ m), the grain mosaic (10⁻⁵ m) and the crystal lattice (10⁻⁹ m) to a single atom (10⁻¹⁰ m).
 *
 * The whole dive is a pure function of the wheel position p ∈ [0, 4]: every level scales exponentially about
 * the origin (where the wire's face, a grain, one lattice ion and the atom sit) and dissolves when it has
 * grown past the frame — so any stop can be entered from any other, forwards or backwards.
 */
import { BackSide, Group, Mesh, SphereGeometry } from 'three';
import { audio } from '@/audio';
import { fmtScale } from '@/content';
import { SCALE_STOPS_M, scaleAtWheel } from '@electricity/sim/atom';
import { K } from '@/style';
import { smooth, type StepFactory } from '../chapter';
import { L } from '../labels';
import { createCopperWire } from '../parts/copper-wire';
import { createCuLattice } from '../parts/lattice';

const LAST = SCALE_STOPS_M.length - 1;
/** Zoom per stop once we are inside the metal: each level grows ×14 while the next one emerges. */
const K_ZOOM = Math.log(14);
/** Wire scale at the stops 1 (face fills a third of the frame) and 2 (a few grains fill the frame). */
const FACE_SCALE = 5;
const GRAIN_SCALE = 80;

export const diveIn: StepFactory = ({ ctx, ui, world }) => {
  const { stage } = ctx;
  const dive = new Group();
  dive.name = 'dive';
  const wire = createCopperWire(ctx.random.fork('wire'));
  const lattice = createCuLattice(ctx);
  dive.add(wire.group, lattice.group);
  ctx.root.add(dive);

  // p eases toward the stop chosen on the wheel; everything on screen derives from it
  const state = { p: 0, stop: 0, wheelAt: -1 };
  const fly = (stop: number, instant = false): void => {
    const from = state.stop;
    state.stop = Math.min(Math.max(Math.round(stop), 0), LAST);
    if (instant) {
      state.p = state.stop;
      return;
    }
    if (state.stop === from) return;
    audio.play(state.stop > from ? 'whooshDown' : 'whooshUp', { gain: 0.5 });
    const duration = 1.5 + 0.7 * Math.abs(state.stop - state.p);
    // the step's own scope: the flight dies if the learner leaves the step mid-dive
    stage.scope.to(state, { p: state.stop }, { duration, ease: 'cinematic' });
  };
  const at = (stop: number) => (): boolean => stage.current === 'dive-in' && Math.abs(state.p - stop) < 0.05;

  stage.define({
    'dive-in': {
      show: [dive, world.cloudActor, world.nucleusActor],
      params: { cloudGlow: 0.42 },
      camera: 'dive',
      post: { dofAperture: 0.5 },
      enter(info) {
        ui.set('wheel', 0); // the dive always starts at the wire (document: default stop 10⁻² m)
        fly(0, true);
        if (!info.instant) audio.play('panelOpen', { gain: 0.4 });
      },
    },
  });

  ui.define({
    'dive-in': {
      hint: L.diveIn.hint,
      honesty: ['notToScale'],
      controls: [
        {
          type: 'slider',
          id: 'wheel',
          label: L.diveIn.wheel,
          min: 0,
          max: LAST,
          value: 0,
          stops: SCALE_STOPS_M.map((_, i) => i),
          format: (v) => fmtScale(Math.log10(SCALE_STOPS_M[Math.round(v)]!)),
          onChange: (v) => fly(v),
        },
      ],
      callouts: [
        { anchor: wire.bodyAnchor, visible: at(0), text: L.diveIn.wire, color: 'amber', side: 'up' },
        { anchor: wire.bodyAnchor, visible: at(1), text: L.diveIn.face, color: 'amber', side: 'up' },
        {
          anchor: wire.grainAnchor,
          visible: at(2),
          text: L.diveIn.grains,
          color: 'amber',
          side: 'left',
        },
        { anchor: lattice.ions, visible: at(3), text: L.diveIn.lattice, color: 'coral', side: 'up' },
        { anchor: world.atom, visible: at(4), text: L.diveIn.atom, color: 'cyan', side: 'up' },
      ],
      hotspots: [
        { anchor: wire.insulationAnchor, content: 'insulation', visible: at(0) },
        { anchor: wire.group, content: 'grain', visible: at(2) },
      ],
    },
  });

  // mouse wheel / trackpad anywhere in the scene turns the scale wheel (one stop per gesture)
  const catcher = new Mesh(new SphereGeometry(60, 12, 8), K.flat('bg.void'));
  catcher.material.side = BackSide;
  catcher.material.colorWrite = false;
  catcher.material.depthWrite = false;
  catcher.name = 'dive-wheel-catcher';
  dive.add(catcher);
  ctx.input.register(catcher, {
    enabled: () => stage.current === 'dive-in',
    wheel: (deltaY) => {
      if (ctx.clock.time - state.wheelAt < 0.45) return true;
      state.wheelAt = ctx.clock.time;
      const next = state.stop + (deltaY > 0 ? 1 : -1);
      if (next < 0 || next > LAST) return true;
      ui.set('wheel', next);
      fly(next);
      return true;
    },
  });

  ctx.qa.expose('dive', () => ({ p: state.p, stop: state.stop }));

  return {
    update(_dt, t) {
      const p = state.p;
      // wire: seen from the side at 10⁻² m, turning to show its cut face while it grows
      const turn = 1 - smooth(0, 1, p);
      const scale =
        p <= 1
          ? Math.exp(Math.log(FACE_SCALE) * p)
          : p <= 2
            ? FACE_SCALE * Math.exp(Math.log(GRAIN_SCALE / FACE_SCALE) * (p - 1))
            : GRAIN_SCALE * Math.exp(K_ZOOM * (p - 2));
      wire.group.scale.setScalar(scale);
      wire.group.rotation.set(0.1 * turn, (-1.08 + Math.sin(t * 0.35) * 0.1) * turn, 0.13 * turn);
      wire.group.position.set(-4.3 * turn, -0.4 * turn + Math.sin(t * 0.7) * 0.12 * turn, 0);
      wire.fade = 1 - smooth(2.3, 2.85, p);
      wire.context = 1 - smooth(0.12, 0.7, p);
      wire.update(t);
      // lattice emerges inside a grain, then one ion grows into the atom
      lattice.group.scale.setScalar(Math.exp(K_ZOOM * (p - 3)));
      lattice.fade = smooth(2.3, 2.85, p) * (1 - smooth(3.3, 3.85, p));
      world.atomZoom = p > 3.05 ? Math.exp(K_ZOOM * (p - 4)) : 0;
      world.ruler.set(Math.log10(scaleAtWheel(p)));
    },
  };
};
