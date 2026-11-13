/**
 * The flow around the specimen section of step 4, in the section's own frame (chord along +X, suction side
 * toward +Y), drawn from the potential-flow solution of `panel-flow.ts`:
 *
 *  - **streamlines** — thin white lines traced through the velocity field. Where they crowd together the air
 *    is fast (over the suction side), where they spread it is slow (under the section);
 *  - **air parcels** — bright dashes released together on every streamline and carried at the local speed of
 *    the field, so the eye sees the air over the top race ahead of the air underneath;
 *  - **separation** — beyond the stall the circulation is cut to the share of lift the simulation keeps; the
 *    point where the flow leaves the suction side follows from the same share (Kirchhoff's flat-plate relation
 *    C_L/C_L,attached = ((1 + √f)/2)², f = attached fraction of the chord); behind it the streamlines fade and
 *    `red` eddies roll downstream. The eddies are a qualitative drawing (chip «спрощена модель»).
 *
 * Alpha-blended `RibbonLines`, so everything reads on the bright sky and over the white blade.
 */
import { Group, Vector3 } from 'three';
import { RibbonLines, type RibbonLine } from '@/fx';
import { createPanelFlow } from './panel-flow';
import { CHORD, PITCH_AXIS, flowOutline, sectionAt } from './section';

/** Seeds across the oncoming stream, in chords from the stagnation line (denser near the section). */
const SEEDS = [-0.64, -0.48, -0.35, -0.24, -0.15, -0.08, -0.02, 0.03, 0.09, 0.16, 0.25, 0.36, 0.49, 0.64];
const STEP = 0.025;
const MAX_POINTS = 124;
/** How far the lines are traced up- and downstream of mid chord, in chords. */
const REACH = { up: 1.02, down: 1.08 } as const;
/** Chords of air released between two parcels, and how long a parcel's dash is (in flow time). */
const PARCEL_EVERY = 0.34;
const PARCEL_LENGTH = 0.09;
/** Chords per second the drawing runs at (real blades: ≈ 11 chords/s at 70 % span — «сповільнено ×20»). */
export const FLOW_RATE = 0.55;
export const FLOW_SLOWDOWN = 20;
const EDDIES = 12;
const EDDY_POINTS = 14;

interface Line {
  n: number;
  pts: Vector3[];
  /** Flow time at every point and visibility 0…1 (faded in separated air). */
  tau: Float32Array;
  show: Float32Array;
}

export interface FlowLines {
  group: Group;
  /** Chord fraction where the flow leaves the suction side (1 = attached to the trailing edge). */
  readonly attached: number;
  /** Retrace for an angle of attack (degrees) and the share of attached-flow lift that is left (1 = no stall). */
  shape(alphaDeg: number, liftShare: number): void;
  update(dt: number): void;
}

