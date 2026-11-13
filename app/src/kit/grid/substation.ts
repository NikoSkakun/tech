/**
 * Substation assembler: lays out an outdoor switchyard from a description of its bays, in the real order of
 * apparatus, and wires everything phase by phase. Everything merges into a few draw calls.
 *
 *   line bay (toward +Z):        busbar ← bus disconnector ← breaker ← CT ← line disconnector ← CVT ← arrester ← gantry ← line
 *   transformer bay (toward −Z): busbar → bus disconnector → breaker → CT → arrester → power transformer
 *
 * The busbar (rigid tubes on post insulators) runs along X at z = 0. Units: metres.
 * Anchors: `bayN` (bay centre), `bayN.<apparatus>.pK.*` for every apparatus (`dsb`, `cb`, `ct`, `dsl`, `vt`,
 * `oa`, `gantry`, `t`), `bus`. `ports[n]` is a line termination usable in `powerLine([...towers, yard.ports[0]])`.
 */
import { Vector3 } from 'three';
import { col } from '@/style';
import { Builder, type KitModel } from '../core/builder';
import { catenary, roundPath } from '../core/geo';
import { addFence } from '../env/props';
import { addGantry, bayWidth, gantryHeight } from './gantry';
import { isLowDetail, withLowDetail } from './insulators';
import { addBusSupport, addCurrentTransformer, addSurgeArrester, addVoltageTransformer } from './instruments';
import { PEDESTAL, addBreaker, addDisconnector, insulationHeight, phaseSpacing } from './switchgear';
import { TOWER_SPECS, type Tower, type TowerVoltage } from './towers';
import { addPowerTransformer, type TransformerOptions } from './transformer';

export interface BaySpec {
  type: 'line' | 'transformer';
  /** Transformer bays: options of the unit (its `hv` defaults to the yard voltage). */
  transformer?: TransformerOptions;
  /** Show the breaker's bay as switched off: both disconnectors open. */
  open?: boolean;
}

export interface SubstationOptions {
  /** Voltage class of the yard, kV. Default 110. */
  kV?: number;
  bays: readonly BaySpec[];
  /** Perimeter fence (and floodlight masts). Default true; false by default with `detail: 'light'`. */
  fence?: boolean;
  /**
   * `full` (default): every apparatus of a real bay (≈ 85k triangles per bay at 110 kV). `light` (M3): only the
   * apparatus that reads from a distance — line bay: breaker → line disconnector → gantry; transformer bay:
   * breaker → transformer (no fans) — with coarser wires; about a third of the cost. Same anchors per apparatus
   * present, same `ports`.
   */
  detail?: 'full' | 'light';
}

export interface Substation extends KitModel {
  /** Line terminations (one per line bay, in bay order) — pass them to `powerLine` like towers. */
  readonly ports: readonly Tower[];
  /** Footprint [width (x), depth (z)] of the fenced yard. */
  readonly footprint: readonly [number, number];
}

