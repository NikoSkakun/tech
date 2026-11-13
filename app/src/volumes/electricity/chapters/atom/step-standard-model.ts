/**
 * Step 10 `standard-model` — «Стандартна модель і чотири взаємодії». The wall of 17 particle tokens: a tap
 * opens the particle's card (numbers from the sim's `STANDARD_MODEL`, wording from the document's table),
 * «Звичайна речовина» dims everything except u, d, e, γ, g, and the interaction tabs make the participants
 * pulse (`participantsOf`) while a miniature plays. «Далі» sends a photon from the γ token into the camera —
 * the bridge to the next chapter.
 */
import { Group, Vector3 } from 'three';
import { audio } from '@/audio';
import { fmtNumber, linkTarget } from '@/content';
import { damp } from '@/engine/api';
import { createPhoton, createPulseRings } from '@/fx';
import { STANDARD_MODEL, cardMass, participantsOf, type Interaction } from '@electricity/sim/atom';
import { anchorWhen, qaProbe, type StepFactory } from './chapter';
import content, { hotspotName } from './content';
import { L } from './labels';
import { SM_TEXT } from './labels-sm';
import { createElementCard } from './parts/element-card';
import { createSmMinis } from './parts/sm-minis';
import { createSmWall } from './parts/sm-wall';

const INTERACTIONS: readonly Interaction[] = ['strong', 'electromagnetic', 'weak', 'gravity'];
const X = new Vector3(1, 0, 0);

