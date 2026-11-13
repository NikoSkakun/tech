/**
 * Stand 2 — flow along curves: a glass "wire" loop with electrons (DC drift ↔ AC jiggle), a parallel branch
 * that splits the stream 2 : 1, an energy cable with pulses, a three-phase span and a light beam.
 */
import { DodecahedronGeometry, Group, Mesh, TubeGeometry, Vector3 } from 'three';
import type { ChapterContext } from '@/engine/api';
import {
  createBeam,
  createBundle,
  createFlow,
  createMeshFlow,
  createParticles,
  curveEmitter,
  createWire,
  curveThrough,
  flowNetwork,
  type Flow,
} from '@/fx';
import { K } from '@/style';
import type { Exhibit } from './exhibit';

/** Rounded rectangle polyline in the XY plane (corner radius r), counter-clockwise from the bottom left. */
function roundedRect(x0: number, y0: number, x1: number, y1: number, r: number, z = 0): Vector3[] {
  const pts: Vector3[] = [];
  const corner = (cx: number, cy: number, a0: number): void => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + (i / 6) * (Math.PI / 2);
      pts.push(new Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return pts;
}

export interface FlowExhibit extends Exhibit {
  flow: Flow;
}

export function createFlowExhibit(ctx: ChapterContext): FlowExhibit {
  const group = new Group();
  group.name = 'exhibit:flow';

  // circuit: outer loop + a middle branch (two routes sharing the left side)
  const outer = roundedRect(-4.2, 0.9, 1.2, 3.9, 0.5);
  const split = new Vector3(-1.5, 3.9, 0);
  const join = new Vector3(-1.5, 0.9, 0);
  const iSplit = outer.findIndex((p) => p.y > 3.89 && p.x < -1.5);
  const iJoin = outer.findIndex((p) => p.y < 0.91 && p.x > -1.5 && p.x < 0);
  void iJoin;
  // edges (all in travel order, counter-clockwise): right part of the loop, the branch, the left part
  const right = [join.clone(), ...outer.slice(0, iSplit).filter((p) => p.x > -1.5), split.clone()];
  const left = [split.clone(), ...outer.slice(iSplit), join.clone()];
  const branch = [split.clone(), new Vector3(-1.5, 2.4, 0), join.clone()];
  const net = flowNetwork(
    { right, left, branch },
    [
      { via: ['right', 'left'], weight: 2, closed: true },
      { via: ['-branch', 'left'], weight: 1, closed: true },
    ],
  );
  const flow = createFlow(ctx, { kind: 'electron', paths: net.paths, count: 150, radius: 0.085, spread: 0.1, wobble: 0.02, speed: 0.9 });
  group.add(flow);

  // glass tubes around the routes so the stream reads as "inside a conductor"
  const glass = K.glass({ color: 'orange', opacity: 0.1, edgeOpacity: 0.55 });
  const tube = (pts: Vector3[], closed: boolean): Mesh => {
    const m = new Mesh(new TubeGeometry(curveThrough(pts, closed), 160, 0.24, 16, closed), glass);
    m.renderOrder = 2;
    return m;
  };
  group.add(tube(outer, true), tube(branch, false));

  // energy cable with pulses below the circuit
  const cable = createWire(
    [new Vector3(-4.4, 0.35, 0.9), new Vector3(-1.5, 0.22, 1.3), new Vector3(1.4, 0.35, 0.9)],
    { radius: 0.07, repeat: 0.9, speed: 1.6 },
  );
  group.add(cable);

  // three-phase span between two small crossarms, and a beam above
  const xs = [2.4, 5.2];
  const bundle = createBundle(
    [0, 1, 2].map((i) => new Vector3(xs[0]!, 3.3 - i * 0.55, 0.2 - i * 0.2)),
    [0, 1, 2].map((i) => new Vector3(xs[1]!, 3.5 - i * 0.55, 0.2 - i * 0.2)),
    { sag: 0.35, radius: 0.035, repeat: 1.4, speed: 1.2, color: 'slate' },
  );
  group.add(bundle);
  const beam = createBeam({ from: [2.3, 1.0, 0.3], to: [5.3, 1.5, 0.3], color: 'yellow', width: 0.06 });
  group.add(beam);

  // electrolyte: ions of both signs drift in opposite directions through a glass tube
  const cell = [new Vector3(2.4, 2.25, 0.9), new Vector3(5.3, 2.25, 0.9)];
  group.add(tube(cell, false));
  group.add(createFlow(ctx, { kind: 'ion', paths: cell, count: 14, radius: 0.1, spread: 0.1, speed: 0.35, bidirectional: true, halo: false }));
  // sparkles born along the energy cable (curve emitter)
  const cablePath = curveThrough([new Vector3(-4.4, 0.35, 0.9), new Vector3(-1.5, 0.22, 1.3), new Vector3(1.4, 0.35, 0.9)]);
  group.add(createParticles(ctx, { count: 40, emitter: curveEmitter(cablePath, { axis: [0, 1, 0], spread: 0.6 }), color: ['yellow', 'amber'], size: [0.05, 0.02], life: [0.6, 1.2], speed: [0.15, 0.4], intensity: 1.6 }));

  // coal lumps riding a conveyor line (CPU mesh flow: real meshes with shadows)
  const coal = createMeshFlow(ctx, {
    geometry: new DodecahedronGeometry(0.11, 0),
    material: K.toon({ color: 'ink', flatShading: true }),
    path: [new Vector3(2.3, 0.14, 1.6), new Vector3(5.4, 0.14, 1.6)],
    count: 12,
    speed: 0.6,
    scale: [0.7, 1.2],
    jitter: 0.05,
    tumble: 1.5,
  });
  group.add(coal);

  return {
    group,
    flow,
    update(_dt, t) {
      // DC for 6 s, then AC for 6 s — tween-free here: smooth blends derived from time
      const k = 0.5 - 0.5 * Math.cos((t / 12) * Math.PI * 2); // 0 = DC … 1 = AC
      const ac = Math.min(Math.max((k - 0.35) / 0.3, 0), 1);
      flow.speed = 0.9 * (1 - ac);
      flow.ac.amplitude = 0.45 * ac;
      flow.ac.frequency = 0.9;
      beam.reach = Math.min(1, (t % 6) / 1.2);
    },
  };
}
