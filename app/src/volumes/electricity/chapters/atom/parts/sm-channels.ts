/**
 * The four "interaction channels" of step `standard-model` (chapter document: «чотири „канали взаємодій“:
 * прозорі трубки, по яких біжать відповідні переносники») and the miniature that plays above them.
 *
 * Channels, top to bottom: strong (gluons, lime), electromagnetic (photons, yellow), weak (W / Z, pink) and
 * gravity — whose tube stays empty: it has no carrier in the Standard Model. The chosen channel lights up
 * (end rings glow, its carriers run at full strength, its name turns white); the others idle dimly.
 * Miniatures: strong — two quarks on a gluon spring; electromagnetic — two electrons exchanging a photon;
 * weak — β-decay n → p + e⁻ + ν̄_e; gravity — two stones barely drawn together.
 */
import { CapsuleGeometry, Group, Mesh, TorusGeometry, Vector3 } from 'three';
import { damp, toOverlay, type ChapterContext } from '@/engine/api';
import {
  ORB_STYLES,
  createElectron,
  createFlow,
  createGluons,
  createNeutron,
  createOrbs,
  createPhoton,
  createProton,
  createQuark,
} from '@/fx';
import type { Interaction } from '@electricity/sim/atom';
import { K, type ColorLike } from '@/style';
import { Text3D } from '@/text';

const CARRIER: Record<Interaction, ColorLike | null> = {
  strong: 'lime',
  electromagnetic: 'yellow',
  weak: 'pink',
  gravity: null,
};
const ORDER: readonly Interaction[] = ['strong', 'electromagnetic', 'weak', 'gravity'];
/** Tube geometry: half-length, radius, vertical pitch; y of the first tube; y of the miniature stage. */
const HALF = 1.95;
const RADIUS = 0.27;
const PITCH = 1.3;
const FIRST_Y = 0.55;
const STAGE_Y = 3.75;

export interface SmChannels {
  group: Group;
  show(interaction: Interaction): void;
  /** Local point above the miniature / on the chosen channel, for captions. */
  stageTop: Vector3;
  channelPoint(interaction: Interaction, out: Vector3): Vector3;
  update(dt: number, t: number): void;
}

