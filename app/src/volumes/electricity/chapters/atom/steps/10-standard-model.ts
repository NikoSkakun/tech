/**
 * Step 10 `standard-model` — «Стандартна модель і чотири взаємодії». The wall of 17 particle tokens: a tap
 * opens the particle's card right at the token (numbers from the sim's `STANDARD_MODEL`, wording from the
 * document's table; a second tap closes it),
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
import type { StepFactory } from '../chapter';
import content from '../content';
import { L } from '../labels';
import { SM_TEXT } from '../labels-sm';
import { createElementCard } from '../parts/element-card';
import { createSmChannels } from '../parts/sm-channels';
import { TOKEN_RADIUS, createSmWall } from '../parts/sm-wall';

const INTERACTIONS: readonly Interaction[] = ['strong', 'electromagnetic', 'weak', 'gravity'];
const X = new Vector3(1, 0, 0);
/** The wall sits right of the scale ruler; the four channels and the miniature fill the column beside it. */
const WALL = [-0.4, 0.2, 0] as const;
const CHANNELS = [8.05, -1.1, 0.3] as const;
const CARD = { width: 316, unit: 0.022 };

export const standardModelStep: StepFactory = ({ ctx, ui }) => {
  const { stage } = ctx;
  const on = (): boolean => stage.current === 'standard-model';
  const set = new Group();
  set.name = 'standard-model';
  ctx.root.add(set);

  const wall = createSmWall();
  wall.group.position.set(...WALL);
  const channels = createSmChannels(ctx, {
    strong: L.sm.strong,
    electromagnetic: L.sm.electromagnetic,
    weak: L.sm.weak,
    gravity: L.sm.gravity,
  });
  channels.group.position.set(...CHANNELS);
  const card = createElementCard(ctx, { name: 'particle-card', ...CARD, lines: 4, top: [0, 0, 1.4] });
  card.console.surface.visible = false;
  // the card covers a part of the wall: a tap on it puts it away
  card.console.panel.on({ cursor: 'pointer', click: () => select('') });
  const ring = createPulseRings({ color: 'yellow', size: 3, amount: 2, intensity: 1.2 });
  const courier = createPhoton({ length: 1.8, amplitude: 0.16, width: 0.07 });
  courier.visible = false;
  set.add(wall.group, channels.group, card.console.surface, ring, courier);

  // selected = the token whose card is open ('' = none)
  const state = {
    selected: '',
    hover: '',
    interaction: 'electromagnetic' as Interaction,
    fly: 0,
    leaving: false,
  };
  const level = wall.tokens.map(() => 1);
  const select = (id: string, silent = false): void => {
    state.selected = id;
    if (!id) return;
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
      click: () => select(state.selected === token.card.id ? '' : token.card.id),
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
    stage.scope.to(
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

  stage.define({
    'standard-model': {
      show: [set],
      params: { scaleExp: -18 },
      camera: 'standard-model',
      post: { dofAperture: 0.12 },
      enter() {
        state.leaving = false;
        state.fly = 0;
        state.interaction = ui.value<string>('interaction') as Interaction;
        channels.show(state.interaction);
        select('', true);
      },
    },
  });

  const v = new Vector3();
  const below = (id: string) => (): Vector3 =>
    wall
      .token(id)
      .group.getWorldPosition(v)
      .add(new Vector3(TOKEN_RADIUS * 0.8, -TOKEN_RADIUS * 0.8, 0.3));
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
            label: L.sm[id],
          })),
          value: 'electromagnetic',
          onChange: (id) => {
            state.interaction = id as Interaction;
            channels.show(state.interaction);
            audio.play('toggle');
          },
        },
        { type: 'button', id: 'bridge', label: L.sm.next, icon: 'lightning', primary: true, onClick: leave },
      ],
      callouts: [
        { anchor: corner(wall.corners.quarks), text: L.sm.quarks, color: 'amber', side: 'up' },
        { anchor: corner(wall.corners.leptonsBelow), text: L.sm.leptons, color: 'cyan', side: 'down' },
        { anchor: corner(wall.corners.bosons), text: L.sm.bosons, color: 'mist', side: 'up' },
        {
          anchor: () => channels.group.localToWorld(v.copy(channels.stageTop)),
          text: L.sm.beta,
          color: 'pink',
          side: 'up',
          visible: () => state.interaction === 'weak',
        },
        {
          anchor: () => channels.group.localToWorld(channels.channelPoint('gravity', v)),
          text: L.sm.noCarrier,
          color: 'mist',
          side: 'down',
          visible: () => state.interaction === 'gravity',
        },
      ],
      hotspots: [
        { anchor: below('photon'), content: 'photon' },
        { anchor: below('nu-mu'), content: 'neutrinos' },
        { anchor: below('higgs'), content: 'higgs' },
      ],
    },
  });
  for (const id of ['top', 'electron']) ctx.qa.probe(`sm.token.${id}`, wall.token(id).group);
  ctx.qa.probe('sm.card', () => card.console.surface.localToWorld(new Vector3(0, 300, 0)));
  ctx.qa.expose('sm', () => ({
    selected: state.selected,
    leaving: state.leaving,
    interaction: state.interaction,
    dimmed: level.filter((k) => k < 0.8).length,
  }));

  // The card opens at its token: beside it, on the side with more room, sliding out of the token.
  let open = 0;
  const at = new Vector3();
  const placeCard = (dt: number): void => {
    const surface = card.console.surface;
    open = damp(open, state.selected ? 1 : 0, 12, dt);
    surface.visible = ring.visible = open > 0.03 && state.selected !== '';
    if (!state.selected) return;
    wall.token(state.selected).group.getWorldPosition(at);
    ring.position.copy(at).setZ(at.z + 0.2);
    const scale = surface.scale.y; // world units per px-eq, growth included
    const halfW = (CARD.width / 2) * scale;
    const height = card.console.panel.bh * scale;
    // right of the token unless that leaves the frame's right half; below it unless the token is in the lower rows
    const side = at.x + TOKEN_RADIUS + 2 * halfW < CHANNELS[0] + 2.6 ? 1 : -1;
    const down = at.y > WALL[1] - 0.5;
    const gap = TOKEN_RADIUS + 0.25;
    Object.assign(card.console.top, {
      x: at.x + side * (gap + halfW) * open,
      y: down ? at.y + TOKEN_RADIUS : at.y - TOKEN_RADIUS + height,
      z: at.z + 1.4,
    });
    card.console.pin();
  };
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
      placeCard(dt);
      channels.update(dt, t);

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