export function addSubstation(b: Builder, o: SubstationOptions): { ports: string[]; footprint: [number, number] } {
  if (o.detail === 'light' && !isLowDetail()) return withLowDetail(() => addSubstation(b, o));
  const kV = o.kV ?? 110;
  const sp = phaseSpacing(kV);
  const bw = bayWidth(kV);
  const step = insulationHeight(kV) * 1.3 + 2.6;
  const yBus = PEDESTAL + 0.07 + insulationHeight(kV) + 0.2;
  const total = o.bays.length * bw;
  // `locate` returns model-space points, so the wires are collected and added outside the bay frames
  const wires: Vector3[][] = [];
  const wire = (pts: Vector3[]): void => void wires.push(pts);
  const link = (from: string, to: string): void => {
    for (let k = 1; k <= 3; k++) {
      const p = b.locate(`${from}.p${k}.out`);
      const q = b.locate(`${to}.p${k}.in`);
      wire(catenary(p, q, p.distanceTo(q) * 0.04, wireSeg));
    }
  };
  const light = o.detail === 'light';
  const wireSeg = light ? 4 : 8;
  const ports: string[] = [];
  let zMax = 0;
  let zMin = 0;
  o.bays.forEach((bay, i) => {
    const x = -total / 2 + (i + 0.5) * bw;
    const name = `bay${i + 1}`;
    b.frame({ at: [x, 0, 0], rot: [0, Math.PI / 2, 0] }, () => addBusSupport(b, { kV, length: bw }), `bus${i + 1}.`);
    const line = bay.type === 'line';
    // each bay is built in its own frame looking away from the busbar: +Z for line bays, −Z for transformer bays
    b.frame({ at: [x, 0, 0], rot: [0, line ? 0 : Math.PI, 0] }, () => {
      const full: [string, number, () => void][] = line
        ? [
            ['dsb', 0.9, () => addDisconnector(b, { kV, open: bay.open ? 1 : 0, earthing: false })],
            ['cb', 1.0, () => addBreaker(b, { kV })],
            ['ct', 0.8, () => addCurrentTransformer(b, { kV })],
            ['dsl', 1.0, () => addDisconnector(b, { kV, open: bay.open ? 1 : 0 })],
            ['vt', 0.8, () => addVoltageTransformer(b, { kV })],
            ['oa', 0.55, () => addSurgeArrester(b, { kV })],
          ]
        : [
            ['dsb', 0.9, () => addDisconnector(b, { kV, open: bay.open ? 1 : 0, earthing: false })],
            ['cb', 1.0, () => addBreaker(b, { kV })],
            ['ct', 0.8, () => addCurrentTransformer(b, { kV })],
            ['oa', 0.7, () => addSurgeArrester(b, { kV })],
          ];
      const keep = line ? ['cb', 'dsl'] : ['cb'];
      const chain = light ? full.filter(([id]) => keep.includes(id)) : full;
      const last = chain[chain.length - 1]![0];
      let z = sp + 0.6;
      let prev = '';
      for (const [id, k, make] of chain) {
        z += step * k;
        b.frame({ at: [0, 0, z] }, make, `${name}.${id}.`);
        if (prev) link(`${name}.${prev}`, `${name}.${id}`);
        prev = id;
      }
      if (line) {
        z += step * 0.7;
        b.frame({ at: [0, 0, z] }, () => addGantry(b, { kV, bays: 1 }), `${name}.gantry.`);
        for (let k = 1; k <= 3; k++) {
          const p = b.locate(`${name}.${last}.p${k}.out`);
          const q = b.locate(`${name}.gantry.b1.p${k}.drop`);
          wire(catenary(p, q, 0.5, wireSeg));
        }
        ports.push(`${name}.gantry`);
        zMax = Math.max(zMax, z + 3);
      } else {
        const unit = { hv: kV, lv: kV >= 220 ? 110 : 10, ...(light ? { fans: false } : {}), ...bay.transformer };
        z += step * 0.6 + 3.2 + Math.pow(unit.hv, 0.42) * 0.25;
        b.frame({ at: [0, 0, z], rot: [0, Math.PI, 0] }, () => addPowerTransformer(b, unit), `${name}.t.`);
        for (let k = 1; k <= 3; k++) {
          const p = b.locate(`${name}.${last}.p${k}.out`);
          const q = b.locate(`${name}.t.hv${unit.phases === 1 ? 1 : 4 - k}`);
          wire(catenary(p, q, 0.4, wireSeg));
        }
        zMin = Math.min(zMin, -(z + 5.5 + Math.pow(unit.hv, 0.42) * 0.3));
      }
      b.anchor(name, 0, 0, z / 2);
    });
    // bay conductors rise over the busbar and drop onto their own phase tube
    for (let k = 1; k <= 3; k++) {
      const p = b.locate(`${name}.${light ? 'cb' : 'dsb'}.p${k}.in`);
      const tube = b.locate(`bus${i + 1}.p${k}.top`);
      const up = yBus + 1.5;
      wire(roundPath([p, new Vector3(p.x, up, p.z * 0.75), new Vector3(p.x, up, tube.z), new Vector3(p.x, yBus + 0.15, tube.z)], 0.6, light ? 3 : 5));
    }
  });
  for (const pts of wires) b.tube(pts, 0.07, { seg: light ? 4 : 5, slot: 'metal', c: 'mist' });
  b.anchor('bus', 0, yBus, 0);
  // gravel yard, fence, two floodlight masts
  zMax += 2;
  zMin -= 2;
  const w = total + 8;
  const d = zMax - zMin;
  const zc = (zMax + zMin) / 2;
  b.box(w, 0.3, d, { r: 0.12, slot: 'matte', c: col('mist').lerp(col('steel.light'), 0.45), at: [0, -0.32, zc] });
  const fenced = o.fence ?? !light;
  if (fenced) {
    const hw = w / 2 - 0.6;
    addFence(b, { kind: 'mesh', bend: 1.5, route: [[-hw + 4, zMin + 0.6], [hw, zMin + 0.6], [hw, zMax - 0.6], [-hw, zMax - 0.6], [-hw, zMin + 0.6], [-hw + 1.2, zMin + 0.6]] });
  }
  for (const sx of fenced ? [-1, 1] : []) {
    const mx = sx * (w / 2 - 2);
    const mh = gantryHeight(kV) + 4;
    b.cyl(0.16, mh, { rTop: 0.08, seg: 8, slot: 'metal', c: 'steel', at: [mx, 0, zMin + 2], bevel: 0 });
    b.box(1.2, 0.2, 0.5, { r: 0.05, slot: 'metal', c: 'slate', at: [mx, mh, zMin + 2] });
    for (const dx of [-0.35, 0.35]) b.box(0.4, 0.3, 0.12, { r: 0.04, slot: 'lamp', c: 'white', at: [mx + dx, mh - 0.28, zMin + 2.3], rot: [0.5, 0, 0] });
    b.anchor(`flood${sx > 0 ? 2 : 1}`, mx, mh, zMin + 2.3);
  }
  return { ports, footprint: [w, d] };
}

/**
 * A gantry built with `addGantry` inside any model (`prefix` = the frame prefix it was built under, without the
 * trailing dot, e.g. `'yard.gantry'`) as a line support for `powerLine([...towers, port])` (M3). Uses bay 1.
 */
export function gantryPort(model: KitModel, prefix: string, kV = 110): Tower {
  const voltage = kV as TowerVoltage;
  const spec = TOWER_SPECS[voltage] ?? TOWER_SPECS[110];
  return Object.assign(Object.create(model) as KitModel, {
    spec,
    voltage,
    phases: [1, 2, 3].map((k) => `${prefix}.b1.p${k}`),
    shields: spec.shields === 2 ? [`${prefix}.s1`, `${prefix}.s2`] : [`${prefix}.s1`],
  }) as Tower;
}

export function substation(o: SubstationOptions): Substation {
  const b = new Builder(`substation-${o.kV ?? 110}${o.detail === 'light' ? '-light' : ''}`);
  const info = addSubstation(b, o);
  const model = b.build();
  const ports = info.ports.map((prefix) => gantryPort(model, prefix, o.kV ?? 110));
  return Object.assign(model, { ports, footprint: info.footprint });
}