export function createSmChannels(ctx: ChapterContext, names: Record<Interaction, string>): SmChannels {
  const group = new Group();
  group.name = 'sm-channels';
  let current: Interaction = 'electromagnetic';
  const glass = K.glass({ color: 'mist', opacity: 0.1, edgeOpacity: 0.9, specular: 0.3 });
  const tubeGeometry = new CapsuleGeometry(RADIUS, HALF * 2, 10, 28);
  const ringGeometry = new TorusGeometry(RADIUS * 1.12, 0.04, 8, 32);
  const channels = ORDER.map((id, i) => {
    const y = FIRST_Y - i * PITCH;
    const color = CARRIER[id];
    const tube = new Mesh(tubeGeometry, glass);
    tube.rotation.z = Math.PI / 2;
    tube.position.y = y;
    // end rings in the carrier's colour (steel for the carrier-less gravity channel): they light up when chosen
    const glow = K.glow({ color: color ?? 'steel', intensity: 0.4, keepHue: true, whiten: 0 });
    const rings = [-1, 1].map((side) => {
      const ring = new Mesh(ringGeometry, glow);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(side * HALF, y, 0);
      return ring;
    });
    const flow = color
      ? createFlow(ctx, {
          kind: 'pulse',
          color,
          paths: [{ path: [new Vector3(-HALF, y, 0), new Vector3(HALF, y, 0)] }],
          count: ctx.quality.count(7, 4),
          exactCount: true,
          radius: 0.13,
          speed: 1.5,
        })
      : null;
    const label = new Text3D(names[id], {
      font: 'bodyBold',
      size: 0.36,
      color: 'mist',
      anchorX: 'left',
      anchorY: 'bottom',
      billboard: true,
    });
    label.position.set(-HALF - RADIUS, y + RADIUS + 0.12, 0);
    toOverlay(label);
    group.add(tube, ...rings, label);
    if (flow) group.add(flow);
    return { id, y, glow, flow, label, lit: 0 };
  });

  /* ------------------------------------------------------------------ miniatures, one on stage at a time */
  const stages = ORDER.map(() => new Group());
  const shown = ORDER.map(() => 0);
  // strong: u and d on a spring
  const qa = createQuark('up', { radius: 0.4 });
  const qb = createQuark('down', { radius: 0.4 });
  const spring = createGluons({ count: 1, amplitude: 0.18, width: 0.07, restLength: 1.9, turns: 6 });
  stages[0]!.add(qa, qb, spring);
  // electromagnetic: two electrons trade a photon and are pushed apart
  const ea = createElectron({ radius: 0.38 });
  const eb = createElectron({ radius: 0.38 });
  const photon = createPhoton({ length: 1.2, amplitude: 0.13 });
  stages[1]!.add(ea, eb, photon);
  // weak: a neutron turns into a proton, an electron and an antineutrino
  const neutron = createNeutron({ radius: 0.5 });
  const proton = createProton({ radius: 0.5 });
  const beta = createElectron({ radius: 0.24 });
  const nu = createOrbs({
    kind: { ...ORB_STYLES.hole, color: 'mist', shade: 'mist', glyph: 'none', halo: undefined },
    radius: 0.24,
  });
  stages[2]!.add(neutron, proton, beta, nu);
  // gravity: two stones
  const sa = createOrbs({ kind: 'blob', color: 'slate', radius: 0.6 });
  const sb = createOrbs({ kind: 'blob', color: 'steel', radius: 0.43 });
  stages[3]!.add(sa, sb);
  for (const s of stages) {
    s.position.y = STAGE_Y - 1;
    s.visible = false;
    group.add(s);
  }

  return {
    group,
    stageTop: new Vector3(0, STAGE_Y + 0.35, 0),
    channelPoint: (interaction, out) => out.set(HALF * 0.55, FIRST_Y - ORDER.indexOf(interaction) * PITCH, 0),
    show(interaction) {
      current = interaction;
    },
    update(dt, t) {
      for (const c of channels) {
        c.lit = damp(c.lit, c.id === current ? 1 : 0, 8, dt);
        c.glow.intensity = 0.35 + 1.5 * c.lit;
        c.label.color = c.lit > 0.5 ? 'white' : 'mist';
        if (c.flow) {
          c.flow.density = 0.3 + 0.7 * c.lit;
          c.flow.speed = 0.5 + 1.2 * c.lit;
        }
      }
      ORDER.forEach((id, i) => {
        shown[i] = damp(shown[i]!, id === current ? 1 : 0, 9, dt);
        stages[i]!.visible = shown[i]! > 0.02;
        stages[i]!.scale.setScalar(Math.max(shown[i]!, 1e-3));
      });
      const sep = 1.0 + 0.24 * Math.sin(t * 2.2);
      qa.position.set(-sep, 0.12 * Math.sin(t * 1.3), 0);
      qb.position.set(sep, -0.12 * Math.sin(t * 1.3), 0);
      spring.setEnds(0, [-sep, qa.position.y, 0], [sep, qb.position.y, 0]);
      spring.commit();
      // photon shuttles between the electrons; each one recoils when it emits / absorbs
      const phase = (t * 0.7) % 2;
      const k = phase < 1 ? phase : 2 - phase;
      const push = 0.19 * Math.cos(Math.PI * k) ** 6;
      ea.position.x = -1.6 - (k < 0.5 ? push : 0);
      eb.position.x = 1.6 + (k >= 0.5 ? push : 0);
      photon.position.x = -0.9 + 1.8 * k - 0.6;
      photon.fade = Math.min(1, 6 * k * (1 - k) + 0.15);
      // β-decay loop: 1,2 s neutron, then the three products fly apart
      const cycle = (t * 0.45) % 1.6;
      const after = Math.max(cycle - 0.6, 0);
      neutron.visible = cycle < 0.6;
      proton.visible = beta.visible = nu.visible = !neutron.visible;
      neutron.scale.setScalar(1 + 0.05 * Math.sin(t * 9) * (cycle / 0.6));
      proton.position.x = -0.3 * Math.min(after * 2, 1);
      beta.position.set(0.36 + after * 2.2, 0.24 + after * 1.0, 0);
      nu.position.set(0.36 + after * 2.2, -0.24 - after * 1.0, 0);
      const fade = Math.min(1, (1 - after) * 4);
      beta.scale.setScalar(Math.max(fade, 1e-3));
      nu.scale.setScalar(Math.max(fade, 1e-3));
      // gravity: the pull between two small masses is real but tiny — they hardly move
      const drift = 0.07 * (0.5 - 0.5 * Math.cos(t * 0.6));
      sa.position.x = -1.15 + drift * 0.4;
      sb.position.x = 1.15 - drift;
    },
  };
}
