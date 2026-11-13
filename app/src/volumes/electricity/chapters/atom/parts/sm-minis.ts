/**
 * Miniatures of the four interactions (step `standard-model`), one on stage at a time above a glass "channel"
 * through which the carriers run: strong — two quarks on a gluon spring; electromagnetic — two electrons
 * exchanging a photon; weak — β-decay n → p + e⁻ + ν̄_e; gravity — two stones barely drawn together (no
 * carrier in the Standard Model: the channel stays empty).
 */
import { CapsuleGeometry, Group, Mesh, Vector3 } from 'three';
import { damp, type ChapterContext } from '@/engine/api';
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

const CARRIER: Record<Interaction, ColorLike | null> = {
  strong: 'lime',
  electromagnetic: 'yellow',
  weak: 'pink',
  gravity: null,
};
const ORDER: readonly Interaction[] = ['strong', 'electromagnetic', 'weak', 'gravity'];

export interface SmMinis {
  group: Group;
  show(interaction: Interaction): void;
  update(dt: number, t: number): void;
}

export function createSmMinis(ctx: ChapterContext): SmMinis {
  const group = new Group();
  group.name = 'sm-minis';
  const stages = ORDER.map(() => new Group());
  const shown = ORDER.map(() => 0);
  let current: Interaction = 'electromagnetic';

  // strong: u and d on a spring
  const qa = createQuark('up', { radius: 0.34 });
  const qb = createQuark('down', { radius: 0.34 });
  const spring = createGluons({ count: 1, amplitude: 0.16, width: 0.06, restLength: 1.6, turns: 6 });
  stages[0]!.add(qa, qb, spring);
  // electromagnetic: two electrons trade a photon and are pushed apart
  const ea = createElectron({ radius: 0.32 });
  const eb = createElectron({ radius: 0.32 });
  const photon = createPhoton({ length: 1.0, amplitude: 0.11 });
  stages[1]!.add(ea, eb, photon);
  // weak: a neutron turns into a proton, an electron and an antineutrino
  const neutron = createNeutron({ radius: 0.42 });
  const proton = createProton({ radius: 0.42 });
  const beta = createElectron({ radius: 0.2 });
  const nu = createOrbs({
    kind: { ...ORB_STYLES.hole, color: 'mist', shade: 'mist', glyph: 'none', halo: undefined },
    radius: 0.2,
  });
  stages[2]!.add(neutron, proton, beta, nu);
  // gravity: two stones
  const sa = createOrbs({ kind: 'blob', color: 'slate', radius: 0.5 });
  const sb = createOrbs({ kind: 'blob', color: 'steel', radius: 0.36 });
  stages[3]!.add(sa, sb);
  for (const s of stages) {
    s.position.y = 0.9;
    s.visible = false;
    group.add(s);
  }

  // the channel: a glass tube with the carriers of the chosen interaction running through
  const tube = new Mesh(
    new CapsuleGeometry(0.3, 3.6, 10, 28),
    K.glass({ color: 'mist', opacity: 0.08, edgeOpacity: 0.6, specular: 0.2 }),
  );
  tube.rotation.z = Math.PI / 2;
  tube.position.y = -0.85;
  const carriers = createFlow(ctx, {
    kind: 'pulse',
    color: 'yellow',
    paths: [{ path: [new Vector3(-1.9, -0.85, 0), new Vector3(1.9, -0.85, 0)] }],
    count: 7,
    exactCount: true,
    radius: 0.13,
    speed: 1.5,
  });
  group.add(tube, carriers);

  return {
    group,
    show(interaction) {
      current = interaction;
      const color = CARRIER[interaction];
      if (color) carriers.setColor(color);
      ctx.tweens.to(carriers, { density: color ? 1 : 0 }, { duration: 0.4 });
    },
    update(dt, t) {
      ORDER.forEach((id, i) => {
        shown[i] = damp(shown[i]!, id === current ? 1 : 0, 9, dt);
        stages[i]!.visible = shown[i]! > 0.02;
        stages[i]!.scale.setScalar(Math.max(shown[i]!, 1e-3));
      });
      const sep = 0.85 + 0.2 * Math.sin(t * 2.2);
      qa.position.set(-sep, 0.1 * Math.sin(t * 1.3), 0);
      qb.position.set(sep, -0.1 * Math.sin(t * 1.3), 0);
      spring.setEnds(0, [-sep, qa.position.y, 0], [sep, qb.position.y, 0]);
      spring.commit();

      // photon shuttles between the electrons; each one recoils when it emits / absorbs
      const phase = (t * 0.7) % 2;
      const k = phase < 1 ? phase : 2 - phase;
      const push = 0.16 * Math.cos(Math.PI * k) ** 6;
      ea.position.x = -1.35 - (k < 0.5 ? push : 0);
      eb.position.x = 1.35 + (k >= 0.5 ? push : 0);
      photon.position.x = -0.75 + 1.5 * k - 0.5;
      photon.fade = Math.min(1, 6 * k * (1 - k) + 0.15);

      // β-decay loop: 1,2 s neutron, then the three products fly apart
      const cycle = (t * 0.45) % 1.6;
      const after = Math.max(cycle - 0.6, 0);
      neutron.visible = cycle < 0.6;
      proton.visible = beta.visible = nu.visible = !neutron.visible;
      neutron.scale.setScalar(1 + 0.05 * Math.sin(t * 9) * (cycle / 0.6));
      proton.position.x = -0.25 * Math.min(after * 2, 1);
      beta.position.set(0.3 + after * 1.9, 0.2 + after * 0.9, 0);
      nu.position.set(0.3 + after * 1.9, -0.2 - after * 0.9, 0);
      const fade = Math.min(1, (1 - after) * 4);
      beta.scale.setScalar(Math.max(fade, 1e-3));
      nu.scale.setScalar(Math.max(fade, 1e-3));

      // gravity: the pull between two small masses is real but tiny — they hardly move
      const drift = 0.06 * (0.5 - 0.5 * Math.cos(t * 0.6));
      sa.position.x = -0.95 + drift * 0.4;
      sb.position.x = 0.95 - drift;
    },
  };
}
