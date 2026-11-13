/**
 * Step 4 `quarks` — «Кварки і глюони». Inside a glass proton three quark characters circle on gluon springs.
 * «Протон | Нейтрон» recolours one quark (uud → udd); dragging any quark stretches the string — the energy
 * E = σ·d grows until it snaps at d = 1,2 fm into a quark–antiquark pair that leaves as a pion (sim §5:
 * `quarkPull`). A test tube shows where the proton's mass comes from (`protonMassBudget`).
 */
import { Color, Group, Mesh, SphereGeometry, TorusGeometry, Vector3, type Vector4 } from 'three';
import { audio } from '@/audio';
import { fmtNumber } from '@/content';
import { damp, type DragInfo } from '@/engine/api';
import { createFlash, createGluons, createOrbs, createQuark } from '@/fx';
import { hud } from '@/hud';
import {
  NEUTRON_QUARKS,
  PROTON_QUARKS,
  STANDARD_MODEL,
  STRING_BREAK_FM,
  STRING_OFFSET_FM,
  hadronCharge,
  protonMassBudget,
  quarkPull,
} from '@electricity/sim/atom';
import { K, col } from '@/style';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import { formula, hotspotName, termName } from './content';
import { L } from './labels';
import { createShareBar } from './parts/share-bar';

/** World units per femtometre in this step (proton charge radius 0,84 fm → glass sphere radius 3,36). */
const U = 4;
const SPHERE_FM = 0.84;
const QUARK_RADIUS = 0.42;
const chargeText = (id: 'up' | 'down'): string => STANDARD_MODEL.find((p) => p.id === id)!.chargeText;