export function buildFlowLines(): FlowLines {
  const flow = createPanelFlow(flowOutline());
  const style = { dashStrength: 0, base: 1, hotCore: 0, blend: 'normal' } as const;
  const streams = new RibbonLines({ capacity: SEEDS.length * MAX_POINTS, color: 'white', width: 0.1, minPixels: 1.5, intensity: 1.05, endFade: [0.08, 0.12], ...style });
  const parcels = new RibbonLines({ capacity: SEEDS.length * 24 * 3, color: 'white', width: 0.2, minPixels: 2.4, intensity: 1.35, endFade: [0.7, 0.02], ...style });
  const eddies = new RibbonLines({ capacity: EDDIES * EDDY_POINTS, color: 'red', width: 0.2, minPixels: 2.4, intensity: 1.15, endFade: [0.05, 0.3], ...style });
  const group = new Group();
  group.name = 'flow-lines';
  group.add(streams, parcels, eddies);
  for (const r of [streams, parcels, eddies]) r.renderOrder = 5;
  const lines: Line[] = SEEDS.map(() => ({ n: 0, pts: Array.from({ length: MAX_POINTS }, () => new Vector3()), tau: new Float32Array(MAX_POINTS), show: new Float32Array(MAX_POINTS) }));
  const v: [number, number] = [0, 0];
  let alpha = 0;
  let gamma = 0;
  let attached = 1;
  let stall = 0;
  let clock = 0;
  /** Unit direction of the field at a point (chords). */
  const dir = (x: number, y: number): number => {
    flow.velocity(x, y, alpha, gamma, v);
    const s = Math.hypot(v[0], v[1]);
    v[0] /= s || 1;
    v[1] /= s || 1;
    return s;
  };
  const camber = (x: number): number => {
    const s = sectionAt(Math.min(1, Math.max(0, x + PITCH_AXIS)));
    return (s.upper + s.lower) / 2;
  };
  const state: FlowLines = {
    group,
    get attached() {
      return attached;
    },
    shape(alphaDeg, liftShare) {
      alpha = (alphaDeg * Math.PI) / 180;
      const share = Math.min(1, Math.max(0.25, liftShare));
      gamma = flow.kuttaGamma(alpha) * share;
      attached = Math.min(1, (2 * Math.sqrt(share) - 1) ** 2);
      stall = Math.min(1, (1 - share) * 4);
      const ux = Math.cos(alpha);
      const uy = Math.sin(alpha);
      // separated air: behind the separation point, between the stream line through it and the lower wake edge
      const sep = sectionAt(attached);
      const dead = (x: number, y: number): boolean => {
        if (attached >= 0.999 || x < sep.x) return false;
        const above = -(x - sep.x) * uy + (y - sep.upper) * ux;
        const below = -(x - 0.7) * uy + y * ux;
        return above < 0.03 && below > -0.02;
      };
      const out: RibbonLine[] = [];
      SEEDS.forEach((seed, li) => {
        const line = lines[li]!;
        let x = 0.2 - REACH.up * ux - seed * uy;
        let y = 0.03 - REACH.up * uy + seed * ux;
        let tau = 0;
        let n = 0;
        while (n < MAX_POINTS) {
          line.pts[n]!.set(x * CHORD, y * CHORD, 0);
          line.tau[n] = tau;
          line.show[n] = dead(x, y) ? 0.12 : 1;
          n++;
          if ((x - 0.2) * ux + (y - 0.03) * uy > REACH.down) break;
          // midpoint step along the field direction
          const speed = dir(x, y);
          dir(x + v[0] * STEP * 0.5, y + v[1] * STEP * 0.5);
          x += v[0] * STEP;
          y += v[1] * STEP;
          // the tabulated field is smooth across the skin: a line that slips in is put back outside
          for (let k = 0; k < 12 && flow.inside(x, y); k++) y += y > camber(x) ? 0.006 : -0.006;
          tau += STEP / Math.max(0.12, speed);
        }
        line.n = n;
        out.push({ points: line.pts.slice(0, n), brightness: Array.from(line.show.subarray(0, n), (s) => 0.62 * s) });
      });
      streams.setLines(out);
    },
    update(dt) {
      clock += dt * FLOW_RATE;
      const phase = clock % PARCEL_EVERY;
      const dashes: RibbonLine[] = [];
      for (const line of lines) {
        if (line.n < 2) continue;
        const end = line.tau[line.n - 1]!;
        let i = 1;
        for (let t = phase; t < end; t += PARCEL_EVERY) {
          const pts: Vector3[] = [];
          let show = 1;
          for (const back of [PARCEL_LENGTH, PARCEL_LENGTH / 2, 0]) {
            const at = Math.max(0, t - back);
            while (i < line.n - 1 && line.tau[i]! < at) i++;
            const a = line.tau[i - 1]!;
            const f = Math.min(1, Math.max(0, (at - a) / (line.tau[i]! - a || 1)));
            pts.push(line.pts[i - 1]!.clone().lerp(line.pts[i]!, f));
            show = line.show[i]!;
          }
          const ends = Math.min(1, t / 0.25, (end - t) / 0.35);
          dashes.push({ points: pts, brightness: 0.95 * show * Math.max(0, ends) });
        }
      }
      parcels.setLines(dashes);
      drawEddies();
    },
  };
  const centre = new Vector3();
  const drawEddies = (): void => {
    const curls: RibbonLine[] = [];
    if (stall > 0.01) {
      const ux = Math.cos(alpha);
      const uy = Math.sin(alpha);
      for (let e = 0; e < EDDIES; e++) {
        // born on the suction side behind the separation point, carried off at about half the stream speed
        const age = (clock * 0.42 + e / EDDIES) % 1;
        const birth = attached + (1 - attached) * ((e * 0.618) % 1);
        const s = sectionAt(birth);
        const drift = age * 1.25;
        centre.set((s.x + ux * drift) * CHORD, (s.upper + 0.05 + uy * drift + 0.1 * age) * CHORD, 0);
        const r = (0.035 + 0.13 * age) * CHORD;
        const turn = -clock * 9 + e * 2.1; // clockwise: the vorticity of the boundary layer it rolled up from
        const pts = Array.from({ length: EDDY_POINTS }, (_, k) => {
          const a = turn - k * 0.52;
          const rr = r * (1 - (0.8 * k) / (EDDY_POINTS - 1));
          return new Vector3(centre.x + Math.cos(a) * rr, centre.y + Math.sin(a) * rr, 0);
        });
        curls.push({ points: pts, brightness: 0.9 * stall * Math.sin(Math.PI * age) });
      }
    }
    eddies.setLines(curls);
  };
  return state;
}
