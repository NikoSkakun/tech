/**
 * Water moving through the step-4 rig (`@/fx` flows): saturated `blue` blobs under full pressure from the
 * intake down the penstock and round the spiral case; paler `sky` blobs after they have given their energy to
 * the runner — six streams turning in through the wicket gates, down the draft tube and out into the
 * tailwater (pressure is shown by saturation / brightness of blue, never by the voltage ramp). One brighter
 * «hero droplet» rides the whole way; a `yellow` pulse climbs the shaft to the generator.
 */
import { Group, Mesh, SphereGeometry, CylinderGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import { K } from '@/style';
import { G } from '@/kit';
import { createFlow, type Flow } from '@/fx';
import { PATH, spiralPoint } from './path-rig';

export interface PathFlow {
  group: Group;
  /** Flow 0…1 of the design flow: speed and density of all streams. */
  set(q: number): void;
  update(dt: number): void;
  droplet: Mesh;
}

export function buildPathFlow(ctx: ChapterContext): PathFlow {
  const group = new Group();
  group.name = 'path-flow';
  const spiral: Vector3[] = [];
  for (let i = 0; i <= 30; i++) spiral.push(spiralPoint(i / 30));
  const inflow = [...G.roundPath(PATH.penstock as unknown as Vector3[], 4), ...spiral.slice(1)];
  const before = createFlow(ctx, {
    kind: 'blob',
    color: 'blue',
    paths: inflow,
    count: 170,
    radius: 0.8,
    speed: 6,
    spread: 1.3,
  });
  group.add(before);
  // six streams: from the spiral, in through the gates to the runner, down the draft tube, out to the tailwater
  const draft = G.roundPath(PATH.draft as unknown as Vector3[], 3);
  const streams = [0.08, 0.24, 0.4, 0.56, 0.72, 0.88].map((u) => {
    const s = spiralPoint(u);
    const mid = s.clone().lerp(PATH.unit, 0.55);
    const hub = PATH.unit.clone().setY(PATH.unit.y - 0.6);
    return { path: [s, mid, hub, ...draft.slice(1)] };
  });
  const after = createFlow(ctx, {
    kind: 'blob',
    color: 'sky',
    paths: streams,
    count: 200,
    radius: 0.65,
    speed: 5,
    spread: 0.9,
  });
  group.add(after);
  // the hero droplet and its route (penstock → spiral → first stream)
  const route = [...inflow, ...streams[0]!.path.slice(1)];
  const length = G.pathLength(route);
  const droplet = new Mesh(new SphereGeometry(0.85, 18, 12), K.glow({ color: 'white', intensity: 1.8 }));
  group.add(droplet);
  const shaftPulse = new Mesh(
    new CylinderGeometry(0.95, 0.95, 1.6, 12),
    K.glow({ color: 'yellow', intensity: 1.8 }),
  );
  group.add(shaftPulse);
  const flows: Flow[] = [before, after];
  let s = 0;
  let speed = 1;
  let pulse = 0;
  const tmp = new Vector3();
  return {
    group,
    droplet,
    set(q) {
      speed = q;
      before.speed = 7 * q;
      after.speed = 6 * q;
      for (const f of flows) f.density = Math.min(1, 0.15 + q);
    },
    update(dt) {
      s = (s + dt * 7 * Math.max(0.05, speed)) % length;
      droplet.position.copy(G.pathAt(route, s, tmp));
      // the energy leaves through the shaft: pulses rise from the runner to the generator while water flows
      pulse = (pulse + dt * (0.4 + 0.8 * speed)) % 1;
      shaftPulse.visible = speed > 0.03;
      shaftPulse.position.set(PATH.unit.x, PATH.unit.y + 3 + pulse * 7, 0);
      shaftPulse.scale.setScalar(0.6 + 0.4 * speed);
    },
  };
}