export const quarksStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'quarks';
  const nucleon = new Group();
  nucleon.name = 'nucleon';
  ctx.root.add(nucleon);

  const shell = K.glass({ color: 'coral', opacity: 0.035, edgeOpacity: 0.6, specular: 0.22 });
  const glass = new Mesh(new SphereGeometry(SPHERE_FM * U, 72, 48), shell);
  const orbs = [
    createQuark('up', { radius: QUARK_RADIUS }),
    createQuark('up', { radius: QUARK_RADIUS }),
    createQuark('down', { radius: QUARK_RADIUS }),
  ];
  const quarks = orbs.map((orb, k) => ({ orb, pos: new Vector3(), home: new Vector3(), k }));
  const springs = createGluons({ count: 3, amplitude: 0.2, width: 0.075, restLength: 2.6, turns: 6 });
  const flash = createFlash({ size: 5, color: 'lime', speed: 0.5 });
  nucleon.add(glass, ...orbs, springs, flash);

  // the pion: the torn-off quark and a new antiquark (same ball with a dark "negative" ring), tied by a short string
  const meson = new Group();
  const mq = createOrbs({ kind: 'quarkUp', radius: QUARK_RADIUS * 0.9 });
  const mqbar = createOrbs({ kind: 'quarkUp', radius: QUARK_RADIUS * 0.9 });
  const antiRing = new Mesh(new TorusGeometry(QUARK_RADIUS * 1.25, 0.07, 10, 40), K.flat('bg.void'));
  mqbar.add(antiRing);
  const mspring = createGluons({ count: 1, amplitude: 0.12, width: 0.06, restLength: 1, turns: 3 });
  meson.add(mq, mqbar, mspring);
  meson.visible = false;
  nucleon.add(meson);

  const budget = protonMassBudget();
  const mass = createShareBar({ major: 'lime', minor: 'amber', minorShare: budget.quarkShare, height: 4.4 });
  mass.group.position.set(7.3, 0, 0);
  nucleon.add(mass.group);
  ctx.input.register(mass.group, { tooltip: L.quarks.massBar, enabled: on });

  /* ------------------------------------------------------------------------------------ interaction */
  const state = {
    neutron: 0,
    drag: -1,
    snapped: false,
    hover: -1,
    energy: 0,
    stretch: 0,
    mesonAge: 99,
    breaks: 0,
  };
  const mesonVelocity = new Vector3();
  const hit = new Vector3();
  const normal = new Vector3();
  const isNeutron = (): boolean => state.neutron > 0.5;
  const amber = { body: col('amber'), shade: col('orange') };
  const violet = { body: col('violet'), shade: col('violet.dark') };
  const tint = new Color();
  const shade = new Color();
  /** Colour of quark k now: quark 1 is the one that turns from u to d in the neutron. */
  const paint = (k: number, target: { setColor(c: Color, s: Color): unknown }): void => {
    const d = k === 2 ? 1 : k === 1 ? state.neutron : 0;
    target.setColor(
      tint.copy(amber.body).lerp(violet.body, d),
      shade.copy(amber.shade).lerp(violet.shade, d),
    );
  };

  const snap = (k: number, at: Vector3): void => {
    state.snapped = true;
    state.breaks += 1;
    audio.play('zap', { gain: 0.7 });
    flash.position.copy(at).multiplyScalar(0.7);
    flash.fire();
    hud()?.toast(L.quarks.broke, { icon: 'lightning', duration: 6, maxWidth: 520 });
    // the pion leaves with the pulled quark; a fresh quark of the same kind is born inside the nucleon
    paint(k, mq);
    paint(k, mqbar);
    meson.position.copy(at);
    mesonVelocity.copy(at).normalize().multiplyScalar(1.5);
    state.mesonAge = 0;
    quarks[k]!.pos.copy(at).multiplyScalar(0.5);
    state.drag = -1;
  };

  const onDrag = (k: number, e: DragInfo): void => {
    if (state.snapped) return;
    const q = quarks[k]!;
    if (!e.planePoint(ctx.camera.camera.getWorldDirection(normal), q.pos, hit)) return;
    hit.z = q.pos.z;
    const limit = (STRING_OFFSET_FM + STRING_BREAK_FM + 0.05) * U;
    q.pos.copy(hit.clampLength(0, limit));
    if (quarkPull(q.pos.length() / U).broken) snap(k, q.pos.clone());
  };

  quarks.forEach((q) => {
    ctx.input.register(q.orb, {
      tooltip: termName('quarks', 0),
      cursor: 'grab',
      enabled: on,
      hover: (over) => (state.hover = over ? q.k : state.hover === q.k ? -1 : state.hover),
      dragStart: (e) => {
        state.drag = q.k;
        state.snapped = false;
        audio.play('click');
        onDrag(q.k, e);
      },
      drag: (e) => onDrag(q.k, e),
      dragEnd: () => {
        if (!state.snapped) audio.play('tick', { pitch: 0.7 });
        state.drag = -1;
      },
    });
  });

  /* ------------------------------------------------------------------------------- stage & step UI */
  ctx.camera.shots({
    quarks: {
      position: [1.2, 0.8, 19.5],
      target: [1.2, 0, 0],
      frameAspect: 1.3,
      orbit: { azimuth: 0.3, polar: 0.2 },
    },
  });
  stage.define({
    quarks: {
      show: [nucleon],
      params: { scaleExp: -15 },
      camera: 'quarks',
      post: { bloomIntensity: 1.15 },
      enter() {
        state.drag = -1;
        state.snapped = false;
        state.mesonAge = 99;
        state.neutron = ui.value<string>('hadron') === 'neutron' ? 1 : 0;
      },
      leave() {
        audio.loop('buzz').set({ gain: 0 });
      },
    },
  });

  const charge = (v: number): string => `${v > 0.004 ? '+' : ''}${fmtNumber(Math.round(v * 100) / 100)}`;
  const mid = new Vector3();
  ui.define({
    quarks: {
      hint: L.quarks.hint,
      honesty: ['simplified', 'notToScale'],
      controls: [
        {
          type: 'segmented',
          id: 'hadron',
          items: [
            { id: 'proton', label: L.quarks.proton },
            { id: 'neutron', label: L.quarks.neutron },
          ],
          value: 'proton',
          onChange: (id) => {
            audio.play('toggle');
            ctx.tweens.to(
              state,
              { neutron: id === 'neutron' ? 1 : 0 },
              { duration: 0.8, ease: 'power2.inOut' },
            );
          },
        },
        {
          type: 'readout',
          id: 'sum',
          label: L.quarks.sum,
          unit: 'e',
          format: charge,
          get: () => hadronCharge(isNeutron() ? NEUTRON_QUARKS : PROTON_QUARKS),
        },
        {
          type: 'readout',
          id: 'stretch',
          label: L.quarks.stretch,
          unit: 'fm',
          digits: 2,
          get: () => state.stretch,
        },
        {
          type: 'readout',
          id: 'energy',
          label: L.quarks.energy,
          unit: 'GeV',
          digits: 2,
          get: () => state.energy,
          color: (v) => (v > 0.9 ? 'red' : 'lime'),
        },
      ],
      callouts: [
        { anchor: orbs[0]!, text: chargeText('up'), color: 'amber', side: 'up' },
        {
          anchor: anchorWhen(ctx, () => !isNeutron(), orbs[1]!),
          text: chargeText('up'),
          color: 'amber',
          side: 'up',
        },
        {
          anchor: anchorWhen(ctx, isNeutron, orbs[1]!),
          text: chargeText('down'),
          color: 'violet',
          side: 'up',
        },
        { anchor: orbs[2]!, text: chargeText('down'), color: 'violet', side: 'up' },
        {
          anchor: anchorWhen(
            ctx,
            () => !isNeutron(),
            () => mid.set(0, -SPHERE_FM * U - 0.2, 0),
          ),
          text: formula('quarks', 0),
          color: 'coral',
          side: 'down',
        },
        {
          anchor: anchorWhen(ctx, isNeutron, () => mid.set(0, -SPHERE_FM * U - 0.2, 0)),
          text: formula('quarks', 1),
          color: 'mist',
          side: 'down',
        },
        {
          anchor: anchorWhen(ctx, () => state.mesonAge < 2.6, meson),
          text: L.quarks.pion,
          color: 'yellow',
          side: 'up',
        },
        { anchor: mass.majorAnchor, text: L.quarks.massField, color: 'lime', side: 'left' },
        { anchor: mass.minorAnchor, text: L.quarks.massQuarks, color: 'amber', side: 'left' },
      ],
      hotspots: [
        { anchor: () => mid.copy(quarks[0]!.pos).multiplyScalar(1.5), title: hotspotName('quarks', 0) },
        { anchor: () => mid.copy(quarks[2]!.pos).multiplyScalar(1.5), title: hotspotName('quarks', 1) },
        {
          anchor: () => mid.copy(quarks[0]!.pos).add(quarks[2]!.pos).multiplyScalar(0.5),
          title: hotspotName('quarks', 2),
        },
      ],
    },
  });
  qaProbe(ctx, 'quarks.quark0', () => quarks[0]!.pos.clone());
  qaProbe(ctx, 'quarks.breaks', () => state.breaks);
  qaProbe(ctx, 'quarks.energy', () => state.energy);

  /* -------------------------------------------------------------------------------------- per frame */
  const rimCoral = col('coral');
  const rimMist = col('mist');
  const a = new Vector3();
  const b = new Vector3();
  return {
    update(dt, t) {
      // quarks circle the centre at 0,4 fm on a tumbling ring; a dragged one follows the pointer, a released
      // one is pulled back by the string
      quarks.forEach((q, k) => {
        const angle = t * 0.7 + (k * Math.PI * 2) / 3;
        const r = STRING_OFFSET_FM * U * (1 + 0.12 * Math.sin(t * 1.9 + k * 2.1));
        q.home.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.82, Math.sin(angle + t * 0.31) * r * 0.55);
        if (state.drag !== k) {
          q.pos.x = damp(q.pos.x, q.home.x, 7, dt);
          q.pos.y = damp(q.pos.y, q.home.y, 7, dt);
          q.pos.z = damp(q.pos.z, q.home.z, 7, dt);
        }
        q.orb.position.copy(q.pos);
        q.orb.glow = state.hover === k || state.drag === k ? 1.8 : 1;
        paint(k, q.orb);
      });
      const pull = quarkPull(state.drag >= 0 ? quarks[state.drag]!.pos.length() / U : 0);
      state.energy = pull.energyGeV;
      state.stretch = pull.stretchFm;
      const tension = Math.min(pull.stretchFm / STRING_BREAK_FM, 1);
      // the string thickens and brightens as it stores energy
      (springs.material.uniforms.uSpring!.value as Vector4).z = 0.0375 * (1 + 1.3 * tension);
      springs.intensity = 1.25 + 1.2 * tension;
      for (let k = 0; k < 3; k++) {
        const p = quarks[k]!.pos;
        const n = quarks[(k + 1) % 3]!.pos;
        springs.setEnds(k, [p.x, p.y, p.z], [n.x, n.y, n.z]);
      }
      springs.commit();
      shell.color.copy(rimCoral).lerp(rimMist, state.neutron);
      glass.scale.setScalar(1 + 0.012 * Math.sin(t * 1.4));
      mass.group.rotation.y = Math.sin(t * 0.5) * 0.25;
      audio.loop('buzz').set({ gain: 0.1 * tension, pitch: 0.8 + tension });

      // pion: flies off for a few seconds, the pair turning around its centre
      if (state.mesonAge < 3.2) {
        state.mesonAge += dt;
        meson.visible = true;
        meson.position.addScaledVector(mesonVelocity, dt * Math.exp(-state.mesonAge * 0.5));
        const pop =
          Math.min(state.mesonAge / 0.25, 1) * Math.min(Math.max((3.2 - state.mesonAge) / 0.4, 0), 1);
        meson.scale.setScalar(Math.max(pop, 1e-3));
        a.set(Math.cos(t * 3), Math.sin(t * 3), 0).multiplyScalar(0.55);
        b.copy(a).negate();
        mq.position.copy(a);
        mqbar.position.copy(b);
        antiRing.quaternion.copy(ctx.camera.camera.quaternion);
        mspring.setEnds(0, [a.x, a.y, a.z], [b.x, b.y, b.z]);
        mspring.commit();
      } else meson.visible = false;
    },
  };
};
