/**
 * Step 9 set pieces. The balance floating over the island: on the left pan one gondola of coal (70 t), on the
 * right what it turns into — a translucent `steel` ball of CO₂ (≈ 165 t, «the size of a house») and a grey cone of
 * ash (≈ 10 t). With capture on, the ball shrinks to the 10 % that still leaves the stack and the captured CO₂
 * runs down the injection pipe of the capture plant into a porous layer of the strata block that hangs under the
 * island's south rim (geological section, not to scale: the real storage lies deeper than ≈ 800 m).
 */
import { Group, Mesh, SphereGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { createFlow, type Flow } from '@/fx';
import { Builder, G, type KitModel } from '@/kit';
import { K, col, type ColorToken } from '@/style';
import { CCS, ISLAND, RIGS } from '../layout';
import { buildHeroWagon } from './coal-props';

export interface Carbon {
  scales: Group;
  /** Strata block + injection pipe (one actor). */
  ground: Group;
  strata: KitModel;
  injection: Flow;
  /** Anchors (world). */
  points: { wagon: Vector3; ball: Vector3; ash: Vector3; storage: Vector3; well: Vector3 };
  /** Masses on the pans [t]: coal (left), CO₂ to the stack and ash (right). */
  set(coalT: number, co2T: number, ashT: number): void;
}

const g = ISLAND.ground;
const ARM = 34;
/** Ball radius of 165 t of CO₂ in toy metres (volume ∝ mass). */
const R165 = 13;
/** The whole balance is drawn this much larger (it is the step's hero). */
const SIZE = 1.45;

export function buildCarbon(ctx: ChapterContext): Carbon {
  const s = RIGS.scales;
  const scales = new Group();
  scales.position.set(s.x, g + s.y, s.z);
  scales.scale.setScalar(SIZE);
  const post = new Builder('scales-post');
  post.cyl(1.2, 26, { seg: 20, slot: 'gloss', c: ['amber.dark', 'amber'], at: [0, -26, 0] });
  post.cyl(6, 2, { seg: 28, slot: 'gloss', c: 'amber.dark', at: [0, -28, 0] });
  post.add(G.cone(2.4, 3, { seg: 3 }), { slot: 'gloss', c: 'amber', at: [0, -1.4, 0] });
  scales.add(post.build().group);
  const beam = new Group();
  const bb = new Builder('scales-beam');
  bb.box(ARM * 2 + 4, 1.4, 1.6, { r: 0.5, mid: true, slot: 'gloss', c: ['amber', 'yellow'] });
  beam.add(bb.build().group);
  scales.add(beam);
  const pan = (x: number): Group => {
    const hang = new Group();
    hang.position.set(x, 0, 0);
    const pb = new Builder('pan');
    for (const a of [0, 2.1, 4.2]) pb.rod([0, 0, 0], [Math.cos(a) * 9, -18, Math.sin(a) * 9], 0.18, { slot: 'metal', c: 'steel' });
    pb.cyl(10, 1, { seg: 32, slot: 'gloss', c: ['steel', 'mist'], at: [0, -19, 0] });
    hang.add(pb.build().group);
    beam.add(hang);
    return hang;
  };
  const left = pan(-ARM);
  const right = pan(ARM);
  const wagon = buildHeroWagon();
  wagon.group.position.set(0, -18, 0);
  left.add(wagon.group);
  const ball = new Mesh(new SphereGeometry(1, 40, 24), K.glass({ color: 'steel', opacity: 0.45, edgeOpacity: 0.8 }));
  ball.renderOrder = 3;
  right.add(ball);
  const ash = new Mesh(G.cone(4.6, 5, { seg: 24 }), K.toon({ color: col('steel').lerp(col('mist'), 0.4) }));
  ash.position.set(6, -18, 2);
  right.add(ash);
  // strata block under the south rim: soil, clay, sandstone (storage), cap rock, basement
  const st = new Builder('strata');
  const layers: [number, number, ColorToken][] = [
    [0, 8, 'wireBrown'],
    [8, 20, 'steel'],
    [20, 30, 'slate'],
    [30, 40, 'amber.dark'],
    [40, 50, 'bg.violet'],
  ];
  for (const [y0, y1, c] of layers) st.box(34, y1 - y0, 18, { r: 0.3, slot: 'matte', c, at: [0, -y1, 0] });
  for (let k = 0; k < 11; k++) st.sphere(0.9, { seg: 8, slot: 'gloss', c: 'mist', at: [-14 + k * 2.8, -36 + (k % 3), 9.2] });
  const strata = st.build();
  strata.group.position.set(RIGS.strata.x, g - 2, RIGS.strata.z);
  // injection: capture plant well head → down the rim → into the storage layer
  const well = new Vector3(CCS.x + 20, g + 3, CCS.z - 10);
  const storage = new Vector3(RIGS.strata.x, g - 37, RIGS.strata.z + 4);
  const injection = createFlow(ctx, { kind: 'blob', color: 'mist', paths: [well, new Vector3(well.x, g - 1, RIGS.strata.z), new Vector3(storage.x, g - 20, storage.z), storage], count: ctx.quality.count(26, 10), radius: 0.8, speed: 8, spread: 0.4, halo: false });
  const pipe = new Builder('injection-pipe');
  pipe.tube([well, new Vector3(well.x, g - 1, RIGS.strata.z), new Vector3(storage.x, g - 20, storage.z), storage].map((p) => p.clone()), 0.5, { slot: 'glass', c: 'sky' });
  const pipeModel = pipe.build();
  const ground = new Group();
  ground.add(strata.group, pipeModel.group, injection);
  const scaleW = new Vector3(s.x, g + s.y, s.z);
  const api: Carbon = {
    scales,
    ground,
    strata,
    injection,
    points: { wagon: scaleW.clone().add(new Vector3(-ARM, -10, 0).multiplyScalar(SIZE)), ball: scaleW.clone().add(new Vector3(ARM, -4, 0).multiplyScalar(SIZE)), ash: scaleW.clone().add(new Vector3(ARM + 8, -14, 2).multiplyScalar(SIZE)), storage, well },
    set(coalT, co2T, ashT) {
      const r = R165 * Math.cbrt(Math.max(0.001, co2T) / 165);
      ball.scale.setScalar(r);
      ball.position.set(-2, -18 + r, -1);
      ash.scale.setScalar(Math.cbrt(Math.max(0.001, ashT) / 10));
      // tilt ∝ difference of the pans, saturated (a balance, not a weighing machine)
      const tilt = Math.tanh((co2T + ashT - coalT) / 80) * 0.22;
      beam.rotation.z = -tilt;
      left.rotation.z = tilt;
      right.rotation.z = tilt;
    },
  };
  return api;
}
