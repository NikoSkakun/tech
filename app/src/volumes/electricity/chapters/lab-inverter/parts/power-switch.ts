/**
 * `powerSwitch` — a power MOSFET cut open (scale ≈ 10⁻⁶ m, «не в масштабі»). Front face = the cross-section:
 * drain metal and n⁺ substrate at the bottom, the thick n⁻ drift region, two p wells with n⁺ source islands at
 * the top, thin gate oxide and the gate plate above the gap, source metal left and right. Colours: n regions
 * `teal`, p regions `pink` (DECISIONS §50), electrons `cyan`, the gate's field **E** `amber`.
 *
 * With the gate charged a channel of electrons forms under the oxide inside each p well; electrons then run
 * source → channel → drift region → drain. `setGate(g)`: 0 = closed, 1 = fully open, between = the half-open
 * «кран» (thin channel).
 */
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, createVectorArrow, type Flow, type VectorArrow } from '@/fx';
import { Builder, type KitModel } from '@/kit';
import { K, SEMANTIC, col, type KGlowMaterial, type KToonMaterial } from '@/style';

export interface PowerSwitch {
  group: Group;
  model: KitModel;
  /** Silicon material (heats up with losses: `applyHeat(silicon, t)`). */
  silicon: KToonMaterial;
  flow: Flow;
  /** Gate drive 0…1 (channel thickness, field arrows, electron stream); `conducting` scales the stream. */
  setGate(g: number, current?: number): void;
  readonly gate: number;
  /** Local anchor points for callouts (crystal space). */
  points: Record<'gate' | 'source' | 'drain' | 'channel' | 'drift' | 'pWell', Vector3>;
}

const W = 4.6;
const H = 2.0;
const D = 1.5;