export const standardModelStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'standard-model';
  const set = new Group();
  set.name = 'standard-model';
  ctx.root.add(set);

  const wall = createSmWall();
  wall.group.position.set(-1.7, 0.35, 0);
  const minis = createSmMinis(ctx);
  minis.group.position.set(6.6, 2.5, 0.8);
  const card = createElementCard(ctx, 0.0165, 62);
  card.surface.position.set(6.6, -2.45, 0.8);
  const ring = createPulseRings({ color: 'yellow', size: 2.3, amount: 2, intensity: 1.2 });
  const courier = createPhoton({ length: 1.8, amplitude: 0.16, width: 0.07 });
  courier.visible = false;
  set.add(wall.group, minis.group, card.surface, ring, courier);

  const state = {
    selected: 'electron',
    hover: '',
    interaction: 'electromagnetic' as Interaction,
    fly: 0,
    leaving: false,
  };
  const level = wall.tokens.map(() => 1);
  const select = (id: string, silent = false): void => {
    state.selected = id;
    const c = wall.token(id).card;
    const text = SM_TEXT[id]!;
    const mass = cardMass(c);
    card.set({
      symbol: c.symbol.replace('_', ''),
      title: text.name,
      lines: [
        `${L.sm.charge}: **${c.chargeText}** e · ${L.sm.spin}: **${c.spin === 0.5 ? '½' : c.spin}**`,
        `${L.sm.mass}: ${text.mass ?? (mass && c.massMeV !== 0 ? `${fmtNumber(mass.value)} ${mass.unit}/c²` : '0')}`,
        `${L.sm.discovered}: ${text.discovered}`,
        `${L.sm.where}: ${text.where}`,
      ],
    });
    if (!silent) audio.play('click', { pitch: 0.9 + 0.02 * STANDARD_MODEL.indexOf(c) });
  };
  for (const token of wall.tokens) {
    ctx.input.register(token.orb, {
      tooltip: SM_TEXT[token.card.id]!.name,
      enabled: on,
      hover: (over) =>
        (state.hover = over ? token.card.id : state.hover === token.card.id ? '' : state.hover),
      click: () => select(token.card.id),
    });
  }

  // the bridge: a photon leaves the γ token, flies into the camera, and the next chapter opens
  const bridge = content.crossReferences
    ?.flatMap((x) => x.targets)
    .find((t) => linkTarget(t)?.chapterId === 'charge-field'); // a full step address: volume/chapter/step
  const leave = (): void => {
    if (state.leaving) return;
    state.leaving = true;
    select('photon', true);
    audio.play('whooshUp', { gain: 0.6 });
    ctx.tweens.to(
      state,
      { fly: 1 },
      {
        duration: 1.1,
        ease: 'power2.in',
        onComplete: () => {
          if (bridge && ctx.nav.locate(bridge)) void ctx.nav.open(bridge);
          else if (ctx.nav.canNext) void ctx.nav.next();
          else state.leaving = false; // the next chapter is not built yet: stay
        },
      },
    );
  };

  ctx.camera.shots({
    'standard-model': {
      position: [1.2, 0.2, 21.5],
      target: [1.2, 0, 0],
      frameAspect: 1.5,
      orbit: { azimuth: 0.3, polar: 0.15 },
    },
  });
  stage.define({
    'standard-model': {
      show: [set],
      params: { scaleExp: -18 },
      camera: 'standard-model',
      enter() {
        state.leaving = false;
        state.fly = 0;
        state.interaction = ui.value<string>('interaction') as Interaction;
        minis.show(state.interaction);
        select(state.selected, true);
      },
    },
  });

  const v = new Vector3();
  const below = (id: string) => (): Vector3 =>
    wall
      .token(id)
      .group.getWorldPosition(v)
      .add(new Vector3(0.62, -0.62, 0.3));
  const corner = (p: Vector3) => (): Vector3 => wall.group.localToWorld(v.copy(p));
  ui.define({
    'standard-model': {
      hint: L.sm.hint,
      honesty: ['simplified'],
      controls: [
        {
          type: 'toggle',
          id: 'ordinary',
          label: L.sm.ordinary,
          value: false,
          onChange: () => audio.play('toggle'),
        },
        {
          type: 'segmented',
          id: 'interaction',
          label: L.sm.interaction,
          items: INTERACTIONS.map((id) => ({
            id,
            label: id === 'electromagnetic' ? L.sm.emShort : L.sm[id],
          })),
          value: 'electromagnetic',
          onChange: (id) => {
            state.interaction = id as Interaction;
            minis.show(state.interaction);
            audio.play('toggle');
          },
        },
        { type: 'button', id: 'bridge', label: L.sm.next, icon: 'lightning', primary: true, onClick: leave },
      ],
      callouts: [
        { anchor: corner(wall.corners.quarks), text: L.sm.quarks, color: 'amber', side: 'up' },
        { anchor: corner(wall.corners.leptons), text: L.sm.leptons, color: 'cyan', side: 'left' },
        { anchor: corner(wall.corners.bosons), text: L.sm.bosons, color: 'mist', side: 'up' },
        {
          anchor: anchorWhen(
            ctx,
            () => on() && state.interaction === 'weak',
            () => minis.group.getWorldPosition(v).setY(v.y + 1.9),
          ),
          text: L.sm.beta,
          color: 'pink',
          side: 'up',
        },
        {
          anchor: anchorWhen(
            ctx,
            () => on() && state.interaction === 'gravity',
            () => minis.group.getWorldPosition(v).setY(v.y - 0.85),
          ),
          text: L.sm.noCarrier,
          color: 'mist',
          side: 'down',
        },
      ],
      hotspots: [
        { anchor: below('photon'), title: hotspotName('standard-model', 0) },
        { anchor: below('nu-mu'), title: hotspotName('standard-model', 1) },
        { anchor: below('higgs'), title: hotspotName('standard-model', 2) },
      ],
    },
  });
  qaProbe(ctx, 'sm.selected', () => state.selected);
  qaProbe(ctx, 'sm.leaving', () => state.leaving);
  qaProbe(ctx, 'sm.token', () => wall.token('top').group.getWorldPosition(new Vector3()));
  qaProbe(ctx, 'sm.dimmed', () => level.filter((k) => k < 0.8).length);

  const from = new Vector3();
  return {
    update(dt, t) {
      const ordinaryOnly = ui.value<boolean>('ordinary');
      const active = new Set(participantsOf(state.interaction).map((p) => p.id));
      wall.tokens.forEach((token, i) => {
        const c = token.card;
        const dim = ordinaryOnly && !c.ordinaryMatter;
        level[i] = damp(level[i]!, dim ? 0.5 : 1, 8, dt);
        // participants of the chosen interaction breathe; its carrier beats harder
        const beat =
          active.has(c.id) && !dim
            ? (c.carrierOf === state.interaction ? 0.13 : 0.05) * (0.5 + 0.5 * Math.sin(t * 4 + i * 0.6))
            : 0;
        const hover = state.hover === c.id ? 0.1 : 0;
        token.group.scale.setScalar(level[i]! * (1 + beat + hover));
        token.group.position
          .copy(token.home)
          .setZ(token.home.z + (hover > 0 ? 0.3 : 0) + 0.05 * Math.sin(t * 1.1 + i));
        token.label.opacity = dim ? 0.35 : 1;
      });
      wall.token(state.selected).group.getWorldPosition(ring.position);
      ring.position.z += 0.2;
      minis.update(dt, t);

      // the courier photon
      courier.visible = state.fly > 0.001 && state.fly < 1;
      if (courier.visible) {
        wall.token('photon').group.getWorldPosition(from);
        const to = ctx.camera.camera.position;
        courier.position.lerpVectors(from, to, state.fly);
        courier.quaternion.setFromUnitVectors(X, v.subVectors(to, from).normalize());
        courier.scale.setScalar(1 + 2.5 * state.fly);
      }
    },
  };
};