export function createPowerSwitch(ctx: ChapterContext): PowerSwitch {
  const b = new Builder('power-switch');
  const nMinus = col('teal').lerp(col('white'), 0.22);
  const front = D / 2;
  // silicon lives in the `gloss` slot (one material → heat glow), metal contacts in `metal`
  b.box(W, 0.16, D, { r: 0.03, slot: 'metal', c: 'steel', at: [0, 0, 0] });
  b.box(W, 0.3, D, { r: 0.02, slot: 'gloss', c: 'teal.dark', at: [0, 0.16, 0] });
  b.box(W, H - 0.46, D, {
    r: 0.02,
    slot: 'gloss',
    c: [nMinus.clone().lerp(col('teal'), 0.35), nMinus],
    at: [0, 0.46, 0],
  });
  for (const s of [-1, 1]) {
    // p well and the n⁺ island inside it stand a hair proud of the cut face so the regions read crisply
    b.box(1.55, 0.8, D + 0.02, { r: 0.12, slot: 'gloss', c: 'pink', at: [s * 1.5, H - 0.79, 0] });
    b.box(0.72, 0.3, D + 0.04, { r: 0.08, slot: 'gloss', c: 'teal.dark', at: [s * 1.72, H - 0.29, 0] });
    b.box(1.0, 0.3, D, { r: 0.05, slot: 'metal', c: 'steel', at: [s * 1.78, H + 0.01, 0] });
    b.box(0.4, 0.5, 0.4, { r: 0.05, slot: 'metal', c: 'steel', at: [s * 1.9, H + 0.3, 0] });
  }
  b.box(2.5, 0.07, D + 0.02, {
    r: 0.01,
    slot: 'gloss',
    c: col('sky').lerp(col('white'), 0.5),
    at: [0, H + 0.005, 0],
  });
  // source strap over the top (both sources are one terminal) and the drain lead
  b.box(4.2, 0.12, 0.4, { r: 0.04, slot: 'metal', c: 'steel', at: [0, H + 0.8, 0] });
  b.box(0.3, 0.6, 0.3, { r: 0.05, slot: 'metal', c: 'steel', at: [0, -0.58, 0] });
  const model = b.build();
  const group = new Group();
  group.name = 'power-switch';
  group.add(model.group);

  // gate plate: its own material (glows amber while charged)
  const gateMat = K.toon({
    color: 'slate',
    emissive: SEMANTIC.fieldE,
    emissiveIntensity: 0,
    keepHue: true,
    gloss: 0.4,
  });
  const gate = new Mesh(new BoxGeometry(2.3, 0.26, D), gateMat);
  gate.position.set(0, H + 0.21, 0);
  gate.castShadow = true;
  const gateLead = new Mesh(new BoxGeometry(0.28, 0.34, 0.28), gateMat);
  gateLead.position.set(0, H + 0.5, 0.5);
  group.add(gate, gateLead);

  // inversion channels under the oxide, inside the p wells
  const channelMat: KGlowMaterial = K.glow({
    color: SEMANTIC.electron,
    intensity: 0,
    whiten: 0.2,
    keepHue: true,
    falloff: 0,
  });
  const channels = [-1, 1].map((s) => {
    const m = new Mesh(new BoxGeometry(0.78, 0.1, D + 0.06), channelMat);
    m.position.set(s * 0.97, H - 0.05, 0);
    group.add(m);
    return m;
  });

  // electrons: source metal → n⁺ island → channel → drift region → drain (drawn just in front of the cut)
  const z = front + 0.1;
  const path = (s: number): Vector3[] => [
    new Vector3(s * 1.9, H + 0.2, z),
    new Vector3(s * 1.75, H - 0.12, z),
    new Vector3(s * 1.3, H - 0.06, z),
    new Vector3(s * 0.62, H - 0.07, z),
    new Vector3(s * 0.34, H - 0.45, z),
    new Vector3(s * 0.28, 1.0, z),
    new Vector3(s * 0.3, 0.3, z),
    new Vector3(s * 0.15, -0.3, z),
  ];
  const flow = createFlow(ctx, {
    kind: 'electron',
    paths: [{ path: path(-1) }, { path: path(1) }],
    count: 70,
    radius: 0.06,
    speed: 1.1,
    spread: 0.05,
    wobble: 0.015,
  });
  flow.density = 0;
  group.add(flow);

  // field of the charged gate: E points from the gate (+) down into the silicon
  const arrows: VectorArrow[] = [-0.9, -0.45, 0, 0.45, 0.9].map((x) => {
    const a = createVectorArrow({
      color: SEMANTIC.fieldE,
      radius: 0.028,
      headLength: 0.16,
      headRadius: 0.075,
    });
    a.position.set(x, 0, z - 0.02);
    group.add(a);
    return a;
  });
  const down = new Vector3();
  const origin = new Vector3();
  let g = 0;
  const self: PowerSwitch = {
    group,
    model,
    silicon: model.mats.get('gloss') as KToonMaterial,
    flow,
    get gate() {
      return g;
    },
    setGate(value, current = 1) {
      g = Math.min(1, Math.max(0, value));
      gateMat.emissiveIntensity = 0.9 * g;
      channelMat.intensity = g > 0.02 ? 0.8 + 1.1 * g : 0;
      for (const c of channels) c.scale.y = Math.max(0.12, g);
      flow.density = g > 0.02 ? Math.min(1, (0.25 + 0.75 * g) * current) : 0;
      flow.speed = 0.5 + 0.9 * g;
      for (const a of arrows) {
        a.visible = g > 0.03;
        a.set(origin.set(0, H - 0.02, 0), down.set(0, -(0.2 + 0.45 * g), 0));
      }
    },
    points: {
      gate: new Vector3(0, H + 0.36, front),
      source: new Vector3(-1.9, H + 0.75, 0),
      drain: new Vector3(0, -0.5, 0.1),
      channel: new Vector3(0.97, H - 0.05, front),
      drift: new Vector3(-0.9, 0.9, front),
      pWell: new Vector3(1.9, H - 0.55, front),
    },
  };
  self.setGate(0);
  return self;
}
